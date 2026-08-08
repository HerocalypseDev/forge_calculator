"""M5/M6 smoke test: build the real GUI and drive it.

Instantiates the actual Tk root + MainWindow on Windows, then:
1. Drives the Calculator tab to the Golden-1 config through its StringVars
   (the same path a user typing would hit) and asserts the result labels.
2. Verifies live recompute fires when an input changes.
3. Switches to each browse tab and asserts its tree rendered the expected
   number of rows.
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

# tab title -> expected number of rows in its primary Treeview/Listbox
BROWSE_EXPECTED = {
    "Ores": 140,
    "Races": 16,
    "Weapons": 79,
    "Achievements": 16,
    "Runes": 47,
}


def _notebook(root: tk.Tk) -> ttk.Notebook:
    for child in root.winfo_children():
        for nb in child.winfo_children():
            if isinstance(nb, ttk.Notebook):
                return nb
    raise RuntimeError("Notebook not found")


def main():
    failures = []
    root = build_app()
    root.update_idletasks()
    nb = _notebook(root)
    tab = nb.nametowidget(nb.tabs()[0])  # Calculator is tab index 0
    assert isinstance(tab, CalculatorTab)

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

    for key, prefix in [
        ("avg_power", "7.94"),
        ("unforged_damage", "142.92"),
        ("forged_damage", "142.92"),
        ("total_dps", "180.91"),
        ("ttk_25k", "138.19"),
    ]:
        got = label(key)
        if not got.startswith(prefix):
            failures.append(f"calculator {key}: expected ~{prefix}, got {got!r}")

    # live-recompute check: bump quality, the totals must move through the same
    # change-trace path a user typing would hit.
    before = label("total_dps")
    tab.quality_var.set("200")
    root.update_idletasks()
    after = label("total_dps")
    if not after or after == before:
        failures.append(f"live recompute: total_dps stayed {before!r} after quality 100->200")

    # --- browse tabs render with expected row counts ---
    for title, expected in BROWSE_EXPECTED.items():
        for i in range(nb.index("end")):
            if nb.tab(i, "text") == title:
                nb.select(i)
                root.update_idletasks()
                break
        else:
            failures.append(f"browse tab {title!r} not found")
            continue
        widget = nb.nametowidget(nb.select())
        # each browse tab exposes its primary list as .tree (Treeview) or
        # .traits_list (Races Listbox)
        tree = getattr(widget, "tree", None) or getattr(widget, "traits_list", None)
        got = len(tree.get_children()) if hasattr(tree, "get_children") else tree.size()
        if got != expected:
            failures.append(f"{title}: expected {expected} rows, got {got}")
        if title == "Ores":
            names = [tree.item(i, "values")[0] for i in tree.get_children()]
            if names != sorted(names, key=str.lower):
                failures.append("Ores list is not alphabetically sorted")

    root.destroy()
    if failures:
        raise SystemExit("SMOKE FAILED:\n  " + "\n  ".join(failures))
    print("SMOKE OK: Golden-1 labels, live recompute, and all 6 tabs render correctly")


if __name__ == "__main__":
    main()
