"""One-time backfill: re-grade already-evaluated briefs with the corrected logic.

The old correctness check compared net_signal to the bare strings "bullish" /
"bearish", which _determine_net_signal() never emits (it returns neutral /
mildly_/strongly_ bullish/bearish). That mis-marked every directional brief as
incorrect. This script recomputes is_correct using the SAME corrected substring
logic as eval/evaluator.py, reusing the prices already stored in the DB so it
does NOT re-fetch any market data.

Run from the backend/ directory:
    cd backend
    python scripts/backfill_eval.py

Idempotent: safe to run multiple times.
"""

import os
import sys

# Allow running as `python scripts/backfill_eval.py` from the backend/ dir.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from cache.store import _get_db


def backfill() -> dict:
    conn = _get_db()
    try:
        rows = conn.execute(
            """SELECT id, ticker, net_signal, price_at_brief, price_5d_later,
                      is_correct, eval_status
               FROM briefs
               WHERE eval_status = 'evaluated'"""
        ).fetchall()

        scanned = len(rows)
        flipped_to_correct = 0
        flipped_to_incorrect = 0
        changed_to_skipped = 0

        for row in rows:
            brief_id = row["id"]
            net_signal = row["net_signal"] or ""
            price_at_brief = row["price_at_brief"]
            price_5d_later = row["price_5d_later"]
            old_is_correct = row["is_correct"]

            # Guard against missing/zero prices (can't recompute these).
            if (
                price_at_brief is None
                or price_5d_later is None
                or price_at_brief == 0
            ):
                continue

            pct_change = (price_5d_later - price_at_brief) / price_at_brief

            # Apply the SAME corrected logic as eval/evaluator.py.
            if net_signal == "neutral" or abs(pct_change) < 0.01:
                # Previously evaluated but now qualifies as a skip.
                new_status = "skipped"
                new_is_correct = -1
                if row["eval_status"] != "skipped":
                    conn.execute(
                        """UPDATE briefs
                           SET is_correct = ?, eval_status = ?
                           WHERE id = ?""",
                        (new_is_correct, new_status, brief_id),
                    )
                    changed_to_skipped += 1
                continue

            is_bullish = "bull" in net_signal
            is_bearish = "bear" in net_signal
            new_is_correct = 0
            if (is_bullish and pct_change > 0) or (is_bearish and pct_change < 0):
                new_is_correct = 1

            if new_is_correct != old_is_correct:
                conn.execute(
                    "UPDATE briefs SET is_correct = ? WHERE id = ?",
                    (new_is_correct, brief_id),
                )
                if new_is_correct == 1:
                    flipped_to_correct += 1
                else:
                    flipped_to_incorrect += 1

        conn.commit()

        return {
            "scanned": scanned,
            "flipped_to_correct": flipped_to_correct,
            "flipped_to_incorrect": flipped_to_incorrect,
            "changed_to_skipped": changed_to_skipped,
        }
    finally:
        conn.close()


if __name__ == "__main__":
    stats = backfill()
    print("[backfill] Eval re-grade complete:")
    print(f"  Rows scanned (evaluated):       {stats['scanned']}")
    print(f"  Flipped incorrect -> correct:   {stats['flipped_to_correct']}")
    print(f"  Flipped correct -> incorrect:   {stats['flipped_to_incorrect']}")
    print(f"  Changed to 'skipped' (<1% move): {stats['changed_to_skipped']}")
