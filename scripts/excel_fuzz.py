import json
import random
import sys

from forge_calculator.data import load_game_data
from forge_calculator.engine import Abilities, Build, Golemite, OreSlot, calculate

ORES = ["Galaxite", "Bismuth", "Kitsunite", "Malachite", "Marblite", "Fireite", "Gargantuan", "Kyubite",
        "Heavenite", "Moon Stone", "Aetherit", "Tiger's Eye", "Snowite", "Sun Stone", "Meteorite",
        "Supermassive Black Hole", "Magmaite", "Fierce Jade", "Yin-Yang", "Wolfarite", "Select Ore"]
RACES = ["Human", "Kitsune", "Archangel", "Angel", "Demon", "Dragonborn", "Dryad", "Orc Lord", "Golem",
         "Fairy", "Minotaur", "Felynx", "Goblin", "Vampire", "Shadow", "Orc"]
CELL_FIELDS = {
    "E10": "avg_power", "A18": "unforged_damage", "C18": "forged_damage", "E21": "attack_rate",
    "E72": "lethality", "E73": "crit_chance", "E74": "crit_dmg", "E75": "atk_speed", "C81": "moon",
    "E82": "berserk_level", "C87": "explosion_dmg", "C88": "explosion_chance", "C91": "fire_dmg",
    "C92": "fire_chance", "C93": "fire_duration", "C96": "poison_dmg", "C97": "poison_chance",
    "C98": "poison_duration", "C101": "smite_dmg", "C102": "smite_chance", "C105": "blackhole_dmg",
    "C106": "blackhole_chance", "C109": "lightning_dmg", "E109": "lightning_cooldown", "C110": "lightning_chance",
    "C131": "weapon_dps", "C132": "explosion_dps", "C133": "fire_dps", "C134": "poison_dps",
    "C135": "smite_dps", "C136": "blackhole_dps", "E136": "lightning_dps", "C137": "smash_dps",
    "E137": "fox_claws_dps", "C138": "foxfire_dps",
    "C139": "archangel_smite_dps", "E139": "cursed_aura_dps", "C141": "total_dps", "C142": "berserk",
    "C143": "moonstone", "C145": "min_dps", "C146": "max_dps", "E138": "golemite_dps",
}
GOLEMITE_CELLS = {
    "fire_dmg": "C41", "fire_chance": "D41", "fire_time": "E41",
    "poison_dmg": "C43", "poison_chance": "D43", "poison_time": "E43",
    "lightning_dmg": "C45", "lightning_chance": "D45", "lightning_cooldown": "E45",
    "blast_dmg": "C47", "blast_chance": "D47", "smite_dmg": "C49", "smite_chance": "D49",
    "blackhole_dmg": "C51", "blackhole_chance": "D51", "resonance_dmg": "C53", "moon": "C55",
    "lethality": "C57", "crit_chance": "C59", "crit_dmg": "C61", "atk_speed": "C63", "level": "E54",
}
GOLEMITE_CHOICES = {
    "fire_dmg": [0, 0, 0.1], "fire_chance": [0, 0, 0.25], "fire_time": [0, 0, 4],
    "poison_dmg": [0, 0, 0.05], "poison_chance": [0, 0, 0.3], "poison_time": [0, 0, 10],
    "lightning_dmg": [0, 0, 0.4], "lightning_chance": [0, 0, 0.2], "lightning_cooldown": [0, 0, 3],
    "blast_dmg": [0, 0, 0.3], "blast_chance": [0], "smite_dmg": [0, 0, 0.2], "smite_chance": [0, 0, 0.35],
    "blackhole_dmg": [0, 0, 0.5], "blackhole_chance": [0, 0, 0.2], "resonance_dmg": [0, 0, 0.3],
    "moon": [0, 0, 0.4], "lethality": [0, 0, 0.1], "crit_chance": [0, 0, 0.1], "crit_dmg": [0, 0, 0.15],
    "atk_speed": [0, 0, 0.1], "level": [0, 0, 5, 13, 18, 25, 30],
}


def golemite_cell(field, index):
    cell = GOLEMITE_CELLS[field]
    return f"{cell[0]}{int(cell[1:]) + index}"


def golemites_from(c, sheet_typo=False):
    golemites = []
    for index in range(2):
        values = {field: c(golemite_cell(field, index)) or 0.0 for field in GOLEMITE_CELLS}
        if sheet_typo:
            values["blast_chance"] = max(values["blast_chance"], values["smite_dmg"])
        golemites.append(Golemite(**values))
    return tuple(golemites)


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
            "C69": rng.choice([0, 0.1]), "C70": rng.choice([0, 0.1]), "C71": rng.choice([0, 0.2]),
            "C82": rng.choice([0, 0, 0.5, 2.5]), "C127": rng.choice(achievements),
            "C76": rng.choice(["No", "Yes"]), "E76": float(rng.choice([0, 2500, 12000])),
            "C83": rng.choice([0, 0.35, 0.8]), "E83": float(rng.choice([0, 2, 7])),
        })
        for c in ["C27", "D27", "E27", "C28", "D28", "E28", "C29", "D29", "E29"]:
            b[c] = rng.choice(runes)
        with_golemites = rng.random() < 0.6
        for index in range(2):
            for field, choices in GOLEMITE_CHOICES.items():
                b[golemite_cell(field, index)] = float(rng.choice(choices)) if with_golemites else 0.0
        builds.append(b)
    json.dump(builds, open(path, "w", encoding="utf-8"), indent=1)


def to_build(b):
    return Build(
        slots=tuple(OreSlot(b[f"C{r}"], b[f"D{r}"]) for r in range(6, 10)),
        weapon_name=b["D12"], quality=b["E12"], forge_level=int(b["C13"]), race=b["C22"],
        bonus_weapon_type=b["C23"],
        rune_cells=tuple(b[c] for c in ["C27", "D27", "E27", "C28", "D28", "E28", "C29", "D29", "E29"]),
        armor_crit_chance=b["C69"], armor_crit_dmg=b["C70"], armor_lethality=b["C71"],
        abilities=Abilities(b["C34"], b["D34"], b["E34"], b["C35"], b["D35"], b["E35"],
                            b["C36"], b["D36"], b["E36"], b["C37"], b["D37"]),
        berserk=b["C82"], achievement=b["C127"], dryad_in_grove=b["C76"] == "Yes", dryad_max_hp=b["E76"],
        orc_lord_hp_missing=b["C83"], orc_lord_kill_stacks=b["E83"],
        golemites=golemites_from(lambda cell: b.get(cell, 0.0), sheet_typo=True),
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
