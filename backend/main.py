import asyncio
import hmac
import json
import logging
import os
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from functools import wraps
from time import time, perf_counter
from typing import Literal, Optional

import httpx

import jwt
import stripe
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from cachetools import TTLCache
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException, Path, Request
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from supabase import create_client, Client

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)

# ── Stripe setup ─────────────────────────────────────────────────────────────
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
STRIPE_PRICE_ID = os.getenv("STRIPE_PRICE_ID")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")

# Credit-pack one-time prices (set these in Railway env vars)
CREDIT_PACKS = {
    "10":  {"price_id": os.getenv("STRIPE_CREDIT_10_PRICE_ID",  ""), "credits":  10, "dollars": 2.99},
    "50":  {"price_id": os.getenv("STRIPE_CREDIT_50_PRICE_ID",  ""), "credits":  50, "dollars": 9.99},
    "200": {"price_id": os.getenv("STRIPE_CREDIT_200_PRICE_ID", ""), "credits": 200, "dollars": 29.99},
}

# Daily limits
FREE_DAILY_LIMIT = 2
PRO_DAILY_LIMIT  = 20

# ── Supabase setup ───────────────────────────────────────────────────────────
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET", "").strip()
if not SUPABASE_JWT_SECRET:
    raise RuntimeError("SUPABASE_JWT_SECRET is not set — refusing to start")

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

CORS_ORIGINS = [
    "https://predictalpha.app",
    "https://www.predictalpha.app",
]

RETRAIN_INTERVAL_HOURS = int(os.getenv("MODEL_RETRAIN_INTERVAL_HOURS", "24"))

HorizonKey = Literal["1h", "4h", "8h", "12h", "24h", "1week", "1month"]
_HORIZON_ORDER = ["1h", "4h", "8h", "12h", "24h", "1week", "1month"]


def _get_cached_prediction(horizon: str) -> dict | None:
    cache_key = f"pred_{horizon}"
    cache = _predict_cache_1h if horizon == "1h" else _predict_cache_long
    return cache.get(cache_key)


def _apply_temporal_coherence(horizon: str, prediction: dict) -> dict:
    """Blend a prediction toward its neighbors when it contradicts both adjacent horizons.

    Rule: if the shorter *and* longer horizon cached predictions both point in
    the opposite direction to this one, the direction flip is likely a model
    artefact rather than a genuine signal.  We apply a weighted blend
    (40 % own / 30 % each neighbor) to smooth it out.
    """
    try:
        idx = _HORIZON_ORDER.index(horizon)
    except ValueError:
        return prediction

    prev_pred = _get_cached_prediction(_HORIZON_ORDER[idx - 1]) if idx > 0 else None
    next_pred = _get_cached_prediction(_HORIZON_ORDER[idx + 1]) if idx < len(_HORIZON_ORDER) - 1 else None

    if not (prev_pred and next_pred):
        return prediction  # can only validate when both neighbors are cached

    prev_chg = prev_pred.get("change_pct") or 0
    next_chg = next_pred.get("change_pct") or 0
    curr_chg = prediction.get("change_pct") or 0

    incoherent = (prev_chg > 0 and next_chg > 0 and curr_chg < 0) or \
                 (prev_chg < 0 and next_chg < 0 and curr_chg > 0)
    if not incoherent:
        return prediction

    blended = curr_chg * 0.40 + prev_chg * 0.30 + next_chg * 0.30
    current_price = prediction["current_price"]
    result = dict(prediction)
    result["change_pct"] = round(blended, 4)
    result["predicted_price"] = round(current_price * (1 + blended / 100), 2)
    result["direction"] = "up" if blended >= 0 else "down"
    result["coherence_adjusted"] = True
    logger.info(f"[coherence] {horizon} adjusted {curr_chg:.4f}% → {blended:.4f}% (prev={prev_chg}, next={next_chg})")
    return result

# ── In-memory TTL caches ─────────────────────────────────────────────────────
_price_cache: TTLCache = TTLCache(maxsize=1, ttl=60)           # 1 min
_indicators_cache: TTLCache = TTLCache(maxsize=1, ttl=300)     # 5 min
_sentiment_cache: TTLCache = TTLCache(maxsize=1, ttl=1800)     # 30 min
_onchain_cache: TTLCache = TTLCache(maxsize=1, ttl=1800)       # 30 min
_predict_cache_1h:   TTLCache = TTLCache(maxsize=1, ttl=300)   # 5 min for 1h
_predict_cache_long: TTLCache = TTLCache(maxsize=9, ttl=3600)  # 1 h for 4h–1month
_news_cache: TTLCache = TTLCache(maxsize=1, ttl=1800)          # 30 min
_tensions_cache: TTLCache = TTLCache(maxsize=1, ttl=60)        # 1 min
_ohlc_cache: TTLCache = TTLCache(maxsize=1, ttl=600)           # 10 min
_funding_rate_cache:  TTLCache = TTLCache(maxsize=1,  ttl=300)  # 5 min
_ls_ratio_cache:      TTLCache = TTLCache(maxsize=1,  ttl=60)   # 1 min
_whales_cache:        TTLCache = TTLCache(maxsize=1,  ttl=60)   # 1 min
_open_interest_cache: TTLCache = TTLCache(maxsize=1,  ttl=60)   # 1 min
_liquidations_cache:  TTLCache = TTLCache(maxsize=1,  ttl=300)  # 5 min
_order_book_cache:    TTLCache = TTLCache(maxsize=1,  ttl=30)   # 30 s
_key_levels_cache:    TTLCache = TTLCache(maxsize=1,  ttl=300)  # 5 min
_ohlc_candles_cache:  TTLCache = TTLCache(maxsize=10, ttl=60)   # 1 min per limit

# Shared dataframe cache (refreshed alongside indicators)
_hourly_df = None
_daily_df = None
_df_fetched_at: float = 0.0
_DF_REFRESH_SECONDS = 300  # 5 min
_df_lock = asyncio.Lock()


