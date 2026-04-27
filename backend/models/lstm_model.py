import logging
import os
import pickle
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from sklearn.preprocessing import MinMaxScaler

from services.indicators import compute_indicators

logger = logging.getLogger(__name__)

FEATURE_COLS = ["close", "volume", "rsi", "macd", "macd_signal", "bb_pct", "ema50", "ema200", "atr", "obv_ema"]
HORIZON_HOURS = {"4h": 4, "8h": 8, "12h": 12, "24h": 24, "1month": 720}
SEQUENCE_LEN = 168  # 1 week of hourly data


class _LSTMNet(nn.Module):
    def __init__(self, input_size: int = 10, hidden_size: int = 128, num_layers: int = 2, dropout: float = 0.2):
        super().__init__()
        self.lstm = nn.LSTM(input_size, hidden_size, num_layers, batch_first=True, dropout=dropout)
        self.dropout = nn.Dropout(dropout)
        self.fc = nn.Sequential(
            nn.Linear(hidden_size, 64),
            nn.ReLU(),
            nn.Linear(64, 1),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        out, _ = self.lstm(x)
        out = self.dropout(out[:, -1, :])
        return self.fc(out).squeeze(-1)


class BTCLSTMModel:
    def __init__(self, data_dir: str = "data/models"):
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.models: dict[str, _LSTMNet] = {}
        self.scalers: dict[str, MinMaxScaler] = {}
        self.price_scalers: dict[str, MinMaxScaler] = {}
        self.is_trained = False
        self.device = torch.device("cpu")

    def _prepare_sequences(
        self,
        df: pd.DataFrame,
        horizon_h: int,
        seq_len: int = SEQUENCE_LEN,
    ) -> tuple[np.ndarray, np.ndarray]:
        df = compute_indicators(df).dropna()
        available = [c for c in FEATURE_COLS if c in df.columns]
        features = df[available].values.astype(np.float32)
        prices = df["close"].values.astype(np.float32)

        scaler = MinMaxScaler()
        features_scaled = scaler.fit_transform(features)

        price_scaler = MinMaxScaler()
        prices_scaled = price_scaler.fit_transform(prices.reshape(-1, 1)).flatten()

        X, y = [], []
        for i in range(seq_len, len(features_scaled) - horizon_h):
            X.append(features_scaled[i - seq_len:i])
            y.append(prices_scaled[i + horizon_h - 1])

        return np.array(X), np.array(y), scaler, price_scaler

    def train(self, df: pd.DataFrame, epochs: int = 40, batch_size: int = 32):
        logger.info("Training LSTM models for all horizons…")
        for horizon_key, horizon_h in HORIZON_HOURS.items():
            logger.info(f"  Training LSTM for {horizon_key}")
            try:
                self._train_single(df, horizon_key, horizon_h, epochs, batch_size)
            except Exception as exc:
                logger.error(f"LSTM {horizon_key} training failed: {exc}")
        self.is_trained = True
        self.save()

    def _train_single(self, df: pd.DataFrame, key: str, horizon_h: int, epochs: int, batch_size: int):
        X, y, scaler, price_scaler = self._prepare_sequences(df, horizon_h)
        if len(X) < 50:
            logger.warning(f"Not enough data for LSTM {key}, skipping")
            return

        split = int(len(X) * 0.85)
        X_train, y_train = X[:split], y[:split]

        X_t = torch.tensor(X_train, dtype=torch.float32)
        y_t = torch.tensor(y_train, dtype=torch.float32)

        net = _LSTMNet(input_size=X_t.shape[2]).to(self.device)
        optimizer = torch.optim.Adam(net.parameters(), lr=1e-3, weight_decay=1e-5)
        scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(optimizer, patience=5, factor=0.5)
        criterion = nn.MSELoss()

        dataset = torch.utils.data.TensorDataset(X_t, y_t)
        loader = torch.utils.data.DataLoader(dataset, batch_size=batch_size, shuffle=True)

        net.train()
        for epoch in range(epochs):
            total_loss = 0.0
            for xb, yb in loader:
                optimizer.zero_grad()
                pred = net(xb)
                loss = criterion(pred, yb)
                loss.backward()
                nn.utils.clip_grad_norm_(net.parameters(), 1.0)
                optimizer.step()
                total_loss += loss.item()
            scheduler.step(total_loss / len(loader))

        self.models[key] = net
        self.scalers[key] = scaler
        self.price_scalers[key] = price_scaler

    def predict(self, df: pd.DataFrame, horizon_key: str) -> Optional[float]:
        if not self.is_trained or horizon_key not in self.models:
            return None
        try:
            df_ind = compute_indicators(df).dropna()
            available = [c for c in FEATURE_COLS if c in df_ind.columns]
            features = df_ind[available].values[-SEQUENCE_LEN:].astype(np.float32)
            if len(features) < SEQUENCE_LEN:
                return None

            scaler = self.scalers[horizon_key]
            price_scaler = self.price_scalers[horizon_key]
            features_scaled = scaler.transform(features)

            x = torch.tensor(features_scaled[np.newaxis, :, :], dtype=torch.float32)
            self.models[horizon_key].eval()
            with torch.no_grad():
                pred_scaled = self.models[horizon_key](x).item()

            price = price_scaler.inverse_transform([[pred_scaled]])[0][0]
            return float(price)
        except Exception as exc:
            logger.error(f"LSTM predict error ({horizon_key}): {exc}")
            return None

    def save(self):
        for key, net in self.models.items():
            torch.save(net.state_dict(), self.data_dir / f"lstm_{key}.pt")
            with open(self.data_dir / f"lstm_{key}_scaler.pkl", "wb") as f:
                pickle.dump(self.scalers[key], f)
            with open(self.data_dir / f"lstm_{key}_price_scaler.pkl", "wb") as f:
                pickle.dump(self.price_scalers[key], f)
        logger.info("LSTM models saved")

    def load(self) -> bool:
        loaded = 0
        for key, _ in HORIZON_HOURS.items():
            model_path = self.data_dir / f"lstm_{key}.pt"
            scaler_path = self.data_dir / f"lstm_{key}_scaler.pkl"
            price_path = self.data_dir / f"lstm_{key}_price_scaler.pkl"
            if not (model_path.exists() and scaler_path.exists() and price_path.exists()):
                continue
            try:
                with open(scaler_path, "rb") as f:
                    self.scalers[key] = pickle.load(f)
                with open(price_path, "rb") as f:
                    self.price_scalers[key] = pickle.load(f)
                n_features = self.scalers[key].n_features_in_
                net = _LSTMNet(input_size=n_features)
                net.load_state_dict(torch.load(model_path, map_location="cpu"))
                net.eval()
                self.models[key] = net
                loaded += 1
            except Exception as exc:
                logger.error(f"Failed to load LSTM {key}: {exc}")
        self.is_trained = loaded == len(HORIZON_HOURS)
        logger.info(f"Loaded {loaded}/{len(HORIZON_HOURS)} LSTM models")
        return self.is_trained
