"""Tests for agent/router.py pure logic + orchestration.

Covers the testable core that needs no live network:
  - _determine_net_signal: the signal vocabulary + friction-downgrade rules
    (the same family the eval grading bug came from)
  - _build_structured_signals: key bull/bear branches feeding the UI cards
  - _generate_fallback_brief: the no-LLM brief assembly path
  - select_tools / execute_tools: orchestration, with the LLM and tool I/O mocked

Async functions are driven with asyncio.run (no pytest-asyncio needed), matching
test_invalid_ticker.py's style.
"""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import agent.router as router


# ---------- _determine_net_signal ----------

def _tech(rsi="neutral", macd="neutral", status="AVAILABLE"):
    return {"compute_technicals": {
        "status": status,
        "rsi": {"interpretation": rsi, "value": 50},
        "macd": {"interpretation": macd},
    }}


def _sent(overall, status="AVAILABLE"):
    return {"run_sentiment": {"status": status, "overall_sentiment": overall}}


class TestDetermineNetSignal:
    def test_no_signals_is_neutral(self):
        assert router._determine_net_signal({}, []) == "neutral"

    def test_unavailable_tools_contribute_nothing(self):
        results = _tech(macd="bullish", status="UNAVAILABLE")
        assert router._determine_net_signal(results, []) == "neutral"

    def test_unanimous_bull_is_strongly_bullish(self):
        # MACD bull + sentiment bull → avg 1.0, no friction
        results = {**_tech(macd="bullish"), **_sent("bullish")}
        assert router._determine_net_signal(results, []) == "strongly_bullish"

    def test_unanimous_bear_is_strongly_bearish(self):
        results = {**_tech(macd="bearish"), **_sent("bearish")}
        assert router._determine_net_signal(results, []) == "strongly_bearish"

    def test_conflict_downgrades_strong_bull_to_mild(self):
        results = {**_tech(macd="bullish"), **_sent("bullish")}
        assert router._determine_net_signal(results, ["some conflict"]) == "mildly_bullish"

    def test_opposing_signal_downgrades_strong_bull_to_mild(self):
        # 2 bull (macd + sentiment), 1 bear (rsi overbought) → avg 0.33 → mildly
        results = {**_tech(rsi="overbought", macd="bullish"), **_sent("bullish")}
        assert router._determine_net_signal(results, []) == "mildly_bullish"

    def test_mixed_around_zero_is_neutral(self):
        # one bull, one bear → avg 0.0
        results = {**_tech(macd="bullish"), **_sent("bearish")}
        assert router._determine_net_signal(results, []) == "neutral"

    def test_output_is_always_in_known_vocabulary(self):
        # Guard the exact contract the eval grader depends on.
        vocab = {"neutral", "mildly_bullish", "strongly_bullish",
                 "mildly_bearish", "strongly_bearish"}
        for macd in ("bullish", "bearish", "neutral"):
            for sent in ("bullish", "bearish", "neutral"):
                results = {**_tech(macd=macd), **_sent(sent)}
                assert router._determine_net_signal(results, []) in vocab


# ---------- _build_structured_signals ----------

class TestBuildStructuredSignals:
    def test_empty_results_no_signals(self):
        assert router._build_structured_signals({}) == []

    def test_oversold_rsi_emits_bull_signal(self):
        results = {"compute_technicals": {
            "status": "AVAILABLE",
            "rsi": {"interpretation": "oversold", "value": 25},
            "macd": {"interpretation": "neutral"},
        }}
        sigs = router._build_structured_signals(results)
        rsi_sig = next(s for s in sigs if s["title"] == "RSI OVERSOLD")
        assert rsi_sig["type"] == "bull"

    def test_overbought_rsi_emits_bear_signal(self):
        results = {"compute_technicals": {
            "status": "AVAILABLE",
            "rsi": {"interpretation": "overbought", "value": 80},
            "macd": {"interpretation": "neutral"},
        }}
        sigs = router._build_structured_signals(results)
        assert any(s["title"] == "RSI OVERBOUGHT" and s["type"] == "bear" for s in sigs)

    def test_macd_bullish_emits_signal(self):
        results = {"compute_technicals": {
            "status": "AVAILABLE",
            "rsi": {"interpretation": "x", "value": 50},
            "macd": {"interpretation": "bullish", "macd": 1.23},
        }}
        sigs = router._build_structured_signals(results)
        assert any(s["title"] == "MACD BULLISH" and s["type"] == "bull" for s in sigs)


