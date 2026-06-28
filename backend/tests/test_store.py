"""Tests for cache/store.py — SQLite cache, briefs, and watchlist.

No mocking: _get_db() reads settings.DB_PATH on every call, so we point it at a
fresh temp file per test and exercise real round-trips. CACHE_TTL is patched so
expiry is deterministic without sleeping.
"""

import sys
import time
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import config
import cache.store as store


@pytest.fixture
def db(tmp_path, monkeypatch):
    """Fresh SQLite file per test."""
    db_file = tmp_path / "test.db"
    monkeypatch.setattr(config.settings, "DB_PATH", str(db_file))
    # store.py imported `settings` by reference, so patching the attr is enough.
    return db_file


class TestCache:
    def test_set_then_get_roundtrip(self, db, monkeypatch):
        monkeypatch.setattr(store, "CACHE_TTL", {"fetch_news": 3600})
        store.set_cached("aapl", "fetch_news", {"articles": [1, 2]})
        got = store.get_cached("AAPL", "fetch_news")  # case-insensitive
        assert got["articles"] == [1, 2]
        assert got["_cached"] is True

    def test_unknown_source_returns_none(self, db, monkeypatch):
        monkeypatch.setattr(store, "CACHE_TTL", {})
        store.set_cached("AAPL", "mystery", {"x": 1})
        assert store.get_cached("AAPL", "mystery") is None

    def test_expired_entry_returns_none(self, db, monkeypatch):
        monkeypatch.setattr(store, "CACHE_TTL", {"fetch_news": 10})
        store.set_cached("AAPL", "fetch_news", {"x": 1})
        # Force the stored timestamp to be old.
        conn = store._get_db()
        conn.execute("UPDATE cache SET cached_at = ?", (time.time() - 999,))
        conn.commit()
        conn.close()
        assert store.get_cached("AAPL", "fetch_news") is None

    def test_miss_returns_none(self, db, monkeypatch):
        monkeypatch.setattr(store, "CACHE_TTL", {"fetch_news": 3600})
        assert store.get_cached("TSLA", "fetch_news") is None


def _brief(net_signal="mildly_bullish", price=100.0):
    return {
        "brief_text": "BULL CASE\n- up",
        "confidence": {"model_confidence": 65},
        "net_signal": net_signal,
        "current_price": price,
        "data_availability": {"fetch_news": {"status": "AVAILABLE"}},
        "created_at": time.time(),
    }


class TestBriefs:
    def test_save_returns_id_and_latest_roundtrips(self, db):
        bid = store.save_brief("aapl", _brief())
        assert bid > 0
        latest = store.get_latest_brief("AAPL")
        assert latest["net_signal"] == "mildly_bullish"
        assert latest["price_at_brief"] == 100.0
        assert latest["brief"]["brief_text"] == "BULL CASE\n- up"

    def test_latest_returns_most_recent(self, db):
        store.save_brief("AAPL", _brief(price=100.0))
        time.sleep(0.01)
        store.save_brief("AAPL", _brief(price=200.0))
        assert store.get_latest_brief("AAPL")["price_at_brief"] == 200.0

    def test_get_by_id(self, db):
        bid = store.save_brief("AAPL", _brief())
        assert store.get_brief_by_id(bid)["ticker"] == "AAPL"
        assert store.get_brief_by_id(99999) is None

    def test_pending_evals_then_update(self, db):
        bid = store.save_brief("AAPL", _brief())
        pending = store.get_pending_evals()
        assert len(pending) == 1 and pending[0]["id"] == bid

        store.update_brief_eval(bid, price_5d_later=110.0, is_correct=1, eval_status="evaluated")
        assert store.get_pending_evals() == []

    def test_eval_stats_accuracy_math(self, db):
        b1 = store.save_brief("AAPL", _brief())
        b2 = store.save_brief("AAPL", _brief())
        b3 = store.save_brief("MSFT", _brief())
        store.update_brief_eval(b1, 110.0, 1, "evaluated")
        store.update_brief_eval(b2, 90.0, 0, "evaluated")
        store.update_brief_eval(b3, 110.0, 1, "evaluated")

        stats = store.get_eval_stats()
        # 2 correct of 3 evaluated → 66.67%
        assert stats["summary"]["correct"] == 2
        assert stats["summary"]["incorrect"] == 1
        assert stats["summary"]["accuracy_pct"] == 66.67
        assert stats["summary"]["total_briefs"] == 3

    def test_get_all_briefs_filter_and_parse(self, db):
        store.save_brief("AAPL", _brief())
        store.save_brief("MSFT", _brief())
        only_aapl = store.get_all_briefs(ticker="AAPL")
        assert len(only_aapl) == 1
        assert only_aapl[0]["brief_data"]["brief_text"] == "BULL CASE\n- up"


class TestWatchlist:
    def test_add_remove(self, db):
        store.add_to_watchlist("AAPL")
        store.add_to_watchlist("MSFT")
        tickers = [w["ticker"] for w in store.get_watchlist()]
        assert set(tickers) == {"AAPL", "MSFT"}

        store.remove_from_watchlist("AAPL")
        assert [w["ticker"] for w in store.get_watchlist()] == ["MSFT"]

    def test_reorder(self, db):
        for t in ("AAPL", "MSFT", "TSLA"):
            store.add_to_watchlist(t)
        store.update_watchlist_order(["TSLA", "AAPL", "MSFT"])
        ordered = [w["ticker"] for w in store.get_watchlist()]
        assert ordered == ["TSLA", "AAPL", "MSFT"]

    def test_update_notes(self, db):
        store.add_to_watchlist("AAPL")
        store.update_watchlist_item("AAPL", "buy the dip")
        note = next(w for w in store.get_watchlist() if w["ticker"] == "AAPL")["notes"]
        assert note == "buy the dip"

    def test_add_is_idempotent(self, db):
        store.add_to_watchlist("AAPL")
        store.add_to_watchlist("AAPL")  # INSERT OR REPLACE
        assert len([w for w in store.get_watchlist() if w["ticker"] == "AAPL"]) == 1
