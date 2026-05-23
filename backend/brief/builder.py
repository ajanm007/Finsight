"""Brief builder — assembles the full Bull vs Bear brief."""

import time
from typing import Any


def build_brief(ticker: str, tool_results: dict, brief_text: str,
                confidence: dict, conflicts: list[str]) -> dict[str, Any]:
    """
    Assemble the final structured brief matching the PRD format.

    Args:
        ticker: Stock ticker symbol.
        tool_results: Results from all executed tools.
        brief_text: Generated brief text (from LLM or fallback).
        confidence: Confidence scoring result.
        conflicts: List of detected conflicts.

    Returns:
        Complete brief dict ready for API response.
    """
    # Build DATA AVAILABILITY block
    data_availability = {}
    for tool_name, result in tool_results.items():
        status = result.get("status", "UNAVAILABLE")
        icon = "✓" if status in ("AVAILABLE", "CACHED") else "✗"
        label = _tool_display_name(tool_name)
        note = ""

        if status == "CACHED":
            age = result.get("_age_seconds")
            if age:
                hours = age / 3600
                if hours < 24:
                    note = f"(cached, {hours:.0f}h ago)"
                else:
                    days = hours / 24
                    note = f"(cached, {days:.0f}d ago)"

        elif status == "UNAVAILABLE":
            error = result.get("error", "")
            if error:
                note = f"(unavailable — {error[:80]})"
            else:
                note = "(unavailable)"

        elif status == "DEGRADED":
            note = "(degraded — partial data)"

        data_availability[tool_name] = {
            "icon": icon,
            "label": label,
            "status": status,
            "note": note,
            "display": f"{icon} {label} {note}".strip(),
        }

    return {
        "ticker": ticker.upper(),
        "date": time.strftime("%Y-%m-%d"),
        "brief_text": brief_text,
        "confidence": confidence,
        "conflicts": [f"⚠ {c}" for c in conflicts],
        "data_availability": data_availability,
    }


def _tool_display_name(tool_name: str) -> str:
    """Human-readable display name for a tool."""
    names = {
        "fetch_price_data": "Price/Technicals",
        "compute_technicals": "Technical Indicators",
        "fetch_news": "News",
        "run_sentiment": "News Sentiment",
        "fetch_sec_filing": "SEC Filing (MD&A)",
    }
    return names.get(tool_name, tool_name)
