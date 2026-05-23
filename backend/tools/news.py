"""Fetch financial news via Tavily search API."""

import logging
import time
from typing import Any

from cache.store import get_cached, set_cached
from config import settings

logger = logging.getLogger(__name__)

SOURCE_NAME = "news"

# Mock data for when Tavily API key is unavailable
MOCK_ARTICLES = [
    {
        "title": "Stock Shows Strong Momentum Amid Market Rally",
        "url": "https://example.com/article1",
        "snippet": "The stock has been gaining momentum as institutional investors increase positions.",
        "published_date": "2026-03-25",
    },
    {
        "title": "Analyst Upgrades Rating, Citing Revenue Growth",
        "url": "https://example.com/article2",
        "snippet": "Major analyst firms have upgraded the rating following strong quarterly earnings report.",
        "published_date": "2026-03-24",
    },
    {
        "title": "Concerns Over Valuation as P/E Ratio Climbs",
        "url": "https://example.com/article3",
        "snippet": "Some analysts express caution as the valuation multiples reach historically high levels.",
        "published_date": "2026-03-23",
    },
]


def fetch_news(ticker: str, days: int = 7, force_refresh: bool = False) -> dict[str, Any]:
    """
    Fetch recent financial news for a ticker via Tavily.
    """
    # Check cache
    if not force_refresh:
        cached = get_cached(ticker, SOURCE_NAME)
        if cached is not None:
            logger.info(f"[news] Cache hit for {ticker}")
            cached["status"] = "CACHED"
            return cached

    # No API key — return mock
    if not settings.TAVILY_API_KEY:
        logger.warning("[news] No TAVILY_API_KEY — returning mock data")
        result = {
            "ticker": ticker.upper(),
            "articles": MOCK_ARTICLES,
            "article_count": len(MOCK_ARTICLES),
            "status": "AVAILABLE",
            "source": "mock",
        }
        return result

    # Live fetch from Tavily
    try:
        from tavily import TavilyClient

        client = TavilyClient(api_key=settings.TAVILY_API_KEY)
        response = client.search(
            query=f"{ticker} stock news financial analysis",
            search_depth="advanced",
            max_results=10,
            days=days,
        )

        articles = []
        for result_item in response.get("results", []):
            articles.append({
                "title": result_item.get("title", ""),
                "url": result_item.get("url", ""),
                "snippet": result_item.get("content", "")[:500],
                "published_date": result_item.get("published_date", ""),
            })

        result = {
            "ticker": ticker.upper(),
            "articles": articles,
            "article_count": len(articles),
            "status": "AVAILABLE",
            "source": "tavily",
        }

        # Step 5: Embed in vector store
        try:
            from tools.vector_store import embed_document
            for article in articles:
                # Combine title and snippet for better semantic search
                combined_content = f"{article['title']} - {article['snippet']}"
                embed_document(ticker, SOURCE_NAME, combined_content, {"url": article["url"], "published_date": article["published_date"]})
        except Exception as ve:
            logger.warning(f"[news] Vector embedding failed (non-critical): {ve}")

        set_cached(ticker, SOURCE_NAME, result)
        logger.info(f"[news] Fetched {len(articles)} articles for {ticker}")
        return result

    except Exception as e:
        logger.warning(f"[news] First attempt failed for {ticker}: {e}. Retrying in 2s...")

        # Retry once after 2s
        time.sleep(2)
        try:
            from tavily import TavilyClient

            client = TavilyClient(api_key=settings.TAVILY_API_KEY)
            response = client.search(
                query=f"{ticker} stock news",
                search_depth="basic",
                max_results=5,
                days=days,
            )

            articles = []
            for result_item in response.get("results", []):
                articles.append({
                    "title": result_item.get("title", ""),
                    "url": result_item.get("url", ""),
                    "snippet": result_item.get("content", "")[:500],
                    "published_date": result_item.get("published_date", ""),
                })

            result = {
                "ticker": ticker.upper(),
                "articles": articles,
                "article_count": len(articles),
                "status": "AVAILABLE",
                "source": "tavily",
            }

            set_cached(ticker, SOURCE_NAME, result)
            return result

        except Exception as e2:
            logger.error(f"[news] Retry failed for {ticker}: {e2}")
            
            # Fallback to vector store if all live attempts fail
            try:
                from tools.vector_store import retrieve_from_vector_store
                vector_res = retrieve_from_vector_store(f"{ticker} stock market news", ticker=ticker)
                if vector_res["status"] == "AVAILABLE":
                    logger.info(f"[news] Vector store hit for {ticker}")
                    articles = []
                    for r in vector_res["results"]:
                        meta = r["metadata"]
                        articles.append({
                            "title": r["text"].split(" - ")[0],
                            "snippet": r["text"].split(" - ")[1] if " - " in r["text"] else r["text"],
                            "url": meta.get("url", ""),
                            "published_date": meta.get("published_date", "")
                        })
                    
                    return {
                        "ticker": ticker.upper(),
                        "articles": articles,
                        "article_count": len(articles),
                        "status": "CACHED",
                        "source": "vector_store",
                        "_age_seconds": time.time() - vector_res["results"][0]["metadata"].get("timestamp", time.time())
                    }
            except Exception as ve:
                logger.warning(f"[news] Vector fallback failed: {ve}")

            return {
                "ticker": ticker.upper(),
                "articles": [],
                "article_count": 0,
                "status": "UNAVAILABLE",
                "error": str(e2),
            }
