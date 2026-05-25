from __future__ import annotations

import unittest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from api.sos_validation import EXPECTED_POSITIONS, EXPECTED_TEAMS, validate_schedule_iq_payload


def valid_payload() -> dict:
    teams = sorted(EXPECTED_TEAMS)
    rows = []
    for team in teams:
        opponent = next(item for item in teams if item != team)
        for position in sorted(EXPECTED_POSITIONS):
            rows.append({
                "team": team,
                "position": position,
                "avgDifficulty": 2.5,
                "playoffDifficulty": 2.5,
                "confidence": 0.8,
                "cells": [
                    {
                        "week": week,
                        "opponent": opponent,
                        "score": 2.5,
                        "tier": "good",
                        "colorGrade": "yellow",
                        "confidence": 0.8,
                        "fpaScore": 2.5,
                        "oddsSource": "live",
                    }
                    for week in range(1, 19)
                ],
            })
    return {
        "ok": True,
        "season": 2026,
        "providerMeta": {
            "weeksWithSchedule": 18,
            "scheduledGames": 272,
            "fpa": {"teams": 32},
            "odds": {"configured": True, "combinedTeams": 32},
        },
        "agentWorkflow": {
            "leadAgent": {"agent": "Lead Schedule Intelligence Agent"},
            "agents": [{"agent": f"Agent {index}"} for index in range(12)],
        },
        "rows": rows,
    }


class ScheduleIqValidationTests(unittest.TestCase):
    def test_valid_payload_passes_contract(self) -> None:
        validation = validate_schedule_iq_payload(valid_payload())
        self.assertTrue(validation["ok"], validation)
        self.assertEqual(validation["status"], "healthy")
        self.assertEqual(validation["summary"]["rowCount"], 192)
        self.assertEqual(validation["summary"]["agentCount"], 12)

    def test_missing_rows_fail_loudly(self) -> None:
        payload = valid_payload()
        payload["rows"] = payload["rows"][:-1]
        validation = validate_schedule_iq_payload(payload)
        self.assertFalse(validation["ok"])
        self.assertEqual(validation["status"], "critical")
        self.assertTrue(any("Expected 192 rows" in item for item in validation["errors"]))

    def test_missing_odds_is_warning_not_structural_failure(self) -> None:
        payload = valid_payload()
        payload["providerMeta"]["odds"] = {"configured": False}
        validation = validate_schedule_iq_payload(payload)
        self.assertTrue(validation["ok"])
        self.assertEqual(validation["status"], "warning")
        self.assertTrue(any("Odds API" in item for item in validation["warnings"]))


if __name__ == "__main__":
    unittest.main()
