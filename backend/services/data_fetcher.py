import asyncio
import os
import time
from datetime import datetime, timezone
from typing import Optional

import httpx
import pandas as pd

COINGECKO_BASE = "https://api.coingecko.com/api/v3"
FEAR_GREED_URL = "https://api.alternative.me/fng/?limit=7&format=json"
BLOCKCHAIN_STATS_URL = "https://api.blockchain.info/stats"
BLOCKCHAIN_CHARTS_BASE = "https://api.blockchain.info/charts"

_HTTP_TIMEOUT = 20.0
_COINGECKO_KEY = os.getenv("COINGECKO_API_KEY", "")


def _coingecko_headers() -> dict:
    if _COINGECKO_KEY:
        return {"x-cg-demo-api-key": _COINGECKO_KEY}
    return {}


async def _get(client: httpx.AsyncClient, url: str, params: dict = None, retries: int = 3) -> dict:
    for attempt in range(retries):
        try:
            resp = await client.get(url, params=params, headers=_coingecko_headers(), timeout=_HTTP_TIMEOUT)
            if resp.status_code == 429:
                await asyncio.sleep(2 ** attempt)
                continue
            resp.raise_for_status()
            return resp.json()
        except httpx.HTTPError as exc:
            if attempt == retries - 1:
                raise
            await asyncio.sleep(2 ** attempt)
    raise RuntimeError(f"Failed to fetch {url} after {retries} attempts")


async def fetch_live_price() -> dict:
    async with httpx.AsyncClient() as client:
        data = await _get(client, f"{COINGECKO_BASE}/simple/price", {
            "ids": "bitcoin",
            "vs_currencies": "usd",
            "include_24hr_change": "true",
            "include_market_cap": "true",
            "include_24hr_vol": "true",
            "include_last_updated_at": "true",
        })
    btc = data["bitcoin"]
    return {
        "price": btc["usd"],
        "change_24h_pct": btc.get("usd_24h_change", 0),
        "market_cap": btc.get("usd_market_cap", 0),
        "volume_24h": btc.get("usd_24h_vol", 0),
        "last_updated": btc.get("last_updated_at", int(time.time())),
    }


async def fetch_hourly_ohlcv(days: int = 90) -> pd.DataFrame:
    """Returns hourly OHLCV DataFrame (~2160 rows). market_chart is the primary source
    for close price and volume; OHLC enriches with open/high/low where timestamps align."""
    async with httpx.AsyncClient() as client:
        ohlc_raw, chart_raw = await asyncio.gather(
            _get(client, f"{COINGECKO_BASE}/coins/bitcoin/ohlc", {"vs_currency": "usd", "days": 90}),
            _get(client, f"{COINGECKO_BASE}/coins/bitcoin/market_chart", {
                "vs_currency": "usd", "days": 90, "interval": "hourly",
            }),
        )

    # Primary: market_chart gives true hourly close + volume (~2160 rows for 90 days)
    prices = pd.DataFrame(chart_raw["prices"], columns=["timestamp", "close"])
    prices["timestamp"] = pd.to_datetime(prices["timestamp"], unit="ms", utc=True)
    prices = prices.set_index("timestamp").sort_index()

    vols = pd.DataFrame(chart_raw["total_volumes"], columns=["timestamp", "volume"])
    vols["timestamp"] = pd.to_datetime(vols["timestamp"], unit="ms", utc=True)
    vols = vols.set_index("timestamp").sort_index()

    df = prices.join(vols, how="left")

    # Enrich: OHLC endpoint returns coarser candles (4h or daily); left-join then
    # forward-fill so each hourly row inherits the open/high/low of its parent candle.
    ohlc_df = pd.DataFrame(ohlc_raw, columns=["timestamp", "open", "high", "low", "_close"])
    ohlc_df["timestamp"] = pd.to_datetime(ohlc_df["timestamp"], unit="ms", utc=True)
    ohlc_df = ohlc_df.set_index("timestamp").sort_index()[["open", "high", "low"]]

    df = df.join(ohlc_df, how="left")
    df[["open", "high", "low"]] = df[["open", "high", "low"]].ffill()
    # Any leading NaNs (before first OHLC candle) fall back to close
    for col in ["open", "high", "low"]:
        df[col] = df[col].fillna(df["close"])

    return df


