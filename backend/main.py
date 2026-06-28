"""FinSight API — FastAPI application."""

import asyncio
import json
import logging
import sys
import time
from pathlib import Path

# Add backend dir to path for imports
sys.path.insert(0, str(Path(__file__).resolve().parent))

import httpx
from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

from agent.router import analyze_ticker, analyze_ticker_streaming
from cache.store import (
    get_latest_brief,
    get_watchlist,
    get_all_briefs,
    get_brief_by_id,
    add_to_watchlist,
    remove_from_watchlist,
    update_watchlist_item,
    update_watchlist_order
)
from tools.price import fetch_price_data
from auth import require_auth, verify_token

# Logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

# App
app = FastAPI(
    title="FinSight Agent",
    description="Autonomous stock intelligence system — Bull vs Bear briefs with conflicting signal detection",
    version="1.0.0",
)

# CORS configuration
from config import settings

# A wildcard origin is invalid together with credentials (the browser rejects it),
# so only enable credentials when explicit origins are configured. Local dev keeps
# the permissive default ("*"); prod sets ALLOWED_ORIGINS via env for credentialed requests.
_cors_wildcard = "*" in settings.ALLOWED_ORIGINS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=not _cors_wildcard,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- Request / Response Models ----------

class AnalyzeRequest(BaseModel):
    ticker: str
    refresh: bool = False


class HealthResponse(BaseModel):
    status: str
    version: str
    llm_provider: str


class WatchlistRequest(BaseModel):
    ticker: str
    notes: str = ""


class WatchlistUpdateRequest(BaseModel):
    notes: str


class WatchlistReorderRequest(BaseModel):
    ticker_orders: list[str]


# ---------- Endpoints ----------

@app.get("/")
async def root():
    return {
        "name": "FinSight Agent",
        "version": "1.0.0",
        "description": "Autonomous stock intelligence — POST /analyze with a ticker",
    }


@app.post("/analyze")
async def analyze(request: AnalyzeRequest, _claims: dict = Depends(require_auth)):
    """
    Main endpoint — runs the full agent pipeline on a ticker.

    Returns a structured Bull vs Bear brief with confidence scoring
    and conflict detection.
    """
    ticker = request.ticker.strip().upper()

    if not ticker or len(ticker) > 10:
        raise HTTPException(status_code=400, detail="Invalid ticker symbol")

    logger.info(f"=== Analyzing {ticker} (refresh={request.refresh}) ===")

    try:
        brief = await analyze_ticker(ticker, force_refresh=request.refresh)
        if isinstance(brief, dict) and brief.get("error") == "invalid_ticker":
            raise HTTPException(status_code=404, detail=brief.get("message"))
        return brief
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Analysis failed for {ticker}: {e}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@app.get("/brief/{ticker}")
async def get_brief(ticker: str, _claims: dict = Depends(require_auth)):
    """Fetch the last cached brief for a ticker."""
    ticker = ticker.strip().upper()
    brief = get_latest_brief(ticker)

    if brief is None:
        raise HTTPException(
            status_code=404,
            detail=f"No brief found for {ticker}. Run POST /analyze first.",
        )

    return brief

@app.get("/health", response_model=HealthResponse)
async def health():
    """Health check + basic info."""
    from config import settings

    return {
        "status": "ok",
        "version": "1.0.0",
        "llm_provider": settings.LLM_PROVIDER,
    }


# ---------- Watchlist Endpoints ----------

@app.get("/watchlist")
async def watchlist_list(_claims: dict = Depends(require_auth)):
    """Get all watchlist tickers with latest brief summaries."""
    return get_watchlist()


@app.post("/watchlist")
async def watchlist_add(request: WatchlistRequest, _claims: dict = Depends(require_auth)):
    """Add a ticker to the watchlist."""
    ticker = request.ticker.strip().upper()
    if not ticker:
        raise HTTPException(status_code=400, detail="Invalid ticker")
    price_result = fetch_price_data(ticker)
    if price_result.get("status") not in ("AVAILABLE", "CACHED"):
        raise HTTPException(status_code=400, detail=f"Ticker '{ticker}' not found on Yahoo Finance. Check the symbol and try again.")
    add_to_watchlist(ticker, request.notes)
    return {"message": f"Added {ticker} to watchlist"}


@app.delete("/watchlist/{ticker}")
async def watchlist_remove(ticker: str, _claims: dict = Depends(require_auth)):
    """Remove a ticker from the watchlist."""
    remove_from_watchlist(ticker)
    return {"message": f"Removed {ticker} from watchlist"}


@app.patch("/watchlist/{ticker}")
async def watchlist_update(ticker: str, request: WatchlistUpdateRequest, _claims: dict = Depends(require_auth)):
    """Update notes for a watchlist item."""
    update_watchlist_item(ticker, request.notes)
    return {"message": f"Updated {ticker} notes"}


@app.put("/watchlist/reorder")
async def watchlist_reorder(request: WatchlistReorderRequest, _claims: dict = Depends(require_auth)):
    """Update the sort order of the watchlist."""
    update_watchlist_order(request.ticker_orders)
    return {"message": "Watchlist reordered"}


# ---------- Brief History Endpoints ----------

