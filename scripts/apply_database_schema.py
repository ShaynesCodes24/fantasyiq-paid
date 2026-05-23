from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "api"))
sys.path.insert(0, str(ROOT / "scripts"))

from database import DatabaseUnavailable, apply_schema, database_status  # noqa: E402
from local_env import load_local_env  # noqa: E402


def main() -> int:
    load_local_env()
    schema_path = ROOT / "database" / "schema.sql"
    status = database_status()
    if not status["configured"]:
        print("DATABASE_URL is not configured. Connect Neon/Postgres first.")
        return 1
    if not status["driverReady"]:
        print("psycopg is not installed. Run: pip install -r requirements.txt")
        return 1
    try:
        apply_schema(schema_path.read_text(encoding="utf-8"))
    except DatabaseUnavailable as exc:
        print(str(exc))
        return 1
    print("FantasyIQ database schema applied.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
