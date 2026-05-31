"""Fetch retail sentiment from StockTwits (no API key required for public stream)."""

import logging
from typing import Any

import httpx

from cache.store import get_cached, set_cached

logger = logging.getLogger(__name__)

SOURCE_NAME = "stocktwits"


def fetch_stocktwits_sentiment(ticker: str, force_refresh: bool = False) -> dict[str, Any]:
    """Fetch recent StockTwits messages and sentiment for a ticker."""

    if not force_refresh:
        cached = get_cached(ticker, SOURCE_NAME)
        if cached is not None:
            logger.info(f"[stocktwits] Cache hit for {ticker}")
            cached["status"] = "CACHED"
            return cached

    # StockTwits uses plain ticker symbols — strip exchange suffixes
    clean_ticker = ticker.upper()
    for suffix in (".NS", ".BO", ".L", ".TO"):
        if clean_ticker.endswith(suffix):
            clean_ticker = clean_ticker[: -len(suffix)]
            break

    try:
        resp = httpx.get(
            f"https://api.stocktwits.com/api/2/streams/symbol/{clean_ticker}.json",
            params={"limit": 30},
            timeout=10,
            headers={"User-Agent": "FinSight/1.0"},
        )
        resp.raise_for_status()
        data = resp.json()

        messages = []
        bull_count = 0
        bear_count = 0

        for msg in data.get("messages", []):
            sentiment_raw = (msg.get("entities", {}).get("sentiment") or {}).get("basic")
            sentiment = sentiment_raw.lower() if sentiment_raw else "neutral"
            if sentiment == "bullish":
                bull_count += 1
            elif sentiment == "bearish":
                bear_count += 1

            messages.append({
                "body": msg.get("body", "")[:280],
                "sentiment": sentiment,
                "created_at": msg.get("created_at", ""),
                "likes": msg.get("likes", {}).get("total", 0),
            })

        total = len(messages)
        overall = "neutral"
        if total > 0:
            bull_ratio = bull_count / total
            bear_ratio = bear_count / total
            if bull_ratio > 0.55:
                overall = "bullish"
            elif bear_ratio > 0.55:
                overall = "bearish"

        result = {
            "ticker": ticker.upper(),
            "status": "AVAILABLE",
            "message_count": total,
            "bull_count": bull_count,
            "bear_count": bear_count,
            "overall_sentiment": overall,
            "messages": messages[:10],
        }

        set_cached(ticker, SOURCE_NAME, result)
        logger.info(f"[stocktwits] {total} messages for {ticker} — {overall}")
        return result

    except Exception as e:
        logger.error(f"[stocktwits] Error for {ticker}: {e}")
        return {
            "ticker": ticker.upper(),
            "status": "UNAVAILABLE",
            "error": str(e),
        }
