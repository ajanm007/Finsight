"""Tests for JWT auth in backend/auth.py.

Covers verify_token / require_auth:
  (a) valid HS256 token (aud="authenticated") passes,
  (b) wrong-signature / expired / wrong-aud raise 401,
  (c) AUTH_DISABLED=true bypasses entirely,
  (d) empty secret + not disabled -> 503.

Tokens are minted with jwt.encode; the secret is set via monkeypatch on
config.settings. Plain pytest, no async runner needed for verify_token.
"""

import asyncio
import sys
import time
from pathlib import Path

import jwt
import pytest
from fastapi import HTTPException

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import auth
from config import settings

_SECRET = "test-jwt-secret"


def _set_secret(monkeypatch, secret=_SECRET, disabled=False):
    monkeypatch.setattr(settings, "SUPABASE_JWT_SECRET", secret, raising=False)
    monkeypatch.setattr(settings, "AUTH_DISABLED", disabled, raising=False)


def _mint(secret=_SECRET, aud="authenticated", exp_offset=3600):
    payload = {
        "sub": "user-123",
        "aud": aud,
        "exp": int(time.time()) + exp_offset,
    }
    return jwt.encode(payload, secret, algorithm="HS256")


class TestVerifyToken:
    def test_valid_token_passes(self, monkeypatch):
        _set_secret(monkeypatch)
        claims = auth.verify_token(_mint())
        assert claims["sub"] == "user-123"
        assert claims["aud"] == "authenticated"

    def test_wrong_signature_raises_401(self, monkeypatch):
        _set_secret(monkeypatch)
        token = _mint(secret="some-other-secret")
        with pytest.raises(HTTPException) as exc:
            auth.verify_token(token)
        assert exc.value.status_code == 401

    def test_expired_token_raises_401(self, monkeypatch):
        _set_secret(monkeypatch)
        token = _mint(exp_offset=-10)
        with pytest.raises(HTTPException) as exc:
            auth.verify_token(token)
        assert exc.value.status_code == 401

    def test_wrong_audience_raises_401(self, monkeypatch):
        _set_secret(monkeypatch)
        token = _mint(aud="anon")
        with pytest.raises(HTTPException) as exc:
            auth.verify_token(token)
        assert exc.value.status_code == 401

    def test_missing_token_raises_401(self, monkeypatch):
        _set_secret(monkeypatch)
        with pytest.raises(HTTPException) as exc:
            auth.verify_token(None)
        assert exc.value.status_code == 401

    def test_auth_disabled_bypasses(self, monkeypatch):
        # No secret, but disabled -> bypass with dev sentinel.
        _set_secret(monkeypatch, secret="", disabled=True)
        claims = auth.verify_token(None)
        assert claims["sub"] == "dev"

    def test_empty_secret_not_disabled_raises_503(self, monkeypatch):
        _set_secret(monkeypatch, secret="", disabled=False)
        with pytest.raises(HTTPException) as exc:
            auth.verify_token(_mint())
        assert exc.value.status_code == 503


class TestRequireAuth:
    def test_valid_bearer_header_passes(self, monkeypatch):
        _set_secret(monkeypatch)
        claims = asyncio.run(auth.require_auth(f"Bearer {_mint()}"))
        assert claims["sub"] == "user-123"

    def test_missing_header_raises_401(self, monkeypatch):
        _set_secret(monkeypatch)
        with pytest.raises(HTTPException) as exc:
            asyncio.run(auth.require_auth(None))
        assert exc.value.status_code == 401

    def test_non_bearer_header_raises_401(self, monkeypatch):
        _set_secret(monkeypatch)
        with pytest.raises(HTTPException) as exc:
            asyncio.run(auth.require_auth(f"Basic {_mint()}"))
        assert exc.value.status_code == 401

    def test_disabled_bypasses_via_dependency(self, monkeypatch):
        _set_secret(monkeypatch, secret="", disabled=True)
        claims = asyncio.run(auth.require_auth(None))
        assert claims["sub"] == "dev"
