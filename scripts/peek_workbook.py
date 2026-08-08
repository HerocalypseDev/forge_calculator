"""Inspect the workbook's cached input/output cells (dev-only debug helper).

Used to pin the golden test numbers against the workbook's own cached results.
"""

import sys
from pathlib import Path

from openpyxl import load_workbook

PROJECT_ROOT = Path(__file__).resolve().parent.parent
XLSX = PROJECT_ROOT / "reference" / "Copy of Copy of LittleTimmy's Calculator MAIN COPY (UP TO DATE) (1).xlsx"

INPUTS = ["C6", "C7", "C8", "C9", "D6", "D7", "D8", "D9", "C12", "D12", "C13", "E12",
          "C20", "C21", "C22", "C23", "C41", "C42", "C43", "A44",
          "C34", "C35", "C36", "D34", "D35", "D36", "E34", "E35", "C53", "C80",
          "C27", "D27", "C28", "D28", "C29", "D29"]
RESULTS = ["E10", "A18", "C18", "C19", "E21", "E44", "E45", "E46", "E47",
           "C52", "C57", "C58", "C61", "C62", "C63", "C66", "C67", "C68",
           "C71", "C72", "C75", "C76", "C84", "C85", "C86", "C87", "C88",
           "C89", "C91", "C92", "C93", "C95", "C96", "E91", "E92"]


def main():
    wb = load_workbook(XLSX, data_only=True)
    dps = wb["DPS Calculator"]
    print("INPUTS")
    for c in INPUTS:
        print(f"  {c} = {dps[c].value!r}")
    print("RESULTS")
    for c in RESULTS:
        print(f"  {c} = {dps[c].value!r}")


if __name__ == "__main__":
    sys.path.insert(0, str(PROJECT_ROOT))
    main()
