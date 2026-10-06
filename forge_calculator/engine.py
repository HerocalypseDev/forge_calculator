"""DPS engine, ported cell-for-cell from the workbook's "DPS Calculator" sheet.

Every constant below cites its source cell in ``reference/UpdatedSpreadsheet.xlsx``.  The
workbook's quirks are preserved rather than fixed: procs scale on the unforged
A18 while C89/C101 use the forged C18, fire/poison durations subtract 1 and 2,
poison duration reads only the FIRST Malachite slot, C77 treats "Select Ore" as
a non-blank slot, black-hole DPS floors its rate term at 1 (``MAX(1,E21)``), and
C97 berserk multiplies the physical hit rather than boosting lethality.

The ability grid is row-per-ability: Fire 34, Poison 35, Lightning 36, Blast 37,
with DMG/Chance/Time in columns C/D/E (Blast has no time).

Felynx + a Gauntlets weapon gets BOTH the E45 lethality and E48 attack-speed
bonuses -- E45 and E48 both test the plural "Gauntlets" (the only spelling the
C23 dropdown offers). The singular "Gauntlet" is registered alongside it in
``CLASS_LETHALITY``/``CLASS_ATK_SPEED`` too, harmless dead weight kept from when
an older workbook (reall.xlsx) had E45 testing the singular and never firing.

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

# --- constants (each cited to its formula cell) ---

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

# E45 race lethality addends (SWITCH in E45)
RACE_LETHALITY = {
    "Archangel": 0.20, "Demon": 0.20, "Orc": 0.10,
    "Shadow": 0.05, "Dragonborn": 0.12,
    "Orc Lord": 0.40, "Kitsune": 0.20, "Minotaur": 0.30,
}
# E45 class lethality addends (IFS in E45).  The sheet writes the Felynx test
# with the plural "Gauntlets" (the only spelling its C23 dropdown offers); the
# singular is registered too, harmless dead weight kept from an older workbook.
CLASS_LETHALITY = {
    ("Felynx", "Gauntlet"): 0.20,
    ("Felynx", "Gauntlets"): 0.20,
    ("Vampire", "Straight Sword"): 0.10,
    ("Fairy", "Spear"): 0.15,
}
# E48 race atk-speed addends (SWITCH in E48)
RACE_ATK_SPEED = {
    "Shadow": 0.10, "Demon": 0.20, "Archangel": 0.20,
    "Elf": 0.05, "Kitsune": 0.20,
}
# E48 class atk-speed addends (IFS in E48), same Felynx test as CLASS_LETHALITY.
CLASS_ATK_SPEED = {
    ("Goblin", "Dagger"): 0.10,
    ("Golem", "Colossal Sword"): 0.15,
    ("Golem", "Great Axe"): 0.15,
    ("Felynx", "Gauntlet"): 0.20,
    ("Felynx", "Gauntlets"): 0.20,
    ("Fairy", "Spear"): 0.15,
    ("Shadow", "Great Sword"): 0.15,
    ("Shadow", "Colossal Sword"): 0.15,
    ("Shadow", "Great Axe"): 0.15,
    ("Shadow", "Mace"): 0.15,
}
# C62/C63/C64 Dragonborn fire bonuses
RACE_FIRE_DMG = {"Dragonborn": 0.30}
RACE_FIRE_CHANCE = {"Dragonborn": 0.40}
RACE_FIRE_TIME = {"Dragonborn": 3}
# C72/C73 smite bonuses (no ability inputs for smite).  Archangel's DAMAGE addend
# is not flat -- see _smite_race_dmg.
RACE_SMITE_DMG = {"Angel": 0.30}
RACE_SMITE_CHANCE = {"Angel": 0.50, "Archangel": 0.33}
# E54 berserk addend (Minotaur)
RACE_BERSERK = {"Minotaur": 0.30}
RACE_SMASH_DMG = {"Orc Lord": 1.0}
RACE_SMASH_COOLDOWN = {"Orc Lord": 10.0}
RACE_SMASH_CHANCE = {"Orc Lord": 0.25}
RACE_FOX_CLAWS_STEP = {"Kitsune": 0.075}
RACE_FOX_CLAWS_CAP = {"Kitsune": 0.75}
RACE_FOX_CLAWS_CHANCE = {"Kitsune": 0.5}
RACE_FOXFIRE_DMG = {"Kitsune": 0.3}
RACE_FOXFIRE_CHANCE = {"Kitsune": 0.5}
RACE_FOXFIRE_TIME = {"Kitsune": 2.0}
EXPLOSION_SLOT_CAP = 2.5
SMITE_DMG_CAP = 2.5
FOXFIRE_TIME_CAP = 5.0

# Ores excluded from the E10 weighted average ore power.
AVG_POWER_EXCLUDED = ("Fichilliumorite",)

# E45/E46/E47/E48 caps
CAPS = {
    "lethality": 3.0,
    "crit_chance": 1.0,
    "crit_dmg": 1.0,
    "atk_speed": 1.5,
    "berserk": 2.0,
}

# K6-K9 active-trait power: MIN(MAX((share-0.1)*4.5+0.1, 0.1), 1)
TRAIT_POWER_SLOPE = 4.5
TRAIT_POWER_FLOOR = 0.1

_CORE_STATS = ("lethality", "crit_chance", "crit_dmg", "atk_speed")


# --- build input dataclasses ---


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
    fire_dmg: float = 0.0               # C34
    fire_chance: float = 0.0            # D34
    fire_time: float = 0.0              # E34
    poison_dmg: float = 0.0             # C35
    poison_chance: float = 0.0          # D35
    poison_time: float = 0.0            # E35
    lightning_dmg: float = 0.0          # C36
    lightning_chance: float = 0.0       # D36
    lightning_cooldown: float = 0.0     # E36
    blast_dmg: float = 0.0              # C37
    blast_chance: float = 0.0           # D37


@dataclass(frozen=True)
class Build:
    """A build configuration; the field comments name the workbook cells."""
    slots: tuple = (OreSlot(), OreSlot(), OreSlot(), OreSlot())  # C6:C9 + D6:D9
    weapon_name: str = ""           # D12
    quality: float = 0.0            # E12 (percent: 100 -> 2x)
    forge_level: int = 0            # C13
    race: str = ""                  # C22
    bonus_weapon_type: str = ""     # C23
    rune_cells: tuple = ("None",) * 9  # C27:E29
    base_crit_chance: float = 0.0   # C20
    base_crit_dmg: float = 1.45     # C21 — workbook's base crit damage (a crit deals 145% before bonuses)
    armor_crit_chance: float = 0.0  # C42
    armor_crit_dmg: float = 0.0     # C43
    armor_lethality: float = 0.0    # C44
    base_lethality: float = 0.0     # A45
    abilities: Abilities = Abilities()
    berserk: float = 0.0            # C54
    achievement: str = "None"       # C85


# --- core math ---


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
    """E10 -- the weighted average ore power, excluding Fichilliumorite.

    ``IFERROR(IFERROR(SUMPRODUCT(D6:D9, E6:E9, (C6:C9<>"Fichilliumorite")*1)
    / SUMIFS(D6:D9, C6:C9, "<>Fichilliumorite"),
    AVERAGEIFS(E6:E9, C6:C9, "<>Fichilliumorite")), 1)``

    Fichilliumorite drops out of both the numerator and the denominator, so it
    is filler that never dilutes the average.  When the remaining total amount is
    0 the division is 0/0 and the AVERAGEIFS fallback applies; with nothing left
    at all the outer IFERROR yields 1.
    """
    kept = [s for s in slots if s.name not in AVG_POWER_EXCLUDED]
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


# --- stat aggregation (E44-E47) ---


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


def stat_totals(build: Build, game: GameData, ore_contribs: Mapping[str, float]) -> Mapping[str, float]:
    """E44-E47 capped totals.

    ``ore_contribs`` is the C44-C47 sum, already including the C41/C42/C43
    armor addends.  Caps: 3.0 lethality, 1.0 crit chance/dmg, 1.5 atk speed.
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


