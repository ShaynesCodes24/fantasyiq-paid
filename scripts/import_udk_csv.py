from __future__ import annotations

import argparse
import csv
import json
import re
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


DEFAULT_INPUT = Path("private/udk")
DEFAULT_OUTPUT = Path("private/udk/udk_signals.local.json")
POSITIONS = {"QB", "RB", "WR", "TE", "DST", "D/ST", "DEF", "K"}

COLUMN_ALIASES = {
    "name": ["player", "player name", "name", "full name"],
    "pos": ["pos", "position"],
    "team": ["team", "tm", "nfl team"],
    "rank": ["rank", "overall rank", "overall", "ovr", "udk rank", "top 200 rank"],
    "pos_rank": ["pos rank", "position rank", "positional rank", "positional", "position ranking"],
    "tier": ["tier", "udk tier"],
    "risk": ["risk", "risk rating", "risk score"],
    "upside": ["upside", "upside meter", "upside rating"],
    "projection": ["projection", "projected points", "proj", "points", "fantasy points", "projected fantasy points"],
    "adp": ["adp", "average draft position", "avg draft position"],
}


@dataclass
class ImportResult:
    files: int
    rows: int
    matched_rows: int
    output: Path


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def normalize_header(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", str(value or "").strip().lower()).strip()


def normalize_name(name: str) -> str:
    return (
        str(name or "")
        .lower()
        .encode("ascii", "ignore")
        .decode("ascii")
        .replace(".", "")
        .replace("'", "")
    )


def player_key(name: str) -> str:
    cleaned = re.sub(r"\b(jr|sr|ii|iii|iv)\b", "", normalize_name(name))
    return "".join(ch for ch in cleaned if ch.isalnum())


def normalize_pos(value: Any) -> str:
    pos = str(value or "").strip().upper().replace(" ", "")
    if pos in {"D/ST", "DEF", "DEFENSE"}:
        return "DST"
    return pos if pos in {"QB", "RB", "WR", "TE", "DST", "K"} else ""


def number_value(value: Any) -> float | None:
    text = str(value or "").replace(",", "").strip()
    if not text:
        return None
    match = re.search(r"-?\d+(?:\.\d+)?", text)
    if not match:
        return None
    try:
        return float(match.group(0))
    except ValueError:
        return None


def int_value(value: Any) -> int | None:
    number = number_value(value)
    return int(round(number)) if number is not None else None


def short_value(value: Any, limit: int = 48) -> str:
    text = re.sub(r"\s+", " ", str(value or "").strip())
    return text[:limit]


def header_map(fieldnames: list[str] | None) -> dict[str, str]:
    normalized = {normalize_header(name): name for name in fieldnames or []}
    mapping: dict[str, str] = {}
    for target, aliases in COLUMN_ALIASES.items():
        for alias in aliases:
            key = normalize_header(alias)
            if key in normalized:
                mapping[target] = normalized[key]
                break
    return mapping


def infer_pos_from_file(path: Path) -> str:
    parts = re.split(r"[^a-zA-Z]+", path.stem.upper())
    for part in parts:
        pos = normalize_pos(part)
        if pos:
            return pos
    if "D" in parts and "ST" in parts:
        return "DST"
    return ""


def csv_files(inputs: list[Path]) -> list[Path]:
    files: list[Path] = []
    for item in inputs:
        if item.is_dir():
            files.extend(sorted(path for path in item.glob("*.csv") if path.is_file()))
        elif item.is_file() and item.suffix.lower() == ".csv":
            files.append(item)
    return files


def build_entry(row: dict[str, Any], mapping: dict[str, str], path: Path) -> dict[str, Any] | None:
    name = short_value(row.get(mapping.get("name", "")), 80)
    if not name:
        return None
    pos = normalize_pos(row.get(mapping.get("pos", ""))) or infer_pos_from_file(path)
    if not pos:
        return None
    rank = int_value(row.get(mapping.get("rank", "")))
    pos_rank = int_value(row.get(mapping.get("pos_rank", "")))
    tier = short_value(row.get(mapping.get("tier", "")), 32)
    entry = {
        "name": name,
        "nameKey": player_key(name),
        "pos": pos,
        "team": short_value(row.get(mapping.get("team", "")), 8).upper(),
        "udkRank": rank,
        "udkPosRank": pos_rank,
        "udkTier": tier,
        "udkRisk": number_value(row.get(mapping.get("risk", ""))),
        "udkUpside": number_value(row.get(mapping.get("upside", ""))),
        "udkProjection": number_value(row.get(mapping.get("projection", ""))),
        "udkAdp": number_value(row.get(mapping.get("adp", ""))),
        "sourceFile": path.name,
    }
    return {key: value for key, value in entry.items() if value not in (None, "")}


def import_udk(inputs: list[Path], output: Path, *, source_label: str, strict: bool = False) -> ImportResult:
    files = csv_files(inputs)
    if strict and not files:
        raise SystemExit("No UDK CSV files found.")

    players: dict[str, dict[str, Any]] = {}
    aliases: dict[str, list[str]] = {}
    row_count = 0

    for path in files:
        with path.open("r", encoding="utf-8-sig", newline="") as handle:
            reader = csv.DictReader(handle)
            mapping = header_map(reader.fieldnames)
            if "name" not in mapping:
                print(f"WARN {path}: skipped because no player/name column was detected.")
                continue
            for row in reader:
                row_count += 1
                entry = build_entry(row, mapping, path)
                if not entry:
                    continue
                key = f"{entry['nameKey']}|{entry['pos']}"
                existing = players.get(key)
                if existing:
                    existing_rank = existing.get("udkRank") or 9999
                    new_rank = entry.get("udkRank") or 9999
                    if new_rank >= existing_rank:
                        continue
                players[key] = entry
                aliases.setdefault(entry["nameKey"], [])
                if key not in aliases[entry["nameKey"]]:
                    aliases[entry["nameKey"]].append(key)

    if strict and not players:
        raise SystemExit("No UDK player rows could be normalized.")

    payload = {
        "source": source_label,
        "generatedAt": utc_now(),
        "licenseMode": "private_csv_import",
        "policy": "Keep raw UDK+ exports and generated signal files private unless you have redistribution rights.",
        "files": [path.name for path in files],
        "playerCount": len(players),
        "players": dict(sorted(players.items())),
        "aliases": dict(sorted(aliases.items())),
    }

    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, indent=2, sort_keys=True), encoding="utf-8")
    return ImportResult(files=len(files), rows=row_count, matched_rows=len(players), output=output)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Normalize private Fantasy Footballers UDK+ CSV exports for FantasyIQ.")
    parser.add_argument("inputs", nargs="*", type=Path, help="UDK CSV files or directories. Defaults to private/udk.")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT, help="Generated private signal JSON path.")
    parser.add_argument("--source-label", default="Fantasy Footballers UDK+ CSV export", help="Attribution label stored in the signal file.")
    parser.add_argument("--strict", action="store_true", help="Fail when no files or rows are imported.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    inputs = args.inputs or [DEFAULT_INPUT]
    result = import_udk(inputs, args.output, source_label=args.source_label, strict=args.strict)
    print(f"Imported {result.matched_rows} UDK player signal(s) from {result.files} file(s), {result.rows} row(s) scanned.")
    print(f"Wrote private signal file: {result.output}")
    print("Set FANTASYIQ_UDK_SIGNALS_FILE to this path to enrich FantasyIQ locally or in a private deployment.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
