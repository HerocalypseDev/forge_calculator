"""DPS engine, ported cell-for-cell from the workbook's "DPS Calculator" sheet.

The workbook in ``reference/UpdatedSpreadsheet.xlsx`` follows the game's own code
(the .rbxlx): procs scale on the unforged A18 while the physical hit and Max Burst
use the forged C18, proc chances roll on integers ``(INT(chance%)+1)/101``,
cooldown procs fire at ``1/(cd + 1/(chance*rate))``, and berserk adds to the
lethality pool.

The ability grid is row-per-ability: Fire 34, Poison 35, Lightning 36, Blast 37,
with DMG/Chance/Time in columns C/D/E (Blast has no time).

Pure stdlib -- no tkinter, no openpyxl.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Mapping

from .data import GameData, Ore
from .parse import parse_trait

__all__ = [
    "OreSlot",
    "Abilities",
    "Golemite",
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
    "game_chance",
    "dot_uptime",
    "cooldown_rate",
    "ore_share",
    "golemite_damage",
    "FORGE_MULT",
    "CAPS",
]


SHARE_GATE = 0.10
RAMP_TOP = 0.30
RAMP_SPAN = RAMP_TOP - SHARE_GATE

FORGE_MULT = {
    0: 1.0, 1: 1.05, 2: 1.1, 3: 1.15, 4: 1.2,
    5: 1.25, 6: 1.3, 7: 1.35, 8: 1.4, 9: 1.5,
}

RACE_LETHALITY = {
    "Archangel": 0.20, "Demon": 0.20, "Orc": 0.10,
    "Shadow": 0.05, "Dragonborn": 0.12, "Orc Lord": 0.40, "Fallen Angel": 0.20,
}
CLASS_LETHALITY = {
    ("Felynx", "Gauntlet"): 0.20,
    ("Felynx", "Gauntlets"): 0.20,
    ("Vampire", "Straight Sword"): 0.10,
    ("Imp", "Spear"): 0.25,
}
RACE_ATK_SPEED = {"Shadow": 0.10, "Demon": 0.20, "Archangel": 0.20, "Fallen Angel": 0.10}
CLASS_ATK_SPEED = {
    ("Goblin", "Dagger"): 0.10,
    ("Golem", "Colossal Sword"): 0.15,
    ("Golem", "Great Axe"): 0.15,
    ("Felynx", "Gauntlet"): 0.20,
    ("Felynx", "Gauntlets"): 0.20,
    ("Imp", "Spear"): 0.20,
}
UNCAPPED_RACE_LETHALITY = {"Kitsune": 0.20}
UNCAPPED_CLASS_LETHALITY = {("Fairy", "Spear"): 0.15}
UNCAPPED_RACE_ATK_SPEED = {"Kitsune": 0.20}
UNCAPPED_CLASS_ATK_SPEED = {("Fairy", "Spear"): 0.15}
UNCAPPED_RACE_CRIT_DMG = {"Kitsune": 0.15}
DRYAD_GROVE_CRIT_CHANCE = 0.15
DRYAD_GROVE_CRIT_DMG = 0.15
DRYAD_VITAL_POWER_STEP_HP = 1000
DRYAD_VITAL_POWER_PER_STEP = 0.05
DRYAD_VITAL_POWER_MAX_STEPS = 10
ORC_LORD_WARBRINGER_PER_TENTH = 0.075
ORC_LORD_LORD_OF_WAR_PER_STACK = 0.075
ORC_LORD_LORD_OF_WAR_MAX_STACKS = 5

RACE_FIRE_DMG = {"Dragonborn": 0.30, "Demon": 0.20}
RACE_FIRE_CHANCE = {"Dragonborn": 0.40}
RACE_FIRE_TIME = {"Dragonborn": 3.0, "Demon": 3.0}
RACE_SMITE_DMG = {"Angel": 0.30}
RACE_SMITE_CHANCE = {"Angel": 0.50}
RACE_BERSERK = {"Minotaur": 0.30, "Fallen Angel": 0.30}
RACE_SMASH_DMG = {"Orc Lord": 1.0}
RACE_SMASH_COOLDOWN = {"Orc Lord": 10.0}
RACE_SMASH_CHANCE = {"Orc Lord": 0.25}
RACE_FOX_CLAWS_DMG = {"Kitsune": 0.75}
RACE_FOX_CLAWS_CHANCE = {"Kitsune": 0.25}
FOX_CLAWS_SPIRITS = 3
FOX_CLAWS_SPIRIT_TIME = 2.22
RACE_FOXFIRE_DMG = {"Kitsune": 0.3}
RACE_FOXFIRE_CHANCE = {"Kitsune": 0.5}
RACE_FOXFIRE_TIME = {"Kitsune": 3.0}
ARCHANGEL_SMITE_DMG = 1.5
ARCHANGEL_SMITE_CHANCE = 0.33
ARCHANGEL_SMITE_COOLDOWN = 10.0
DEMON_CURSED_AURA_DMG = 0.1
RACE_DARK_SMITE_DMG = {"Fallen Angel": 0.35}
RACE_DARK_SMITE_CHANCE = {"Fallen Angel": 0.3}
TRIDENT_TOSS = {("Imp", "Spear"): (1.2, 1.0, 8.0)}
REVERBERATION_ORE = "Echotite"
REVERBERATION_CHANCE = {"Dagger": 0.20, "Straight Sword": 0.16, "Gauntlet": 0.12}
REVERBERATION_DEFAULT_CHANCE = 0.08
STARFALL_GALAXITE_MULT = 225 / 125
STELLAR_MARK_HITS = 5

EXPLOSION_DMG_CAP = 2.5
SMITE_DMG_CAP = 2.5
MOON_CAP = 1.5
FIRE_TIME_RANGE = (1.0, 5.0)
POISON_TIME_RANGE = (1.0, 15.0)
DEFAULT_LIGHTNING_COOLDOWN = 10.0
BLACKHOLE_CHANCE = 0.3
BLACKHOLE_COOLDOWN = 1.0
GALAXITE_BISMUTH_WAVE = 1.25
PROC_ROLL_SIDES = 101
GOLEMITE_MIN_LEVEL = 13
GOLEMITE_MAX_LEVEL = 25
GOLEMITE_BASE_DMG = 0.02
GOLEMITE_DMG_RAMP = 0.04
GOLEMITE_RAMP_LEVELS = 12
GOLEMITE_HITS_PER_SECOND = 0.66666666666666

AVG_POWER_EXCLUDED = ("Fichilliumorite", "Bismuth")
SOLO_ORE_POWER = {"Bismuth": 8.0, "Fichilliumorite": 1.0}

CAPS = {
    "lethality": 3.0,
    "crit_chance": 1.0,
    "crit_dmg": 1.0,
    "atk_speed": 1.5,
    "berserk": 2.0,
}

TRAIT_POWER_SLOPE = 4.5
TRAIT_POWER_FLOOR = 0.1

_CORE_STATS = ("lethality", "crit_chance", "crit_dmg", "atk_speed")


@dataclass(frozen=True)
class OreSlot:
    """One of the four ore slots (C6:D9).  ``amount`` is the D-column value."""
    name: str = "Select Ore"
    amount: float = 0.0


@dataclass(frozen=True)
class Abilities:
    """The rune ability grid, C34:E37 in the workbook.

    One row per ability -- Fire 34, Poison 35, Lightning 36, Blast 37 -- with
    DMG in column C, proc chance in D and time/cooldown in E.  Blast has no time
    input.  The values are raw fractions: 3% -> 0.03; times are plain seconds.
    """
    fire_dmg: float = 0.0
    fire_chance: float = 0.0
    fire_time: float = 0.0
    poison_dmg: float = 0.0
    poison_chance: float = 0.0
    poison_time: float = 0.0
    lightning_dmg: float = 0.0
    lightning_chance: float = 0.0
    lightning_cooldown: float = 0.0
    blast_dmg: float = 0.0
    blast_chance: float = 0.0


@dataclass(frozen=True)
class Golemite:
    level: float = 0.0
    fire_dmg: float = 0.0
    fire_chance: float = 0.0
    fire_time: float = 0.0
    poison_dmg: float = 0.0
    poison_chance: float = 0.0
    poison_time: float = 0.0
    lightning_dmg: float = 0.0
    lightning_chance: float = 0.0
    lightning_cooldown: float = 0.0
    blast_dmg: float = 0.0
    blast_chance: float = 0.0
    smite_dmg: float = 0.0
    smite_chance: float = 0.0
    blackhole_dmg: float = 0.0
    blackhole_chance: float = 0.0
    resonance_dmg: float = 0.0
    moon: float = 0.0
    lethality: float = 0.0
    crit_chance: float = 0.0
    crit_dmg: float = 0.0
    atk_speed: float = 0.0


@dataclass(frozen=True)
class Build:
    """A build configuration (workbook input cells)."""
    slots: tuple = (OreSlot(), OreSlot(), OreSlot(), OreSlot())
    weapon_name: str = ""
    quality: float = 0.0
    forge_level: int = 0
    race: str = ""
    bonus_weapon_type: str = ""
    rune_cells: tuple = ("None",) * 9
    base_crit_chance: float = 0.0
    base_crit_dmg: float = 1.45
    armor_crit_chance: float = 0.0
    armor_crit_dmg: float = 0.0
    armor_lethality: float = 0.0
    base_lethality: float = 0.0
    abilities: Abilities = Abilities()
    berserk: float = 0.0
    achievement: str = "None"
    dryad_in_grove: bool = False
    dryad_max_hp: float = 0.0
    orc_lord_hp_missing: float = 0.0
    orc_lord_kill_stacks: float = 0.0
    golemites: tuple = (Golemite(), Golemite())




def share_scaling(
    base: float,
    max_: float,
    share: float,
    divisor: int = 100,
    gated: bool = True,
    floor: float | None = None,
    ceiling: float | None = None,
) -> float:
    """``IF(share<0.1, 0, (base+(max-base)*MIN((share-0.1)/0.2, 1))/divisor)``.

    Zero below the 10% gate, ``base`` at 10%, linear ramp to ``max`` at 30%,
    then clamped.  ``divisor`` is 100 for percent stats, 1 for durations.

    ``gated=False`` drops the 10% guard, so the ramp is evaluated at any share --
    it goes negative below 10%, which is why the only ungated stat also carries a
    clamp.  ``floor``/``ceiling`` apply the cell's ``MAX(f, MIN(c, ramp))`` after
    the divisor (Kitsunite smite damage: never under 5%, never over 50%).
    """
    if gated and share < SHARE_GATE:
        return 0.0
    value = base + (max_ - base) * min((share - SHARE_GATE) / RAMP_SPAN, 1.0)
    value /= divisor
    if ceiling is not None:
        value = min(ceiling, value)
    if floor is not None:
        value = max(floor, value)
    return value


def scale_range(rng, share: float) -> float:
    """``share_scaling`` for a :class:`StatRange`, honouring its modifiers."""
    return share_scaling(
        rng.base, rng.max, share, rng.divisor,
        gated=rng.gated, floor=rng.floor, ceiling=rng.ceiling,
    )


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
    """E10 -- the weighted average ore power, excluding Fichilliumorite and Bismuth.

    A build of nothing but Bismuth is a flat 8 and nothing but Fichilliumorite a
    flat 1.  Otherwise Fichilliumorite, Bismuth, "Select Ore" and blank slots drop
    out of both the numerator and the denominator, so they never dilute the
    average.  When the remaining total amount is
    0 the division is 0/0 and the AVERAGEIFS fallback applies; with nothing left
    at all the outer IFERROR yields 1.
    """
    filled = [s.name for s in slots if s.name and s.name != game.select_ore]
    for name, power in SOLO_ORE_POWER.items():
        if name in filled and all(n == name for n in filled):
            return power
    kept = [s for s in slots if s.name and s.name != game.select_ore and s.name not in AVG_POWER_EXCLUDED]
    powers = [slot_power(s, game) for s in kept]
    total = sum(s.amount for s in kept)
    if total != 0:
        return sum(s.amount * p for s, p in zip(kept, powers)) / total
    return sum(powers) / len(powers) if powers else 1.0


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
    """A27/A28/A29/A31 -- sum each rune's parsed stat across the 9 grid cells."""
    totals = {stat: 0.0 for stat in _CORE_STATS}
    for text in rune_cells:
        parsed = parse_trait(text)
        if parsed:
            totals[parsed[0]] += parsed[1]
    return totals




