import logging
import pickle
from pathlib import Path
from typing import Optional

import pandas as pd

logger = logging.getLogger(__name__)

HORIZON_HOURS = {"1h": 1, "4h": 4, "8h": 8, "12h": 12, "24h": 24, "1month": 720}

try:
    from prophet import Prophet
    import cmdstanpy as _cmdstanpy  # noqa: F401 — confirms backend is importable
    PROPHET_AVAILABLE = True
except (ImportError, Exception) as _e:
    PROPHET_AVAILABLE = False
    logger.warning(f"Prophet not available — skipping: {_e}")


class BTCProphetModel:
    def __init__(self, data_dir: str = "data/models"):
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.model_hourly: Optional[object] = None
        self.model_daily: Optional[object] = None
        self.is_trained = False
        self._last_train_df_hourly: Optional[pd.DataFrame] = None
        self._last_train_df_daily: Optional[pd.DataFrame] = None

    def train(self, hourly_df: pd.DataFrame, daily_df: pd.DataFrame):
        if not PROPHET_AVAILABLE:
            logger.warning("Skipping Prophet training — library not installed")
            return

        logger.info("Training Prophet models…")
        try:
            self._train_hourly(hourly_df)
            self._train_daily(daily_df)
            self.is_trained = True
            self.save()
        except Exception as exc:
            logger.error(f"Prophet training failed: {exc}")

    def _to_prophet_df(self, df: pd.DataFrame) -> pd.DataFrame:
        idx = df.index
        if hasattr(idx, "tz") and idx.tz is not None:
            idx = idx.tz_localize(None)
        return pd.DataFrame({"ds": idx, "y": df["close"].values})

    def _train_hourly(self, df: pd.DataFrame):
        prophet_df = self._to_prophet_df(df)
        model = Prophet(
            changepoint_prior_scale=0.05,
            seasonality_prior_scale=10.0,
            daily_seasonality=True,
            weekly_seasonality=True,
            yearly_seasonality=False,
        )
        model.add_seasonality(name="monthly", period=30.5, fourier_order=5)
        logger.info("Prophet fitting hourly model…")
        model.fit(prophet_df)
        self.model_hourly = model
        self._last_train_df_hourly = prophet_df
        logger.info("Prophet hourly model trained ✓")

    def _train_daily(self, df: pd.DataFrame):
        prophet_df = self._to_prophet_df(df)
        model = Prophet(
            changepoint_prior_scale=0.1,
            seasonality_prior_scale=10.0,
            daily_seasonality=False,
            weekly_seasonality=True,
            yearly_seasonality=True,
        )
        model.add_seasonality(name="monthly", period=30.5, fourier_order=5)
        logger.info("Prophet fitting daily model…")
        model.fit(prophet_df)
        self.model_daily = model
        self._last_train_df_daily = prophet_df
        logger.info("Prophet daily model trained ✓")

    def predict(self, horizon_key: str) -> Optional[float]:
        if not self.is_trained or not PROPHET_AVAILABLE:
            return None
        try:
            horizon_h = HORIZON_HOURS[horizon_key]
            if horizon_h <= 24:
                if self.model_hourly is None:
                    return None
                future = self.model_hourly.make_future_dataframe(periods=horizon_h, freq="h")
                forecast = self.model_hourly.predict(future)
                return float(forecast.iloc[-1]["yhat"])
            else:
                if self.model_daily is None:
                    return None
                horizon_days = horizon_h // 24
                future = self.model_daily.make_future_dataframe(periods=horizon_days, freq="D")
                forecast = self.model_daily.predict(future)
                return float(forecast.iloc[-1]["yhat"])
        except Exception as exc:
            logger.error(f"Prophet predict error ({horizon_key}): {exc}")
            return None

    def save(self):
        if self.model_hourly:
            with open(self.data_dir / "prophet_hourly.pkl", "wb") as f:
                pickle.dump(self.model_hourly, f)
        if self.model_daily:
            with open(self.data_dir / "prophet_daily.pkl", "wb") as f:
                pickle.dump(self.model_daily, f)
        logger.info("Prophet models saved")

    def load(self) -> bool:
        if not PROPHET_AVAILABLE:
            return False
        loaded = 0
        for name in ("hourly", "daily"):
            path = self.data_dir / f"prophet_{name}.pkl"
            if path.exists():
                try:
                    with open(path, "rb") as f:
                        model = pickle.load(f)
                    setattr(self, f"model_{name}", model)
                    loaded += 1
                except Exception as exc:
                    logger.error(f"Failed to load Prophet {name}: {exc}")
        self.is_trained = loaded == 2
        logger.info(f"Loaded {loaded}/2 Prophet models")
        return self.is_trained