async def _get_dataframes():
    global _hourly_df, _daily_df, _df_fetched_at
    async with _df_lock:
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
    # market-tensions pre-warm removed — regenerated on demand with 60s TTL

    # Daily credit reset backstop — lazy reset in the RPCs is the primary path
    credits_scheduler = AsyncIOScheduler(timezone="UTC")
    credits_scheduler.add_job(
        _reset_daily_credits_job,
        trigger=CronTrigger(hour=0, minute=0, timezone="UTC"),
        id="reset_daily_credits",
        replace_existing=True,
    )
    credits_scheduler.start()
    logger.info("Credit reset scheduler started — runs daily at 00:00 UTC")

    yield

    credits_scheduler.shutdown(wait=False)
    retrainer.stop_scheduler()


async def _reset_daily_credits_job() -> None:
    """Backstop: reset every user_credits row's daily counter at 00:00 UTC."""
    try:
        rpc = supabase.rpc(
            "reset_all_daily_credits",
            {"p_free_limit": FREE_DAILY_LIMIT, "p_pro_limit": PRO_DAILY_LIMIT},
        ).execute()
        logger.info(f"Daily credit reset complete — {rpc.data} rows updated")
    except Exception as e:
        logger.error(f"Daily credit reset job failed: {e}")


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
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


def _real_ip(request: Request) -> str:
    xff = request.headers.get("X-Forwarded-For")
    return xff.split(",")[0].strip() if xff else request.client.host

limiter = Limiter(key_func=_real_ip, default_limits=["60/minute"])
app.state.limiter = limiter

def _rate_limit_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    return JSONResponse(status_code=429, content={"error": "Rate limit exceeded. Try again later."})

app.add_exception_handler(RateLimitExceeded, _rate_limit_handler)
app.add_middleware(SlowAPIMiddleware)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        return response

app.add_middleware(SecurityHeadersMiddleware)


# ── Health ────────────────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    status = retrainer.get_status()
    return {"status": "ok", **status}


# ── OHLC proxy ────────────────────────────────────────────────────────────────
@app.get("/api/ohlc")
async def get_ohlc():
    if "ohlc" in _ohlc_cache:
        return _ohlc_cache["ohlc"]
    try:
        df = await fetch_daily_ohlcv(days=365)
        # Return [[timestamp_ms, open, high, low, close], ...] matching prior CoinGecko shape
        data = [
            [int(ts.timestamp() * 1000), row["open"], row["high"], row["low"], row["close"]]
            for ts, row in df.iterrows()
        ]
        _ohlc_cache["ohlc"] = data
        return data
    except Exception as exc:
        logger.warning(f"OHLC fetch failed: {exc}")
        raise HTTPException(502, "Failed to fetch OHLC data")


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
        hourly_df, daily_df = await _get_dataframes()
        snapshot = get_indicator_snapshot(compute_indicators(daily_df))
        _indicators_cache["indicators"] = snapshot
        return snapshot
    except Exception as exc:
        logger.error(f"Indicators fetch failed: {exc}")
        raise HTTPException(502, f"Failed to compute indicators: {exc}")


# ── Predictions ───────────────────────────────────────────────────────────────
PRO_HORIZONS = {"4h", "8h", "12h", "24h", "1week", "1month"}


@app.get("/api/predict/{horizon}")
async def get_prediction(
    horizon: HorizonKey = Path(..., description="Prediction horizon: 1h, 4h, 8h, 12h, 24h, 1week, 1month"),
    authorization: str = Header(None),
):
    """
    Ensemble prediction (LSTM + XGBoost + Prophet) for the requested horizon.
    1h is unauthenticated; 4h/8h/12h/24h/1week/1month require a PRO subscription.
    """
    if horizon in PRO_HORIZONS:
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(401, "Authentication required for this horizon")
        try:
            response = supabase.auth.get_user(authorization.split(" ")[1])
            user = response.user
            if not user:
                raise HTTPException(401, "Invalid token")
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(401, f"Invalid token: {str(e)}")
        if not _is_pro(str(user.id)):
            raise HTTPException(403, "PRO subscription required for this horizon")
    if not ensemble.is_ready:
        status = retrainer.get_status()
        if status["is_training"]:
            raise HTTPException(503, detail="Models are currently being trained. Please retry in a few minutes.")
        raise HTTPException(503, detail="Models are not trained yet. Training will begin shortly.")

    cache_key = f"pred_{horizon}"
    _pred_cache = _predict_cache_1h if horizon == "1h" else _predict_cache_long
    if cache_key in _pred_cache:
        return _pred_cache[cache_key]

    try:
        async def _get_price():
            return _price_cache["price"] if "price" in _price_cache else await fetch_live_price()

        live, (hourly_df, daily_df) = await asyncio.gather(_get_price(), _get_dataframes())
        current_price = live["price"]

        t_start = perf_counter()
        result = await asyncio.get_event_loop().run_in_executor(
            None,
            ensemble.predict,
            horizon,
            hourly_df,
            daily_df,
            current_price,
        )
        logger.info(f"TIMING total predict {horizon}: {perf_counter()-t_start:.3f}s")

        if "error" in result:
            raise HTTPException(503, detail=result["error"])

        result = _apply_temporal_coherence(horizon, result)
        _pred_cache[cache_key] = result

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
async def trigger_retrain(authorization: str = Header(None)):
    admin_secret = os.getenv("ADMIN_SECRET", "")
    provided = (authorization or "").removeprefix("Bearer ").strip()
    if not admin_secret or not hmac.compare_digest(provided, admin_secret):
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


class CreditPurchaseRequest(BaseModel):
    pack: str  # "10" | "50" | "200"


@app.post("/api/billing-portal")
async def create_billing_portal(user: dict = Depends(get_current_user)):
    """Create a Stripe billing portal session so the user can manage or cancel their subscription."""
    if not stripe.api_key:
        raise HTTPException(500, "Stripe not configured")
    existing = supabase.table("subscriptions").select("stripe_customer_id").eq("user_id", user["id"]).execute()
    if not existing.data or not existing.data[0].get("stripe_customer_id"):
        raise HTTPException(404, "No subscription found for this user")
    customer_id = existing.data[0]["stripe_customer_id"]
    try:
        session = stripe.billing_portal.Session.create(
            customer=customer_id,
            return_url=os.getenv("FRONTEND_URL", "https://predictalpha.app"),
        )
        return {"url": session.url}
    except stripe.StripeError as e:
        logger.error(f"Billing portal error: {e}")
        raise HTTPException(400, str(e))