# ---------- _generate_fallback_brief ----------

class TestFallbackBrief:
    def test_has_all_three_sections(self, monkeypatch):
        monkeypatch.setattr(router, "detect_conflicts", lambda r: [])
        text = router._generate_fallback_brief("AAPL", {})
        assert "BULL CASE" in text
        assert "BEAR CASE" in text
        assert "SIGNAL CONFLICTS" in text

    def test_empty_results_yields_insufficient_data_lines(self, monkeypatch):
        monkeypatch.setattr(router, "detect_conflicts", lambda r: [])
        text = router._generate_fallback_brief("AAPL", {})
        assert "No bullish signals detected" in text
        assert "No bearish signals detected" in text

    def test_conflicts_are_listed(self, monkeypatch):
        monkeypatch.setattr(router, "detect_conflicts", lambda r: ["price vs sentiment"])
        text = router._generate_fallback_brief("AAPL", {})
        assert "⚠ price vs sentiment" in text

    def test_bullish_sentiment_appears_in_bull_case(self, monkeypatch):
        monkeypatch.setattr(router, "detect_conflicts", lambda r: [])
        results = {"run_sentiment": {
            "status": "AVAILABLE", "overall_sentiment": "bullish",
            "avg_score": 0.42, "bullish_count": 3,
        }}
        text = router._generate_fallback_brief("AAPL", results)
        assert "News sentiment positive" in text


# ---------- select_tools (LLM mocked) ----------

class TestSelectTools:
    def test_parses_llm_tool_plan(self, monkeypatch):
        async def fake_llm(prompt, timeout=15.0):
            return '{"tools": ["fetch_price_data", "compute_technicals"]}'
        monkeypatch.setattr(router, "_llm_generate_async", fake_llm)
        tools = asyncio.run(router.select_tools("AAPL"))
        assert tools == ["fetch_price_data", "compute_technicals"]

    def test_drops_unknown_tool_names(self, monkeypatch):
        async def fake_llm(prompt, timeout=15.0):
            return '{"tools": ["fetch_price_data", "make_coffee"]}'
        monkeypatch.setattr(router, "_llm_generate_async", fake_llm)
        assert asyncio.run(router.select_tools("AAPL")) == ["fetch_price_data"]

    def test_sentiment_forces_news_dependency(self, monkeypatch):
        async def fake_llm(prompt, timeout=15.0):
            return '{"tools": ["run_sentiment"]}'
        monkeypatch.setattr(router, "_llm_generate_async", fake_llm)
        tools = asyncio.run(router.select_tools("AAPL"))
        assert "fetch_news" in tools
        assert tools.index("fetch_news") < tools.index("run_sentiment")

    def test_empty_llm_response_falls_back_to_default(self, monkeypatch):
        async def fake_llm(prompt, timeout=15.0):
            return ""
        monkeypatch.setattr(router, "_llm_generate_async", fake_llm)
        assert asyncio.run(router.select_tools("AAPL")) == router.DEFAULT_TOOL_PLAN["tools"]

    def test_llm_exception_falls_back_to_default(self, monkeypatch):
        async def fake_llm(prompt, timeout=15.0):
            raise RuntimeError("boom")
        monkeypatch.setattr(router, "_llm_generate_async", fake_llm)
        assert asyncio.run(router.select_tools("AAPL")) == router.DEFAULT_TOOL_PLAN["tools"]


# ---------- execute_tools (tool I/O mocked) ----------

class TestExecuteTools:
    def test_collects_all_results(self, monkeypatch):
        async def fake_run(tool_name, ticker, context, force_refresh=False):
            return tool_name, {"status": "AVAILABLE", "tool": tool_name}
        monkeypatch.setattr(router, "_run_tool_async", fake_run)

        results = asyncio.run(router.execute_tools(
            "AAPL", ["fetch_price_data", "compute_technicals"]))
        assert set(results.keys()) == {"fetch_price_data", "compute_technicals"}
        assert results["fetch_price_data"]["tool"] == "fetch_price_data"

    def test_sentiment_runs_after_independents(self, monkeypatch):
        order = []
        async def fake_run(tool_name, ticker, context, force_refresh=False):
            order.append(tool_name)
            return tool_name, {"status": "AVAILABLE"}
        monkeypatch.setattr(router, "_run_tool_async", fake_run)

        asyncio.run(router.execute_tools("AAPL", ["run_sentiment", "fetch_news"]))
        # run_sentiment is the dependent phase → must come last
        assert order[-1] == "run_sentiment"
