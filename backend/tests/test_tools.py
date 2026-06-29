"""Tier C — data tool tests (price, technicals, news).

Strategy (per tests/TODO.md): mock everything — yfinance, httpx, Tavily, and the
cache layer — so tests are fast, offline, and deterministic. We assert parsing of a
good response and graceful UNAVAILABLE/empty on error or missing key. The retry
paths that call time.sleep are deliberately not exercised (would slow the suite).

Covers the 3 highest-value tools. The remaining 7 (finnhub, fundamentals, sec_filing,
sentiment, stocktwits, nse_india, vector_store) follow the same pattern — see TODO.md.
"""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


@pytest.fixture(autouse=True)
def no_cache(monkeypatch):
    """Force cache miss + swallow writes so tools always hit the (mocked) source."""
    import cache.store as store
    monkeypatch.setattr(store, "get_cached", lambda t, s: None)
    monkeypatch.setattr(store, "set_cached", lambda t, s, d: None)


# ---------- price.py (yfinance mocked) ----------

class _FakeDF:
    def __init__(self, rows):
        self._rows = rows
        self.empty = len(rows) == 0

    def iterrows(self):
        import datetime
        for i, r in enumerate(self._rows):
            yield datetime.datetime(2026, 1, i + 1), r

    def __getitem__(self, key):  # df["Close"]
        class _Col:
            def __init__(self, vals): self._vals = vals
            @property
            def iloc(self):
                vals = self._vals
                class _ILoc:
                    def __getitem__(self, idx): return vals[idx]
                return _ILoc()
        return _Col([r[key] for r in self._rows])


def _row(close):
    return {"Open": close, "High": close + 1, "Low": close - 1, "Close": close, "Volume": 1000}


class TestPrice:
    def test_parses_yfinance_history(self, monkeypatch):
        import tools.price as price

        class FakeTicker:
            def __init__(self, t): pass
            def history(self, period="3mo"):
                return _FakeDF([_row(100.0), _row(102.0)])
        monkeypatch.setattr(price.yf, "Ticker", FakeTicker)

        out = price.fetch_price_data("aapl", force_refresh=True)
        assert out["status"] == "AVAILABLE"
        assert out["ticker"] == "AAPL"
        assert out["current_price"] == 102.0
        assert len(out["data"]) == 2
        assert out["data"][0]["close"] == 100.0

    def test_empty_dataframe_is_unavailable(self, monkeypatch):
        import tools.price as price

        class FakeTicker:
            def __init__(self, t): pass
            def history(self, period="3mo"):
                return _FakeDF([])
        monkeypatch.setattr(price.yf, "Ticker", FakeTicker)

        out = price.fetch_price_data("ZZZZ", force_refresh=True)
        assert out["status"] == "UNAVAILABLE"
        assert out["data"] == []

    def test_exception_is_unavailable(self, monkeypatch):
        import tools.price as price

        def boom(t):
            raise RuntimeError("yahoo down")
        monkeypatch.setattr(price.yf, "Ticker", boom)

        out = price.fetch_price_data("AAPL", force_refresh=True)
        assert out["status"] == "UNAVAILABLE"
        assert "yahoo down" in out["error"]


# ---------- technicals.py (pure helpers + flow via mocked price) ----------

class TestTechnicalHelpers:
    def test_rsi_bands(self):
        from tools.technicals import _interpret_rsi
        assert _interpret_rsi(75) == "overbought"
        assert _interpret_rsi(25) == "oversold"
        assert _interpret_rsi(50) == "neutral"

    def test_macd(self):
        from tools.technicals import _interpret_macd
        assert _interpret_macd(1.0, 0.5) == "bullish"
        assert _interpret_macd(0.5, 1.0) == "bearish"

    def test_price_vs_ma(self):
        from tools.technicals import _interpret_price_vs_ma
        assert "bullish" in _interpret_price_vs_ma(110, 100, "50-day MA")
        assert "bearish" in _interpret_price_vs_ma(90, 100, "50-day MA")
        assert "unavailable" in _interpret_price_vs_ma(100, None, "50-day MA")
        assert "unavailable" in _interpret_price_vs_ma(100, 0, "50-day MA")