# --- proc components (C52-C76) ---


@dataclass(frozen=True)
class ProcComponents:
    moon: float                  # C53
    explosion_dmg: float         # C58
    explosion_chance: float      # C59
    fire_dmg: float              # C62
    fire_chance: float           # C63
    fire_duration: float         # C64
    poison_dmg: float            # C67
    poison_chance: float         # C68
    poison_duration: float       # C69
    smite_dmg: float             # C72
    smite_chance: float          # C73
    blackhole_dmg: float         # C76
    blackhole_chance: float      # C77
    lightning_dmg: float         # C80
    lightning_cooldown: float    # E80
    lightning_chance: float      # C81
    smash_dmg: float = 0.0
    smash_cooldown: float = 0.0
    smash_chance: float = 0.0
    fox_claws_dmg: float = 0.0
    fox_claws_chance: float = 0.0
    foxfire_dmg: float = 0.0
    foxfire_chance: float = 0.0
    foxfire_duration: float = 0.0


def _fox_claws_dmg(race: str, atk_rate: float) -> float:
    step = RACE_FOX_CLAWS_STEP.get(race, 0.0)
    if not step:
        return 0.0
    return min(math.floor(atk_rate) * step, RACE_FOX_CLAWS_CAP[race])


def _duration(ore_terms, race_time: float, ability_time: float, minus: int) -> float:
    """C63/C68 duration: ``MAX(MAX(ore,race,ability)-N, 0)``.

    No ore gate: a fire/poison time alone now counts (ability traits work
    without a matching ore, and for fire without Dragonborn too).
    """
    top = max([*ore_terms, race_time, ability_time])
    return max(top - minus, 0.0)


