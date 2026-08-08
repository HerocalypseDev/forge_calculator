"""Browse-only Ores tab: filterable list plus a per-ore stat matrix.

Read-only by design (no CRUD). Selecting an ore shows its equipment,
multiplier, comments, and every share-scaling stat (10% vs 30% share) that
the engine actually uses -- all derived from the workbook formulas, never
hand-typed.
"""

from __future__ import annotations

import tkinter as tk
from tkinter import ttk

from ..data import GameData, Ore
from .widgets import STAT_LABELS, refill, sorted_display

__all__ = ["OresTab"]

_COLUMNS = ("name", "equipment", "multiplier", "trait10", "trait30")
_HEADINGS = {"name": "Ore", "equipment": "Equipment", "multiplier": "Multiplier",
             "trait10": "Trait @10%", "trait30": "Trait @30%"}


class OresTab(ttk.Frame):
    def __init__(self, master, game: GameData):
        super().__init__(master)
        self.game = game

        self.filter_var = tk.StringVar(master=master, value="")
        self.filter_var.trace_add("write", self._on_filter)

        top = ttk.Frame(self)
        top.pack(fill="x", padx=8, pady=(8, 4))
        ttk.Label(top, text="Filter:").pack(side="left")
        ttk.Entry(top, textvariable=self.filter_var, width=30).pack(side="left", padx=4)

        panes = ttk.Frame(self)
        panes.pack(fill="both", expand=True, padx=8, pady=4)
        panes.columnconfigure(0, weight=3)
        panes.columnconfigure(1, weight=2)
        panes.rowconfigure(0, weight=1)

        self._build_tree(panes)
        self._build_detail(panes)

        self._refill()

    def _build_tree(self, parent):
        frame = ttk.LabelFrame(parent, text=f"Ores ({len(self.game.ores)})")
        frame.grid(row=0, column=0, sticky="nsew", padx=(0, 4), pady=4)
        self.tree = ttk.Treeview(frame, columns=_COLUMNS, show="headings", height=20)
        for col in _COLUMNS:
            self.tree.heading(col, text=_HEADINGS[col])
            self.tree.column(col, width=100, anchor="w")
        self.tree.column("name", width=160)
        self.tree.column("multiplier", width=80, anchor="e")
        self.tree.column("trait30", width=240)
        scroll = ttk.Scrollbar(frame, orient="vertical", command=self.tree.yview)
        self.tree.configure(yscrollcommand=scroll.set)
        self.tree.pack(side="left", fill="both", expand=True, padx=(4, 0), pady=4)
        scroll.pack(side="right", fill="y", pady=4)
        self.tree.bind("<<TreeviewSelect>>", self._on_select)

    def _build_detail(self, parent):
        self.detail = ttk.LabelFrame(parent, text="Ore details")
        self.detail.grid(row=0, column=1, sticky="nsew", padx=(4, 0), pady=4)

        self.detail_meta = tk.StringVar(master=parent, value="Select an ore.")
        ttk.Label(self.detail, textvariable=self.detail_meta, wraplength=280,
                  justify="left").pack(fill="x", padx=8, pady=(6, 2))
        self.detail_comments = tk.StringVar(master=parent, value="")
        ttk.Label(self.detail, textvariable=self.detail_comments, wraplength=280,
                  justify="left", foreground="#666666").pack(fill="x", padx=8, pady=2)

        ttk.Label(self.detail, text="Stats (at 10% / 30% ore share)").pack(
            anchor="w", padx=8, pady=(6, 0))
        stat_frame = ttk.Frame(self.detail)
        stat_frame.pack(fill="both", expand=True, padx=8, pady=4)
        self.stat_tree = ttk.Treeview(stat_frame, columns=("stat", "base", "max", "unit"),
                                      show="headings", height=10)
        for col, head, width in [("stat", "Stat", 150), ("base", "At 10%", 60),
                                 ("max", "At 30%", 60), ("unit", "Unit", 40)]:
            self.stat_tree.heading(col, text=head)
            self.stat_tree.column(col, width=width, anchor="w")
            self.stat_tree.column("base", anchor="e")
            self.stat_tree.column("max", anchor="e")
        sscroll = ttk.Scrollbar(stat_frame, orient="vertical", command=self.stat_tree.yview)
        self.stat_tree.configure(yscrollcommand=sscroll.set)
        self.stat_tree.pack(side="left", fill="both", expand=True)
        sscroll.pack(side="right", fill="y")

    def _refill(self):
        needle = self.filter_var.get().strip().lower()
        ores = self.game.ores if not needle else [o for o in self.game.ores if needle in o.name.lower()]
        rows = [(o.name, o.equipment or "", o.multiplier, o.trait10 or "", o.trait30 or "")
                for o in sorted_display(ores)]
        refill(self.tree, rows)

    def _on_filter(self, *_args):
        self._refill()

    def _on_select(self, _event=None):
        sel = self.tree.selection()
        if not sel:
            return
        ore: Ore = self.game.ore(self.tree.item(sel[0], "values")[0])
        if ore is None:
            return
        self.detail_meta.set(
            f"{ore.name}\nEquipment: {ore.equipment or '-'}\n"
            f"Multiplier: {ore.multiplier}\n"
            f"Trait @10%: {ore.trait10 or '-'}\n"
            f"Trait @30%: {ore.trait30 or '-'}")
        self.detail_comments.set(ore.comments or "")
        rows = []
        for key, r in ore.stats.items():
            label = STAT_LABELS.get(key, key)
            unit = "%" if r.divisor == 100 else "s"
            rows.append((label, f"{r.base:g}", f"{r.max:g}", unit))
        if not rows:
            rows = [("(no stats)", "", "", "")]
        refill(self.stat_tree, rows)
