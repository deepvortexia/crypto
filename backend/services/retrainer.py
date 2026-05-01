import asyncio
import logging
from datetime import datetime, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

logger = logging.getLogger(__name__)

_scheduler: AsyncIOScheduler | None = None
_ensemble = None  # Injected at startup
_is_training = False
_last_trained: datetime | None = None


def inject_ensemble(ensemble):
    global _ensemble
    _ensemble = ensemble


async def retrain_all():
    global _is_training, _last_trained

    if _is_training:
        logger.info("Retraining already in progress, skipping")
        return
    if _ensemble is None:
        logger.error("Ensemble not injected into retrainer")
        return

    _is_training = True
    logger.info("Starting scheduled retraining…")

    try:
        from services.data_fetcher import fetch_hourly_ohlcv, fetch_daily_ohlcv

        logger.info("Fetching training data from CoinGecko…")
        hourly_df, daily_df = await asyncio.gather(
            fetch_hourly_ohlcv(days=90),
            fetch_daily_ohlcv(days=365),
        )
        logger.info(f"Fetched {len(hourly_df)} hourly and {len(daily_df)} daily candles")

        loop = asyncio.get_event_loop()

        logger.info("Training LSTM…")
        await loop.run_in_executor(None, _ensemble.lstm.train, hourly_df)

        logger.info("Training XGBoost (short horizons)…")
        await loop.run_in_executor(None, _ensemble.xgb.train, hourly_df)

        logger.info("Training Prophet…")
        await loop.run_in_executor(None, _ensemble.prophet.train, hourly_df, daily_df)

        _last_trained = datetime.now(timezone.utc)
        logger.info(f"Retraining completed at {_last_trained.isoformat()}")

    except Exception as exc:
        logger.error(f"Retraining failed: {exc}", exc_info=True)
    finally:
        _is_training = False


def get_status() -> dict:
    return {
        "is_training": _is_training,
        "last_trained": _last_trained.isoformat() if _last_trained else None,
        "models_ready": _ensemble.is_ready if _ensemble else False,
    }


def start_scheduler(retrain_interval_hours: int = 24):
    global _scheduler
    _scheduler = AsyncIOScheduler(timezone="UTC")
    _scheduler.add_job(
        retrain_all,
        trigger=IntervalTrigger(hours=retrain_interval_hours),
        id="retrain_models",
        name="Retrain all BTC prediction models",
        replace_existing=True,
    )
    _scheduler.start()
    logger.info(f"Retraining scheduler started (every {retrain_interval_hours}h)")
    return _scheduler


def stop_scheduler():
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
