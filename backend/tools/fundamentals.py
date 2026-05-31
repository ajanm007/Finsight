"""Fetch fundamental data via yfinance — P/E, EPS, revenue growth, analyst targets."""

import logging
from typing import Any

import yfinance as yf

from cache.store import get_cached, set_cached

logger = logging.getLogger(__name__)

SOURCE_NAME = "fundamentals"


def fetch_fundamentals(ticker: str, force_refresh: bool = False) -> dict[str, Any]:
    """Fetch key fundamental metrics for a ticker via yfinance."""
    if not force_refresh:
        cached = get_cached(ticker, SOURCE_NAME)
        if cached is not None:
            logger.info(f"[fund] Cache hit for {ticker}")
            cached["status"] = "CACHED"
            return cached

    try:
        stock = yf.Ticker(ticker)
        info = stock.info

        # Detect completely empty response (indices, invalid tickers)
        has_price = any(info.get(k) for k in ("regularMarketPrice", "currentPrice", "previousClose"))
        if not info or not has_price:
            return {
                "ticker": ticker.upper(),
                "status": "UNAVAILABLE",
                "error": "No fundamental data — ticker may be an index or invalid",
            }

        # Quarterly revenue (last 4 quarters)
        quarterly_revenue = None
        try:
            qf = stock.quarterly_financials
            if qf is not None and not qf.empty and "Total Revenue" in qf.index:
                rev_row = qf.loc["Total Revenue"].dropna()
                quarterly_revenue = [
                    {"period": str(col.date()), "revenue": int(val)}
                    for col, val in rev_row.items()
                ][:4]
        except Exception:
            pass

        # Quarterly EPS history
        quarterly_earnings = None
        try:
            eh = stock.earnings_history
            if eh is not None and not eh.empty:
                cols = [c for c in ("epsActual", "epsEstimate", "surprisePercent") if c in eh.columns]
                quarterly_earnings = eh.tail(4)[cols].to_dict(orient="records")
        except Exception:
            pass

        result = {
            "ticker": ticker.upper(),
            "status": "AVAILABLE",
            # Valuation
            "market_cap": info.get("marketCap"),
            "pe_ratio": info.get("trailingPE"),
            "forward_pe": info.get("forwardPE"),
            "price_to_book": info.get("priceToBook"),
            # Profitability
            "eps_ttm": info.get("trailingEps"),
            "eps_forward": info.get("forwardEps"),
            "profit_margin": info.get("profitMargins"),
            "return_on_equity": info.get("returnOnEquity"),
            # Growth
            "revenue_growth": info.get("revenueGrowth"),
            "earnings_growth": info.get("earningsGrowth"),
            "earnings_quarterly_growth": info.get("earningsQuarterlyGrowth"),
            # Dividends
            "dividend_yield": info.get("dividendYield"),
            # Analyst consensus
            "analyst_target_price": info.get("targetMeanPrice"),
            "analyst_low_target": info.get("targetLowPrice"),
            "analyst_high_target": info.get("targetHighPrice"),
            "recommendation": info.get("recommendationKey"),
            "num_analysts": info.get("numberOfAnalystOpinions"),
            # Debt / liquidity
            "debt_to_equity": info.get("debtToEquity"),
            "current_ratio": info.get("currentRatio"),
            # Short interest
            "short_ratio": info.get("shortRatio"),
            "short_percent_float": info.get("shortPercentOfFloat"),
            # Quarterly breakdowns
            "quarterly_revenue": quarterly_revenue,
            "quarterly_earnings": quarterly_earnings,
        }

        set_cached(ticker, SOURCE_NAME, result)
        logger.info(
            f"[fund] Fetched fundamentals for {ticker} "
            f"(P/E: {result.get('pe_ratio')}, target: {result.get('analyst_target_price')}, "
            f"rec: {result.get('recommendation')})"
        )
        return result

    except Exception as e:
        logger.error(f"[fund] Error fetching fundamentals for {ticker}: {e}")
        return {
            "ticker": ticker.upper(),
            "status": "UNAVAILABLE",
            "error": str(e),
        }
