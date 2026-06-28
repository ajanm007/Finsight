"""Tests for eval/evaluator.py — brief correctness grading.

Regression guard for the net_signal vocabulary bug: _determine_net_signal()
emits 'mildly_bullish' / 'strongly_bearish' / etc., never the bare strings
'bullish' / 'bearish'. The grader must match the real vocabulary, otherwise
every directional brief is mis-marked incorrect.
"""

import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import eval.evaluator as evaluator


def _run_with(net_signal, pct_change, monkeypatch):
    """Drive evaluate_pending_briefs() against one synthetic brief.

    Returns the (price_5d_later, is_correct, eval_status) the grader wrote.
    """
    price_at_brief = 100.0
    current_price = price_at_brief * (1 + pct_change)
    # 30 days ago — comfortably past the 5-business-day holding period.
    created_at = time.time() - 30 * 86400

    brief = {
        "id": 1,
        "ticker": "TEST",
        "net_signal": net_signal,
        "price_at_brief": price_at_brief,
        "created_at": created_at,
    }

    captured = {}

    def fake_update(brief_id, price_5d_later, is_correct, eval_status):
        captured["price_5d_later"] = price_5d_later
        captured["is_correct"] = is_correct
        captured["eval_status"] = eval_status

    monkeypatch.setattr(evaluator, "get_pending_evals", lambda: [brief])
    monkeypatch.setattr(evaluator, "update_brief_eval", fake_update)
    monkeypatch.setattr(
        evaluator, "fetch_price_data",
        lambda ticker, *a, **k: {"status": "AVAILABLE", "current_price": current_price},
    )

    evaluator.evaluate_pending_briefs()
    return captured


class TestGradingVocabulary:
    def test_mildly_bullish_up_move_is_correct(self, monkeypatch):
        # The bug: this was marked incorrect because "mildly_bullish" != "bullish".
        result = _run_with("mildly_bullish", pct_change=0.05, monkeypatch=monkeypatch)
        assert result["eval_status"] == "evaluated"
        assert result["is_correct"] == 1

    def test_strongly_bearish_down_move_is_correct(self, monkeypatch):
        result = _run_with("strongly_bearish", pct_change=-0.05, monkeypatch=monkeypatch)
        assert result["eval_status"] == "evaluated"
        assert result["is_correct"] == 1

    def test_mildly_bullish_down_move_is_incorrect(self, monkeypatch):
        result = _run_with("mildly_bullish", pct_change=-0.05, monkeypatch=monkeypatch)
        assert result["eval_status"] == "evaluated"
        assert result["is_correct"] == 0


class TestSkipRules:
    def test_neutral_is_skipped(self, monkeypatch):
        result = _run_with("neutral", pct_change=0.05, monkeypatch=monkeypatch)
        assert result["eval_status"] == "skipped"

    def test_sub_one_percent_move_is_skipped(self, monkeypatch):
        result = _run_with("strongly_bullish", pct_change=0.005, monkeypatch=monkeypatch)
        assert result["eval_status"] == "skipped"
