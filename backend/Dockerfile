# FinSight backend — FastAPI + agent pipeline.
#
# Notes:
#  - torch is installed from PyTorch's CPU index; the default PyPI wheel pulls the
#    multi-GB CUDA build, which we don't need (inference runs on CPU).
#  - FinBERT weights are baked in at build time so containers don't download
#    ~440MB from HuggingFace on every cold start. FinBERT is on the prod path
#    (run_sentiment always uses it; LLM_PROVIDER only routes synthesis).
#  - Single worker: SQLite + WAL is safe with one worker; multiple workers would
#    reintroduce lock contention and break the in-memory rate limiter.

FROM python:3.11-slim

# System deps occasionally needed by scientific wheels / lxml.
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install CPU-only torch first so the requirements install reuses it.
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download FinBERT weights into the image (avoids per-cold-start download).
RUN python -c "from transformers import pipeline; pipeline('text-classification', model='ProsusAI/finbert')"

COPY . .

# SQLite DB + ChromaDB live here; mount a volume in prod for persistence.
RUN mkdir -p data

EXPOSE 8000

# Single worker — see header note on SQLite/WAL and the in-memory rate limiter.
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
