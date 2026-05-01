import logging
import pickle
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd
from sklearn.preprocessing import MinMaxScaler

from services.indicators import compute_indicators

logger = logging.getLogger(__name__)

FEATURE_COLS = ["close", "volume", "rsi", "macd", "macd_signal", "bb_pct", "ema50", "ema200", "atr", "obv_ema"]
HORIZON_HOURS = {"4h": 4, "8h": 8, "12h": 12, "24h": 24, "1month": 720}
SEQUENCE_LEN = 24  # 1 day of hourly data


# ── Numerics ──────────────────────────────────────────────────────────────────

def _sigmoid(x: np.ndarray) -> np.ndarray:
    x = np.clip(x, -88.0, 88.0)
    return 1.0 / (1.0 + np.exp(-x))


# ── Adam optimizer ────────────────────────────────────────────────────────────

class _Adam:
    def __init__(self, params: list, lr: float = 1e-3,
                 beta1: float = 0.9, beta2: float = 0.999, eps: float = 1e-8):
        self.lr = lr
        self.beta1 = beta1
        self.beta2 = beta2
        self.eps = eps
        self.t = 0
        self.params = params
        self.ms = [np.zeros_like(p) for p in params]
        self.vs = [np.zeros_like(p) for p in params]

    def step(self, grads: list):
        self.t += 1
        bc1 = 1.0 - self.beta1 ** self.t
        bc2 = 1.0 - self.beta2 ** self.t
        for p, g, m, v in zip(self.params, grads, self.ms, self.vs):
            m[:] = self.beta1 * m + (1.0 - self.beta1) * g
            v[:] = self.beta2 * v + (1.0 - self.beta2) * g ** 2
            p -= self.lr * (m / bc1) / (np.sqrt(v / bc2) + self.eps)

    def set_lr(self, lr: float):
        self.lr = lr


# ── LSTM layer (batch-vectorized forward + BPTT backward) ─────────────────────

class _LSTMLayer:
    def __init__(self, input_size: int, hidden_size: int):
        self.input_size = input_size
        self.hidden_size = hidden_size
        H, I = hidden_size, input_size
        scale = np.sqrt(2.0 / (I + H))
        self.Wx = (np.random.randn(4 * H, I) * scale).astype(np.float32)
        self.Wh = (np.random.randn(4 * H, H) * scale).astype(np.float32)
        self.b  = np.zeros(4 * H, dtype=np.float32)
        self.opt = _Adam([self.Wx, self.Wh, self.b])

    def forward(self, X: np.ndarray):
        """X: (B, T, I) → H_all (B, T, H), h_last (B, H), c_last (B, H), cache"""
        B, T, _ = X.shape
        H = self.hidden_size
        h = np.zeros((B, H), dtype=np.float32)
        c = np.zeros((B, H), dtype=np.float32)
        H_all  = np.zeros((B, T, H),     dtype=np.float32)
        C_all  = np.zeros((B, T, H),     dtype=np.float32)
        G_all  = np.zeros((B, T, 4 * H), dtype=np.float32)
        H_prev = np.zeros((B, T, H),     dtype=np.float32)
        C_prev = np.zeros((B, T, H),     dtype=np.float32)

        for t in range(T):
            H_prev[:, t] = h
            C_prev[:, t] = c
            gates = X[:, t] @ self.Wx.T + h @ self.Wh.T + self.b   # (B, 4H)
            G_all[:, t] = gates
            i = _sigmoid(gates[:, :H])
            f = _sigmoid(gates[:, H:2*H])
            g = np.tanh(gates[:, 2*H:3*H])
            o = _sigmoid(gates[:, 3*H:])
            c = f * c + i * g
            h = o * np.tanh(c)
            H_all[:, t] = h
            C_all[:, t] = c

        return H_all, h, c, (X, H_prev, C_prev, G_all, H_all, C_all)

    def backward(self, dH: np.ndarray, cache):
        """dH: (B, T, H) → dX (B, T, I), dWx, dWh, db"""
        X, H_prev, C_prev, G_all, H_all, C_all = cache
        B, T, H = dH.shape
        dWx = np.zeros_like(self.Wx)
        dWh = np.zeros_like(self.Wh)
        db  = np.zeros_like(self.b)
        dX  = np.zeros_like(X)
        dh_next = np.zeros((B, H), dtype=np.float32)
        dc_next = np.zeros((B, H), dtype=np.float32)

        for t in reversed(range(T)):
            dh    = dH[:, t] + dh_next
            gates = G_all[:, t]
            ig = _sigmoid(gates[:, :H])
            fg = _sigmoid(gates[:, H:2*H])
            gg = np.tanh(gates[:, 2*H:3*H])
            og = _sigmoid(gates[:, 3*H:])
            tc = np.tanh(C_all[:, t])
            dc = dh * og * (1.0 - tc ** 2) + dc_next
            dgates = np.concatenate([
                dc * gg        * ig * (1.0 - ig),    # di_pre
                dc * C_prev[:, t] * fg * (1.0 - fg), # df_pre
                dc * ig        * (1.0 - gg ** 2),    # dg_pre
                dh * tc        * og * (1.0 - og),    # do_pre
            ], axis=1)                                # (B, 4H)
            dWx    += dgates.T @ X[:, t]
            dWh    += dgates.T @ H_prev[:, t]
            db     += dgates.sum(axis=0)
            dX[:, t] = dgates @ self.Wx
            dh_next  = dgates @ self.Wh
            dc_next  = dc * fg

        return dX, dWx, dWh, db

    def update(self, dWx, dWh, db):
        self.opt.step([dWx, dWh, db])

    def set_lr(self, lr: float):
        self.opt.set_lr(lr)


