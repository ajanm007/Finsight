"""Algorithmic confidence scoring — split into Bull Case and Model Confidence."""

import time
from typing import Any

from config import (
    STALENESS_PENALTY,
    BULL_SCORE_CONFLICT_CAP,
    BULL_SCORE_BEAR_CAP,
    BULL_SCORE_PERFECT_CAP,
    BEAR_SIGNAL_CONF_PENALTY,
    CONFLICT_CONF_PENALTY,
    RSI_OVERBOUGHT_CONF_PENALTY,
    SIGNAL_DISAGREEMENT_CONF_PENALTY,
    SIGNAL_DISAGREEMENT_THRESHOLD,
    RECENCY_BONUS_PTS,
    STALENESS_PENALTY_CAP,
)


def compute_confidence(tool_results: dict[str, Any]) -> dict[str, Any]:
    """
    Compute two distinct scores:
    1. BULL CASE SCORE: Measures signal strength (0-100)
    2. MODEL CONFIDENCE: Measures system certainty (0-100)
    """
    
    # 1. Gather basic stats
    total_sources = len(tool_results)
    available_sources = sum(1 for r in tool_results.values() if r.get("status") in ("AVAILABLE", "CACHED"))
    cached_sources = sum(1 for r in tool_results.values() if r.get("status") == "CACHED")
    
    # 2. Identify signals
    bull_signals = 0
    bear_signals = 0
    
    macd_bonus = 0
    velocity_bonus = 0
    rsi_penalty = 0
    rsi_value = 50
    
    # Tech signals
    tech = tool_results.get("compute_technicals", {})
    if tech.get("status") in ("AVAILABLE", "CACHED"):
        rsi_interp = tech.get("rsi", {}).get("interpretation")
        rsi_value = tech.get("rsi", {}).get("value", 50)
        
        if rsi_interp == "oversold": bull_signals += 1
        if rsi_interp == "overbought": 
            bear_signals += 1
            rsi_penalty = 15 # Overbought penalty
            
        macd_interp = tech.get("macd", {}).get("interpretation")
        if macd_interp == "bullish": 
            bull_signals += 1
            macd_bonus = 10
        if macd_interp == "bearish": 
            bear_signals += 1
            
        # MA signals
        ma = tech.get("moving_averages", {})
        if "bullish" in ma.get("price_vs_200ma", ""): bull_signals += 1
        if "bearish" in ma.get("price_vs_200ma", ""): bear_signals += 1

    # Sentiment
    sent = tool_results.get("run_sentiment", {})
    if sent.get("status") in ("AVAILABLE", "CACHED"):
        if sent.get("overall_sentiment") == "bullish": bull_signals += 1
        if sent.get("overall_sentiment") == "bearish": bear_signals += 1
        
    # Price Velocity
    price = tool_results.get("fetch_price_data", {})
    if price.get("status") in ("AVAILABLE", "CACHED"):
        data = price.get("data", [])
        if len(data) >= 2:
            change = data[-1]["close"] - data[0]["close"]
            if change > 0: 
                bull_signals += 1
                velocity_bonus = 5
            elif change < 0: 
                bear_signals += 1

    total_detected_signals = bull_signals + bear_signals
    
    # 3. Detect conflicts
    from brief.conflicts import detect_conflicts
    conflicts = detect_conflicts(tool_results)
    has_conflict = len(conflicts) > 0

    # --- BULL CASE SCORE ---
    # Formula: bull_score = (bull_signals/total) * 100 + macd_bonus + velocity_bonus - rsi_penalty
    if total_detected_signals > 0:
        bull_ratio_score = (bull_signals / total_detected_signals) * 100
        bull_score = bull_ratio_score + macd_bonus + velocity_bonus - rsi_penalty
    else:
        bull_score = 50 # Neutral starting point if no signals
        
    if has_conflict:
        bull_score = min(bull_score, BULL_SCORE_CONFLICT_CAP)

    if bear_signals >= 2:
        bull_score = min(bull_score, BULL_SCORE_BEAR_CAP)

    # Prevent 100 unless every source is live with no friction
    all_live = (available_sources == total_sources) and (cached_sources == 0)
    if not all_live or bear_signals > 0 or has_conflict:
        bull_score = min(bull_score, BULL_SCORE_PERFECT_CAP)

    bull_score = max(0, min(100, int(bull_score)))

    # --- MODEL CONFIDENCE ---
    conf_score = 100
    conf_score -= BEAR_SIGNAL_CONF_PENALTY * bear_signals
    if has_conflict:
        conf_score -= CONFLICT_CONF_PENALTY

    # Time-based staleness penalties (PRD 4.4.1)
    for tool_name, result in tool_results.items():
        if result.get("status") == "CACHED":
            age_days = result.get("_age_seconds", 0) / 86400
            source_key = _tool_to_source_key(tool_name)
            penalty_per_day = STALENESS_PENALTY.get(source_key, 0.05)
            staleness_hit = penalty_per_day * age_days * 100
            conf_score -= min(staleness_hit, STALENESS_PENALTY_CAP)

    # Recency bonus for fresh live news
    news_result = tool_results.get("fetch_news", {})
    if news_result.get("status") == "AVAILABLE" and not news_result.get("_cached"):
        conf_score += RECENCY_BONUS_PTS

    if rsi_value > 65:
        conf_score -= RSI_OVERBOUGHT_CONF_PENALTY

    # Penalise when bull/bear signals are roughly split — model is uncertain
    if total_detected_signals > 0:
        agreement = abs(bull_signals - bear_signals) / total_detected_signals
        if agreement < SIGNAL_DISAGREEMENT_THRESHOLD:
            conf_score -= SIGNAL_DISAGREEMENT_CONF_PENALTY

    model_confidence = max(0, min(100, int(conf_score)))

    # Source status map for UI
    source_statuses = {
        name: r.get("status", "UNAVAILABLE") 
        for name, r in tool_results.items()
    }

    return {
        "bull_case_score": bull_score,
        "model_confidence": model_confidence,
        "score_pct": model_confidence, # Legacy support
        "bull_signals": bull_signals,
        "bear_signals": bear_signals,
        "conflicts": len(conflicts),
        "sources_available": available_sources,
        "sources_total": total_sources,
        "source_statuses": source_statuses,
        "basis": f"Signals: {bull_signals}B/{bear_signals}S | Conflicts: {len(conflicts)}",
    }


def _tool_to_source_key(tool_name: str) -> str:
    """Map tool names to STALENESS_PENALTY keys."""
    mapping = {
        "fetch_price_data": "price",
        "compute_technicals": "technicals",
        "fetch_news": "news",
        "run_sentiment": "sentiment",
        "fetch_sec_filing": "sec_filing",
    }
    return mapping.get(tool_name, "news")
