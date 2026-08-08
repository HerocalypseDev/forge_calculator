"""Application entry point: builds the ``tk.Tk`` root and main window."""

from __future__ import annotations

import tkinter as tk
from tkinter import messagebox

from . import __version__
from .data import GameData, load_game_data
from .gui.main_window import MainWindow
from .settings import load_state

__all__ = ["build_app", "APP_TITLE"]

APP_TITLE = "Forge Calculator"
SOURCE_URL = "https://docs.google.com/spreadsheets/d/1sScoEz6bGmu1ZmwzDhgpM1V2kC5YcKgDNWdBPhLryq0/edit?usp=drivesdk"


def _show_about(root: tk.Tk) -> None:
    messagebox.showinfo(
        "About",
        f"{APP_TITLE} v{__version__}\n\n"
        "A cell-for-cell port of Little Timmy's DPS Calculator.\n"
        "All formulas and data come from the original workbook:\n"
        f"{SOURCE_URL}",
        parent=root,
    )


def _add_menu(root: tk.Tk) -> None:
    menubar = tk.Menu(root, tearoff=False)
    help_menu = tk.Menu(menubar, tearoff=False)
    help_menu.add_command(label="About", command=lambda: _show_about(root))
    menubar.add_cascade(label="Help", menu=help_menu)
    root.config(menu=menubar)


def build_app(data_dir=None) -> tk.Tk:
    """Create the root window with the main notebook loaded from ``data_dir``.

    ``data_dir`` defaults to the committed ``data/`` directory shipped with
    the package, so the app runs with no external dependencies.
    """
    game: GameData = load_game_data(data_dir)
    root = tk.Tk()
    root.title(f"{APP_TITLE} v{__version__}")
    root.minsize(900, 620)
    window = MainWindow(root, game)
    window.pack(fill="both", expand=True)
    window.restore_state(load_state())
    _add_menu(root)
    root.protocol("WM_DELETE_WINDOW", lambda: _on_close(window, root))
    return root


def _on_close(window, root: tk.Tk) -> None:
    window.save_now()
    root.destroy()


def main() -> None:
    root = build_app()
    root.mainloop()


if __name__ == "__main__":
    main()
