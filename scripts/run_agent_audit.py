from __future__ import annotations

import os
import shutil
import subprocess
import sys
import time
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
REPORT_DIR = ROOT / "artifacts" / "agent-reports"


@dataclass
class Check:
    name: str
    command: list[str]
    required: bool = True
    env: dict[str, str] | None = None


@dataclass
class Result:
    name: str
    command: str
    status: str
    exit_code: int
    output: str
    elapsed_seconds: float


def run_check(check: Check) -> Result:
    env = os.environ.copy()
    if check.env:
        env.update(check.env)

    command = list(check.command)
    resolved = shutil.which(command[0])
    if resolved:
        command[0] = resolved

    started = time.perf_counter()
    completed = subprocess.run(
        command,
        cwd=ROOT,
        env=env,
        capture_output=True,
        text=True,
        shell=False,
    )
    elapsed = time.perf_counter() - started
    output = "\n".join(part for part in (completed.stdout, completed.stderr) if part).strip()
    status = "PASS" if completed.returncode == 0 else ("FAIL" if check.required else "WARN")
    return Result(
        name=check.name,
        command=" ".join(check.command),
        status=status,
        exit_code=completed.returncode,
        output=output,
        elapsed_seconds=elapsed,
    )


def checks() -> list[Check]:
    items = [
        Check("TypeScript typecheck", ["npm", "run", "typecheck"]),
        Check("API import check", ["npm", "run", "test:api"]),
        Check("Security boundary tests", ["npm", "run", "test:security-boundaries"]),
        Check("Dashboard mirror drift", ["npm", "run", "test:mirrors"]),
        Check("CSP hash check", ["npm", "run", "test:csp"]),
        Check("Security setup", [sys.executable, "scripts/check_security_setup.py"]),
        Check("FantasyIQ OS readiness", [sys.executable, "scripts/check_os_readiness.py"]),
        Check("Daily league health report", ["npm", "run", "agent:health"]),
        Check("Static build", ["npm", "run", "build"]),
    ]

    if os.environ.get("FANTASYIQ_AGENT_AUDIT_VISUAL") == "1":
        items.append(Check("Visual smoke", ["npm", "run", "test:visual"], required=False))

    if os.environ.get("FANTASYIQ_AGENT_AUDIT_PRODUCTION") == "1":
        items.append(Check("Production readiness", ["npm", "run", "test:readiness"], required=False))

    return items


def summarize_output(output: str, max_lines: int = 28) -> str:
    lines = output.splitlines()
    if len(lines) <= max_lines:
        return output or "(no output)"
    head = lines[: max_lines // 2]
    tail = lines[-(max_lines // 2) :]
    omitted = len(lines) - len(head) - len(tail)
    return "\n".join([*head, f"... {omitted} line(s) omitted ...", *tail])


def write_report(results: list[Result]) -> Path:
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    report_path = REPORT_DIR / f"fantasyiq-agent-report-{stamp}.md"
    failed = [result for result in results if result.status == "FAIL"]
    warned = [result for result in results if result.status == "WARN"]
    total_seconds = sum(result.elapsed_seconds for result in results)

    lines = [
        "# FantasyIQ Internal Agent Report",
        "",
        f"Generated: {datetime.now().astimezone().isoformat(timespec='seconds')}",
        "",
        "## Lead Agent Summary",
        "",
        f"- Required checks failed: {len(failed)}",
        f"- Optional checks warned: {len(warned)}",
        f"- Checks run: {len(results)}",
        f"- Check runtime: {total_seconds:.1f} seconds",
        "",
        "## Guardrails Applied",
        "",
        "- Local-only validation by default.",
        "- No deploy, payment, email, database, or production mutation.",
        "- No secret printing or `.env*` inspection.",
        "- Production readiness and browser smoke checks require explicit env opt-in.",
        "",
        "## Agent Team Findings",
        "",
        "- Lead Agent: ran the local safety and readiness loop.",
        "- Security Agent: covered by `scripts/check_security_setup.py`.",
        "- QA Agent: covered by typecheck, API imports, OS readiness, and build.",
        "- Platform Efficiency Agent: watch mirrored dashboard copies; edit `public/FantasyIQ/` first, then sync/build.",
        "- Product Intelligence Agent: keep every feature tied to the Main Move and FantasyIQ Score.",
        "",
        "## Check Results",
        "",
    ]

    for result in results:
        lines.extend(
            [
                f"### {result.status} {result.name}",
                "",
                f"Command: `{result.command}`",
                f"Exit code: `{result.exit_code}`",
                f"Runtime: `{result.elapsed_seconds:.1f}s`",
                "",
                "```text",
                summarize_output(result.output),
                "```",
                "",
            ]
        )

    lines.extend(
        [
            "## Recommended Next Actions",
            "",
            "1. Add focused tests around any route or workflow touched during a work block.",
            "2. Keep dashboard edits in `public/FantasyIQ/` and run `node .\\scripts\\sync_dashboard_mirror.js` before build.",
            "3. Add product-facing AI only after provider setup, grounding rules, cost controls, evals, and user-visible confidence are designed.",
            "4. Require owner approval before any production, Stripe, email, database, admin, or auth-sensitive action.",
            "",
        ]
    )

    report_path.write_text("\n".join(lines), encoding="utf-8")
    return report_path


def main() -> int:
    results = [run_check(check) for check in checks()]
    report_path = write_report(results)

    for result in results:
        print(f"{result.status:4} {result.name} ({result.exit_code})")
    print(f"REPORT {report_path}")

    return 1 if any(result.status == "FAIL" for result in results) else 0


if __name__ == "__main__":
    raise SystemExit(main())
