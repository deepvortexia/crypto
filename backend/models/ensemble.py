import concurrent.futures
import json
import logging
import os
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

import httpx
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
HORIZON_WEIGHTS = {
    "1h":     {"lstm": 0.20, "xgboost": 0.60, "prophet": 0.20},
    "4h":     {"lstm": 0.30, "xgboost": 0.50, "prophet": 0.20},
    "8h":     {"lstm": 0.32, "xgboost": 0.45, "prophet": 0.23},
    "12h":    {"lstm": 0.34, "xgboost": 0.42, "prophet": 0.24},
    "24h":    {"lstm": 0.35, "xgboost": 0.40, "prophet": 0.25},
    "1week":  {"lstm": 0.30, "xgboost": 0.25, "prophet": 0.45},
    "1month": {"lstm": 0.20, "xgboost": 0.15, "prophet": 0.65},
}

# For these horizons, bullish 24h momentum shifts weight from xgboost → prophet
MOMENTUM_HORIZONS = {"1h", "4h"}

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
        if hw and horizon_key in MOMENTUM_HORIZONS:
            try:
                change_24h = (hourly_df["close"].iloc[-1] - hourly_df["close"].iloc[-24]) / hourly_df["close"].iloc[-24]
            except Exception:
                change_24h = 0.0
            if change_24h > 0:
                hw = dict(hw)
                hw["prophet"] = round(hw["prophet"] + 0.10, 3)
                hw["xgboost"] = round(hw["xgboost"] - 0.10, 3)
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
            "change_pct": round(change_pct, 4),
            "direction": "up" if change_pct >= 0 else "down",
            "confidence": self._confidence_score(horizon_key, list(valid.values())),
            "model_predictions": {
                "lstm": round(lstm_pred, 2) if lstm_pred else None,
                "xgboost": round(xgb_pred, 2) if xgb_pred else None,
                "prophet": round(prophet_pred, 2) if prophet_pred else None,
            },
            "weights_used": weights_used,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "target_time": (datetime.now(timezone.utc) + timedelta(hours=HORIZON_HOURS[horizon_key])).isoformat(),
        }

        return result

    def _confidence_score(self, horizon_key: str, model_values: list[float]) -> float:
        _CAPS  = {"1h": 0.72, "4h": 0.68, "8h": 0.63, "12h": 0.58, "24h": 0.52, "1week": 0.41, "1month": 0.34}
        _FLOORS = {"1h": 0.45, "4h": 0.42, "8h": 0.38, "12h": 0.35, "24h": 0.30, "1week": 0.25, "1month": 0.20}
        cap   = _CAPS.get(horizon_key, 0.55)
        floor = _FLOORS.get(horizon_key, 0.25)
        resolved = [
            p for p in self._predictions
            if p["horizon"] == horizon_key and p["direction_correct"] is not None
        ][-30:]
        if len(resolved) >= 5:
            raw = float(np.mean([p["direction_correct"] for p in resolved]))
        elif len(model_values) < 2:
            raw = cap * 0.70
        else:
            std = float(np.std(model_values))
            mean = float(np.mean(model_values))
            cv = std / mean if mean else 1.0
            raw = min(1.0 - cv * 5, cap * 0.70)
        return round(min(cap, max(floor, raw)), 3)

    # ── Supabase helpers ──────────────────────────────────────────────────────

    @staticmethod
    def _sb_headers() -> dict:
        key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
        return {
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        }

    @staticmethod
    def _sb_url(path: str) -> str:
        base = os.environ.get("SUPABASE_URL", "").rstrip("/")
        return f"{base}/rest/v1/{path}"

    # ── Horizon → OKX bar string ──────────────────────────────────────────────

    _HORIZON_BAR = {
        "1h": "1H", "4h": "4H", "8h": "8H", "12h": "12H",
        "24h": "1D", "1week": "1W", "1month": "1M",
    }

    async def _store_prediction(self, pred: dict):
        row = {
            "horizon":         pred["horizon"],
            "predicted_price": pred["predicted_price"],
            "current_price":   pred["current_price"],
            "direction":       pred["direction"],
            "confidence":      pred.get("confidence"),
            "target_time":     pred["target_time"],
        }
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(
                    self._sb_url("predictions"),
                    headers=self._sb_headers(),
                    json=row,
                )
                resp.raise_for_status()
        except Exception as exc:
            logger.error(f"[Ensemble] Failed to store prediction in Supabase: {exc}")

    async def resolve_predictions(self, current_price: Optional[float] = None) -> int:
        """Fetch unresolved expired predictions from Supabase and resolve each with the
        actual OKX candle price at the prediction's target_time.
        Returns the count of predictions successfully resolved in this call."""
        headers = self._sb_headers()
        now_iso = datetime.now(timezone.utc).isoformat()
        resolved_count = 0

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.get(
                    self._sb_url("predictions"),
                    headers=headers,
                    params={
                        "select": "*",
                        "resolved": "eq.false",
                        "target_time": f"lte.{now_iso}",
                    },
                )
                resp.raise_for_status()
                unresolved = resp.json()
        except Exception as exc:
            logger.error(f"[Ensemble] Failed to fetch unresolved predictions: {exc}")
            return 0

        if not unresolved:
            return 0

        async with httpx.AsyncClient(timeout=10.0) as client:
            for row in unresolved:
                try:
                    target_time_str = row["target_time"]
                    target_dt = datetime.fromisoformat(target_time_str.replace("Z", "+00:00"))
                    target_ms = int(target_dt.timestamp() * 1000)

                    bar = self._HORIZON_BAR.get(row["horizon"], "1H")
                    okx_resp = await client.get(
                        "https://www.okx.com/api/v5/market/candles",
                        params={
                            "instId": "BTC-USDT",
                            "bar":    bar,
                            "limit":  "1",
                            "after":  str(target_ms),
                        },
                    )
                    okx_resp.raise_for_status()
                    candles = okx_resp.json().get("data", [])
                    if not candles:
                        logger.warning(f"[Ensemble] No OKX candle for {row['horizon']} target={target_time_str}")
                        continue

                    actual_price = float(candles[0][4])  # close price
                    direction_correct = (row["direction"] == "up") == (actual_price > row["current_price"])
                    mean_error = abs(actual_price - row["predicted_price"]) / row["current_price"] * 100

                    patch_resp = await client.patch(
                        self._sb_url(f"predictions?id=eq.{row['id']}"),
                        headers=headers,
                        json={
                            "resolved":          True,
                            "actual_price":      round(actual_price, 2),
                            "direction_correct": direction_correct,
                            "resolved_at":       datetime.now(timezone.utc).isoformat(),
                        },
                    )
                    patch_resp.raise_for_status()
                    logger.info(
                        f"[Ensemble] Resolved {row['horizon']} id={row['id']} "
                        f"actual={actual_price:.2f} correct={direction_correct}"
                    )

                    # Update in-memory weights using freshly resolved data
                    self._predictions.append({
                        "horizon":           row["horizon"],
                        "direction_correct": direction_correct,
                        "pct_error":         mean_error,
                        "model_name":        row.get("model_name"),
                    })
                    self._predictions = self._predictions[-1000:]
                    resolved_count += 1

                except Exception as exc:
                    logger.error(f"[Ensemble] Error resolving prediction id={row.get('id')}: {exc}")

        if resolved_count:
            self._recompute_weights()
        return resolved_count

    async def get_accuracy(self) -> dict:
        headers = self._sb_headers()
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(
                    self._sb_url("predictions"),
                    headers=headers,
                    params={
                        "select":   "horizon,actual_price,predicted_price,current_price,direction_correct",
                        "resolved": "eq.true",
                        "limit":    "10000",
                    },
                )
                resp.raise_for_status()
                resolved = resp.json()
        except Exception as exc:
            logger.error(f"[Ensemble] Failed to fetch resolved predictions: {exc}")
            return {"message": "Failed to fetch accuracy data", "count": 0}

        if not resolved:
            return {"message": "No resolved predictions yet", "count": 0}

        by_horizon: dict[str, list] = {}
        for p in resolved:
            by_horizon.setdefault(p["horizon"], []).append(p)

        stats = {}
        for horizon, preds in by_horizon.items():
            errors = [
                abs(p["actual_price"] - p["predicted_price"]) / p["current_price"] * 100
                for p in preds
                if p.get("actual_price") is not None and p.get("predicted_price") is not None
            ]
            directions = [p["direction_correct"] for p in preds if p.get("direction_correct") is not None]
            stats[horizon] = {
                "count":              len(preds),
                "mape":               round(float(np.mean(errors)), 3) if errors else None,
                "direction_accuracy": round(float(np.mean(directions)) * 100, 1) if directions else None,
            }

        all_errors = [
            abs(p["actual_price"] - p["predicted_price"]) / p["current_price"] * 100
            for p in resolved
            if p.get("actual_price") is not None and p.get("predicted_price") is not None
        ]
        all_dirs = [p["direction_correct"] for p in resolved if p.get("direction_correct") is not None]
        return {
            "total_predictions":          len(resolved),
            "overall_mape":               round(float(np.mean(all_errors)), 3) if all_errors else None,
            "overall_direction_accuracy": round(float(np.mean(all_dirs)) * 100, 1) if all_dirs else None,
            "by_horizon":                 stats,
            "current_weights":            self.weights,
        }

    def _recompute_weights(self):
        """Adjust ensemble weights based on recent per-model accuracy (if tracked)."""
        resolved = [p for p in self._predictions if p.get("actual_price") is not None]
        if not resolved:
            return

        by_model: dict[str, list] = {}
        for p in resolved:
            model = p.get("model_name")
            if model is None:
                continue
            by_model.setdefault(model, []).append(p)

        if not by_model:
            return

        MODEL_ORDER = ["lstm", "xgboost", "prophet"]

        scores: dict[str, float] = {}
        for model, preds in by_model.items():
            if len(preds) < 5:
                continue
            directions = [p["direction_correct"] for p in preds if p.get("direction_correct") is not None]
            errors = [p["pct_error"] for p in preds if p.get("pct_error") is not None]
            if not directions or not errors:
                continue
            direction_accuracy = float(np.mean(directions))
            mean_pct_error = float(np.mean(errors))
            scores[model] = direction_accuracy / (1 + mean_pct_error)

        if not scores:
            return

        total_score = sum(scores.values())
        if total_score == 0:
            return
        normalized = {m: s / total_score for m, s in scores.items()}

        new_weights = {}
        for horizon, w_list in self.weights.items():
            updated = list(w_list)
            for i, model in enumerate(MODEL_ORDER):
                if model not in normalized:
                    continue  # fewer than 5 resolved predictions — keep current weight
                current_w = w_list[i] if i < len(w_list) else 1 / len(MODEL_ORDER)
                updated[i] = 0.7 * normalized[model] + 0.3 * current_w
            total = sum(updated)
            if total > 0:
                updated = [round(v / total, 4) for v in updated]
            new_weights[horizon] = updated

        self.weights = new_weights
        self._save_weights()
        logger.info(f"[Ensemble] Weights recomputed from {len(scores)} models: {scores}")

    def _load_weights(self) -> dict:
        if self.weights_path.exists():
            try:
                with open(self.weights_path) as f:
                    return json.load(f)
            except Exception:
                pass
        return dict(DEFAULT_WEIGHTS)

    def _save_weights(self):
        self.data_dir.mkdir(parents=True, exist_ok=True)
        with open(self.weights_path, "w") as f:
            json.dump(self.weights, f)

    def _load_predictions(self) -> list:
        if self.predictions_path.exists():
            try:
                with open(self.predictions_path) as f:
                    return json.load(f)
            except Exception:
                pass
        return []

    def _save_predictions(self):
        self.data_dir.mkdir(parents=True, exist_ok=True)
        with open(self.predictions_path, "w") as f:
            json.dump(self._predictions, f)
