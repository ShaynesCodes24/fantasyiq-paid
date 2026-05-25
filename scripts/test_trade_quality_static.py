from __future__ import annotations

import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DRAFT_JS = ROOT / "public" / "FantasyIQ" / "js" / "draft.js"


class TradeQualityStaticTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.source = DRAFT_JS.read_text(encoding="utf-8")

    def test_quality_gate_is_on_display_path(self) -> None:
        self.assertIn("function tradeIdeaQualityGate", self.source)
        self.assertIn("qualityPass", self.source)
        self.assertRegex(self.source, r"filter\(\(idea\) => idea\.qualityPass\)")

    def test_zero_activity_placeholders_do_not_count_as_support(self) -> None:
        self.assertIn("tradePackageRealActivity", self.source)
        self.assertIn("support.sampleRequired", self.source)
        self.assertIn("One or more players lack accepted-trade activity.", self.source)

    def test_only_realistic_shapes_are_enabled(self) -> None:
        gate_body = re.search(r"function tradeIdeaQualityGate\(idea, context = \{\}\) \{(?P<body>.*?)\n\}", self.source, re.S)
        self.assertIsNotNone(gate_body)
        body = gate_body.group("body")
        self.assertIn("shapeParts[0] === 1 && shapeParts[1] === 1", body)
        self.assertIn("shapeParts[0] === 2 && shapeParts[1] === 1", body)
        self.assertIn("Only realistic 1-for-1 and 2-for-1 ideas are enabled.", body)


if __name__ == "__main__":
    unittest.main()
