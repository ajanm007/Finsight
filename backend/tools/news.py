"""Fetch financial news via Tavily (primary) + NewsAPI.org (supplementary)."""

import logging
import time
from datetime import datetime, timedelta
from typing import Any

import httpx

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


def _fetch_newsapi(ticker: str, days: int = 14) -> list[dict]:
    """Supplementary news fetch from NewsAPI.org."""
    if not settings.NEWSAPI_KEY:
        return []
    try:
        from_date = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")
        search_ticker = ticker[:-3] if ticker.endswith((".NS", ".BO")) else ticker
        resp = httpx.get(
            "https://newsapi.org/v2/everything",
            params={
                "q": f"{search_ticker} stock",
                "language": "en",
                "sortBy": "publishedAt",
                "from": from_date,
                "pageSize": 10,
                "apiKey": settings.NEWSAPI_KEY,
            },
            timeout=10,
        )
        resp.raise_for_status()
        articles = []
        for a in resp.json().get("articles", []):
            articles.append({
                "title": a.get("title", ""),
                "url": a.get("url", ""),
                "snippet": (a.get("description") or a.get("content") or "")[:500],
                "published_date": (a.get("publishedAt") or "")[:10],
                "source": a.get("source", {}).get("name", ""),
            })
        return articles
    except Exception as e:
        logger.warning(f"[news] NewsAPI fetch failed for {ticker}: {e}")
        return []


def fetch_news(ticker: str, days: int = 14, force_refresh: bool = False) -> dict[str, Any]:
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
        search_ticker = ticker[:-3] if ticker.endswith((".NS", ".BO")) else ticker
        response = client.search(
            query=f"{search_ticker} stock news financial analysis",
            search_depth="advanced",
            max_results=15,
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

        # Supplement with NewsAPI (deduplicate by URL)
        newsapi_articles = _fetch_newsapi(ticker, days=days)
        if newsapi_articles:
            existing_urls = {a["url"] for a in articles}
            new_articles = [a for a in newsapi_articles if a["url"] not in existing_urls]
            articles.extend(new_articles)
            if new_articles:
                logger.info(f"[news] Added {len(new_articles)} articles from NewsAPI for {ticker}")

        result = {
            "ticker": ticker.upper(),
            "articles": articles,
            "article_count": len(articles),
            "status": "AVAILABLE",
            "source": "tavily",
        }

        try:
            from tools.vector_store import embed_document
            for article in articles:
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
            search_ticker = ticker[:-3] if ticker.endswith((".NS", ".BO")) else ticker
            response = client.search(
                query=f"{search_ticker} stock news",
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
