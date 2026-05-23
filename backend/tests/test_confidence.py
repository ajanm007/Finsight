"""Tests for brief/confidence.py — the core algorithmic scoring logic."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from brief.confidence import compute_confidence


def _make_results(
    rsi_interp="neutral",
    rsi_val=50,
    macd_interp="neutral",
    ma_200="neutral",
    sentiment="neutral",
    price_change=0,
    tech_status="AVAILABLE",
    sent_status="AVAILABLE",
    price_status="AVAILABLE",
):
    results = {}

    if tech_status != "SKIP":
        results["compute_technicals"] = {
            "status": tech_status,
            "rsi": {"interpretation": rsi_interp, "value": rsi_val},
            "macd": {"interpretation": macd_interp},
            "moving_averages": {"price_vs_200ma": ma_200},
        }

    if sent_status != "SKIP":
        results["run_sentiment"] = {
            "status": sent_status,
            "overall_sentiment": sentiment,
            "avg_score": 0.3 if sentiment == "bullish" else (-0.3 if sentiment == "bearish" else 0.0),
            "bullish_count": 2 if sentiment == "bullish" else 0,
            "bearish_count": 2 if sentiment == "bearish" else 0,
        }

    if price_status != "SKIP":
        base = 100.0
        end = base + price_change
        results["fetch_price_data"] = {
            "status": price_status,
            "current_price": end,
            "data": [{"close": base}, {"close": end}],
        }

    return results


class TestBullScore:
    def test_all_bullish_signals_high_score(self):
        r = _make_results(rsi_interp="oversold", macd_interp="bullish", ma_200="bullish", sentiment="bullish", price_change=5)
        out = compute_confidence(r)
        assert out["bull_case_score"] >= 80

    def test_all_bearish_signals_low_score(self):
        r = _make_results(rsi_interp="overbought", macd_interp="bearish", ma_200="bearish", sentiment="bearish", price_change=-5)
        out = compute_confidence(r)
        assert out["bull_case_score"] <= 30

    def test_no_signals_neutral(self):
        r = _make_results(tech_status="SKIP", sent_status="SKIP", price_status="SKIP")
        out = compute_confidence(r)
        assert out["bull_case_score"] == 50

    def test_conflict_caps_bull_score_at_75(self):
        # overbought RSI + bullish sentiment triggers a conflict → cap at 75
        r = _make_results(rsi_interp="overbought", rsi_val=75, sentiment="bullish", price_change=10, macd_interp="bullish", ma_200="bullish")
        out = compute_confidence(r)
        assert out["bull_case_score"] <= 75

    def test_two_bear_signals_caps_at_80(self):
        r = _make_results(rsi_interp="overbought", macd_interp="bearish", sentiment="bullish", ma_200="bullish", price_change=3)
        out = compute_confidence(r)
        assert out["bull_case_score"] <= 80

    def test_imperfect_conditions_capped_below_99(self):
        # Cached source → not all_live → cap at BULL_SCORE_PERFECT_CAP
        r = _make_results(rsi_interp="oversold", macd_interp="bullish", ma_200="bullish", sentiment="bullish", price_change=3, tech_status="CACHED")
        out = compute_confidence(r)
        assert out["bull_case_score"] <= 98


class TestModelConfidence:
    def test_bear_signals_reduce_confidence(self):
        no_bear = _make_results(rsi_interp="oversold", sentiment="bullish", price_change=3)
        with_bear = _make_results(rsi_interp="overbought", sentiment="bearish", price_change=-3)
        assert compute_confidence(no_bear)["model_confidence"] > compute_confidence(with_bear)["model_confidence"]

    def test_conflict_reduces_confidence(self):
        clean = _make_results(rsi_interp="oversold", sentiment="bullish", price_change=2)
        conflicted = _make_results(rsi_interp="overbought", rsi_val=75, sentiment="bullish", price_change=2)
        assert compute_confidence(clean)["model_confidence"] > compute_confidence(conflicted)["model_confidence"]

    def test_rsi_above_65_penalty(self):
        normal = _make_results(rsi_val=50)
        elevated = _make_results(rsi_val=70)
        assert compute_confidence(normal)["model_confidence"] >= compute_confidence(elevated)["model_confidence"]

    def test_cached_source_staleness_penalty(self):
        live = _make_results(tech_status="AVAILABLE")
        stale = _make_results(tech_status="CACHED")
        stale["compute_technicals"]["_age_seconds"] = 7 * 86400  # 7 days stale
        assert compute_confidence(live)["model_confidence"] >= compute_confidence(stale)["model_confidence"]

    def test_score_bounded_0_to_100(self):
        extreme_bull = _make_results(rsi_interp="oversold", macd_interp="bullish", ma_200="bullish", sentiment="bullish", price_change=20)
        extreme_bear = _make_results(rsi_interp="overbought", macd_interp="bearish", ma_200="bearish", sentiment="bearish", price_change=-20)
        for r in (extreme_bull, extreme_bear):
            out = compute_confidence(r)
            assert 0 <= out["bull_case_score"] <= 100
            assert 0 <= out["model_confidence"] <= 100


class TestOutputShape:
    def test_required_keys_present(self):
        r = _make_results()
        out = compute_confidence(r)
        for key in ("bull_case_score", "model_confidence", "bull_signals", "bear_signals",
                    "conflicts", "sources_available", "sources_total", "source_statuses", "basis"):
            assert key in out, f"Missing key: {key}"

    def test_counts_match_signals(self):
        r = _make_results(rsi_interp="oversold", macd_interp="bullish", sentiment="bearish")
        out = compute_confidence(r)
        assert out["bull_signals"] >= 2
        assert out["bear_signals"] >= 1
