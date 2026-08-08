"""Main application window: a ``ttk.Notebook`` of tabs."""

from __future__ import annotations

import tkinter as tk
from tkinter import ttk

from ..data import GameData
from .calculator_tab import CalculatorTab

__all__ = ["MainWindow"]

_TABS = ("Calculator", "Ores", "Races", "Weapons", "Achievements", "Runes")


class MainWindow(ttk.Frame):
    """Hosts every tab.  Only the Calculator tab exists so far; the browse
    tabs (Ores/Races/Weapons/Achievements/Runes) land in M6."""

    def __init__(self, master, game: GameData):
        super().__init__(master)
        self.game = game

        self.notebook = ttk.Notebook(self)
        self.notebook.pack(fill="both", expand=True)

        self._tabs: dict[str, ttk.Frame] = {}
        self._add_tab("Calculator", CalculatorTab(self.notebook, game))

    def _add_tab(self, title: str, widget: ttk.Frame) -> None:
        widget.pack(fill="both", expand=True)
        self.notebook.add(widget, text=title)
        self._tabs[title] = widget

    @property
    def tab_titles(self) -> tuple[str, ...]:
        return tuple(self._tabs)
