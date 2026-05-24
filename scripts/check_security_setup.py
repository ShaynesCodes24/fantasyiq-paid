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
    gate_text = (ROOT / "api" / "admin_gate_auth.py").read_text(encoding="utf-8")
    middleware_text = (ROOT / "middleware.js").read_text(encoding="utf-8")
    if "params.get(\"token\"" in text or "params.get('token'" in text or "query token" in text.lower():
        return Result("Admin token transport", "FAIL", "Admin endpoint still accepts URL query tokens.")
    if "require_admin_gate" not in text or "FANTASYIQ_ADMIN_GATE_SECRET" not in gate_text:
        return Result("Admin gate", "FAIL", "Admin endpoint is missing the signed admin gate cookie check.")
    scoped_admin_middleware = 'matcher: ["/admin.html", "/api/admin-customers"]' in middleware_text
    canonical_middleware = (
        'matcher: ["/:path*"]' in middleware_text
        and "canonicalRedirect" in middleware_text
        and 'url.pathname !== "/admin.html"' in middleware_text
        and 'url.pathname !== "/api/admin-customers"' in middleware_text
    )
    if not (scoped_admin_middleware or canonical_middleware):
        return Result("Admin gate middleware", "FAIL", "Middleware is not scoped to canonical redirects plus the admin page/API.")
    if "x-fantasyiq-admin-token" not in text:
        return Result("Admin token transport", "FAIL", "Admin endpoint is missing the admin token header check.")
    if "compare_digest" not in text:
        return Result("Admin token comparison", "FAIL", "Admin endpoint should use constant-time token comparison.")
    return Result("Admin token transport", "PASS", "Admin requires gate cookie plus header-only token.")


def check_security_headers() -> Result:
    config = json.loads((ROOT / "vercel.json").read_text(encoding="utf-8"))
    headers = []
    for rule in config.get("headers") or []:
        if rule.get("source") == "/(.*)":
            headers = rule.get("headers") or []
            break
    values = {item.get("key"): item.get("value") for item in headers}
    required = {
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
        "X-Frame-Options": "DENY",
    }
    missing = [key for key, value in required.items() if values.get(key) != value]
    if missing:
        return Result("Security headers", "FAIL", f"Missing or changed headers: {', '.join(missing)}")
    return Result("Security headers", "PASS", "Baseline browser security headers are configured.")


def check_rate_limiting() -> Result:
    schema = (ROOT / "database" / "schema.sql").read_text(encoding="utf-8")
    if "fantasyiq_rate_limits" not in schema:
        return Result("Rate limit schema", "FAIL", "database/schema.sql is missing fantasyiq_rate_limits.")
    helper = ROOT / "api" / "rate_limit.py"
    if not helper.exists():
        return Result("Rate limit helper", "FAIL", "api/rate_limit.py is missing.")
    endpoint_files = [
        "admin_customers.py",
        "customer_login.py",
        "customer_password.py",
        "customer_password_reset.py",
        "customer_status.py",
        "live_draft.py",
        "setup_validate.py",
    ]
    missing = [
        file_name
        for file_name in endpoint_files
        if "check_rate_limit" not in (ROOT / "api" / file_name).read_text(encoding="utf-8")
    ]
    if missing:
        return Result("Rate limited endpoints", "FAIL", f"Missing rate limit checks: {', '.join(missing)}")
    setup_text = (ROOT / "api" / "setup_validate.py").read_text(encoding="utf-8")
    if "track_event" not in setup_text or "handle_tracking_if_requested" not in setup_text:
        return Result("Rate limited endpoints", "FAIL", "Client event tracking is not covered by setup_validate.py.")
    return Result("Rate limited endpoints", "PASS", "Sensitive launch endpoints have throttling hooks.")


def main() -> int:
    files = git_files()
    checks = [
        check_tracked_secrets(files),
        check_ignored(".gitignore", REQUIRED_GITIGNORE),
        check_ignored(".vercelignore", REQUIRED_VERCELIGNORE),
        check_vercel_config(),
        check_security_headers(),
        check_admin_token_transport(),
        check_rate_limiting(),
    ]

    for result in checks:
        print(f"{result.status:4} {result.name}: {result.detail}")

    failures = [result for result in checks if result.status == "FAIL"]
    print()
    print(f"Summary: {len(failures)} failed, {len(checks)} checks total.")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
