from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path

from local_env import load_local_env


ROOT = Path(__file__).resolve().parents[1]
PYTHON = sys.executable


@dataclass
class Step:
    name: str
    status: str
    detail: str


def env(name: str, default: str = "") -> str:
    return os.environ.get(name, default).strip()


def run_command(command: list[str], name: str, allow_fail: bool = False) -> Step:
    completed = subprocess.run(
        command,
        cwd=ROOT,
        text=True,
        capture_output=True,
    )
    output = "\n".join(part for part in [completed.stdout.strip(), completed.stderr.strip()] if part)
    if completed.returncode == 0:
        return Step(name, "PASS", output or "completed")
    if allow_fail:
        return Step(name, "WARN", output or f"exited {completed.returncode}")
    return Step(name, "FAIL", output or f"exited {completed.returncode}")


def compile_python() -> Step:
    files = [str(path) for folder in ("api", "scripts") for path in (ROOT / folder).glob("*.py")]
    return run_command([PYTHON, "-m", "py_compile", *files], "Python compile")


def security_check() -> Step:
    return run_command([PYTHON, "scripts/check_security_setup.py"], "Security setup check")


def local_content_check() -> Step:
    checks = {
        "public/index.html": ["Check ESPN compatibility", "setup.html?mode=precheck", "Software subscription only"],
        "public/FantasyIQ/config.js": ["Demo Mode", "showSubscribeButton: true", "$30 / year"],
        "SECURITY_SETUP.md": ["Do not put admin tokens in URLs", "customers.csv", "excluded from Vercel deploys"],
    }
    missing: list[str] = []
    for relative_path, needles in checks.items():
        text = (ROOT / relative_path).read_text(encoding="utf-8", errors="replace")
        for needle in needles:
            if needle not in text:
                missing.append(f"{relative_path}: {needle}")
    if missing:
        return Step("Static content check", "FAIL", "; ".join(missing))
    return Step("Static content check", "PASS", "Public sales/demo/security copy is present.")


def node_build() -> Step:
    if not shutil.which("node"):
        return Step("Static build", "WARN", "Node is not installed locally. Vercel will run the build during deploy.")
    return run_command(["node", "scripts/build_static.js"], "Static build")


def stripe_payment_link_setup(apply: bool) -> Step:
    if not env("STRIPE_SECRET_KEY"):
        return Step("Stripe Payment Link setup", "WARN", "Set STRIPE_SECRET_KEY to configure the live Payment Link.")
    if not apply:
        return Step("Stripe Payment Link setup", "WARN", "Ready, but skipped. Re-run with --apply-stripe.")
    return run_command([PYTHON, "scripts/configure_stripe_payment_link.py"], "Stripe Payment Link setup")


def stripe_webhook_setup(apply: bool) -> Step:
    if not env("STRIPE_SECRET_KEY"):
        return Step("Stripe webhook setup", "WARN", "Set STRIPE_SECRET_KEY to create or update the webhook endpoint.")
    if not apply:
        return Step("Stripe webhook setup", "WARN", "Ready, but skipped. Re-run with --apply-stripe.")
    return run_command([PYTHON, "scripts/configure_stripe_webhook.py"], "Stripe webhook setup")


def vercel_env_setup(apply: bool) -> Step:
    if not env("VERCEL_TOKEN"):
        return Step("Vercel env setup", "WARN", "Set VERCEL_TOKEN to write production env vars.")
    if not (env("FANTASY_IQ_CUSTOMERS_JSON") or env("FANTASY_IQ_LEAGUES_JSON") or env("FANTASY_IQ_LEAGUE_ID")):
        return Step(
            "Vercel env setup",
            "WARN",
            "Set FANTASY_IQ_CUSTOMERS_JSON for customer/league profiles, FANTASY_IQ_LEAGUES_JSON for one customer with multiple leagues, or FANTASY_IQ_LEAGUE_ID for one customer.",
        )
    if not apply:
        return Step("Vercel env setup", "WARN", "Ready, but skipped. Re-run with --apply-vercel-env.")
    return run_command([PYTHON, "scripts/configure_vercel_env.py"], "Vercel env setup")


def vercel_deploy(apply: bool) -> Step:
    vercel_bin = shutil.which("vercel")
    if not vercel_bin:
        return Step("Vercel deploy", "WARN", "Vercel CLI is not installed locally. Use Git deploy or install Vercel CLI.")
    if not apply:
        return Step("Vercel deploy", "WARN", "Ready, but skipped. Re-run with --deploy.")
    token_args = ["--token", env("VERCEL_TOKEN")] if env("VERCEL_TOKEN") else []
    scope_value = env("VERCEL_TEAM_ID") or env("VERCEL_TEAM_SLUG")
    if not (ROOT / ".vercel" / "project.json").exists():
        if not scope_value:
            return Step("Vercel deploy", "FAIL", "Set VERCEL_TEAM_SLUG or VERCEL_TEAM_ID before linking the project.")
        link = run_command(
            [
                vercel_bin,
                "link",
                "--yes",
                "--scope",
                scope_value,
                "--project",
                env("VERCEL_PROJECT_NAME", "fantasyiq-paid"),
                *token_args,
            ],
            "Vercel link",
        )
        if link.status != "PASS":
            return Step("Vercel deploy", link.status, link.detail)
    command = [vercel_bin, "--prod", "--yes"]
    command.extend(token_args)
    return run_command(command, "Vercel deploy")


def readiness_check(apply: bool) -> Step:
    if not apply:
        return Step("Live readiness check", "WARN", "Skipped until after deploy. Re-run with --readiness.")
    return run_command([PYTHON, "scripts/check_product_readiness.py"], "Live readiness check", allow_fail=True)


def print_steps(steps: list[Step]) -> None:
    for step in steps:
        detail = step.detail.replace("\n", "\n      ")
        print(f"{step.status:4} {step.name}: {detail}")
    failures = [step for step in steps if step.status == "FAIL"]
    warnings = [step for step in steps if step.status == "WARN"]
    print()
    print(f"Summary: {len(failures)} failed, {len(warnings)} warning(s), {len(steps)} steps total.")


def main() -> int:
    parser = argparse.ArgumentParser(description="Run FantasyIQ secure launch setup steps.")
    parser.add_argument("--apply-stripe", action="store_true", help="Configure Stripe Payment Link when STRIPE_SECRET_KEY is set.")
    parser.add_argument("--apply-vercel-env", action="store_true", help="Write Vercel env vars when VERCEL_TOKEN is set.")
    parser.add_argument("--deploy", action="store_true", help="Deploy with Vercel CLI when available.")
    parser.add_argument("--readiness", action="store_true", help="Run live readiness checks after deploy.")
    parser.add_argument("--all", action="store_true", help="Apply Stripe, Vercel env, deploy, and readiness steps.")
    args = parser.parse_args()

    load_local_env()
    apply_stripe = args.apply_stripe or args.all
    apply_vercel_env = args.apply_vercel_env or args.all
    deploy = args.deploy or args.all
    readiness = args.readiness or args.all

    steps = [
        compile_python(),
        security_check(),
        local_content_check(),
        node_build(),
        stripe_payment_link_setup(apply_stripe),
        stripe_webhook_setup(apply_stripe),
        vercel_env_setup(apply_vercel_env),
        vercel_deploy(deploy),
        readiness_check(readiness),
    ]
    print_steps(steps)
    return 1 if any(step.status == "FAIL" for step in steps) else 0


if __name__ == "__main__":
    sys.exit(main())
