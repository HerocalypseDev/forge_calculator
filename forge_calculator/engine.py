"""The exact DPS engine, ported formula-for-formula from the workbook.

Every constant and formula below is cited to its source cell in the "DPS
Calculator" sheet (see ``all_formulas.txt``).  Nothing here is invented; the
engine reproduces the workbook's math exactly, including its quirks:

* procs scale on the unforged A18 while C84/C96 scale on the forged C18;
* fire/poison duration apply a ``-1`` / ``-2`` (C63 / C68);
* a fire/poison time input only matters when a fire/poison ore (or Dragonborn,
  for fire) is already present (the outer ``IF(MAX(...)=0,...)`` in C63/C68);
* C76's ``COUNTA`` counts "Select Ore" as a non-blank slot;
* the ability inputs are cross-wired in the workbook (E34/E35 blast, etc.).

Pure stdlib.  Never imports tkinter or openpyxl.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Mapping

from .data import GameData, Ore
from .parse import parse_trait

__all__ = [
    "OreSlot",
    "Abilities",
    "Build",
    "ProcComponents",
    "CalculateResult",
    "share_scaling",
    "slot_shares",
    "slot_power",
    "avg_ore_power",
    "forge_multiplier",
    "weapon_bases",
    "attack_rate",
    "rune_totals",
    "stat_totals",
    "proc_components",
    "crit_blend",
    "active_traits",
    "calculate",
    "FORGE_MULT",
    "CAPS",
]

# --------------------------------------------------------------------------
# constants (each cited to its formula cell)
# --------------------------------------------------------------------------

# The share-scaling gate and ramp: IF(share<0.1, 0, (base+(max-base)*MIN((share-0.1)/0.2,1))/div)
SHARE_GATE = 0.10
RAMP_TOP = 0.30
RAMP_SPAN = RAMP_TOP - SHARE_GATE  # 0.20

# C18 SWITCH(C13,0,1,1,1.05,...,9,1.5,1) -- level 9 = 1.5 breaks the 0.05/level
# pattern; any other level falls through to the SWITCH default of 1.
FORGE_MULT = {
    0: 1.0, 1: 1.05, 2: 1.1, 3: 1.15, 4: 1.2,
    5: 1.25, 6: 1.3, 7: 1.35, 8: 1.4, 9: 1.5,
}

# E44 race lethality addends (SWITCH in E44)
RACE_LETHALITY = {
    "Archangel": 0.20, "Demon": 0.20, "Orc": 0.10,
    "Shadow": 0.05, "Dragonborn": 0.12,
}
# E44 class lethality addends (IFS in E44) -- note SINGULAR "Gauntlet" (quirk)
CLASS_LETHALITY = {
    ("Felynx", "Gauntlet"): 0.20,
    ("Vampire", "Straight Sword"): 0.10,
}
# E47 race atk-speed addends (SWITCH in E47)
RACE_ATK_SPEED = {
    "Shadow": 0.10, "Demon": 0.20, "Archangel": 0.20,
}
# E47 class atk-speed addends (IFS in E47) -- note PLURAL "Gauntlets" (quirk)
CLASS_ATK_SPEED = {
    ("Goblin", "Dagger"): 0.10,
    ("Golem", "Colossal Sword"): 0.15,
    ("Golem", "Great Axe"): 0.15,
    ("Felynx", "Gauntlets"): 0.20,
}
# C61/C62/C63 Dragonborn fire bonuses
RACE_FIRE_DMG = {"Dragonborn": 0.30}
RACE_FIRE_CHANCE = {"Dragonborn": 0.40}
RACE_FIRE_TIME = {"Dragonborn": 3}
# C71/C72 smite bonuses (no ability inputs for smite)
RACE_SMITE_DMG = {"Angel": 0.30, "Archangel": 1.50}
RACE_SMITE_CHANCE = {"Angel": 0.50, "Archangel": 0.33}
# E53 berserk addend (Minotaur)
RACE_BERSERK = {"Minotaur": 0.30}

# E44/E45/E46/E47 caps
CAPS = {
    "lethality": 1.5,
    "crit_chance": 1.0,
    "crit_dmg": 1.0,
    "atk_speed": 1.5,
}

# K6-K9 active-trait power: MIN(MAX((share-0.1)*4.5+0.1, 0.1), 1)
TRAIT_POWER_SLOPE = 4.5
TRAIT_POWER_FLOOR = 0.1

_CORE_STATS = ("lethality", "crit_chance", "crit_dmg", "atk_speed")


# --------------------------------------------------------------------------
# build input dataclasses
# --------------------------------------------------------------------------


@dataclass(frozen=True)
class OreSlot:
    """One of the four ore slots (C6:D9).  ``amount`` is the D-column value."""
    name: str = "Select Ore"
    amount: float = 0.0


@dataclass(frozen=True)
class Abilities:
    """The 3x3 ability input grid (C34:E36 in the workbook).

    Blast has no time input.  The values are raw fractions: 3% -> 0.03.
    """
    fire_dmg: float = 0.0       # C34
    fire_chance: float = 0.0    # C35
    fire_time: float = 0.0      # C36
    poison_dmg: float = 0.0     # D34
    poison_chance: float = 0.0  # D35
    poison_time: float = 0.0    # D36
    blast_dmg: float = 0.0      # E34
    blast_chance: float = 0.0   # E35


@dataclass(frozen=True)
class Build:
    """A complete calculator configuration.  Cell references in docstrings."""
    slots: tuple = (OreSlot(), OreSlot(), OreSlot(), OreSlot())  # C6:C9 + D6:D9
    weapon_name: str = ""           # D12
    quality: float = 0.0            # E12 (percent: 100 -> 2x)
    forge_level: int = 0            # C13
    race: str = ""                  # C22
    bonus_weapon_type: str = ""     # C23
    rune_cells: tuple = ("None", "None", "None", "None", "None", "None")  # C27:D29
    base_crit_chance: float = 0.0   # C20
    base_crit_dmg: float = 0.0      # C21
    armor_crit_chance: float = 0.0  # C41
    armor_crit_dmg: float = 0.0     # C42
    armor_lethality: float = 0.0    # C43
    base_lethality: float = 0.0     # A44
    abilities: Abilities = Abilities()
    berserk: float = 0.0            # C53
    achievement: str = "None"       # C80


# --------------------------------------------------------------------------
# core math
# --------------------------------------------------------------------------


def share_scaling(base: float, max_: float, share: float, divisor: int = 100) -> float:
    """The single share-scaling term used by every stat path.

    Mirrors ``IF(share<0.1, 0, (base+(max-base)*MIN((share-0.1)/0.2, 1))/divisor)``:
    zero below the 10% gate, ``base`` at 10%, linear ramp to ``max`` at 30%,
    then clamped.  ``divisor`` is 100 (percent stats) or 1 (durations).
    """
    if share < SHARE_GATE:
        return 0.0
    value = base + (max_ - base) * min((share - SHARE_GATE) / RAMP_SPAN, 1.0)
    return value / divisor


def slot_shares(slots) -> tuple:
    """J6:J9 -- each slot's share of the total amount (0 when the total is 0)."""
    total = sum(s.amount for s in slots)
    if total == 0:
        return (0.0,) * len(slots)
    return tuple(s.amount / total for s in slots)


