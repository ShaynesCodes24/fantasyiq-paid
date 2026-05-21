from __future__ import annotations

import sys
from dataclasses import dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


@dataclass
class Result:
    name: str
    status: str
    detail: str


REQUIRED_DOCS = {
    "ops/FANTASYIQ_OS.md": [
        "North Star",
        "Plugin Roles",
        "Definition Of Done",
        "Standard Commands",
    ],
    "ops/ROADMAP.md": [
        "Now",
        "Next",
        "Later",
        "Backlog Triage Rules",
    ],
    "ops/QA_PLAYBOOK.md": [
        "Required Automated Checks",
        "Manual Browser Checks",
        "Release Gate",
        "Production Smoke Test",
    ],
    "ops/PRODUCTION_MONITORING.md": [
        "Monitoring Cadence",
        "Required Checks",
        "Severity Rules",
        "Incident Workflow",
    ],
    "ops/DESIGN_SYSTEM.md": [
        "Product Feel",
        "Layout Rules",
        "Navigation Rules",
        "Quality Bar",
    ],
    "ops/SUPPORT_PLAYBOOK.md": [
        "Common Issues",
        "Q&A Topics To Keep Updated",
        "When To Escalate To Product Work",
    ],
    "ops/REVENUE_OPERATIONS.md": [
        "Current Offer",
        "Stripe Operations",
        "Database Fulfillment",
        "Add-On League Rules",
    ],
    "ops/UDK_PLUS_INTEGRATION.md": [
        "Guardrails",
        "Local Import",
        "What FantasyIQ Uses",
        "Product Behavior",
    ],
    "ops/PLUGIN_WORKFLOWS.md": [
        "Build And Release",
        "Payments And Customers",
        "Product Planning",
        "Standard Codex Flow",
    ],
    "DATABASE_SETUP.md": [
        "Recommended Database",
        "Self-Serve Flow",
        "Safe Rollout",
    ],
}


REQUIRED_SCRIPTS = [
    "scripts/check_product_readiness.py",
    "scripts/check_production_monitoring.py",
    "scripts/check_security_setup.py",
    "scripts/apply_database_schema.py",
    "scripts/check_os_readiness.py",
    "scripts/import_udk_csv.py",
    "scripts/check_udk_import.py",
]

REQUIRED_STANDARD_COMMANDS = [
    "scripts/check_product_readiness.py",
    "scripts/check_production_monitoring.py",
    "scripts/check_security_setup.py",
    "scripts/check_os_readiness.py",
    "scripts/check_udk_import.py",
]


def read_text(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8", errors="replace")


def check_doc(path: str, required_sections: list[str]) -> Result:
    full_path = ROOT / path
    if not full_path.exists():
        return Result(path, "FAIL", "Missing required operating doc.")
    text = read_text(path)
    missing = [section for section in required_sections if section not in text]
    if missing:
        return Result(path, "FAIL", f"Missing sections: {', '.join(missing)}")
    return Result(path, "PASS", "Required sections present.")


def check_script(path: str) -> Result:
    full_path = ROOT / path
    if not full_path.exists():
        return Result(path, "FAIL", "Missing required operating script.")
    return Result(path, "PASS", "Script present.")


def check_readme_links() -> Result:
    text = read_text("README.md").replace("\\", "/")
    missing = [path for path in REQUIRED_DOCS if path.startswith("ops/") and path not in text]
    missing += [path for path in REQUIRED_SCRIPTS if path not in text]
    if missing:
        return Result("README operating links", "FAIL", f"README missing: {', '.join(missing)}")
    return Result("README operating links", "PASS", "README links the OS docs and scripts.")


def check_standard_commands() -> Result:
    text = read_text("ops/FANTASYIQ_OS.md").replace("\\", "/")
    missing = [path for path in REQUIRED_STANDARD_COMMANDS if path not in text]
    if missing:
        return Result("OS standard commands", "FAIL", f"OS command list missing: {', '.join(missing)}")
    return Result("OS standard commands", "PASS", "Core checks are listed in the OS.")


def main() -> int:
    results: list[Result] = []
    for path, sections in REQUIRED_DOCS.items():
        results.append(check_doc(path, sections))
    for path in REQUIRED_SCRIPTS:
        results.append(check_script(path))
    results.append(check_readme_links())
    results.append(check_standard_commands())

    for result in results:
        print(f"{result.status:4} {result.name}: {result.detail}")

    failures = [result for result in results if result.status == "FAIL"]
    print()
    print(f"Summary: {len(failures)} failed, {len(results)} checks total.")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
