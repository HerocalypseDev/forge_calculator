"""Application entry point: builds the ``tk.Tk`` root and main window."""

from __future__ import annotations

import tkinter as tk
from tkinter import messagebox
from tkinter import ttk

from . import __version__
from .data import GameData, load_game_data
from .gui.main_window import MainWindow
from .settings import load_state

__all__ = ["build_app", "APP_TITLE"]

APP_TITLE = "Forge Calculator"
SOURCE_URL = "https://docs.google.com/spreadsheets/d/1sScoEz6bGmu1ZmwzDhgpM1V2kC5YcKgDNWdBPhLryq0/edit?usp=drivesdk"


def _apply_dark_theme(root: tk.Tk) -> None:
    """Apply a dark color theme to ttk widgets."""
    style = ttk.Style(root)
    # Use 'clam' theme as base - it allows color customization
    style.theme_use("clam")

    # Dark color palette
    bg_dark = "#1e1e1e"
    bg_medium = "#2d2d2d"
    bg_light = "#3c3c3c"
    fg_light = "#e0e0e0"
    fg_muted = "#a0a0a0"
    accent = "#0078d4"
    accent_hover = "#106ebe"
    border = "#444444"
    entry_bg = "#252526"
    entry_fg = "#e0e0e0"
    select_bg = "#004a9"
    select_fg = "#ffffff"
    disabled_fg = "#666666"
    red_highlight = "#cc0000"

    # Root window background
    root.configure(background=bg_dark)

    # Configure ttk styles
    style.configure(".",
                    background=bg_dark,
                    foreground=fg_light,
                    fieldbackground=entry_bg,
                    selectbackground=select_bg,
                    selectforeground=select_fg,
                    bordercolor=border,
                    lightcolor=bg_light,
                    darkcolor=bg_medium)

    # Frames and Labels
    style.configure("TFrame", background=bg_dark)
    style.configure("TLabel", background=bg_dark, foreground=fg_light)
    style.configure("TLabelframe", background=bg_dark, foreground=fg_light, bordercolor=border)
    style.configure("TLabelframe.Label", background=bg_dark, foreground=fg_light)

    # Buttons
    style.configure("TButton",
                    background=bg_medium,
                    foreground=fg_light,
                    bordercolor=border,
                    focuscolor=accent,
                    padding=(8, 4))
    style.map("TButton",
              background=[("active", bg_light), ("pressed", accent), ("disabled", bg_dark)],
              foreground=[("disabled", disabled_fg)])

    # Entries
    style.configure("TEntry",
                    fieldbackground=entry_bg,
                    foreground=entry_fg,
                    bordercolor=border,
                    insertcolor=fg_light,
                    padding=(4, 2))
    style.map("TEntry",
              fieldbackground=[("readonly", entry_bg), ("disabled", bg_medium)],
              foreground=[("disabled", disabled_fg)])

    # Combobox
    style.configure("TCombobox",
                    fieldbackground=entry_bg,
                    foreground=entry_fg,
                    background=bg_medium,
                    bordercolor=border,
                    arrowcolor=fg_light,
                    padding=(4, 2))
    style.map("TCombobox",
              fieldbackground=[("readonly", entry_bg), ("disabled", bg_medium)],
              foreground=[("disabled", disabled_fg)],
              background=[("readonly", bg_medium), ("disabled", bg_dark)])

    # Spinbox
    style.configure("TSpinbox",
                    fieldbackground=entry_bg,
                    foreground=entry_fg,
                    background=bg_medium,
                    bordercolor=border,
                    arrowcolor=fg_light,
                    padding=(4, 2))
    style.map("TSpinbox",
              fieldbackground=[("readonly", entry_bg), ("disabled", bg_medium)],
              foreground=[("disabled", disabled_fg)])

    # Notebook (tabs)
    style.configure("TNotebook", background=bg_dark, bordercolor=border, tabmargins=(2, 4, 2, 0))
    style.configure("TNotebook.Tab",
                    background=bg_medium,
                    foreground=fg_muted,
                    bordercolor=border,
                    padding=(12, 6),
                    focuscolor=accent)
    style.map("TNotebook.Tab",
              background=[("selected", bg_dark), ("active", bg_light)],
              foreground=[("selected", fg_light), ("active", fg_light)],
              bordercolor=[("selected", accent)])

    # Scrollbar
    style.configure("Vertical.TScrollbar",
                    background=bg_medium,
                    troughcolor=bg_dark,
                    bordercolor=border,
                    arrowcolor=fg_light,
                    gripcount=0)
    style.configure("Horizontal.TScrollbar",
                    background=bg_medium,
                    troughcolor=bg_dark,
                    bordercolor=border,
                    arrowcolor=fg_light,
                    gripcount=0)
    style.map("Vertical.TScrollbar",
              background=[("active", bg_light), ("pressed", accent)])
    style.map("Horizontal.TScrollbar",
              background=[("active", bg_light), ("pressed", accent)])

    # Separator
    style.configure("TSeparator", background=border)

    # Progressbar
    style.configure("TProgressbar", background=accent, troughcolor=bg_medium, bordercolor=border)

    # Treeview (for browse tabs)
    style.configure("Treeview",
                    background=entry_bg,
                    foreground=entry_fg,
                    fieldbackground=entry_bg,
                    bordercolor=border,
                    rowheight=24)
    style.configure("Treeview.Heading",
                    background=bg_medium,
                    foreground=fg_light,
                    bordercolor=border,
                    relief="flat")
    style.map("Treeview",
              background=[("selected", select_bg)],
              foreground=[("selected", select_fg)])
    style.map("Treeview.Heading",
              background=[("active", bg_light), ("pressed", accent)])


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
    menubar.configure(bg="#2d2d2d", fg="#e0e0e0", activebackground="#004a99", activeforeground="#ffffff",
                       borderwidth=0, relief="flat")
    help_menu = tk.Menu(menubar, tearoff=False)
    help_menu.configure(bg="#2d2d2d", fg="#e0e0e0", activebackground="#004a99", activeforeground="#ffffff",
                         borderwidth=0, relief="flat")
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
    _apply_dark_theme(root)
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
