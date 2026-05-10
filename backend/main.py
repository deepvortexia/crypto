import asyncio
import json
import logging
import os
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from functools import wraps
from time import time
from typing import Literal

import httpx

import jwt
import stripe
from cachetools import TTLCache
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException, Path, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from supabase import create_client, Client

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)

# ── Stripe setup ─────────────────────────────────────────────────────────────
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
STRIPE_PRICE_ID = os.getenv("STRIPE_PRICE_ID")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")

# ── Supabase setup ───────────────────────────────────────────────────────────
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET", "").strip()
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY) if SUPABASE_URL and SUPABASE_SERVICE_KEY else None


async def get_current_user(authorization: str = Header(...)) -> dict:
    """Verify Supabase JWT and return user data."""
    if not authorization.startswith("Bearer "):
        raise HTTPException(401, "Invalid authorization header")
    token = authorization.split(" ")[1]
    try:
        response = supabase.auth.get_user(token)
        user = response.user
        if not user:
            raise HTTPException(401, "Invalid token")
        return {"id": str(user.id), "email": user.email}
    except Exception as e:
        raise HTTPException(401, f"Invalid token: {str(e)}")

from models.ensemble import BTCEnsemble
from services.data_fetcher import fetch_daily_ohlcv, fetch_fear_greed, fetch_hourly_ohlcv, fetch_live_price, fetch_onchain
from services.indicators import compute_indicators, get_indicator_snapshot
from services.news_sentiment import fetch_news_sentiment
from services import retrainer

CORS_ORIGINS = os.getenv(
    "CORS_ORIGINS",
    "https://predictalpha.app,https://www.predictalpha.app,https://deepvortexai.com,https://www.deepvortexai.com,http://localhost:3000,http://localhost:5173",
).split(",")

RETRAIN_INTERVAL_HOURS = int(os.getenv("MODEL_RETRAIN_INTERVAL_HOURS", "24"))

HorizonKey = Literal["1h", "4h", "8h", "12h", "24h", "1month"]

# ── In-memory TTL caches ─────────────────────────────────────────────────────
_price_cache: TTLCache = TTLCache(maxsize=1, ttl=60)           # 1 min
_indicators_cache: TTLCache = TTLCache(maxsize=1, ttl=300)     # 5 min
_sentiment_cache: TTLCache = TTLCache(maxsize=1, ttl=1800)     # 30 min
_onchain_cache: TTLCache = TTLCache(maxsize=1, ttl=1800)       # 30 min
_predict_cache: TTLCache = TTLCache(maxsize=10, ttl=3600)      # 1 h per horizon
_news_cache: TTLCache = TTLCache(maxsize=1, ttl=1800)          # 30 min
_tensions_cache: TTLCache = TTLCache(maxsize=1, ttl=300)       # 5 min

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
ensemble = BTCEnsemble(data_dir="saved_models")


@asynccontextmanager
async def lifespan(app: FastAPI):
    retrainer.inject_ensemble(ensemble)

    # Try to load pre-trained models from persistent volume
    logger.info("Checking for existing models in /app/saved_models...")
    loop = asyncio.get_event_loop()
    loaded = await loop.run_in_executor(None, ensemble.load_models)

    files = os.listdir("/app/saved_models") if os.path.exists("/app/saved_models") else []
    logger.info(f"Files in /app/saved_models: {files}")

    if not loaded:
        logger.info("No saved models found — triggering initial training in background")
        asyncio.create_task(retrainer.initial_train())
    else:
        logger.info("✓ Loaded existing models successfully — skipping retraining")

    retrainer.start_scheduler(retrain_interval_hours=RETRAIN_INTERVAL_HOURS)
    asyncio.create_task(_warmup_tensions())

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
    allow_methods=["GET", "POST", "OPTIONS"],
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


# ── News Sentiment ───────────────────────────────────────────────────────────
@app.get("/api/news-sentiment")
async def get_news_sentiment():
    """AI-scored crypto news sentiment from CoinTelegraph, CoinDesk, Decrypt (last 24h)."""
    if "news" in _news_cache:
        return _news_cache["news"]
    try:
        data = await fetch_news_sentiment()
        _news_cache["news"] = data
        return data
    except Exception as exc:
        logger.error(f"News sentiment failed: {exc}")
        raise HTTPException(502, "Failed to fetch news sentiment")


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


