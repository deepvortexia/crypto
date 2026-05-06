import json
import logging
import os
from datetime import datetime, timezone, timedelta
from email.utils import parsedate_to_datetime

import feedparser
import httpx

logger = logging.getLogger(__name__)

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"
CLAUDE_MODEL = "claude-haiku-4-5-20251001"

RSS_FEEDS = [
    ("CoinTelegraph", "https://cointelegraph.com/rss"),
    ("CoinDesk",      "https://www.coindesk.com/arc/outboundfeeds/rss/"),
    ("Decrypt",       "https://decrypt.co/feed"),
]

MAX_HEADLINES = 15
LOOKBACK_HOURS = 24


def _parse_published(entry) -> datetime | None:
    for attr in ("published", "updated"):
        raw = getattr(entry, attr, None)
        if raw:
            try:
                dt = parsedate_to_datetime(raw)
                return dt.astimezone(timezone.utc)
            except Exception:
                pass
    return None


async def fetch_headlines() -> list[dict]:
    cutoff = datetime.now(timezone.utc) - timedelta(hours=LOOKBACK_HOURS)
    headlines = []

    for source, url in RSS_FEEDS:
        try:
            feed = feedparser.parse(url)
            for entry in feed.entries:
                pub = _parse_published(entry)
                if pub and pub < cutoff:
                    continue  # too old
                title = (entry.get("title") or "").strip()
                if title:
                    headlines.append({"title": title, "source": source, "score": 0.0})
                if len(headlines) >= MAX_HEADLINES:
                    break
        except Exception as exc:
            logger.warning(f"RSS fetch failed for {source}: {exc}")

        if len(headlines) >= MAX_HEADLINES:
            break

    return headlines[:MAX_HEADLINES]


async def score_headlines(headlines: list[dict]) -> dict:
    if not headlines:
        return {"score": 0.0, "label": "Neutral", "headlines": []}

    if not ANTHROPIC_API_KEY:
        logger.warning("ANTHROPIC_API_KEY not set — returning neutral sentiment")
        return {"score": 0.0, "label": "Neutral", "headlines": headlines}

    numbered = "\n".join(f"{i+1}. {h['title']}" for i, h in enumerate(headlines))

    prompt = f"""You are a crypto market sentiment analyst. Score each Bitcoin/crypto headline from -1.0 (very bearish) to +1.0 (very bullish). 0.0 = neutral.

Headlines:
{numbered}

Respond with ONLY a JSON object in this exact format, no other text:
{{
  "scores": [0.3, -0.5, 0.1, ...],
  "aggregate": 0.1
}}

Rules:
- "scores" array must have exactly {len(headlines)} numbers
- Each score is a float between -1.0 and +1.0
- "aggregate" is the weighted average of all scores
- Focus on BTC/crypto price impact, not general news"""

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(
                ANTHROPIC_URL,
                headers={
                    "x-api-key": ANTHROPIC_API_KEY,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": CLAUDE_MODEL,
                    "max_tokens": 256,
                    "messages": [{"role": "user", "content": prompt}],
                },
            )
            resp.raise_for_status()
            content = resp.json()["content"][0]["text"].strip()

            # Strip markdown code fences if present
            if content.startswith("```"):
                content = content.split("```")[1]
                if content.startswith("json"):
                    content = content[4:]

            parsed = json.loads(content)
            scores = parsed.get("scores", [])
            aggregate = float(parsed.get("aggregate", 0.0))

    except Exception as exc:
        logger.error(f"Claude scoring failed: {exc}")
        scores = [0.0] * len(headlines)
        aggregate = 0.0

    scored_headlines = []
    for i, h in enumerate(headlines):
        scored_headlines.append({
            "title": h["title"],
            "source": h["source"],
            "score": round(float(scores[i]) if i < len(scores) else 0.0, 3),
        })

    if aggregate >= 0.15:
        label = "Bullish"
    elif aggregate <= -0.15:
        label = "Bearish"
    else:
        label = "Neutral"

    return {
        "score": round(aggregate, 3),
        "label": label,
        "headlines": scored_headlines,
    }


async def fetch_news_sentiment() -> dict:
    headlines = await fetch_headlines()
    return await score_headlines(headlines)