@app.post("/api/credits/purchase")
async def create_credit_pack_checkout(body: CreditPurchaseRequest, user: dict = Depends(get_current_user)):
    """Create a one-time Stripe Checkout session for a credit pack."""
    if not stripe.api_key:
        raise HTTPException(500, "Stripe not configured")

    pack = CREDIT_PACKS.get(body.pack)
    if pack is None:
        raise HTTPException(400, f"Unknown pack '{body.pack}'. Valid: 10, 50, 200")
    if not pack["price_id"]:
        raise HTTPException(500, f"STRIPE_CREDIT_{body.pack}_PRICE_ID not configured")

    try:
        # Reuse the Stripe customer from subscriptions table if one exists
        existing = supabase.table("subscriptions").select("stripe_customer_id").eq("user_id", user["id"]).execute()
        if existing.data and existing.data[0].get("stripe_customer_id"):
            customer_id = existing.data[0]["stripe_customer_id"]
        else:
            customer = stripe.Customer.create(email=user["email"], metadata={"supabase_user_id": user["id"]})
            customer_id = customer.id
            supabase.table("subscriptions").upsert({
                "user_id":            user["id"],
                "stripe_customer_id": customer_id,
                "status":             "inactive",
            }).execute()

        frontend_url = os.getenv("FRONTEND_URL", "https://predictalpha.app")
        checkout_metadata = {
            "type":    "credit_pack",
            "user_id": user["id"],
            "pack":    body.pack,
            "credits": str(pack["credits"]),
        }
        session = stripe.checkout.Session.create(
            customer=customer_id,
            payment_method_types=["card"],
            line_items=[{"price": pack["price_id"], "quantity": 1}],
            mode="payment",
            success_url=f"{frontend_url}/dashboard?credits_success=true&pack={body.pack}",
            cancel_url=f"{frontend_url}/dashboard?credits_canceled=true",
            metadata=checkout_metadata,
        )
        logger.info(f"[credits/purchase] Created checkout session {session.id} for user {user['id']} pack={body.pack} metadata={checkout_metadata}")
        return {"url": session.url, "credits": pack["credits"], "dollars": pack["dollars"]}
    except stripe.StripeError as e:
        logger.error(f"Stripe credit-pack checkout error: {e}")
        raise HTTPException(400, str(e))


@app.post("/api/webhook")
async def stripe_webhook(request: Request):
    """Handle Stripe webhook events."""
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, STRIPE_WEBHOOK_SECRET)
    except ValueError:
        logger.error("[webhook] Invalid payload received")
        raise HTTPException(400, "Invalid payload")
    except stripe.SignatureVerificationError:
        logger.error("[webhook] Invalid signature — check STRIPE_WEBHOOK_SECRET matches the endpoint")
        raise HTTPException(400, "Invalid signature")

    event_type = event["type"]
    event_id   = event.get("id", "?")
    data = event["data"]["object"]

    # Log every webhook event so we can confirm Stripe is reaching us
    logger.info(f"[webhook] Received event {event_type} (id={event_id})")

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

    elif event_type == "invoice.payment_failed":
        customer_id = data.get("customer", "?")
        attempt     = data.get("attempt_count", "?")
        next_attempt = data.get("next_payment_attempt")
        next_str = unix_to_iso(next_attempt) if next_attempt else "no further retries scheduled"
        logger.warning(
            f"[webhook] Payment failed for customer {customer_id} "
            f"(attempt {attempt}) — PRO access retained during retry window. "
            f"Next attempt: {next_str}"
        )

    elif event_type == "checkout.session.completed":
        # Credit-pack one-time payments. Subscription checkouts are handled
        # by customer.subscription.created above and ignored here.
        metadata       = data.get("metadata") or {}
        payment_status = data.get("payment_status")
        session_mode   = data.get("mode")
        session_id     = data.get("id", "?")

        logger.info(
            f"[webhook] checkout.session.completed — id={session_id} mode={session_mode} "
            f"payment_status={payment_status} metadata={metadata}"
        )

        if metadata.get("type") != "credit_pack":
            logger.info(f"[webhook] Skipping session {session_id} — metadata.type is '{metadata.get('type')}', not 'credit_pack'")
        elif payment_status != "paid":
            logger.warning(f"[webhook] Credit pack session {session_id} not paid yet (payment_status={payment_status}) — skipping")
        else:
            target_user_id = metadata.get("user_id")
            try:
                credits = int(metadata.get("credits", "0"))
            except (TypeError, ValueError):
                credits = 0
            if not target_user_id or credits <= 0:
                logger.error(f"[webhook] Credit-pack session {session_id} has bad metadata: user_id={target_user_id!r} credits={credits}")
            else:
                # ── Idempotency guard: skip if this session was already processed ──
                try:
                    supabase.table("processed_webhook_sessions").insert(
                        {"session_id": session_id}
                    ).execute()
                except Exception:
                    # Unique-key violation → already processed; safe to ignore replay
                    logger.warning(f"[webhook] Duplicate session {session_id} — already processed, skipping credit grant")
                    return {"status": "ok"}

                # Pick daily_limit so the row is seeded correctly if it doesn't exist yet
                daily_lim = PRO_DAILY_LIMIT if _is_pro(target_user_id) else FREE_DAILY_LIMIT
                logger.info(f"[webhook] Granting +{credits} credits to user {target_user_id} (daily_lim={daily_lim})")
                try:
                    rpc = supabase.rpc(
                        "add_bonus_credits",
                        {"p_user_id": target_user_id, "p_amount": credits, "p_daily_limit": daily_lim},
                    ).execute()
                    logger.info(f"[webhook] ✓ Credit pack delivered: +{credits} to {target_user_id} — new balance: {rpc.data}")
                except Exception as e:
                    # Stripe will retry on non-2xx; raise so we don't lose the grant
                    logger.error(f"[webhook] ✗ add_bonus_credits RPC failed for {target_user_id}: {e!r}", exc_info=True)
                    raise HTTPException(500, "Failed to grant credits — Stripe will retry")
    else:
        # Catch-all log so we can see what events Stripe sends that we don't handle
        logger.info(f"[webhook] Unhandled event type: {event_type}")

    return {"status": "ok"}


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


