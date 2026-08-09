"""CLI: regenerate the committed ``data/*.json`` from the source workbook.

Usage:
    python -m scripts.build_data [path/to/workbook.xlsx]

Without an argument, the workbook is located next to the project root by the
canonical name.
"""

from __future__ import annotations

import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from build_data.extract import extract  # noqa: E402

DEFAULT_XLSX = PROJECT_ROOT / "reference" / "Copy of LittleTimmy's Calculator MAIN COPY (UP TO DATE) (1).xlsx"


def main(argv=None):
    argv = argv if argv is not None else sys.argv[1:]
    xlsx = Path(argv[0]) if argv else DEFAULT_XLSX
    if not xlsx.exists():
        print(f"ERROR: workbook not found: {xlsx}", file=sys.stderr)
        return 1
    result = extract(xlsx, PROJECT_ROOT / "data")
    print(f"wrote data/*.json from {xlsx.name}")
    print("counts:", result["counts"])
    print("weapon types (C12):", result["types"])
    print("race-bonus types (C23):", result["race_bonus_types"])
    if result["formula_only_ores"]:
        print("formula-only ores (not in catalog):", result["formula_only_ores"])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
