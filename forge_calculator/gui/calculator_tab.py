"""The interactive DPS Calculator tab.

Every input is backed by a ``tk.StringVar``; a single coalescing change hook
recomputes the engine and updates the result labels.  All percent inputs are
typed as decimals (0.30 = 30%), matching the workbook's stored cell values
(its ``0%`` number format only changes the display).
"""

from __future__ import annotations

import tkinter as tk
from tkinter import ttk

from ..data import GameData
from ..engine import Abilities, Build, CAPS, OreSlot, calculate
from .widgets import (
    ScrollableFrame, SearchableCombo, Tooltip, STAT_LABELS,
    fmt2, fmt4, fmt_pct, sorted_display, to_float,
)

__all__ = ["CalculatorTab"]

_WEAPON_ALL = "(All Types)"
_DECIMAL_HINT = "Percent inputs are decimals: 0.30 = 30%"

# Short formula summaries shown when hovering a result row.
_RESULT_HELP = {
    "avg_power": "E10 = weighted average of ore multipliers",
    "unforged_damage": "A18 = weapon damage × ore power (no forge)",
    "forged_damage": "C18 = weapon damage × ore power × forge mult × (1 + quality/100)",
    "interval": "C19 = weapon swing interval (seconds)",
    "attack_rate": "E21 = (1 + atk speed) ÷ interval",
    "lethality": "E44 = ores + runes + race/class + armor + base, capped at 150%",
    "crit_chance": "E45 = ores + runes + armor + base, capped at 100%",
    "crit_dmg": "E46 = ores + runes + armor + base, capped at 100%",
    "atk_speed": "E47 = ores + runes + race/class, capped at 150%",
    "crit_blend": "min(CC, 1) × CD + (1 − min(CC, 1))",
    "weapon_dps": "C84 = C18 × (1 + lethality) × crit blend × attack rate",
    "explosion_dps": "C85 = A18 × explosion dmg × explosion chance × attack rate",
    "fire_dps": "C86 = A18 × fire dmg × min(1, chance × rate × min(duration, 5))",
    "poison_dps": "C87 = A18 × poison dmg × min(1, chance × rate × min(duration, 5))",
    "smite_dps": "C88 = A18 × smite dmg × min(chance, 1) × attack rate",
    "blackhole_dps": "C89 = A18 × black hole dmg × black hole chance × attack rate",
    "total_dps": "C91 = sum of weapon DPS and all procs",
    "ttk_25k": "E91 = 25,000 ÷ total DPS (∞ if 0)",
    "ttk_75k": "E92 = 75,000 ÷ total DPS (∞ if 0)",
    "berserk": "C92 = procs + C18 × (1 + min(berserk, 1.5)) × blend × rate (N/A if none)",
    "moonstone": "C93 = total × (1 + moonstone) (N/A if none)",
    "min_dps": "C95 = C18 × (1 + lethality) × attack rate",
    "max_dps": "C96 = max-burst burst; procs use forged C18 (workbook quirk)",
}


