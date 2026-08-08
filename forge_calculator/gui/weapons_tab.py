"""Browse-only Weapons tab: all 79 weapons grouped/filtered by type.

Read-only. The type combo mirrors the Calculator tab's weapon-type selector
(10 workbook types); a "(All Types)" option shows everything.
"""

from __future__ import annotations

import tkinter as tk
from tkinter import ttk

from ..data import GameData
from .widgets import refill, sorted_display

__all__ = ["WeaponsTab"]

_WEAPON_ALL = "(All Types)"


class WeaponsTab(ttk.Frame):
    def __init__(self, master, game: GameData):
        super().__init__(master)
        self.game = game

        self.type_var = tk.StringVar(master=master, value=_WEAPON_ALL)
        self.type_var.trace_add("write", self._on_type)

        top = ttk.Frame(self)
        top.pack(fill="x", padx=8, pady=(8, 4))
        ttk.Label(top, text="Type:").pack(side="left")
        combo = ttk.Combobox(top, textvariable=self.type_var, state="readonly", width=24)
        combo["values"] = [_WEAPON_ALL] + sorted(self.game.weapon_types, key=str.lower)
        combo.pack(side="left", padx=4)

        frame = ttk.LabelFrame(self, text=f"Weapons ({len(self.game.weapons)})")
        frame.pack(fill="both", expand=True, padx=8, pady=4)
        self.tree = ttk.Treeview(frame, columns=("type", "name", "interval", "damage"),
                                 show="headings")
        for col, head, width, anchor in [
            ("type", "Type", 120, "w"), ("name", "Name", 200, "w"),
            ("interval", "Interval", 80, "e"), ("damage", "Damage", 80, "e")]:
            self.tree.heading(col, text=head)
            self.tree.column(col, width=width, anchor=anchor)
        scroll = ttk.Scrollbar(frame, orient="vertical", command=self.tree.yview)
        self.tree.configure(yscrollcommand=scroll.set)
        self.tree.pack(side="left", fill="both", expand=True, padx=(4, 0), pady=4)
        scroll.pack(side="right", fill="y", pady=4)

        self._refill()

    def _refill(self):
        wtype = self.type_var.get()
        weapons = self.game.weapons
        if wtype not in (None, "", _WEAPON_ALL):
            weapons = self.game.weapons_by_type(wtype)
        rows = [(w.type, w.name, f"{w.interval:g}", f"{w.damage:g}")
                for w in sorted_display(weapons)]
        refill(self.tree, rows)

    def _on_type(self, *_args):
        self._refill()
