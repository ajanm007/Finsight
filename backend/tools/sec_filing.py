"""Fetch SEC EDGAR filings — v1 scoped to MD&A (ITEM 7) only."""

import logging
import re
import time
from typing import Any

import httpx

from cache.store import get_cached, set_cached
from config import settings

logger = logging.getLogger(__name__)

SOURCE_NAME = "sec_filing"

# SEC EDGAR base URLs
EDGAR_COMPANY_SEARCH = "https://efts.sec.gov/LATEST/search-index"
EDGAR_SUBMISSIONS = "https://data.sec.gov/submissions/CIK{cik}.json"
EDGAR_FILING_URL = "https://www.sec.gov/Archives/edgar/data/{cik}/{accession}/{filename}"

# Rate limit: 10 req/sec per SEC guidelines
_last_request_time = 0.0
_MIN_REQUEST_INTERVAL = 0.1  # 100ms between requests

# In-memory cache for the company tickers lookup (refreshed once per process)
_company_tickers_cache: dict | None = None


def _rate_limit():
    """Enforce SEC rate limiting."""
    global _last_request_time
    elapsed = time.time() - _last_request_time
    if elapsed < _MIN_REQUEST_INTERVAL:
        time.sleep(_MIN_REQUEST_INTERVAL - elapsed)
    _last_request_time = time.time()


def _get_headers() -> dict:
    """SEC requires a User-Agent with contact info."""
    return {
        "User-Agent": settings.SEC_USER_AGENT,
        "Accept": "application/json",
    }


def _get_company_tickers() -> dict:
    """Fetch and cache the SEC company tickers JSON (downloaded once per process)."""
    global _company_tickers_cache
    if _company_tickers_cache is not None:
        return _company_tickers_cache
    _rate_limit()
    resp = httpx.get(
        "https://www.sec.gov/files/company_tickers.json",
        headers=_get_headers(),
        timeout=10,
    )
    resp.raise_for_status()
    _company_tickers_cache = resp.json()
    logger.info(f"[sec] Cached company tickers ({len(_company_tickers_cache)} entries)")
    return _company_tickers_cache


def _get_cik(ticker: str) -> str | None:
    """Look up CIK number for a ticker via SEC company tickers JSON."""
    try:
        data = _get_company_tickers()
        for entry in data.values():
            if entry.get("ticker", "").upper() == ticker.upper():
                return str(entry["cik_str"]).zfill(10)
        return None
    except Exception as e:
        logger.error(f"[sec] CIK lookup failed for {ticker}: {e}")
        return None


