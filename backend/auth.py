"""JWT authentication — Supabase HS256 bearer tokens.

Contract:
  - REST routes: `Authorization: Bearer <supabase_access_token>` header via `require_auth`.
  - SSE route: `?token=<supabase_access_token>` query param (EventSource can't send headers),
    verified manually with `verify_token`.
  - Token: Supabase HS256, signed with settings.SUPABASE_JWT_SECRET, audience "authenticated".
  - Fail-closed: empty secret + AUTH_DISABLED False -> 503. AUTH_DISABLED True -> bypass.
"""

import jwt
from fastapi import Header, HTTPException

from config import settings

_AUDIENCE = "authenticated"
_DEV_CLAIMS = {"sub": "dev"}


def verify_token(token: str | None) -> dict:
    """Verify a Supabase access token and return its decoded claims.

    Shared by the header dependency and the SSE query-param path.

    Raises:
        HTTPException(503): secret not configured and auth not disabled.
        HTTPException(401): token missing, invalid, expired, or wrong audience.
    """
    # Local-dev escape hatch — bypass entirely.
    if settings.AUTH_DISABLED:
        return dict(_DEV_CLAIMS)

    # Fail-closed: refuse to serve protected data without a configured secret.
    if not settings.SUPABASE_JWT_SECRET:
        raise HTTPException(status_code=503, detail="Auth not configured")

    if not token:
        raise HTTPException(status_code=401, detail="Missing authentication token")

    try:
        claims = jwt.decode(
            token,
            settings.SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            audience=_AUDIENCE,
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid authentication token")

    return claims


async def require_auth(authorization: str | None = Header(default=None)) -> dict:
    """FastAPI dependency for normal routes — reads the Bearer header."""
    token = None
    if authorization:
        scheme, _, value = authorization.partition(" ")
        if scheme.lower() == "bearer" and value:
            token = value.strip()

    return verify_token(token)
