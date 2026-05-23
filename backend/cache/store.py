"""SQLite cache with TTL enforcement.

Sync sqlite3 — cache reads/writes happen before and after
the parallel fetch, not during. No need for async.
"""

import json
import logging
import sqlite3
import time
from pathlib import Path
from typing import Optional

from config import CACHE_TTL, settings

logger = logging.getLogger(__name__)


def _get_db() -> sqlite3.Connection:
    """Get or create the SQLite connection."""
    db_path = Path(settings.DB_PATH)
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    conn.execute("""
        CREATE TABLE IF NOT EXISTS cache (
            ticker TEXT NOT NULL,
            source TEXT NOT NULL,
            data TEXT NOT NULL,
            cached_at REAL NOT NULL,
            PRIMARY KEY (ticker, source)
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS briefs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ticker TEXT NOT NULL,
            brief_data TEXT NOT NULL,
            confidence REAL,
            net_signal TEXT,
            price_at_brief REAL,
            sources_snapshot TEXT,
            created_at REAL NOT NULL,
            eval_status TEXT DEFAULT 'pending',
            price_5d_later REAL,
            is_correct INTEGER
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS watchlist (
            ticker TEXT PRIMARY KEY,
            added_at REAL NOT NULL,
            notes TEXT DEFAULT '',
            sort_order INTEGER DEFAULT 0
        )
    """)
    
    # Simple migration: add columns if they don't exist
    cursor = conn.execute("PRAGMA table_info(briefs)")
    columns = [row["name"] for row in cursor.fetchall()]
    
    if "eval_status" not in columns:
        conn.execute("ALTER TABLE briefs ADD COLUMN eval_status TEXT DEFAULT 'pending'")
    if "price_5d_later" not in columns:
        conn.execute("ALTER TABLE briefs ADD COLUMN price_5d_later REAL")
    if "is_correct" not in columns:
        conn.execute("ALTER TABLE briefs ADD COLUMN is_correct INTEGER")
        
    # Watchlist migrations
    cursor = conn.execute("PRAGMA table_info(watchlist)")
    watchlist_columns = [row["name"] for row in cursor.fetchall()]
    if "sort_order" not in watchlist_columns:
        conn.execute("ALTER TABLE watchlist ADD COLUMN sort_order INTEGER DEFAULT 0")

    conn.commit()
    return conn


def get_cached(ticker: str, source: str) -> Optional[dict]:
    """Return cached data if within TTL, else None."""
    ttl = CACHE_TTL.get(source)
    if ttl is None:
        return None

    conn = _get_db()
    try:
        row = conn.execute(
            "SELECT data, cached_at FROM cache WHERE ticker = ? AND source = ?",
            (ticker.upper(), source),
        ).fetchone()

        if row is None:
            return None

        age = time.time() - row["cached_at"]
        if age > ttl:
            return None  # expired

        data = json.loads(row["data"])
        data["_cached"] = True
        data["_cached_at"] = row["cached_at"]
        data["_age_seconds"] = age
        return data
    finally:
        conn.close()


def set_cached(ticker: str, source: str, data: dict) -> None:
    """Store data with current timestamp."""
    conn = _get_db()
    try:
        conn.execute(
            """INSERT OR REPLACE INTO cache (ticker, source, data, cached_at)
               VALUES (?, ?, ?, ?)""",
            (ticker.upper(), source, json.dumps(data), time.time()),
        )
        conn.commit()
    finally:
        conn.close()


