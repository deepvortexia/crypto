import logging
import pickle
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.preprocessing import StandardScaler

from services.indicators import compute_indicators

logger = logging.getLogger(__name__)

HORIZON_HOURS = {"1h": 1, "4h": 4, "8h": 8, "12h": 12, "24h": 24, "1month": 720}
LAG_STEPS = [1, 2, 3, 5, 10, 24, 48]


def _build_features(df: pd.DataFrame) -> pd.DataFrame:
    df = compute_indicators(df).dropna()
    feat = df[["close", "volume", "rsi", "macd", "macd_signal", "macd_hist",
               "bb_pct", "ema50", "ema200", "atr", "obv_ema"]].copy()

    for lag in LAG_STEPS:
        feat[f"close_lag_{lag}"] = df["close"].shift(lag)
        feat[f"rsi_lag_{lag}"] = df["rsi"].shift(lag)
        feat[f"volume_lag_{lag}"] = df["volume"].shift(lag)

    feat["close_ret_1"] = df["close"].pct_change(1)
    feat["close_ret_4"] = df["close"].pct_change(4)
    feat["close_ret_24"] = df["close"].pct_change(24)
    feat["volume_ma7"] = df["volume"].rolling(7).mean()
    feat["price_above_ema50"] = (df["close"] > feat["ema50"]).astype(int)
    feat["price_above_ema200"] = (df["close"] > feat["ema200"]).astype(int)

    # Volume momentum (rate of change of volume)
    feat["volume_momentum_4"] = df["volume"].pct_change(4)
    feat["volume_momentum_12"] = df["volume"].pct_change(12)
    feat["volume_momentum_24"] = df["volume"].pct_change(24)
    feat["volume_ratio"] = df["volume"] / df["volume"].rolling(24).mean()

    # Price velocity (rate of change / momentum)
    feat["price_velocity_2"] = df["close"].pct_change(2)
    feat["price_velocity_6"] = df["close"].pct_change(6)
    feat["price_velocity_12"] = df["close"].pct_change(12)
    feat["price_acceleration"] = feat["close_ret_1"] - feat["close_ret_1"].shift(1)

    # Volatility (ATR-based and rolling std)
    feat["volatility_6"] = df["close"].pct_change().rolling(6).std()
    feat["volatility_12"] = df["close"].pct_change().rolling(12).std()
    feat["volatility_24"] = df["close"].pct_change().rolling(24).std()
    feat["atr_ratio"] = df["atr"] / df["close"]

    # Rolling sentiment proxy (derived from price action and momentum)
    feat["sentiment_rsi"] = (df["rsi"] - 50) / 50  # normalized RSI as sentiment
    feat["sentiment_macd"] = np.sign(df["macd_hist"])  # MACD histogram direction
    feat["sentiment_trend"] = ((df["close"] > feat["ema50"]).astype(int) +
                               (df["close"] > feat["ema200"]).astype(int)) / 2
    feat["sentiment_composite"] = (feat["sentiment_rsi"] + feat["sentiment_macd"] +
                                   feat["sentiment_trend"]) / 3

    return feat.dropna()


