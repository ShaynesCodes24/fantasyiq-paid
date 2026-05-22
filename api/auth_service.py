from __future__ import annotations

import base64
import hashlib
import hmac
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any


SESSION_COOKIE_NAME = "fantasyiq_session"
SESSION_DAYS = 30
PASSWORD_ITERATIONS = 260_000


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def b64_encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode("ascii").rstrip("=")


def b64_decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode((value + padding).encode("ascii"))


def password_hash(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PASSWORD_ITERATIONS)
    return f"pbkdf2_sha256${PASSWORD_ITERATIONS}${b64_encode(salt)}${b64_encode(digest)}"


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        scheme, iterations, salt, expected = str(stored_hash or "").split("$", 3)
        if scheme != "pbkdf2_sha256":
            return False
        digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), b64_decode(salt), int(iterations))
        return hmac.compare_digest(b64_encode(digest), expected)
    except Exception:
        return False


def session_token() -> str:
    return secrets.token_urlsafe(32)


def token_hash(token: str) -> str:
    return hashlib.sha256(str(token or "").encode("utf-8")).hexdigest()


def parse_cookies(headers: Any | None) -> dict[str, str]:
    raw = ""
    if headers is not None:
        raw = headers.get("Cookie", "") or headers.get("cookie", "")
    cookies: dict[str, str] = {}
    for part in str(raw or "").split(";"):
        if "=" not in part:
            continue
        key, value = part.split("=", 1)
        cookies[key.strip()] = value.strip()
    return cookies


def session_token_from_headers(headers: Any | None) -> str:
    return parse_cookies(headers).get(SESSION_COOKIE_NAME, "")


def session_slug_from_headers(headers: Any | None) -> str:
    token = session_token_from_headers(headers)
    if not token:
        return ""
    try:
        try:
            from database import session_customer_slug
        except ImportError:
            from api.database import session_customer_slug

        return session_customer_slug(token_hash(token))
    except Exception:
        return ""


def make_session(customer_slug: str, headers: Any | None = None) -> tuple[str, datetime]:
    try:
        from database import create_customer_session
    except ImportError:
        from api.database import create_customer_session

    token = session_token()
    expires_at = utc_now() + timedelta(days=SESSION_DAYS)
    user_agent = headers.get("User-Agent", "") if headers is not None else ""
    create_customer_session(
        customer_slug=customer_slug,
        token_hash=token_hash(token),
        expires_at=expires_at,
        user_agent=user_agent,
    )
    return token, expires_at


def revoke_session(headers: Any | None = None) -> None:
    token = session_token_from_headers(headers)
    if not token:
        return
    try:
        try:
            from database import revoke_customer_session
        except ImportError:
            from api.database import revoke_customer_session

        revoke_customer_session(token_hash(token))
    except Exception:
        return


def cookie_secure(headers: Any | None = None) -> bool:
    if os.environ.get("VERCEL"):
        return True
    proto = headers.get("x-forwarded-proto", "") if headers is not None else ""
    return str(proto).lower() == "https"


def session_cookie(token: str, headers: Any | None = None, max_age: int | None = None) -> str:
    parts = [
        f"{SESSION_COOKIE_NAME}={token}",
        "Path=/",
        "HttpOnly",
        "SameSite=Lax",
    ]
    if max_age is not None:
        parts.append(f"Max-Age={max_age}")
    if cookie_secure(headers):
        parts.append("Secure")
    return "; ".join(parts)


def clear_session_cookie(headers: Any | None = None) -> str:
    return session_cookie("", headers, max_age=0)


def password_policy_error(password: str) -> str:
    if len(password or "") < 15:
        return "Password must be at least 15 characters."
    if len(password or "") > 128:
        return "Password must be 128 characters or fewer."
    return ""
