"""Tier B — FastAPI route tests for main.py via TestClient.

Auth is bypassed through the codebase's own escape hatch (settings.AUTH_DISABLED
= True) rather than dependency_overrides, so the real require_auth / verify_token
path is exercised in its dev mode. The data layer (analyze_ticker, store fns,
fetch_price_data, httpx) is mocked so routes are tested in isolation; DB_PATH
points at a tmp file for routes that hit the real store.

Network is never touched.
"""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import config


@pytest.fixture
def client(tmp_path, monkeypatch):
    """TestClient with auth disabled and a fresh temp DB."""
    monkeypatch.setattr(config.settings, "AUTH_DISABLED", True)
    monkeypatch.setattr(config.settings, "DB_PATH", str(tmp_path / "test.db"))

    from fastapi.testclient import TestClient
    import main
    return TestClient(main.app), main


# ---------- public routes ----------

class TestPublicRoutes:
    def test_root(self, client):
        c, _ = client
        r = c.get("/")
        assert r.status_code == 200
        assert r.json()["name"] == "FinSight Agent"

    def test_health(self, client):
        c, _ = client
        r = c.get("/health")
        assert r.status_code == 200
        body = r.json()
        assert body["status"] == "ok"
        assert "llm_provider" in body


# ---------- auth gating (with AUTH_DISABLED off) ----------

class TestAuthGating:
    def test_protected_route_401_without_token(self, tmp_path, monkeypatch):
        # Auth ON, secret configured → missing token must 401.
        monkeypatch.setattr(config.settings, "AUTH_DISABLED", False)
        monkeypatch.setattr(config.settings, "SUPABASE_JWT_SECRET", "test-secret")
        monkeypatch.setattr(config.settings, "DB_PATH", str(tmp_path / "t.db"))
        from fastapi.testclient import TestClient
        import main
        c = TestClient(main.app)
        assert c.get("/watchlist").status_code == 401

    def test_health_stays_public_when_auth_on(self, tmp_path, monkeypatch):
        monkeypatch.setattr(config.settings, "AUTH_DISABLED", False)
        monkeypatch.setattr(config.settings, "SUPABASE_JWT_SECRET", "test-secret")
        monkeypatch.setattr(config.settings, "DB_PATH", str(tmp_path / "t.db"))
        from fastapi.testclient import TestClient
        import main
        c = TestClient(main.app)
        assert c.get("/health").status_code == 200


# ---------- /analyze ----------

class TestAnalyze:
    def test_happy_path_returns_brief(self, client, monkeypatch):
        c, main = client
        async def fake_analyze(ticker, force_refresh=False):
            return {"ticker": ticker, "brief_text": "BULL CASE", "confidence": {}}
        monkeypatch.setattr(main, "analyze_ticker", fake_analyze)

        r = c.post("/analyze", json={"ticker": "aapl"})
        assert r.status_code == 200
        assert r.json()["ticker"] == "AAPL"  # upcased

    def test_invalid_ticker_returns_404(self, client, monkeypatch):
        c, main = client
        async def fake_analyze(ticker, force_refresh=False):
            return {"error": "invalid_ticker", "message": f"{ticker} not found"}
        monkeypatch.setattr(main, "analyze_ticker", fake_analyze)

        r = c.post("/analyze", json={"ticker": "ZZZZ"})
        assert r.status_code == 404

    def test_empty_ticker_returns_400(self, client):
        c, _ = client
        assert c.post("/analyze", json={"ticker": "   "}).status_code == 400

    def test_too_long_ticker_returns_400(self, client):
        c, _ = client
        assert c.post("/analyze", json={"ticker": "TOOLONGSYMBOL"}).status_code == 400

    def test_pipeline_exception_returns_500(self, client, monkeypatch):
        c, main = client
        async def boom(ticker, force_refresh=False):
            raise RuntimeError("kaboom")
        monkeypatch.setattr(main, "analyze_ticker", boom)
        assert c.post("/analyze", json={"ticker": "AAPL"}).status_code == 500

    def test_500_does_not_leak_exception_detail(self, client, monkeypatch):
        # Internal error text must not reach the client.
        c, main = client
        async def boom(ticker, force_refresh=False):
            raise RuntimeError("secret internal detail /srv/path/key=abc123")
        monkeypatch.setattr(main, "analyze_ticker", boom)
        r = c.post("/analyze", json={"ticker": "AAPL"})
        assert r.status_code == 500
        assert "secret internal detail" not in r.text
        assert "abc123" not in r.text
        assert r.json()["detail"] == "Analysis failed due to an internal error."


# ---------- /brief/{ticker} ----------

class TestGetBrief:
    def test_404_when_none(self, client):
        c, _ = client
        assert c.get("/brief/AAPL").status_code == 404

    def test_returns_cached_brief(self, client, monkeypatch):
        c, main = client
        monkeypatch.setattr(main, "get_latest_brief", lambda t: {"ticker": t, "net_signal": "neutral"})
        r = c.get("/brief/AAPL")
        assert r.status_code == 200
        assert r.json()["ticker"] == "AAPL"


# ---------- watchlist ----------