@app.get("/briefs/history")
async def briefs_history(limit: int = 50, _claims: dict = Depends(require_auth)):
    """Get overall history of generated briefs."""
    return get_all_briefs(limit=limit)


@app.get("/briefs/{ticker}/all")
async def ticker_briefs_all(ticker: str, limit: int = 20, _claims: dict = Depends(require_auth)):
    """Get all briefs for a specific ticker."""
    return get_all_briefs(ticker=ticker, limit=limit)


@app.get("/briefs/id/{brief_id}")
async def brief_by_id(brief_id: int, _claims: dict = Depends(require_auth)):
    """Get a specific brief by its database ID."""
    brief = get_brief_by_id(brief_id)
    if not brief:
        raise HTTPException(status_code=404, detail="Brief not found")
    return brief


@app.get("/eval/leaderboard")
async def eval_leaderboard(_claims: dict = Depends(require_auth)):
    """Get aggregate signal quality across all evaluated briefs."""
    from cache.store import get_eval_stats
    return get_eval_stats()


@app.get("/eval/details")
async def eval_details(limit: int = 100, _claims: dict = Depends(require_auth)):
    """Get detailed history of evaluated signals."""
    from cache.store import get_eval_details
    return get_eval_details(limit=limit)


@app.post("/eval/run")
async def run_evaluation(_claims: dict = Depends(require_auth)):
    """
    Force an evaluation of ready briefs (5+ days old).
    """
    from eval.evaluator import evaluate_pending_briefs
    stats = evaluate_pending_briefs()
    return {
        "message": "Evaluation job completed.",
        "stats": stats
    }


@app.on_event("startup")
async def startup_event():
    """Run automated tasks on server startup."""
    logger.info("=== FinSight Backend Initializing ===")

    # Pre-warm FinBERT in a background thread so first analysis request doesn't pay the load cost
    import asyncio
    loop = asyncio.get_running_loop()
    loop.run_in_executor(None, _prewarm_finbert)

    # Auto-evaluate briefs on startup
    from eval.evaluator import evaluate_pending_briefs
    logger.info("[startup] Running automated signal evaluation...")
    try:
        stats = evaluate_pending_briefs()
        logger.info(f"[startup] Evaluation complete: {stats}")
    except Exception as e:
        logger.error(f"[startup] Automated evaluation failed: {e}")


def _prewarm_finbert():
    from tools.sentiment import prewarm
    prewarm()


# ---------- Symbol Search Endpoint ----------

# In-memory cache: query_lower -> (results, timestamp)
_search_cache: dict = {}
_SEARCH_CACHE_TTL = 3600  # 1 hour — ticker symbols don't change often


@app.get("/search")
async def search_symbols(q: str = Query(default="", max_length=50), _claims: dict = Depends(require_auth)):
    """
    Symbol search — returns up to 8 Finnhub matches for a query string.
    Used by the frontend autocomplete dropdown. Results are cached in-memory
    for 1 hour so repeated keystrokes don't hammer the Finnhub quota.
    """
    q = q.strip()
    if len(q) < 2:
        return {"results": []}

    q_lower = q.lower()
    now = time.time()
    if q_lower in _search_cache:
        results, ts = _search_cache[q_lower]
        if now - ts < _SEARCH_CACHE_TTL:
            return {"results": results}

    if not settings.FINNHUB_API_KEY:
        return {"results": []}

    try:
        resp = httpx.get(
            "https://finnhub.io/api/v1/search",
            params={"q": q, "token": settings.FINNHUB_API_KEY},
            timeout=5,
        )
        resp.raise_for_status()
        raw = resp.json().get("result", [])
        results = [
            {
                "symbol": r["symbol"],
                "description": r.get("description", ""),
                "type": r.get("type", ""),
            }
            for r in raw[:8]
            if r.get("symbol")
        ]
        _search_cache[q_lower] = (results, now)
        return {"results": results}
    except Exception as exc:
        logger.warning(f"[search] Finnhub symbol search failed: {exc}")
        return {"results": []}


@app.get("/stream/{ticker}")
async def stream_analysis(ticker: str, refresh: bool = False, token: str | None = None):
    """
    SSE streaming endpoint — live tool status updates.

    EventSource can't send Authorization headers, so the Supabase access token is
    passed as a `?token=` query param and verified manually (same fail-closed rules
    as the header dependency).

    Events:
      - {"type":"status","tool":"...","state":"pending|running|done|failed",...}
      - {"type":"brief","data":{...full brief...}}
      - {"type":"done"}
    """
    verify_token(token)

    ticker = ticker.strip().upper()

    if not ticker or len(ticker) > 10:
        raise HTTPException(status_code=400, detail="Invalid ticker symbol")

    logger.info(f"=== Streaming analysis for {ticker} ===")

    queue: asyncio.Queue = asyncio.Queue()  # type: ignore[type-arg]

    async def event_generator():
        # Spawn the analysis pipeline as a background task
        task = asyncio.create_task(analyze_ticker_streaming(ticker, queue, force_refresh=refresh))

        try:
            while True:
                event = await queue.get()
                event_type = str(event.get("type", "status"))
                yield {
                    "event": event_type,
                    "data": json.dumps(event),
                }

                if event_type == "done":
                    break
        except asyncio.CancelledError:
            task.cancel()
            raise

    return EventSourceResponse(event_generator())