# ── Fully-connected head: Linear → ReLU → Linear ─────────────────────────────

class _FCHead:
    def __init__(self, input_size: int, hidden_size: int = 64):
        self.W1 = (np.random.randn(hidden_size, input_size) * np.sqrt(2.0 / input_size)).astype(np.float32)
        self.b1 = np.zeros(hidden_size, dtype=np.float32)
        self.W2 = (np.random.randn(1, hidden_size) * np.sqrt(2.0 / hidden_size)).astype(np.float32)
        self.b2 = np.zeros(1, dtype=np.float32)
        self.opt = _Adam([self.W1, self.b1, self.W2, self.b2])
        self._grads = None

    def forward(self, x: np.ndarray) -> np.ndarray:
        """x: (B, input_size) → (B,)"""
        self._x = x
        self._h = np.maximum(0.0, x @ self.W1.T + self.b1)   # (B, 64)
        return (self._h @ self.W2.T + self.b2).flatten()      # (B,)

    def backward(self, dout: np.ndarray) -> np.ndarray:
        """dout: (B,) → dx: (B, input_size)"""
        d   = dout.reshape(-1, 1)                              # (B, 1)
        dh  = (d @ self.W2) * (self._h > 0.0)                 # (B, 64)
        dW2 = d.T @ self._h                                    # (1, 64)
        db2 = d.sum(axis=0)
        dW1 = dh.T @ self._x                                   # (64, input)
        db1 = dh.sum(axis=0)
        dx  = dh @ self.W1                                     # (B, input)
        self._grads = [dW1, db1, dW2, db2]
        return dx

    def update(self):
        self.opt.step(self._grads)

    def set_lr(self, lr: float):
        self.opt.set_lr(lr)


# ── 2-layer LSTM network ──────────────────────────────────────────────────────

class _LSTMNet:
    def __init__(self, input_size: int = 10, hidden_size: int = 128):
        self.hidden_size = hidden_size
        self.layer1 = _LSTMLayer(input_size, hidden_size)
        self.layer2 = _LSTMLayer(hidden_size, hidden_size)
        self.fc     = _FCHead(hidden_size)

    def forward(self, X: np.ndarray) -> np.ndarray:
        """X: (B, T, input_size) → (B,)"""
        self._H1, _, _, self._cache1 = self.layer1.forward(X)
        self._H2, _, _, self._cache2 = self.layer2.forward(self._H1)
        return self.fc.forward(self._H2[:, -1, :])

    def backward_and_update(self, dloss: np.ndarray, max_norm: float = 1.0):
        """dloss: MSE gradient (B,)"""
        dh_last = self.fc.backward(dloss)                       # (B, H)

        B, T, H = self._H2.shape
        dH2 = np.zeros((B, T, H), dtype=np.float32)
        dH2[:, -1] = dh_last                                    # only last step used

        dH1, dWx2, dWh2, db2 = self.layer2.backward(dH2, self._cache2)
        _,   dWx1, dWh1, db1 = self.layer1.backward(dH1, self._cache1)

        # Gradient clipping (same as torch clip_grad_norm_ with max_norm=1.0)
        all_grads = [dWx1, dWh1, db1, dWx2, dWh2, db2]
        norm = np.sqrt(sum(np.sum(g ** 2) for g in all_grads))
        if norm > max_norm:
            s = max_norm / (norm + 1e-8)
            dWx1, dWh1, db1, dWx2, dWh2, db2 = [g * s for g in all_grads]

        self.layer1.update(dWx1, dWh1, db1)
        self.layer2.update(dWx2, dWh2, db2)
        self.fc.update()

    def set_lr(self, lr: float):
        self.layer1.set_lr(lr)
        self.layer2.set_lr(lr)
        self.fc.set_lr(lr)

    def get_state(self) -> dict:
        return {
            "input_size":  self.layer1.input_size,
            "hidden_size": self.hidden_size,
            "l1_Wx": self.layer1.Wx, "l1_Wh": self.layer1.Wh, "l1_b": self.layer1.b,
            "l2_Wx": self.layer2.Wx, "l2_Wh": self.layer2.Wh, "l2_b": self.layer2.b,
            "fc_W1": self.fc.W1, "fc_b1": self.fc.b1,
            "fc_W2": self.fc.W2, "fc_b2": self.fc.b2,
        }

    @classmethod
    def from_state(cls, state: dict) -> "_LSTMNet":
        net = cls(input_size=state["input_size"], hidden_size=state["hidden_size"])
        net.layer1.Wx = state["l1_Wx"]; net.layer1.Wh = state["l1_Wh"]; net.layer1.b = state["l1_b"]
        net.layer2.Wx = state["l2_Wx"]; net.layer2.Wh = state["l2_Wh"]; net.layer2.b = state["l2_b"]
        net.fc.W1 = state["fc_W1"]; net.fc.b1 = state["fc_b1"]
        net.fc.W2 = state["fc_W2"]; net.fc.b2 = state["fc_b2"]
        return net


