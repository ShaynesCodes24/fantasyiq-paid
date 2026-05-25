from __future__ import annotations

from datetime import datetime, timezone
from typing import Any


EXPECTED_TEAMS = {
    "ARI", "ATL", "BAL", "BUF", "CAR", "CHI", "CIN", "CLE",
    "DAL", "DEN", "DET", "GB", "HOU", "IND", "JAX", "KC",
    "LAC", "LAR", "LV", "MIA", "MIN", "NE", "NO", "NYG",
    "NYJ", "PHI", "PIT", "SEA", "SF", "TB", "TEN", "WAS",
}
EXPECTED_POSITIONS = {"QB", "RB", "WR", "TE", "DST", "K"}
EXPECTED_ROW_COUNT = len(EXPECTED_TEAMS) * len(EXPECTED_POSITIONS)
EXPECTED_WEEKS = set(range(1, 19))
COLOR_GRADES = {"dark green", "light green", "yellow", "orange", "red", "gray"}


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def number(value: Any) -> float | None:
    try:
        if value is None or value == "":
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def issue(errors: list[str], message: str, limit: int = 30) -> None:
    if len(errors) < limit:
        errors.append(message)


def validate_cell(row_key: str, cell: dict[str, Any], errors: list[str], warnings: list[str], summary: dict[str, Any]) -> None:
    week = int(number(cell.get("week")) or 0)
    if week not in EXPECTED_WEEKS:
        issue(errors, f"{row_key} has invalid week {cell.get('week')!r}.")
        return
    opponent = str(cell.get("opponent") or "")
    score = number(cell.get("score"))
    color = str(cell.get("colorGrade") or ("gray" if cell.get("tier") == "bye" else "")).lower()
    if opponent == "BYE" or cell.get("tier") == "bye":
        summary["byeCells"] += 1
        if color and color != "gray":
            issue(warnings, f"{row_key} W{week} bye is not gray.")
        return
    summary["matchupCells"] += 1
    if opponent not in EXPECTED_TEAMS:
        issue(errors, f"{row_key} W{week} has invalid opponent {opponent!r}.")
    if score is None or score < 1 or score > 4:
        issue(errors, f"{row_key} W{week} score {cell.get('score')!r} is outside 1..4.")
    if color not in COLOR_GRADES:
        issue(errors, f"{row_key} W{week} colorGrade {cell.get('colorGrade')!r} is invalid.")
    if number(cell.get("confidence")) is None:
        issue(warnings, f"{row_key} W{week} missing confidence.")
    if number(cell.get("fpaScore")) is None:
        summary["missingFpaCells"] += 1
    if cell.get("oddsSource") in (None, "", "team-stat-fallback"):
        summary["fallbackMarketCells"] += 1


def validate_schedule_iq_payload(payload: dict[str, Any]) -> dict[str, Any]:
    errors: list[str] = []
    warnings: list[str] = []
    rows = payload.get("rows") if isinstance(payload.get("rows"), list) else []
    summary: dict[str, Any] = {
        "expectedRows": EXPECTED_ROW_COUNT,
        "rowCount": len(rows),
        "expectedWeeks": len(EXPECTED_WEEKS),
        "matchupCells": 0,
        "byeCells": 0,
        "missingFpaCells": 0,
        "fallbackMarketCells": 0,
        "teams": 0,
        "positions": 0,
        "agentCount": 0,
    }
    if payload.get("ok") is not True:
        issue(errors, "Payload ok flag is not true.")
    if len(rows) != EXPECTED_ROW_COUNT:
        issue(errors, f"Expected {EXPECTED_ROW_COUNT} rows, found {len(rows)}.")
    seen_pairs: set[str] = set()
    seen_teams: set[str] = set()
    seen_positions: set[str] = set()
    for row in rows:
        if not isinstance(row, dict):
            issue(errors, "A row is not an object.")
            continue
        team = str(row.get("team") or "")
        position = str(row.get("position") or "")
        row_key = f"{team}:{position}"
        if team not in EXPECTED_TEAMS:
            issue(errors, f"Invalid team {team!r}.")
        if position not in EXPECTED_POSITIONS:
            issue(errors, f"Invalid position {position!r}.")
        if row_key in seen_pairs:
            issue(errors, f"Duplicate row {row_key}.")
        seen_pairs.add(row_key)
        seen_teams.add(team)
        seen_positions.add(position)
        cells = row.get("cells") if isinstance(row.get("cells"), list) else []
        if len(cells) != len(EXPECTED_WEEKS):
            issue(errors, f"{row_key} expected 18 cells, found {len(cells)}.")
        weeks = {int(number(cell.get("week")) or 0) for cell in cells if isinstance(cell, dict)}
        if weeks and weeks != EXPECTED_WEEKS:
            missing = sorted(EXPECTED_WEEKS.difference(weeks))
            extra = sorted(weeks.difference(EXPECTED_WEEKS))
            issue(errors, f"{row_key} week coverage mismatch; missing={missing[:6]}, extra={extra[:6]}.")
        for cell in cells:
            if isinstance(cell, dict):
                validate_cell(row_key, cell, errors, warnings, summary)
            else:
                issue(errors, f"{row_key} has non-object cell.")
    summary["teams"] = len(seen_teams.intersection(EXPECTED_TEAMS))
    summary["positions"] = len(seen_positions.intersection(EXPECTED_POSITIONS))
    provider_meta = payload.get("providerMeta") if isinstance(payload.get("providerMeta"), dict) else {}
    if not provider_meta:
        issue(errors, "providerMeta is missing.")
    if provider_meta.get("weeksWithSchedule") not in (None, 18):
        issue(warnings, f"weeksWithSchedule is {provider_meta.get('weeksWithSchedule')}, expected 18.")
    if number(provider_meta.get("scheduledGames")) is not None and int(number(provider_meta.get("scheduledGames")) or 0) < 250:
        issue(warnings, f"scheduledGames looks low: {provider_meta.get('scheduledGames')}.")
    odds = provider_meta.get("odds") if isinstance(provider_meta.get("odds"), dict) else {}
    if not odds.get("configured"):
        issue(warnings, "Odds API market context is not configured; confidence should be lowered.")
    elif int(number(odds.get("combinedTeams")) or 0) < 20:
        issue(warnings, f"Odds API market context covers only {odds.get('combinedTeams')} teams.")
    fpa = provider_meta.get("fpa") if isinstance(provider_meta.get("fpa"), dict) else {}
    if int(number(fpa.get("teams")) or 0) < 20:
        issue(warnings, f"Fantasy points allowed coverage looks low: {fpa.get('teams')} teams.")
    workflow = payload.get("agentWorkflow") if isinstance(payload.get("agentWorkflow"), dict) else {}
    agents = workflow.get("agents") if isinstance(workflow.get("agents"), list) else []
    summary["agentCount"] = len(agents)
    if len(agents) != 12:
        issue(errors, f"Expected 12 Schedule IQ agent outputs, found {len(agents)}.")
    if (workflow.get("leadAgent") or {}).get("agent") != "Lead Schedule Intelligence Agent":
        issue(errors, "Lead Schedule Intelligence Agent output is missing.")
    status = "healthy" if not errors and not warnings else "warning" if not errors else "critical"
    return {
        "ok": not errors,
        "status": status,
        "modelVersion": "schedule-iq-validation-v1",
        "validatedAt": utc_now(),
        "errors": errors,
        "warnings": warnings,
        "summary": summary,
    }
