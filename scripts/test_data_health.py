from __future__ import annotations

import unittest
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import api.cron_daily_refresh as cron_daily_refresh
from api.provider_cache import health_status_for_row


class DataHealthTests(unittest.TestCase):
    def test_old_successful_row_becomes_overdue(self) -> None:
        now = datetime(2026, 5, 25, 12, 0, tzinfo=timezone.utc)
        row = {
            "source": "fantasyiq-cron",
            "source_scope": "sos-heatmap",
            "last_success_at": "2026-05-23T12:00:00Z",
            "last_attempt_at": "2026-05-23T12:00:00Z",
            "max_age_seconds": 3600,
            "is_stale": False,
            "warning": "",
        }
        health = health_status_for_row(row, now)
        self.assertEqual(health["computedStatus"], "critical")
        self.assertTrue(health["overdue"])
        self.assertIn("older", health["staleReason"])

    def test_recent_successful_row_is_healthy(self) -> None:
        now = datetime(2026, 5, 25, 12, 0, tzinfo=timezone.utc)
        row = {
            "source": "fantasyiq-cron",
            "source_scope": "fantasycalc-market",
            "last_success_at": "2026-05-25T11:50:00Z",
            "last_attempt_at": "2026-05-25T11:50:00Z",
            "max_age_seconds": 3600,
            "is_stale": False,
            "warning": "",
        }
        health = health_status_for_row(row, now)
        self.assertEqual(health["computedStatus"], "healthy")
        self.assertFalse(health["overdue"])

    def test_cron_run_step_treats_ok_false_payload_as_failure(self) -> None:
        recorded: list[dict] = []
        original = cron_daily_refresh.record_freshness
        cron_daily_refresh.record_freshness = lambda **kwargs: recorded.append(kwargs) or True
        try:
            step = cron_daily_refresh.run_step("live-board-demo-snapshot", lambda: {"ok": False, "warning": "too few rows"})
        finally:
            cron_daily_refresh.record_freshness = original
        self.assertFalse(step["ok"])
        self.assertEqual(recorded[0]["ok"], False)
        self.assertEqual(recorded[0]["warning"], "too few rows")


if __name__ == "__main__":
    unittest.main()