# ── Stripe Checkout ──────────────────────────────────────────────────────────
@app.post("/api/create-checkout-session")
async def create_checkout_session(user: dict = Depends(get_current_user)):
    """Create a Stripe Checkout session for subscription."""
    if not stripe.api_key or not STRIPE_PRICE_ID:
        raise HTTPException(500, "Stripe not configured")

    try:
        # Get or create Stripe customer
        existing = supabase.table("subscriptions").select("stripe_customer_id").eq("user_id", user["id"]).execute()

        if existing.data and existing.data[0].get("stripe_customer_id"):
            customer_id = existing.data[0]["stripe_customer_id"]
        else:
            customer = stripe.Customer.create(email=user["email"], metadata={"supabase_user_id": user["id"]})
            customer_id = customer.id
            supabase.table("subscriptions").upsert({
                "user_id": user["id"],
                "stripe_customer_id": customer_id,
                "status": "inactive"
            }).execute()

        session = stripe.checkout.Session.create(
            customer=customer_id,
            payment_method_types=["card"],
            line_items=[{"price": STRIPE_PRICE_ID, "quantity": 1}],
            mode="subscription",
            success_url=os.getenv("FRONTEND_URL", "https://predictalpha.app") + "/dashboard?success=true",
            cancel_url=os.getenv("FRONTEND_URL", "https://predictalpha.app") + "/pricing?canceled=true",
        )
        return {"url": session.url}
    except stripe.StripeError as e:
        logger.error(f"Stripe error: {e}")
        raise HTTPException(400, str(e))


@app.post("/api/webhook")
async def stripe_webhook(request: Request):
    """Handle Stripe webhook events."""
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, STRIPE_WEBHOOK_SECRET)
    except ValueError:
        raise HTTPException(400, "Invalid payload")
    except stripe.SignatureVerificationError:
        raise HTTPException(400, "Invalid signature")

    event_type = event["type"]
    data = event["data"]["object"]

    def unix_to_iso(ts: int) -> str:
        return datetime.fromtimestamp(ts, tz=timezone.utc).isoformat()

    now_iso = datetime.now(timezone.utc).isoformat()

    if event_type == "customer.subscription.created":
        supabase.table("subscriptions").update({
            "stripe_subscription_id": data["id"],
            "status": "active",
            "current_period_end": unix_to_iso(data.get("current_period_end")) if data.get("current_period_end") else None,
            "updated_at": now_iso
        }).eq("stripe_customer_id", data["customer"]).execute()
        logger.info(f"Subscription created for customer {data['customer']}")

    elif event_type == "customer.subscription.updated":
        status = "active" if data["status"] == "active" else data["status"]
        supabase.table("subscriptions").update({
            "status": status,
            "current_period_end": unix_to_iso(data.get("current_period_end")) if data.get("current_period_end") else None,
            "updated_at": now_iso
        }).eq("stripe_customer_id", data["customer"]).execute()
        logger.info(f"Subscription updated for customer {data['customer']}: {status}")

    elif event_type == "customer.subscription.deleted":
        supabase.table("subscriptions").update({
            "status": "inactive",
            "current_period_end": None,
            "updated_at": now_iso
        }).eq("stripe_customer_id", data["customer"]).execute()
        logger.info(f"Subscription deleted for customer {data['customer']}")

    return {"status": "ok"}


@app.get("/api/debug-token")
async def debug_token(authorization: str = Header(None)):
    secret = os.getenv("SUPABASE_JWT_SECRET", "")
    return {
        "secret_len": len(secret),
        "secret_first10": secret[:10],
        "secret_last5": secret[-5:],
        "auth_header": authorization[:50] if authorization else None
    }


@app.get("/api/subscription-status")
async def get_subscription_status(user: dict = Depends(get_current_user)):
    """Get current user's subscription status."""
    result = supabase.table("subscriptions").select("status, current_period_end").eq("user_id", user["id"]).execute()

    if not result.data:
        return {"status": "inactive", "current_period_end": None}

    sub = result.data[0]
    return {
        "status": sub.get("status", "inactive"),
        "current_period_end": sub.get("current_period_end")
    }


# ── Deep Analysis credits (2/day for free users, unlimited for PRO) ──────────
DEEP_ANALYSIS_DAILY_LIMIT = 2


def _is_pro(user_id: str) -> bool:
    try:
        sub = supabase.table("subscriptions").select("status").eq("user_id", user_id).execute()
        return bool(sub.data and sub.data[0].get("status") == "active")
    except Exception:
        return False


