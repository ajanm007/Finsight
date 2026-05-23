"""Rule-based conflict detection between data sources."""

from typing import Any


def detect_conflicts(tool_results: dict[str, Any]) -> list[str]:
    """
    Detect contradictions between data sources and internal signals.
    """
    conflicts = []

    technicals = tool_results.get("compute_technicals", {})
    sentiment = tool_results.get("run_sentiment", {})
    price = tool_results.get("fetch_price_data", {})
    sec = tool_results.get("fetch_sec_filing", {})

    tech_available = technicals.get("status") in ("AVAILABLE", "CACHED")
    sent_available = sentiment.get("status") in ("AVAILABLE", "CACHED")
    price_available = price.get("status") in ("AVAILABLE", "CACHED")

    # --- Rule 1: News bullish but RSI overbought ---
    if tech_available and sent_available:
        rsi_interp = technicals.get("rsi", {}).get("interpretation", "")
        overall_sent = sentiment.get("overall_sentiment", "")

        if overall_sent == "bullish" and rsi_interp == "overbought":
            rsi_val = technicals.get("rsi", {}).get("value", "?")
            conflicts.append(
                f"News sentiment is bullish but RSI at {rsi_val} indicates overbought conditions"
            )

        if overall_sent == "bearish" and rsi_interp == "oversold":
            rsi_val = technicals.get("rsi", {}).get("value", "?")
            conflicts.append(
                f"News sentiment is bearish but RSI at {rsi_val} indicates oversold (potential bounce)"
            )

    # --- Rule 2: Sentiment vs price trend ---
    if sent_available and price_available:
        overall_sent = sentiment.get("overall_sentiment", "")
        data = price.get("data", [])

        if len(data) >= 2:
            change_pct = ((data[-1]["close"] - data[0]["close"]) / data[0]["close"]) * 100

            if overall_sent == "bearish" and change_pct > 5:
                conflicts.append(
                    f"News sentiment is bearish but price is up {change_pct:.1f}% over the period"
                )

            if overall_sent == "bullish" and change_pct < -5:
                conflicts.append(
                    f"News sentiment is bullish but price is down {abs(change_pct):.1f}% over the period"
                )

    # --- Rule 3: Technicals vs News Sentiment ---
    if tech_available and sent_available:
        macd_interp = technicals.get("macd", {}).get("interpretation", "")
        overall_sent = sentiment.get("overall_sentiment", "")
        
        # MACD vs Sentiment
        if macd_interp == "bearish" and overall_sent == "bullish":
            conflicts.append("Bearish MACD momentum crossover contradicts bullish news environment")
        if macd_interp == "bullish" and overall_sent == "bearish":
            conflicts.append("Bullish MACD momentum crossover contradicts bearish news environment")

        # Long-term trend vs Sentiment
        ma_200 = technicals.get("moving_averages", {}).get("price_vs_200ma", "")
        if "bullish" in ma_200 and overall_sent == "bearish":
            conflicts.append("Long-term structural uptrend (above 200-day MA) contradicts recent negative news flow")
        if "bearish" in ma_200 and overall_sent == "bullish":
            conflicts.append("Long-term structural downtrend (below 200-day MA) contradicts recent positive news flow")

    # --- Rule 4: Price above 200-day MA but RSI overbought ---
    if tech_available:
        rsi_interp = technicals.get("rsi", {}).get("interpretation", "")
        ma_200 = technicals.get("moving_averages", {}).get("price_vs_200ma", "")

        if rsi_interp == "overbought" and "bullish" in ma_200:
            conflicts.append(
                "Price is above 200-day MA (bullish trend) but RSI indicates overbought — potential pullback"
            )

    # --- Rule 5: Internal Sentiment Contradiction (Bull vs Bear News) ---
    # Requires at least 2 articles on each side to avoid flagging every ticker
    # with a single outlier article as "conflicted".
    if sent_available:
        bull_count = sentiment.get("bullish_count", 0)
        bear_count = sentiment.get("bearish_count", 0)

        if bull_count >= 2 and bear_count >= 2:
            conflicts.append(f"Mixed News Cycle: {bull_count} bullish vs {bear_count} bearish reports creating sentiment friction")

    # --- Rule 6: Parabolic Price Velocity Conflict ---
    if price_available:
        data = price.get("data", [])
        if len(data) >= 2:
            change_pct = ((data[-1]["close"] - data[0]["close"]) / data[0]["close"]) * 100
            if change_pct > 8:
                conflicts.append(f"Parabolic Price Velocity: Up {change_pct:.1f}% indicates strong momentum but high reversal risk")

    # --- Rule 7: SEC fundamentals vs price trend ---
    if price_available and sec.get("status") in ("AVAILABLE", "CACHED"):
        mda_text = sec.get("mda_text", "").lower()
        data = price.get("data", [])

        if len(data) >= 2:
            change_pct = ((data[-1]["close"] - data[0]["close"]) / data[0]["close"]) * 100

            # Simple keyword check for growth
            growth_keywords = ["revenue growth", "increased revenue", "higher revenue",
                             "strong demand", "record revenue"]
            has_growth = any(kw in mda_text for kw in growth_keywords)

            if has_growth and change_pct < -10:
                conflicts.append(
                    f"SEC filing mentions revenue growth but price is down {abs(change_pct):.1f}% — "
                    "fundamentals and price diverging"
                )

    return conflicts
