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

# Contextual "Select X" prompts shown when a field is empty. The engine's
# "None" sentinel is untouched; _build()/get_state() translate prompt → sentinel
# at the state boundary.
_ORE_PROMPT = "Select Ores"
_WEAPON_TYPE_PROMPT = "Select Weapon Type"
_WEAPON_PROMPT = "Select Weapon"
_ENHANCEMENT_PROMPT = "Select Enhancement"
_RACE_PROMPT = "Select Race"
_BONUS_PROMPT = "Select Bonus Type"
_ACHIEVEMENT_PROMPT = "Select Achievement"
_PROMPTS = frozenset({
    _ORE_PROMPT, _WEAPON_TYPE_PROMPT, _WEAPON_PROMPT,
    _ENHANCEMENT_PROMPT, _RACE_PROMPT, _BONUS_PROMPT, _ACHIEVEMENT_PROMPT,
})

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
        if self.on_change is not None:
            self.on_change()

    def _from_ui(self, val: str) -> str:
        """Translate a UI 'Select X' prompt back to the engine's 'None' sentinel."""
        return self.game.none_label if val in _PROMPTS else val

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
        group_abilities = ttk.LabelFrame(parent, text="Ability inputs")
        group_achievement = ttk.LabelFrame(parent, text="Achievement")

        groups = [group_ores, group_weapon, group_stats, group_abilities, group_achievement]
        for i, g in enumerate(groups):
            g.grid(row=i + 1, column=0, columnspan=2, sticky="ew", padx=8, pady=4)

        self._build_ore_group(group_ores)
        self._build_weapon_group(group_weapon)
        self._build_stats_group(group_stats)
        self._build_ability_group(group_abilities)
        self._build_achievement_group(group_achievement)

        # Action buttons row
        btn_frame = ttk.Frame(parent)
        btn_frame.grid(row=len(groups) + 1, column=0, columnspan=2, sticky="ew", padx=8, pady=8)
        ttk.Button(btn_frame, text="Reset", command=self._reset).pack(side="left", padx=4)

    def _build_ore_group(self, parent):
        parent.columnconfigure(1, weight=1)
        self.ore_vars = []
        self.amount_vars = []
        self.ore_combos = []
        self.ore_mult_labels = []
        ore_values = self._ore_values()  # "Select Ores" prompt at start
        for row in range(4):
            ore_var = tk.StringVar(master=self.root, value=_ORE_PROMPT)
            amount_var = tk.StringVar(master=self.root, value="0")
            self.ore_vars.append(ore_var)
            self.amount_vars.append(amount_var)
            combo = SearchableCombo(parent, values=ore_values, textvariable=ore_var, width=24)
            self.ore_combos.append(combo)
            self._attach_tooltip(combo.entry, lambda row=row: self._ore_tooltip_text(row))
            spin = ttk.Spinbox(parent, from_=0, to=999, increment=1, textvariable=amount_var, width=6)
            mult_label = ttk.Label(parent, text="", foreground="#a88840", width=6)
            self.ore_mult_labels.append(mult_label)
            ttk.Label(parent, text=f"Slot {row + 1}").grid(row=row, column=0, sticky="w", padx=8, pady=2)
            combo.grid(row=row, column=1, sticky="ew", padx=4, pady=2)
            spin.grid(row=row, column=2, sticky="w", padx=4, pady=2)
            mult_label.grid(row=row, column=3, sticky="w", padx=4, pady=2)
            self._watch(ore_var)
            self._watch(amount_var)
            ore_var.trace_add("write", lambda *_a, r=row: self._update_ore_mult(r))

    def _update_ore_mult(self, row):
        """Refresh the '×multiplier' readout next to an ore slot."""
        ore = self.game.ore(self.ore_vars[row].get())
        self.ore_mult_labels[row].configure(text=f"×{ore.multiplier:g}" if ore else "")

    def _build_weapon_group(self, parent):
        parent.columnconfigure(1, weight=1)
        self.type_var = tk.StringVar(master=self.root, value=_WEAPON_TYPE_PROMPT)
        self.weapon_var = tk.StringVar(master=self.root, value=_WEAPON_PROMPT)
        self.quality_var = tk.StringVar(master=self.root, value="100")
        self.enhancement_var = tk.StringVar(master=self.root, value="0")

        type_values = [_WEAPON_TYPE_PROMPT] + [_WEAPON_ALL] + sorted(self.game.weapon_types, key=str.lower)
        type_combo = ttk.Combobox(parent, textvariable=self.type_var, state="readonly", width=24)
        type_combo["values"] = type_values
        self.weapon_combo = SearchableCombo(parent, values=self._weapon_values(),
                                            textvariable=self.weapon_var, width=24)
        self._attach_tooltip(self.weapon_combo.entry, self._weapon_tooltip_text)
        quality_spin = ttk.Spinbox(parent, from_=0, to=100, increment=5, textvariable=self.quality_var, width=8)
        enhancement_combo = ttk.Combobox(parent, textvariable=self.enhancement_var, state="readonly", width=8)
        enhancement_combo["values"] = [_ENHANCEMENT_PROMPT] + [str(n) for n in range(10)]

        ttk.Label(parent, text="Weapon type").grid(row=0, column=0, sticky="e", padx=8, pady=2)
        type_combo.grid(row=0, column=1, sticky="ew", padx=4, pady=2)
        ttk.Label(parent, text="Weapon").grid(row=1, column=0, sticky="e", padx=8, pady=2)
        self.weapon_combo.grid(row=1, column=1, sticky="ew", padx=4, pady=2)
        ttk.Label(parent, text="Quality").grid(row=2, column=0, sticky="e", padx=8, pady=2)
        quality_spin.grid(row=2, column=1, sticky="w", padx=4, pady=2)
        ttk.Label(parent, text="Enhancement").grid(row=3, column=0, sticky="e", padx=8, pady=2)
        enhancement_combo.grid(row=3, column=1, sticky="w", padx=4, pady=2)

        self.type_var.trace_add("write", self._on_weapon_type_change)
        for var in (self.type_var, self.weapon_var, self.quality_var, self.enhancement_var):
            self._watch(var)

    def _build_stats_group(self, parent):
        parent.columnconfigure(1, weight=1)
        self.race_var = tk.StringVar(master=self.root, value=_RACE_PROMPT)
        self.bonus_var = tk.StringVar(master=self.root, value=_BONUS_PROMPT)
        self.armor_cc_var = tk.StringVar(master=self.root, value="0")
        self.armor_cd_var = tk.StringVar(master=self.root, value="0")
        self.armor_leth_var = tk.StringVar(master=self.root, value="0")
        self.berserk_var = tk.StringVar(master=self.root, value="0")

        race_values = [_RACE_PROMPT] + [r.name for r in sorted_display(self.game.races)]
        race_combo = SearchableCombo(
            parent, values=race_values,
            textvariable=self.race_var, width=20)

        bonus_values = [_BONUS_PROMPT] + sorted(self.game.race_bonus_types, key=str.lower)
        bonus_combo = ttk.Combobox(parent, textvariable=self.bonus_var, state="readonly", width=20)
        bonus_combo["values"] = bonus_values

        rows = [
            ("Race", race_combo),
            ("Bonus Type", bonus_combo),
            ("Armor Crit Chance", self._entry(parent, self.armor_cc_var)),
            ("Armor Crit DMG", self._entry(parent, self.armor_cd_var)),
            ("Armor Lethality", self._entry(parent, self.armor_leth_var)),
            ("Berserk", self._entry(parent, self.berserk_var)),
        ]
        for row, (label, widget) in enumerate(rows):
            ttk.Label(parent, text=label).grid(row=row, column=0, sticky="e", padx=8, pady=2)
            widget.grid(row=row, column=1, sticky="w", padx=4, pady=2)

        for var in (self.race_var, self.bonus_var, self.armor_cc_var, self.armor_cd_var,
                    self.armor_leth_var, self.berserk_var):
            self._watch(var)

    def _build_ability_group(self, parent):
        parent.columnconfigure(1, weight=1)
        parent.columnconfigure(3, weight=1)
        parent.columnconfigure(5, weight=1)
        self.ability_vars = {}
        # three columns: DMG | Chance | Time  (Blast has no Time -> blank)
        grid = [
            ("Fire", "fire_dmg", "fire_chance", "fire_time"),
            ("Poison", "poison_dmg", "poison_chance", "poison_time"),
            ("Blast", "blast_dmg", "blast_chance", None),
        ]
        headers = ["", "DMG", "Chance", "Time (s)"]
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
        self.achievement_var = tk.StringVar(master=self.root, value=_ACHIEVEMENT_PROMPT)
        combo = SearchableCombo(
            parent,
            values=[a.name for a in sorted_display(self.game.achievements,
                                                       first=(_ACHIEVEMENT_PROMPT,))],
            textvariable=self.achievement_var, width=24)
        ttk.Label(parent, text="Achievement").grid(row=0, column=0, sticky="e", padx=8, pady=2)
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

        def result_row(container, row, label, key, fmt, highlight_total=False):
            var = tk.StringVar(master=self.root, value="")
            self.result_vars[key] = var
            ttk.Label(container, text=label).grid(row=row, column=0, sticky="e", padx=8, pady=2)
            value_label = ttk.Label(container, textvariable=var)
            if highlight_total:
                value_label.configure(font=("", 10, "bold"))
            value_label.grid(row=row, column=1, sticky="w", padx=8, pady=2)
            self.result_labels[key] = value_label
            self._attach_tooltip(value_label, lambda k=key: _RESULT_HELP[k])

        def make_card(parent, row, title):
            card = ttk.Labelframe(parent, text=title, padding=(8, 6))
            card.grid(row=row, column=0, columnspan=2, sticky="ew", padx=8, pady=4)
            card.columnconfigure(0, weight=1)
            card.columnconfigure(1, weight=1)
            return card

        # Create card containers
        row = 0
        core_card = make_card(parent, row, "Core Stats")
        row += 1
        stats_card = make_card(parent, row, "Derived Stats")
        row += 1
        dps_card = make_card(parent, row, "DPS Breakdown")
        row += 1
        time_card = make_card(parent, row, "Time to Kill")
        row += 1

        # Core Stats card
        core_items = [
            ("Average Multiplier", "avg_power", fmt2),
            ("Base Damage", "unforged_damage", fmt2),
            ("Weapon Damage", "forged_damage", fmt2),
            ("Swing Interval", "interval", fmt2),
            ("Attack Rate", "attack_rate", fmt4),
        ]
        for i, (label, key, fmt) in enumerate(core_items):
            result_row(core_card, i, label, key, fmt)

        # Derived Stats card
        stats_items = [
            ("Lethality", "lethality", fmt_pct),
            ("Crit Chance", "crit_chance", fmt_pct),
            ("Crit Damage", "crit_dmg", fmt_pct),
            ("Attack Speed", "atk_speed", fmt_pct),
            ("Crit Blend", "crit_blend", fmt4),
        ]
        for i, (label, key, fmt) in enumerate(stats_items):
            result_row(stats_card, i, label, key, fmt)

        # DPS Breakdown card
        dps_items = [
            ("Weapon DPS", "weapon_dps", fmt2),
            ("Explosion DPS", "explosion_dps", fmt2),
            ("Fire DPS", "fire_dps", fmt2),
            ("Poison DPS", "poison_dps", fmt2),
            ("Smite DPS", "smite_dps", fmt2),
            ("Black Hole DPS", "blackhole_dps", fmt2),
        ]
        for i, (label, key, fmt) in enumerate(dps_items):
            result_row(dps_card, i, label, key, fmt)

        # Separator before total
        ttk.Separator(dps_card, orient="horizontal").grid(
            row=len(dps_items), column=0, columnspan=2, sticky="ew", pady=(4, 4))

        total_items = [
            ("Total DPS", "total_dps", fmt2, True),  # highlight
            ("Berserk DPS", "berserk", fmt2),
            ("Moonstone DPS", "moonstone", fmt2),
            ("Min DPS", "min_dps", fmt2),
            ("Max Burst DPS", "max_dps", fmt2),
        ]
        for i, item in enumerate(total_items, start=len(dps_items) + 1):
            if len(item) == 4:
                label, key, fmt, highlight = item
            else:
                label, key, fmt = item
                highlight = False
            result_row(dps_card, i, label, key, fmt, highlight_total=highlight)

        # Time to Kill card
        time_items = [
            ("Time taken to defeat Golem", "ttk_25k", fmt2),
            ("Time taken to defeat Asura", "ttk_75k", fmt2),
        ]
        for i, (label, key, fmt) in enumerate(time_items):
            result_row(time_card, i, label, key, fmt)

        # Active Traits (full width below cards)
        self._traits_var = tk.StringVar(master=self.root, value="")
        traits_frame = ttk.Labelframe(parent, text="Active Traits", padding=(8, 6))
        traits_frame.grid(row=row, column=0, columnspan=2, sticky="ew", padx=8, pady=4)
        traits_frame.columnconfigure(1, weight=1)
        ttk.Label(traits_frame, text="").grid(row=0, column=0, sticky="ne", padx=8, pady=4)
        self._traits_label = ttk.Label(traits_frame, textvariable=self._traits_var, wraplength=320, justify="left", foreground="#e0e0e0")
        self._traits_label.grid(row=0, column=1, sticky="nw", padx=8, pady=4)

        # Flatten for format lookup
        all_items = core_items + stats_items + dps_items + total_items + time_items
        self._result_formats = {key: fmt for item in all_items for label, key, fmt in [(item[0], item[1], item[2])]}

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
                label.configure(foreground="#cc0000" if at_cap else "#e0e0e0")
        self._traits_var.set(r.active_traits)

    def _build(self) -> Build:
        return Build(
            slots=(
                OreSlot(self._from_ui(self.ore_vars[0].get()), to_float(self.amount_vars[0].get())),
                OreSlot(self._from_ui(self.ore_vars[1].get()), to_float(self.amount_vars[1].get())),
                OreSlot(self._from_ui(self.ore_vars[2].get()), to_float(self.amount_vars[2].get())),
                OreSlot(self._from_ui(self.ore_vars[3].get()), to_float(self.amount_vars[3].get())),
            ),
            weapon_name=self._from_ui(self.weapon_var.get()),
            quality=min(to_float(self.quality_var.get()), 100),
            forge_level=int(to_float(self.enhancement_var.get())),
            race=self._from_ui(self.race_var.get()),
            bonus_weapon_type=self._from_ui(self.bonus_var.get()),
            rune_cells=(),
            base_crit_chance=0.0,
            base_crit_dmg=1.45,     # C21 workbook base crit damage
            armor_crit_chance=to_float(self.armor_cc_var.get()),
            armor_crit_dmg=to_float(self.armor_cd_var.get()),
            armor_lethality=to_float(self.armor_leth_var.get()),
            base_lethality=0.0,
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
            achievement=self._from_ui(self.achievement_var.get()),
        )

    # --- callbacks ---

    def _on_weapon_type_change(self, *_args):
        wtype = self.type_var.get()
        if wtype in (None, "", _WEAPON_ALL, self.game.none_label, _WEAPON_TYPE_PROMPT):
            names = [w.name for w in self.game.weapons]
        else:
            names = [w.name for w in self.game.weapons_by_type(wtype)]
        self.weapon_combo.set_values([_WEAPON_PROMPT] + sorted(names, key=str.lower))

    def _reset(self):
        """Restore calculator to default values (empty fields show 'Select X')."""
        for i, var in enumerate(self.ore_vars):
            var.set(_ORE_PROMPT)
        for var in self.amount_vars:
            var.set("0")
        self.type_var.set(_WEAPON_TYPE_PROMPT)
        self.weapon_var.set(_WEAPON_PROMPT)
        self.quality_var.set("100")
        self.enhancement_var.set("0")
        self.race_var.set(_RACE_PROMPT)
        self.bonus_var.set(_BONUS_PROMPT)
        self.armor_cc_var.set("0")
        self.armor_cd_var.set("0")
        self.armor_leth_var.set("0")
        self.berserk_var.set("0")
        for var in self.ability_vars.values():
            var.set("0")
        self.achievement_var.set(_ACHIEVEMENT_PROMPT)

    def _ore_values(self):
        names = [o.name for o in self.game.ores]
        return [_ORE_PROMPT] + sorted(names, key=str.lower)

    def _weapon_values(self):
        return [_WEAPON_PROMPT] + sorted([w.name for w in self.game.weapons], key=str.lower)

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
            "ores": [(self._from_ui(v.get()), self.amount_vars[i].get()) for i, v in enumerate(self.ore_vars)],
            "weapon_type": self._from_ui(self.type_var.get()),
            "weapon": self._from_ui(self.weapon_var.get()),
            "quality": self.quality_var.get(),
            "enhancement": self.enhancement_var.get(),
            "race": self._from_ui(self.race_var.get()),
            "bonus": self._from_ui(self.bonus_var.get()),
            "armor_cc": self.armor_cc_var.get(),
            "armor_cd": self.armor_cd_var.get(),
            "armor_leth": self.armor_leth_var.get(),
            "berserk": self.berserk_var.get(),
            "abilities": {k: v.get() for k, v in self.ability_vars.items()},
            "achievement": self._from_ui(self.achievement_var.get()),
        }

    def set_state(self, state: dict) -> None:
        state = state or {}

        valid_ores = {o.name for o in self.game.ores} | {self.game.select_ore}
        ores = state.get("ores")
        if isinstance(ores, list):
            for i, slot in enumerate(ores[:4]):
                if not isinstance(slot, (list, tuple)) or len(slot) != 2:
                    continue
                name, amount = slot
                if isinstance(name, str):
                    if name == self.game.none_label:
                        name = _ORE_PROMPT
                    if name in valid_ores:
                        self.ore_vars[i].set(name)
                if isinstance(amount, (int, float)):
                    amount = str(amount)
                if isinstance(amount, str):
                    self.amount_vars[i].set(amount)

        wtype = state.get("weapon_type")
        if isinstance(wtype, str):
            if wtype == self.game.none_label:
                wtype = _WEAPON_TYPE_PROMPT
            if wtype == _WEAPON_ALL or wtype in self.game.weapon_types:
                self.type_var.set(wtype)
        weapon = state.get("weapon")
        if isinstance(weapon, str):
            if weapon == self.game.none_label:
                weapon = _WEAPON_PROMPT
            if self.game.weapon(weapon) is not None:
                if wtype in (None, "", _WEAPON_ALL, _WEAPON_TYPE_PROMPT) or self.game.weapon(weapon).type == wtype:
                    self.weapon_var.set(weapon)

        for key, var in [
            ("quality", self.quality_var),
            ("armor_cc", self.armor_cc_var),
            ("armor_cd", self.armor_cd_var),
            ("armor_leth", self.armor_leth_var),
            ("berserk", self.berserk_var),
        ]:
            val = state.get(key)
            if isinstance(val, (int, float)):
                val = str(val)
            if isinstance(val, str):
                var.set(val)

        enhancement = state.get("enhancement")
        if isinstance(enhancement, str) and enhancement in {str(n) for n in range(10)}:
            self.enhancement_var.set(enhancement)

        race = state.get("race")
        if isinstance(race, str):
            if race == self.game.none_label:
                race = _RACE_PROMPT
            if self.game.race(race) is not None:
                self.race_var.set(race)
        bonus = state.get("bonus")
        if isinstance(bonus, str):
            if bonus == self.game.none_label:
                bonus = _BONUS_PROMPT
            if bonus in self.game.race_bonus_types:
                self.bonus_var.set(bonus)

        abilities = state.get("abilities")
        if isinstance(abilities, dict):
            for key, val in abilities.items():
                if key in self.ability_vars and isinstance(val, str):
                    self.ability_vars[key].set(val)

        achievement = state.get("achievement")
        if isinstance(achievement, str):
            if achievement == self.game.none_label:
                achievement = _ACHIEVEMENT_PROMPT
            if achievement in {a.name for a in self.game.achievements}:
                self.achievement_var.set(achievement)

        self._on_weapon_type_change()
