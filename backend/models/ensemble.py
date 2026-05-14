import concurrent.futures
import json
import logging
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd

from models.lstm_model import BTCLSTMModel
from models.xgboost_model import BTCXGBoostModel
from models.prophet_model import BTCProphetModel

logger = logging.getLogger(__name__)

HORIZONS = ["1h", "4h", "8h", "12h", "24h", "1week", "1month"]
HORIZON_HOURS = {"1h": 1, "4h": 4, "8h": 8, "12h": 12, "24h": 24, "1week": 168, "1month": 720}

# Default weights: [lstm, xgboost, prophet] — fallback when a model is missing
DEFAULT_WEIGHTS = {"1h": [0.50, 0.45, 0.05], "4h": [0.45, 0.40, 0.15],
                   "8h": [0.40, 0.40, 0.20], "12h": [0.35, 0.40, 0.25],
                   "24h": [0.35, 0.35, 0.30], "1week": [0.25, 0.40, 0.35],
                   "1month": [0.25, 0.35, 0.40]}

# Per-horizon blend weights (lstm, xgboost, prophet).
# Prophet weighted higher at longer horizons — it captures weekly/monthly seasonality.
# XGB weighted higher at short horizons — momentum features dominate near-term.
# 8h / 12h not defined here — they fall through to the legacy blend path.
HORIZON_WEIGHTS = {
    "1h":     {"lstm": 0.20, "xgboost": 0.60, "prophet": 0.20},
    "4h":     {"lstm": 0.30, "xgboost": 0.50, "prophet": 0.20},
    "24h":    {"lstm": 0.35, "xgboost": 0.40, "prophet": 0.25},
    "1week":  {"lstm": 0.30, "xgboost": 0.25, "prophet": 0.45},
    "1month": {"lstm": 0.20, "xgboost": 0.15, "prophet": 0.65},
}

# Maximum realistic price move per horizon — ensemble output is clamped to this range
HORIZON_MAX_MOVE = {
    "1h":     0.008,   # ±0.8%
    "4h":     0.020,   # ±2.0%
    "8h":     0.030,   # ±3.0%
    "12h":    0.040,   # ±4.0%
    "24h":    0.055,   # ±5.5%
    "1week":  0.12,    # ±12%
    "1month": 0.25,    # ±25%
}


