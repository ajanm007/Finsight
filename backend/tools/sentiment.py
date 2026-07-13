"""Sentiment scoring using FinBERT.

Two interchangeable backends, selected by `settings.SENTIMENT_BACKEND`:

- "local" (default): loads ProsusAI/finbert in-process via `transformers`
  (~2GB RAM, no network). Best when RAM is plentiful.
- "api": calls the HuggingFace serverless Inference API. Keeps the process
  small (~300MB) so it fits low-RAM hosts (Render/Fly free tiers). Requires
  `HF_TOKEN` with the "Inference Providers" permission.

Both backends expose the same seam: `_get_pipeline()` returns a callable with
signature `pipe(texts: list[str], batch_size: int = 8) -> list[list[dict]]`,
where each inner list is `[{"label": str, "score": float}, ...]` covering all
three FinBERT labels. `run_sentiment()` is backend-agnostic — it only consumes
that shape, so downstream (router, brief, confidence, conflicts) is unaffected.
"""

import logging
from typing import Any

from config import settings

logger = logging.getLogger(__name__)

HF_INFERENCE_URL = "https://api-inference.huggingface.co/models/{model}"

# Cached backend callable — built once on first use to avoid reloading the model
# (local) or rebuilding the HTTP client (api) on every request.
_sentiment_pipeline = None


def _get_local_pipeline():
    """Build the in-process FinBERT transformers pipeline."""
    from transformers import pipeline

    logger.info("[sentiment] Loading ProsusAI/finbert model (first call)...")
    pipe = pipeline(
        "text-classification",
        model="ProsusAI/finbert",
        top_k=None,  # return all labels with scores
    )
    logger.info("[sentiment] FinBERT loaded successfully (local)")
    return pipe


def _classify_via_api(text: str, client) -> list[dict]:
    """Call the HF Inference API for one text, return [{label, score}, ...] (all labels).

    Raises on HTTP/transport error so the caller can surface UNAVAILABLE.
    """
    url = HF_INFERENCE_URL.format(model=settings.HF_INFERENCE_MODEL)
    headers = {"Authorization": f"Bearer {settings.HF_TOKEN}"} if settings.HF_TOKEN else {}
    # top_k omitted → API returns all labels; matches local top_k=None.
    resp = client.post(url, headers=headers, json={"inputs": text})
    resp.raise_for_status()
    data = resp.json()

    # HF may return errors as a JSON object (e.g. model loading / rate limit)
    # instead of the expected list — treat those as failures.
    if isinstance(data, dict):
        raise RuntimeError(f"HF Inference API error: {data.get('error', data)}")

    # Response for a single input is a list of {label, score}. Some models wrap it
    # in an extra list ([[...]]) — unwrap defensively.
    if data and isinstance(data[0], list):
        data = data[0]
    return data


def _get_api_pipeline():
    """Build a callable that mimics the transformers pipeline but hits the HF API.

    Returns a callable `pipe(texts, batch_size=8)` that classifies each text and
    returns a list of per-text label lists — the same shape the local pipeline
    produces. The serverless endpoint takes one input per call, so texts are sent
    sequentially over a shared client; for the handful of articles per analysis
    this is well within the free-tier request budget.
    """
    import httpx

    logger.info(
        "[sentiment] Using HuggingFace Inference API backend (model=%s)",
        settings.HF_INFERENCE_MODEL,
    )

    def pipe(texts, batch_size=8):  # batch_size accepted for signature parity, unused
        results = []
        with httpx.Client(timeout=settings.HF_INFERENCE_TIMEOUT) as client:
            for text in texts:
                results.append(_classify_via_api(text, client))
        return results

    return pipe


def _get_pipeline():
    """Lazy-load the sentiment backend selected by settings.SENTIMENT_BACKEND."""
    global _sentiment_pipeline
    if _sentiment_pipeline is None:
        if settings.SENTIMENT_BACKEND == "api":
            _sentiment_pipeline = _get_api_pipeline()
        else:
            _sentiment_pipeline = _get_local_pipeline()
    return _sentiment_pipeline


def prewarm() -> None:
    """Warm the sentiment backend at startup to avoid first-request latency.

    Local: loads FinBERT into memory. API: builds the callable and (cheaply)
    pokes the endpoint so the remote model is warm before real traffic.
    """
    try:
        pipe = _get_pipeline()
        if settings.SENTIMENT_BACKEND == "api":
            # A tiny warmup call nudges the serverless model out of a cold state.
            try:
                pipe(["ok"])
            except Exception as e:
                logger.warning(f"[sentiment] API warmup call failed (non-critical): {e}")
        logger.info("[sentiment] Backend pre-warmed successfully (%s)", settings.SENTIMENT_BACKEND)
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
