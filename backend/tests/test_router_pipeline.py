"""Router gap — analyze_ticker end-to-end happy path + cache short-circuit.

The per-function logic (_determine_net_signal, select/execute_tools, fallback brief)
is covered in test_router_logic.py; the invalid-ticker gate in test_invalid_ticker.py.
This file covers the full analyze_ticker orchestration with all I/O seams mocked:
select_tools, _run_tool (price prefetch), execute_tools, generate_brief_text, save_brief.
"""

import asyncio
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import agent.router as router

_VALID_PRICE = {"status": "AVAILABLE", "current_price": 150.0,
                "data": [{"close": 148.0}, {"close": 150.0}]}


def _mock_pipeline(monkeypatch, tool_results):
    """Wire all I/O seams for a happy-path analyze_ticker run."""
    async def fake_select(ticker):
        return list(tool_results.keys())

    def fake_run_tool(name, ticker, ctx, force_refresh=False):
        # used for the price prefetch
        return name, _VALID_PRICE

    async def fake_execute(ticker, tools, force_refresh=False):
        return dict(tool_results)

    async def fake_brief_text(ticker, results):
        return "Synthesized brief narrative."

    saved = {}
    monkeypatch.setattr(router, "select_tools", fake_select)
    monkeypatch.setattr(router, "_run_tool", fake_run_tool)
    monkeypatch.setattr(router, "execute_tools", fake_execute)
    monkeypatch.setattr(router, "generate_brief_text", fake_brief_text)
    # save_brief is imported inside the function from cache.store
    import cache.store as store
    monkeypatch.setattr(store, "save_brief", lambda t, b: saved.update(brief=b) or 1)
    return saved


class TestAnalyzeTickerPipeline:
    def test_happy_path_builds_full_brief(self, monkeypatch):
        tool_results = {
            "fetch_price_data": _VALID_PRICE,
            "compute_technicals": {
                "status": "AVAILABLE",
                "rsi": {"interpretation": "neutral", "value": 50},
                "macd": {"interpretation": "bullish", "macd": 1.0},
            },
        }
        saved = _mock_pipeline(monkeypatch, tool_results)

        result = asyncio.run(router.analyze_ticker("aapl", force_refresh=True))

        assert result["ticker"] == "AAPL"
        assert result["brief_text"] == "Synthesized brief narrative."
        assert result["net_signal"] in {
            "neutral", "mildly_bullish", "strongly_bullish",
            "mildly_bearish", "strongly_bearish",
        }
        assert result["bias"] == result["net_signal"].upper().replace("_", " ")
        assert result["current_price"] == 150.0
        assert "confidence" in result and "signals" in result
        assert "data_availability" in result
        # llm_generated true because text doesn't start with "BULL CASE"
        assert result["llm_generated"] is True
        # brief was persisted
        assert saved["brief"]["ticker"] == "AAPL"

    def test_returns_cached_brief_when_not_refreshing(self, monkeypatch):
        import cache.store as store
        monkeypatch.setattr(store, "get_latest_brief",
                            lambda t: {"brief": {"ticker": t, "cached": True}})
        # If it short-circuits correctly, none of the pipeline seams are needed.
        result = asyncio.run(router.analyze_ticker("AAPL", force_refresh=False))
        assert result == {"ticker": "AAPL", "cached": True}

    def test_invalid_price_prefetch_short_circuits(self, monkeypatch):
        async def fake_select(ticker):
            return ["fetch_price_data"]
        def fake_run_tool(name, ticker, ctx, force_refresh=False):
            return name, {"status": "UNAVAILABLE", "current_price": None, "data": []}
        monkeypatch.setattr(router, "select_tools", fake_select)
        monkeypatch.setattr(router, "_run_tool", fake_run_tool)

        result = asyncio.run(router.analyze_ticker("ZZZZ", force_refresh=True))
        assert result["error"] == "invalid_ticker"
        assert result["ticker"] == "ZZZZ"
