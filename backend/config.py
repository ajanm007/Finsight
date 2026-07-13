"""FinSight configuration — settings, env vars, constants."""

from pydantic_settings import BaseSettings
from pydantic import Field
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent

# Load .env into os.environ for libraries like transformers that read from os.environ directly
load_dotenv(BASE_DIR / ".env")


class Settings(BaseSettings):
    """App settings loaded from .env file."""

    # LLM provider: "gemini" (default), "groq", "fallback", or "local".
    # NOTE: "local" requires HF_TOKEN + a GPU and is opt-in — do not set it without that hardware.
    LLM_PROVIDER: str = Field(default="gemini", description="LLM provider: 'gemini', 'groq', 'fallback', or 'local'")
    GROQ_API_KEY: str = Field(default="", description="Groq API key (only if LLM_PROVIDER=groq)")
    GEMINI_API_KEY: str = Field(default="", description="Gemini API key")
    LOCAL_MODEL_NAME: str = Field(
        default="meta-llama/Llama-3.2-3B-Instruct",
        description="HuggingFace model ID for local inference",
    )

    # API keys
    TAVILY_API_KEY: str = Field(default="", description="Tavily API key for news search")
    NEWSAPI_KEY: str = Field(default="", description="NewsAPI.org API key for supplementary news (free tier: 100 req/day)")
    FINNHUB_API_KEY: str = Field(default="", description="Finnhub API key (free tier: 60 req/min)")
    HF_TOKEN: str = Field(default="", description="HuggingFace API token for gated models + Inference API")

    # Sentiment backend: "local" (default) loads FinBERT via transformers in-process
    # (~2GB RAM); "api" calls the HuggingFace serverless Inference API instead, so the
    # process stays small enough for low-RAM hosts (Render/Fly free tiers). "api"
    # requires HF_TOKEN with the "Inference Providers" permission.
    SENTIMENT_BACKEND: str = Field(
        default="local",
        description="FinBERT sentiment backend: 'local' (in-process) or 'api' (HF Inference API)",
    )
    HF_INFERENCE_MODEL: str = Field(
        default="ProsusAI/finbert",
        description="Model ID for the HF Inference API sentiment backend",
    )
    HF_INFERENCE_TIMEOUT: float = Field(
        default=30.0,
        description="Per-request timeout (seconds) for the HF Inference API sentiment backend",
    )

    # SEC EDGAR
    SEC_USER_AGENT: str = Field(
        default="FinSight anmol@example.com",
        description="User-Agent header for SEC EDGAR (required by SEC policy)",
    )

    # Database
    DB_PATH: str = Field(default=str(BASE_DIR / "data" / "finsight.db"), description="SQLite DB path")

    # CORS — comma-separated origins in .env (e.g. "https://app.example.com,https://x.vercel.app")
    ALLOWED_ORIGINS: list[str] = Field(
        default=["*"],
        description="Allowed CORS origins"
    )

    # Auth — Supabase JWT secret (Project Settings → API → JWT Secret).
    # When set, all data endpoints require a valid Supabase bearer token.
    # When empty (local dev), auth is DISABLED and endpoints are open.
    SUPABASE_JWT_SECRET: str = Field(
        default="",
        description="Supabase JWT secret; enables API auth enforcement when set",
    )

    # Local-dev escape hatch: when True, all auth is bypassed even without a JWT secret.
    # When False and SUPABASE_JWT_SECRET is empty, protected routes fail closed (503).
    AUTH_DISABLED: bool = Field(
        default=False,
        description="Bypass JWT auth entirely (local dev only)",
    )

    # Rate limit for the expensive analysis endpoints (/analyze, /stream), per client IP.
    # Guards free-tier API quotas (Finnhub/Tavily) and the SEC user-agent from request floods.
    ANALYZE_RATE_LIMIT: str = Field(
        default="10/minute",
        description="slowapi rate limit string for /analyze and /stream, per IP",
    )

    model_config = {"env_file": str(BASE_DIR / ".env"), "env_file_encoding": "utf-8"}


settings = Settings()


# ---------- Constants ----------

# Cache TTL (seconds)
CACHE_TTL = {
    "price": 300,                       # 5 minutes
    "technicals": 300,                  # 5 minutes
    "news": 6 * 60 * 60,                # 6 hours
    "sentiment": 6 * 60 * 60,           # 6 hours
    "sec_filing": 30 * 24 * 60 * 60,    # 30 days (annual 10-K)
    "sec_10q": 7 * 24 * 60 * 60,        # 7 days (quarterly 10-Q)
    "fundamentals": 24 * 60 * 60,       # 1 day
    "nse_corporate": 6 * 60 * 60,        # 6 hours
    "stocktwits": 2 * 60 * 60,          # 2 hours
    "finnhub": 6 * 60 * 60,             # 6 hours
}

# Staleness penalty (per day past TTL)
STALENESS_PENALTY = {
    "price": 0.10,
    "technicals": 0.10,
    "news": 0.05,
    "sentiment": 0.05,
    "sec_filing": 0.02,
    "sec_10q": 0.03,
    "fundamentals": 0.05,
    "stocktwits": 0.04,
    "finnhub": 0.04,
}

# Confidence formula weights (legacy fractions kept for any future use)
CONFIDENCE_BASE_WEIGHT = 1.0
CONFLICT_PENALTY = 0.15
RECENCY_BONUS = 0.05
MISSING_SOURCE_PENALTY = 0.15
SIGNAL_DIVERGENCE_PENALTY = 0.40

# Confidence scoring — point values on 0-100 scale
# Bull score caps
BULL_SCORE_CONFLICT_CAP = 75      # Max bull score when conflicting signals present
BULL_SCORE_BEAR_CAP = 80          # Max bull score when 2+ bear signals present
BULL_SCORE_PERFECT_CAP = 98       # Max bull score unless all sources are live with no friction

# Model confidence penalties
BEAR_SIGNAL_CONF_PENALTY = 10     # Points lost per bear signal
CONFLICT_CONF_PENALTY = 15        # Points lost when any conflict exists
RSI_OVERBOUGHT_CONF_PENALTY = 5   # Points lost when RSI > 65
SIGNAL_DISAGREEMENT_CONF_PENALTY = 15   # Points lost when bull/bear signals diverge
SIGNAL_DISAGREEMENT_THRESHOLD = 0.4     # Agreement ratio below which divergence fires
RECENCY_BONUS_PTS = 5             # Points gained for fresh live news
STALENESS_PENALTY_CAP = 20        # Max staleness penalty per source