# ── Public model class (same interface as before) ─────────────────────────────

class BTCLSTMModel:
    def __init__(self, data_dir: str = "data/models"):
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.models: dict[str, _LSTMNet] = {}
        self.scalers: dict[str, MinMaxScaler] = {}
        self.price_scalers: dict[str, MinMaxScaler] = {}
        self.is_trained = False

    def _prepare_sequences(
        self,
        df: pd.DataFrame,
        horizon_h: int,
        seq_len: int = SEQUENCE_LEN,
    ) -> tuple:
        df = compute_indicators(df).dropna()
        available = [c for c in FEATURE_COLS if c in df.columns]
        features = df[available].values.astype(np.float32)
        prices   = df["close"].values.astype(np.float32)

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

    def _train_single(self, df: pd.DataFrame, key: str, horizon_h: int,
                      epochs: int, batch_size: int):
        X, y, scaler, price_scaler = self._prepare_sequences(df, horizon_h)
        if len(X) < 50:
            logger.warning(f"Not enough data for LSTM {key}, skipping")
            return

        split = int(len(X) * 0.85)
        X_train, y_train = X[:split], y[:split]

        net = _LSTMNet(input_size=X_train.shape[2])

        # ReduceLROnPlateau state
        best_loss = float("inf")
        wait = 0
        lr = 1e-3
        patience, factor, min_lr = 5, 0.5, 1e-6

        for epoch in range(epochs):
            idx = np.random.permutation(len(X_train))
            total_loss = 0.0
            n_batches = 0

            for start in range(0, len(X_train), batch_size):
                bi = idx[start:start + batch_size]
                xb = X_train[bi]          # (B, T, features)
                yb = y_train[bi]          # (B,)

                pred = net.forward(xb)    # (B,)
                diff = pred - yb
                loss = float(np.mean(diff ** 2))
                dloss = (2.0 * diff / len(yb)).astype(np.float32)

                net.backward_and_update(dloss)
                total_loss += loss
                n_batches += 1

            epoch_loss = total_loss / max(n_batches, 1)

            # ReduceLROnPlateau
            if epoch_loss < best_loss:
                best_loss = epoch_loss
                wait = 0
            else:
                wait += 1
                if wait >= patience:
                    lr = max(lr * factor, min_lr)
                    net.set_lr(lr)
                    wait = 0

        self.models[key]        = net
        self.scalers[key]       = scaler
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

            scaler      = self.scalers[horizon_key]
            price_scaler = self.price_scalers[horizon_key]
            features_scaled = scaler.transform(features)

            x = features_scaled[np.newaxis]               # (1, T, features)
            pred_scaled = float(self.models[horizon_key].forward(x)[0])
            price = price_scaler.inverse_transform([[pred_scaled]])[0][0]
            return float(price)
        except Exception as exc:
            logger.error(f"LSTM predict error ({horizon_key}): {exc}")
            return None

    def save(self):
        for key, net in self.models.items():
            with open(self.data_dir / f"lstm_{key}.pkl", "wb") as f:
                pickle.dump(net.get_state(), f)
            with open(self.data_dir / f"lstm_{key}_scaler.pkl", "wb") as f:
                pickle.dump(self.scalers[key], f)
            with open(self.data_dir / f"lstm_{key}_price_scaler.pkl", "wb") as f:
                pickle.dump(self.price_scalers[key], f)
        logger.info("LSTM models saved")

    def load(self) -> bool:
        loaded = 0
        for key in HORIZON_HOURS:
            model_path  = self.data_dir / f"lstm_{key}.pkl"
            scaler_path = self.data_dir / f"lstm_{key}_scaler.pkl"
            price_path  = self.data_dir / f"lstm_{key}_price_scaler.pkl"
            if not (model_path.exists() and scaler_path.exists() and price_path.exists()):
                continue
            try:
                with open(model_path, "rb") as f:
                    self.models[key] = _LSTMNet.from_state(pickle.load(f))
                with open(scaler_path, "rb") as f:
                    self.scalers[key] = pickle.load(f)
                with open(price_path, "rb") as f:
                    self.price_scalers[key] = pickle.load(f)
                loaded += 1
            except Exception as exc:
                logger.error(f"Failed to load LSTM {key}: {exc}")
        self.is_trained = loaded == len(HORIZON_HOURS)
        logger.info(f"Loaded {loaded}/{len(HORIZON_HOURS)} LSTM models")
        return self.is_trained