def slot_power(slot: OreSlot, game: GameData) -> float:
    """E6:E9 -- the ore-power multiplier for a slot.

    ``"Select Ore"`` and any ore missing from the catalog resolve to 1
    (E6's ``IF(C6="Select Ore",1, IFERROR(VLOOKUP(...),1))``).
    """
    if slot.name == game.select_ore:
        return 1.0
    ore = game.ore(slot.name)
    return ore.multiplier if ore is not None else 1.0


def avg_ore_power(slots, game: GameData) -> float:
    """E10 -- ``IFERROR(SUMPRODUCT(D6:D9,E6:E9)/SUM(D6:D9), AVERAGE(E6:E9))``.

    When the total amount is 0 the division is 0/0, so the fallback AVERAGE of
    the four powers applies (all "Select Ore" -> 1.0).
    """
    powers = [slot_power(s, game) for s in slots]
    total = sum(s.amount for s in slots)
    if total != 0:
        return sum(s.amount * p for s, p in zip(slots, powers)) / total
    return sum(powers) / len(powers) if powers else 0.0


def forge_multiplier(level: int) -> float:
    """C18 SWITCH -- falls through to the default 1 outside levels 0..9."""
    return FORGE_MULT.get(level, 1.0)


def weapon_bases(weapon, avg_power: float, quality: float, forge_level: int):
    """A18 (unforged) and C18 (forged) weapon damage.

    Both are ``damage * avg_power * (1 + quality/100)``; C18 additionally
    multiplies by the forge SWITCH.  A missing weapon resolves both to 1
    (the IFERROR fallback in A18/C18).
    """
    if weapon is None:
        return (1.0, 1.0)
    base = weapon.damage * avg_power * (1 + quality / 100.0)
    return (base, base * forge_multiplier(forge_level))


