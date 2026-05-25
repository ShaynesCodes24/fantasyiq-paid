from __future__ import annotations

import json
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler
from typing import Any
from urllib.parse import parse_qs, urlparse

try:
    from fantasy_engine import analyze, utc_now
except ModuleNotFoundError:
    from api.fantasy_engine import analyze, utc_now


def first_query_value(value: Any) -> str:
    return value[0] if isinstance(value, list) and value else str(value or "")


def read_json_body(handler: BaseHTTPRequestHandler) -> dict[str, Any]:
    length = int(handler.headers.get("Content-Length") or 0)
    if length <= 0:
        return {}
    raw = handler.rfile.read(length).decode("utf-8")
    if not raw.strip():
        return {}
    return json.loads(raw)


def response_payload(query: dict[str, list[str]], body: dict[str, Any] | None = None) -> dict[str, Any]:
    payload = body or {}
    engine = analyze(payload)
    warnings = []
    if not payload.get("roster"):
        warnings.append("No backend roster snapshot was provided; dashboard client synthesis may add more context.")
    if not payload.get("waiverPool"):
        warnings.append("No waiver pool snapshot was provided.")
    if not payload.get("tradeTargets"):
        warnings.append("No trade target snapshot was provided.")
    if not payload.get("draftBoard"):
        warnings.append("No draft board snapshot was provided.")

    return {
        "ok": True,
        "source": "FantasyIQ Backend Fantasy Engine",
        "syncedAt": utc_now(),
        "customerSlug": first_query_value(query.get("customer")),
        "leagueKey": first_query_value(query.get("league")),
        "engine": {
            "teamStrength": engine["teamStrength"],
            "rosterWeakness": engine["rosterWeakness"],
            "starterQuality": engine["starterQuality"],
            "benchDepth": engine["benchDepth"],
            "byeWeekRisk": engine["byeWeekRisk"],
            "tradeValue": engine["tradeValue"],
            "waiverPriority": engine["waiverPriority"],
            "draftRecommendation": engine["draftRecommendation"],
            "fantasyIqScore": engine["fantasyIqScore"],
        },
        "recommendation": engine["recommendation"],
        "phases": {
            "liveDraftRoom": {
                "action": "TARGET" if engine["draftRecommendation"] else "READY",
                "mainMove": engine["draftRecommendation"]["player"] if engine["draftRecommendation"] else "Awaiting draft board snapshot",
            },
            "weeklyCommandCenter": {
                "action": engine["recommendation"]["action"],
                "mainMove": engine["recommendation"]["mainMove"],
            },
            "waiverSniper": {
                "action": "ACT_NOW" if engine["waiverPriority"] and engine["waiverPriority"]["priority"] in ("high", "medium") else "WAIT",
                "mainMove": f"Add {engine['waiverPriority']['add']}" if engine["waiverPriority"] else "No priority add",
            },
            "tradeFinder": {
                "action": "ACT_NOW" if engine["tradeValue"] and engine["tradeValue"]["valueDelta"] >= 2 else "WAIT",
                "mainMove": f"Offer {engine['tradeValue']['give']} for {engine['tradeValue']['get']}" if engine["tradeValue"] else "No clean trade lane",
            },
            "opponentIntelligence": {
                "action": "READY",
                "mainMove": "Backend engine ready for opponent snapshots",
                "managerProfiles": [],
            },
        },
        "missingDataWarnings": warnings,
        "fallbackLogicUsed": ["Backend fantasy engine used conservative defaults for missing snapshots."],
    }


class handler(BaseHTTPRequestHandler):
    def send_json(self, payload: dict[str, Any], status: HTTPStatus = HTTPStatus.OK) -> None:
        raw = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def do_GET(self) -> None:
        query = parse_qs(urlparse(self.path).query)
        self.send_json(response_payload(query))

    def do_POST(self) -> None:
        query = parse_qs(urlparse(self.path).query)
        try:
            body = read_json_body(self)
        except json.JSONDecodeError:
            self.send_json({"ok": False, "message": "Request body must be valid JSON."}, HTTPStatus.BAD_REQUEST)
            return
        self.send_json(response_payload(query, body))
