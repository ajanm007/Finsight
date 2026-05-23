"""FinSight API — FastAPI application."""

import asyncio
import json
import logging
import sys
from pathlib import Path

# Add backend dir to path for imports
sys.path.insert(0, str(Path(__file__).resolve().parent))

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

from agent.router import analyze_ticker, analyze_ticker_streaming
from cache.store import (
    get_latest_brief, 
    get_watchlist,
    get_all_briefs,
    get_brief_by_id,
    update_watchlist_item,
    update_watchlist_order
)

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
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
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
async def analyze(request: AnalyzeRequest):
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
        return brief
    except Exception as e:
        logger.error(f"Analysis failed for {ticker}: {e}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@app.get("/brief/{ticker}")
async def get_brief(ticker: str):
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
async def watchlist_list():
    """Get all watchlist tickers with latest brief summaries."""
    return get_watchlist()


@app.post("/watchlist")
async def watchlist_add(request: WatchlistRequest):
    """Add a ticker to the watchlist."""
    ticker = request.ticker.strip().upper()
    if not ticker:
        raise HTTPException(status_code=400, detail="Invalid ticker")
    add_to_watchlist(ticker, request.notes)
    return {"message": f"Added {ticker} to watchlist"}


@app.delete("/watchlist/{ticker}")
async def watchlist_remove(ticker: str):
    """Remove a ticker from the watchlist."""
    remove_from_watchlist(ticker)
    return {"message": f"Removed {ticker} from watchlist"}


@app.patch("/watchlist/{ticker}")
async def watchlist_update(ticker: str, request: WatchlistUpdateRequest):
    """Update notes for a watchlist item."""
    update_watchlist_item(ticker, request.notes)
    return {"message": f"Updated {ticker} notes"}


@app.put("/watchlist/reorder")
async def watchlist_reorder(request: WatchlistReorderRequest):
    """Update the sort order of the watchlist."""
    update_watchlist_order(request.ticker_orders)
    return {"message": "Watchlist reordered"}


# ---------- Brief History Endpoints ----------

@app.get("/briefs/history")
async def briefs_history(limit: int = 50):
    """Get overall history of generated briefs."""
    return get_all_briefs(limit=limit)


@app.get("/briefs/{ticker}/all")
async def ticker_briefs_all(ticker: str, limit: int = 20):
    """Get all briefs for a specific ticker."""
    return get_all_briefs(ticker=ticker, limit=limit)


@app.get("/briefs/id/{brief_id}")
async def brief_by_id(brief_id: int):
    """Get a specific brief by its database ID."""
    brief = get_brief_by_id(brief_id)
    if not brief:
        raise HTTPException(status_code=404, detail="Brief not found")
    return brief


@app.get("/eval/leaderboard")
async def eval_leaderboard():
    """Get aggregate signal quality across all evaluated briefs."""
    from cache.store import get_eval_stats
    return get_eval_stats()


@app.get("/eval/details")
async def eval_details(limit: int = 100):
    """Get detailed history of evaluated signals."""
    from cache.store import get_eval_details
    return get_eval_details(limit=limit)


@app.post("/eval/run")
async def run_evaluation():
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
    
    # Auto-evaluate briefs on startup
    from eval.evaluator import evaluate_pending_briefs
    logger.info("[startup] Running automated signal evaluation...")
    try:
        stats = evaluate_pending_briefs()
        logger.info(f"[startup] Evaluation complete: {stats}")
    except Exception as e:
        logger.error(f"[startup] Automated evaluation failed: {e}")


@app.get("/stream/{ticker}")
async def stream_analysis(ticker: str, refresh: bool = False):
    """
    SSE streaming endpoint — live tool status updates.

    Events:
      - {"type":"status","tool":"...","state":"pending|running|done|failed",...}
      - {"type":"brief","data":{...full brief...}}
      - {"type":"done"}
    """
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
