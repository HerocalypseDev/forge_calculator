"""Browse-only Runes tab: the 47-rune trait pool.

Read-only.  Shows each rune's parsed stat and value (the same parse the
calculator's rune-total math consumes).  Rows map directly to the engine's
``rune_totals`` substring matching.
"""

from __future__ import annotations

from tkinter import ttk

from ..data import GameData
from .widgets import pct_fmt, refill

__all__ = ["RunesTab"]


class RunesTab(ttk.Frame):
    def __init__(self, master, game: GameData):
        super().__init__(master)
        self.game = game

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

        rows = [(r.name, r.stat or "", pct_fmt(r.value)) for r in self.game.runes]
        refill(self.tree, rows)