@app.get("/api/deep-analysis/remaining")
async def get_deep_analysis_remaining(user: dict = Depends(get_current_user)):
    """Return how many Deep Analysis uses the user has left today."""
    user_id = user["id"]
    if _is_pro(user_id):
        return {"remaining": 999, "limit": DEEP_ANALYSIS_DAILY_LIMIT, "is_pro": True}

    today = datetime.now(timezone.utc).date().isoformat()
    row = supabase.table("deep_analysis_usage").select("count").eq("user_id", user_id).eq("use_date", today).execute()
    used = row.data[0]["count"] if row.data else 0
    return {"remaining": max(0, DEEP_ANALYSIS_DAILY_LIMIT - used), "limit": DEEP_ANALYSIS_DAILY_LIMIT, "is_pro": False}


@app.post("/api/deep-analysis/use")
async def use_deep_analysis(user: dict = Depends(get_current_user)):
    """Atomically consume one Deep Analysis credit. Returns 429 if daily limit reached."""
    user_id = user["id"]
    if _is_pro(user_id):
        return {"allowed": True, "remaining": 999, "is_pro": True}

    result = supabase.rpc("try_use_deep_analysis", {"p_user_id": user_id, "p_limit": DEEP_ANALYSIS_DAILY_LIMIT}).execute()
    count = result.data

    if count == -1:
        raise HTTPException(
            status_code=429,
            detail={"message": f"Daily limit of {DEEP_ANALYSIS_DAILY_LIMIT} reached. Upgrade to PRO for unlimited access.", "remaining": 0},
        )

    return {"allowed": True, "remaining": DEEP_ANALYSIS_DAILY_LIMIT - count, "is_pro": False}


# ── Market Tensions ───────────────────────────────────────────────────────────
_ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
_BYBIT_FUTURES = "https://api.bybit.com"

_TENSIONS_FALLBACK = [
    {
        "type": "warning",
        "title": "Analysis Temporarily Unavailable",
        "description": "Market tension analysis is loading. Refresh in a moment for AI-detected trading setups.",
        "confidence": "low",
    },
    {
        "type": "squeeze",
        "title": "Monitor Key Levels Closely",
        "description": "Watch for breakouts above resistance or breakdowns below support during current volatility conditions.",
        "confidence": "low",
    },
]


async def _fetch_funding_rate() -> dict:
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{_BYBIT_FUTURES}/v5/market/funding/history",
                params={"category": "linear", "symbol": "BTCUSDT", "limit": 1},
            )
            resp.raise_for_status()
            data = resp.json()
            items = data.get("result", {}).get("list", [])
            if items:
                rate = float(items[0]["fundingRate"]) * 100
                return {"rate_pct": round(rate, 4), "annualized_pct": round(rate * 3 * 365, 2)}
    except Exception as exc:
        logger.warning(f"Funding rate fetch failed: {exc}")
    return {"rate_pct": None, "annualized_pct": None}


async def _fetch_long_short_ratio() -> dict:
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{_BYBIT_FUTURES}/v5/market/account-ratio",
                params={"category": "linear", "symbol": "BTCUSDT", "period": "1h", "limit": 1},
            )
            resp.raise_for_status()
            data = resp.json()
            items = data.get("result", {}).get("list", [])
            if items:
                return {
                    "ratio": round(float(items[0]["buyRatio"]) / float(items[0]["sellRatio"]), 3),
                    "long_pct": round(float(items[0]["buyRatio"]) * 100, 2),
                    "short_pct": round(float(items[0]["sellRatio"]) * 100, 2),
                }
    except Exception as exc:
        logger.warning(f"Long/short ratio fetch failed: {exc}")
    return {"ratio": None, "long_pct": None, "short_pct": None}