def _ore_stat_sum(slots, shares, game: GameData, stat: str) -> float:
    """Sum one stat's share-scaled contributions across the four slots.

    Shared by every stat path that feeds C44..C75.  Skips "Select Ore",
    sub-10% shares, and ores that don't grant the stat.
    """
    total = 0.0
    for slot, share in zip(slots, shares):
        if slot.name == game.select_ore:
            continue
        ore = game.ore(slot.name)
        if ore is None:
            continue
        rng = ore.stat(stat)
        if rng is None:
            continue
        if rng.gated and share < SHARE_GATE:
            continue
        total += scale_range(rng, share)
    return total


def ore_share(slots, shares, name: str) -> float:
    """``SUMIF(C6:C9, name, D6:D9) / SUM(D6:D9)`` -- every slot of one ore combined."""
    return sum(share for slot, share in zip(slots, shares) if slot.name == name)


def _round_half_up(value: float, digits: int) -> float:
    scale = 10 ** digits
    return math.floor(abs(value) * scale + 0.5) / scale * (1 if value >= 0 else -1)


def game_chance(chance: float, exists: bool) -> float:
    """``IF(exists, MIN(1, (INT(ROUND(chance*100, 2))+1)/101), 0)`` -- the game's integer roll."""
    if not exists:
        return 0.0
    return min(1.0, (math.floor(_round_half_up(chance * 100, 2)) + 1) / PROC_ROLL_SIDES)


