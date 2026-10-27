import json
import random
import sys

from forge_calculator.data import load_game_data
from forge_calculator.engine import Abilities, Build, OreSlot, calculate

ORES = ["Galaxite", "Bismuth", "Kitsunite", "Malachite", "Marblite", "Fireite", "Gargantuan", "Kyubite",
        "Heavenite", "Moon Stone", "Aetherit", "Tiger's Eye", "Snowite", "Sun Stone", "Meteorite",
        "Supermassive Black Hole", "Magmaite", "Fierce Jade", "Yin-Yang", "Wolfarite", "Select Ore"]
RACES = ["Human", "Kitsune", "Archangel", "Angel", "Demon", "Dragonborn", "Dryad", "Orc Lord", "Golem",
         "Fairy", "Minotaur", "Felynx", "Goblin", "Vampire", "Shadow", "Orc"]
CELL_FIELDS = {
    "E10": "avg_power", "A18": "unforged_damage", "C18": "forged_damage", "E21": "attack_rate",
    "E45": "lethality", "E46": "crit_chance", "E47": "crit_dmg", "E48": "atk_speed", "C53": "moon",
    "E54": "berserk_level", "C58": "explosion_dmg", "C59": "explosion_chance", "C62": "fire_dmg",
    "C63": "fire_chance", "C64": "fire_duration", "C67": "poison_dmg", "C68": "poison_chance",
    "C69": "poison_duration", "C72": "smite_dmg", "C73": "smite_chance", "C76": "blackhole_dmg",
    "C77": "blackhole_chance", "C80": "lightning_dmg", "E80": "lightning_cooldown", "C81": "lightning_chance",
    "C102": "weapon_dps", "C103": "explosion_dps", "C104": "fire_dps", "C105": "poison_dps",
    "C106": "smite_dps", "C107": "blackhole_dps", "E107": "lightning_dps", "C108": "smash_dps",
    "E108": "fox_claws_dps", "C109": "foxfire_dps", "E109": "prismatic_shift_dps",
    "C110": "archangel_smite_dps", "E110": "cursed_aura_dps", "C111": "total_dps", "C112": "berserk",
    "C113": "moonstone", "C115": "min_dps", "C116": "max_dps",
}


def gen(path, n, seed):
    rng = random.Random(seed)
    game = load_game_data()
    weapons = [w for w in game.weapons]
    runes = [r.name for r in game.runes] + ["None"] * 20
    achievements = [a.name for a in game.achievements]
    builds = []
    for _ in range(n):
        w = rng.choice(weapons)
        b = {}
        for i, r in enumerate(range(6, 10)):
            b[f"C{r}"] = rng.choice(ORES)
            b[f"D{r}"] = float(rng.choice([0, 1, 2, 3, 5, 8, 10, 15, 20]))
        b.update({
            "D12": w.name, "E12": float(rng.choice([0, 50, 100])), "C13": float(rng.randint(0, 9)),
            "C22": rng.choice(RACES), "C23": w.type,
            "C34": rng.choice([0, 0, 0.1]), "D34": rng.choice([0, 0, 0.3]), "E34": float(rng.choice([0, 0, 2])),
            "C35": rng.choice([0, 0, 0.07]), "D35": rng.choice([0, 0, 0.4]), "E35": float(rng.choice([0, 0, 8])),
            "C36": rng.choice([0, 0, 0.5]), "D36": rng.choice([0, 0, 0.3]), "E36": float(rng.choice([0, 0, 4])),
            "C37": rng.choice([0, 0, 0.4]), "D37": rng.choice([0, 0, 0.2]),
            "C42": rng.choice([0, 0.1]), "C43": rng.choice([0, 0.1]), "C44": rng.choice([0, 0.2]),
            "C54": rng.choice([0, 0, 0.5, 2.5]), "C98": rng.choice(achievements),
            "C49": rng.choice(["No", "Yes"]), "E49": float(rng.choice([0, 2500, 12000])),
            "C55": rng.choice([0, 0.35, 0.8]), "E55": float(rng.choice([0, 2, 7])),
        })
        for c in ["C27", "D27", "E27", "C28", "D28", "E28", "C29", "D29", "E29"]:
            b[c] = rng.choice(runes)
        builds.append(b)
    json.dump(builds, open(path, "w", encoding="utf-8"), indent=1)


def to_build(b):
    return Build(
        slots=tuple(OreSlot(b[f"C{r}"], b[f"D{r}"]) for r in range(6, 10)),
        weapon_name=b["D12"], quality=b["E12"], forge_level=int(b["C13"]), race=b["C22"],
        bonus_weapon_type=b["C23"],
        rune_cells=tuple(b[c] for c in ["C27", "D27", "E27", "C28", "D28", "E28", "C29", "D29", "E29"]),
        armor_crit_chance=b["C42"], armor_crit_dmg=b["C43"], armor_lethality=b["C44"],
        abilities=Abilities(b["C34"], b["D34"], b["E34"], b["C35"], b["D35"], b["E35"],
                            b["C36"], b["D36"], b["E36"], b["C37"], b["D37"]),
        berserk=b["C54"], achievement=b["C98"], dryad_in_grove=b["C49"] == "Yes", dryad_max_hp=b["E49"],
        orc_lord_hp_missing=b["C55"], orc_lord_kill_stacks=b["E55"],
    )


def compare(builds_path, excel_path):
    game = load_game_data()
    builds = json.load(open(builds_path, encoding="utf-8"))
    excel = json.load(open(excel_path, encoding="utf-8-sig"))
    fails = 0
    for i, (b, x) in enumerate(zip(builds, excel)):
        r = calculate(to_build(b), game)
        for cell, field in CELL_FIELDS.items():
            want = x[cell]
            got = getattr(r, field)
            if got is None:
                got = r.total_dps
            if isinstance(want, str) or abs(got - want) > 1e-7 * max(1, abs(want)):
                fails += 1
                print(f"build {i} {cell} {field}: excel={want} engine={got} race={b['C22']} ores={[b[f'C{r}'] for r in range(6, 10)]}")
    print(f"{len(builds)} builds x {len(CELL_FIELDS)} cells: {'EXCEL PARITY PASSED' if not fails else str(fails) + ' mismatches'}")
    return fails


if __name__ == "__main__":
    if sys.argv[1] == "gen":
        gen(sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 60, int(sys.argv[4]) if len(sys.argv) > 4 else 7)
    else:
        sys.exit(1 if compare(sys.argv[2], sys.argv[3]) else 0)