class CalculatorTab(ttk.Frame):
    def __init__(self, master, game: GameData):
        super().__init__(master)
        self.game = game
        self.root = master
        self._pending = False
        self.on_change = None  # set by MainWindow; called on input edits
        self.result_vars: dict[str, tk.StringVar] = {}
        self.result_labels: dict[str, ttk.Label] = {}
        self._tooltips: list[Tooltip] = []
        self._pinned_ores: list[str] = []
        self._pinned_weapons: list[str] = []
        self._numeric_entries: list[tuple[ttk.Entry, tk.StringVar]] = []
        self._build_widgets()
        self._recompute()

    # --- change tracking (coalesce rapid edits into one recompute) ---

    def _watch(self, var):
        var.trace_add("write", self._on_change)

    def _on_change(self, *_args):
        if self._pending:
            return
        self._pending = True
        self.root.after_idle(self._recompute)
        self._refresh_ore_pins()
        self._refresh_weapon_pin()
        if self.on_change is not None:
            self.on_change()

    # --- layout ---

    def _build_widgets(self):
        scroller = ScrollableFrame(self)
        scroller.pack(fill="both", expand=True)
        body = scroller.content
        body.columnconfigure(0, weight=1, uniform="pane")
        body.columnconfigure(1, weight=1, uniform="pane")

        inputs = ttk.LabelFrame(body, text="Build inputs")
        results = ttk.LabelFrame(body, text="Results")
        inputs.grid(row=0, column=0, sticky="nsew", padx=8, pady=8)
        results.grid(row=0, column=1, sticky="nsew", padx=8, pady=8)

        self._build_inputs(inputs)
        self._build_results(results)

    # --- inputs ---

    def _build_inputs(self, parent):
        self._inputs = {}

        hint = ttk.Label(parent, text=_DECIMAL_HINT, foreground="#666666")
        hint.grid(row=0, column=0, columnspan=2, sticky="w", padx=8, pady=(6, 2))

        group_ores = ttk.LabelFrame(parent, text="Ore slots")
        group_weapon = ttk.LabelFrame(parent, text="Weapon")
        group_stats = ttk.LabelFrame(parent, text="Character / stats")
        group_runes = ttk.LabelFrame(parent, text="Rune slots (6)")
        group_abilities = ttk.LabelFrame(parent, text="Ability inputs")
        group_achievement = ttk.LabelFrame(parent, text="Achievement")

        groups = [group_ores, group_weapon, group_stats, group_runes, group_abilities, group_achievement]
        for i, g in enumerate(groups):
            g.grid(row=i + 1, column=0, columnspan=2, sticky="ew", padx=8, pady=4)

        self._build_ore_group(group_ores)
        self._build_weapon_group(group_weapon)
        self._build_stats_group(group_stats)
        self._build_rune_group(group_runes)
        self._build_ability_group(group_abilities)
        self._build_achievement_group(group_achievement)

        # Action buttons row
        btn_frame = ttk.Frame(parent)
        btn_frame.grid(row=len(groups) + 1, column=0, columnspan=2, sticky="ew", padx=8, pady=8)
        ttk.Button(btn_frame, text="Reset", command=self._reset).pack(side="left", padx=4)
        ttk.Button(btn_frame, text="Copy Total DPS", command=self._copy_total).pack(side="left", padx=4)

    def _build_ore_group(self, parent):
        parent.columnconfigure(1, weight=1)
        self.ore_vars = []
        self.amount_vars = []
        self.ore_combos = []
        self.ore_pins = []
        for row in range(4):
            ore_var = tk.StringVar(master=self.root, value=self.game.select_ore)
            amount_var = tk.StringVar(master=self.root, value="0")
            self.ore_vars.append(ore_var)
            self.amount_vars.append(amount_var)
            combo = SearchableCombo(parent, values=self._ore_values(), textvariable=ore_var, width=24)
            self.ore_combos.append(combo)
            self._attach_tooltip(combo.entry, lambda row=row: self._ore_tooltip_text(row))
            spin = ttk.Spinbox(parent, from_=0, to=999, increment=1, textvariable=amount_var, width=6)
            pin = ttk.Button(parent, text="☆", width=3,
                             command=lambda r=row: self._toggle_ore_pin(r))
            self.ore_pins.append(pin)
            ttk.Label(parent, text=f"Slot {row + 1}").grid(row=row, column=0, sticky="w", padx=8, pady=2)
            combo.grid(row=row, column=1, sticky="ew", padx=4, pady=2)
            spin.grid(row=row, column=2, sticky="w", padx=4, pady=2)
            pin.grid(row=row, column=3, sticky="w", padx=4, pady=2)
            self._watch(ore_var)
            self._watch(amount_var)

    def _build_weapon_group(self, parent):
        parent.columnconfigure(1, weight=1)
        self.type_var = tk.StringVar(master=self.root, value=_WEAPON_ALL)
        self.weapon_var = tk.StringVar(master=self.root)
        self.quality_var = tk.StringVar(master=self.root, value="0")
        self.forge_var = tk.StringVar(master=self.root, value="0")

        type_combo = ttk.Combobox(parent, textvariable=self.type_var, state="readonly", width=24)
        type_combo["values"] = [_WEAPON_ALL] + sorted(self.game.weapon_types, key=str.lower)
        self.weapon_combo = SearchableCombo(parent, values=self._weapon_values(),
                                            textvariable=self.weapon_var, width=24)
        self._attach_tooltip(self.weapon_combo.entry, self._weapon_tooltip_text)
        self.weapon_pin = ttk.Button(parent, text="☆", width=3, command=self._toggle_weapon_pin)
        self.weapon_var.set(self.game.weapons[0].name)
        quality_spin = ttk.Spinbox(parent, from_=0, to=500, increment=5, textvariable=self.quality_var, width=8)
        forge_combo = ttk.Combobox(parent, textvariable=self.forge_var, state="readonly", width=8)
        forge_combo["values"] = [str(n) for n in range(10)]

        ttk.Label(parent, text="Weapon type").grid(row=0, column=0, sticky="e", padx=8, pady=2)
        type_combo.grid(row=0, column=1, sticky="ew", padx=4, pady=2)
        ttk.Label(parent, text="Weapon").grid(row=1, column=0, sticky="e", padx=8, pady=2)
        self.weapon_combo.grid(row=1, column=1, sticky="ew", padx=4, pady=2)
        self.weapon_pin.grid(row=1, column=2, sticky="w", padx=4, pady=2)
        ttk.Label(parent, text="Quality (E12)").grid(row=2, column=0, sticky="e", padx=8, pady=2)
        quality_spin.grid(row=2, column=1, sticky="w", padx=4, pady=2)
        ttk.Label(parent, text="Forge level (C13)").grid(row=3, column=0, sticky="e", padx=8, pady=2)
        forge_combo.grid(row=3, column=1, sticky="w", padx=4, pady=2)

        self.type_var.trace_add("write", self._on_weapon_type_change)
        for var in (self.type_var, self.weapon_var, self.quality_var, self.forge_var):
            self._watch(var)

    def _build_stats_group(self, parent):
        parent.columnconfigure(1, weight=1)
        self.race_var = tk.StringVar(master=self.root, value="Human")
        self.bonus_var = tk.StringVar(master=self.root, value=self.game.race_bonus_types[0])
        self.base_cc_var = tk.StringVar(master=self.root, value="0")
        self.base_cd_var = tk.StringVar(master=self.root, value="0")
        self.armor_cc_var = tk.StringVar(master=self.root, value="0")
        self.armor_cd_var = tk.StringVar(master=self.root, value="0")
        self.armor_leth_var = tk.StringVar(master=self.root, value="0")
        self.base_leth_var = tk.StringVar(master=self.root, value="0")
        self.berserk_var = tk.StringVar(master=self.root, value="0")

        race_combo = SearchableCombo(
            parent, values=[r.name for r in sorted_display(self.game.races)],
            textvariable=self.race_var, width=20)
        bonus_combo = ttk.Combobox(parent, textvariable=self.bonus_var, state="readonly", width=20)
        bonus_combo["values"] = sorted(self.game.race_bonus_types, key=str.lower)

        rows = [
            ("Race (C22)", race_combo),
            ("Bonus type (C23)", bonus_combo),
            ("Base Crit Chance (C20)", self._entry(parent, self.base_cc_var)),
            ("Base Crit DMG (C21)", self._entry(parent, self.base_cd_var)),
            ("Armor Crit Chance (C41)", self._entry(parent, self.armor_cc_var)),
            ("Armor Crit DMG (C42)", self._entry(parent, self.armor_cd_var)),
            ("Armor Lethality (C43)", self._entry(parent, self.armor_leth_var)),
            ("Base Lethality (A44)", self._entry(parent, self.base_leth_var)),
            ("Berserk (C53)", self._entry(parent, self.berserk_var)),
        ]
        for row, (label, widget) in enumerate(rows):
            ttk.Label(parent, text=label).grid(row=row, column=0, sticky="e", padx=8, pady=2)
            widget.grid(row=row, column=1, sticky="w", padx=4, pady=2)

        for var in (self.race_var, self.bonus_var, self.base_cc_var, self.base_cd_var,
                    self.armor_cc_var, self.armor_cd_var, self.armor_leth_var,
                    self.base_leth_var, self.berserk_var):
            self._watch(var)

    def _build_rune_group(self, parent):
        parent.columnconfigure(1, weight=1)
        parent.columnconfigure(3, weight=1)
        self.rune_vars = []
        rune_values = [self.game.none_label] + [r.name for r in sorted_display(self.game.runes)]
        for row in range(3):
            for col in range(2):
                var = tk.StringVar(master=self.root, value=self.game.none_label)
                self.rune_vars.append(var)
                combo = SearchableCombo(parent, values=rune_values, textvariable=var, width=22)
                label_col = 0 + col * 2
                combo_col = 1 + col * 2
                ttk.Label(parent, text=f"Rune {row + 1}.{col + 1}").grid(row=row, column=label_col, sticky="e", padx=8, pady=2)
                combo.grid(row=row, column=combo_col, sticky="ew", padx=4, pady=2)
                self._watch(var)

    def _build_ability_group(self, parent):
        parent.columnconfigure(1, weight=1)
        parent.columnconfigure(3, weight=1)
        parent.columnconfigure(5, weight=1)
        self.ability_vars = {}
        labels = [
            ("Fire DMG (C34)", "fire_dmg"),
            ("Fire Chance (C35)", "fire_chance"),
            ("Fire Time s (C36)", "fire_time"),
            ("Poison DMG (D34)", "poison_dmg"),
            ("Poison Chance (D35)", "poison_chance"),
            ("Poison Time s (D36)", "poison_time"),
            ("Blast DMG (E34)", "blast_dmg"),
            ("Blast Chance (E35)", "blast_chance"),
        ]
        # three columns: DMG | Chance | Time  (Blast has no Time -> blank)
        grid = [
            ("Fire", "fire_dmg", "fire_chance", "fire_time"),
            ("Poison", "poison_dmg", "poison_chance", "poison_time"),
            ("Blast", "blast_dmg", "blast_chance", None),
        ]
        headers = ["", "DMG (decimal)", "Chance (decimal)", "Time (s)"]
        for col, h in enumerate(headers):
            ttk.Label(parent, text=h, font=("", 9, "bold")).grid(row=0, column=col, sticky="w", padx=8, pady=2)
        for row, (name, dmg_key, chance_key, time_key) in enumerate(grid, start=1):
            ttk.Label(parent, text=name).grid(row=row, column=0, sticky="w", padx=8, pady=2)
            for col, key in enumerate([dmg_key, chance_key, time_key], start=1):
                if key is None:
                    continue
                var = tk.StringVar(master=self.root, value="0")
                self.ability_vars[key] = var
                entry = ttk.Entry(parent, textvariable=var, width=12)
                entry.grid(row=row, column=col, sticky="w", padx=4, pady=2)
                var.trace_add("write", lambda *_a, e=entry, v=var: self._validate_numeric_entry(e, v))
                self._numeric_entries.append((entry, var))
                self._watch(var)

    def _build_achievement_group(self, parent):
        parent.columnconfigure(1, weight=1)
        self.achievement_var = tk.StringVar(master=self.root, value=self.game.none_label)
        combo = SearchableCombo(
            parent,
            values=[a.name for a in sorted_display(self.game.achievements,
                                                   first=(self.game.none_label,))],
            textvariable=self.achievement_var, width=24)
        ttk.Label(parent, text="Achievement (C80)").grid(row=0, column=0, sticky="e", padx=8, pady=2)
        combo.grid(row=0, column=1, sticky="ew", padx=4, pady=2)
        self._watch(self.achievement_var)

    def _entry(self, parent, var, width=10):
        entry = ttk.Entry(parent, width=width, textvariable=var)
        var.trace_add("write", lambda *_: self._validate_numeric_entry(entry, var))
        self._numeric_entries.append((entry, var))
        return entry

    def _validate_numeric_entry(self, entry, var):
        """Highlight invalid numeric entries with a red background."""
        text = var.get().strip()
        if not text:
            entry.configure(background="white")
            return
        try:
            float(text)
            entry.configure(background="white")
        except ValueError:
            entry.configure(background="#ffcccc")

    # --- results ---

    def _build_results(self, parent):
        parent.columnconfigure(0, weight=1)
        parent.columnconfigure(1, weight=1)

        def result_row(row, label, key, fmt):
            var = tk.StringVar(master=self.root, value="")
            self.result_vars[key] = var
            ttk.Label(parent, text=label).grid(row=row, column=0, sticky="e", padx=8, pady=1)
            value_label = ttk.Label(parent, textvariable=var)
            value_label.grid(row=row, column=1, sticky="w", padx=8, pady=1)
            self.result_labels[key] = value_label
            self._attach_tooltip(value_label, lambda k=key: _RESULT_HELP[k])

        def section_header(row, text):
            ttk.Label(parent, text=text, font=("", 9, "bold")).grid(
                row=row, column=0, columnspan=2, sticky="w", padx=8, pady=(8, 2))

        # Grouped result sections
        sections = [
            ("Core", [
                ("Avg Ore Power (E10)", "avg_power", fmt2),
                ("Unforged Dmg (A18)", "unforged_damage", fmt2),
                ("Forged Dmg (C18)", "forged_damage", fmt2),
                ("Interval (C19)", "interval", fmt2),
                ("Attack Rate (E21)", "attack_rate", fmt4),
            ]),
            ("Stats", [
                ("Lethality (E44)", "lethality", fmt_pct),
                ("Crit Chance (E45)", "crit_chance", fmt_pct),
                ("Crit DMG (E46)", "crit_dmg", fmt_pct),
                ("Atk Speed (E47)", "atk_speed", fmt_pct),
                ("Crit Blend", "crit_blend", fmt4),
            ]),
            ("DPS", [
                ("Weapon DPS (C84)", "weapon_dps", fmt2),
                ("Explosion DPS (C85)", "explosion_dps", fmt2),
                ("Fire DPS (C86)", "fire_dps", fmt2),
                ("Poison DPS (C87)", "poison_dps", fmt2),
                ("Smite DPS (C88)", "smite_dps", fmt2),
                ("Black Hole DPS (C89)", "blackhole_dps", fmt2),
                ("Total DPS (C91)", "total_dps", fmt2),
                ("Berserk (C92)", "berserk", fmt2),
                ("Moonstone (C93)", "moonstone", fmt2),
                ("Min DPS (C95)", "min_dps", fmt2),
                ("Max Burst (C96)", "max_dps", fmt2),
            ]),
            ("Time", [
                ("TTK 25k (E91)", "ttk_25k", fmt2),
                ("TTK 75k (E92)", "ttk_75k", fmt2),
            ]),
        ]

        row = 0
        for section_title, items in sections:
            section_header(row, section_title)
            row += 1
            for label, key, fmt in items:
                result_row(row, label, key, fmt)
                row += 1

        self._traits_var = tk.StringVar(master=self.root, value="")
        ttk.Label(parent, text="Active Traits (C14)").grid(row=row, column=0, sticky="ne", padx=8, pady=4)
        ttk.Label(parent, textvariable=self._traits_var, wraplength=320, justify="left").grid(
            row=row, column=1, sticky="nw", padx=8, pady=4)

        # Flatten sections for format lookup
        all_rows = [(label, key, fmt) for section in sections for (label, key, fmt) in section[1]]
        self._result_formats = {key: fmt for _label, key, fmt in all_rows}

    # --- recompute ---

    def _recompute(self):
        self._pending = False
        build = self._build()
        r = calculate(build, self.game)
        for key, var in self.result_vars.items():
            var.set(self._result_formats[key](getattr(r, key)))
            label = self.result_labels.get(key)
            if label:
                val = getattr(r, key)
                cap = CAPS.get(key)
                at_cap = cap is not None and val is not None and val >= cap
                label.configure(foreground="#cc0000" if at_cap else "black")
        self._traits_var.set(r.active_traits)

    def _build(self) -> Build:
        return Build(
            slots=(
                OreSlot(self.ore_vars[0].get(), to_float(self.amount_vars[0].get())),
                OreSlot(self.ore_vars[1].get(), to_float(self.amount_vars[1].get())),
                OreSlot(self.ore_vars[2].get(), to_float(self.amount_vars[2].get())),
                OreSlot(self.ore_vars[3].get(), to_float(self.amount_vars[3].get())),
            ),
            weapon_name=self.weapon_var.get(),
            quality=to_float(self.quality_var.get()),
            forge_level=int(to_float(self.forge_var.get())),
            race=self.race_var.get(),
            bonus_weapon_type=self.bonus_var.get(),
            rune_cells=tuple(v.get() for v in self.rune_vars),
            base_crit_chance=to_float(self.base_cc_var.get()),
            base_crit_dmg=to_float(self.base_cd_var.get()),
            armor_crit_chance=to_float(self.armor_cc_var.get()),
            armor_crit_dmg=to_float(self.armor_cd_var.get()),
            armor_lethality=to_float(self.armor_leth_var.get()),
            base_lethality=to_float(self.base_leth_var.get()),
            abilities=Abilities(
                fire_dmg=to_float(self.ability_vars["fire_dmg"].get()),
                fire_chance=to_float(self.ability_vars["fire_chance"].get()),
                fire_time=to_float(self.ability_vars["fire_time"].get()),
                poison_dmg=to_float(self.ability_vars["poison_dmg"].get()),
                poison_chance=to_float(self.ability_vars["poison_chance"].get()),
                poison_time=to_float(self.ability_vars["poison_time"].get()),
                blast_dmg=to_float(self.ability_vars["blast_dmg"].get()),
                blast_chance=to_float(self.ability_vars["blast_chance"].get()),
            ),
            berserk=to_float(self.berserk_var.get()),
            achievement=self.achievement_var.get(),
        )

    # --- callbacks ---

    def _on_weapon_type_change(self, *_args):
        wtype = self.type_var.get()
        if wtype in (None, "", _WEAPON_ALL):
            names = [w.name for w in self.game.weapons]
        else:
            names = [w.name for w in self.game.weapons_by_type(wtype)]
        self.weapon_combo.set_values(self._order_names(names, self._pinned_weapons))

    # --- favorites / quick-pins ---

    @staticmethod
    def _order_names(names, pinned):
        pinned_ok = [n for n in sorted(pinned, key=str.lower) if n in names]
        rest = sorted((n for n in names if n not in pinned_ok), key=str.lower)
        return pinned_ok + rest

    def _ore_values(self):
        names = [o.name for o in self.game.ores]
        return [self.game.select_ore] + self._order_names(names, self._pinned_ores)

    def _weapon_values(self):
        return self._order_names([w.name for w in self.game.weapons], self._pinned_weapons)

    def _refresh_ore_values(self):
        values = self._ore_values()
        for combo in self.ore_combos:
            combo.set_values(values)

    def _refresh_weapon_values(self):
        self._on_weapon_type_change()

    def _refresh_ore_pins(self):
        for i, pin in enumerate(self.ore_pins):
            name = self.ore_vars[i].get()
            pin.configure(text="★" if name in self._pinned_ores else "☆")

    def _refresh_weapon_pin(self):
        name = self.weapon_var.get()
        self.weapon_pin.configure(text="★" if name in self._pinned_weapons else "☆")

    def _toggle_ore_pin(self, row):
        name = self.ore_vars[row].get()
        if name in (None, "", self.game.select_ore):
            return
        if name in self._pinned_ores:
            self._pinned_ores.remove(name)
        else:
            self._pinned_ores.append(name)
        self._refresh_ore_values()
        self._refresh_ore_pins()
        if self.on_change is not None:
            self.on_change()

    def _toggle_weapon_pin(self):
        name = self.weapon_var.get()
        if name in (None, ""):
            return
        if name in self._pinned_weapons:
            self._pinned_weapons.remove(name)
        else:
            self._pinned_weapons.append(name)
        self._refresh_weapon_values()
        self._refresh_weapon_pin()
        if self.on_change is not None:
            self.on_change()

    # --- actions ---

    def _reset(self):
        """Restore calculator to default values."""
        for i, var in enumerate(self.ore_vars):
            var.set(self.game.select_ore)
        for var in self.amount_vars:
            var.set("0")
        self.type_var.set(_WEAPON_ALL)
        self.weapon_var.set(self.game.weapons[0].name)
        self.quality_var.set("0")
        self.forge_var.set("0")
        self.race_var.set("Human")
        self.bonus_var.set(self.game.race_bonus_types[0])
        self.base_cc_var.set("0")
        self.base_cd_var.set("0")
        self.armor_cc_var.set("0")
        self.armor_cd_var.set("0")
        self.armor_leth_var.set("0")
        self.base_leth_var.set("0")
        self.berserk_var.set("0")
        for var in self.rune_vars:
            var.set(self.game.none_label)
        for var in self.ability_vars.values():
            var.set("0")
        self.achievement_var.set(self.game.none_label)

    def _copy_total(self):
        """Copy Total DPS to clipboard."""
        total = self.result_vars.get("total_dps")
        if total:
            self.root.clipboard_clear()
            self.root.clipboard_append(total.get())

    # --- tooltips ---

    def _attach_tooltip(self, widget, text_fn):
        self._tooltips.append(Tooltip(widget, text_fn))

    def _ore_tooltip_text(self, row):
        ore = self.game.ore(self.ore_vars[row].get())
        if ore is None:
            return ""
        lines = [ore.name, f"Equipment: {ore.equipment or '—'}",
                 f"Multiplier: {ore.multiplier:g}"]
        if ore.trait10:
            lines.append(f"@10%: {ore.trait10}")
        if ore.trait30:
            lines.append(f"@30%: {ore.trait30}")
        for key, r in ore.stats.items():
            unit = "%" if r.divisor == 100 else "s"
            lines.append(f"{STAT_LABELS.get(key, key)}: {r.base:g} → {r.max:g} {unit}")
        if ore.comments:
            lines.append(ore.comments)
        return "\n".join(lines)

    def _weapon_tooltip_text(self):
        weapon = self.game.weapon(self.weapon_var.get())
        if weapon is None:
            return ""
        return f"{weapon.name}\nType: {weapon.type}\n" \
               f"Interval: {weapon.interval:g}s\nDamage: {weapon.damage:g}"

    # --- persistence ---

    def get_state(self) -> dict:
        return {
            "ores": [(v.get(), self.amount_vars[i].get()) for i, v in enumerate(self.ore_vars)],
            "weapon_type": self.type_var.get(),
            "weapon": self.weapon_var.get(),
            "quality": self.quality_var.get(),
            "forge": self.forge_var.get(),
            "race": self.race_var.get(),
            "bonus": self.bonus_var.get(),
            "base_cc": self.base_cc_var.get(),
            "base_cd": self.base_cd_var.get(),
            "armor_cc": self.armor_cc_var.get(),
            "armor_cd": self.armor_cd_var.get(),
            "armor_leth": self.armor_leth_var.get(),
            "base_leth": self.base_leth_var.get(),
            "berserk": self.berserk_var.get(),
            "runes": [v.get() for v in self.rune_vars],
            "abilities": {k: v.get() for k, v in self.ability_vars.items()},
            "achievement": self.achievement_var.get(),
            "favorites": {"ores": list(self._pinned_ores), "weapons": list(self._pinned_weapons)},
        }

    def set_state(self, state: dict) -> None:
        state = state or {}

        favorites = state.get("favorites")
        if isinstance(favorites, dict):
            pinned_ores = favorites.get("ores")
            if isinstance(pinned_ores, list):
                self._pinned_ores = [n for n in pinned_ores
                                     if isinstance(n, str) and self.game.ore(n) is not None]
            pinned_weapons = favorites.get("weapons")
            if isinstance(pinned_weapons, list):
                self._pinned_weapons = [n for n in pinned_weapons
                                        if isinstance(n, str) and self.game.weapon(n) is not None]

        valid_ores = {o.name for o in self.game.ores} | {self.game.select_ore}
        ores = state.get("ores")
        if isinstance(ores, list):
            for i, slot in enumerate(ores[:4]):
                if not isinstance(slot, (list, tuple)) or len(slot) != 2:
                    continue
                name, amount = slot
                if isinstance(name, str) and name in valid_ores:
                    self.ore_vars[i].set(name)
                if isinstance(amount, (int, float)):
                    amount = str(amount)
                if isinstance(amount, str):
                    self.amount_vars[i].set(amount)

        wtype = state.get("weapon_type")
        if isinstance(wtype, str) and (wtype == _WEAPON_ALL or wtype in self.game.weapon_types):
            self.type_var.set(wtype)
        weapon = state.get("weapon")
        if isinstance(weapon, str) and self.game.weapon(weapon) is not None:
            if wtype in (None, "", _WEAPON_ALL) or self.game.weapon(weapon).type == wtype:
                self.weapon_var.set(weapon)

        for key, var in [
            ("quality", self.quality_var),
            ("base_cc", self.base_cc_var),
            ("base_cd", self.base_cd_var),
            ("armor_cc", self.armor_cc_var),
            ("armor_cd", self.armor_cd_var),
            ("armor_leth", self.armor_leth_var),
            ("base_leth", self.base_leth_var),
            ("berserk", self.berserk_var),
        ]:
            val = state.get(key)
            if isinstance(val, (int, float)):
                val = str(val)
            if isinstance(val, str):
                var.set(val)

        forge = state.get("forge")
        if isinstance(forge, str) and forge in {str(n) for n in range(10)}:
            self.forge_var.set(forge)

        race = state.get("race")
        if isinstance(race, str) and self.game.race(race) is not None:
            self.race_var.set(race)
        bonus = state.get("bonus")
        if isinstance(bonus, str) and bonus in self.game.race_bonus_types:
            self.bonus_var.set(bonus)

        runes = state.get("runes")
        if isinstance(runes, list):
            valid_runes = {r.name for r in self.game.runes} | {self.game.none_label}
            for i, val in enumerate(runes[:6]):
                if isinstance(val, str) and val in valid_runes:
                    self.rune_vars[i].set(val)

        abilities = state.get("abilities")
        if isinstance(abilities, dict):
            for key, val in abilities.items():
                if key in self.ability_vars and isinstance(val, str):
                    self.ability_vars[key].set(val)

        achievement = state.get("achievement")
        if isinstance(achievement, str) and achievement in {a.name for a in self.game.achievements}:
            self.achievement_var.set(achievement)

        self._refresh_ore_values()
        self._refresh_weapon_values()
        self._refresh_ore_pins()
        self._refresh_weapon_pin()