def golemite_sum(build: Build, field: str) -> float:
    return sum(getattr(g, field) for g in build.golemites)


def golemite_values(build: Build, field: str) -> list:
    return [getattr(g, field) for g in build.golemites]


def golemite_damage(level: float, unforged: float) -> float:
    if level < GOLEMITE_MIN_LEVEL:
        return 0.0
    steps = min(GOLEMITE_MAX_LEVEL, level) - GOLEMITE_MIN_LEVEL
    return unforged * (GOLEMITE_BASE_DMG + steps * (GOLEMITE_DMG_RAMP / GOLEMITE_RAMP_LEVELS))


def trait_damage_multiplier(build: Build) -> float:
    """Dryad Vital Power: +5% fire/poison/lightning/black-hole damage per 1,000 max HP, max +50%."""
    if build.race != "Dryad":
        return 1.0
    steps = min(math.floor(max(0.0, build.dryad_max_hp) / DRYAD_VITAL_POWER_STEP_HP), DRYAD_VITAL_POWER_MAX_STEPS)
    return 1.0 + steps * DRYAD_VITAL_POWER_PER_STEP


def stat_totals(build: Build, game: GameData, ore_contribs: Mapping[str, float]) -> Mapping[str, float]:
    """E45-E48: the item/race-trait pool is capped, Kitsune / Fairy / Dryad / Orc Lord race tags add after."""
    runes = rune_totals(build.rune_cells)
    ach = parse_trait(build.achievement)
    ach_stat = ach[0] if ach else None
    ach_value = ach[1] if ach else 0.0
    race, cls = build.race, (build.race, build.bonus_weapon_type)
    in_grove = race == "Dryad" and build.dryad_in_grove

    lethality = (
        ore_contribs["lethality"]
        + build.armor_lethality
        + golemite_sum(build, "lethality")
        + runes["lethality"]
        + build.base_lethality
        + RACE_LETHALITY.get(race, 0.0)
        + CLASS_LETHALITY.get(cls, 0.0)
        + (ach_value if ach_stat == "lethality" else 0.0)
    )
    warbringer = 0.0
    if race == "Orc Lord":
        missing = min(1.0, max(0.0, build.orc_lord_hp_missing))
        warbringer = math.floor(missing * 10 + 1e-6) * ORC_LORD_WARBRINGER_PER_TENTH
    crit_chance = (
        ore_contribs["crit_chance"]
        + build.armor_crit_chance
        + golemite_sum(build, "crit_chance")
        + runes["crit_chance"]
        + (ach_value if ach_stat == "crit_chance" else 0.0)
    )
    crit_dmg = ore_contribs["crit_dmg"] + build.armor_crit_dmg + golemite_sum(build, "crit_dmg") + runes["crit_dmg"]
    atk_speed = (
        ore_contribs["atk_speed"]
        + golemite_sum(build, "atk_speed")
        + runes["atk_speed"]
        + RACE_ATK_SPEED.get(race, 0.0)
        + CLASS_ATK_SPEED.get(cls, 0.0)
        + (ach_value if ach_stat == "atk_speed" else 0.0)
    )
    lord_of_war = 0.0
    if race == "Orc Lord":
        stacks = min(ORC_LORD_LORD_OF_WAR_MAX_STACKS, max(0, math.floor(build.orc_lord_kill_stacks)))
        lord_of_war = stacks * ORC_LORD_LORD_OF_WAR_PER_STACK

    return {
        "lethality": min(lethality, CAPS["lethality"])
        + UNCAPPED_RACE_LETHALITY.get(race, 0.0)
        + UNCAPPED_CLASS_LETHALITY.get(cls, 0.0)
        + warbringer,
        "crit_chance": min(crit_chance, CAPS["crit_chance"]) + (DRYAD_GROVE_CRIT_CHANCE if in_grove else 0.0),
        "crit_dmg": min(crit_dmg, CAPS["crit_dmg"])
        + UNCAPPED_RACE_CRIT_DMG.get(race, 0.0)
        + (DRYAD_GROVE_CRIT_DMG if in_grove else 0.0),
        "atk_speed": min(atk_speed, CAPS["atk_speed"])
        + UNCAPPED_RACE_ATK_SPEED.get(race, 0.0)
        + UNCAPPED_CLASS_ATK_SPEED.get(cls, 0.0)
        + lord_of_war,
    }