class TestWatchlist:
    def test_add_requires_valid_ticker_on_yahoo(self, client, monkeypatch):
        c, main = client
        monkeypatch.setattr(main, "fetch_price_data", lambda t: {"status": "UNAVAILABLE"})
        r = c.post("/watchlist", json={"ticker": "ZZZZ"})
        assert r.status_code == 400

    def test_add_success(self, client, monkeypatch):
        c, main = client
        monkeypatch.setattr(main, "fetch_price_data", lambda t: {"status": "AVAILABLE", "current_price": 1.0})
        called = {}
        monkeypatch.setattr(main, "add_to_watchlist", lambda t, n: called.update(ticker=t, notes=n))
        r = c.post("/watchlist", json={"ticker": "aapl", "notes": "hi"})
        assert r.status_code == 200
        assert called == {"ticker": "AAPL", "notes": "hi"}

    def test_list_returns_store_value(self, client, monkeypatch):
        c, main = client
        monkeypatch.setattr(main, "get_watchlist", lambda: [{"ticker": "AAPL"}])
        assert c.get("/watchlist").json() == [{"ticker": "AAPL"}]

    def test_remove(self, client, monkeypatch):
        c, main = client
        removed = {}
        monkeypatch.setattr(main, "remove_from_watchlist", lambda t: removed.update(t=t))
        r = c.delete("/watchlist/AAPL")
        assert r.status_code == 200
        assert removed["t"] == "AAPL"

    def test_reorder(self, client, monkeypatch):
        c, main = client
        order = {}
        monkeypatch.setattr(main, "update_watchlist_order", lambda lst: order.update(lst=lst))
        r = c.put("/watchlist/reorder", json={"ticker_orders": ["TSLA", "AAPL"]})
        assert r.status_code == 200
        assert order["lst"] == ["TSLA", "AAPL"]


# ---------- briefs history ----------

class TestBriefsHistory:
    def test_history(self, client, monkeypatch):
        c, main = client
        monkeypatch.setattr(main, "get_all_briefs", lambda **kw: [{"id": 1}])
        assert c.get("/briefs/history").json() == [{"id": 1}]

    def test_brief_by_id_404(self, client, monkeypatch):
        c, main = client
        monkeypatch.setattr(main, "get_brief_by_id", lambda i: None)
        assert c.get("/briefs/id/999").status_code == 404


# ---------- eval ----------

class TestEval:
    def test_leaderboard(self, client, monkeypatch):
        c, main = client
        import cache.store as store
        monkeypatch.setattr(store, "get_eval_stats", lambda: {"summary": {"accuracy_pct": 50.0}})
        r = c.get("/eval/leaderboard")
        assert r.status_code == 200
        assert r.json()["summary"]["accuracy_pct"] == 50.0

    def test_run_evaluation(self, client, monkeypatch):
        c, main = client
        import eval.evaluator as ev
        monkeypatch.setattr(ev, "evaluate_pending_briefs", lambda: {"evaluated": 3})
        r = c.post("/eval/run")
        assert r.status_code == 200
        assert r.json()["stats"] == {"evaluated": 3}


# ---------- /search ----------

class TestSearch:
    def test_short_query_returns_empty(self, client):
        c, _ = client
        assert c.get("/search?q=a").json() == {"results": []}

    def test_no_api_key_returns_empty(self, client, monkeypatch):
        c, main = client
        monkeypatch.setattr(config.settings, "FINNHUB_API_KEY", "")
        assert c.get("/search?q=apple").json() == {"results": []}

    def test_finnhub_results_parsed(self, client, monkeypatch):
        c, main = client
        monkeypatch.setattr(config.settings, "FINNHUB_API_KEY", "key")
        main._search_cache.clear()

        class FakeResp:
            def raise_for_status(self): pass
            def json(self):
                return {"result": [
                    {"symbol": "AAPL", "description": "Apple Inc", "type": "Common Stock"},
                    {"description": "no symbol — dropped"},
                ]}
        monkeypatch.setattr(main.httpx, "get", lambda *a, **k: FakeResp())

        r = c.get("/search?q=apple")
        results = r.json()["results"]
        assert len(results) == 1
        assert results[0]["symbol"] == "AAPL"

    def test_finnhub_failure_returns_empty(self, client, monkeypatch):
        c, main = client
        monkeypatch.setattr(config.settings, "FINNHUB_API_KEY", "key")
        main._search_cache.clear()
        def boom(*a, **k):
            raise RuntimeError("network down")
        monkeypatch.setattr(main.httpx, "get", boom)
        assert c.get("/search?q=apple").json() == {"results": []}


# ---------- rate limiting ----------

class TestRateLimit:
    """The /analyze limit is read at decoration time, so set a tiny limit and
    reload main to apply it. main is reloaded again at teardown so the low limit
    doesn't leak into other tests' client fixture."""

    def test_analyze_returns_429_over_limit(self, tmp_path, monkeypatch):
        import importlib
        monkeypatch.setattr(config.settings, "AUTH_DISABLED", True)
        monkeypatch.setattr(config.settings, "DB_PATH", str(tmp_path / "rl.db"))
        monkeypatch.setattr(config.settings, "ANALYZE_RATE_LIMIT", "2/minute")

        import main
        main = importlib.reload(main)
        try:
            async def fake_analyze(ticker, force_refresh=False):
                return {"ticker": ticker}
            monkeypatch.setattr(main, "analyze_ticker", fake_analyze)

            from fastapi.testclient import TestClient
            c = TestClient(main.app)

            assert c.post("/analyze", json={"ticker": "AAPL"}).status_code == 200
            assert c.post("/analyze", json={"ticker": "AAPL"}).status_code == 200
            # 3rd call within the window is rejected
            assert c.post("/analyze", json={"ticker": "AAPL"}).status_code == 429
        finally:
            importlib.reload(main)  # restore normal limit for other tests
