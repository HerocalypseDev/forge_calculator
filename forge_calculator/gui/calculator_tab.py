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
from ..engine import Abilities, Build, OreSlot, calculate
from .widgets import ScrollableFrame, fmt2, fmt4, fmt_pct, sorted_display, to_float

__all__ = ["CalculatorTab"]

_WEAPON_ALL = "(All Types)"
_DECIMAL_HINT = "Percent inputs are decimals: 0.30 = 30%"


class CalculatorTab(ttk.Frame):
    def __init__(self, master, game: GameData):
        super().__init__(master)
        self.game = game
        self.root = master
        self._pending = False
        self.result_vars: dict[str, tk.StringVar] = {}
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

    def _build_ore_group(self, parent):
        parent.columnconfigure(1, weight=1)
        self.ore_vars = []
        self.amount_vars = []
        for row in range(4):
            ore_var = tk.StringVar(master=self.root, value=self.game.select_ore)
            amount_var = tk.StringVar(master=self.root, value="0")
            self.ore_vars.append(ore_var)
            self.amount_vars.append(amount_var)
            combo = ttk.Combobox(parent, textvariable=ore_var, state="readonly", width=24)
            combo["values"] = [self.game.select_ore] + [o.name for o in sorted_display(self.game.ores)]
            spin = ttk.Spinbox(parent, from_=0, to=999, increment=1, textvariable=amount_var, width=6)
            ttk.Label(parent, text=f"Slot {row + 1}").grid(row=row, column=0, sticky="w", padx=8, pady=2)
            combo.grid(row=row, column=1, sticky="ew", padx=4, pady=2)
            spin.grid(row=row, column=2, sticky="w", padx=4, pady=2)
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
        self.weapon_combo = ttk.Combobox(parent, textvariable=self.weapon_var, state="readonly", width=24)
        self.weapon_combo["values"] = [w.name for w in sorted_display(self.game.weapons)]
        self.weapon_var.set(self.game.weapons[0].name)
        quality_spin = ttk.Spinbox(parent, from_=0, to=500, increment=5, textvariable=self.quality_var, width=8)
        forge_combo = ttk.Combobox(parent, textvariable=self.forge_var, state="readonly", width=8)
        forge_combo["values"] = [str(n) for n in range(10)]

        ttk.Label(parent, text="Weapon type").grid(row=0, column=0, sticky="e", padx=8, pady=2)
        type_combo.grid(row=0, column=1, sticky="ew", padx=4, pady=2)
        ttk.Label(parent, text="Weapon").grid(row=1, column=0, sticky="e", padx=8, pady=2)
        self.weapon_combo.grid(row=1, column=1, sticky="ew", padx=4, pady=2)
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

        race_combo = ttk.Combobox(parent, textvariable=self.race_var, state="readonly", width=20)
        race_combo["values"] = [r.name for r in sorted_display(self.game.races)]
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
                combo = ttk.Combobox(parent, textvariable=var, state="readonly", width=22)
                combo["values"] = rune_values
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
                self._watch(var)

    def _build_achievement_group(self, parent):
        parent.columnconfigure(1, weight=1)
        self.achievement_var = tk.StringVar(master=self.root, value=self.game.none_label)
        combo = ttk.Combobox(parent, textvariable=self.achievement_var, state="readonly", width=24)
        combo["values"] = [a.name for a in sorted_display(self.game.achievements,
                                                          first=(self.game.none_label,))]
        ttk.Label(parent, text="Achievement (C80)").grid(row=0, column=0, sticky="e", padx=8, pady=2)
        combo.grid(row=0, column=1, sticky="ew", padx=4, pady=2)
        self._watch(self.achievement_var)

    @staticmethod
    def _entry(parent, var, width=10):
        return ttk.Entry(parent, width=width, textvariable=var)

    # --- results ---

    def _build_results(self, parent):
        parent.columnconfigure(0, weight=1)
        parent.columnconfigure(1, weight=1)

        def result_row(row, label, key, fmt):
            var = tk.StringVar(master=self.root, value="")
            self.result_vars[key] = var
            ttk.Label(parent, text=label).grid(row=row, column=0, sticky="e", padx=8, pady=1)
            ttk.Label(parent, textvariable=var).grid(row=row, column=1, sticky="w", padx=8, pady=1)

        rows = [
            ("Avg Ore Power (E10)", "avg_power", fmt2),
            ("Unforged Dmg (A18)", "unforged_damage", fmt2),
            ("Forged Dmg (C18)", "forged_damage", fmt2),
            ("Interval (C19)", "interval", fmt2),
            ("Attack Rate (E21)", "attack_rate", fmt4),
            ("Lethality (E44)", "lethality", fmt_pct),
            ("Crit Chance (E45)", "crit_chance", fmt_pct),
            ("Crit DMG (E46)", "crit_dmg", fmt_pct),
            ("Atk Speed (E47)", "atk_speed", fmt_pct),
            ("Crit Blend", "crit_blend", fmt4),
            ("Weapon DPS (C84)", "weapon_dps", fmt2),
            ("Explosion DPS (C85)", "explosion_dps", fmt2),
            ("Fire DPS (C86)", "fire_dps", fmt2),
            ("Poison DPS (C87)", "poison_dps", fmt2),
            ("Smite DPS (C88)", "smite_dps", fmt2),
            ("Black Hole DPS (C89)", "blackhole_dps", fmt2),
            ("Total DPS (C91)", "total_dps", fmt2),
            ("TTK 25k (E91)", "ttk_25k", fmt2),
            ("TTK 75k (E92)", "ttk_75k", fmt2),
            ("Berserk (C92)", "berserk", fmt2),
            ("Moonstone (C93)", "moonstone", fmt2),
            ("Min DPS (C95)", "min_dps", fmt2),
            ("Max Burst (C96)", "max_dps", fmt2),
        ]
        for row, (label, key, fmt) in enumerate(rows):
            result_row(row, label, key, fmt)

        self._traits_var = tk.StringVar(master=self.root, value="")
        ttk.Label(parent, text="Active Traits (C14)").grid(row=len(rows), column=0, sticky="ne", padx=8, pady=4)
        ttk.Label(parent, textvariable=self._traits_var, wraplength=320, justify="left").grid(
            row=len(rows), column=1, sticky="nw", padx=8, pady=4)

        self._result_formats = {key: fmt for _label, key, fmt in rows}

    # --- recompute ---

    def _recompute(self):
        self._pending = False
        build = self._build()
        r = calculate(build, self.game)
        for key, var in self.result_vars.items():
            var.set(self._result_formats[key](getattr(r, key)))
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
            names = [w.name for w in sorted_display(self.game.weapons)]
        else:
            names = [w.name for w in sorted_display(self.game.weapons_by_type(wtype))]
        self.weapon_combo["values"] = names
        if self.weapon_var.get() not in names:
            self.weapon_var.set(names[0] if names else "")
