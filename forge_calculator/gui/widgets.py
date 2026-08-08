"""Shared ttk helpers."""

from __future__ import annotations

import tkinter as tk
from tkinter import ttk

__all__ = ["ScrollableFrame", "SearchableCombo", "Tooltip", "to_float", "fmt2",
           "fmt4", "fmt_pct", "pct_fmt", "refill", "add_tree_scrollbars",
           "sorted_display", "STAT_LABELS"]


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


def pct_fmt(value) -> str:
    """Blank for None, else a compact percent (browse-tab Stat/Value columns)."""
    return "" if value is None else f"{value * 100:g}%"


def sorted_display(items, *, key="name", first=()):
    """Sort ``items`` by a case-insensitive attribute (default ``name``).

    Members whose attribute equals a value in ``first`` stay at the head in
    the order given -- used to pin sentinels like "None"/"Select Ore" on top
    of an otherwise alphabetical list.
    """
    first_set = set(first)
    head = [it for it in items if getattr(it, key) in first_set]
    tail = [it for it in items if getattr(it, key) not in first_set]
    return head + sorted(tail, key=lambda o: getattr(o, key).lower())


def refill(tree, rows):
    """Replace a Treeview's contents with ``rows`` (list of value tuples)."""
    tree.delete(*tree.get_children())
    for i, row in enumerate(rows):
        tree.insert("", "end", iid=str(i), values=row)


def add_tree_scrollbars(frame, tree):
    """Pack ``tree`` into ``frame`` with vertical and horizontal scrollbars."""
    vbar = ttk.Scrollbar(frame, orient="vertical", command=tree.yview)
    hbar = ttk.Scrollbar(frame, orient="horizontal", command=tree.xview)
    tree.configure(yscrollcommand=vbar.set, xscrollcommand=hbar.set)
    tree.pack(side="left", fill="both", expand=True, padx=(4, 0), pady=(4, 0))
    vbar.pack(side="right", fill="y", pady=(4, 0))
    hbar.pack(side="bottom", fill="x", padx=(4, 0), pady=(0, 4))


# Canonical ore-stat keys -> display labels (mirrors STAT_CELLS in the
# formula parser; shown in the Ores tab's per-ore stat matrix).
STAT_LABELS = {
    "lethality": "Lethality",
    "crit_chance": "Crit Chance",
    "crit_dmg": "Crit DMG",
    "atk_speed": "Atk Speed",
    "moon": "Moonstone",
    "explosion_dmg": "Explosion DMG",
    "explosion_chance": "Explosion Chance",
    "fire_dmg": "Fire DMG",
    "fire_chance": "Fire Chance",
    "fire_duration": "Fire Duration",
    "poison_dmg": "Poison DMG",
    "poison_chance": "Poison Chance",
    "poison_duration": "Poison Duration",
    "smite_dmg": "Smite DMG",
    "smite_chance": "Smite Chance",
    "blackhole_dmg": "Black Hole DMG",
}


class ScrollableFrame(ttk.Frame):
    """A frame whose content scrolls vertically when it overflows.

    The whole calculator tab uses a single instance so there is only one
    mouse-wheel binding.
    """

    def __init__(self, master, **kw):
        super().__init__(master, **kw)
        self.canvas = tk.Canvas(self, highlightthickness=0, borderwidth=0, background="#1e1e1e")
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


