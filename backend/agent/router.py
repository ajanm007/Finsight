"""Agent router — LLM-driven tool selection and parallel execution."""

import asyncio
import json
import logging
import time
from typing import Any

from config import settings
from agent.prompts import TOOL_SELECTION_PROMPT, BRIEF_GENERATION_PROMPT, DEFAULT_TOOL_PLAN
from brief.conflicts import detect_conflicts

logger = logging.getLogger(__name__)

# Lazy-loaded LLM
_llm = None
_llm_type = None  # "local" or "groq"


def _get_llm():
    """Initialize the LLM based on provider setting with fallback chain."""
    global _llm, _llm_type

    # If already loaded and matches current target, return it
    if _llm is not None and _llm_type == settings.LLM_PROVIDER:
        return _llm, _llm_type

    if settings.LLM_PROVIDER == "fallback":
        return None, None

    # 1. Try Gemini (Primary if selected)
    if settings.LLM_PROVIDER == "gemini" and settings.GEMINI_API_KEY:
        try:
            from langchain_google_genai import ChatGoogleGenerativeAI
            _llm = ChatGoogleGenerativeAI(
                model="gemini-flash-latest",
                google_api_key=settings.GEMINI_API_KEY,
                temperature=0.1,
            )
            _llm_type = "gemini"
            logger.info("[router] Using Gemini LLM (gemini-1.5-flash)")
            return _llm, _llm_type
        except Exception as e:
            logger.warning(f"[router] Gemini init failed: {e}. Falling back to Groq.")

    # 2. Try Groq (Main or Fallback)
    if (settings.LLM_PROVIDER in ("groq", "gemini")) and settings.GROQ_API_KEY:
        try:
            from langchain_groq import ChatGroq
            _llm = ChatGroq(
                model="llama-3.3-70b-versatile",
                api_key=settings.GROQ_API_KEY,
                temperature=0.1,
            )
            _llm_type = "groq"
            logger.info("[router] Using Groq LLM (llama-3.3-70b-versatile)")
            return _llm, _llm_type
        except Exception as e:
            logger.warning(f"[router] Groq init failed: {e}. Falling back to local.")

    # 3. Try Local model (Final Fallback)
    try:
        from transformers import pipeline as hf_pipeline
        import torch

        _llm = hf_pipeline(
            "text-generation",
            model=settings.LOCAL_MODEL_NAME,
            device_map="auto",
            torch_dtype=torch.float16,
            max_new_tokens=512,
        )
        _llm_type = "local"
        logger.info(f"[router] Using local LLM ({settings.LOCAL_MODEL_NAME})")
        return _llm, _llm_type
    except Exception as e:
        logger.error(f"[router] Local LLM init failed: {e}. All LLM providers exhausted.")
        return None, None


async def _llm_generate_async(prompt: str, timeout: float = 30.0) -> str:
    """Generate text using the configured LLM with an async timeout."""
    llm, llm_type = _get_llm()

    if llm is None:
        return ""

    try:
        content = ""
        if llm_type == "gemini":
            response = await asyncio.wait_for(llm.ainvoke(prompt), timeout=timeout)
            content = response.content

        elif llm_type == "groq":
            # ChatGroq has a native timeout usually, but we wrap it
            response = await asyncio.wait_for(llm.ainvoke(prompt), timeout=timeout)
            content = response.content

        elif llm_type == "local":
            loop = asyncio.get_running_loop()
            # Local transformers pipeline is synchronous
            result = await asyncio.wait_for(
                loop.run_in_executor(None, llm, prompt),
                timeout=timeout
            )
            content = result[0]["generated_text"]

        # Ensure content is a string (Gemini sometimes returns a list of parts)
        if isinstance(content, list):
            # If it's a list of parts, join them. Parts are usually dicts or strings.
            processed_parts = []
            for part in content:
                if isinstance(part, dict):
                    processed_parts.append(part.get("text", ""))
                else:
                    processed_parts.append(str(part))
            content = "".join(processed_parts)
            
        return content
            
    except asyncio.TimeoutError:
        logger.warning(f"[router] LLM generation timed out after {timeout}s")
        return ""
    except Exception as e:
        logger.error(f"[router] LLM generation error: {e}")
        return ""

    return ""


