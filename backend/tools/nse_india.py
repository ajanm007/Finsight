"""Fetch India-specific stock metrics using nsepython."""

import logging
from typing import Any

from nsepython import nse_quote

from cache.store import get_cached, set_cached

SOURCE_NAME_CORP = "nse_corporate"

logger = logging.getLogger(__name__)

SOURCE_NAME = "nse_india"

def fetch_nse_quote_data(ticker: str, force_refresh: bool = False) -> dict[str, Any]:
    """Fetch live data and delivery percentage for an Indian stock from the NSE."""
    
    # Check cache
    if not force_refresh:
        cached = get_cached(ticker, SOURCE_NAME)
        if cached is not None:
            logger.info(f"[nse] Cache hit for {ticker}")
            cached["status"] = "CACHED"
            return cached

    # Strip .NS if present because nsepython only expects the bare symbol
    symbol = ticker.upper()
    if symbol.endswith(".NS"):
        symbol = symbol[:-3]
    elif symbol.endswith(".BO"):
        # nsepython fetches NSE data. If it's BSE, we could technically skip or try to fetch NSE equivalent.
        # Most dual-listed BSE stocks trade on NSE. We'll try fetching NSE equivalent.
        symbol = symbol[:-3]

    try:
        # nse_quote returns a dict with comprehensive data. 
        # For simplicity we extract price info and delivery volumes.
        quote = nse_quote(symbol)
        
        # Checking if data is valid
        if not quote or "priceInfo" not in quote:
            logger.warning(f"[nse] Could not retrieve quote for {symbol}")
            return {
                "ticker": ticker.upper(),
                "status": "UNAVAILABLE",
                "error": f"Invalid data retrieved for {symbol}"
            }
        
        price_info = quote.get("priceInfo", {})
        security_info = quote.get("securityInfo", {})
        
        # In recent NSE API formats, 'securityWiseDP' holds delivery info.
        delivery_data = quote.get("securityWiseDP", {})

        result = {
            "ticker": ticker.upper(),
            "status": "AVAILABLE",
            "last_price": price_info.get("lastPrice"),
            "vwap": price_info.get("vwap"),
            "lower_circuit": price_info.get("lowerCP"),
            "upper_circuit": price_info.get("upperCP"),
            "week_high_52": price_info.get("weekHigh"),
            "week_low_52": price_info.get("weekLow"),
            "delivery_to_traded_quantity": delivery_data.get("deliveryToTradedQuantity"),
            "delivery_quantity": delivery_data.get("deliveryQuantity"),
            "total_traded_volume": price_info.get("totalTradedVolume"),
            "mac": security_info.get("mac") # Market status/category
        }
        
        set_cached(ticker, SOURCE_NAME, result)
        logger.info(f"[nse] Extracted NSE data for {ticker} (Last: {result['last_price']}, Delivery: {result['delivery_to_traded_quantity']}%)")
        return result

    except Exception as e:
        logger.error(f"[nse] Error fetching NSE data for {ticker}: {e}")
        return {
            "ticker": ticker.upper(),
            "status": "UNAVAILABLE",
            "error": str(e),
        }


def fetch_nse_corporate_actions(ticker: str, force_refresh: bool = False) -> dict[str, Any]:
    """Fetch upcoming board meetings, results calendar, and recent filings for an Indian stock."""

    if not force_refresh:
        cached = get_cached(ticker, SOURCE_NAME_CORP)
        if cached is not None:
            logger.info(f"[nse_corp] Cache hit for {ticker}")
            cached["status"] = "CACHED"
            return cached

    symbol = ticker.upper()
    for suffix in (".NS", ".BO"):
        if symbol.endswith(suffix):
            symbol = symbol[:-3]
            break

    try:
        from nsepython import nse_events, nse_results

        # Upcoming board meetings / corporate events
        upcoming_events = []
        try:
            events_df = nse_events()
            if events_df is not None and not events_df.empty:
                ticker_events = events_df[events_df["symbol"].str.upper() == symbol]
                for _, row in ticker_events.iterrows():
                    upcoming_events.append({
                        "date": row.get("date", ""),
                        "purpose": row.get("purpose", ""),
                        "description": str(row.get("bm_desc", ""))[:400],
                    })
        except Exception as e:
            logger.warning(f"[nse_corp] events fetch failed: {e}")

        # Recent quarterly results filings
        recent_results = []
        try:
            results_df = nse_results("equities", "Quarterly")
            if results_df is not None and not results_df.empty:
                ticker_results = results_df[results_df["symbol"].str.upper() == symbol]
                for _, row in ticker_results.head(4).iterrows():
                    recent_results.append({
                        "period": row.get("relatingTo", ""),
                        "financial_year": row.get("financialYear", ""),
                        "filing_date": row.get("filingDate", ""),
                        "audited": row.get("audited", ""),
                        "consolidated": row.get("consolidated", ""),
                    })
        except Exception as e:
            logger.warning(f"[nse_corp] results fetch failed: {e}")

        result = {
            "ticker": ticker.upper(),
            "status": "AVAILABLE",
            "upcoming_events": upcoming_events,
            "recent_results": recent_results,
            "has_upcoming_events": len(upcoming_events) > 0,
        }

        set_cached(ticker, SOURCE_NAME_CORP, result)
        logger.info(f"[nse_corp] {len(upcoming_events)} events, {len(recent_results)} results for {ticker}")
        return result

    except Exception as e:
        logger.error(f"[nse_corp] Error for {ticker}: {e}")
        return {
            "ticker": ticker.upper(),
            "status": "UNAVAILABLE",
            "error": str(e),
        }