_pro_cache: dict[str, tuple[bool, float]] = {}

def _is_pro(user_id: str) -> bool:
    now = time()
    if user_id in _pro_cache:
        result, ts = _pro_cache[user_id]
        if now - ts < 60:
            logger.info(f"[_is_pro] CACHE HIT user_id={user_id} result={result} age={now-ts:.1f}s")
            return result
    try:
        sub = supabase.table("subscriptions").select("status").eq("user_id", user_id).execute()
        logger.info(f"[_is_pro] user_id={user_id} sub.data={sub.data}")
        result = bool(sub.data and sub.data[0].get("status") in ("active", "past_due"))
    except Exception as e:
        logger.error(f"[_is_pro] user_id={user_id} Supabase query failed: {e!r}")
        result = False
    logger.info(f"[_is_pro] user_id={user_id} final result={result}")
    _pro_cache[user_id] = (result, now)
    return result


@app.get("/api/deep-analysis/remaining")
@limiter.limit("30/minute")
async def get_deep_analysis_remaining(request: Request, user: dict = Depends(get_current_user)):
    """Return the user's current credit balance and tier info."""
    user_id   = user["id"]
    is_pro    = _is_pro(user_id)
    daily_lim = PRO_DAILY_LIMIT if is_pro else FREE_DAILY_LIMIT

    try:
        rpc = supabase.rpc("get_credits", {"p_user_id": user_id, "p_daily_limit": daily_lim}).execute()
        data = rpc.data or {}
        daily_remaining = int(data.get("daily_remaining", daily_lim))
        bonus_remaining = int(data.get("bonus_remaining", 0))
    except Exception as e:
        logger.warning(f"get_credits RPC failed for {user_id}: {e} — falling back to allow")
        # Fail-open: assume the user has their full daily limit if Supabase is down
        daily_remaining = daily_lim
        bonus_remaining = 0

    return {
        "daily_remaining": daily_remaining,
        "bonus_remaining": bonus_remaining,
        "total_remaining": daily_remaining + bonus_remaining,
        "is_pro":          is_pro,
        "daily_limit":     daily_lim,
    }


def _consume_credit(user_id: str, is_pro: bool) -> dict:
    """Call the consume_credit RPC and normalize the response shape."""
    daily_lim = PRO_DAILY_LIMIT if is_pro else FREE_DAILY_LIMIT
    try:
        rpc = supabase.rpc("consume_credit", {"p_user_id": user_id, "p_daily_limit": daily_lim}).execute()
        data = rpc.data or {}
    except Exception as e:
        logger.error(f"consume_credit RPC failed for {user_id}: {e} — failing open")
        # Fail-open so a Supabase outage doesn't block paid users
        return {"allowed": True, "daily_remaining": daily_lim - 1, "bonus_remaining": 0, "daily_limit": daily_lim}

    return {
        "allowed":         bool(data.get("allowed", False)),
        "daily_remaining": int(data.get("daily_remaining", 0)),
        "bonus_remaining": int(data.get("bonus_remaining", 0)),
        "daily_limit":     daily_lim,
    }


def _refund_credit(user_id: str, is_pro: bool) -> None:
    """Refund one credit after a downstream failure. Best-effort, never raises."""
    daily_lim = PRO_DAILY_LIMIT if is_pro else FREE_DAILY_LIMIT
    try:
        supabase.rpc("refund_credit", {"p_user_id": user_id, "p_daily_limit": daily_lim}).execute()
        logger.info(f"Refunded 1 credit to {user_id} after analyze failure")
    except Exception as e:
        logger.error(f"refund_credit RPC failed for {user_id}: {e}")


@app.post("/api/deep-analysis/use")
@limiter.limit("5/minute")
async def use_deep_analysis(request: Request, user: dict = Depends(get_current_user)):
    """Legacy: consume one credit via the new RPC. Kept for backward compatibility."""
    user_id = user["id"]
    is_pro  = _is_pro(user_id)
    res     = _consume_credit(user_id, is_pro)

    if not res["allowed"]:
        raise HTTPException(
            status_code=402,
            detail={
                "error":   "no_credits",
                "message": "No credits remaining. Buy a credit pack or wait until midnight UTC.",
                "daily_remaining": 0,
                "bonus_remaining": 0,
            },
        )

    return {
        "allowed":         True,
        "daily_remaining": res["daily_remaining"],
        "bonus_remaining": res["bonus_remaining"],
        "total_remaining": res["daily_remaining"] + res["bonus_remaining"],
        "is_pro":          is_pro,
    }


# ── Deep Analysis / Analyze ───────────────────────────────────────────────────
class DeepAnalysisRequest(BaseModel):
    horizon: str
    rsi: Optional[float] = None
    macd_histogram: Optional[float] = None
    ema50: Optional[float] = None
    ema200: Optional[float] = None
    funding_rate: Optional[float] = None
    long_short_ratio: Optional[float] = None


