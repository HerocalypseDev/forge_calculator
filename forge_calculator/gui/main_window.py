"""Main application window: a ``ttk.Notebook`` of tabs."""

from __future__ import annotations

from tkinter import ttk

from ..data import GameData
from .achievements_tab import AchievementsTab
from .calculator_tab import CalculatorTab
from .ores_tab import OresTab
from .races_tab import RacesTab
from .runes_tab import RunesTab
from .weapons_tab import WeaponsTab

__all__ = ["MainWindow"]


class MainWindow(ttk.Frame):
    """Hosts every tab.  Calculator is the only interactive one; the browse
    tabs (Ores/Races/Weapons/Achievements/Runes) are read-only."""

    def __init__(self, master, game: GameData):
        super().__init__(master)
        self.game = game

        self.notebook = ttk.Notebook(self)
        self.notebook.pack(fill="both", expand=True)

        self._tabs: dict[str, ttk.Frame] = {}
        self._add_tab("Calculator", CalculatorTab(self.notebook, game))
        self._add_tab("Ores", OresTab(self.notebook, game))
        self._add_tab("Races", RacesTab(self.notebook, game))
        self._add_tab("Weapons", WeaponsTab(self.notebook, game))
        self._add_tab("Achievements", AchievementsTab(self.notebook, game))
        self._add_tab("Runes", RunesTab(self.notebook, game))

    def _add_tab(self, title: str, widget: ttk.Frame) -> None:
        widget.pack(fill="both", expand=True)
        self.notebook.add(widget, text=title)
        self._tabs[title] = widget

    @property
    def tab_titles(self) -> tuple[str, ...]:
        return tuple(self._tabs)
