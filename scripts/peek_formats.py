"""Print number formats of the percent input cells (dev-only)."""

import sys
from pathlib import Path

from openpyxl import load_workbook

PROJECT_ROOT = Path(__file__).resolve().parent.parent
XLSX = PROJECT_ROOT / "reference" / "Copy of Copy of LittleTimmy's Calculator MAIN COPY (UP TO DATE) (1).xlsx"

CELLS = ["C20", "C21", "C34", "C35", "C36", "D34", "D35", "D36", "E34", "E35",
         "C41", "C42", "C43", "A44", "C53", "E12", "C13"]


def main():
    wb = load_workbook(XLSX, data_only=True)
    dps = wb["DPS Calculator"]
    for c in CELLS:
        cell = dps[c]
        print(f"{c}: value={cell.value!r:>8}  format={cell.number_format!r}")


if __name__ == "__main__":
    sys.path.insert(0, str(PROJECT_ROOT))
    main()