async def select_tools(ticker: str) -> list[str]:
    """Ask the LLM which tools to run for a given ticker."""
    try:
        prompt = f"{TOOL_SELECTION_PROMPT}\n\nTicker: {ticker}"
        # 15s timeout for tool selection
        response = await _llm_generate_async(prompt, timeout=15.0)

        if not response:
            logger.info("[router] No LLM response for tools, using default tool plan")
            return DEFAULT_TOOL_PLAN["tools"]

        # Parse JSON from response
        # Try to extract JSON from potential surrounding text
        json_match = response.strip()
        if "{" in json_match:
            start_idx = int(json_match.index("{"))
            end_idx = int(json_match.rindex("}")) + 1
            # pyre-ignore
            json_str = json_match[start_idx:end_idx]
            plan = json.loads(json_str)
            raw_tools = plan.get("tools", [])

            # Validate tool names
            valid_tools = {"fetch_price_data", "compute_technicals", "fetch_news",
                          "run_sentiment", "fetch_sec_filing", "retrieve_from_vector_store"}
            tools = [str(t) for t in raw_tools if str(t) in valid_tools]

            # Ensure run_sentiment has fetch_news
            if "run_sentiment" in tools and "fetch_news" not in tools:
                tools.insert(0, "fetch_news")

            if tools:
                logger.info(f"[router] LLM selected tools: {tools}")
                return tools

        logger.warning("[router] Could not parse LLM tool plan, using default")
        return DEFAULT_TOOL_PLAN["tools"]

    except Exception as e:
        logger.warning(f"[router] Tool selection error: {e}. Using default plan.")
        return DEFAULT_TOOL_PLAN["tools"]


def _run_tool(tool_name: str, ticker: str, context: dict, force_refresh: bool = False) -> tuple[str, dict]:
    """Execute a single tool and return (tool_name, result)."""
    from tools.price import fetch_price_data
    from tools.technicals import compute_technicals
    from tools.news import fetch_news
    from tools.sentiment import run_sentiment
    from tools.sec_filing import fetch_sec_filing

    start = time.time()

    try:
        result: dict[str, Any] = {}
        if tool_name == "fetch_price_data":
            result = fetch_price_data(ticker, force_refresh=force_refresh)
        elif tool_name == "compute_technicals":
            result = compute_technicals(ticker, force_refresh=force_refresh)
        elif tool_name == "fetch_news":
            result = fetch_news(ticker, force_refresh=force_refresh)
        elif tool_name == "run_sentiment":
            # Sentiment needs articles from news
            news_data = context.get("fetch_news")
            if news_data and news_data.get("articles"):
                result = run_sentiment(news_data["articles"])
            else:
                result = {"status": "UNAVAILABLE", "error": "No news articles available for sentiment"}
        elif tool_name == "fetch_sec_filing":
            result = fetch_sec_filing(ticker, force_refresh=force_refresh)
        elif tool_name == "retrieve_from_vector_store":
            from tools.vector_store import retrieve_from_vector_store
            # For query tool, use the ticker as default query if none provided in context
            query = context.get("query", f"{ticker} financial summary and risk factors")
            result = retrieve_from_vector_store(query, ticker=ticker)
        else:
            result = {"status": "UNAVAILABLE", "error": f"Unknown tool: {tool_name}"}

        latency = int(round((time.time() - start) * 1000))
        if isinstance(result, dict):
            result["_latency_ms"] = latency
            status_str = str(result.get("status"))
            logger.info(f"[router] {tool_name} completed in {latency}ms — {status_str}")
        return tool_name, result

    except Exception as e:
        logger.error(f"[router] {tool_name} failed: {e}")
        return tool_name, {"status": "UNAVAILABLE", "error": str(e)}


async def _run_tool_async(tool_name: str, ticker: str, context: dict, force_refresh: bool = False) -> tuple[str, dict]:
    """Wrap sync tool execution for asyncio.gather() with optional timeout."""
    loop = asyncio.get_running_loop()
    
    # 10s hard timeout for sentiment analysis
    if tool_name == "run_sentiment":
        try:
            return await asyncio.wait_for(
                loop.run_in_executor(None, _run_tool, tool_name, ticker, context, force_refresh),
                timeout=10.0
            )
        except asyncio.TimeoutError:
            logger.warning(f"[router] {tool_name} timed out after 10s — using neutral fallback")
            return tool_name, {
                "status": "AVAILABLE", 
                "avg_score": 0.0, 
                "overall_sentiment": "neutral",
                "error": "Timeout reached — neutral fallback used",
                "per_article": []
            }
            
    return await loop.run_in_executor(None, _run_tool, tool_name, ticker, context, force_refresh)


async def execute_tools(ticker: str, tools: list[str], force_refresh: bool = False) -> dict[str, Any]:
    """
    Execute selected tools in parallel via asyncio.gather().

    Handles dependency: run_sentiment needs fetch_news to complete first.
    """
    results = {}

    # Split into independent tools and dependent tools
    independent = [t for t in tools if t != "run_sentiment"]
    dependent = [t for t in tools if t == "run_sentiment"]

    # Phase 1: Run independent tools in parallel
    if independent:
        tasks = [_run_tool_async(t, ticker, results, force_refresh) for t in independent]
        phase1_results = await asyncio.gather(*tasks)
        for name, result in phase1_results:
            results[name] = result

    # Phase 2: Run dependent tools (sentiment needs news data)
    if dependent:
        tasks = [_run_tool_async(t, ticker, results, force_refresh) for t in dependent]
        phase2_results = await asyncio.gather(*tasks)
        for name, result in phase2_results:
            results[name] = result

    return results