class BTCXGBoostModel:
    def __init__(self, data_dir: str = "data/models"):
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.models: dict[str, xgb.XGBRegressor] = {}
        self.scalers: dict[str, StandardScaler] = {}
        self.is_trained = False

    def train(self, df: pd.DataFrame):
        logger.info("Training XGBoost models for all horizons…")
        feat_df = _build_features(df)
        feat_df = feat_df.join(df["close"].rename("raw_close"), how="left")

        for horizon_key, horizon_h in HORIZON_HOURS.items():
            logger.info(f"  Training XGBoost for {horizon_key}")
            try:
                self._train_single(feat_df, horizon_key, horizon_h)
            except Exception as exc:
                logger.error(f"XGBoost {horizon_key} training failed: {exc}")

        self.is_trained = True
        self.save()

    def _train_single(self, feat_df: pd.DataFrame, key: str, horizon_h: int):
        target = feat_df["raw_close"].shift(-horizon_h)
        aligned = feat_df.copy()
        aligned["target"] = target
        aligned = aligned.dropna()

        if len(aligned) < 100:
            logger.warning(f"Not enough data for XGBoost {key}, skipping")
            return

        feature_cols = [c for c in aligned.columns if c not in ("target", "raw_close")]
        X = aligned[feature_cols].values.astype(np.float32)
        y = aligned["target"].values.astype(np.float32)

        split = int(len(X) * 0.85)
        X_train, X_val = X[:split], X[split:]
        y_train, y_val = y[:split], y[split:]

        scaler = StandardScaler()
        X_train_s = scaler.fit_transform(X_train)
        X_val_s = scaler.transform(X_val)

        model = xgb.XGBRegressor(
            n_estimators=600,
            learning_rate=0.03,
            max_depth=6,
            subsample=0.8,
            colsample_bytree=0.8,
            min_child_weight=3,
            reg_alpha=0.1,
            reg_lambda=1.0,
            early_stopping_rounds=30,
            eval_metric="rmse",
            device="cpu",
            n_jobs=-1,
        )
        model.fit(
            X_train_s, y_train,
            eval_set=[(X_val_s, y_val)],
            verbose=False,
        )

        self.models[key] = model
        self.scalers[key] = scaler
        # Store feature column names per horizon so predict uses the same columns
        if not hasattr(self, "_feature_cols"):
            self._feature_cols: dict[str, list[str]] = {}
        self._feature_cols[key] = feature_cols

    def predict(self, df: pd.DataFrame, horizon_key: str) -> Optional[float]:
        if not self.is_trained or horizon_key not in self.models:
            return None
        try:
            feat_df = _build_features(df)
            feature_cols = getattr(self, "_feature_cols", {}).get(horizon_key)
            if feature_cols is None:
                # Fallback: use all feature columns except raw_close
                feature_cols = [c for c in feat_df.columns]

            # Align columns — add any missing with 0
            for col in feature_cols:
                if col not in feat_df.columns:
                    feat_df[col] = 0.0

            X = feat_df[feature_cols].iloc[-1:].values.astype(np.float32)
            scaler = self.scalers[horizon_key]
            X_scaled = scaler.transform(X)
            pred = self.models[horizon_key].predict(X_scaled)[0]

            # For 1H predictions, apply momentum boost to make prediction more directional
            if horizon_key == "1h" and len(df) >= 3:
                current_price = df["close"].iloc[-1]
                # Calculate recent momentum (last 2 hours)
                momentum_2h = (df["close"].iloc[-1] - df["close"].iloc[-3]) / df["close"].iloc[-3]
                # Apply 40% of 2H momentum to the 1H prediction
                momentum_adjustment = current_price * momentum_2h * 0.20
                pred = pred + momentum_adjustment

            return float(pred)
        except Exception as exc:
            logger.error(f"XGBoost predict error ({horizon_key}): {exc}")
            return None

    def save(self):
        for key, model in self.models.items():
            model.save_model(str(self.data_dir / f"xgb_{key}.ubj"))
            with open(self.data_dir / f"xgb_{key}_scaler.pkl", "wb") as f:
                pickle.dump(self.scalers[key], f)
        feat_cols = getattr(self, "_feature_cols", {})
        if feat_cols:
            with open(self.data_dir / "xgb_feature_cols.pkl", "wb") as f:
                pickle.dump(feat_cols, f)
        logger.info("XGBoost models saved")

    def load(self) -> bool:
        feat_path = self.data_dir / "xgb_feature_cols.pkl"
        if feat_path.exists():
            try:
                with open(feat_path, "rb") as f:
                    self._feature_cols = pickle.load(f)
            except Exception:
                pass

        loaded = 0
        for key in HORIZON_HOURS:
            model_path = self.data_dir / f"xgb_{key}.ubj"
            scaler_path = self.data_dir / f"xgb_{key}_scaler.pkl"
            if not (model_path.exists() and scaler_path.exists()):
                continue
            try:
                model = xgb.XGBRegressor()
                model.load_model(str(model_path))
                with open(scaler_path, "rb") as f:
                    scaler = pickle.load(f)
                self.models[key] = model
                self.scalers[key] = scaler
                loaded += 1
            except Exception as exc:
                logger.error(f"Failed to load XGBoost {key}: {exc}")
        self.is_trained = loaded == len(HORIZON_HOURS)
        logger.info(f"Loaded {loaded}/{len(HORIZON_HOURS)} XGBoost models")
        return self.is_trained