def save_brief(ticker: str, brief: dict) -> int:
    """Save a generated brief to the database. Returns the brief ID."""
    conn = _get_db()
    try:
        # Extract fields from the brief dict
        brief_text = brief.get("brief_text", "")
        confidence_data = brief.get("confidence", {})
        model_confidence = confidence_data.get("model_confidence", 0)
        net_signal = brief.get("net_signal", "neutral")
        current_price = brief.get("current_price", 0)
        sources_snapshot = brief.get("data_availability", {})
        created_at = brief.get("created_at", time.time())

        cursor = conn.execute(
            """INSERT INTO briefs
               (ticker, brief_data, confidence, net_signal, price_at_brief,
                sources_snapshot, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (
                ticker.upper(),
                json.dumps(brief), # Store the WHOLE dict here
                model_confidence,
                net_signal,
                current_price,
                json.dumps(sources_snapshot),
                created_at,
            ),
        )
        conn.commit()
        return cursor.lastrowid or 0
    except Exception as e:
        logger.error(f"[store] Failed to save brief: {e}")
        return 0
    finally:
        conn.close()


def get_latest_brief(ticker: str) -> Optional[dict]:
    """Get the most recent brief for a ticker."""
    conn = _get_db()
    try:
        row = conn.execute(
            """SELECT brief_data, confidence, net_signal, price_at_brief,
                      sources_snapshot, created_at
               FROM briefs WHERE ticker = ? ORDER BY created_at DESC LIMIT 1""",
            (ticker.upper(),),
        ).fetchone()

        if row is None:
            return None

        return {
            "ticker": ticker.upper(),
            "brief": json.loads(row["brief_data"]),
            "confidence": row["confidence"],
            "net_signal": row["net_signal"],
            "price_at_brief": row["price_at_brief"],
            "sources_snapshot": json.loads(row["sources_snapshot"]),
            "created_at": row["created_at"],
        }
    finally:
        conn.close()


def get_pending_evals() -> list[dict]:
    """Get briefs that need evaluation."""
    conn = _get_db()
    try:
        cursor = conn.execute(
            """SELECT id, ticker, net_signal, price_at_brief, created_at 
               FROM briefs 
               WHERE eval_status = 'pending'"""
        )
        return [dict(row) for row in cursor.fetchall()]
    finally:
        conn.close()


def update_brief_eval(brief_id: int, price_5d_later: float, is_correct: int, eval_status: str) -> None:
    """Update a brief with its evaluation result."""
    conn = _get_db()
    try:
        conn.execute(
            """UPDATE briefs 
               SET price_5d_later = ?, is_correct = ?, eval_status = ? 
               WHERE id = ?""",
            (price_5d_later, is_correct, eval_status, brief_id)
        )
        conn.commit()
    finally:
        conn.close()


def get_eval_stats() -> dict:
    """Get aggregate statistics for the eval leaderboard including per-ticker breakdown."""
    conn = _get_db()
    try:
        # Total generated
        total = conn.execute("SELECT COUNT(*) as count FROM briefs").fetchone()["count"]
        
        # Evaluated vs Skipped
        evaluated = conn.execute("SELECT COUNT(*) as count FROM briefs WHERE eval_status = 'evaluated'").fetchone()["count"]
        skipped = conn.execute("SELECT COUNT(*) as count FROM briefs WHERE eval_status = 'skipped'").fetchone()["count"]
        pending = conn.execute("SELECT COUNT(*) as count FROM briefs WHERE eval_status = 'pending'").fetchone()["count"]
        
        # Correct vs Incorrect (exclude skipped)
        correct = conn.execute("SELECT COUNT(*) as count FROM briefs WHERE is_correct = 1").fetchone()["count"]
        incorrect = conn.execute("SELECT COUNT(*) as count FROM briefs WHERE is_correct = 0").fetchone()["count"]
        
        accuracy = 0.0
        if (correct + incorrect) > 0:
            accuracy = round((correct / (correct + incorrect)) * 100, 2)
            
        # Per-ticker accuracy
        ticker_stats = conn.execute("""
            SELECT ticker, 
                   COUNT(*) as total_signals,
                   SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) as correct,
                   SUM(CASE WHEN is_correct = 0 THEN 1 ELSE 0 END) as incorrect,
                   SUM(CASE WHEN eval_status = 'pending' THEN 1 ELSE 0 END) as pending
            FROM briefs
            GROUP BY ticker
            ORDER BY total_signals DESC
        """).fetchall()
        
        tickers = []
        for row in ticker_stats:
            r = dict(row)
            total_eval = r["correct"] + r["incorrect"]
            r["accuracy"] = round((r["correct"] / total_eval * 100), 2) if total_eval > 0 else 0
            tickers.append(r)
            
        return {
            "summary": {
                "total_briefs": total,
                "total_evaluated": evaluated,
                "total_skipped": skipped,
                "total_pending": pending,
                "accuracy_pct": accuracy,
                "correct": correct,
                "incorrect": incorrect
            },
            "tickers": tickers
        }
    finally:
        conn.close()


def get_eval_details(limit: int = 100) -> list[dict]:
    """Get a detailed list of evaluated briefs for the history feed."""
    conn = _get_db()
    try:
        cursor = conn.execute("""
            SELECT id, ticker, net_signal, price_at_brief, price_5d_later, 
                   is_correct, eval_status, created_at
            FROM briefs
            ORDER BY created_at DESC
            LIMIT ?
        """, (limit,))
        return [dict(row) for row in cursor.fetchall()]
    finally:
        conn.close()


# ---------- Watchlist & History Functions ----------

def add_to_watchlist(ticker: str, notes: str = "") -> None:
    """Add a ticker to the watchlist."""
    conn = _get_db()
    try:
        # Get current max sort_order
        max_order = conn.execute("SELECT MAX(sort_order) FROM watchlist").fetchone()[0] or 0
        conn.execute(
            "INSERT OR REPLACE INTO watchlist (ticker, added_at, notes, sort_order) VALUES (?, ?, ?, ?)",
            (ticker.upper(), time.time(), notes, max_order + 1),
        )
        conn.commit()
    finally:
        conn.close()


def remove_from_watchlist(ticker: str) -> None:
    """Remove a ticker from the watchlist."""
    conn = _get_db()
    try:
        conn.execute("DELETE FROM watchlist WHERE ticker = ?", (ticker.upper(),))
        conn.commit()
    finally:
        conn.close()


def update_watchlist_item(ticker: str, notes: str) -> None:
    """Update notes for a watchlist item."""
    conn = _get_db()
    try:
        conn.execute(
            "UPDATE watchlist SET notes = ? WHERE ticker = ?",
            (notes, ticker.upper())
        )
        conn.commit()
    finally:
        conn.close()


def update_watchlist_order(ticker_orders: list[str]) -> None:
    """Update the sort order of tickers based on their position in the list."""
    conn = _get_db()
    try:
        for idx, ticker in enumerate(ticker_orders):
            conn.execute(
                "UPDATE watchlist SET sort_order = ? WHERE ticker = ?",
                (idx, ticker.upper())
            )
        conn.commit()
    finally:
        conn.close()


def get_watchlist() -> list[dict]:
    """Get all watchlist items with their latest brief data."""
    conn = _get_db()
    try:
        # Join watchlist with latest brief summary
        cursor = conn.execute("""
            SELECT w.ticker, w.added_at, w.notes, w.sort_order,
                   b.net_signal, b.confidence, b.price_at_brief, b.created_at as last_analyzed
            FROM watchlist w
            LEFT JOIN (
                SELECT ticker, net_signal, confidence, price_at_brief, created_at,
                       ROW_NUMBER() OVER (PARTITION BY ticker ORDER BY created_at DESC) as rn
                FROM briefs
            ) b ON w.ticker = b.ticker AND b.rn = 1
            ORDER BY w.sort_order ASC, w.added_at DESC
        """)
        return [dict(row) for row in cursor.fetchall()]
    finally:
        conn.close()


def get_all_briefs(ticker: Optional[str] = None, limit: int = 50) -> list[dict]:
    """Get a history of briefs, optionally filtered by ticker."""
    conn = _get_db()
    try:
        query = """
            SELECT id, ticker, net_signal, confidence, price_at_brief, created_at, brief_data
            FROM briefs
        """
        params = []
        if ticker:
            query += " WHERE ticker = ?"
            params.append(ticker.upper())
        
        query += " ORDER BY created_at DESC LIMIT ?"
        params.append(limit)
        
        cursor = conn.execute(query, params)
        results = []
        for row in cursor.fetchall():
            item = dict(row)
            # Full brief data is stored as a JSON string, parse it
            if item.get("brief_data"):
                item["brief_data"] = json.loads(item["brief_data"])
            results.append(item)
        return results
    finally:
        conn.close()


def get_brief_by_id(brief_id: int) -> Optional[dict]:
    """Get a specific brief by its ID."""
    conn = _get_db()
    try:
        row = conn.execute(
            "SELECT * FROM briefs WHERE id = ?", (brief_id,)
        ).fetchone()
        if row:
            item = dict(row)
            if item.get("brief_data"):
                item["brief_data"] = json.loads(item["brief_data"])
            if item.get("sources_snapshot"):
                item["sources_snapshot"] = json.loads(item["sources_snapshot"])
            return item
        return None
    finally:
        conn.close()