class SearchableCombo(ttk.Frame):
    """A search-as-you-type dropdown: an Entry plus a filterable popup list.

    Keeps the same value semantics as a read-only ttk.Combobox: the linked
    StringVar is written only on commit (Enter / click), never while typing, so
    callers' change traces fire once per selection instead of per keystroke.
    Typing narrows the list case-insensitively (substring); ``Up``/``Down``
    move the highlight, ``Enter`` commits, ``Esc`` closes and reverts.
    """

    def __init__(self, master, values=(), textvariable=None, width=24, height=8):
        super().__init__(master)
        self._choices = list(values)
        self._var = textvariable if textvariable is not None else tk.StringVar(master=master)
        self._height = height
        self._open_token = 0
        self._popup = None
        self._list = None

        self.entry = ttk.Entry(self, width=width)
        self.arrow = ttk.Button(self, text="▾", width=3, command=lambda: self._open(reset=True))
        self.entry.pack(side="left", fill="x", expand=True)
        self.arrow.pack(side="left")

        self._bind()
        self._var.trace_add("write", lambda *_a: self._sync_entry())
        self._sync_entry()

    # --- public API ---

    def set_values(self, values):
        self._choices = list(values)
        if self._var.get() not in self._choices and self._choices:
            self._var.set(self._choices[0])
        if self._popup is not None and self._popup.winfo_exists():
            self._refresh()

    def set(self, value):
        self._var.set(value)

    def get(self):
        return self._var.get()

    # --- event wiring ---

    def _bind(self):
        self.entry.bind("<Button-1>", lambda _e: self._open(reset=True))
        self.entry.bind("<KeyRelease>", self._on_key_release)
        self.entry.bind("<Down>", lambda _e: self._nav(1))
        self.entry.bind("<Up>", lambda _e: self._nav(-1))
        self.entry.bind("<Return>", lambda _e: self._commit_highlighted())
        self.entry.bind("<Escape>", lambda _e: self._close(revert=True) or "break")
        self.entry.bind("<FocusOut>", self._on_focus_out)

    def _on_key_release(self, event):
        if event.keysym in ("BackSpace", "Delete") or (event.char and event.char.isprintable()):
            self._open()

    def _nav(self, delta):
        if self._popup is None or not self._popup.winfo_viewable():
            self._open(reset=True)
        elif self._list.size():
            sel = self._list.curselection()
            idx = sel[0] if sel else 0
            idx = max(0, min(idx + delta, self._list.size() - 1))
            self._select(idx)
        return "break"

    def _on_focus_out(self, _event):
        token = self._open_token

        def maybe_close():
            if token == self._open_token and not self._focus_in_popup():
                self._close(revert=True)

        self.after(5, maybe_close)

    def _focus_in_popup(self) -> bool:
        if self._popup is None or not self._popup.winfo_exists():
            return False
        widget = self.focus_get()
        while widget is not None:
            if widget is self._popup or widget is self._list:
                return True
            try:
                widget = widget.master
            except tk.TclError:
                break
        return False

    # --- popup lifecycle ---

    def _open(self, reset=False):
        # Toggle: if already open, close it
        if self._popup is not None and self._popup.winfo_exists() and self._popup.winfo_viewable():
            self._close(revert=True)
            return
        if not self._choices:
            return
        self._open_token += 1
        if reset:
            self.entry.delete(0, "end")
        if self._popup is None or not self._popup.winfo_exists():
            self._popup = tk.Toplevel(self)
            self._popup.withdraw()
            self._popup.overrideredirect(True)
            self._popup.transient(self.winfo_toplevel())
            self._list = tk.Listbox(self._popup, height=self._height, activestyle="dotbox",
                                    selectmode="browse", exportselection=False, borderwidth=1,
                                    background="#252526", foreground="#e0e0e0",
                                    selectbackground="#004a99", selectforeground="#ffffff",
                                    highlightbackground="#444444", highlightcolor="#0078d4",
                                    font=("Segoe UI", 9))
            sbar = ttk.Scrollbar(self._popup, orient="vertical", command=self._list.yview)
            self._list.configure(yscrollcommand=sbar.set)
            self._list.pack(side="left", fill="both", expand=True)
            sbar.pack(side="right", fill="y")
            self._list.bind("<ButtonRelease-1>", self._on_list_click)
            self._list.bind("<Return>", lambda _e: self._commit_highlighted())
            self._list.bind("<Escape>", lambda _e: self._close(revert=True))
        self._refresh()
        self._popup.deiconify()
        self._popup.lift()
        self.update_idletasks()
        self._popup.geometry(f"+{self.winfo_rootx()}+{self.winfo_rooty() + self.winfo_height()}")

    def _refresh(self):
        needle = self.entry.get().strip().lower()
        shown = [o for o in self._choices if needle in o.lower()] if needle else list(self._choices)
        self._list.delete(0, "end")
        for option in shown:
            self._list.insert("end", option)
        committed = self._var.get()
        idx = shown.index(committed) if committed in shown else 0
        if shown:
            self._select(min(idx, len(shown) - 1))
        return shown

    def _select(self, idx):
        self._list.selection_clear(0, "end")
        self._list.selection_set(idx)
        self._list.activate(idx)
        self._list.see(idx)

    def _close(self, revert=False):
        if self._popup is not None and self._popup.winfo_exists():
            self._popup.withdraw()
        if revert:
            self._sync_entry()

    # --- commit path (the only place the var is written) ---

    def _on_list_click(self, _event=None):
        sel = self._list.curselection()
        if sel:
            self._commit(self._list.get(sel[0]))

    def _commit_highlighted(self):
        if self._popup is not None and self._popup.winfo_exists() and self._list.size():
            sel = self._list.curselection()
            if sel:
                self._commit(self._list.get(sel[0]))
                return "break"
        self._close(revert=True)
        return "break"

    def _commit(self, value):
        self._close()
        if value in self._choices:
            self._var.set(value)
        self._sync_entry()

    def _sync_entry(self):
        value = self._var.get() or ""
        self.entry.delete(0, "end")
        self.entry.insert(0, value)
        self.entry.icursor("end")


