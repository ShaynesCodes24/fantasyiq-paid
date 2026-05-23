from __future__ import annotations

import base64
import hashlib
import hmac
import os
import time
from typing import Any

try:
    from auth_service import cookie_secure, parse_cookies
    from customer_context import env
except ModuleNotFoundError:
    from api.auth_service import cookie_secure, parse_cookies
    from api.customer_context import env


ADMIN_GATE_COOKIE = "fantasyiq_admin_gate"
DEFAULT_ADMIN_GATE_MAX_AGE = 8 * 60 * 60


def admin_gate_max_age() -> int:
    raw = env("FANTASYIQ_ADMIN_GATE_MAX_AGE_SECONDS", str(DEFAULT_ADMIN_GATE_MAX_AGE))
    try:
        return max(300, min(int(raw), 24 * 60 * 60))
    except ValueError:
        return DEFAULT_ADMIN_GATE_MAX_AGE


def admin_gate_secret() -> str:
    return os.environ.get("FANTASYIQ_ADMIN_GATE_SECRET", "").strip()


def admin_gate_password() -> str:
    return os.environ.get("FANTASYIQ_ADMIN_GATE_PASSWORD", "").strip()


def b64_encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode("ascii").rstrip("=")


def sign_admin_gate(issued_at: int, secret: str | None = None) -> str:
    signing_secret = secret or admin_gate_secret()
    if not signing_secret:
        raise PermissionError("FANTASYIQ_ADMIN_GATE_SECRET is not configured.")
    message = f"admin:{issued_at}".encode("utf-8")
    signature = hmac.new(signing_secret.encode("utf-8"), message, hashlib.sha256).digest()
    return f"{issued_at}.{b64_encode(signature)}"


def verify_admin_gate_token(token: str, secret: str | None = None, now: int | None = None) -> bool:
    if not token or "." not in token:
        return False
    issued_raw, signature = token.split(".", 1)
    try:
        issued_at = int(issued_raw)
    except ValueError:
        return False
    current = int(now or time.time())
    max_age = admin_gate_max_age()
    if issued_at > current + 60 or current - issued_at > max_age:
        return False
    try:
        expected = sign_admin_gate(issued_at, secret)
    except PermissionError:
        return False
    return hmac.compare_digest(token, expected)


def admin_gate_token_from_headers(headers: Any | None) -> str:
    return parse_cookies(headers).get(ADMIN_GATE_COOKIE, "")


def require_admin_gate(headers: Any | None) -> None:
    if not admin_gate_secret():
        raise PermissionError("FANTASYIQ_ADMIN_GATE_SECRET is not configured.")
    if not verify_admin_gate_token(admin_gate_token_from_headers(headers)):
        raise PermissionError("Admin gate sign-in required.")


def admin_gate_cookie(token: str, headers: Any | None = None, max_age: int | None = None) -> str:
    parts = [
        f"{ADMIN_GATE_COOKIE}={token}",
        "Path=/",
        "HttpOnly",
        "SameSite=Strict",
    ]
    if max_age is not None:
        parts.append(f"Max-Age={max_age}")
    if cookie_secure(headers):
        parts.append("Secure")
    return "; ".join(parts)


def clear_admin_gate_cookie(headers: Any | None = None) -> str:
    return admin_gate_cookie("", headers, max_age=0)