async def generate_brief_text(ticker: str, tool_results: dict) -> str:
    """Use the LLM to generate the bull/bear brief text."""
    # Format tool results for the prompt
    formatted = json.dumps(
        {k: _summarize_for_prompt(k, v) for k, v in tool_results.items()},
        indent=2,
    )

    prompt = BRIEF_GENERATION_PROMPT.format(ticker=ticker, tool_results=formatted)
    # 25s timeout for brief generation
    brief_text = await _llm_generate_async(prompt, timeout=25.0)

    if not brief_text:
        logger.info("[router] No LLM response for brief, using fallback generator")
        brief_text = _generate_fallback_brief(ticker, tool_results)

    return brief_text


def _summarize_for_prompt(tool_name: str, result: dict) -> dict:
    """Trim tool results to only what the LLM needs for brief generation."""
    summary = {"status": result.get("status", "UNAVAILABLE")}

    if result.get("status") == "UNAVAILABLE":
        summary["error"] = result.get("error", "Unknown error")
        return summary

    if tool_name == "fetch_price_data":
        summary["current_price"] = result.get("current_price")
        # Last 5 data points for trend
        data = result.get("data", [])
        if data:
            summary["recent_prices"] = data[-5:]
            # Simple trend
            if len(data) >= 2:
                change = data[-1]["close"] - data[0]["close"]
                pct = (change / data[0]["close"]) * 100
                summary["period_change_pct"] = round(pct, 2)

    elif tool_name == "compute_technicals":
        summary["rsi"] = result.get("rsi")
        summary["macd"] = result.get("macd")
        summary["bollinger_bands"] = result.get("bollinger_bands")
        summary["moving_averages"] = result.get("moving_averages")
        summary["current_price"] = result.get("current_price")

    elif tool_name == "fetch_news":
        summary["article_count"] = result.get("article_count", 0)
        # Just titles and snippets
        articles = result.get("articles", [])
        summary["articles"] = [
            {"title": a.get("title", ""), "snippet": a.get("snippet", "")[:200]}
            for a in articles[:5]
        ]

    elif tool_name == "run_sentiment":
        summary["avg_score"] = result.get("avg_score")
        summary["overall_sentiment"] = result.get("overall_sentiment")
        summary["bullish_count"] = result.get("bullish_count")
        summary["bearish_count"] = result.get("bearish_count")
        summary["neutral_count"] = result.get("neutral_count")

    elif tool_name == "fetch_sec_filing":
        summary["filing_date"] = result.get("filing_date")
        # Truncate MD&A for prompt
        mda = result.get("mda_text", "")
        summary["mda_excerpt"] = mda[:2000] if mda else ""

    elif tool_name == "retrieve_from_vector_store":
        summary["query"] = result.get("query")
        results = result.get("results", [])
        summary["results"] = [
            {"text": r["text"][:300], "doc_type": r["metadata"].get("doc_type")}
            for r in results[:3]
        ]

    return summary


