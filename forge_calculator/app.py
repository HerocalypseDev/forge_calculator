"""Application entry point: builds the ``tk.Tk`` root and main window."""

from __future__ import annotations

import tkinter as tk

from . import __version__
from .data import GameData, load_game_data
from .gui.main_window import MainWindow

__all__ = ["build_app", "APP_TITLE"]

APP_TITLE = "Forge Calculator"


def build_app(data_dir=None) -> tk.Tk:
    """Create the root window with the main notebook loaded from ``data_dir``.

    ``data_dir`` defaults to the committed ``data/`` directory shipped with
    the package, so the app runs with no external dependencies.
    """
    game: GameData = load_game_data(data_dir)
    root = tk.Tk()
    root.title(f"{APP_TITLE} v{__version__}")
    root.minsize(900, 620)
    MainWindow(root, game).pack(fill="both", expand=True)
    return root


def main() -> None:
    root = build_app()
    root.mainloop()


if __name__ == "__main__":
    main()
