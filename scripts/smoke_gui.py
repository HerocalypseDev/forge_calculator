"""M5 smoke test: build the real GUI and drive it to Golden-1.

Instantiates the actual Tk root + MainWindow on Windows, sets the Golden-1
config through the CalculatorTab's StringVars (so recompute fires through the
same code path a user typing would hit), then asserts the result labels.
The root is destroyed at the end; nothing is left behind.
"""

import sys
import tkinter as tk
from pathlib import Path
from tkinter import ttk

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from forge_calculator.app import build_app
from forge_calculator.gui.calculator_tab import CalculatorTab

GOLDEN_1 = {
    "ores": [("Ancienite", "10"), ("Aetherit", "10"), None, None],
    "weapon": "Demonic Spear",
    "quality": "100",
    "forge": "0",
    "base_cd": "1.45",
}


def _tab(root: tk.Tk) -> CalculatorTab:
    for child in root.winfo_children():
        mw = child.winfo_children()
        for nb in mw:
            if isinstance(nb, ttk.Notebook):
                return nb.nametowidget(nb.tabs()[0])
    raise RuntimeError("Calculator tab not found")


def main():
    root = build_app()
    root.update_idletasks()
    tab = _tab(root)

    # --- set the Golden-1 config via the same vars the widgets are bound to ---
    for i, slot in enumerate(GOLDEN_1["ores"]):
        if slot is None:
            continue
        ore, amount = slot
        tab.ore_vars[i].set(ore)
        tab.amount_vars[i].set(amount)
    tab.weapon_var.set(GOLDEN_1["weapon"])
    tab.quality_var.set(GOLDEN_1["quality"])
    tab.forge_var.set(GOLDEN_1["forge"])
    tab.base_cd_var.set(GOLDEN_1["base_cd"])
    root.update_idletasks()  # flush the after_idle recompute

    def label(key):
        return tab.result_vars[key].get()

    checks = [
        ("avg_power", "7.94"),
        ("unforged_damage", "142.92"),
        ("forged_damage", "142.92"),
        ("total_dps", "180.91"),
        ("ttk_25k", "138.19"),
    ]
    failures = []
    for key, prefix in checks:
        got = label(key)
        if not got.startswith(prefix):
            failures.append(f"{key}: expected ~{prefix}, got {got!r}")

    # live-recompute check: bump quality, the totals must move through the same
    # change-trace path a user typing would hit (a weapon is always equipped,
    # so DPS stays nonzero -- we verify the recompute actually fired).
    before = label("total_dps")
    tab.quality_var.set("200")
    root.update_idletasks()
    after = label("total_dps")
    if not after or after == before:
        failures.append(f"live recompute: total_dps stayed {before!r} after quality 100->200")

    root.destroy()
    if failures:
        raise SystemExit("SMOKE FAILED:\n  " + "\n  ".join(failures))
    print("SMOKE OK: Golden-1 labels, live recompute, and teardown all pass")


if __name__ == "__main__":
    main()