def _generate_fallback_brief(ticker: str, tool_results: dict) -> str:
    """Generate a rich brief without LLM — pure data-driven with high signal density."""
    lines = []

    # Bull case
    lines.append("BULL CASE")
    bull_points = []

    technicals = tool_results.get("compute_technicals", {})
    price = tool_results.get("fetch_price_data", {})
    sentiment = tool_results.get("run_sentiment", {})
    sec = tool_results.get("fetch_sec_filing", {})

    if technicals.get("status") in ("AVAILABLE", "CACHED"):
        rsi = technicals.get("rsi", {})
        rsi_val = rsi.get("value", 50)
        if rsi.get("interpretation") == "oversold":
            bull_points.append(f"- RSI oversold ({rsi_val}): Potential for immediate price reversal/bounce")
        elif rsi_val < 45:
            bull_points.append(f"- RSI cooling ({rsi_val}): Downside momentum slowing, entering accumulation zone")
        
        ma = technicals.get("moving_averages", {})
        if "bullish" in ma.get("price_vs_200ma", ""):
            bull_points.append(f"- Long-term support: Price holding above 200-day MA (${ma.get('ma_200')})")
        if "bullish" in ma.get("price_vs_50ma", ""):
            bull_points.append(f"- Mid-term strength: Price trading above 50-day MA (${ma.get('ma_50')})")
        
        macd = technicals.get("macd", {})
        if macd.get("interpretation") == "bullish":
            bull_points.append(f"- MACD bullish: Positive crossover detected (MACD: {macd.get('macd'):.2f})")

    # --- Sentiment Stability ---
    if sentiment.get("status") in ("AVAILABLE", "CACHED"):
        avg_score = sentiment.get("avg_score", 0)
        if sentiment.get("overall_sentiment") == "bullish":
            bull_points.append(
                f"- News sentiment positive: Average score {avg_score:.2f} across "
                f"{sentiment.get('bullish_count')} bullish articles"
            )
        elif avg_score >= 0:
            bull_points.append(f"- Sentiment stability: News flow remains resilient with minimal negative tail-risk")

    if price.get("status") in ("AVAILABLE", "CACHED"):
        data = price.get("data", [])
        if len(data) >= 2:
            change = ((data[-1]["close"] - data[0]["close"]) / data[0]["close"]) * 100
            if change > 0:
                bull_points.append(f"- Price velocity: Up {change:.1f}% over the analyzed period")
            else:
                bull_points.append("- Mean reversion: Price trading at discount relative to period start")

    # Dedup by signal title
    seen_bull = set()
    final_bull = []
    for p in bull_points:
        title = p.split(':')[0].strip('- ').upper()
        if title not in seen_bull:
            final_bull.append(p)
            seen_bull.add(title)

    if not final_bull:
        final_bull = ["- Insufficient data: No bullish signals detected from available sources"]

    lines.extend(final_bull)
    lines.append("")

    # Bear case
    lines.append("BEAR CASE")
    bear_points = []

    if technicals.get("status") in ("AVAILABLE", "CACHED"):
        rsi = technicals.get("rsi", {})
        rsi_val = rsi.get("value", 50)
        if rsi.get("interpretation") == "overbought":
            bear_points.append(f"- RSI overbought ({rsi_val}): Significant risk of technical pullback/correction")
        elif rsi_val > 65:
            bear_points.append(f"- RSI elevated ({rsi_val}): Approaching overbought exhaustion territory")
            
        ma = technicals.get("moving_averages", {})
        if "bearish" in ma.get("price_vs_200ma", ""):
            bear_points.append(f"- Long-term weakness: Trading below major 200-day MA resistance")
        
        macd = technicals.get("macd", {})
        if macd.get("interpretation") == "bearish":
            bear_points.append(f"- MACD bearish: Negative crossover (MACD: {macd.get('macd'):.2f}) indicates declining momentum")

    # --- Sentiment Caution ---
    if sentiment.get("status") in ("AVAILABLE", "CACHED"):
        avg_score = sentiment.get("avg_score", 0)
        if sentiment.get("overall_sentiment") == "bearish":
            bear_points.append(
                f"- News sentiment negative: Average score {avg_score:.2f} driven by {sentiment.get('bearish_count')} bearish reports"
            )
        elif avg_score < 0: # Mutually exclusive with stability (>= 0)
            bear_points.append(f"- Sentiment caution: News environment remains cautious or lacks positive catalysts")

    if price.get("status") in ("AVAILABLE", "CACHED"):
        data = price.get("data", [])
        if len(data) >= 2:
            change = ((data[-1]["close"] - data[0]["close"]) / data[0]["close"]) * 100
            if change < 0:
                bear_points.append(f"- Negative trend: Price down {abs(change):.1f}% over current window")
            elif change > 8:
                bear_points.append(f"- Parabolic risk: Price up {change:.1f}% rapidly, increasing reversal probability")

    # Dedup by signal title
    seen_bear = set()
    final_bear = []
    for p in bear_points:
        title = p.split(':')[0].strip('- ').upper()
        if title not in seen_bear:
            final_bear.append(p)
            seen_bear.add(title)

    if not final_bear:
        final_bear = ["- Insufficient data: No bearish signals detected from available sources"]

    lines.extend(final_bear)


    lines.append("")

    # Signal conflicts
    lines.append("SIGNAL CONFLICTS")
    conflicts = detect_conflicts(tool_results)
    if conflicts:
        for c in conflicts:
            lines.append(f"⚠ {c}")
    else:
        lines.append("- No immediate source contradictions detected")

    return "\n".join(lines)



