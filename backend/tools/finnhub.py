"""Fetch news, earnings surprises, and insider transactions from Finnhub."""

import logging
import time
from typing import Any

import httpx

from cache.store import get_cached, set_cached
from config import settings

logger = logging.getLogger(__name__)

SOURCE_NAME = "finnhub"


def fetch_finnhub_data(ticker: str, force_refresh: bool = False) -> dict[str, Any]:
    """Fetch company news, latest earnings surprise, and insider sentiment from Finnhub."""

    if not force_refresh:
        cached = get_cached(ticker, SOURCE_NAME)
        if cached is not None:
            logger.info(f"[finnhub] Cache hit for {ticker}")
            cached["status"] = "CACHED"
            return cached

    if not settings.FINNHUB_API_KEY:
        logger.warning("[finnhub] No FINNHUB_API_KEY configured")
        return {
            "ticker": ticker.upper(),
            "status": "UNAVAILABLE",
            "error": "Finnhub API key not configured",
        }

    # Finnhub uses plain US tickers; Indian/other markets have limited coverage
    clean_ticker = ticker.upper()
    for suffix in (".NS", ".BO"):
        if clean_ticker.endswith(suffix):
            clean_ticker = clean_ticker[: -len(suffix)]
            break

    base = "https://finnhub.io/api/v1"
    headers = {"X-Finnhub-Token": settings.FINNHUB_API_KEY}

    try:
        # Company news (last 14 days)
        today = time.strftime("%Y-%m-%d")
        from_date = time.strftime("%Y-%m-%d", time.localtime(time.time() - 14 * 86400))
        news_resp = httpx.get(
            f"{base}/company-news",
            params={"symbol": clean_ticker, "from": from_date, "to": today},
            headers=headers,
            timeout=10,
        )
        news_resp.raise_for_status()
        raw_news = news_resp.json()
        news = [
            {
                "headline": a.get("headline", ""),
                "source": a.get("source", ""),
                "url": a.get("url", ""),
                "summary": (a.get("summary") or "")[:300],
                "datetime": a.get("datetime", 0),
            }
            for a in raw_news[:10]
        ]

        # Earnings surprises
        earnings_resp = httpx.get(
            f"{base}/stock/earnings",
            params={"symbol": clean_ticker, "limit": 4},
            headers=headers,
            timeout=10,
        )
        earnings_resp.raise_for_status()
        raw_earnings = earnings_resp.json()
        earnings = [
            {
                "period": e.get("period", ""),
                "actual": e.get("actual"),
                "estimate": e.get("estimate"),
                "surprise": e.get("surprise"),
                "surprise_percent": e.get("surprisePercent"),
            }
            for e in (raw_earnings if isinstance(raw_earnings, list) else [])[:4]
        ]

        # Insider sentiment (aggregate)
        insider_resp = httpx.get(
            f"{base}/stock/insider-sentiment",
            params={"symbol": clean_ticker, "from": from_date, "to": today},
            headers=headers,
            timeout=10,
        )
        insider_resp.raise_for_status()
        insider_data = insider_resp.json().get("data", [])
        insider_summary = None
        if insider_data:
            latest = insider_data[-1]
            insider_summary = {
                "month": latest.get("month"),
                "change": latest.get("change"),
                "mspr": latest.get("mspr"),  # Monthly share purchase ratio
            }

        result = {
            "ticker": ticker.upper(),
            "status": "AVAILABLE",
            "news": news,
            "news_count": len(news),
            "earnings_surprises": earnings,
            "insider_sentiment": insider_summary,
        }

        set_cached(ticker, SOURCE_NAME, result)
        logger.info(f"[finnhub] Fetched {len(news)} news, {len(earnings)} earnings for {ticker}")
        return result

    except Exception as e:
        logger.error(f"[finnhub] Error for {ticker}: {e}")
        return {
            "ticker": ticker.upper(),
            "status": "UNAVAILABLE",
            "error": str(e),
        }