class Tooltip:
    """Hover help: shows ``text_fn()`` in a small popup next to the cursor.

    ``text_fn`` is called each time the tip is shown so it can reflect live
    values.  Nothing is scheduled until the pointer actually enters the widget,
    and the popup is cleaned up on leave or when the widget is destroyed.
    """

    _DELAY_MS = 350

    def __init__(self, widget, text_fn):
        self.widget = widget
        self.text_fn = text_fn
        self._job = None
        self._popup = None
        self._label = None
        widget.bind("<Enter>", self._on_enter, add="+")
        widget.bind("<Leave>", self._on_leave, add="+")
        widget.bind("<Destroy>", self._on_destroy, add="+")

    def _on_enter(self, event):
        self._cancel()
        self._job = self.widget.after(self._DELAY_MS, lambda: self._show(event))

    def _on_leave(self, _event):
        self._hide()

    def _on_destroy(self, _event):
        self._cancel()
        self._hide()

    def _cancel(self):
        if self._job is not None:
            try:
                self.widget.after_cancel(self._job)
            except tk.TclError:
                pass
            self._job = None

    def _show(self, event):
        self._job = None
        text = self.text_fn()
        if not text:
            return
        if self._popup is None or not self._popup.winfo_exists():
            self._popup = tk.Toplevel(self.widget)
            self._popup.withdraw()
            self._popup.overrideredirect(True)
            self._label = ttk.Label(self._popup, text="", background="#ffffe0",
                                    foreground="#1a1a1a", relief="solid", borderwidth=1,
                                    padding=(6, 3), wraplength=360, justify="left")
            self._label.pack()
        self._label.configure(text=text)
        self._popup.update_idletasks()
        x = event.x_root + 12
        y = event.y_root + 12
        width = self._popup.winfo_reqwidth()
        height = self._popup.winfo_reqheight()
        if x + width > self.widget.winfo_screenwidth():
            x = event.x_root - width - 8
        if y + height > self.widget.winfo_screenheight():
            y = event.y_root - height - 8
        self._popup.geometry(f"+{x}+{y}")
        self._popup.deiconify()
        self._popup.lift()

    def _hide(self):
        self._cancel()
        if self._popup is not None and self._popup.winfo_exists():
            self._popup.withdraw()
