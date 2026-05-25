from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from api.fantasy_engine import analyze


def player(name: str, pos: str, value: float, rank: int, pos_rank: int, projection: float, risk: float = 4.0) -> dict:
    return {
        "Player": name,
        "Pos": pos,
        "Value Score": value,
        "Rank": rank,
        "Pos Rank": pos_rank,
        "Proj PPR Pts": projection,
        "Risk": risk,
        "Upside": value + 4,
        "Floor": value - 6,
    }


class ScoreCalibrationTests(unittest.TestCase):
    def test_good_roster_scores_as_solid_without_action_penalty(self) -> None:
        roster = [
            player("QB A", "QB", 78, 42, 7, 285),
            player("RB A", "RB", 88, 8, 3, 285),
            player("RB B", "RB", 80, 24, 10, 235),
            player("WR A", "WR", 87, 10, 4, 275),
            player("WR B", "WR", 81, 26, 11, 240),
            player("TE A", "TE", 76, 50, 6, 190),
            player("RB C", "RB", 70, 78, 26, 170),
            player("WR C", "WR", 71, 82, 31, 168),
            player("DST A", "DST", 58, 150, 4, 120, 3),
            player("K A", "K", 55, 170, 5, 115, 3),
        ]
        result = analyze({"roster": roster})
        self.assertGreaterEqual(result["fantasyIqScore"], 74)
        self.assertIn("scoreBreakdown", result)
        self.assertEqual(result["scoreBreakdown"]["modelVersion"], "consensus-score-v2")
        self.assertLessEqual(result["scoreBreakdown"]["constructionPenalty"], 4)

    def test_incomplete_roster_scores_below_solid_team(self) -> None:
        result = analyze({"roster": [player("RB A", "RB", 86, 12, 5, 260), player("WR A", "WR", 84, 15, 6, 250)]})
        self.assertLess(result["fantasyIqScore"], 74)
        self.assertGreaterEqual(result["fantasyIqScore"], 52)
        self.assertGreater(result["scoreBreakdown"]["constructionPenalty"], 0)


if __name__ == "__main__":
    unittest.main()
