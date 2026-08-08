"""Browse-only Races tab: race list plus per-race available trait options.

Read-only. Selecting a race shows its default trait and the full set of
traits available from the source ``_Options!E2:U17`` matrix.
"""

from __future__ import annotations

import tkinter as tk
from tkinter import ttk

from ..data import GameData, Race
from .widgets import refill

__all__ = ["RacesTab"]


class RacesTab(ttk.Frame):
    def __init__(self, master, game: GameData):
        super().__init__(master)
        self.game = game

        panes = ttk.Frame(self)
        panes.pack(fill="both", expand=True, padx=8, pady=8)
        panes.columnconfigure(0, weight=1)
        panes.columnconfigure(1, weight=1)
        panes.rowconfigure(0, weight=1)

        tree_frame = ttk.LabelFrame(panes, text=f"Races ({len(self.game.races)})")
        tree_frame.grid(row=0, column=0, sticky="nsew", padx=(0, 4))
        self.tree = ttk.Treeview(tree_frame, columns=("name", "default"),
                                 show="headings", height=20)
        for col, head, width in [("name", "Race", 160), ("default", "Default Trait", 260)]:
            self.tree.heading(col, text=head)
            self.tree.column(col, width=width, anchor="w")
        scroll = ttk.Scrollbar(tree_frame, orient="vertical", command=self.tree.yview)
        self.tree.configure(yscrollcommand=scroll.set)
        self.tree.pack(side="left", fill="both", expand=True, padx=(4, 0), pady=4)
        scroll.pack(side="right", fill="y", pady=4)
        self.tree.bind("<<TreeviewSelect>>", self._on_select)

        avail = ttk.LabelFrame(panes, text="Available traits")
        avail.grid(row=0, column=1, sticky="nsew", padx=(4, 0))
        self.traits_list = tk.Listbox(avail, height=20)
        tscroll = ttk.Scrollbar(avail, orient="vertical", command=self.traits_list.yview)
        self.traits_list.configure(yscrollcommand=tscroll.set)
        self.traits_list.pack(side="left", fill="both", expand=True, padx=(4, 0), pady=4)
        tscroll.pack(side="right", fill="y", pady=4)

        self._refill()

    def _refill(self):
        rows = [(r.name, r.default_trait or "") for r in self.game.races]
        refill(self.tree, rows)

    def _on_select(self, _event=None):
        sel = self.tree.selection()
        self.traits_list.delete(0, "end")
        if not sel:
            return
        race: Race | None = self.game.race(self.tree.item(sel[0], "values")[0])
        if race is None:
            return
        for trait in race.available_traits:
            self.traits_list.insert("end", trait)