@app.post("/api/deep-analysis/analyze")
@limiter.limit("5/minute")
async def deep_analysis_analyze(
    request: Request,
    body: DeepAnalysisRequest,
    user: dict = Depends(get_current_user),
):
    """Consume one credit, fetch live price, call Claude Haiku, return structured analysis."""
    user_id = user["id"]
    is_pro  = _is_pro(user_id)

    # ── Atomically consume one credit (daily first, then bonus) ─────────────
    credit_state = _consume_credit(user_id, is_pro)
    if not credit_state["allowed"]:
        raise HTTPException(
            status_code=402,
            detail={
                "error":   "no_credits",
                "message": "No credits remaining. Buy a credit pack or wait until midnight UTC.",
                "daily_remaining": 0,
                "bonus_remaining": 0,
            },
        )

    if not _ANTHROPIC_API_KEY:
        raise HTTPException(503, "ANTHROPIC_API_KEY not configured")

    try:
        price_data = await fetch_live_price()
        current_price = price_data["price"]
    except Exception as e:
        logger.error(f"fetch_live_price failed in deep analysis: {e}")
        raise HTTPException(502, "Failed to fetch live BTC price")

    def _fmt(v, unit=""):
        return f"{v}{unit}" if v is not None else "N/A"

    # ── Pull every value from caches or live fetches — never leave N/A if avoidable ──

    # Indicators: prefer body (sent by frontend), fall back to indicators cache
    _ind = _indicators_cache.get("indicators", {})
    _ema = _ind.get("ema", {})
    rsi_val         = body.rsi            if body.rsi            is not None else _ind.get("rsi", {}).get("value")
    macd_hist_val   = body.macd_histogram if body.macd_histogram is not None else _ind.get("macd", {}).get("histogram")
    ema50_val       = body.ema50          if body.ema50          is not None else _ema.get("ema50")
    ema200_val      = body.ema200         if body.ema200         is not None else _ema.get("ema200")
    macd_signal_val = _ind.get("macd", {}).get("signal")
    macd_cross_val  = _ind.get("macd", {}).get("crossover", "N/A")
    rsi_signal_val  = _ind.get("rsi", {}).get("signal", "N/A")
    bb_pct_val      = _ind.get("bollinger_bands", {}).get("pct_b")
    bb_bw_val       = _ind.get("bollinger_bands", {}).get("bandwidth")

    # Fear & Greed: sentiment cache or live fetch
    try:
        if "sentiment" in _sentiment_cache:
            _fg = _sentiment_cache["sentiment"]
        else:
            _fg = await fetch_fear_greed()
            _sentiment_cache["sentiment"] = _fg
        fear_greed_val = _fg.get("value")
        fg_class_val   = _fg.get("classification", "Neutral")
    except Exception:
        fear_greed_val, fg_class_val = None, "N/A"

    # Funding rate: body or live fetch
    if body.funding_rate is not None:
        funding_rate_val = body.funding_rate
    else:
        try:
            _fr = await _fetch_funding_rate()
            funding_rate_val = _fr.get("rate_pct")
        except Exception:
            funding_rate_val = None

    # Long/short: body or live fetch
    if body.long_short_ratio is not None:
        ls_ratio_val = body.long_short_ratio
    else:
        try:
            _ls = await _fetch_long_short_ratio()
            ls_ratio_val = _ls.get("ratio")
        except Exception:
            ls_ratio_val = None

    # Mempool from onchain
    try:
        _onchain = await fetch_onchain()
        mempool_val = _onchain.get("mempool_size")
    except Exception:
        mempool_val = None

    if mempool_val is None:
        mempool_display = "N/A"
    elif mempool_val > 600_000:
        mempool_display = "High network activity"
    elif mempool_val > 450_000:
        mempool_display = "Elevated network activity"
    elif mempool_val > 250_000:
        mempool_display = "Normal network activity"
    else:
        mempool_display = "Low network activity"

    # Derived display strings
    if ema50_val is not None and ema200_val is not None:
        ema_trend = "Golden Cross (bullish)" if ema50_val > ema200_val else "Death Cross (bearish)"
    else:
        ema_trend = "N/A"

    price_vs_ema50  = ("above" if current_price > ema50_val  else "below") if ema50_val  is not None else "N/A"
    price_vs_ema200 = ("above" if current_price > ema200_val else "below") if ema200_val is not None else "N/A"

    if ls_ratio_val is not None:
        ls_long_pct  = round(ls_ratio_val / (1 + ls_ratio_val) * 100, 1)
        ls_short_pct = round(100 - ls_long_pct, 1)
        ls_display   = f"{ls_ratio_val} ({ls_long_pct}% long / {ls_short_pct}% short)"
    else:
        ls_display = "N/A"

    funding_display = f"{funding_rate_val:+.4f}%" if funding_rate_val is not None else "N/A"
    fg_display      = f"{fear_greed_val} ({fg_class_val})" if fear_greed_val is not None else "N/A"

    logger.info(
        f"[deep-analysis] prompt — price=${current_price:,.0f} rsi={rsi_val} "
        f"macd_hist={macd_hist_val} fg={fear_greed_val} funding={funding_rate_val} ls={ls_ratio_val}"
    )

    prompt = f"""You are a professional Bitcoin trading analyst. Analyze the following market snapshot and provide a structured assessment.

Market Snapshot:
- Current BTC Price: ${current_price:,.2f}
- Horizon: {body.horizon}
- RSI (14): {_fmt(rsi_val)} ({rsi_signal_val})
- MACD Histogram: {_fmt(macd_hist_val)} ({macd_cross_val} crossover)
- MACD Signal Line: {_fmt(macd_signal_val)}
- Bollinger %B: {_fmt(bb_pct_val)}
- Bollinger Bandwidth: {_fmt(bb_bw_val)}
- EMA50: {_fmt(ema50_val, ' USD')} (price is {price_vs_ema50} EMA 50)
- EMA200: {_fmt(ema200_val, ' USD')} (price is {price_vs_ema200} EMA 200)
- EMA Trend: {ema_trend}
- Fear & Greed Index: {fg_display}
- Funding Rate: {funding_display}
- Long/Short Ratio: {ls_display}
- Mempool: {mempool_display}

STRICT RULES:
- Reference only the exact values provided above. Never invent specific numbers, transaction counts, or data not present in this snapshot.
- The Mempool label is ground truth. Never override it with inferred data.
- If Mempool is "Low network activity" or "Network quiet": FORBIDDEN to use "elevated", "high", "congested", or "increased network pressure". You must say "low" or "quiet" or omit mempool entirely.
- If Mempool is "Normal network activity": describe as normal or moderate only.
- If Mempool is "Elevated network activity" or "High network activity": only then may you mention elevated or high congestion.

Respond with ONLY valid JSON, no markdown, no extra text:
{{
  "direction": "BULLISH" or "BEARISH",
  "recommendation": "Strong Buy" | "Weak Buy" | "Hold" | "Sell",
  "analysis": "2-3 sentence explanation referencing the specific data values above"
}}"""

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
                    "max_tokens": 300,
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

        parsed = json.loads(content)
        direction = parsed.get("direction", "BEARISH").upper()
        if direction not in ("BULLISH", "BEARISH"):
            direction = "BEARISH"
        score = round(ensemble._confidence_score(body.horizon, []) * 100)
        recommendation = parsed.get("recommendation", "Hold")
        if recommendation not in ("Strong Buy", "Weak Buy", "Hold", "Sell"):
            recommendation = "Hold"
        analysis = str(parsed.get("analysis", ""))[:1000]

    except Exception as exc:
        logger.warning(f"Haiku deep analysis call failed ({exc!r})")
        _refund_credit(user_id, is_pro)
        raise HTTPException(502, "AI analysis temporarily unavailable")

    return {
        "allowed":         True,
        "daily_remaining": credit_state["daily_remaining"],
        "bonus_remaining": credit_state["bonus_remaining"],
        "total_remaining": credit_state["daily_remaining"] + credit_state["bonus_remaining"],
        "is_pro":          is_pro,
        "current_price":   current_price,
        "analysis":        analysis,
        "direction":       direction,
        "score":           score,
        "recommendation":  recommendation,
    }