@dataclass(frozen=True)
class ProcComponents:
    moon: float
    explosion_dmg: float
    explosion_chance: float
    fire_dmg: float
    fire_chance: float
    fire_duration: float
    poison_dmg: float
    poison_chance: float
    poison_duration: float
    smite_dmg: float
    smite_chance: float
    blackhole_dmg: float
    blackhole_chance: float
    lightning_dmg: float
    lightning_cooldown: float
    lightning_chance: float
    smash_dmg: float = 0.0
    smash_cooldown: float = 0.0
    smash_chance: float = 0.0
    fox_claws_dmg: float = 0.0
    fox_claws_chance: float = 0.0
    foxfire_dmg: float = 0.0
    foxfire_chance: float = 0.0
    foxfire_duration: float = 0.0
    reverberation_chance: float = 0.0
    frost_slash_dmg: float = 0.0
    frost_slash_chance: float = 0.0
    glacier_dmg: float = 0.0
    glacier_chance: float = 0.0
    starfall_dmg: float = 0.0
    starfall_chance: float = 0.0
    starfall_cooldown: float = 0.0
    stellar_mark_dmg: float = 0.0
    stellar_mark_hits: float = 0.0
    ancient_poison_dmg: float = 0.0
    ancient_poison_chance: float = 0.0
    ancient_poison_duration: float = 0.0