async def analyze_ticker(ticker: str, force_refresh: bool = False) -> dict[str, Any]:
    """
    Full analysis pipeline: select tools → execute → build brief.
    """
    ticker = ticker.upper().strip()
    
    # Check cache unless forcing refresh
    if not force_refresh:
        from cache.store import get_latest_brief
        cached_result = get_latest_brief(ticker)
        if cached_result:
            return cached_result.get("brief")

    start_time = time.time()

    # Step 1: Select tools
    tools = await select_tools(ticker)
    logger.info(f"[router] Analyzing {ticker} with tools: {tools}")

    # Step 2: Execute tools in parallel
    tool_results = await execute_tools(ticker, tools, force_refresh=force_refresh)

    # Step 3: Generate brief text
    brief_text = await generate_brief_text(ticker, tool_results)

    # Step 4: Compute confidence
    from brief.confidence import compute_confidence
    confidence_result = compute_confidence(tool_results)

    # Step 5: Detect conflicts
    conflicts = detect_conflicts(tool_results)

    # Step 6: Build source availability snapshot
    sources_snapshot = {}
    for tool_name, result in tool_results.items():
        sources_snapshot[tool_name] = {
            "status": result.get("status", "UNAVAILABLE"),
            "latency_ms": result.get("_latency_ms"),
        }

    price_data = tool_results.get("fetch_price_data", {})
    current_price = price_data.get("current_price")

    net_signal = _determine_net_signal(tool_results, conflicts)
    total_latency = round((time.time() - start_time) * 1000)
    llm_generated = bool(brief_text) and not brief_text.startswith("BULL CASE")
    signals = _build_structured_signals(tool_results)

    brief = {
        "ticker": ticker,
        "date": time.strftime("%Y-%m-%d"),
        "created_at": time.time(),
        "brief_text": brief_text,
        "confidence": confidence_result,
        "conflicts": conflicts,
        "data_availability": sources_snapshot,
        "tool_results": tool_results,
        "net_signal": net_signal,
        "bias": net_signal.upper().replace('_', ' '),
        "current_price": current_price,
        "total_latency_ms": total_latency,
        "llm_generated": llm_generated,
        "signals": signals,
    }

    from cache.store import save_brief
    save_brief(ticker, brief)

    return brief


def _determine_net_signal(tool_results: dict, conflicts: list[str]) -> str:
    """Determine overall bull/bear/neutral signal."""
    signals = []

    # Technical signals
    technicals = tool_results.get("compute_technicals", {})
    if technicals.get("status") in ("AVAILABLE", "CACHED"):
        rsi = technicals.get("rsi", {})
        if rsi.get("interpretation") == "overbought":
            signals.append(-1)
        elif rsi.get("interpretation") == "oversold":
            signals.append(1)

        macd = technicals.get("macd", {})
        if macd.get("interpretation") == "bullish":
            signals.append(1)
        elif macd.get("interpretation") == "bearish":
            signals.append(-1)

    # Sentiment signals
    sentiment = tool_results.get("run_sentiment", {})
    if sentiment.get("status") in ("AVAILABLE", "CACHED"):
        if sentiment.get("overall_sentiment") == "bullish":
            signals.append(1)
        elif sentiment.get("overall_sentiment") == "bearish":
            signals.append(-1)

    # Price trend
    price = tool_results.get("fetch_price_data", {})
    if price.get("status") in ("AVAILABLE", "CACHED"):
        data = price.get("data", [])
        if len(data) >= 2:
            change = data[-1]["close"] - data[0]["close"]
            if change > 0:
                signals.append(1)
            elif change < 0:
                signals.append(-1)

    if not signals:
        return "neutral"

    avg = sum(signals) / len(signals)
    has_conflicts = len(conflicts) > 0
    bear_count = sum(1 for s in signals if s < 0)
    bull_count = sum(1 for s in signals if s > 0)

    if avg > 0.6:
        # Downgrade if any friction exists
        if has_conflicts or bear_count > 0:
            return "mildly_bullish"
        return "strongly_bullish"
    elif avg > 0.1:
        return "mildly_bullish"
    elif avg < -0.6:
        # Downgrade if any friction exists
        if has_conflicts or bull_count > 0:
            return "mildly_bearish"
        return "strongly_bearish"
    elif avg < -0.1:
        return "mildly_bearish"
    else:
        return "neutral"