class TestComputeTechnicals:
    def test_unavailable_price_short_circuits(self, monkeypatch):
        import tools.technicals as tech
        monkeypatch.setattr(tech, "fetch_price_data",
                            lambda t, period="2y", force_refresh=False: {"status": "UNAVAILABLE", "data": []})
        out = tech.compute_technicals("AAPL", force_refresh=True)
        assert out["status"] == "UNAVAILABLE"

    def test_insufficient_rows_is_unavailable(self, monkeypatch):
        import tools.technicals as tech
        few = [{"close": 100, "high": 101, "low": 99} for _ in range(5)]
        monkeypatch.setattr(tech, "fetch_price_data",
                            lambda t, period="2y", force_refresh=False: {"status": "AVAILABLE", "data": few})
        out = tech.compute_technicals("AAPL", force_refresh=True)
        assert out["status"] == "UNAVAILABLE"
        assert "Insufficient" in out["error"]

    def test_full_compute_produces_indicators(self, monkeypatch):
        import tools.technicals as tech
        # 60 rising rows → enough for RSI/MACD/BB/50MA
        rows = [{"close": 100 + i, "high": 101 + i, "low": 99 + i} for i in range(60)]
        monkeypatch.setattr(tech, "fetch_price_data",
                            lambda t, period="2y", force_refresh=False: {"status": "AVAILABLE", "data": rows})
        out = tech.compute_technicals("AAPL", force_refresh=True)
        assert out["status"] == "AVAILABLE"
        assert "rsi" in out and "macd" in out and "moving_averages" in out
        assert out["moving_averages"]["ma_50"] is not None
        assert out["moving_averages"]["ma_200"] is None  # only 60 rows


# ---------- news.py (no-key mock path + newsapi guard) ----------

class TestNews:
    def test_no_tavily_key_returns_mock(self, monkeypatch):
        import tools.news as news
        monkeypatch.setattr(news.settings, "TAVILY_API_KEY", "")
        out = news.fetch_news("AAPL", force_refresh=True)
        assert out["status"] == "AVAILABLE"
        assert out["source"] == "mock"
        assert out["article_count"] == len(news.MOCK_ARTICLES)

    def test_newsapi_without_key_returns_empty(self, monkeypatch):
        import tools.news as news
        monkeypatch.setattr(news.settings, "NEWSAPI_KEY", "")
        assert news._fetch_newsapi("AAPL") == []

    def test_newsapi_parses_articles(self, monkeypatch):
        import tools.news as news
        monkeypatch.setattr(news.settings, "NEWSAPI_KEY", "key")

        class FakeResp:
            def raise_for_status(self): pass
            def json(self):
                return {"articles": [
                    {"title": "T1", "url": "u1", "description": "desc",
                     "publishedAt": "2026-03-01T00:00:00Z", "source": {"name": "Reuters"}},
                ]}
        monkeypatch.setattr(news.httpx, "get", lambda *a, **k: FakeResp())

        arts = news._fetch_newsapi("AAPL")
        assert len(arts) == 1
        assert arts[0]["title"] == "T1"
        assert arts[0]["published_date"] == "2026-03-01"
        assert arts[0]["source"] == "Reuters"

    def test_newsapi_exception_returns_empty(self, monkeypatch):
        import tools.news as news
        monkeypatch.setattr(news.settings, "NEWSAPI_KEY", "key")
        def boom(*a, **k):
            raise RuntimeError("down")
        monkeypatch.setattr(news.httpx, "get", boom)
        assert news._fetch_newsapi("AAPL") == []


# ---------- finnhub.py (3 sequential httpx calls mocked) ----------

class _FinnhubResp:
    def __init__(self, payload): self._p = payload
    def raise_for_status(self): pass
    def json(self): return self._p