def _get_recent_filing(cik: str, form_type: str = "10-K") -> dict | None:
    """Get the most recent filing accession number."""
    try:
        _rate_limit()
        resp = httpx.get(
            f"https://data.sec.gov/submissions/CIK{cik}.json",
            headers=_get_headers(),
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()

        recent = data.get("filings", {}).get("recent", {})
        forms = recent.get("form", [])
        accessions = recent.get("accessionNumber", [])
        primary_docs = recent.get("primaryDocument", [])
        filing_dates = recent.get("filingDate", [])

        for i, form in enumerate(forms):
            if form == form_type:
                return {
                    "accession": accessions[i].replace("-", ""),
                    "accession_formatted": accessions[i],
                    "primary_doc": primary_docs[i],
                    "filing_date": filing_dates[i],
                    "cik": cik,
                }

        return None

    except Exception as e:
        logger.error(f"[sec] Filing lookup failed for CIK {cik}: {e}")
        return None


def _extract_mda(html_content: str, form_type: str = "10-K") -> str:
    """
    Extract MD&A section from a filing HTML document.

    10-K: ITEM 7 (Management Discussion & Analysis) → ends at ITEM 7A or ITEM 8
    10-Q: ITEM 2 (MD&A) → ends at ITEM 3 or ITEM 4
    """
    text = re.sub(r"<[^>]+>", " ", html_content)
    text = re.sub(r"\s+", " ", text)

    if form_type == "10-Q":
        start_patterns = [
            r"(?i)ITEM\s*2[\.\s]*[-—–]?\s*MANAGEMENT.?S?\s*DISCUSSION",
            r"(?i)ITEM\s*2[\.\s]+MANAGEMENT",
            r"(?i)ITEM\s+2\b",
        ]
        end_patterns = [r"(?i)ITEM\s*3", r"(?i)ITEM\s*4"]
    else:
        start_patterns = [
            r"(?i)ITEM\s*7[\.\s]*[-—–]?\s*MANAGEMENT.?S?\s*DISCUSSION\s*AND\s*ANALYSIS",
            r"(?i)ITEM\s*7[\.\s]+MANAGEMENT",
            r"(?i)ITEM\s+7\b",
        ]
        end_patterns = [r"(?i)ITEM\s*7A", r"(?i)ITEM\s*8"]

    start_idx = -1
    for pattern in start_patterns:
        match = re.search(pattern, text)
        if match:
            start_idx = match.start()
            break

    if start_idx == -1:
        return ""

    start_pos = int(start_idx)
    end_pos = int(len(text))
    for pattern in end_patterns:
        match = re.search(pattern, text[start_pos + 50:])
        if match:
            candidate = start_pos + 50 + match.start()
            if candidate < end_pos:
                end_pos = candidate

    mda_text = text[start_pos:end_pos].strip()

    if len(mda_text) > 5000:
        mda_text = mda_text[:5000] + "... [truncated]"

    return mda_text


def fetch_sec_filing(ticker: str, form_type: str = "10-K", force_refresh: bool = False) -> dict[str, Any]:
    """
    Fetch SEC filing MD&A section for a ticker.
    Supports 10-K (annual) and 10-Q (quarterly).
    """
    # Use form-type-specific cache key so 10-K and 10-Q don't collide
    cache_key = SOURCE_NAME if form_type == "10-K" else f"sec_{form_type.lower().replace('-', '')}"

    if not force_refresh:
        cached = get_cached(ticker, cache_key)
        if cached is not None:
            logger.info(f"[sec] Cache hit for {ticker} ({form_type})")
            cached["status"] = "CACHED"
            return cached

    # Vector store fallback (only for 10-K to avoid mixing annual/quarterly content)
    if form_type == "10-K":
        try:
            from tools.vector_store import retrieve_from_vector_store
            vector_res = retrieve_from_vector_store(f"{ticker} management discussion analysis", ticker=ticker)
            if vector_res["status"] == "AVAILABLE":
                logger.info(f"[sec] Vector store hit for {ticker}")
                combined_text = "\n".join([r["text"] for r in vector_res["results"]])
                meta = vector_res["results"][0]["metadata"]
                return {
                    "ticker": ticker.upper(),
                    "form_type": form_type,
                    "mda_text": combined_text,
                    "filing_date": meta.get("filing_date"),
                    "status": "CACHED",
                    "source": "vector_store",
                    "_age_seconds": time.time() - meta.get("timestamp", time.time()),
                }
        except Exception as e:
            logger.warning(f"[sec] Vector fallback failed: {e}")

    try:
        cik = _get_cik(ticker)
        if not cik:
            logger.warning(f"[sec] Could not find CIK for {ticker}")
            return {
                "ticker": ticker.upper(),
                "form_type": form_type,
                "mda_text": "",
                "filing_date": None,
                "status": "UNAVAILABLE",
                "error": f"CIK not found for ticker {ticker} — non-US stock?",
            }

        filing = _get_recent_filing(cik, form_type)
        if not filing:
            logger.warning(f"[sec] No {form_type} found for {ticker} (CIK: {cik})")
            return {
                "ticker": ticker.upper(),
                "form_type": form_type,
                "mda_text": "",
                "filing_date": None,
                "status": "UNAVAILABLE",
                "error": f"No {form_type} filing found",
            }

        _rate_limit()
        filing_url = (
            f"https://www.sec.gov/Archives/edgar/data/"
            f"{cik.lstrip('0')}/{filing['accession']}/{filing['primary_doc']}"
        )

        resp = httpx.get(filing_url, headers=_get_headers(), timeout=30)
        resp.raise_for_status()

        mda_text = _extract_mda(resp.text, form_type=form_type)

        if not mda_text:
            logger.warning(f"[sec] Could not extract MD&A from {form_type} for {ticker}")
            return {
                "ticker": ticker.upper(),
                "form_type": form_type,
                "mda_text": "",
                "filing_date": filing["filing_date"],
                "status": "DEGRADED",
                "error": "Filing found but MD&A section could not be extracted",
            }

        result = {
            "ticker": ticker.upper(),
            "form_type": form_type,
            "mda_text": mda_text,
            "filing_date": filing["filing_date"],
            "filing_url": filing_url,
            "status": "AVAILABLE",
        }

        if form_type == "10-K":
            try:
                from tools.vector_store import embed_document
                embed_document(ticker, SOURCE_NAME, mda_text, {"filing_date": filing["filing_date"]})
            except Exception as ve:
                logger.warning(f"[sec] Vector embedding failed (non-critical): {ve}")

        set_cached(ticker, cache_key, result)
        logger.info(f"[sec] Extracted MD&A for {ticker} {form_type} ({len(mda_text)} chars, filed {filing['filing_date']})")
        return result

    except Exception as e:
        logger.error(f"[sec] Error fetching {form_type} for {ticker}: {e}")
        return {
            "ticker": ticker.upper(),
            "form_type": form_type,
            "mda_text": "",
            "filing_date": None,
            "status": "UNAVAILABLE",
            "error": str(e),
        }


def fetch_sec_quarterly(ticker: str, force_refresh: bool = False) -> dict[str, Any]:
    """Fetch the most recent 10-Q quarterly filing MD&A section."""
    return fetch_sec_filing(ticker, form_type="10-Q", force_refresh=force_refresh)