def _build_structured_signals(tool_results: dict) -> list[dict]:
    """Build a structured list of signals with their raw evidence (sources)."""
    signals = []

    # 1. Technical Signals
    tech = tool_results.get("compute_technicals", {})
    if tech.get("status") in ("AVAILABLE", "CACHED"):
        # RSI
        rsi = tech.get("rsi", {})
        rsi_val = rsi.get('value', 50)
        if rsi.get("interpretation") == "oversold":
            signals.append({
                "title": "RSI OVERSOLD",
                "description": f"Condition ({rsi_val:.1f}): Potential reversal zone detected.",
                "type": "bull",
                "status": tech.get("status").lower(),
                "source_type": "yfinance",
                "sources": [{"label": "RSI (14)", "value": f"{rsi_val:.1f}", "threshold": "30.0"}]
            })
        elif rsi.get("interpretation") == "overbought":
            signals.append({
                "title": "RSI OVERBOUGHT",
                "description": f"Condition ({rsi_val:.1f}): Exhaustion risk detected.",
                "type": "bear",
                "status": tech.get("status").lower(),
                "source_type": "yfinance",
                "sources": [{"label": "RSI (14)", "value": f"{rsi_val:.1f}", "threshold": "70.0"}]
            })
        else:
            if 40 <= rsi_val <= 60:
                signals.append({
                    "title": "RSI NEUTRAL",
                    "description": f"Momentum balanced at {rsi_val:.1f}.",
                    "type": "bull",
                    "status": tech.get("status").lower(),
                    "source_type": "yfinance",
                    "sources": [{"label": "RSI (14)", "value": f"{rsi_val:.1f}", "threshold": "30-70"}]
                })
            elif 60 < rsi_val < 70:
                signals.append({
                    "title": "RSI ELEVATED",
                    "description": f"Momentum increasing at {rsi_val:.1f}, approaching overbought.",
                    "type": "bear",
                    "status": tech.get("status").lower(),
                    "source_type": "yfinance",
                    "sources": [{"label": "RSI (14)", "value": f"{rsi_val:.1f}", "threshold": "60.0"}]
                })
            elif 30 < rsi_val < 40:
                signals.append({
                    "title": "RSI COOL",
                    "description": f"Momentum cooling at {rsi_val:.1f}, approaching oversold.",
                    "type": "bull",
                    "status": tech.get("status").lower(),
                    "source_type": "yfinance",
                    "sources": [{"label": "RSI (14)", "value": f"{rsi_val:.1f}", "threshold": "40.0"}]
                })

        # MACD
        macd = tech.get("macd", {})
        if macd.get("interpretation") == "bullish":
            signals.append({
                "title": "MACD BULLISH",
                "description": f"Positive crossover (MACD: {macd.get('macd', 0):.2f})",
                "type": "bull",
                "status": tech.get("status").lower(),
                "source_type": "yfinance",
                "sources": [{"label": "MACD Value", "value": f"{macd.get('macd', 0):.2f}"}]
            })
        elif macd.get("interpretation") == "bearish":
            signals.append({
                "title": "MACD BEARISH",
                "description": f"Negative crossover (MACD: {macd.get('macd', 0):.2f})",
                "type": "bear",
                "status": tech.get("status").lower(),
                "source_type": "yfinance",
                "sources": [{"label": "MACD Value", "value": f"{macd.get('macd', 0):.2f}"}]
            })

        # Bollinger Bands
        bb = tech.get("bollinger_bands", {})
        if "above upper" in bb.get("price_position", ""):
            signals.append({
                "title": "BOLLINGER EXHAUSTION",
                "description": "Price trading above upper volatility band; mean reversion risk.",
                "type": "bear",
                "status": tech.get("status").lower(),
                "source_type": "yfinance",
                "sources": [{"label": "Upper Band", "value": f"${bb.get('upper', 0):.2f}"}]
            })
        elif "below lower" in bb.get("price_position", ""):
            signals.append({
                "title": "BOLLINGER SUPPORT",
                "description": "Price trading below lower volatility band; mean reversion potential.",
                "type": "bull",
                "status": tech.get("status").lower(),
                "source_type": "yfinance",
                "sources": [{"label": "Lower Band", "value": f"${bb.get('lower', 0):.2f}"}]
            })
        else:
            signals.append({
                "title": "BOLLINGER STABLE",
                "description": "Price trading within normal volatility bands.",
                "type": "bull",
                "status": tech.get("status").lower(),
                "source_type": "yfinance",
                "sources": [{"label": "Upper Band", "value": f"${bb.get('upper', 0):.2f}"}, {"label": "Lower Band", "value": f"${bb.get('lower', 0):.2f}"}]
            })

        # Moving Averages
        ma = tech.get("moving_averages", {})
        if "bullish" in ma.get("price_vs_200ma", ""):
            signals.append({
                "title": "LONG-TERM SUPPORT",
                "description": f"Holding above 200-day MA (${ma.get('ma_200', 0):.2f})",
                "type": "bull",
                "status": tech.get("status").lower(),
                "source_type": "yfinance",
                "sources": [{"label": "MA 200", "value": f"${ma.get('ma_200', 0):.2f}"}]
            })
        elif "bearish" in ma.get("price_vs_200ma", ""):
            signals.append({
                "title": "LONG-TERM WEAKNESS",
                "description": f"Trading below 200-day MA (${ma.get('ma_200', 0):.2f})",
                "type": "bear",
                "status": tech.get("status").lower(),
                "source_type": "yfinance",
                "sources": [{"label": "MA 200", "value": f"${ma.get('ma_200', 0):.2f}"}]
            })

        if "bullish" in ma.get("price_vs_50ma", ""):
            signals.append({
                "title": "MID-TERM STRENGTH",
                "description": f"Trading above 50-day MA (${ma.get('ma_50', 0):.2f})",
                "type": "bull",
                "status": tech.get("status").lower(),
                "source_type": "yfinance",
                "sources": [{"label": "MA 50", "value": f"${ma.get('ma_50', 0):.2f}"}]
            })
        elif "bearish" in ma.get("price_vs_50ma", ""):
            signals.append({
                "title": "MID-TERM WEAKNESS",
                "description": f"Trading below 50-day MA (${ma.get('ma_50', 0):.2f})",
                "type": "bear",
                "status": tech.get("status").lower(),
                "source_type": "yfinance",
                "sources": [{"label": "MA 50", "value": f"${ma.get('ma_50', 0):.2f}"}]
            })

    # 2. Price Velocity Signals
    price = tool_results.get("fetch_price_data", {})
    if price.get("status") in ("AVAILABLE", "CACHED"):
        data = price.get("data", [])
        if len(data) >= 2:
            change_pct = ((data[-1]["close"] - data[0]["close"]) / data[0]["close"]) * 100
            if change_pct > 8:
                signals.append({
                    "title": "PARABOLIC VELOCITY",
                    "description": f"Rapid {change_pct:.1f}% ascent increases technical pullback risk.",
                    "type": "bear",
                    "status": price.get("status").lower(),
                    "source_type": "yfinance",
                    "sources": [{"label": "Price Velocity", "value": f"+{change_pct:.1f}%"}]
                })
            elif change_pct > 2:
                signals.append({
                    "title": "POSITIVE TREND",
                    "description": f"Price is up {change_pct:.1f}% over the period.",
                    "type": "bull",
                    "status": price.get("status").lower(),
                    "source_type": "yfinance",
                    "sources": [{"label": "Price Velocity", "value": f"+{change_pct:.1f}%"}]
                })
            elif change_pct < -8:
                signals.append({
                    "title": "SEVERE DOWNTREND",
                    "description": f"Rapid {change_pct:.1f}% decline indicates strong selling pressure.",
                    "type": "bear",
                    "status": price.get("status").lower(),
                    "source_type": "yfinance",
                    "sources": [{"label": "Price Velocity", "value": f"{change_pct:.1f}%"}]
                })
            elif change_pct < -2:
                signals.append({
                    "title": "NEGATIVE TREND",
                    "description": f"Price is down {abs(change_pct):.1f}% over the period.",
                    "type": "bear",
                    "status": price.get("status").lower(),
                    "source_type": "yfinance",
                    "sources": [{"label": "Price Velocity", "value": f"{change_pct:.1f}%"}]
                })
            else:
                signals.append({
                    "title": "PRICE CONSOLIDATION",
                    "description": f"Price is mostly flat ({change_pct:.1f}%) over the period.",
                    "type": "bull" if change_pct >= 0 else "bear",
                    "status": price.get("status").lower(),
                    "source_type": "yfinance",
                    "sources": [{"label": "Price Velocity", "value": f"{change_pct:.1f}%"}]
                })

    # 3. Sentiment Signals
    sent = tool_results.get("run_sentiment", {})
    news = tool_results.get("fetch_news", {})
    if sent.get("status") in ("AVAILABLE", "CACHED") and news.get("status") in ("AVAILABLE", "CACHED"):
        articles = news.get("articles", [])
        per_article = sent.get("per_article", [])
        
        # Merge sentiment scores onto articles by title
        for a in articles:
            for p in per_article:
                if a.get("title") == p.get("title"):
                    a["sentiment_score"] = p.get("net_score", 0)
                    break
        
        # Bullish News (if any)
        if sent.get("bullish_count", 0) > 0:
            top_bullish = sorted(
                [a for a in articles if a.get("sentiment_score", 0) > 0.1],
                key=lambda x: x.get("sentiment_score", 0),
                reverse=True
            )[:3]
            if top_bullish:
                signals.append({
                    "title": "POSITIVE SENTIMENT",
                    "description": f"Detected {sent.get('bullish_count')} bullish news reports.",
                    "type": "bull",
                    "status": sent.get("status").lower(),
                    "source_type": "tavily",
                    "sources": [{"headline": a.get("title"), "outlet": a.get("source", "News Outlet"), "sentiment_score": a.get("sentiment_score")} for a in top_bullish]
                })

        # Bearish News (if any)
        if sent.get("bearish_count", 0) > 0:
            top_bearish = sorted(
                [a for a in articles if a.get("sentiment_score", 0) < -0.1],
                key=lambda x: x.get("sentiment_score", 0)
            )[:3]
            if top_bearish:
                signals.append({
                    "title": "BEARISH FRICTION",
                    "description": f"Detected {sent.get('bearish_count')} reports flagging caution or headwinds.",
                    "type": "bear",
                    "status": sent.get("status").lower(),
                    "source_type": "tavily",
                    "sources": [{"headline": a.get("title"), "outlet": a.get("source", "News Outlet"), "sentiment_score": a.get("sentiment_score")} for a in top_bearish]
                })

    return signals