def _smite_race_dmg(race: str, atk_rate: float) -> float:
    """C72's race addends.

    ``IF(C22="Angel",0.3,0) + IF(C22="Archangel", MIN(FLOOR(E21,1)*0.5, 1.5), 0)``

    Angel is a flat 30%; Archangel instead scales with attack speed -- half a
    point per WHOLE attack per second (``FLOOR``, so it steps rather than ramps),
    capped at 150%.  Below 1 hit/sec an Archangel gets nothing.
    """
    if race == "Archangel":
        return min(math.floor(atk_rate) * 0.5, 1.5)
    return RACE_SMITE_DMG.get(race, 0.0)


def _blackhole_chance(slots, game: GameData) -> float:
    """C77 -- ``IF(COUNTIF(C6:C9,"Galaxite")/COUNTA(C6:C9)>=0.1, 0.3, 0)``.

    COUNTA counts every non-blank slot, and "Select Ore" is non-blank -- so in
    this app the denominator is always 4 and any Galaxite slot triggers 0.3.
    """
    galaxite = sum(1 for s in slots if s.name == "Galaxite")
    nonblank = sum(1 for s in slots if s.name)  # COUNTA: "Select Ore" counts
    if nonblank == 0:
        return 0.0
    return 0.3 if galaxite / nonblank >= 0.1 else 0.0


def _lightning_cooldown(ore_terms, ability_cooldown: float) -> float:
    """E80 -- the shortest lightning cooldown, or 0 when there is none.

    The sheet uses 99 as a "no lightning here" sentinel for each slot and for an
    empty E36, then maps a surviving 99 back to 0:
    ``IF(MIN(slots..., IF(E36=0,99,E36))=99, 0, MIN(same))``.  Leaving the absent
    terms out is equivalent -- 99 never wins a MIN against a real cooldown -- and
    0 then means "uncapped" to the C81 DPS term, matching the sheet's IFERROR.
    """
    terms = [t for t in ore_terms]
    if ability_cooldown:
        terms.append(ability_cooldown)
    return min(terms) if terms else 0.0


