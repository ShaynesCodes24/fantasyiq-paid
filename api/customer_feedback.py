from __future__ import annotations

import json
import urllib.parse
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler
from typing import Any
from urllib.parse import parse_qs

try:
    from customer_context import slugify
    from rate_limit import check_rate_limit, rate_limit_payload
except ModuleNotFoundError:
    from api.customer_context import slugify
    from api.rate_limit import check_rate_limit, rate_limit_payload


LIKERT_OPTIONS = {"Strongly Agree", "Agree", "Neutral", "Disagree", "Strongly Disagree"}


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def parse_body(handler: BaseHTTPRequestHandler) -> dict[str, Any]:
    length = int(handler.headers.get("Content-Length") or 0)
    if length <= 0:
        return {}
    raw = handler.rfile.read(length)
    content_type = handler.headers.get("Content-Type", "")
    if "application/json" in content_type:
        return json.loads(raw.decode("utf-8") or "{}")
    parsed = urllib.parse.parse_qs(raw.decode("utf-8"))
    return {key: values[0] if values else "" for key, values in parsed.items()}


def clean_text(value: Any, limit: int = 1200) -> str:
    text = " ".join(str(value or "").replace("\x00", "").split())
    return text[:limit]


def clean_likert(value: Any) -> str:
    text = clean_text(value, 40)
    return text if text in LIKERT_OPTIONS else ""


def clean_rating(value: Any) -> int | None:
    try:
        rating = int(str(value or "").strip())
    except (TypeError, ValueError):
        return None
    return rating if 1 <= rating <= 5 else None


def feedback_payload(raw: dict[str, Any]) -> dict[str, Any]:
    rating = clean_rating(raw.get("satisfaction"))
    if rating is None:
        raise ValueError("Choose an overall satisfaction rating.")

    responses = {
        "onboardingEase": clean_likert(raw.get("onboardingEase")),
        "dashboardClarity": clean_likert(raw.get("dashboardClarity")),
        "productValue": clean_likert(raw.get("productValue")),
        "decisionConfidence": clean_likert(raw.get("decisionConfidence")),
    }
    missing = [key for key, value in responses.items() if not value]
    if missing:
        raise ValueError("Answer each agreement statement before submitting.")

    return {
        "email": clean_text(raw.get("email"), 160).lower(),
        "customerSlug": slugify(str(raw.get("customer") or raw.get("customerSlug") or raw.get("dashboard") or "")) if raw.get("customer") or raw.get("customerSlug") or raw.get("dashboard") else "",
        "leagueKey": slugify(str(raw.get("league") or raw.get("leagueKey") or "")) if raw.get("league") or raw.get("leagueKey") else "",
        "responses": responses,
        "issues": clean_text(raw.get("issues"), 1200),
        "improvements": clean_text(raw.get("improvements"), 1200),
        "satisfaction": rating,
        "source": clean_text(raw.get("source") or "customer_feedback_page", 80),
        "submittedAt": utc_now(),
    }


def record_feedback(payload: dict[str, Any]) -> bool:
    try:
        try:
            from database import record_ops_event
        except ImportError:
            from api.database import record_ops_event

        return record_ops_event(
            event_type="feedback.new_customer_survey",
            severity="info",
            source="customer_feedback",
            customer_slug=payload.get("customerSlug") or "",
            league_key=payload.get("leagueKey") or "",
            message=f"New customer feedback survey submitted. Satisfaction: {payload.get('satisfaction')}/5.",
            payload=payload,
        )
    except Exception:
        return False


class handler(BaseHTTPRequestHandler):
    def send_json(self, payload: dict[str, Any], status: HTTPStatus = HTTPStatus.OK) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self) -> None:
        raw: dict[str, Any] = {}
        try:
            raw = parse_body(self)
            limit = check_rate_limit(
                "customer_feedback",
                headers=self.headers,
                raw=raw,
                fields=("email", "customer", "customerSlug", "dashboard"),
                limit=6,
                window_seconds=3600,
            )
            if not limit.allowed:
                self.send_json(
                    rate_limit_payload(limit, "Too many feedback submissions right now. Try again later."),
                    HTTPStatus.TOO_MANY_REQUESTS,
                )
                return
            payload = feedback_payload(raw)
            recorded = record_feedback(payload)
            if not recorded:
                self.send_json(
                    {
                        "ok": False,
                        "message": "Feedback could not be saved right now. Please email support@myfantasyiq.com.",
                        "syncedAt": utc_now(),
                    },
                    HTTPStatus.SERVICE_UNAVAILABLE,
                )
                return
            self.send_json(
                {
                    "ok": True,
                    "message": "Thank you. Your feedback was sent to the MyFantasyIQ team.",
                    "syncedAt": utc_now(),
                }
            )
        except (ValueError, json.JSONDecodeError) as exc:
            self.send_json({"ok": False, "message": str(exc), "syncedAt": utc_now()}, HTTPStatus.BAD_REQUEST)
        except Exception:
            self.send_json(
                {
                    "ok": False,
                    "message": "Feedback could not be submitted right now.",
                    "syncedAt": utc_now(),
                },
                HTTPStatus.BAD_GATEWAY,
            )

    def do_GET(self) -> None:
        self.send_json({"ok": True, "message": "POST new-customer survey responses to submit feedback."})

    def do_HEAD(self) -> None:
        self.send_response(HTTPStatus.OK)
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
