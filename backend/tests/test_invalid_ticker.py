"""Tests for invalid-ticker rejection in agent/router.py.

A non-ticker input (e.g. "GOOGLE", "ASDF") must be rejected via the pre-fetched
price result BEFORE the rest of the pipeline runs, instead of producing a brief
full of 0.0 values.

Both entry points are driven with asyncio.run() (no pytest-asyncio dependency),
and the price pre-fetch is mocked so no network call is made.
"""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import agent.router as router

# Price shapes
_INVALID_PRICE = {"status": "UNAVAILABLE", "current_price": None, "data": [], "error": "No data"}
_VALID_PRICE = {"status": "AVAILABLE", "current_price": 150.0,
                "data": [{"close": 148.0}, {"close": 150.0}]}


def _mock_prefetch(monkeypatch, price_result):
    """Make select_tools cheap and _run_tool return the given price result."""
    async def fake_select_tools(ticker):
        return []

    def fake_run_tool(tool_name, ticker, context, force_refresh=False):
        return tool_name, dict(price_result)

    monkeypatch.setattr(router, "select_tools", fake_select_tools)
    monkeypatch.setattr(router, "_run_tool", fake_run_tool)


def _drain(queue):
    events = []
    while not queue.empty():
        events.append(queue.get_nowait())
    return events


class TestValidationHelper:
    """_is_valid_ticker_price is the single source of truth for the gate."""

    def test_unavailable_is_invalid(self):
        assert router._is_valid_ticker_price(_INVALID_PRICE) is False

    def test_available_with_price_is_valid(self):
        assert router._is_valid_ticker_price(_VALID_PRICE) is True

    def test_available_but_empty_is_invalid(self):
        assert router._is_valid_ticker_price(
            {"status": "AVAILABLE", "current_price": None, "data": []}
        ) is False

    def test_cached_with_data_is_valid(self):
        assert router._is_valid_ticker_price(
            {"status": "CACHED", "current_price": 10.0, "data": [{"close": 10.0}]}
        ) is True


class TestAnalyzeTicker:
    def test_invalid_ticker_returns_error_dict(self, monkeypatch):
        _mock_prefetch(monkeypatch, _INVALID_PRICE)
        result = asyncio.run(router.analyze_ticker("GOOGLE", force_refresh=True))
        assert result.get("error") == "invalid_ticker"
        assert result.get("ticker") == "GOOGLE"
        # Must NOT be a real brief.
        assert "brief_text" not in result
        assert "confidence" not in result


class TestAnalyzeTickerStreaming:
    def test_invalid_ticker_emits_error_not_brief(self, monkeypatch):
        _mock_prefetch(monkeypatch, _INVALID_PRICE)
        queue = asyncio.Queue()
        asyncio.run(router.analyze_ticker_streaming("ASDF", queue, force_refresh=True))
        events = _drain(queue)
        types = [e.get("type") for e in events]

        assert "error" in types
        assert "brief" not in types  # no zeroed brief was streamed
        assert types[-1] == "done"   # stream is closed cleanly
        error_event = next(e for e in events if e.get("type") == "error")
        assert "ASDF" in error_event.get("message", "")