async def fetch_daily_ohlcv(days: int = 365) -> pd.DataFrame:
    """Returns daily OHLCV DataFrame."""
    async with httpx.AsyncClient() as client:
        ohlc_raw, chart_raw = await asyncio.gather(
            _get(client, f"{COINGECKO_BASE}/coins/bitcoin/ohlc", {"vs_currency": "usd", "days": days}),
            _get(client, f"{COINGECKO_BASE}/coins/bitcoin/market_chart", {
                "vs_currency": "usd", "days": days, "interval": "daily",
            }),
        )

    ohlc_df = pd.DataFrame(ohlc_raw, columns=["timestamp", "open", "high", "low", "close"])
    ohlc_df["timestamp"] = pd.to_datetime(ohlc_df["timestamp"], unit="ms", utc=True)
    ohlc_df = ohlc_df.set_index("timestamp").sort_index()
    # Deduplicate keeping last per day
    ohlc_df = ohlc_df[~ohlc_df.index.duplicated(keep="last")]

    vols = pd.DataFrame(chart_raw["total_volumes"], columns=["timestamp", "volume"])
    vols["timestamp"] = pd.to_datetime(vols["timestamp"], unit="ms", utc=True)
    vols = vols.set_index("timestamp").sort_index()

    df = ohlc_df.join(vols, how="left").ffill()
    return df


async def fetch_fear_greed() -> dict:
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(FEAR_GREED_URL, timeout=_HTTP_TIMEOUT)
            resp.raise_for_status()
            data = resp.json()
        except Exception:
            return {"value": 50, "classification": "Neutral", "history": []}

    entries = data.get("data", [])
    latest = entries[0] if entries else {}
    history = [
        {
            "value": int(e["value"]),
            "classification": e["value_classification"],
            "timestamp": e["timestamp"],
        }
        for e in entries[:7]
    ]
    return {
        "value": int(latest.get("value", 50)),
        "classification": latest.get("value_classification", "Neutral"),
        "timestamp": latest.get("timestamp"),
        "history": history,
    }


async def fetch_onchain() -> dict:
    async with httpx.AsyncClient() as client:
        try:
            stats = await _get(client, BLOCKCHAIN_STATS_URL)
        except Exception:
            return {"error": "Blockchain.com API unavailable"}

        # Fetch total fees from mempool.space (last 144 blocks ~24h)
        total_fees_btc = None
        try:
            fees_data = await client.get("https://mempool.space/api/v1/mining/reward-stats/144", timeout=_HTTP_TIMEOUT)
            fees_data.raise_for_status()
            fees_json = fees_data.json()
            total_fee_sat = fees_json.get("totalFee", 0)
            total_fees_btc = round(total_fee_sat / 100000000, 6) if total_fee_sat else None
        except Exception:
            pass

    return {
        "hash_rate": round(stats.get("hash_rate", 0) / 1e18, 2),
        "difficulty": stats.get("difficulty", 0),
        "blocks_mined_today": stats.get("n_blocks_mined", 0),
        "btc_mined_today": round(stats.get("n_btc_mined", 0) / 1e8, 4),
        "mempool_size": stats.get("n_tx", 0),
        "total_fees_btc": total_fees_btc,
        "minutes_between_blocks": round(stats.get("minutes_between_blocks", 10), 2),
        "market_price_usd": stats.get("market_price_usd", 0),
        "trade_volume_usd": round(stats.get("trade_volume_usd", 0), 2),
        "total_btc_sent": round(stats.get("total_btc_sent", 0) / 1e8, 2),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