class BTCEnsemble:
    def __init__(self, data_dir: str = "models"):
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.predictions_path = self.data_dir / "predictions.json"
        self.weights_path = self.data_dir / "weights.json"

        # Models saved directly in data_dir (no subdirectory)
        models_dir = str(self.data_dir)
        self.lstm = BTCLSTMModel(data_dir=models_dir)
        self.xgb = BTCXGBoostModel(data_dir=models_dir)
        self.prophet = BTCProphetModel(data_dir=models_dir)

        self.weights: dict[str, list[float]] = self._load_weights()
        self._predictions: list[dict] = self._load_predictions()

    @property
    def is_ready(self) -> bool:
        return self.xgb.is_trained or self.prophet.is_trained

    def load_models(self) -> bool:
        lstm_ok = self.lstm.load()
        xgb_ok = self.xgb.load()
        prophet_ok = self.prophet.load()
        logger.info(f"Model load status — LSTM:{lstm_ok} XGB:{xgb_ok} Prophet:{prophet_ok}")
        return lstm_ok or xgb_ok

    def predict(self, horizon_key: str, hourly_df: pd.DataFrame, daily_df: pd.DataFrame, current_price: float) -> dict:
        df_for_xgb = hourly_df  # always hourly, matches training

        t_dispatch = time.perf_counter()
        with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
            lstm_future    = executor.submit(self.lstm.predict,    hourly_df,  horizon_key)
            xgb_future     = executor.submit(self.xgb.predict,     df_for_xgb, horizon_key)
            prophet_future = executor.submit(self.prophet.predict,             horizon_key)

            done, not_done = concurrent.futures.wait(
                [lstm_future, xgb_future, prophet_future], timeout=25
            )
        logger.info(f"TIMING all-models wall {horizon_key}: {time.perf_counter()-t_dispatch:.3f}s")

        lstm_pred = xgb_pred = prophet_pred = None

        t0 = time.perf_counter()
        if lstm_future in done:
            try:
                lstm_pred = lstm_future.result()
            except Exception as exc:
                logger.warning(f"[Ensemble] LSTM failed for {horizon_key}: {exc}")
        else:
            logger.warning(f"[Ensemble] LSTM timed out for {horizon_key}")
        logger.info(f"TIMING lstm {horizon_key}: {time.perf_counter()-t0:.3f}s")

        t1 = time.perf_counter()
        if xgb_future in done:
            try:
                xgb_pred = xgb_future.result()
            except Exception as exc:
                logger.warning(f"[Ensemble] XGBoost failed for {horizon_key}: {exc}")
        else:
            logger.warning(f"[Ensemble] XGBoost timed out for {horizon_key}")
        logger.info(f"TIMING xgb {horizon_key}: {time.perf_counter()-t1:.3f}s")

        t2 = time.perf_counter()
        if prophet_future in done:
            try:
                prophet_pred = prophet_future.result()
            except Exception as exc:
                logger.warning(f"[Ensemble] Prophet failed for {horizon_key}: {exc}")
        else:
            logger.warning(f"[Ensemble] Prophet timed out for {horizon_key}")
        logger.info(f"TIMING prophet {horizon_key}: {time.perf_counter()-t2:.3f}s")

        preds = {"lstm": lstm_pred, "xgboost": xgb_pred, "prophet": prophet_pred}
        valid = {k: v for k, v in preds.items() if v is not None and v > 0}

        if not valid:
            return {"error": "No models ready", "horizon": horizon_key}

        hw = HORIZON_WEIGHTS.get(horizon_key)
        if "xgboost" in valid and "lstm" in valid and hw:
            if "prophet" in valid:
                ensemble_price = (valid["lstm"]    * hw["lstm"] +
                                  valid["xgboost"] * hw["xgboost"] +
                                  valid["prophet"] * hw["prophet"])
                weights_used = dict(hw)
            else:
                total = hw["lstm"] + hw["xgboost"]
                w_l = hw["lstm"] / total
                w_x = hw["xgboost"] / total
                ensemble_price = valid["lstm"] * w_l + valid["xgboost"] * w_x
                weights_used = {"lstm": round(w_l, 3), "xgboost": round(w_x, 3), "prophet": 0}
        elif "xgboost" in valid and "lstm" in valid:
            # 8h / 12h — no HORIZON_WEIGHTS entry, use legacy blend
            xgb_lstm_blend = valid["xgboost"] * 0.60 + valid["lstm"] * 0.40
            if "prophet" in valid:
                ensemble_price = xgb_lstm_blend * 0.80 + valid["prophet"] * 0.20
                weights_used = {"lstm": 0.32, "xgboost": 0.48, "prophet": 0.20}
            else:
                ensemble_price = xgb_lstm_blend
                weights_used = {"lstm": 0.40, "xgboost": 0.60, "prophet": 0}
        else:
            # Single-model fallback
            w = self.weights.get(horizon_key, DEFAULT_WEIGHTS.get(horizon_key, [1/3, 1/3, 1/3]))
            model_order = ["lstm", "xgboost", "prophet"]
            weighted_sum = 0.0
            weight_total = 0.0
            for i, name in enumerate(model_order):
                if name in valid:
                    weighted_sum += valid[name] * w[i]
                    weight_total += w[i]
            ensemble_price = weighted_sum / weight_total if weight_total > 0 else current_price
            weights_used = {name: w[i] for i, name in enumerate(model_order)}

        # Clamp predictions to realistic max moves per horizon
        max_move = current_price * HORIZON_MAX_MOVE.get(horizon_key, 0.10)
        ensemble_price = max(current_price - max_move,
                             min(current_price + max_move, ensemble_price))

        change_pct = (ensemble_price - current_price) / current_price * 100

        result = {
            "horizon": horizon_key,
            "current_price": round(current_price, 2),
            "predicted_price": round(ensemble_price, 2),
            "change_pct": round(change_pct, 3),
            "direction": "up" if change_pct >= 0 else "down",
            "confidence": self._confidence_score(list(valid.values())),
            "model_predictions": {
                "lstm": round(lstm_pred, 2) if lstm_pred else None,
                "xgboost": round(xgb_pred, 2) if xgb_pred else None,
                "prophet": round(prophet_pred, 2) if prophet_pred else None,
            },
            "weights_used": weights_used,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "target_time": (datetime.now(timezone.utc) + timedelta(hours=HORIZON_HOURS[horizon_key])).isoformat(),
        }

        self._store_prediction(result)
        return result

    def _confidence_score(self, values: list[float]) -> float:
        if len(values) < 2:
            return 0.75
        std = float(np.std(values))
        mean = float(np.mean(values))
        cv = std / mean if mean else 1.0
        # Lower CV = higher agreement = higher confidence
        # Map to 50-99% range
        raw_confidence = 1.0 - cv * 5
        confidence = min(0.99, max(0.50, raw_confidence))
        return round(confidence, 3)

    def _store_prediction(self, pred: dict):
        entry = {
            "id": f"{pred['horizon']}_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M')}",
            "horizon": pred["horizon"],
            "predicted_price": pred["predicted_price"],
            "current_price": pred["current_price"],
            "change_pct": pred["change_pct"],
            "direction": pred["direction"],
            "prediction_time": pred["timestamp"],
            "target_time": pred["target_time"],
            "actual_price": None,
            "direction_correct": None,
            "pct_error": None,
        }
        self._predictions.append(entry)
        # Keep only last 1000 predictions
        self._predictions = self._predictions[-1000:]
        self._save_predictions()

    def resolve_predictions(self, current_price: float):
        """Fill in actual prices for past predictions that have reached their target time."""
        now = datetime.now(timezone.utc)
        updated = False
        for pred in self._predictions:
            if pred["actual_price"] is not None:
                continue
            try:
                target = datetime.fromisoformat(pred["target_time"].replace("Z", "+00:00"))
            except Exception:
                continue
            if now >= target:
                pred["actual_price"] = round(current_price, 2)
                pred["direction_correct"] = (pred["direction"] == "up") == (current_price > pred["current_price"])
                pred["pct_error"] = abs(current_price - pred["predicted_price"]) / pred["current_price"] * 100
                updated = True
        if updated:
            self._save_predictions()
            self._recompute_weights()

    def get_accuracy(self) -> dict:
        resolved = [p for p in self._predictions if p["actual_price"] is not None]
        if not resolved:
            return {"message": "No resolved predictions yet", "count": 0}

        by_horizon: dict[str, list] = {}
        for p in resolved:
            by_horizon.setdefault(p["horizon"], []).append(p)

        stats = {}
        for horizon, preds in by_horizon.items():
            errors = [p["pct_error"] for p in preds if p["pct_error"] is not None]
            directions = [p["direction_correct"] for p in preds if p["direction_correct"] is not None]
            stats[horizon] = {
                "count": len(preds),
                "mape": round(float(np.mean(errors)), 3) if errors else None,
                "direction_accuracy": round(float(np.mean(directions)) * 100, 1) if directions else None,
            }

        overall_errors = [p["pct_error"] for p in resolved if p["pct_error"] is not None]
        overall_dir = [p["direction_correct"] for p in resolved if p["direction_correct"] is not None]
        return {
            "total_predictions": len(resolved),
            "overall_mape": round(float(np.mean(overall_errors)), 3) if overall_errors else None,
            "overall_direction_accuracy": round(float(np.mean(overall_dir)) * 100, 1) if overall_dir else None,
            "by_horizon": stats,
            "current_weights": self.weights,
        }

    def _recompute_weights(self):
        """Adjust ensemble weights based on recent per-model accuracy (if tracked)."""
        # Weight update logic reserved for when per-model accuracy is tracked.
        # Currently uses static defaults tuned per horizon.
        pass

    def _load_weights(self) -> dict:
        if self.weights_path.exists():
            try:
                with open(self.weights_path) as f:
                    return json.load(f)
            except Exception:
                pass
        return dict(DEFAULT_WEIGHTS)

    def _load_predictions(self) -> list:
        if self.predictions_path.exists():
            try:
                with open(self.predictions_path) as f:
                    return json.load(f)
            except Exception:
                pass
        return []

    def _save_predictions(self):
        with open(self.predictions_path, "w") as f:
            json.dump(self._predictions, f)
