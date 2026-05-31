"""Sentiment scoring using FinBERT."""

import logging
from typing import Any

logger = logging.getLogger(__name__)

# Lazy-loaded model — only initialized on first call to save memory
_sentiment_pipeline = None


def _get_pipeline():
    """Lazy-load the FinBERT sentiment pipeline."""
    global _sentiment_pipeline
    if _sentiment_pipeline is None:
        from transformers import pipeline

        logger.info("[sentiment] Loading ProsusAI/finbert model (first call)...")
        _sentiment_pipeline = pipeline(
            "text-classification",
            model="ProsusAI/finbert",
            top_k=None,  # return all labels with scores
        )
        logger.info("[sentiment] FinBERT loaded successfully")
    return _sentiment_pipeline


def prewarm() -> None:
    """Load FinBERT into memory. Call once at startup to avoid first-request delay."""
    try:
        _get_pipeline()
        logger.info("[sentiment] FinBERT pre-warmed successfully")
    except Exception as e:
        logger.warning(f"[sentiment] Pre-warm failed (non-critical): {e}")


def run_sentiment(articles: list[dict]) -> dict[str, Any]:
    """
    Score sentiment for a list of news articles using FinBERT.

    Args:
        articles: List of dicts with at least a "snippet" or "title" field.

    Returns:
        Dict with per-article scores and aggregate summary.
    """
    if not articles:
        return {
            "per_article": [],
            "avg_score": 0.0,
            "bullish_count": 0,
            "bearish_count": 0,
            "neutral_count": 0,
            "overall_sentiment": "neutral",
            "status": "AVAILABLE",
        }

    try:
        pipe = _get_pipeline()

        # Build text list, preserving article order
        texts = []
        valid_articles = []
        for article in articles:
            text = (article.get("snippet") or article.get("title", ""))[:512]
            if text:
                texts.append(text)
                valid_articles.append(article)

        if not texts:
            return {
                "per_article": [], "avg_score": 0.0, "bullish_count": 0,
                "bearish_count": 0, "neutral_count": 0,
                "overall_sentiment": "neutral", "status": "AVAILABLE",
            }

        # Batch inference — single forward pass for all articles
        batch_results = pipe(texts, batch_size=8)

        per_article = []
        scores = []

        for article, result in zip(valid_articles, batch_results):
            label_scores = {item["label"]: item["score"] for item in result}

            positive = label_scores.get("positive", 0)
            negative = label_scores.get("negative", 0)
            neutral = label_scores.get("neutral", 0)

            # Net score: +1 (bullish) to -1 (bearish)
            net_score = positive - negative

            dominant = max(label_scores, key=lambda k: label_scores[k])

            per_article.append({
                "title": article.get("title", ""),
                "positive": round(positive, 4),
                "negative": round(negative, 4),
                "neutral": round(neutral, 4),
                "net_score": round(net_score, 4),
                "label": dominant,
            })
            scores.append(net_score)

        # Aggregates
        if scores:
            avg_score = float(sum(scores)) / len(scores)
        else:
            avg_score = 0.0
        bullish_count = sum(1 for s in scores if s > 0.1)
        bearish_count = sum(1 for s in scores if s < -0.1)
        neutral_count = len(scores) - bullish_count - bearish_count

        if avg_score > 0.1:
            overall = "bullish"
        elif avg_score < -0.1:
            overall = "bearish"
        else:
            overall = "neutral"

        return {
            "per_article": per_article,
            "avg_score": round(avg_score, 4),
            "bullish_count": bullish_count,
            "bearish_count": bearish_count,
            "neutral_count": neutral_count,
            "overall_sentiment": overall,
            "status": "AVAILABLE",
        }

    except Exception as e:
        logger.error(f"[sentiment] Error: {e}")
        return {
            "per_article": [],
            "avg_score": 0.0,
            "bullish_count": 0,
            "bearish_count": 0,
            "neutral_count": 0,
            "overall_sentiment": "unknown",
            "status": "UNAVAILABLE",
            "error": str(e),
        }