class TestFinnhub:
    def test_no_api_key_unavailable(self, monkeypatch):
        import tools.finnhub as fh
        monkeypatch.setattr(fh.settings, "FINNHUB_API_KEY", "")
        out = fh.fetch_finnhub_data("AAPL", force_refresh=True)
        assert out["status"] == "UNAVAILABLE"

    def test_parses_news_earnings_insider(self, monkeypatch):
        import tools.finnhub as fh
        monkeypatch.setattr(fh.settings, "FINNHUB_API_KEY", "key")
        # 3 calls in order: company-news, earnings, insider-sentiment
        responses = iter([
            _FinnhubResp([{"headline": "H1", "source": "Reuters", "url": "u", "summary": "s", "datetime": 1}]),
            _FinnhubResp([{"period": "2026-Q1", "actual": 1.0, "estimate": 0.9, "surprise": 0.1, "surprisePercent": 11.0}]),
            _FinnhubResp({"data": [{"month": "2026-03", "change": 100, "mspr": 0.5}]}),
        ])
        monkeypatch.setattr(fh.httpx, "get", lambda *a, **k: next(responses))

        out = fh.fetch_finnhub_data("AAPL", force_refresh=True)
        assert out["status"] == "AVAILABLE"
        assert out["news_count"] == 1
        assert out["earnings_surprises"][0]["surprise_percent"] == 11.0
        assert out["insider_sentiment"]["mspr"] == 0.5

    def test_exception_unavailable(self, monkeypatch):
        import tools.finnhub as fh
        monkeypatch.setattr(fh.settings, "FINNHUB_API_KEY", "key")
        monkeypatch.setattr(fh.httpx, "get", lambda *a, **k: (_ for _ in ()).throw(RuntimeError("down")))
        assert fh.fetch_finnhub_data("AAPL", force_refresh=True)["status"] == "UNAVAILABLE"


# ---------- fundamentals.py (yfinance .info mocked) ----------

class TestFundamentals:
    def test_parses_info(self, monkeypatch):
        import tools.fundamentals as fund

        class FakeTicker:
            def __init__(self, t): pass
            @property
            def info(self):
                return {"regularMarketPrice": 150, "trailingPE": 28.5,
                        "recommendationKey": "buy", "targetMeanPrice": 180}
            @property
            def quarterly_financials(self): return None
            @property
            def earnings_history(self): return None
        monkeypatch.setattr(fund.yf, "Ticker", FakeTicker)

        out = fund.fetch_fundamentals("AAPL", force_refresh=True)
        assert out["status"] == "AVAILABLE"
        assert out["pe_ratio"] == 28.5
        assert out["recommendation"] == "buy"

    def test_empty_info_is_unavailable(self, monkeypatch):
        import tools.fundamentals as fund

        class FakeTicker:
            def __init__(self, t): pass
            @property
            def info(self): return {}  # no price keys → index/invalid
        monkeypatch.setattr(fund.yf, "Ticker", FakeTicker)
        assert fund.fetch_fundamentals("ZZZZ", force_refresh=True)["status"] == "UNAVAILABLE"


# ---------- stocktwits.py (single httpx call, ratio logic) ----------

class _STResp:
    def __init__(self, msgs): self._msgs = msgs
    def raise_for_status(self): pass
    def json(self): return {"messages": self._msgs}


def _st_msg(sentiment):
    ent = {"sentiment": {"basic": sentiment}} if sentiment else {}
    return {"body": "msg", "entities": ent, "created_at": "", "likes": {"total": 0}}


class TestStockTwits:
    def test_bullish_when_majority_bull(self, monkeypatch):
        import tools.stocktwits as st
        msgs = [_st_msg("Bullish")] * 7 + [_st_msg(None)] * 3  # 70% bull
        monkeypatch.setattr(st.httpx, "get", lambda *a, **k: _STResp(msgs))
        out = st.fetch_stocktwits_sentiment("AAPL", force_refresh=True)
        assert out["status"] == "AVAILABLE"
        assert out["overall_sentiment"] == "bullish"
        assert out["bull_count"] == 7

    def test_neutral_when_mixed(self, monkeypatch):
        import tools.stocktwits as st
        msgs = [_st_msg("Bullish")] * 5 + [_st_msg("Bearish")] * 5  # 50/50
        monkeypatch.setattr(st.httpx, "get", lambda *a, **k: _STResp(msgs))
        assert st.fetch_stocktwits_sentiment("AAPL", force_refresh=True)["overall_sentiment"] == "neutral"

    def test_exception_unavailable(self, monkeypatch):
        import tools.stocktwits as st
        monkeypatch.setattr(st.httpx, "get", lambda *a, **k: (_ for _ in ()).throw(RuntimeError("down")))
        assert st.fetch_stocktwits_sentiment("AAPL", force_refresh=True)["status"] == "UNAVAILABLE"


