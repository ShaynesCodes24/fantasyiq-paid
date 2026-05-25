import importlib.util
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
API_DIR = ROOT / "api"

for path in (ROOT, API_DIR):
    path_text = str(path)
    if path_text not in sys.path:
        sys.path.insert(0, path_text)


def import_module(path: Path) -> None:
    module_name = f"api_import_check_{path.stem}"
    spec = importlib.util.spec_from_file_location(module_name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Could not create import spec for {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)


def main() -> int:
    failures = []
    for path in sorted(API_DIR.glob("*.py")):
        if path.name == "__init__.py":
            continue
        try:
            import_module(path)
        except Exception as error:
            failures.append((path.relative_to(ROOT), error))

    if failures:
        print("API import check failed:")
        for path, error in failures:
            print(f"- {path}: {type(error).__name__}: {error}")
        return 1

    print(f"API import check passed for {len(list(API_DIR.glob('*.py'))) - 1} Python route/module files.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
