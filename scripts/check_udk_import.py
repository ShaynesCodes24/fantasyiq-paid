from __future__ import annotations

import json
import sys
import tempfile
from pathlib import Path

from import_udk_csv import import_udk


def main() -> int:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        source = root / "udk_rb.csv"
        output = root / "signals.json"
        source.write_text(
            "Rank,Player,Pos,Team,Tier,Risk,Upside,Projected Points,ADP\n"
            "1,Bijan Robinson,RB,ATL,1,2,98,340.5,2.2\n"
            "14,Kyren Williams,RB,LAR,3,5,80,244.2,22.1\n",
            encoding="utf-8",
        )
        result = import_udk([source], output, source_label="UDK test fixture", strict=True)
        payload = json.loads(output.read_text(encoding="utf-8"))
        players = payload.get("players") or {}
        bijan = players.get("bijanrobinson|RB")
        kyren = players.get("kyrenwilliams|RB")
        assert result.matched_rows == 2
        assert bijan and bijan["udkRank"] == 1 and bijan["udkTier"] == "1"
        assert kyren and kyren["udkProjection"] == 244.2
        assert payload.get("licenseMode") == "private_csv_import"
    print("PASS UDK import: sample CSV normalized into private signal JSON.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