# ---------- sentiment.py (FinBERT pipeline mocked) ----------

class TestSentiment:
    def test_empty_articles_neutral(self):
        from tools.sentiment import run_sentiment
        out = run_sentiment([])
        assert out["status"] == "AVAILABLE"
        assert out["overall_sentiment"] == "neutral"

    def test_bullish_aggregate(self, monkeypatch):
        import tools.sentiment as sent
        # Fake pipeline: each text → strongly positive
        def fake_pipe(texts, batch_size=8):
            return [[{"label": "positive", "score": 0.9},
                     {"label": "negative", "score": 0.05},
                     {"label": "neutral", "score": 0.05}] for _ in texts]
        monkeypatch.setattr(sent, "_get_pipeline", lambda: fake_pipe)

        out = sent.run_sentiment([{"snippet": "great earnings"}, {"snippet": "strong growth"}])
        assert out["status"] == "AVAILABLE"
        assert out["overall_sentiment"] == "bullish"
        assert out["bullish_count"] == 2

    def test_pipeline_failure_unavailable(self, monkeypatch):
        import tools.sentiment as sent
        def boom():
            raise RuntimeError("model load failed")
        monkeypatch.setattr(sent, "_get_pipeline", boom)
        out = sent.run_sentiment([{"snippet": "text"}])
        assert out["status"] == "UNAVAILABLE"
        assert out["overall_sentiment"] == "unknown"


# ---------- sec_filing.py (CIK lookup mocked) ----------

class TestSecFiling:
    def test_cik_not_found_is_unavailable(self, monkeypatch):
        import tools.sec_filing as sec
        # Neutralize the vector-store fallback, then force CIK miss.
        monkeypatch.setattr(sec, "_get_cik", lambda t: None)
        import tools.vector_store as vs
        monkeypatch.setattr(vs, "retrieve_from_vector_store",
                            lambda *a, **k: (_ for _ in ()).throw(RuntimeError("no vector")))
        out = sec.fetch_sec_filing("ZZZZ", force_refresh=True)
        assert out["status"] == "UNAVAILABLE"
        assert "CIK not found" in out["error"]


# ---------- nse_india.py (nse_quote mocked) ----------

class TestNseIndia:
    def test_parses_quote(self, monkeypatch):
        import tools.nse_india as nse
        monkeypatch.setattr(nse, "nse_quote", lambda s: {
            "priceInfo": {"lastPrice": 2500.0, "vwap": 2480.0},
            "securityInfo": {"mac": "Normal"},
            "securityWiseDP": {"deliveryToTradedQuantity": 55.5, "deliveryQuantity": 1000},
        })
        out = nse.fetch_nse_quote_data("RELIANCE.NS", force_refresh=True)
        assert out["status"] == "AVAILABLE"
        assert out["last_price"] == 2500.0
        assert out["delivery_to_traded_quantity"] == 55.5

    def test_missing_priceinfo_unavailable(self, monkeypatch):
        import tools.nse_india as nse
        monkeypatch.setattr(nse, "nse_quote", lambda s: {})
        assert nse.fetch_nse_quote_data("ZZZZ.NS", force_refresh=True)["status"] == "UNAVAILABLE"

    def test_exception_unavailable(self, monkeypatch):
        import tools.nse_india as nse
        monkeypatch.setattr(nse, "nse_quote", lambda s: (_ for _ in ()).throw(RuntimeError("nse down")))
        assert nse.fetch_nse_quote_data("RELIANCE.NS", force_refresh=True)["status"] == "UNAVAILABLE"