def attack_rate(weapon, atk_speed_total: float) -> float:
    """E21 -- ``(1+E47)/interval`` (C19 = interval, default 1 when missing)."""
    interval = weapon.interval if weapon is not None else 1.0
    return (1 + atk_speed_total) / interval


def rune_totals(rune_cells) -> Mapping[str, float]:
    """A27/A28/A29/A30-31 -- sum each rune's parsed stat across the 6 cells."""
    totals = {stat: 0.0 for stat in _CORE_STATS}
    for text in rune_cells:
        parsed = parse_trait(text)
        if parsed:
            totals[parsed[0]] += parsed[1]
    return totals


# --------------------------------------------------------------------------
# stat aggregation (E44-E47)
# --------------------------------------------------------------------------


def _ore_stat_sum(slots, shares, game: GameData, stat: str) -> float:
    """Sum the share-scaled contributions of a stat across the four slots.

    This is the per-slot ``IFS(C6=ore, IF(SUM=0,0, IF(share<0.1,0,...)))`` chain
    that feeds C44/C45/C46/C47/C52/C57/... -- shared by all stat paths.
    """
    total = 0.0
    for slot, share in zip(slots, shares):
        if share < SHARE_GATE or slot.name == game.select_ore:
            continue
        ore = game.ore(slot.name)
        if ore is None:
            continue
        rng = ore.stat(stat)
        if rng is None:
            continue
        total += share_scaling(rng.base, rng.max, share, rng.divisor)
    return total


def stat_totals(build: Build, game: GameData, ore_contribs: Mapping[str, float]) -> Mapping[str, float]:
    """E44-E47 -- the four capped stat totals.

    ``ore_contribs`` must be the C44/C45/C46/C47 sums (already including the
    C41/C42/C43 armor addends).  Caps: lethality 150%, CC 100%, CD 100%,
    AS 150%.
    """
    runes = rune_totals(build.rune_cells)
    ach = parse_trait(build.achievement)
    ach_stat = ach[0] if ach else None
    ach_value = ach[1] if ach else 0.0

    # C41/C42/C43 (armor inputs) are folded into C44/C45/C46, so they enter
    # the totals here exactly as the workbook wires them (+C41/+C42/+C43).
    lethality = (
        ore_contribs["lethality"]
        + build.armor_lethality
        + runes["lethality"]
        + build.base_lethality
        + RACE_LETHALITY.get(build.race, 0.0)
        + CLASS_LETHALITY.get((build.race, build.bonus_weapon_type), 0.0)
        + (ach_value if ach_stat == "lethality" else 0.0)
    )
    crit_chance = (
        ore_contribs["crit_chance"]
        + build.armor_crit_chance
        + runes["crit_chance"]
        + (ach_value if ach_stat == "crit_chance" else 0.0)
    )
    crit_dmg = ore_contribs["crit_dmg"] + build.armor_crit_dmg + runes["crit_dmg"]
    atk_speed = (
        ore_contribs["atk_speed"]
        + runes["atk_speed"]
        + RACE_ATK_SPEED.get(build.race, 0.0)
        + CLASS_ATK_SPEED.get((build.race, build.bonus_weapon_type), 0.0)
        + (ach_value if ach_stat == "atk_speed" else 0.0)
    )

    return {
        "lethality": min(lethality, CAPS["lethality"]),
        "crit_chance": min(crit_chance, CAPS["crit_chance"]),
        "crit_dmg": min(crit_dmg, CAPS["crit_dmg"]),
        "atk_speed": min(atk_speed, CAPS["atk_speed"]),
    }


