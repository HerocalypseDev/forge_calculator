"""M5/M6 smoke test: build the real GUI and drive it.

Instantiates the actual Tk root + MainWindow on Windows, then:
1. Drives the Calculator tab to the Golden-1 config through its StringVars
   (the same path a user typing would hit) and asserts the result labels.
2. Verifies live recompute fires when an input changes.
3. Switches to each browse tab and asserts its tree rendered the expected
   number of rows.
The root is destroyed at the end; nothing is left behind.
"""

import os
import sys
import tempfile
import tkinter as tk
from pathlib import Path
from tkinter import ttk

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from forge_calculator import settings
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
    # isolated config dir so this never reads or clobbers the real user state
    os.environ.setdefault("FORGE_CALCULATOR_CONFIG", tempfile.mkdtemp(prefix="forge_smoke_"))
    root = build_app()
    root.update_idletasks()

    # Help menu with the About dialog (credits the original workbook) is attached
    menubar = root.nametowidget(root.cget("menu"))
    if not menubar or menubar.entrycget(0, "label") != "Help":
        failures.append("Help menu (About dialog) not attached to root")

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

    # --- SearchableCombo: type to filter, Enter to commit, recompute fires ---
    slot = tab.ore_combos[2]
    tab.amount_vars[2].set("10")
    slot.entry.delete(0, "end")
    slot.entry.insert(0, "gal")
    slot._open()
    shown = list(slot._list.get(0, "end"))
    if not shown or "Galaxite" not in shown:
        failures.append(f"search 'gal': expected Galaxite in first matches {shown[:5]!r}")
    slot._commit_highlighted()
    root.update_idletasks()
    if tab.ore_vars[2].get() != "Galaxite":
        failures.append("search commit: ore slot 3 var not set to Galaxite")
    moved = label("total_dps")
    if not moved or moved == after:
        failures.append(f"search commit: total_dps stayed {after!r} after adding Galaxite 10")
    slot.entry.delete(0, "end")
    slot.entry.insert(0, "zzz")
    slot._close(revert=True)
    if slot.entry.get() != "Galaxite":
        failures.append("search escape: entry did not revert to committed value")
    tab.ore_vars[2].set("Select Ore")
    tab.amount_vars[2].set("0")
    root.update_idletasks()

    # --- state persistence round-trip (isolated config dir) ---
    window = nb.master
    saved = window.capture_state()
    if saved["calculator"].get("weapon") != "Demonic Spear":
        failures.append("capture_state: weapon not Demonic Spear")
    window.restore_state({"calculator": {"weapon": "Demonic Spear", "quality": "999", "forge": "9"},
                          "tab": 0})
    root.update_idletasks()
    if tab.quality_var.get() != "999":
        failures.append("state restore: quality '999' not applied")
    if tab.forge_var.get() != "9":
        failures.append("state restore: forge '9' not applied")
    window.restore_state(saved)
    root.update_idletasks()
    window.save_now()
    persisted = settings.load_state()
    if persisted.get("calculator", {}).get("quality") != "200":
        failures.append("state persist: quality not saved "
                        f"({persisted.get('calculator', {}).get('quality')!r})")
    if persisted.get("tab") != 0:
        failures.append(f"state persist: tab not saved ({persisted.get('tab')!r})")

    # --- favorites: pin/unpin moves items to the top of the list ---
    tab._pinned_ores.clear()
    tab._pinned_weapons.clear()
    tab.ore_vars[0].set("Aetherit")
    tab._toggle_ore_pin(0)
    root.update_idletasks()
    ore_values = list(tab.ore_combos[0]._choices)
    if not ore_values or ore_values[0] != "Select Ore" or "Aetherit" not in ore_values[:3]:
        failures.append(f"pin: Aetherit not near top of ore values {ore_values[:5]!r}")
    tab._toggle_weapon_pin()
    root.update_idletasks()
    weapon_values = list(tab.weapon_combo._choices)
    if not weapon_values or weapon_values[0] != "Demonic Spear":
        failures.append(f"pin: Demonic Spear not at top of weapon values {weapon_values[:3]!r}")
    if "Aetherit" not in tab._pinned_ores or "Demonic Spear" not in tab._pinned_weapons:
        failures.append("pin: pinned sets not updated")
    tab._toggle_ore_pin(0)
    tab._toggle_weapon_pin()
    root.update_idletasks()
    if "Aetherit" in tab._pinned_ores or "Demonic Spear" in tab._pinned_weapons:
        failures.append("pin: unpin did not remove from pinned sets")

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
            widget.filter_var.set("zzz")
            root.update_idletasks()
            if len(widget.tree.get_children()) != 0:
                failures.append("Ores filter 'zzz': expected 0 rows")
            widget.filter_entry.focus_force()
            root.update()
            widget.filter_entry.event_generate("<Escape>")
            root.update_idletasks()
            if widget.filter_var.get() != "":
                failures.append("Escape did not clear the Ores filter")
            if len(widget.tree.get_children()) != 140:
                failures.append("Ores list not restored after Escape")

    root.destroy()
    if failures:
        raise SystemExit("SMOKE FAILED:\n  " + "\n  ".join(failures))
    print("SMOKE OK: Golden-1 labels, live recompute, searchable combos, filters, and all 6 tabs")


if __name__ == "__main__":
    main()
