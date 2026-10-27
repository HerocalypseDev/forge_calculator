"""Generate deterministic random builds + Python-engine results for differential
verification against the JS engine in MediaWiki-ForgeCalculator.js.

Usage: python Web/mediawiki/fuzz_gen.py  (writes fuzz-cases.json beside itself)
"""
import json
import random
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent.parent))
OUT = HERE / "fuzz-cases.json"

from forge_calculator.data import load_game_data, DEFAULT_DATA_DIR
from forge_calculator.engine import Build, OreSlot, Abilities, calculate

random.seed(20260809)
game = load_game_data(DEFAULT_DATA_DIR)

ore_names = [o.name for o in game.ores]
weapon_names = [w.name for w in game.weapons]
race_names = [r.name for r in game.races]
rune_names = [r.name for r in game.runes if r.name != "None"]
ach_names = [a.name for a in game.achievements if a.name != "None"]
bonus_types = list(dict.fromkeys([*game.race_bonus_types, *game.weapon_types]))


def rand_float(maxv):
    return round(random.uniform(0, maxv), 3)


def gen_build():
    # 4 slots: sometimes empty, sometimes an ore with an amount
    slots = []
    for _ in range(4):
        if random.random() < 0.35:
            slots.append(OreSlot("None", 0))
        else:
            slots.append(OreSlot(random.choice(ore_names), random.choice([1, 2, 3, 5, 8, 13, 20, 30])))
    rune_cells = []
    if random.random() < 0.5:
        rune_cells = [random.choice(rune_names) for _ in range(random.randint(1, 4))]
    return Build(
        slots=tuple(slots),
        weapon_name=random.choice(weapon_names + [""]),
        quality=random.choice([0, 25, 50, 100, 150, 200]),
        forge_level=random.choice(list(range(10))),
        race=random.choice(race_names),
        bonus_weapon_type=random.choice(bonus_types),
        rune_cells=tuple(rune_cells),
        base_crit_chance=rand_float(0.3),
        base_crit_dmg=rand_float(0.5),
        armor_crit_chance=rand_float(0.5),
        armor_crit_dmg=rand_float(0.5),
        armor_lethality=rand_float(0.5),
        base_lethality=rand_float(0.3),
        abilities=Abilities(
            fire_dmg=rand_float(0.4), fire_chance=rand_float(0.5), fire_time=random.choice([0, 1, 2, 3, 5, 8]),
            poison_dmg=rand_float(0.4), poison_chance=rand_float(0.5), poison_time=random.choice([0, 1, 2, 3, 5, 8]),
            lightning_dmg=rand_float(0.8), lightning_chance=rand_float(0.6),
            lightning_cooldown=random.choice([0, 0.3, 1, 2, 3, 5]),
            blast_dmg=rand_float(0.4), blast_chance=rand_float(0.5),
        ),
        berserk=random.choice([0.0, rand_float(0.3), rand_float(2.5)]),
        achievement=random.choice(ach_names + ["None"]),
        dryad_in_grove=random.random() < 0.5,
        dryad_max_hp=random.choice([0, 999, 1000, 4500, 12000]),
        orc_lord_hp_missing=random.choice([0, 0.1, 0.35, 0.99, 1.2]),
        orc_lord_kill_stacks=random.choice([0, 1, 3, 5, 8]),
    )