# ── Market Tensions ───────────────────────────────────────────────────────────
_ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
_OKX_BASE = "https://www.okx.com"

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
                f"{_OKX_BASE}/api/v5/public/funding-rate",
                params={"instId": "BTC-USDT-SWAP"},
            )
            resp.raise_for_status()
            data = resp.json()
            items = data.get("data", [])
            if items:
                rate = float(items[0]["fundingRate"]) * 100
                return {"rate_pct": round(rate, 4), "annualized_pct": round(rate * 3 * 365, 2)}
    except Exception as exc:
        logger.warning(f"Funding rate fetch failed: {exc}")
    return {"rate_pct": None, "annualized_pct": None}


async def _fetch_long_short_ratio() -> dict:
    """Fetch BTC global long/short ratio from OKX."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                "https://www.okx.com/api/v5/rubik/stat/contracts/long-short-account-ratio",
                params={"ccy": "BTC", "period": "1H", "limit": 1},
            )
            resp.raise_for_status()
            items = resp.json().get("data", [])
            if items:
                item = items[0]
                # OKX returns either {"longShortRatio": "..."} dict or ["timestamp", "ratio"] array
                ratio_raw = item.get("longShortRatio") if isinstance(item, dict) else item[1]
                ratio = round(float(ratio_raw), 3)
                long_pct = round(ratio / (1 + ratio) * 100, 2)
                short_pct = round(100 - long_pct, 2)
                logger.info(f"DEBUG AI INPUT → long_short_ratio: {ratio}, long_pct: {long_pct}, short_pct: {short_pct}")
                return {"ratio": ratio, "long_pct": long_pct, "short_pct": short_pct}
    except Exception as exc:
        logger.warning(f"Long/short ratio fetch failed: {exc}")
    return {"ratio": None, "long_pct": None, "short_pct": None}


# ── Funding Rate ──────────────────────────────────────────────────────────────
@app.get("/api/funding-rate")
async def get_funding_rate():
    if "fr" in _funding_rate_cache:
        return _funding_rate_cache["fr"]
    data = await _fetch_funding_rate()
    rate = data.get("rate_pct")
    result = {
        "rate": rate,
        "signal": (
            "Longs overloaded" if rate is not None and rate > 0.05
            else "Shorts overloaded" if rate is not None and rate < -0.05
            else "Neutral"
        ),
    }
    _funding_rate_cache["fr"] = result
    return result


# ── Long/Short Ratio ──────────────────────────────────────────────────────────
@app.get("/api/long-short-ratio")
async def get_long_short_ratio():
    if "lsr" in _ls_ratio_cache:
        return _ls_ratio_cache["lsr"]
    data = await _fetch_long_short_ratio()
    ratio = data.get("ratio")
    result = {
        "ratio": ratio,
        "longPct": data.get("long_pct"),
        "shortPct": data.get("short_pct"),
        "signal": (
            "Too many longs" if ratio is not None and ratio > 1.5
            else "Too many shorts" if ratio is not None and ratio < 0.7
            else "Balanced"
        ),
    }
    _ls_ratio_cache["lsr"] = result
    return result


# ── Whales (taker volume) ─────────────────────────────────────────────────────
@app.get("/api/whales")
async def get_whales():
    if "whales" in _whales_cache:
        return _whales_cache["whales"]
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{_OKX_BASE}/api/v5/rubik/stat/taker-volume",
                params={"ccy": "BTC", "instType": "CONTRACTS", "period": "1H", "limit": 1},
            )
            resp.raise_for_status()
            items = resp.json().get("data", [])
        if items:
            item = items[0]  # [timestamp, sellVol, buyVol]
            buy_vol  = float(item[1])
            sell_vol = float(item[2])
            total = buy_vol + sell_vol
            buy_ratio  = buy_vol  / total * 100 if total > 0 else 50
            sell_ratio = 100 - buy_ratio
            result = {
                "largeCount": f"{round(buy_ratio)}% buy / {round(sell_ratio)}% sell",
                "buyVol":  round(buy_vol,  2),
                "sellVol": round(sell_vol, 2),
                "signal": (
                    "Bullish" if buy_ratio > 55
                    else "Bearish" if buy_ratio <= 45
                    else "Neutral"
                ),
            }
            _whales_cache["whales"] = result
            return result
    except Exception as exc:
        logger.warning(f"Whales fetch failed: {exc}")
    return {"largeCount": "50% buy / 50% sell", "buyVol": 0, "sellVol": 0, "signal": "Unknown"}


# ── Open Interest ─────────────────────────────────────────────────────────────
@app.get("/api/open-interest")
async def get_open_interest():
    if "oi" in _open_interest_cache:
        return _open_interest_cache["oi"]
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{_OKX_BASE}/api/v5/public/open-interest",
                params={"instId": "BTC-USDT-SWAP", "instType": "SWAP"},
            )
            resp.raise_for_status()
            items = resp.json().get("data", [])
        if items:
            result = {"value": float(items[0]["oi"])}
            _open_interest_cache["oi"] = result
            return result
    except Exception as exc:
        logger.warning(f"Open interest fetch failed: {exc}")
    return {"value": None}


# ── Liquidations (OI history) ─────────────────────────────────────────────────
@app.get("/api/liquidations")
async def get_liquidations():
    if "liq" in _liquidations_cache:
        return _liquidations_cache["liq"]
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{_OKX_BASE}/api/v5/rubik/stat/contracts/open-interest-volume",
                params={"ccy": "BTC", "period": "1H", "limit": 25},
            )
            resp.raise_for_status()
            items = resp.json().get("data", [])  # DESC — [ts, oi, vol]
        if items and len(items) >= 2:
            latest = float(items[0][1])
            oldest = float(items[-1][1])
            change = round((latest - oldest) / oldest * 100, 2) if oldest else 0
            result = {
                "current": round(latest, 2),
                "change":  change,
                "signal": (
                    "OI rising - trend strengthening" if change > 5
                    else "OI dropping - trend weakening" if change < -5
                    else "OI stable"
                ),
            }
            _liquidations_cache["liq"] = result
            return result
    except Exception as exc:
        logger.warning(f"Liquidations fetch failed: {exc}")
    return {"current": None, "change": 0, "signal": "Unknown"}


# ── Order Book ────────────────────────────────────────────────────────────────
@app.get("/api/order-book")
async def get_order_book():
    if "ob" in _order_book_cache:
        return _order_book_cache["ob"]
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{_OKX_BASE}/api/v5/market/books",
                params={"instId": "BTC-USDT", "sz": 5},
            )
            resp.raise_for_status()
            book = resp.json()["data"][0]  # bids/asks: [[price, size, ...], ...]
        best_bid = float(book["bids"][0][0])
        best_ask = float(book["asks"][0][0])
        bid_vol = sum(float(b[0]) * float(b[1]) for b in book["bids"])
        ask_vol = sum(float(a[0]) * float(a[1]) for a in book["asks"])
        ratio = round(bid_vol / ask_vol, 2) if ask_vol else 1.0
        result = {
            "topBid": best_bid,
            "topAsk": best_ask,
            "ratio": ratio,
            "signal": (
                "Strong buy wall"  if ratio > 1.3
                else "Strong sell wall" if ratio < 0.7
                else "Balanced"
            ),
        }
        _order_book_cache["ob"] = result
        return result
    except Exception as exc:
        logger.warning(f"Order book fetch failed: {exc}")
    return {"topBid": None, "topAsk": None, "ratio": 1.0, "signal": "Unknown"}


# ── Key Levels (Fibonacci + Pivots) ──────────────────────────────────────────
@app.get("/api/key-levels")
async def get_key_levels():
    if "kl" in _key_levels_cache:
        return _key_levels_cache["kl"]
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{_OKX_BASE}/api/v5/market/candles",
                params={"instId": "BTC-USDT", "bar": "4H", "limit": 42},
            )
            resp.raise_for_status()
            candles = list(reversed(resp.json().get("data", [])))  # ASC order
        if not candles:
            raise HTTPException(502, "No candle data returned")
        highs  = [float(k[2]) for k in candles]
        lows   = [float(k[3]) for k in candles]
        closes = [float(k[4]) for k in candles]
        current = closes[-1]

        # Fibonacci: full 42-candle swing (7-day range)
        fib_H = max(highs)
        fib_L = min(lows)
        fib_r = fib_H - fib_L
        # Direction: retrace down from high if in upper half, up from low if in lower half
        if current > fib_H - fib_r * 0.5:
            fib = [{"level": f, "price": round(fib_H - fib_r * f)} for f in [0.236, 0.382, 0.5, 0.618, 0.786]]
        else:
            fib = [{"level": f, "price": round(fib_L + fib_r * f)} for f in [0.236, 0.382, 0.5, 0.618, 0.786]]

        # Pivots: last 6 candles only (~24h) — standard daily pivot methodology
        daily = candles[-6:]
        H = max(float(k[2]) for k in daily)
        L = min(float(k[3]) for k in daily)
        P = (H + L + current) / 3
        r = H - L

        near_level = next((f for f in fib if abs(f["price"] - current) / current < 0.008), None)
        result = {
            "pivot": round(P),
            "r1": round(2 * P - L),
            "r2": round(P + r),
            "r3": round(H + 2 * (P - L)),
            "s1": round(2 * P - H),
            "s2": round(P - r),
            "s3": round(L - 2 * (H - P)),
            "fib": fib,
            "nearLevel": near_level,
            "range": {"high": round(H), "low": round(L)},
        }
        _key_levels_cache["kl"] = result
        return result
    except HTTPException:
        raise
    except Exception as exc:
        logger.warning(f"Key levels fetch failed: {exc}")
        raise HTTPException(502, f"Failed to fetch key levels: {exc}")


# ── OHLC Candles (1H) ─────────────────────────────────────────────────────────
@app.get("/api/ohlc-candles")
async def get_ohlc_candles(limit: int = 100):
    cache_key = f"ohlcc_{limit}"
    if cache_key in _ohlc_candles_cache:
        return _ohlc_candles_cache[cache_key]
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{_OKX_BASE}/api/v5/market/candles",
                params={"instId": "BTC-USDT", "bar": "1H", "limit": limit},
            )
            resp.raise_for_status()
            candles = list(reversed(resp.json().get("data", [])))  # ASC order
        result = [
            {"x": int(k[0]), "o": float(k[1]), "h": float(k[2]), "l": float(k[3]), "c": float(k[4])}
            for k in candles
        ]
        _ohlc_candles_cache[cache_key] = result
        return result
    except Exception as exc:
        logger.warning(f"OHLC candles fetch failed: {exc}")
        raise HTTPException(502, f"Failed to fetch OHLC candles: {exc}")


@app.get("/api/market-tensions")
@limiter.limit("10/minute")
async def get_market_tensions(request: Request):
    """AI-detected BTC trading setups from live market conditions (Claude Haiku, cached 5 min)."""
    if "tensions" in _tensions_cache:
        return _tensions_cache["tensions"]

    logger.info(f"ANTHROPIC_API_KEY present: {bool(_ANTHROPIC_API_KEY)}")

    if not _ANTHROPIC_API_KEY:
        raise HTTPException(503, "ANTHROPIC_API_KEY not configured")

    try:
        # ── Use the exact same cached data the UI cards read from ──────────────
        # Price: _price_cache (1-min TTL) — same as /api/price/live
        if "price" in _price_cache:
            price_data = _price_cache["price"]
        else:
            price_data = await fetch_live_price()
            _price_cache["price"] = price_data

        # Fear & Greed: _sentiment_cache (30-min TTL) — same as /api/sentiment
        if "sentiment" in _sentiment_cache:
            fg_data = _sentiment_cache["sentiment"]
        else:
            fg_data = await fetch_fear_greed()
            _sentiment_cache["sentiment"] = fg_data

        # Indicators: _indicators_cache (5-min TTL) — same as /api/indicators
        if "indicators" in _indicators_cache:
            indicators_data = _indicators_cache["indicators"]
        else:
            _hourly_df, daily_df = await _get_dataframes()
            indicators_data = get_indicator_snapshot(compute_indicators(daily_df))
            _indicators_cache["indicators"] = indicators_data

        # Remaining live data (no dedicated UI cache)
        onchain_data, funding, ls_ratio = await asyncio.gather(
            fetch_onchain(),
            _fetch_funding_rate(),
            _fetch_long_short_ratio(),
        )

        total_btc_sent = onchain_data.get("total_btc_sent", 0) or 0

        # Extract exact values for injection — no aliases, no rounding by Haiku
        btc_price       = price_data["price"]
        change_24h      = price_data["change_24h_pct"]
        rsi             = indicators_data["rsi"]["value"]
        rsi_signal      = indicators_data["rsi"]["signal"]
        macd            = indicators_data["macd"]["macd"]
        macd_signal     = indicators_data["macd"]["signal"]
        macd_hist       = indicators_data["macd"]["histogram"]
        macd_cross      = indicators_data["macd"]["crossover"]
        bb_pct          = indicators_data["bollinger_bands"]["pct_b"]
        bb_bw           = indicators_data["bollinger_bands"]["bandwidth"]
        ema50           = indicators_data["ema"]["ema50"]
        ema200          = indicators_data["ema"]["ema200"]
        ema_trend       = indicators_data["ema"]["trend"]
        obv_trend       = indicators_data["obv"]["trend"]
        atr             = indicators_data["atr"]["value"]
        atr_pct         = indicators_data["atr"]["pct_of_price"]
        fear_greed      = fg_data["value"]
        fg_class        = fg_data["classification"]
        funding_rate    = funding["rate_pct"]
        long_short      = ls_ratio["ratio"]
        long_pct        = ls_ratio["long_pct"]
        short_pct       = ls_ratio["short_pct"]

        funding_str = (
            f"{funding_rate:+.4f}% per 8h" if funding_rate is not None else "unavailable"
        )
        ls_str = (
            f"{long_short} ({long_pct}% long / {short_pct}% short)"
            if long_short is not None else "unavailable"
        )

        # Explicitly compute price-vs-EMA positions so Claude doesn't have to infer
        # them from ema_trend (which compares EMA50 vs EMA200, not price vs EMA50).
        price_vs_ema50  = ("above" if ema50  and btc_price > ema50  else "below") if ema50  else "N/A"
        price_vs_ema200 = ("above" if ema200 and btc_price > ema200 else "below") if ema200 else "N/A"

        prompt = f"""You are a professional crypto trading analyst. Analyze the exact live market data below and identify 2 to 4 distinct trading setups or tensions currently present in the Bitcoin market.

