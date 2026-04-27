import numpy as np
import pandas as pd


def compute_indicators(df: pd.DataFrame) -> pd.DataFrame:
    """
    Expects df with columns: open, high, low, close, volume.
    Returns df with added indicator columns.
    """
    df = df.copy()
    close = df["close"]
    high = df["high"]
    low = df["low"]
    volume = df["volume"]

    # RSI (14-period)
    delta = close.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    avg_gain = gain.ewm(com=13, adjust=False).mean()
    avg_loss = loss.ewm(com=13, adjust=False).mean()
    rs = avg_gain / avg_loss.replace(0, np.nan)
    df["rsi"] = 100 - (100 / (1 + rs))

    # MACD (12/26 EMA, 9-period signal)
    ema12 = close.ewm(span=12, adjust=False).mean()
    ema26 = close.ewm(span=26, adjust=False).mean()
    df["macd"] = ema12 - ema26
    df["macd_signal"] = df["macd"].ewm(span=9, adjust=False).mean()
    df["macd_hist"] = df["macd"] - df["macd_signal"]

    # Bollinger Bands (20-period, 2σ)
    bb_mid = close.rolling(20).mean()
    bb_std = close.rolling(20).std()
    df["bb_upper"] = bb_mid + 2 * bb_std
    df["bb_lower"] = bb_mid - 2 * bb_std
    df["bb_mid"] = bb_mid
    df["bb_pct"] = (close - df["bb_lower"]) / (df["bb_upper"] - df["bb_lower"]).replace(0, np.nan)

    # EMA 50 / 200
    df["ema50"] = close.ewm(span=50, adjust=False).mean()
    df["ema200"] = close.ewm(span=200, adjust=False).mean()

    # OBV (On-Balance Volume)
    obv = [0]
    for i in range(1, len(close)):
        if close.iloc[i] > close.iloc[i - 1]:
            obv.append(obv[-1] + volume.iloc[i])
        elif close.iloc[i] < close.iloc[i - 1]:
            obv.append(obv[-1] - volume.iloc[i])
        else:
            obv.append(obv[-1])
    df["obv"] = obv
    df["obv_ema"] = pd.Series(obv, index=df.index).ewm(span=20, adjust=False).mean()

    # ATR (14-period Average True Range)
    tr = pd.concat([
        high - low,
        (high - close.shift()).abs(),
        (low - close.shift()).abs(),
    ], axis=1).max(axis=1)
    df["atr"] = tr.ewm(com=13, adjust=False).mean()

    return df


def get_indicator_snapshot(df: pd.DataFrame) -> dict:
    """Return the latest indicator values as a dict for the API response."""
    row = df.iloc[-1]
    prev = df.iloc[-2] if len(df) > 1 else row

    close = row["close"]
    ema50 = row.get("ema50", None)
    ema200 = row.get("ema200", None)

    trend = "bullish" if (ema50 and ema200 and ema50 > ema200) else "bearish"
    rsi_val = row.get("rsi", 50)

    return {
        "rsi": {
            "value": round(float(rsi_val), 2),
            "signal": "overbought" if rsi_val > 70 else "oversold" if rsi_val < 30 else "neutral",
        },
        "macd": {
            "macd": round(float(row.get("macd", 0)), 2),
            "signal": round(float(row.get("macd_signal", 0)), 2),
            "histogram": round(float(row.get("macd_hist", 0)), 2),
            "crossover": "bullish" if row.get("macd", 0) > row.get("macd_signal", 0) else "bearish",
        },
        "bollinger_bands": {
            "upper": round(float(row.get("bb_upper", 0)), 2),
            "middle": round(float(row.get("bb_mid", 0)), 2),
            "lower": round(float(row.get("bb_lower", 0)), 2),
            "pct_b": round(float(row.get("bb_pct", 0.5)), 4),
            "bandwidth": round(float((row.get("bb_upper", 0) - row.get("bb_lower", 0)) / row.get("bb_mid", 1)), 4),
        },
        "ema": {
            "ema50": round(float(ema50), 2) if ema50 else None,
            "ema200": round(float(ema200), 2) if ema200 else None,
            "trend": trend,
            "golden_cross": bool(ema50 and ema200 and ema50 > ema200 and prev.get("ema50", 0) <= prev.get("ema200", 1)),
            "death_cross": bool(ema50 and ema200 and ema50 < ema200 and prev.get("ema50", 1) >= prev.get("ema200", 0)),
        },
        "obv": {
            "value": int(row.get("obv", 0)),
            "ema": round(float(row.get("obv_ema", 0)), 0),
            "trend": "accumulation" if row.get("obv", 0) > row.get("obv_ema", 0) else "distribution",
        },
        "atr": {
            "value": round(float(row.get("atr", 0)), 2),
            "pct_of_price": round(float(row.get("atr", 0) / close * 100), 3) if close else 0,
        },
        "price": round(float(close), 2),
        "timestamp": df.index[-1].isoformat() if hasattr(df.index[-1], "isoformat") else str(df.index[-1]),
    }
