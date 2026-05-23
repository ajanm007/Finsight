"""Compute technical indicators from price data."""

import logging
from typing import Any

import pandas as pd
import ta

from cache.store import get_cached, set_cached
from tools.price import fetch_price_data

logger = logging.getLogger(__name__)

SOURCE_NAME = "technicals"


def _interpret_rsi(rsi: float) -> str:
    if rsi >= 70:
        return "overbought"
    elif rsi <= 30:
        return "oversold"
    else:
        return "neutral"


def _interpret_macd(macd: float, signal: float) -> str:
    if macd > signal:
        return "bullish"
    else:
        return "bearish"


def _interpret_price_vs_ma(price: float, ma: float | None, label: str) -> str:
    if ma is None or ma == 0:
        return f"{label} unavailable"
    if price > ma:
        return f"above {label} (bullish)"
    else:
        return f"below {label} (bearish)"


def compute_technicals(ticker: str, force_refresh: bool = False) -> dict[str, Any]:
    """
    Compute RSI, MACD, Bollinger Bands, and moving averages.
    """
    # Check cache
    if not force_refresh:
        cached = get_cached(ticker, SOURCE_NAME)
        if cached is not None:
            logger.info(f"[technicals] Cache hit for {ticker}")
            cached["status"] = "CACHED"
            return cached

    # Get price data
    price_result = fetch_price_data(ticker, period="2y", force_refresh=force_refresh)
    if price_result["status"] == "UNAVAILABLE" or not price_result["data"]:
        return {
            "ticker": ticker.upper(),
            "status": "UNAVAILABLE",
            "error": "No price data available for technical analysis",
        }

    # Build DataFrame
    df = pd.DataFrame(price_result["data"])
    df["close"] = df["close"].astype(float)
    df["high"] = df["high"].astype(float)
    df["low"] = df["low"].astype(float)

    if len(df) < 20:
        return {
            "ticker": ticker.upper(),
            "status": "UNAVAILABLE",
            "error": f"Insufficient data ({len(df)} records, need 20+) for technicals",
        }

    current_price = df["close"].iloc[-1]

    # --- RSI (14-day) ---
    rsi_series = ta.momentum.RSIIndicator(df["close"], window=14).rsi()
    rsi = round(rsi_series.iloc[-1], 2) if not rsi_series.empty else None

    # --- MACD (12/26/9) ---
    macd_indicator = ta.trend.MACD(df["close"], window_slow=26, window_fast=12, window_sign=9)
    macd_val = round(macd_indicator.macd().iloc[-1], 4) if not macd_indicator.macd().empty else None
    macd_signal = round(macd_indicator.macd_signal().iloc[-1], 4) if not macd_indicator.macd_signal().empty else None
    macd_hist = round(macd_indicator.macd_diff().iloc[-1], 4) if not macd_indicator.macd_diff().empty else None

    # --- Bollinger Bands (20-day) ---
    bb = ta.volatility.BollingerBands(df["close"], window=20, window_dev=2)
    bb_upper = round(bb.bollinger_hband().iloc[-1], 2) if not bb.bollinger_hband().empty else None
    bb_lower = round(bb.bollinger_lband().iloc[-1], 2) if not bb.bollinger_lband().empty else None
    bb_middle = round(bb.bollinger_mavg().iloc[-1], 2) if not bb.bollinger_mavg().empty else None

    # --- Moving Averages ---
    ma_50 = round(df["close"].rolling(50).mean().iloc[-1], 2) if len(df) >= 50 else None
    ma_200 = round(df["close"].rolling(200).mean().iloc[-1], 2) if len(df) >= 200 else None

    result = {
        "ticker": ticker.upper(),
        "current_price": current_price,
        "rsi": {
            "value": rsi,
            "interpretation": _interpret_rsi(rsi) if rsi else "unavailable",
        },
        "macd": {
            "macd": macd_val,
            "signal": macd_signal,
            "histogram": macd_hist,
            "interpretation": _interpret_macd(macd_val, macd_signal) if macd_val and macd_signal else "unavailable",
        },
        "bollinger_bands": {
            "upper": bb_upper,
            "middle": bb_middle,
            "lower": bb_lower,
            "price_position": (
                "above upper (overbought)" if current_price > bb_upper
                else "below lower (oversold)" if current_price < bb_lower
                else "within bands (normal)"
            ) if bb_upper and bb_lower else "unavailable",
        },
        "moving_averages": {
            "ma_50": ma_50,
            "ma_200": ma_200,
            "price_vs_50ma": _interpret_price_vs_ma(current_price, ma_50, "50-day MA"),
            "price_vs_200ma": _interpret_price_vs_ma(current_price, ma_200, "200-day MA"),
        },
        "status": "AVAILABLE",
    }

    set_cached(ticker, SOURCE_NAME, result)
    logger.info(f"[technicals] Computed for {ticker}: RSI={rsi}")
    return result
