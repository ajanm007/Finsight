"""Fetch historical price data via yfinance."""

import logging
from datetime import datetime
from typing import Any

import yfinance as yf

from cache.store import get_cached, set_cached

logger = logging.getLogger(__name__)

SOURCE_NAME = "price"


def fetch_price_data(ticker: str, period: str = "3mo", force_refresh: bool = False) -> dict[str, Any]:
    """
    Fetch OHLCV price data for a ticker.
    """
    # Check cache first
    if not force_refresh:
        cached = get_cached(ticker, SOURCE_NAME)
        if cached is not None:
            logger.info(f"[price] Cache hit for {ticker}")
            cached["status"] = "CACHED"
            return cached

    try:
        stock = yf.Ticker(ticker)
        df = stock.history(period=period)

        if df.empty:
            logger.warning(f"[price] Empty DataFrame for {ticker} — possibly delisted or invalid")
            return {
                "ticker": ticker.upper(),
                "period": period,
                "data": [],
                "current_price": None,
                "status": "UNAVAILABLE",
                "error": "Empty DataFrame — ticker may be invalid or delisted",
            }

        # Convert to list of dicts
        records = []
        for date, row in df.iterrows():
            records.append({
                "date": date.strftime("%Y-%m-%d"),
                "open": round(row["Open"], 2),
                "high": round(row["High"], 2),
                "low": round(row["Low"], 2),
                "close": round(row["Close"], 2),
                "volume": int(row["Volume"]),
            })

        current_price = round(df["Close"].iloc[-1], 2)

        result = {
            "ticker": ticker.upper(),
            "period": period,
            "data": records,
            "current_price": current_price,
            "status": "AVAILABLE",
        }

        # Cache the result
        set_cached(ticker, SOURCE_NAME, result)
        logger.info(f"[price] Fetched {len(records)} records for {ticker}")
        return result

    except Exception as e:
        logger.error(f"[price] Error fetching {ticker}: {e}")
        return {
            "ticker": ticker.upper(),
            "period": period,
            "data": [],
            "current_price": None,
            "status": "UNAVAILABLE",
            "error": str(e),
        }
