from __future__ import annotations

import json
import re
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]

SECRET_PATTERNS = {
    "Stripe secret key": re.compile(r"sk_(live|test)_[A-Za-z0-9]{16,}"),
    "Stripe webhook secret": re.compile(r"whsec_[A-Za-z0-9]{16,}"),
    "Vercel token": re.compile(r"\b[A-Za-z0-9]{24,}:[A-Za-z0-9_-]{20,}\b"),
}

REQUIRED_GITIGNORE = {
    ".env",
    ".env.local",
    ".env.*.local",
    "customers.csv",
    "customers.local.csv",
}

REQUIRED_VERCELIGNORE = REQUIRED_GITIGNORE | {
    ".venv",
    ".git",
    "*.log",
    "customers.csv",
    "customers.local.csv",
}


@dataclass
class Result:
    name: str
    status: str
    detail: str


def git_files() -> list[str]:
    completed = subprocess.run(
        ["git", "ls-files"],
        cwd=ROOT,
        check=True,
        capture_output=True,
        text=True,
    )
    return [line.strip() for line in completed.stdout.splitlines() if line.strip()]


def read_lines(path: Path) -> set[str]:
    if not path.exists():
        return set()
    return {
        line.strip()
        for line in path.read_text(encoding="utf-8", errors="replace").splitlines()
        if line.strip() and not line.strip().startswith("#")
    }


def check_tracked_secrets(files: list[str]) -> Result:
    findings: list[str] = []
    for file_name in files:
        path = ROOT / file_name
        if not path.is_file() or path.suffix.lower() in {".png", ".jpg", ".jpeg", ".gif", ".ico"}:
            continue
        text = path.read_text(encoding="utf-8", errors="replace")
        for label, pattern in SECRET_PATTERNS.items():
            if pattern.search(text):
                findings.append(f"{label} pattern in {file_name}")
    if findings:
        return Result("Tracked secret scan", "FAIL", "; ".join(findings))
    return Result("Tracked secret scan", "PASS", "No live-looking secret patterns in tracked text files.")


def check_ignored(path_name: str, required: set[str]) -> Result:
    path = ROOT / path_name
    lines = read_lines(path)
    missing = sorted(required - lines)
    if missing:
        return Result(path_name, "FAIL", f"Missing ignore entries: {', '.join(missing)}")
    return Result(path_name, "PASS", "Required local secret/customer files are ignored.")


def check_vercel_config() -> Result:
    config = json.loads((ROOT / "vercel.json").read_text(encoding="utf-8"))
    env = config.get("env") or {}
    customer_keys = sorted(key for key in env if key.startswith("FANTASY_IQ_"))
    if customer_keys:
        return Result("Vercel env config", "FAIL", f"Customer env vars are hardcoded: {', '.join(customer_keys)}")
    redirects = config.get("redirects") or []
    root_redirects = [item for item in redirects if item.get("source") == "/"]
    if root_redirects:
        return Result("Vercel root route", "FAIL", "Root URL still redirects away from the sales page.")
    return Result("Vercel public config", "PASS", "No hardcoded customer env vars or root redirect.")


def check_admin_token_transport() -> Result:
    text = (ROOT / "api" / "admin_customers.py").read_text(encoding="utf-8")
    if "parse_qs" in text or "urlparse" in text or "params.get(\"token\"" in text:
        return Result("Admin token transport", "FAIL", "Admin endpoint still accepts URL query tokens.")
    if "x-fantasyiq-admin-token" not in text:
        return Result("Admin token transport", "FAIL", "Admin endpoint is missing the admin token header check.")
    return Result("Admin token transport", "PASS", "Admin token is accepted by header only.")


def main() -> int:
    files = git_files()
    checks = [
        check_tracked_secrets(files),
        check_ignored(".gitignore", REQUIRED_GITIGNORE),
        check_ignored(".vercelignore", REQUIRED_VERCELIGNORE),
        check_vercel_config(),
        check_admin_token_transport(),
    ]

    for result in checks:
        print(f"{result.status:4} {result.name}: {result.detail}")

    failures = [result for result in checks if result.status == "FAIL"]
    print()
    print(f"Summary: {len(failures)} failed, {len(checks)} checks total.")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
