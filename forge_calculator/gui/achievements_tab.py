"""Browse-only Achievements tab: the 16-option bonus selector.

The source workbook has no achievement tracking or triggers -- C80 is a plain
data-validation list -- so this tab just documents the options.  The calculator
reproduces the same selector; "Damage Boost" feeds lethality (E44 quirk).
"""

from __future__ import annotations

import tkinter as tk
from tkinter import ttk

from ..data import GameData
from .widgets import pct_fmt, refill, sorted_display

__all__ = ["AchievementsTab"]


class AchievementsTab(ttk.Frame):
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

        frame = ttk.LabelFrame(self, text=f"Achievement bonuses ({len(self.game.achievements)})")
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
            return self.game.achievements
        return [a for a in self.game.achievements if needle in a.name.lower()]

    def _refill(self):
        rows = [(a.name, a.stat or "", pct_fmt(a.value))
                for a in sorted_display(self._filtered(), first=(self.game.none_label,))]
        refill(self.tree, rows)

    def _on_filter(self, *_args):
        self._refill()

    @property
    def filter_vars(self):
        return {"name": self.filter_var}