def build_to_dict(b):
    return {
        "slots": [{"name": s.name, "amount": s.amount} for s in b.slots],
        "weapon_name": b.weapon_name,
        "quality": b.quality,
        "forge_level": b.forge_level,
        "race": b.race,
        "bonus_weapon_type": b.bonus_weapon_type,
        "rune_cells": list(b.rune_cells),
        "base_crit_chance": b.base_crit_chance,
        "base_crit_dmg": b.base_crit_dmg,
        "armor_crit_chance": b.armor_crit_chance,
        "armor_crit_dmg": b.armor_crit_dmg,
        "armor_lethality": b.armor_lethality,
        "base_lethality": b.base_lethality,
        "abilities": {
            "fire_dmg": b.abilities.fire_dmg,
            "fire_chance": b.abilities.fire_chance,
            "fire_time": b.abilities.fire_time,
            "poison_dmg": b.abilities.poison_dmg,
            "poison_chance": b.abilities.poison_chance,
            "poison_time": b.abilities.poison_time,
            "lightning_dmg": b.abilities.lightning_dmg,
            "lightning_chance": b.abilities.lightning_chance,
            "lightning_cooldown": b.abilities.lightning_cooldown,
            "blast_dmg": b.abilities.blast_dmg,
            "blast_chance": b.abilities.blast_chance,
        },
        "berserk": b.berserk,
        "achievement": b.achievement,
        "dryad_in_grove": b.dryad_in_grove,
        "dryad_max_hp": b.dryad_max_hp,
        "orc_lord_hp_missing": b.orc_lord_hp_missing,
        "orc_lord_kill_stacks": b.orc_lord_kill_stacks,
    }


def result_to_dict(r):
    return {
        "avg_power": r.avg_power,
        "unforged_damage": r.unforged_damage,
        "forged_damage": r.forged_damage,
        "interval": r.interval,
        "attack_rate": r.attack_rate,
        "lethality": r.lethality,
        "crit_chance": r.crit_chance,
        "crit_dmg": r.crit_dmg,
        "atk_speed": r.atk_speed,
        "crit_blend": r.crit_blend,
        "moon": r.moon,
        "explosion_dmg": r.explosion_dmg,
        "explosion_chance": r.explosion_chance,
        "fire_dmg": r.fire_dmg,
        "fire_chance": r.fire_chance,
        "fire_duration": r.fire_duration,
        "poison_dmg": r.poison_dmg,
        "poison_chance": r.poison_chance,
        "poison_duration": r.poison_duration,
        "smite_dmg": r.smite_dmg,
        "smite_chance": r.smite_chance,
        "blackhole_dmg": r.blackhole_dmg,
        "blackhole_chance": r.blackhole_chance,
        "lightning_dmg": r.lightning_dmg,
        "lightning_chance": r.lightning_chance,
        "weapon_dps": r.weapon_dps,
        "explosion_dps": r.explosion_dps,
        "fire_dps": r.fire_dps,
        "poison_dps": r.poison_dps,
        "smite_dps": r.smite_dps,
        "blackhole_dps": r.blackhole_dps,
        "lightning_dps": r.lightning_dps,
        "smash_dmg": r.smash_dmg,
        "smash_chance": r.smash_chance,
        "fox_claws_dmg": r.fox_claws_dmg,
        "fox_claws_chance": r.fox_claws_chance,
        "foxfire_dmg": r.foxfire_dmg,
        "foxfire_chance": r.foxfire_chance,
        "foxfire_duration": r.foxfire_duration,
        "smash_dps": r.smash_dps,
        "fox_claws_dps": r.fox_claws_dps,
        "foxfire_dps": r.foxfire_dps,
        "archangel_smite_dps": r.archangel_smite_dps,
        "cursed_aura_dps": r.cursed_aura_dps,
        "lightning_cooldown": r.lightning_cooldown,
        "trait_damage_multiplier": r.trait_damage_multiplier,
        "berserk_level": r.berserk_level,
        "total_dps": r.total_dps,
        "berserk": r.berserk,
        "moonstone": r.moonstone,
        "min_dps": r.min_dps,
        "max_dps": r.max_dps,
        "ttk_25k": r.ttk_25k,
        "ttk_75k": r.ttk_75k,
        "active_traits": r.active_traits,
    }


cases = []
for i in range(250):
    b = gen_build()
    r = calculate(b, game)
    cases.append({"build": build_to_dict(b), "result": result_to_dict(r)})

with open(OUT, "w", encoding="utf-8") as f:
    json.dump({"select_ore": game.select_ore, "none": game.none_label, "cases": cases}, f)

print(f"Generated {len(cases)} fuzz cases -> {OUT}")
