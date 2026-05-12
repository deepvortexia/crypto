import asyncio
import os
import time
from datetime import datetime, timezone
from typing import Optional

import ccxt.async_support as ccxt_async
import httpx
import pandas as pd

FEAR_GREED_URL = "https://api.alternative.me/fng/?limit=7&format=json"
BLOCKCHAIN_STATS_URL = "https://api.blockchain.info/stats"
BLOCKCHAIN_CHARTS_BASE = "https://api.blockchain.info/charts"

_HTTP_TIMEOUT = 10.0


async def fetch_live_price() -> dict:
    """Current BTC price via CCXT (Coinbase primary, Kraken fallback)."""
    for exchange_cls, symbol in [
        (ccxt_async.coinbase, "BTC/USD"),
        (ccxt_async.kraken, "BTC/USD"),
    ]:
        exchange = exchange_cls()
        try:
            ticker = await exchange.fetch_ticker(symbol)
            return {
                "price": ticker["last"],
                "change_24h_pct": ticker.get("percentage") or 0,
                "market_cap": 0,
                "volume_24h": ticker.get("quoteVolume") or 0,
                "last_updated": int((ticker["timestamp"] or time.time() * 1000) / 1000),
            }
        except Exception:
            pass
        finally:
            await exchange.close()
    raise RuntimeError("All CCXT exchanges failed for live price fetch")


async def _fetch_ohlcv_ccxt(timeframe: str, since_ms: int, total_limit: int) -> list:
    """Fetch OHLCV from Coinbase (primary) with Kraken fallback, paginating as needed."""
    exchanges = [
        (ccxt_async.coinbase, "BTC/USD", 300),
        (ccxt_async.kraken, "BTC/USD", 720),
    ]
    for exchange_cls, symbol, per_call in exchanges:
        exchange = exchange_cls()
        try:
            candles = []
            fetch_since = since_ms
            while len(candles) < total_limit:
                batch = await exchange.fetch_ohlcv(symbol, timeframe, since=fetch_since, limit=per_call)
                if not batch:
                    break
                candles.extend(batch)
                if len(batch) < per_call:
                    break
                fetch_since = batch[-1][0] + 1
            if candles:
                return candles
        except Exception:
            pass
        finally:
            await exchange.close()
    raise RuntimeError("All CCXT exchanges failed for OHLCV fetch")


async def fetch_hourly_ohlcv(days: int = 90) -> pd.DataFrame:
    """Returns hourly OHLCV DataFrame via CCXT (Coinbase primary, Kraken fallback)."""
    since_ms = int((datetime.now(timezone.utc).timestamp() - days * 86400) * 1000)
    candles = await _fetch_ohlcv_ccxt("1h", since_ms, days * 24 + 24)
    df = pd.DataFrame(candles, columns=["timestamp", "open", "high", "low", "close", "volume"])
    df["timestamp"] = pd.to_datetime(df["timestamp"], unit="ms", utc=True)
    df = df.set_index("timestamp").sort_index()
    df = df[~df.index.duplicated(keep="last")]
    return df


async def fetch_daily_ohlcv(days: int = 365) -> pd.DataFrame:
    """Returns daily OHLCV DataFrame via CCXT (Coinbase primary, Kraken fallback)."""
    since_ms = int((datetime.now(timezone.utc).timestamp() - days * 86400) * 1000)
    candles = await _fetch_ohlcv_ccxt("1d", since_ms, days + 5)
    df = pd.DataFrame(candles, columns=["timestamp", "open", "high", "low", "close", "volume"])
    df["timestamp"] = pd.to_datetime(df["timestamp"], unit="ms", utc=True)
    df = df.set_index("timestamp").sort_index()
    df = df[~df.index.duplicated(keep="last")]
    return df


async def fetch_fear_greed() -> dict:
    """Fetch Fear & Greed Index with retry logic and fallback."""
    async with httpx.AsyncClient() as client:
        for attempt in range(3):
            try:
                resp = await client.get(FEAR_GREED_URL, timeout=_HTTP_TIMEOUT)
                resp.raise_for_status()
                data = resp.json()

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
            except Exception as e:
                if attempt == 2:  # Last attempt
                    import logging
                    logging.warning(f"Fear & Greed API failed after 3 attempts: {e}")
                    return {"value": 50, "classification": "Neutral", "history": [], "error": "API unavailable"}
                await asyncio.sleep(2 ** attempt)

    # Fallback if all retries fail
    return {"value": 50, "classification": "Neutral", "history": [], "error": "API unavailable"}


async def fetch_onchain() -> dict:
    """Fetch on-chain metrics with retry logic and safe fallbacks."""
    import logging
    logger = logging.getLogger(__name__)

    async with httpx.AsyncClient() as client:
        # Fetch blockchain.info stats with fallback
        try:
            resp = await client.get(BLOCKCHAIN_STATS_URL, timeout=_HTTP_TIMEOUT)
            resp.raise_for_status()
            stats = resp.json()

        except Exception as e:
            logger.warning(f"Blockchain.com API failed: {e}")
            # Return safe default values instead of error object
            stats = {
                "hash_rate": 0,
                "difficulty": 0,
                "n_blocks_mined": 0,
                "n_btc_mined": 0,
                "n_tx": 0,
                "minutes_between_blocks": 10,
                "market_price_usd": 0,
                "trade_volume_usd": 0,
                "total_btc_sent": 0,
            }

        # Fetch total fees from mempool.space with retry (last 144 blocks ~24h)
        total_fees_btc = None
        for attempt in range(3):
            try:
                fees_data = await client.get(
                    "https://mempool.space/api/v1/mining/reward-stats/144",
                    timeout=_HTTP_TIMEOUT
                )
                fees_data.raise_for_status()
                fees_json = fees_data.json()

                # totalFee is returned as string, need to convert to int
                total_fee_sat = int(fees_json.get("totalFee", 0))
                total_fees_btc = round(total_fee_sat / 100000000, 6) if total_fee_sat else None
                break
            except Exception as e:
                if attempt == 2:
                    logger.warning(f"mempool.space fees API failed after 3 attempts: {e}")
                else:
                    await asyncio.sleep(2 ** attempt)

    return {
        "hash_rate": round(stats.get("hash_rate", 0) / 1e9, 2) if stats.get("hash_rate") else None,
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