# ---------- SSE Streaming ----------

async def _run_tool_with_events(
    tool_name: str,
    ticker: str,
    context: dict[str, Any],
    queue: asyncio.Queue,  # type: ignore[type-arg]
    force_refresh: bool = False,
) -> tuple[str, dict[str, Any]]:
    """Run a tool and push status events into the queue."""
    await queue.put({"type": "status", "tool": tool_name, "state": "running"})

    loop = asyncio.get_running_loop()

    try:
        if tool_name == "run_sentiment":
            name, result = await asyncio.wait_for(
                loop.run_in_executor(None, _run_tool, tool_name, ticker, context, force_refresh),
                timeout=10.0
            )
        else:
            name, result = await loop.run_in_executor(None, _run_tool, tool_name, ticker, context, force_refresh)
    except asyncio.TimeoutError:
        logger.warning(f"[stream] {tool_name} timed out — using neutral fallback")
        name = tool_name
        result = {
            "status": "AVAILABLE", 
            "avg_score": 0.0, 
            "overall_sentiment": "neutral",
            "error": "Timeout reached — neutral fallback used",
            "_latency_ms": 10000
        }

    latency = result.get("_latency_ms", 0)
    status = str(result.get("status", "UNAVAILABLE"))

    if status in ("AVAILABLE", "CACHED"):
        await queue.put({
            "type": "status",
            "tool": tool_name,
            "state": "done",
            "status": status,
            "latency_ms": latency,
            "result": result
        })
    else:
        await queue.put({
            "type": "status",
            "tool": tool_name,
            "state": "failed",
            "error": str(result.get("error", "Unknown")),
            "latency_ms": latency,
        })

    return name, result