def _dot_duration(dmg: float, terms, time_range) -> float:
    """C64/C69: no DoT -> 0; otherwise the longest duration clamped to the game's range (default 1 s)."""
    if dmg <= 0:
        return 0.0
    low, high = time_range
    return min(high, max(low, max([0.0, *terms])))


def proc_components(build: Build, shares, game: GameData, atk_rate: float = 0.0) -> ProcComponents:
    """C53-C94 -- proc magnitudes (fractions of weapon damage / seconds)."""

    def slot_vals(stat: str):
        vals = []
        for slot, share in zip(build.slots, shares):
            if slot.name == game.select_ore:
                continue
            ore = game.ore(slot.name)
            if ore is None:
                continue
            rng = ore.stat(stat)
            if rng is None:
                continue
            if rng.gated and share < SHARE_GATE:
                continue
            vals.append(scale_range(rng, share))
        return vals

    def slot_max(stat: str) -> float:
        vals = slot_vals(stat)
        return max(vals) if vals else 0.0

    def slot_sum(stat: str) -> float:
        return sum(slot_vals(stat))

    ab = build.abilities
    race = build.race
    names = [slot.name for slot in build.slots]
    resonance = 0.0
    if "Galaxite" in names or any(v > 0 for v in golemite_values(build, "blackhole_dmg")):
        resonance = golemite_sum(build, "resonance_dmg") + (GALAXITE_BISMUTH_WAVE if "Bismuth" in names else 0.0)
    galaxite_amount = sum(slot.amount for slot in build.slots if slot.name == "Galaxite")

    fire_dmg = slot_sum("fire_dmg") + RACE_FIRE_DMG.get(race, 0.0) + ab.fire_dmg + golemite_sum(build, "fire_dmg")
    poison_dmg = slot_sum("poison_dmg") + ab.poison_dmg + golemite_sum(build, "poison_dmg")
    lightning_dmg = slot_sum("lightning_dmg") + ab.lightning_dmg + golemite_sum(build, "lightning_dmg")
    cooldowns = slot_vals("lightning_cooldown") + ([ab.lightning_cooldown] if ab.lightning_cooldown else [])
    golemite_cooldowns = [cd for cd in golemite_values(build, "lightning_cooldown") if cd]
    if lightning_dmg <= 0:
        lightning_cooldown = 0.0
    elif not cooldowns:
        lightning_cooldown = DEFAULT_LIGHTNING_COOLDOWN
    else:
        lightning_cooldown = min(cooldowns + golemite_cooldowns)

    reverberation = 0.0
    if sum(slot.amount for slot in build.slots) != 0:
        for slot, share in zip(build.slots, shares):
            if slot.name == REVERBERATION_ORE and share >= SHARE_GATE:
                reverberation = max(reverberation, REVERBERATION_CHANCE.get(build.bonus_weapon_type, REVERBERATION_DEFAULT_CHANCE))
    starfall_dmg = slot_sum("starfall_dmg")
    starfall_cooldowns = slot_vals("starfall_cooldown")
    stellar_mark_dmg = slot_sum("stellar_mark_dmg")

    return ProcComponents(
        moon=min(MOON_CAP, slot_sum("moon")) + golemite_sum(build, "moon"),
        explosion_dmg=min(EXPLOSION_DMG_CAP, slot_sum("explosion_dmg") + ab.blast_dmg + golemite_sum(build, "blast_dmg")),
        explosion_chance=max(slot_max("explosion_chance"), ab.blast_chance, *golemite_values(build, "blast_chance")),
        fire_dmg=fire_dmg,
        fire_chance=max(slot_max("fire_chance"), ab.fire_chance, RACE_FIRE_CHANCE.get(race, 0.0),
                        *golemite_values(build, "fire_chance")),
        fire_duration=_dot_duration(
            fire_dmg,
            slot_vals("fire_duration") + [RACE_FIRE_TIME.get(race, 0.0), ab.fire_time, *golemite_values(build, "fire_time")],
            FIRE_TIME_RANGE),
        poison_dmg=poison_dmg,
        poison_chance=max(slot_max("poison_chance"), ab.poison_chance, *golemite_values(build, "poison_chance")),
        poison_duration=_dot_duration(
            poison_dmg, slot_vals("poison_duration") + [ab.poison_time, *golemite_values(build, "poison_time")],
            POISON_TIME_RANGE),
        smite_dmg=min(SMITE_DMG_CAP, slot_sum("smite_dmg") + RACE_SMITE_DMG.get(race, 0.0)) + golemite_sum(build, "smite_dmg"),
        smite_chance=max(slot_max("smite_chance"), RACE_SMITE_CHANCE.get(race, 0.0), *golemite_values(build, "smite_chance")),
        blackhole_dmg=slot_sum("blackhole_dmg") + resonance + golemite_sum(build, "blackhole_dmg"),
        blackhole_chance=max(BLACKHOLE_CHANCE if galaxite_amount > 0 else 0.0, *golemite_values(build, "blackhole_chance")),
        lightning_dmg=lightning_dmg,
        lightning_cooldown=lightning_cooldown,
        lightning_chance=max(slot_max("lightning_chance"), ab.lightning_chance, *golemite_values(build, "lightning_chance")),
        smash_dmg=RACE_SMASH_DMG.get(race, 0.0),
        smash_cooldown=RACE_SMASH_COOLDOWN.get(race, 0.0),
        smash_chance=RACE_SMASH_CHANCE.get(race, 0.0),
        fox_claws_dmg=RACE_FOX_CLAWS_DMG.get(race, 0.0),
        fox_claws_chance=RACE_FOX_CLAWS_CHANCE.get(race, 0.0),
        foxfire_dmg=RACE_FOXFIRE_DMG.get(race, 0.0),
        foxfire_chance=RACE_FOXFIRE_CHANCE.get(race, 0.0),
        foxfire_duration=RACE_FOXFIRE_TIME.get(race, 0.0),
        reverberation_chance=reverberation,
        frost_slash_dmg=slot_sum("frost_slash_dmg"),
        frost_slash_chance=slot_max("frost_slash_chance"),
        glacier_dmg=slot_sum("glacier_dmg"),
        glacier_chance=slot_max("glacier_chance"),
        starfall_dmg=starfall_dmg,
        starfall_chance=slot_max("starfall_chance"),
        starfall_cooldown=min(starfall_cooldowns) if starfall_dmg > 0 and starfall_cooldowns else 0.0,
        stellar_mark_dmg=stellar_mark_dmg,
        stellar_mark_hits=STELLAR_MARK_HITS if stellar_mark_dmg > 0 else 0.0,
        ancient_poison_dmg=slot_sum("ancient_poison_dmg"),
        ancient_poison_chance=slot_max("ancient_poison_chance"),
        ancient_poison_duration=slot_max("ancient_poison_duration"),
    )


