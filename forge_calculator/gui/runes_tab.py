"""Browse-only Runes tab: the 47-rune trait pool.

Read-only.  Shows each rune's parsed stat and value (the same parse the
calculator's rune-total math consumes).  Rows map directly to the engine's
``rune_totals`` substring matching.
"""

from __future__ import annotations

import tkinter as tk
from tkinter import ttk

from ..data import GameData
from .widgets import pct_fmt, refill, sorted_display

__all__ = ["RunesTab"]


class RunesTab(ttk.Frame):
    def __init__(self, master, game: GameData):
        super().__init__(master)
        self.game = game

        self.filter_var = tk.StringVar(master=master, value="")
        self.filter_var.trace_add("write", self._on_filter)

        top = ttk.Frame(self)
        top.pack(fill="x", padx=8, pady=(8, 4))
        ttk.Label(top, text="Filter:").pack(side="left")
        self.filter_entry = ttk.Entry(top, textvariable=self.filter_var, width=30)
        self.filter_entry.pack(side="left", padx=4)
        self.filter_entry.bind("<Escape>", lambda _e: self.filter_var.set(""))

        frame = ttk.LabelFrame(self, text=f"Rune trait pool ({len(self.game.runes)})")
        frame.pack(fill="both", expand=True, padx=8, pady=8)
        self.tree = ttk.Treeview(frame, columns=("name", "stat", "value"),
                                 show="headings", height=20)
        for col, head, width in [("name", "Name", 260), ("stat", "Stat", 120),
                                 ("value", "Value", 80)]:
            self.tree.heading(col, text=head)
            self.tree.column(col, width=width, anchor="w")
        scroll = ttk.Scrollbar(frame, orient="vertical", command=self.tree.yview)
        self.tree.configure(yscrollcommand=scroll.set)
        self.tree.pack(side="left", fill="both", expand=True, padx=(4, 0), pady=4)
        scroll.pack(side="right", fill="y", pady=4)

        self._refill()

    def _filtered(self):
        needle = self.filter_var.get().strip().lower()
        if not needle:
            return self.game.runes
        return [r for r in self.game.runes if needle in r.name.lower()]

    def _refill(self):
        rows = [(r.name, r.stat or "", pct_fmt(r.value)) for r in sorted_display(self._filtered())]
        refill(self.tree, rows)

    def _on_filter(self, *_args):
        self._refill()

    @property
    def filter_vars(self):
        return {"name": self.filter_var}