# --------------------------------------------------------------------------
# proc components (C52-C76)
# --------------------------------------------------------------------------


@dataclass(frozen=True)
class ProcComponents:
    moon: float                  # C52
    explosion_dmg: float         # C57
    explosion_chance: float      # C58
    fire_dmg: float              # C61
    fire_chance: float           # C62
    fire_duration: float         # C63
    poison_dmg: float            # C66
    poison_chance: float         # C67
    poison_duration: float       # C68
    smite_dmg: float             # C71
    smite_chance: float          # C72
    blackhole_dmg: float         # C75
    blackhole_chance: float      # C76


def _duration(ore_terms, race_time: float, ability_time: float, minus: int) -> float:
    """C63/C68 duration: ``IF(MAX(ore,race)=0, 0, MAX(MAX(ore,race,ability)-N, 0))``.

    Quirk: the outer condition ignores the ability-time input, so a fire/poison
    time alone (no fire/poison ore, and for fire no Dragonborn) yields 0.
    """
    combined = max(ore_terms or [0.0]) + race_time
    if combined == 0:
        return 0.0
    top = max([*ore_terms, race_time, ability_time])
    return max(top - minus, 0.0)


def _blackhole_chance(slots, game: GameData) -> float:
    """C76 -- ``IF(COUNTIF(C6:C9,"Galaxite")/COUNTA(C6:C9)>=0.1, 0.3, 0)``.

    COUNTA counts every non-blank slot, and "Select Ore" is non-blank -- so in
    this app the denominator is always 4 and any Galaxite slot triggers 0.3.
    """
    galaxite = sum(1 for s in slots if s.name == "Galaxite")
    nonblank = sum(1 for s in slots if s.name)  # COUNTA: "Select Ore" counts
    if nonblank == 0:
        return 0.0
    return 0.3 if galaxite / nonblank >= 0.1 else 0.0


def proc_components(build: Build, shares, game: GameData) -> ProcComponents:
    """C52-C76 -- all proc magnitudes (fractions of weapon damage / seconds).

    These feed the DPS rows in C85-C89, which all scale on the UNFORGED A18.
    """

    def slot_vals(stat: str):
        vals = []
        for slot, share in zip(build.slots, shares):
            if share < SHARE_GATE or slot.name == game.select_ore:
                continue
            ore = game.ore(slot.name)
            if ore is None:
                continue
            rng = ore.stat(stat)
            if rng is None:
                continue
            vals.append(share_scaling(rng.base, rng.max, share, rng.divisor))
        return vals

    def slot_max(stat: str) -> float:
        vals = slot_vals(stat)
        return max(vals) if vals else 0.0

    def slot_sum(stat: str) -> float:
        return sum(slot_vals(stat))

    fire_terms = slot_vals("fire_duration")
    poison_terms = slot_vals("poison_duration")

    return ProcComponents(
        moon=slot_sum("moon"),
        explosion_dmg=slot_sum("explosion_dmg") + build.abilities.blast_dmg,  # +E34
        explosion_chance=max(slot_max("explosion_chance"), build.abilities.blast_chance),  # MAX(...,E35)
        fire_dmg=slot_sum("fire_dmg") + RACE_FIRE_DMG.get(build.race, 0.0) + build.abilities.fire_dmg,  # +C34
        fire_chance=max(slot_max("fire_chance"), build.abilities.fire_chance) + RACE_FIRE_CHANCE.get(build.race, 0.0),  # MAX(...,C35)+0.4
        fire_duration=_duration(fire_terms, RACE_FIRE_TIME.get(build.race, 0), build.abilities.fire_time, minus=1),
        poison_dmg=slot_sum("poison_dmg") + build.abilities.poison_dmg,  # +D34
        poison_chance=max(slot_max("poison_chance"), build.abilities.poison_chance),  # MAX(...,D35)
        poison_duration=_duration(poison_terms, 0, build.abilities.poison_time, minus=2),
        smite_dmg=slot_sum("smite_dmg") + RACE_SMITE_DMG.get(build.race, 0.0),
        smite_chance=max(slot_max("smite_chance"), RACE_SMITE_CHANCE.get(build.race, 0.0)),
        blackhole_dmg=slot_sum("blackhole_dmg"),
        blackhole_chance=_blackhole_chance(build.slots, game),
    )


