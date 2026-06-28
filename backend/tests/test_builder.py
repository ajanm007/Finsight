"""Tests for brief/builder.py — final brief assembly.

build_brief is pure: it turns tool_results + text + scores into the API-shaped
dict. No I/O, no mocks. We assert the DATA AVAILABILITY block (icons/notes per
status), conflict prefixing, and ticker upcasing.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from brief.builder import build_brief, _tool_display_name


def _build(tool_results, conflicts=None):
    return build_brief(
        ticker="aapl",
        tool_results=tool_results,
        brief_text="BULL CASE\n- up",
        confidence={"model_confidence": 70},
        conflicts=conflicts or [],
    )


class TestDataAvailability:
    def test_available_gets_check_icon_no_note(self):
        out = _build({"fetch_news": {"status": "AVAILABLE"}})
        da = out["data_availability"]["fetch_news"]
        assert da["icon"] == "✓"
        assert da["status"] == "AVAILABLE"
        assert da["note"] == ""

    def test_unavailable_gets_cross_and_error_note(self):
        out = _build({"fetch_news": {"status": "UNAVAILABLE", "error": "rate limited"}})
        da = out["data_availability"]["fetch_news"]
        assert da["icon"] == "✗"
        assert "rate limited" in da["note"]

    def test_unavailable_without_error_says_unavailable(self):
        out = _build({"fetch_news": {"status": "UNAVAILABLE"}})
        assert _build({"fetch_news": {"status": "UNAVAILABLE"}})["data_availability"]["fetch_news"]["note"] == "(unavailable)"
        assert out["data_availability"]["fetch_news"]["icon"] == "✗"

    def test_cached_hours_note(self):
        out = _build({"fetch_news": {"status": "CACHED", "_age_seconds": 3600 * 5}})
        da = out["data_availability"]["fetch_news"]
        assert da["icon"] == "✓"  # CACHED counts as available
        assert "5h ago" in da["note"]

    def test_cached_days_note(self):
        out = _build({"fetch_news": {"status": "CACHED", "_age_seconds": 3600 * 24 * 3}})
        assert "3d ago" in out["data_availability"]["fetch_news"]["note"]

    def test_degraded_note(self):
        out = _build({"compute_technicals": {"status": "DEGRADED"}})
        da = out["data_availability"]["compute_technicals"]
        assert da["icon"] == "✗"
        assert "degraded" in da["note"]

    def test_missing_status_treated_unavailable(self):
        out = _build({"fetch_news": {}})
        assert out["data_availability"]["fetch_news"]["icon"] == "✗"


class TestBriefShape:
    def test_ticker_is_upcased(self):
        assert _build({})["ticker"] == "AAPL"

    def test_conflicts_are_prefixed(self):
        out = _build({}, conflicts=["price up but sentiment bearish"])
        assert out["conflicts"] == ["⚠ price up but sentiment bearish"]

    def test_empty_conflicts_is_empty_list(self):
        assert _build({})["conflicts"] == []

    def test_carries_through_text_and_confidence(self):
        out = _build({})
        assert out["brief_text"] == "BULL CASE\n- up"
        assert out["confidence"] == {"model_confidence": 70}

    def test_has_date(self):
        assert len(_build({})["date"]) == 10  # YYYY-MM-DD


class TestDisplayName:
    def test_known_tool_mapped(self):
        assert _tool_display_name("run_sentiment") == "News Sentiment"

    def test_unknown_tool_passes_through(self):
        assert _tool_display_name("fetch_finnhub_data") == "fetch_finnhub_data"
