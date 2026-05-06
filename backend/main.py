import asyncio
import logging
import os
from contextlib import asynccontextmanager
from functools import wraps
from time import time
from typing import Literal

from cachetools import TTLCache
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Path
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)

from models.ensemble import BTCEnsemble
from services.data_fetcher import fetch_daily_ohlcv, fetch_fear_greed, fetch_hourly_ohlcv, fetch_live_price, fetch_onchain
from services.indicators import compute_indicators, get_indicator_snapshot
from services import retrainer

CORS_ORIGINS = os.getenv(
    "CORS_ORIGINS",
    "https://predictalpha.app,https://www.predictalpha.app,https://deepvortexai.com,https://www.deepvortexai.com,http://localhost:3000,http://localhost:5173",
).split(",")

RETRAIN_INTERVAL_HOURS = int(os.getenv("MODEL_RETRAIN_INTERVAL_HOURS", "48"))

HorizonKey = Literal["1h", "4h", "8h", "12h", "24h", "1month"]

# ── In-memory TTL caches ─────────────────────────────────────────────────────
_price_cache: TTLCache = TTLCache(maxsize=1, ttl=60)           # 1 min
_indicators_cache: TTLCache = TTLCache(maxsize=1, ttl=300)     # 5 min
_sentiment_cache: TTLCache = TTLCache(maxsize=1, ttl=1800)     # 30 min
_onchain_cache: TTLCache = TTLCache(maxsize=1, ttl=1800)       # 30 min
_predict_cache: TTLCache = TTLCache(maxsize=10, ttl=3600)      # 1 h per horizon

# Shared dataframe cache (refreshed alongside indicators)
_hourly_df = None
_daily_df = None
_df_fetched_at: float = 0.0
_DF_REFRESH_SECONDS = 300  # 5 min


async def _get_dataframes():
    global _hourly_df, _daily_df, _df_fetched_at
    if time() - _df_fetched_at > _DF_REFRESH_SECONDS:
        _hourly_df, _daily_df = await asyncio.gather(
            fetch_hourly_ohlcv(days=90),
            fetch_daily_ohlcv(days=365),
        )
        _df_fetched_at = time()
    return _hourly_df, _daily_df


# ── App lifespan ─────────────────────────────────────────────────────────────
ensemble = BTCEnsemble(data_dir="models")


@asynccontextmanager
async def lifespan(app: FastAPI):
    retrainer.inject_ensemble(ensemble)

    # Try to load pre-trained models from persistent volume
    logger.info("Checking for existing models in /app/models...")
    loop = asyncio.get_event_loop()
    loaded = await loop.run_in_executor(None, ensemble.load_models)

    if not loaded:
        logger.info("No saved models found — triggering initial training in background")
        asyncio.create_task(retrainer.initial_train())
    else:
        logger.info("✓ Loaded existing models successfully — skipping retraining")

    retrainer.start_scheduler(retrain_interval_hours=RETRAIN_INTERVAL_HOURS)

    yield

    retrainer.stop_scheduler()


app = FastAPI(
    title="DeepVortex BTC Predictor API",
    version="1.0.0",
    description="Bitcoin price prediction API powered by LSTM, XGBoost, and Prophet ensemble",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "OPTIONS"],
    allow_headers=["*"],
)


# ── Health ────────────────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    status = retrainer.get_status()
    return {"status": "ok", **status}


# ── Live Price ────────────────────────────────────────────────────────────────
@app.get("/api/price/live")
async def get_live_price():
    """Current BTC price from CoinGecko with 24h stats."""
    if "price" in _price_cache:
        return _price_cache["price"]

    try:
        data = await fetch_live_price()
        _price_cache["price"] = data
        return data
    except Exception as exc:
        logger.error(f"Live price fetch failed: {exc}")
        raise HTTPException(502, "Failed to fetch live price from CoinGecko")


# ── Technical Indicators ──────────────────────────────────────────────────────
@app.get("/api/indicators")
async def get_indicators():
    """RSI, MACD, Bollinger Bands, EMA50/200, OBV, ATR for current BTC price action."""
    if "indicators" in _indicators_cache:
        return _indicators_cache["indicators"]

    try:
        hourly_df, _ = await _get_dataframes()
        df_with_ind = compute_indicators(hourly_df)
        snapshot = get_indicator_snapshot(df_with_ind)
        _indicators_cache["indicators"] = snapshot
        return snapshot
    except Exception as exc:
        logger.error(f"Indicators fetch failed: {exc}")
        raise HTTPException(502, f"Failed to compute indicators: {exc}")