Use ONLY these exact numbers, no estimates.

BTC Price:          ${btc_price:,.2f}
24h Change:         {change_24h:+.2f}%
RSI (14):           {rsi} ({rsi_signal})
MACD:               {macd}
MACD Signal:        {macd_signal}
MACD Histogram:     {macd_hist} ({macd_cross} crossover)
Bollinger %B:       {bb_pct}
Bollinger Bandwidth:{bb_bw}
EMA50:              ${ema50} (price is {price_vs_ema50} EMA50)
EMA200:             ${ema200} (price is {price_vs_ema200} EMA200)
EMA Cross Trend:    {ema_trend} (EMA50 vs EMA200 relationship)
OBV Trend:          {obv_trend}
ATR:                ${atr} ({atr_pct}% of price)
Fear & Greed:       {fear_greed} ({fg_class})
Funding Rate:       {funding_str}
Long/Short Ratio:   {ls_str}
BTC Sent On-Chain:  {total_btc_sent:,.0f} BTC today
Mempool:            {onchain_data.get('mempool_size', 0):,} pending txs

Respond with ONLY a JSON array, no markdown, no extra text:
[
  {{
    "type": "bullish" | "bearish" | "warning" | "squeeze",
    "title": "Short setup title (max 8 words)",
    "description": "1-2 sentence explanation quoting the exact numbers above",
    "confidence": "high" | "medium" | "low"
  }}
]

Type definitions:
- bullish: price likely to move up based on current signals
- bearish: price likely to move down based on current signals
- warning: risk signal (liquidation cascade risk, extreme sentiment, etc.)
- squeeze: volatility compression about to expand (Bollinger squeeze, funding extremes, coil)

Return only the 2-4 most significant setups."""

        logger.info(
            f"[tensions] prompt values — price=${btc_price:,.0f} fg={fear_greed} "
            f"macd={macd} ema50={ema50} ema200={ema200} rsi={rsi}"
        )

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