def crit_blend(cc_total: float, cd_total: float) -> float:
    """The crit multiplier: ``MIN(cc,1)*cd + (1-MIN(cc,1))`` (part of C84)."""
    cc = min(cc_total, 1.0)
    return cc * cd_total + (1 - cc)


# --------------------------------------------------------------------------
# DPS pipeline (C84-C96, E91-E92)
# --------------------------------------------------------------------------


def active_traits(build: Build, shares, game: GameData) -> str:
    """C14 -- the joined active weapon-trait text ("No active weapon traits")."""
    parts = []
    for slot, share in zip(build.slots, shares):
        if slot.name == game.select_ore or share < SHARE_GATE:
            continue
        ore = game.ore(slot.name)
        if ore is None or not ore.is_weapon:
            continue
        power = min(max((share - SHARE_GATE) * TRAIT_POWER_SLOPE + TRAIT_POWER_FLOOR, TRAIT_POWER_FLOOR), 1.0)
        if share >= 0.3:
            text = ore.trait30 or ""
        else:
            text = f"[{power * 100:.1f}% power] {ore.trait10 or ''}"
        if text:
            parts.append(text)
    return " | ".join(parts) if parts else "No active weapon traits"


@dataclass(frozen=True)
class CalculateResult:
    avg_power: float              # E10
    unforged_damage: float        # A18
    forged_damage: float          # C18
    interval: float               # C19
    attack_rate: float            # E21
    lethality: float              # E44
    crit_chance: float            # E45
    crit_dmg: float               # E46
    atk_speed: float              # E47
    crit_blend: float
    moon: float                   # C52
    explosion_dmg: float          # C57
    explosion_chance: float       # C58
    fire_dmg: float               # C61
    fire_chance: float            # C62
    fire_duration: float          # C63
    poison_dmg: float             # C66
    poison_chance: float          # C67
    poison_duration: float        # C68
    smite_dmg: float              # C71
    smite_chance: float           # C72
    blackhole_dmg: float          # C75
    blackhole_chance: float       # C76
    weapon_dps: float             # C84
    explosion_dps: float          # C85
    fire_dps: float               # C86
    poison_dps: float             # C87
    smite_dps: float              # C88
    blackhole_dps: float          # C89
    total_dps: float              # C91
    berserk: float | None         # C92 (None -> "N/A")
    moonstone: float | None       # C93 (None -> "N/A")
    min_dps: float                # C95
    max_dps: float                # C96
    ttk_25k: float | None         # E91 (None -> "∞")
    ttk_75k: float | None         # E92 (None -> "∞")
    active_traits: str            # C14


