"""Main application window: a ``ttk.Notebook`` of tabs.

Owns the app's persistence: changes to the calculator or a browse filter
schedule a debounced save, and ``save_now()`` flushes the full state on close.
"""

from __future__ import annotations

from tkinter import ttk

from ..data import GameData
from ..settings import save_state
from .achievements_tab import AchievementsTab
from .calculator_tab import CalculatorTab
from .ores_tab import OresTab
from .races_tab import RacesTab
from .runes_tab import RunesTab
from .weapons_tab import WeaponsTab

__all__ = ["MainWindow"]

_SAVE_DELAY_MS = 600


class MainWindow(ttk.Frame):
    """Hosts every tab.  Calculator is the only interactive one; the browse
    tabs (Ores/Races/Weapons/Achievements/Runes) are read-only."""

    def __init__(self, master, game: GameData):
        super().__init__(master)
        self.game = game
        self._save_job = None

        self.notebook = ttk.Notebook(self)
        self.notebook.pack(fill="both", expand=True)

        self._tabs: dict[str, ttk.Frame] = {}
        self.calculator = CalculatorTab(self.notebook, game)
        self.calculator.on_change = self._on_calculator_change
        self._add_tab("Calculator", self.calculator)
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

    # --- persistence ---

    def capture_state(self) -> dict:
        state = {"calculator": self.calculator.get_state()}
        filters = {}
        for title, tab in self._tabs.items():
            if title == "Calculator":
                continue
            filter_vars = getattr(tab, "filter_vars", None)
            if filter_vars:
                filters[title] = {name: var.get() for name, var in filter_vars.items()}
        state["filters"] = filters
        state["tab"] = self.notebook.index(self.notebook.select())
        return state

    def restore_state(self, state: dict) -> None:
        state = state or {}
        self.calculator.set_state(state.get("calculator") or {})
        for title, values in (state.get("filters") or {}).items():
            tab = self._tabs.get(title)
            filter_vars = getattr(tab, "filter_vars", None)
            if not filter_vars or not isinstance(values, dict):
                continue
            for name, value in values.items():
                if name in filter_vars and isinstance(value, str):
                    filter_vars[name].set(value)
        idx = state.get("tab")
        if isinstance(idx, int) and 0 <= idx < len(self._tabs):
            self.notebook.select(idx)

    def _on_calculator_change(self):
        self._schedule_save()

    def _schedule_save(self, *_args):
        if self._save_job is not None:
            self.after_cancel(self._save_job)
        self._save_job = self.after(_SAVE_DELAY_MS, self._save_after_timeout)

    def _save_after_timeout(self):
        self._save_job = None
        save_state(self.capture_state())

    def save_now(self) -> None:
        if self._save_job is not None:
            try:
                self.after_cancel(self._save_job)
            except tk.TclError:
                pass
            self._save_job = None
        save_state(self.capture_state())
