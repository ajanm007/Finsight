"""Tests for brief/conflicts.py — conflict detection rules."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from brief.conflicts import detect_conflicts


def _tech(rsi_interp="neutral", rsi_val=50, macd_interp="neutral", ma_200="neutral", status="AVAILABLE"):
    return {
        "status": status,
        "rsi": {"interpretation": rsi_interp, "value": rsi_val},
        "macd": {"interpretation": macd_interp},
        "moving_averages": {"price_vs_200ma": ma_200},
    }


def _sent(overall="neutral", bull=0, bear=0, avg=0.0, status="AVAILABLE"):
    return {"status": status, "overall_sentiment": overall,
            "bullish_count": bull, "bearish_count": bear, "avg_score": avg}


def _price(change_pct=0, status="AVAILABLE"):
    base = 100.0
    end = base * (1 + change_pct / 100)
    return {"status": status, "data": [{"close": base}, {"close": end}]}


def _sec(mda="", status="AVAILABLE"):
    return {"status": status, "mda_text": mda}


class TestRule1_RSIVsSentiment:
    def test_bullish_sentiment_overbought_rsi(self):
        r = {"compute_technicals": _tech(rsi_interp="overbought", rsi_val=75),
             "run_sentiment": _sent("bullish")}
        conflicts = detect_conflicts(r)
        assert any("overbought" in c for c in conflicts)

    def test_bearish_sentiment_oversold_rsi(self):
        r = {"compute_technicals": _tech(rsi_interp="oversold", rsi_val=25),
             "run_sentiment": _sent("bearish")}
        conflicts = detect_conflicts(r)
        assert any("oversold" in c for c in conflicts)

    def test_aligned_bullish_no_conflict(self):
        r = {"compute_technicals": _tech(rsi_interp="oversold", rsi_val=28),
             "run_sentiment": _sent("bullish")}
        # Rule 1 should not fire when signals agree
        conflicts = detect_conflicts(r)
        assert not any("overbought" in c or ("bearish" in c and "oversold" in c) for c in conflicts)


class TestRule2_SentimentVsPrice:
    def test_bearish_sent_price_up_5pct(self):
        r = {"run_sentiment": _sent("bearish"), "fetch_price_data": _price(6)}
        conflicts = detect_conflicts(r)
        assert any("bearish" in c and "up" in c for c in conflicts)

    def test_bullish_sent_price_down_5pct(self):
        r = {"run_sentiment": _sent("bullish"), "fetch_price_data": _price(-6)}
        conflicts = detect_conflicts(r)
        assert any("bullish" in c and "down" in c for c in conflicts)

    def test_below_threshold_no_conflict(self):
        r = {"run_sentiment": _sent("bearish"), "fetch_price_data": _price(3)}
        conflicts = detect_conflicts(r)
        assert not any("bearish" in c and "up" in c for c in conflicts)


class TestRule3_MACDVsSentiment:
    def test_bearish_macd_bullish_sentiment(self):
        r = {"compute_technicals": _tech(macd_interp="bearish"),
             "run_sentiment": _sent("bullish")}
        conflicts = detect_conflicts(r)
        assert any("MACD" in c and "bearish" in c.lower() for c in conflicts)

    def test_bullish_macd_bearish_sentiment(self):
        r = {"compute_technicals": _tech(macd_interp="bullish"),
             "run_sentiment": _sent("bearish")}
        conflicts = detect_conflicts(r)
        assert any("MACD" in c and "bullish" in c.lower() for c in conflicts)


class TestRule4_MA200VsRSI:
    def test_above_200ma_overbought(self):
        r = {"compute_technicals": _tech(rsi_interp="overbought", rsi_val=75, ma_200="bullish")}
        conflicts = detect_conflicts(r)
        assert any("200" in c and "overbought" in c for c in conflicts)

    def test_above_200ma_neutral_rsi_no_conflict(self):
        r = {"compute_technicals": _tech(rsi_interp="neutral", rsi_val=55, ma_200="bullish")}
        conflicts = detect_conflicts(r)
        assert not any("200" in c and "overbought" in c for c in conflicts)


class TestRule5_MixedNews:
    def test_requires_two_per_side(self):
        # 1 bull + 1 bear should NOT fire
        r = {"run_sentiment": _sent("bullish", bull=1, bear=1)}
        conflicts = detect_conflicts(r)
        assert not any("Mixed News" in c for c in conflicts)

    def test_fires_with_two_per_side(self):
        r = {"run_sentiment": _sent("bullish", bull=3, bear=2)}
        conflicts = detect_conflicts(r)
        assert any("Mixed News" in c for c in conflicts)

    def test_one_sided_no_conflict(self):
        r = {"run_sentiment": _sent("bullish", bull=5, bear=0)}
        conflicts = detect_conflicts(r)
        assert not any("Mixed News" in c for c in conflicts)


class TestRule6_ParabolicVelocity:
    def test_fires_above_8pct(self):
        r = {"fetch_price_data": _price(10)}
        conflicts = detect_conflicts(r)
        assert any("Parabolic" in c for c in conflicts)

    def test_no_fire_below_8pct(self):
        r = {"fetch_price_data": _price(5)}
        conflicts = detect_conflicts(r)
        assert not any("Parabolic" in c for c in conflicts)


class TestRule7_SECVsPrice:
    def test_growth_keywords_with_price_down_10(self):
        r = {"fetch_price_data": _price(-12),
             "fetch_sec_filing": _sec("strong revenue growth and increased revenue this quarter")}
        conflicts = detect_conflicts(r)
        assert any("revenue" in c.lower() for c in conflicts)

    def test_no_growth_keywords_no_conflict(self):
        r = {"fetch_price_data": _price(-12),
             "fetch_sec_filing": _sec("operating expenses increased significantly")}
        conflicts = detect_conflicts(r)
        assert not any("revenue" in c.lower() for c in conflicts)


class TestNoConflicts:
    def test_all_aligned_bullish(self):
        r = {
            "compute_technicals": _tech(rsi_interp="oversold", rsi_val=28, macd_interp="bullish", ma_200="bullish"),
            "run_sentiment": _sent("bullish", bull=3, bear=0),
            "fetch_price_data": _price(3),
        }
        conflicts = detect_conflicts(r)
        assert conflicts == []

    def test_unavailable_sources_no_false_positives(self):
        r = {
            "compute_technicals": _tech(status="UNAVAILABLE"),
            "run_sentiment": _sent(status="UNAVAILABLE"),
            "fetch_price_data": _price(status="UNAVAILABLE"),
        }
        assert detect_conflicts(r) == []