# ── Predictions ───────────────────────────────────────────────────────────────
@app.get("/api/predict/{horizon}")
async def get_prediction(
    horizon: HorizonKey = Path(..., description="Prediction horizon: 1h, 4h, 8h, 12h, 24h, 1month"),
):
    """
    Ensemble prediction (LSTM + XGBoost + Prophet) for the requested horizon.
    Returns predicted price, % change, direction, and per-model breakdown.
    """
    if not ensemble.is_ready:
        status = retrainer.get_status()
        if status["is_training"]:
            raise HTTPException(503, detail="Models are currently being trained. Please retry in a few minutes.")
        raise HTTPException(503, detail="Models are not trained yet. Training will begin shortly.")

    cache_key = f"pred_{horizon}"
    if cache_key in _predict_cache:
        return _predict_cache[cache_key]

    try:
        live = await fetch_live_price()
        current_price = live["price"]
        hourly_df, daily_df = await _get_dataframes()

        result = await asyncio.get_event_loop().run_in_executor(
            None,
            ensemble.predict,
            horizon,
            hourly_df,
            daily_df,
            current_price,
        )

        if "error" in result:
            raise HTTPException(503, detail=result["error"])

        _predict_cache[cache_key] = result

        # Also check if any outstanding predictions can now be resolved
        asyncio.create_task(_resolve_predictions(current_price))

        return result
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Prediction failed for {horizon}: {exc}", exc_info=True)
        raise HTTPException(500, f"Prediction error: {exc}")


async def _resolve_predictions(current_price: float):
    try:
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, ensemble.resolve_predictions, current_price)
    except Exception as exc:
        logger.error(f"resolve_predictions error: {exc}")


# ── Sentiment ─────────────────────────────────────────────────────────────────
@app.get("/api/sentiment")
async def get_sentiment():
    """Fear & Greed Index from Alternative.me with 7-day history."""
    if "sentiment" in _sentiment_cache:
        return _sentiment_cache["sentiment"]

    try:
        data = await fetch_fear_greed()
        _sentiment_cache["sentiment"] = data
        return data
    except Exception as exc:
        logger.error(f"Sentiment fetch failed: {exc}")
        raise HTTPException(502, "Failed to fetch sentiment data")


# ── On-Chain ──────────────────────────────────────────────────────────────────
@app.get("/api/onchain")
async def get_onchain():
    """On-chain metrics from Blockchain.com: hash rate, difficulty, mempool, fees."""
    if "onchain" in _onchain_cache:
        cached = _onchain_cache["onchain"]
        # Clear cache if hash_rate is 0 or null (invalid data)
        if not cached.get("hash_rate") or cached.get("hash_rate") == 0:
            logger.warning("Cached onchain data has invalid hash_rate, forcing refresh")
            del _onchain_cache["onchain"]  # force refresh
        else:
            return cached

    try:
        data = await fetch_onchain()
        _onchain_cache["onchain"] = data
        return data
    except Exception as exc:
        logger.error(f"On-chain fetch failed: {exc}")
        raise HTTPException(502, "Failed to fetch on-chain data")


# ── Accuracy ──────────────────────────────────────────────────────────────────
@app.get("/api/accuracy")
async def get_accuracy():
    """
    Historical prediction accuracy: MAPE and direction accuracy per horizon.
    Computed from all stored predictions that have been resolved against actual prices.
    """
    return ensemble.get_accuracy()


# ── Training status ───────────────────────────────────────────────────────────
@app.get("/api/status")
async def get_status():
    """Current model training status and readiness."""
    return retrainer.get_status()


# ── Manual retrain trigger (protected by env secret) ─────────────────────────
@app.post("/api/admin/retrain")
async def trigger_retrain(secret: str):
    admin_secret = os.getenv("ADMIN_SECRET", "")
    if not admin_secret or secret != admin_secret:
        raise HTTPException(403, "Forbidden")
    if retrainer.get_status()["is_training"]:
        return {"message": "Training already in progress"}
    asyncio.create_task(retrainer.retrain_all())
    return {"message": "Retraining triggered"}