async def analyze_ticker_streaming(
    ticker: str,
    queue: asyncio.Queue,  # type: ignore[type-arg]
    force_refresh: bool = False,
) -> None:
    """
    Full analysis pipeline with SSE event streaming.

    Pushes events into `queue` as tools transition through states:
      pending → running → done/failed
    Final events: brief (full JSON), then done (stream close signal).
    """
    ticker = ticker.upper().strip()
    created_at = time.time()
    start_time = time.time()

    # Step 0: Check Cache
    if not force_refresh:
        from cache.store import get_latest_brief
        cached_result = get_latest_brief(ticker)
        if cached_result:
            # Check if cache is fresh (less than 1 hour)
            if (time.time() - cached_result.get("created_at", 0)) < 3600:
                logger.info(f"[stream] Returning cached brief for {ticker}")
                # The 'brief' key contains the full enriched brief object
                await queue.put({"type": "brief", "data": cached_result.get("brief")})
                await queue.put({"type": "done"})
                return

    try:
        # Step 0: Emit immediate initialization state for the UI
        initial_tools = DEFAULT_TOOL_PLAN["tools"]
        for t in initial_tools:
            await queue.put({"type": "status", "tool": t, "state": "pending", "status": "INITIALIZING"})

        # Step 1: Select tools
        try:
            tools = await select_tools(ticker)
        except Exception as e:
            logger.error(f"[stream] Tool selection failed: {e}. Falling back to default.")
            tools = initial_tools

        logger.info(f"[stream] Analyzing {ticker} with tools: {tools}")
        results = {}

        # Step 2: Execute tools
        independent = [t for t in tools if t != "run_sentiment"]
        if independent:
            tasks = [_run_tool_with_events(t, ticker, results, queue, force_refresh) for t in independent]
            phase1 = await asyncio.gather(*tasks)
            for name, result in phase1:
                results[name] = result

        if "run_sentiment" in tools:
            name, result = await _run_tool_with_events("run_sentiment", ticker, results, queue, force_refresh)
            results[name] = result

        # Step 3: Synthesis
        brief_text = await generate_brief_text(ticker, results)

        # Step 4: Confidence + conflicts
        from brief.confidence import compute_confidence
        confidence_result = compute_confidence(results)
        conflicts = detect_conflicts(results)

        # Step 5: Construction
        sources_snapshot = {}
        for tool_name, result in results.items():
            sources_snapshot[tool_name] = {
                "status": result.get("status", "UNAVAILABLE"),
                "latency_ms": result.get("_latency_ms"),
            }

        price_data = results.get("fetch_price_data", {})
        current_price = price_data.get("current_price")
        net_signal = _determine_net_signal(results, conflicts)
        bias = net_signal.upper().replace('_', ' ')
        total_latency = int(round((time.time() - start_time) * 1000))
        llm_generated = brief_text is not None and not brief_text.startswith("BULL CASE")
        signals = _build_structured_signals(results)

        brief = {
            "ticker": ticker,
            "date": time.strftime("%Y-%m-%d"),
            "created_at": created_at,
            "brief_text": brief_text,
            "confidence": confidence_result,
            "conflicts": conflicts,
            "data_availability": sources_snapshot,
            "tool_results": results,
            "net_signal": net_signal,
            "bias": bias,
            "current_price": current_price,
            "total_latency_ms": total_latency,
            "llm_generated": llm_generated,
            "signals": signals,
        }

        # Save and emit
        from cache.store import save_brief
        save_brief(ticker, brief)
        await queue.put({"type": "brief", "data": brief})

    except Exception as e:
        logger.error(f"[stream] Fatal pipeline crash: {e}", exc_info=True)
        await queue.put({"type": "error", "message": f"Critical pipeline failure: {str(e)}"})
    finally:
        await queue.put({"type": "done"})