def proc_components(build: Build, shares, game: GameData, atk_rate: float = 0.0) -> ProcComponents:
    """C53-C81 -- all proc magnitudes (fractions of weapon damage / seconds).

    These feed the DPS rows in C90-C94/E94, which all scale on the UNFORGED A18.
    ``atk_rate`` is E21, needed only by the Archangel smite addend.

    Note which cells aggregate across slots and which take the best slot:
    explosion damage (C58) SUMS across slots, while explosion chance (C59) --
    like fire, poison, smite and lightning chance -- takes a MAX.
    """

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

    def slot_min(stat: str) -> float:
        """MIN across the slots that grant ``stat`` (E80 lightning cooldown)."""
        vals = slot_vals(stat)
        return min(vals) if vals else 0.0

    def first_slot_val(name: str, stat: str) -> float:
        """Value of the FIRST slot holding ``name`` (C69 XLOOKUP; 0 when absent)."""
        for slot, share in zip(build.slots, shares):
            if slot.name != name:
                continue
            ore = game.ore(name)
            rng = ore.stat(stat) if ore else None
            if rng is None:
                return 0.0
            return scale_range(rng, share)
        return 0.0

    fire_terms = slot_vals("fire_duration")

    return ProcComponents(
        moon=slot_sum("moon"),
        # C58 SUMS across the slots and adds the Blast ability (C37/D37);
        # C59 MAXes across the slots and the ability instead
        explosion_dmg=sum(min(EXPLOSION_SLOT_CAP, v) for v in slot_vals("explosion_dmg")) + build.abilities.blast_dmg,
        explosion_chance=max(slot_max("explosion_chance"), build.abilities.blast_chance),
        fire_dmg=slot_sum("fire_dmg") + RACE_FIRE_DMG.get(build.race, 0.0) + build.abilities.fire_dmg,  # +C34
        fire_chance=max(slot_max("fire_chance"), build.abilities.fire_chance) + RACE_FIRE_CHANCE.get(build.race, 0.0),  # MAX(...,D34)+0.4
        fire_duration=_duration(fire_terms, RACE_FIRE_TIME.get(build.race, 0), build.abilities.fire_time, minus=1),
        poison_dmg=slot_sum("poison_dmg") + build.abilities.poison_dmg,  # +C35
        poison_chance=max(slot_max("poison_chance"), build.abilities.poison_chance),  # MAX(...,D35)
        poison_duration=_duration([first_slot_val("Malachite", "poison_duration")], 0, build.abilities.poison_time, minus=2),
        # C72/C73: the ore terms SUM for damage and MAX for chance, and in both
        # cases the race addend is ADDED on top rather than maxed against.
        smite_dmg=min(SMITE_DMG_CAP, slot_sum("smite_dmg") + _smite_race_dmg(build.race, atk_rate)),
        smite_chance=slot_max("smite_chance") + RACE_SMITE_CHANCE.get(build.race, 0.0),
        blackhole_dmg=slot_sum("blackhole_dmg"),
        blackhole_chance=_blackhole_chance(build.slots, game),
        # C80/E80/C81 -- the Lightning ability feeds all three (C36/E36/D36)
        lightning_dmg=slot_sum("lightning_dmg") + build.abilities.lightning_dmg,
        lightning_cooldown=_lightning_cooldown(
            slot_vals("lightning_cooldown"), build.abilities.lightning_cooldown
        ),
        lightning_chance=max(slot_max("lightning_chance"), build.abilities.lightning_chance),
        smash_dmg=RACE_SMASH_DMG.get(build.race, 0.0),
        smash_cooldown=RACE_SMASH_COOLDOWN.get(build.race, 0.0),
        smash_chance=RACE_SMASH_CHANCE.get(build.race, 0.0),
        fox_claws_dmg=_fox_claws_dmg(build.race, atk_rate),
        fox_claws_chance=RACE_FOX_CLAWS_CHANCE.get(build.race, 0.0),
        foxfire_dmg=RACE_FOXFIRE_DMG.get(build.race, 0.0),
        foxfire_chance=RACE_FOXFIRE_CHANCE.get(build.race, 0.0),
        foxfire_duration=RACE_FOXFIRE_TIME.get(build.race, 0.0),
    )