@app.get("/api/market-tensions")
async def get_market_tensions():
    """AI-detected BTC trading setups from live market conditions (Claude Haiku, cached 5 min)."""
    if "tensions" in _tensions_cache:
        return _tensions_cache["tensions"]

    logger.info(f"ANTHROPIC_API_KEY present: {bool(_ANTHROPIC_API_KEY)}")

    if not _ANTHROPIC_API_KEY:
        raise HTTPException(503, "ANTHROPIC_API_KEY not configured")

    try:
        price_data, fg_data, onchain_data, funding, ls_ratio, (hourly_df, _) = await asyncio.gather(
            fetch_live_price(),
            fetch_fear_greed(),
            fetch_onchain(),
            _fetch_funding_rate(),
            _fetch_long_short_ratio(),
            _get_dataframes(),
        )

        indicators_data = get_indicator_snapshot(compute_indicators(hourly_df))

        total_btc_sent = onchain_data.get("total_btc_sent", 0) or 0
        whale_activity = "high" if total_btc_sent > 600000 else "moderate" if total_btc_sent > 300000 else "low"

        funding_str = (
            f"{funding['rate_pct']:+.4f}% per 8h (annualized: {funding['annualized_pct']:+.1f}%)"
            if funding["rate_pct"] is not None else "unavailable"
        )
        ls_str = (
            f"{ls_ratio['ratio']} ({ls_ratio['long_pct']}% long / {ls_ratio['short_pct']}% short)"
            if ls_ratio["ratio"] is not None else "unavailable"
        )

        summary = f"""BTC Market Snapshot:
- Price: ${price_data['price']:,.0f} (24h: {price_data['change_24h_pct']:+.2f}%)
- RSI (14): {indicators_data['rsi']['value']} ({indicators_data['rsi']['signal']})
- MACD: {indicators_data['macd']['macd']} / Signal: {indicators_data['macd']['signal']} ({indicators_data['macd']['crossover']})
- Bollinger %B: {indicators_data['bollinger_bands']['pct_b']} | Bandwidth: {indicators_data['bollinger_bands']['bandwidth']}
- EMA trend: {indicators_data['ema']['trend']} (EMA50: {indicators_data['ema']['ema50']}, EMA200: {indicators_data['ema']['ema200']})
- OBV trend: {indicators_data['obv']['trend']}
- ATR: ${indicators_data['atr']['value']} ({indicators_data['atr']['pct_of_price']}% of price)
- Fear & Greed: {fg_data['value']} ({fg_data['classification']})
- Funding Rate: {funding_str}
- Long/Short Ratio: {ls_str}
- Whale Activity: {whale_activity} (BTC sent on-chain today: {total_btc_sent:,.0f})
- Mempool: {onchain_data.get('mempool_size', 0):,} pending txs | Fees: {onchain_data.get('total_fees_btc', 0)} BTC (24h)"""

        prompt = f"""{summary}

You are a professional crypto trading analyst. Based on the market data above, identify 2 to 4 distinct trading setups or tensions currently present in the Bitcoin market.

Respond with ONLY a JSON array, no markdown, no extra text:
[
  {{
    "type": "bullish" | "bearish" | "warning" | "squeeze",
    "title": "Short setup title (max 8 words)",
    "description": "1-2 sentence explanation referencing the specific data values",
    "confidence": "high" | "medium" | "low"
  }}
]

Type definitions:
- bullish: price likely to move up based on current signals
- bearish: price likely to move down based on current signals
- warning: risk signal (liquidation cascade risk, extreme sentiment, etc.)
- squeeze: volatility compression about to expand (Bollinger squeeze, funding extremes, coil)

Return only the 2-4 most significant setups."""

        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                resp = await client.post(
                    "https://api.anthropic.com/v1/messages",
                    headers={
                        "x-api-key": _ANTHROPIC_API_KEY,
                        "anthropic-version": "2023-06-01",
                        "content-type": "application/json",
                    },
                    json={
                        "model": "claude-haiku-4-5-20251001",
                        "max_tokens": 512,
                        "messages": [{"role": "user", "content": prompt}],
                    },
                )
                resp.raise_for_status()
                content = resp.json()["content"][0]["text"].strip()

            if content.startswith("```"):
                content = content.split("```")[1]
                if content.startswith("json"):
                    content = content[4:]
                content = content.strip()

            raw_setups = json.loads(content)

            valid_types = {"bullish", "bearish", "warning", "squeeze"}
            valid_conf = {"high", "medium", "low"}
            result = [
                {
                    "type": s["type"],
                    "title": str(s.get("title", ""))[:100],
                    "description": str(s.get("description", ""))[:500],
                    "confidence": s["confidence"],
                }
                for s in raw_setups[:4]
                if s.get("type") in valid_types and s.get("confidence") in valid_conf
            ]
            logger.info(f"Market tensions: {len(result)} setups generated by Haiku")
        except Exception as exc:
            logger.warning(f"Haiku call failed or timed out ({exc!r}) — using fallback")
            result = _TENSIONS_FALLBACK

        # Only cache real results — never freeze a fallback in the 5-min cache
        if result is not _TENSIONS_FALLBACK:
            _tensions_cache["tensions"] = result
        return result

    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Market tensions failed: {exc}", exc_info=True)
        raise HTTPException(502, f"Failed to fetch market tensions: {exc}")


async def _warmup_tensions():
    try:
        await get_market_tensions()
        logger.info("✓ Market tensions pre-warmed")
    except Exception as exc:
        logger.warning(f"Tensions warmup failed (non-fatal): {exc}")
