"""Shared ttk helpers (no engine/data imports)."""

from __future__ import annotations

import tkinter as tk
from tkinter import ttk

__all__ = ["ScrollableFrame", "to_float", "fmt2", "fmt4", "fmt_pct"]


def to_float(text) -> float:
    """Parse an entry value; any invalid text resolves to 0.0.

    Mirrors how the workbook treats a non-numeric input cell: formulas that
    read it see 0 (Excel coerces empty/text to 0 in arithmetic).
    """
    try:
        return float(text)
    except (TypeError, ValueError):
        return 0.0


def fmt2(value) -> str:
    return "N/A" if value is None else f"{value:,.2f}"


def fmt4(value) -> str:
    return "N/A" if value is None else f"{value:,.4f}"


def fmt_pct(value) -> str:
    """Format a fraction as a percent (E44-E47 / proc cells), matching the
    workbook's ``0%`` number format."""
    return "N/A" if value is None else f"{value * 100:.1f}%"


class ScrollableFrame(ttk.Frame):
    """A frame whose content scrolls vertically when it overflows.

    The whole calculator tab uses a single instance so there is only one
    mouse-wheel binding.
    """

    def __init__(self, master, **kw):
        super().__init__(master, **kw)
        self.canvas = tk.Canvas(self, highlightthickness=0, borderwidth=0)
        vbar = ttk.Scrollbar(self, orient="vertical", command=self.canvas.yview)
        self.content = ttk.Frame(self.canvas)
        self.content.bind("<Configure>", self._on_content_configure)
        self.canvas.bind("<Configure>", self._on_canvas_configure)
        self.canvas.bind("<MouseWheel>", self._on_mousewheel)
        self.canvas.configure(yscrollcommand=vbar.set)
        self._window_id = self.canvas.create_window((0, 0), window=self.content, anchor="nw")
        self.canvas.pack(side="left", fill="both", expand=True)
        vbar.pack(side="right", fill="y")

    def _on_content_configure(self, _event):
        self.canvas.configure(scrollregion=self.canvas.bbox("all"))

    def _on_canvas_configure(self, event):
        self.canvas.itemconfigure(self._window_id, width=event.width)

    def _on_mousewheel(self, event):
        self.canvas.yview_scroll(int(-event.delta / 120), "units")