def crit_blend(cc_total: float, cd_total: float) -> float:
    """The crit multiplier: ``MIN(cc,1)*cd + (1-MIN(cc,1))`` (part of C84)."""
    cc = min(cc_total, 1.0)
    return cc * cd_total + (1 - cc)


# --- DPS pipeline (C84-C96, E91-E92) ---


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
    poison_duration: float        # C69
    smite_dmg: float              # C72
    smite_chance: float           # C73
    blackhole_dmg: float          # C76
    blackhole_chance: float       # C77
    lightning_dmg: float          # C80
    lightning_chance: float       # C81
    weapon_dps: float             # C89
    explosion_dps: float          # C90
    fire_dps: float               # C91
    poison_dps: float             # C92
    smite_dps: float              # C93
    blackhole_dps: float          # C94
    lightning_dps: float          # E94
    total_dps: float              # C96
    berserk: float | None         # C97 (None -> "N/A")
    moonstone: float | None       # C98 (None -> "N/A")
    min_dps: float                # C100
    max_dps: float                # C101
    ttk_25k: float | None         # E96 (None -> "∞")
    ttk_75k: float | None         # E97 (None -> "∞")
    active_traits: str            # C14
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

    # C89-C94 + E94
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
    # E77 floors the rate term at 1 -- MAX(1,E21), not MIN
    blackhole_dps = unforged * procs.blackhole_dmg * procs.blackhole_chance * max(1.0, atk_rate)
    # E81 -- procs are capped by the cooldown: MIN(E21, 1/E80)
    lightning_rate = (
        min(atk_rate, 1.0 / procs.lightning_cooldown)
        if procs.lightning_cooldown > 0 else atk_rate
    )
    lightning_dps = (
        unforged * procs.lightning_dmg * procs.lightning_chance * lightning_rate
        if atk_rate else 0.0
    )
    smash_dps = (
        unforged * procs.smash_dmg * procs.smash_chance * min(atk_rate, 1.0 / procs.smash_cooldown)
        if procs.smash_cooldown > 0 else 0.0
    )
    fox_claws_dps = unforged * atk_rate * procs.fox_claws_dmg * min(procs.fox_claws_chance, 1)
    foxfire_dps = (
        unforged * procs.foxfire_dmg
        * min(1, procs.foxfire_chance * atk_rate * min(procs.foxfire_duration, FOXFIRE_TIME_CAP))
        if atk_rate else 0.0
    )
    total = (
        weapon_dps + explosion_dps + fire_dps + poison_dps
        + smite_dps + blackhole_dps + lightning_dps
        + smash_dps + fox_claws_dps + foxfire_dps
    )
    proc_total = total - weapon_dps

    berserk_level = min(build.berserk + RACE_BERSERK.get(build.race, 0.0), CAPS["berserk"])
    berserk = None if berserk_level == 0 else weapon_dps * (1 + berserk_level) + proc_total

    # C98 -- IF(C53=0, C96, (C89 * (1 + C53)) + C90..C94 + E94): the moon bonus
    # lifts the physical hit, then every proc is added back on top.
    moonstone = None if procs.moon == 0 else weapon_dps * (1 + procs.moon) + proc_total

    # C100 min / C101 max-burst (procs on FORGED C18 -- preserved quirk)
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
    )

    # E96/E97 TTK
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
    )
