from __future__ import annotations

import unittest
import sys
from pathlib import Path
from types import SimpleNamespace


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


class SecurityBoundaryTests(unittest.TestCase):
    def test_customer_status_redaction_excludes_league_metadata(self) -> None:
        from api.customer_status import redacted_customer_status

        context = SimpleNamespace(
            slug="sample-owner",
            access_code="setup-code",
            password_configured=True,
            league_id=584856941,
            league_settings={"scoringType": "ppr"},
            available_leagues=[{"leagueId": 584856941}],
        )
        payload = redacted_customer_status(context)

        self.assertEqual(payload["customerSlug"], "sample-owner")
        self.assertTrue(payload["accessRequired"])
        self.assertTrue(payload["passwordConfigured"])
        for forbidden in ("leagueId", "leagueSettings", "leagues", "customerName", "customerTeamId"):
            self.assertNotIn(forbidden, payload)

    def test_live_draft_override_requires_saved_league(self) -> None:
        from api.customer_context import CustomerContext
        from api.live_draft import override_customer_context

        context = CustomerContext(
            slug="owner",
            customer_name="Owner",
            league_id=111,
            season=2026,
            customer_team_id=5,
            league_key="main",
            league_name="Main League",
            league_settings={"scoringType": "ppr"},
            available_leagues=[{"leagueKey": "second", "leagueId": 222, "teamId": 8, "season": 2026}],
        )

        saved = override_customer_context(context, "/api/live-draft?draftLeagueId=222&draftTeamId=8")
        self.assertEqual(saved.league_id, 222)
        self.assertEqual(saved.customer_team_id, 8)
        self.assertEqual(saved.league_key, "second")
        self.assertEqual(saved.league_settings, {})

        with self.assertRaises(PermissionError):
            override_customer_context(context, "/api/live-draft?draftLeagueId=999&draftTeamId=1")
        with self.assertRaises(PermissionError):
            override_customer_context(context, "/api/live-draft?draftLeagueId=222&draftSeason=2025&draftTeamId=8")

    def test_refunded_customer_status_blocks_access(self) -> None:
        from api.customer_context import CustomerContext, verify_customer_access

        context = CustomerContext(
            slug="owner",
            customer_name="Owner",
            league_id=111,
            season=2026,
            access_code="code",
            status="refunded",
        )
        with self.assertRaises(PermissionError):
            verify_customer_access(context, headers={"x-fantasyiq-access-code": "code"})

    def test_draft_bridge_requires_registration_and_matching_key(self) -> None:
        import api.draft_bridge as draft_bridge

        original_database_enabled = draft_bridge.database_enabled
        draft_bridge.database_enabled = lambda: False
        draft_bridge._memory_bridge.clear()
        try:
            snapshot = draft_bridge.clean_snapshot(
                {
                    "leagueId": 444,
                    "season": 2026,
                    "picks": [{"teamId": 1, "playerId": 100, "overall": 1}],
                }
            )

            with self.assertRaises(PermissionError):
                draft_bridge.store_bridge_snapshot(snapshot, "x" * 32)

            draft_bridge.register_bridge_session(444, 2026, "a" * 32)
            with self.assertRaises(PermissionError):
                draft_bridge.store_bridge_snapshot(snapshot, "b" * 32)

            stored = draft_bridge.store_bridge_snapshot(snapshot, "a" * 32)
            self.assertEqual(stored["pickCount"], 1)

            draft_bridge.register_bridge_session(444, 2026, "b" * 32)
            reset = draft_bridge.bridge_snapshot_for_league(444, 2026)
            self.assertEqual((reset or {}).get("pickCount"), 0)
            with self.assertRaises(PermissionError):
                draft_bridge.store_bridge_snapshot(snapshot, "a" * 32)
            rotated = draft_bridge.store_bridge_snapshot(snapshot, "b" * 32)
            self.assertEqual(rotated["pickCount"], 1)
        finally:
            draft_bridge._memory_bridge.clear()
            draft_bridge.database_enabled = original_database_enabled

    def test_stripe_checkout_rejects_unsafe_fulfillment_states(self) -> None:
        import os

        from api.stripe_webhook import checkout_session_rejection_reason

        base = {
            "id": "cs_test_123",
            "payment_status": "paid",
            "amount_total": 3000,
            "currency": "usd",
            "customer": "cus_123",
            "customer_details": {"email": "customer@example.com"},
        }
        saved_livemode = os.environ.pop("FANTASYIQ_STRIPE_LIVEMODE", None)
        saved_payment_links = os.environ.pop("FANTASYIQ_STRIPE_ALLOWED_PAYMENT_LINK_IDS", None)
        try:
            self.assertEqual(checkout_session_rejection_reason(base), "")

            unpaid = {**base, "payment_status": "unpaid"}
            self.assertEqual(checkout_session_rejection_reason(unpaid), "checkout_not_paid")

            wrong_currency = {**base, "currency": "eur"}
            self.assertEqual(checkout_session_rejection_reason(wrong_currency), "checkout_currency_not_supported")

            missing_amount = {**base, "amount_total": 0}
            self.assertEqual(checkout_session_rejection_reason(missing_amount), "checkout_amount_invalid")

            missing_customer = {**base, "customer": "", "customer_details": {}}
            self.assertEqual(checkout_session_rejection_reason(missing_customer), "checkout_customer_missing")

            os.environ["FANTASYIQ_STRIPE_LIVEMODE"] = "live"
            self.assertEqual(checkout_session_rejection_reason({**base, "livemode": False}), "checkout_livemode_mismatch")

            os.environ.pop("FANTASYIQ_STRIPE_LIVEMODE", None)
            os.environ["FANTASYIQ_STRIPE_ALLOWED_PAYMENT_LINK_IDS"] = "plink_allowed"
            self.assertEqual(
                checkout_session_rejection_reason({**base, "payment_link": "plink_wrong"}),
                "checkout_payment_link_not_allowed",
            )
            self.assertEqual(checkout_session_rejection_reason({**base, "payment_link": "plink_allowed"}), "")
            self.assertEqual(checkout_session_rejection_reason({**base, "metadata": {"product": "additional_league"}}), "")
            self.assertEqual(
                checkout_session_rejection_reason({**base, "metadata": {"product_id": "prod_wrong"}}),
                "checkout_product_not_allowed",
            )
            self.assertEqual(
                checkout_session_rejection_reason({**base, "metadata": {"price_id": "price_wrong"}}),
                "checkout_price_not_allowed",
            )
        finally:
            restore_env("FANTASYIQ_STRIPE_LIVEMODE", saved_livemode)
            restore_env("FANTASYIQ_STRIPE_ALLOWED_PAYMENT_LINK_IDS", saved_payment_links)

    def test_stripe_checkout_ignores_client_controlled_customer_slug(self) -> None:
        from api.stripe_webhook import checkout_customer_slug

        session = {
            "client_reference_id": "victim-account",
            "metadata": {"customer_slug": "victim-account", "customer": "other-victim"},
            "custom_fields": [
                {"key": "customer", "type": "text", "text": {"value": "third-victim"}},
            ],
        }
        row = {"email": "Buyer+Alias@example.com", "customer_name": "Buyer Name"}
        self.assertEqual(checkout_customer_slug(session, row), "buyer-alias-example-com")

    def test_unpaid_stripe_event_is_ignored_before_side_effects(self) -> None:
        import api.stripe_webhook as stripe_webhook

        event = {
            "id": "evt_unpaid",
            "type": "checkout.session.completed",
            "data": {
                "object": {
                    "id": "cs_unpaid",
                    "payment_status": "unpaid",
                    "amount_total": 3000,
                    "currency": "usd",
                    "customer": "cus_123",
                    "customer_details": {"email": "customer@example.com"},
                }
            },
        }

        original_append = stripe_webhook.append_customer_locally
        original_persist = stripe_webhook.persist_checkout_to_database
        try:
            stripe_webhook.append_customer_locally = lambda row: (_ for _ in ()).throw(AssertionError("local append called"))
            stripe_webhook.persist_checkout_to_database = lambda event, session, row: (_ for _ in ()).throw(AssertionError("database persist called"))
            result = stripe_webhook.process_event(event)
        finally:
            stripe_webhook.append_customer_locally = original_append
            stripe_webhook.persist_checkout_to_database = original_persist

        self.assertEqual(result["action"], "checkout_ignored")
        self.assertEqual(result["status"], "checkout_not_paid")

    def test_invoice_payment_succeeded_updates_subscription_access(self) -> None:
        import api.stripe_webhook as stripe_webhook

        calls = []
        original_persist = stripe_webhook.persist_subscription_access_event
        try:
            stripe_webhook.persist_subscription_access_event = lambda event, data_object, status: calls.append(
                (event["type"], data_object["id"], status)
            ) or {"persistedDatabase": True}
            result = stripe_webhook.process_event(
                {
                    "id": "evt_invoice_paid",
                    "type": "invoice.payment_succeeded",
                    "data": {"object": {"id": "in_123", "status": "paid"}},
                }
            )
        finally:
            stripe_webhook.persist_subscription_access_event = original_persist

        self.assertEqual(result["action"], "invoice_paid")
        self.assertEqual(calls, [("invoice.payment_succeeded", "in_123", "active")])

    def test_login_failures_and_reset_responses_are_generic(self) -> None:
        from api.customer_login import GENERIC_LOGIN_FAILURE
        from api.customer_password_reset import password_reset_payload

        self.assertEqual(GENERIC_LOGIN_FAILURE, "Email, password, or access code did not match.")
        reset_payload = password_reset_payload({"customer": "missing@example.com"})
        self.assertTrue(reset_payload["ok"])
        self.assertNotIn("email", reset_payload)
        self.assertEqual(reset_payload["message"], "If that account exists, a password reset email is on the way.")

    def test_setup_page_does_not_persist_access_code(self) -> None:
        text = (ROOT / "public" / "setup.html").read_text(encoding="utf-8")
        self.assertNotIn(":access-code`", text)
        self.assertNotIn(":access-code", text)
        self.assertNotIn("savedAccessCode", text)
        self.assertNotIn("rememberAccessCode", text)

    def test_local_env_handles_utf8_bom(self) -> None:
        import os
        import tempfile

        from scripts.local_env import load_local_env

        saved = os.environ.pop("DATABASE_URL", None)
        try:
            with tempfile.NamedTemporaryFile("w", encoding="utf-8", delete=False) as handle:
                handle.write("\ufeffDATABASE_URL=postgres://example\n")
                env_path = handle.name
            load_local_env(env_path)
            self.assertEqual(os.environ.get("DATABASE_URL"), "postgres://example")
        finally:
            Path(env_path).unlink(missing_ok=True)
            restore_env("DATABASE_URL", saved)

    def test_health_report_is_redacted(self) -> None:
        from scripts.daily_league_intelligence_health import build_report

        report = build_report("local", no_network=True)
        encoded = json_dumps_lower(report)
        for forbidden in (
            "email",
            "access_code",
            "accesscode",
            "password_hash",
            "stripe_customer",
            "stripecustomer",
            "admin_token",
            "session_token",
            "secret",
        ):
            self.assertNotIn(forbidden, encoded)


def json_dumps_lower(value: object) -> str:
    import json

    return json.dumps(value, sort_keys=True).lower()


def restore_env(name: str, value: str | None) -> None:
    import os

    if value is None:
        os.environ.pop(name, None)
    else:
        os.environ[name] = value


if __name__ == "__main__":
    unittest.main()
