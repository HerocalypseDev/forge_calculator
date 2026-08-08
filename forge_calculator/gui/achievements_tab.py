"""Browse-only Achievements tab: the 16-option bonus selector.

The source workbook has no achievement tracking or triggers -- C80 is a plain
data-validation list -- so this tab just documents the options.  The calculator
reproduces the same selector; "Damage Boost" feeds lethality (E44 quirk).
"""

from __future__ import annotations

from tkinter import ttk

from ..data import GameData
from .widgets import pct_fmt, refill, sorted_display

__all__ = ["AchievementsTab"]


class AchievementsTab(ttk.Frame):
    def __init__(self, master, game: GameData):
        super().__init__(master)
        self.game = game

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

        rows = [(a.name, a.stat or "", pct_fmt(a.value))
                for a in sorted_display(self.game.achievements, first=(self.game.none_label,))]
        refill(self.tree, rows)