def dot_uptime(chance: float, atk_rate: float, duration: float) -> float:
    """Share of time a refreshing DoT is up when each re-proc adds half its duration."""
    load = chance * atk_rate * duration
    return min(1.0, load / (1 + load / 2))


def cooldown_rate(chance: float, atk_rate: float, cooldown: float) -> float:
    """Procs per second when the cooldown starts on the proc: ``1/(cd + 1/(chance*rate))``."""
    if chance <= 0 or atk_rate <= 0:
        return 0.0
    return 1.0 / (cooldown + 1.0 / (chance * atk_rate))


def crit_blend(cc_total: float, cd_total: float) -> float:
    """The crit multiplier: ``MIN(cc,1)*cd + (1-MIN(cc,1))``."""
    cc = min(cc_total, 1.0)
    return cc * cd_total + (1 - cc)


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
    avg_power: float
    unforged_damage: float
    forged_damage: float
    interval: float
    attack_rate: float
    lethality: float
    crit_chance: float
    crit_dmg: float
    atk_speed: float
    crit_blend: float
    moon: float
    explosion_dmg: float
    explosion_chance: float
    fire_dmg: float
    fire_chance: float
    fire_duration: float
    poison_dmg: float
    poison_chance: float
    poison_duration: float
    smite_dmg: float
    smite_chance: float
    blackhole_dmg: float
    blackhole_chance: float
    lightning_dmg: float
    lightning_chance: float
    weapon_dps: float
    explosion_dps: float
    fire_dps: float
    poison_dps: float
    smite_dps: float
    blackhole_dps: float
    lightning_dps: float
    total_dps: float
    berserk: float | None
    moonstone: float | None
    min_dps: float
    max_dps: float
    ttk_25k: float | None
    ttk_75k: float | None
    active_traits: str
    smash_dmg: float = 0.0
    smash_chance: float = 0.0
    fox_claws_dmg: float = 0.0
    fox_claws_chance: float = 0.0
    foxfire_dmg: float = 0.0
    foxfire_chance: float = 0.0
    foxfire_duration: float = 0.0
    smash_dps: float = 0.0
    fox_claws_dps: float = 0.0
    foxfire_dps: float = 0.0
    archangel_smite_dps: float = 0.0
    cursed_aura_dps: float = 0.0
    lightning_cooldown: float = 0.0
    trait_damage_multiplier: float = 1.0
    berserk_level: float = 0.0
    golemite_dps: float = 0.0
    dark_smite_dps: float = 0.0
    trident_toss_dps: float = 0.0
    reverberation_chance: float = 0.0
    reverberation_dps: float = 0.0
    frost_slash_dmg: float = 0.0
    frost_slash_dps: float = 0.0
    glacier_dmg: float = 0.0
    glacier_explosion_dps: float = 0.0
    starfall_dmg: float = 0.0
    starfall_cooldown: float = 0.0
    starfall_dps: float = 0.0
    stellar_mark_dmg: float = 0.0
    stellar_mark_dps: float = 0.0
    ancient_poison_dmg: float = 0.0
    ancient_poison_dps: float = 0.0


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
    procs = proc_components(build, shares, game, atk_rate)
    tdm = trait_damage_multiplier(build)
    race = build.race

    weapon_dps = forged * (1 + totals["lethality"]) * blend * atk_rate
    explosion_dps = unforged * procs.explosion_dmg * game_chance(procs.explosion_chance, procs.explosion_dmg > 0) * atk_rate
    fire_dps = 0.0
    if atk_rate and procs.fire_dmg > 0:
        fire_dps = unforged * procs.fire_dmg * tdm * dot_uptime(
            game_chance(procs.fire_chance, True), atk_rate, procs.fire_duration)
    poison_dps = 0.0
    if atk_rate and procs.poison_dmg > 0:
        poison_dps = unforged * procs.poison_dmg * tdm * dot_uptime(
            game_chance(procs.poison_chance, True), atk_rate, procs.poison_duration)
    smite_dps = unforged * atk_rate * procs.smite_dmg * game_chance(procs.smite_chance, procs.smite_dmg > 0)
    blackhole_dps = 0.0
    if procs.blackhole_dmg > 0 and procs.blackhole_chance > 0:
        blackhole_dps = unforged * procs.blackhole_dmg * tdm * cooldown_rate(
            game_chance(procs.blackhole_chance, True), atk_rate, BLACKHOLE_COOLDOWN)
    lightning_dps = 0.0
    if procs.lightning_dmg > 0:
        lightning_dps = unforged * procs.lightning_dmg * tdm * cooldown_rate(
            game_chance(procs.lightning_chance, True), atk_rate, procs.lightning_cooldown)
    smash_dps = unforged * procs.smash_dmg * cooldown_rate(procs.smash_chance, atk_rate, procs.smash_cooldown)
    fox_claws_dps = unforged * procs.fox_claws_dmg * min(
        procs.fox_claws_chance * atk_rate, FOX_CLAWS_SPIRITS / FOX_CLAWS_SPIRIT_TIME)
    foxfire_dps = 0.0
    if atk_rate:
        foxfire_dps = unforged * (1 + totals["lethality"]) * procs.foxfire_dmg * (
            1 - math.exp(-procs.foxfire_chance * atk_rate * procs.foxfire_duration))
    archangel = 0.0
    if race == "Archangel" and atk_rate > 0:
        archangel = ARCHANGEL_SMITE_DMG * unforged * cooldown_rate(ARCHANGEL_SMITE_CHANCE, atk_rate, ARCHANGEL_SMITE_COOLDOWN)
    cursed_aura = DEMON_CURSED_AURA_DMG * unforged if race == "Demon" else 0.0
    golemite_dps = sum(golemite_damage(g.level, unforged) * GOLEMITE_HITS_PER_SECOND for g in build.golemites)
    dark_smite_dmg = RACE_DARK_SMITE_DMG.get(race, 0.0)
    dark_smite_dps = unforged * atk_rate * dark_smite_dmg * game_chance(RACE_DARK_SMITE_CHANCE.get(race, 0.0), dark_smite_dmg > 0)
    weapon_type = weapon.type if weapon is not None else ""
    trident_dmg, trident_chance, trident_cooldown = TRIDENT_TOSS.get((race, weapon_type), (0.0, 0.0, 0.0))
    trident_toss_dps = unforged * trident_dmg * trident_chance * min(atk_rate, 1 / trident_cooldown) if trident_cooldown else 0.0

    reverberation_dps = weapon_dps * game_chance(procs.reverberation_chance, procs.reverberation_chance > 0)
    frost_slash_dps = unforged * procs.frost_slash_dmg * game_chance(procs.frost_slash_chance, procs.frost_slash_dmg > 0) * atk_rate
    crit_share = min(build.base_crit_chance + totals["crit_chance"], 1.0)
    glacier_explosion_dps = (
        unforged * procs.glacier_dmg * game_chance(procs.glacier_chance, procs.glacier_dmg > 0) * crit_share * atk_rate)
    galaxite_amount = sum(slot.amount for slot in build.slots if slot.name == "Galaxite")
    starfall_mult = STARFALL_GALAXITE_MULT if galaxite_amount > 0 else 1.0
    starfall_dps = 0.0
    if atk_rate and procs.starfall_dmg > 0:
        starfall_dps = unforged * procs.starfall_dmg * starfall_mult * cooldown_rate(
            game_chance(procs.starfall_chance, True), atk_rate, procs.starfall_cooldown)
    stellar_mark_dps = (
        unforged * procs.stellar_mark_dmg * atk_rate / procs.stellar_mark_hits if procs.stellar_mark_dmg > 0 else 0.0)
    ancient_poison_dps = 0.0
    if atk_rate and procs.ancient_poison_dmg > 0:
        mark_chance = game_chance(procs.ancient_poison_chance, True)
        ancient_poison_dps = poison_dps * procs.ancient_poison_dmg * (
            1 - (1 - mark_chance) ** (atk_rate * procs.ancient_poison_duration))

    proc_total = (
        explosion_dps + fire_dps + poison_dps + smite_dps + blackhole_dps + lightning_dps
        + smash_dps + fox_claws_dps + foxfire_dps + archangel + cursed_aura + golemite_dps
        + dark_smite_dps + trident_toss_dps + reverberation_dps + frost_slash_dps + glacier_explosion_dps
        + starfall_dps + stellar_mark_dps + ancient_poison_dps
    )
    total = weapon_dps + proc_total

    berserk_level = min(build.berserk, CAPS["berserk"]) + RACE_BERSERK.get(race, 0.0)
    berserk = None
    if berserk_level != 0:
        berserk = forged * (1 + totals["lethality"] + berserk_level) * blend * atk_rate + proc_total

    moonstone = None if procs.moon == 0 else weapon_dps * (1 + procs.moon) + proc_total

    min_dps = forged * (1 + totals["lethality"]) * atk_rate
    max_dps = (
        forged * (1 + totals["lethality"]) * (build.base_crit_dmg + totals["crit_dmg"]) * atk_rate
        + forged * procs.explosion_dmg * atk_rate
        + forged * procs.fire_dmg
        + forged * procs.poison_dmg
        + procs.smite_dmg * forged
        + procs.blackhole_dmg * forged
        + forged * procs.lightning_dmg * procs.lightning_chance * atk_rate
        + procs.smash_dmg * forged
        + (forged * (1 + totals["lethality"]) * (build.base_crit_dmg + totals["crit_dmg"]) * atk_rate
           if procs.reverberation_chance > 0 else 0.0)
        + forged * procs.frost_slash_dmg * atk_rate
        + forged * procs.glacier_dmg * atk_rate
        + (forged * procs.starfall_dmg * starfall_mult / procs.starfall_cooldown if procs.starfall_cooldown > 0 else 0.0)
        + (forged * procs.stellar_mark_dmg * atk_rate / procs.stellar_mark_hits if procs.stellar_mark_hits > 0 else 0.0)
        + forged * procs.poison_dmg * procs.ancient_poison_dmg
    )

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
        lightning_dmg=procs.lightning_dmg,
        lightning_chance=procs.lightning_chance,
        weapon_dps=weapon_dps,
        explosion_dps=explosion_dps,
        fire_dps=fire_dps,
        poison_dps=poison_dps,
        smite_dps=smite_dps,
        blackhole_dps=blackhole_dps,
        lightning_dps=lightning_dps,
        total_dps=total,
        berserk=berserk,
        moonstone=moonstone,
        min_dps=min_dps,
        max_dps=max_dps,
        ttk_25k=ttk_25k,
        ttk_75k=ttk_75k,
        active_traits=active_traits(build, shares, game),
        smash_dmg=procs.smash_dmg,
        smash_chance=procs.smash_chance,
        fox_claws_dmg=procs.fox_claws_dmg,
        fox_claws_chance=procs.fox_claws_chance,
        foxfire_dmg=procs.foxfire_dmg,
        foxfire_chance=procs.foxfire_chance,
        foxfire_duration=procs.foxfire_duration,
        smash_dps=smash_dps,
        fox_claws_dps=fox_claws_dps,
        foxfire_dps=foxfire_dps,
        archangel_smite_dps=archangel,
        cursed_aura_dps=cursed_aura,
        lightning_cooldown=procs.lightning_cooldown,
        trait_damage_multiplier=tdm,
        berserk_level=berserk_level,
        golemite_dps=golemite_dps,
        dark_smite_dps=dark_smite_dps,
        trident_toss_dps=trident_toss_dps,
        reverberation_chance=procs.reverberation_chance,
        reverberation_dps=reverberation_dps,
        frost_slash_dmg=procs.frost_slash_dmg,
        frost_slash_dps=frost_slash_dps,
        glacier_dmg=procs.glacier_dmg,
        glacier_explosion_dps=glacier_explosion_dps,
        starfall_dmg=procs.starfall_dmg,
        starfall_cooldown=procs.starfall_cooldown,
        starfall_dps=starfall_dps,
        stellar_mark_dmg=procs.stellar_mark_dmg,
        stellar_mark_dps=stellar_mark_dps,
        ancient_poison_dmg=procs.ancient_poison_dmg,
        ancient_poison_dps=ancient_poison_dps,
    )