def calculate(build: Build, game: GameData) -> CalculateResult:
    """Run the full DPS pipeline for a build."""
    shares = slot_shares(build.slots)
    avg_power = avg_ore_power(build.slots, game)
    weapon = game.weapon(build.weapon_name)
    unforged, forged = weapon_bases(weapon, avg_power, build.quality, build.forge_level)
    interval = weapon.interval if weapon is not None else 1.0

    ore_contribs = {
        stat: _ore_stat_sum(build.slots, shares, game, stat) for stat in _CORE_STATS
    }
    totals = stat_totals(build, game, ore_contribs)
    atk_rate = attack_rate(weapon, totals["atk_speed"])

    blend = crit_blend(
        build.base_crit_chance + totals["crit_chance"],
        build.base_crit_dmg + totals["crit_dmg"],
    )
    procs = proc_components(build, shares, game)

    # C84-C89
    weapon_dps = forged * (1 + totals["lethality"]) * blend * atk_rate
    explosion_dps = unforged * procs.explosion_dmg * procs.explosion_chance * atk_rate
    fire_dps = (
        unforged * procs.fire_dmg * min(1, procs.fire_chance * atk_rate * min(procs.fire_duration, 5))
        if atk_rate else 0.0
    )
    poison_dps = (
        unforged * procs.poison_dmg * min(1, procs.poison_chance * atk_rate * min(procs.poison_duration, 5))
        if atk_rate else 0.0
    )
    smite_dps = unforged * atk_rate * procs.smite_dmg * min(procs.smite_chance, 1)
    blackhole_dps = unforged * procs.blackhole_dmg * procs.blackhole_chance * atk_rate
    total = weapon_dps + explosion_dps + fire_dps + poison_dps + smite_dps + blackhole_dps

    # C92 berserk: E53 = C53 + Minotaur 30%
    berserk_level = build.berserk + RACE_BERSERK.get(build.race, 0.0)
    if berserk_level == 0:
        berserk = None
    else:
        leth_boosted = min(totals["lethality"] + berserk_level, CAPS["lethality"])
        berserk = (
            explosion_dps + fire_dps + poison_dps + smite_dps + blackhole_dps
            + forged * (1 + leth_boosted) * blend * atk_rate
        )

    # C93 moonstone: E52 = 1+C52, applied to the weapon DPS only
    moonstone = weapon_dps * (1 + procs.moon) if procs.moon != 0 else None

    # C95 min / C96 max-burst (procs on FORGED C18 -- preserved quirk)
    min_dps = forged * (1 + totals["lethality"]) * atk_rate
    max_dps = (
        forged * (1 + totals["lethality"]) * (build.base_crit_dmg + totals["crit_dmg"]) * atk_rate
        + forged * procs.explosion_dmg * atk_rate
        + forged * procs.fire_dmg
        + forged * procs.poison_dmg
        + procs.smite_dmg * forged
        + procs.blackhole_dmg * forged
    )

    # E91/E92 TTK
    ttk_25k = 25000 / total if total > 0 else None
    ttk_75k = 75000 / total if total > 0 else None

    return CalculateResult(
        avg_power=avg_power,
        unforged_damage=unforged,
        forged_damage=forged,
        interval=interval,
        attack_rate=atk_rate,
        lethality=totals["lethality"],
        crit_chance=totals["crit_chance"],
        crit_dmg=totals["crit_dmg"],
        atk_speed=totals["atk_speed"],
        crit_blend=blend,
        moon=procs.moon,
        explosion_dmg=procs.explosion_dmg,
        explosion_chance=procs.explosion_chance,
        fire_dmg=procs.fire_dmg,
        fire_chance=procs.fire_chance,
        fire_duration=procs.fire_duration,
        poison_dmg=procs.poison_dmg,
        poison_chance=procs.poison_chance,
        poison_duration=procs.poison_duration,
        smite_dmg=procs.smite_dmg,
        smite_chance=procs.smite_chance,
        blackhole_dmg=procs.blackhole_dmg,
        blackhole_chance=procs.blackhole_chance,
        weapon_dps=weapon_dps,
        explosion_dps=explosion_dps,
        fire_dps=fire_dps,
        poison_dps=poison_dps,
        smite_dps=smite_dps,
        blackhole_dps=blackhole_dps,
        total_dps=total,
        berserk=berserk,
        moonstone=moonstone,
        min_dps=min_dps,
        max_dps=max_dps,
        ttk_25k=ttk_25k,
        ttk_75k=ttk_75k,
        active_traits=active_traits(build, shares, game),
    )
