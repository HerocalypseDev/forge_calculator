"""Browse-only Races tab: race list plus per-race available trait options.

Read-only. Selecting a race shows its default trait and the full set of
traits available from the source ``_Options!E2:U17`` matrix.
"""

from __future__ import annotations

import tkinter as tk
from tkinter import ttk

from ..data import GameData, Race
from .widgets import add_tree_scrollbars, refill, sorted_display

__all__ = ["RacesTab"]


class RacesTab(ttk.Frame):
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
        add_tree_scrollbars(tree_frame, self.tree)
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
        needle = self.filter_var.get().strip().lower()
        races = self.game.races if not needle else [r for r in self.game.races if needle in r.name.lower()]
        rows = [(r.name, r.default_trait or "") for r in sorted_display(races)]
        refill(self.tree, rows)

    def _on_filter(self, *_args):
        self._refill()

    @property
    def filter_vars(self):
        return {"name": self.filter_var}

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
