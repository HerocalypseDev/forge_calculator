"""The stat-matrix parser must extract EXACTLY the known base/max/divisor table.

This is the guard against hand-typing: the matrix is derived from the formula
strings in ``all_formulas.txt`` (committed) and cross-checked against the
workbook's own formula strings via the golden tests.
"""

from pathlib import Path

from build_data.formula_parser import (
    STAT_CELLS,
    load_formulas_from_txt,
    parse_stat_matrix,
)

ROOT = Path(__file__).resolve().parent.parent

EXPECTED = {
    "Wolfarite": {"lethality": (1.5, 15, 100), "atk_speed": (0.8, 8, 100)},
    "Eye Ore": {"lethality": (1.5, 15, 100)},
    "Frost Fossil": {"lethality": (1.75, 17.5, 100)},
    "Crimsonite": {"lethality": (2, 20, 100)},
    "Tigers Eye": {"lethality": (0.5, 5, 100)},  # no apostrophe -- quirk
    "Tiger's Eye": {"atk_speed": (0.75, 7.5, 100)},  # apostrophe -- quirk
    "Sealed Curse": {"lethality": (3, 30, 100)},
    "Kokorite": {"lethality": (3, 30, 100)},
    "Prismatic Heart": {"crit_chance": (2, 20, 100), "crit_dmg": (0.5, 5, 100)},
    "Voidstar": {"crit_chance": (3.3, 33, 100), "crit_dmg": (1.5, 15, 100)},
    "Yeti Heart": {
        "crit_chance": (3, 30, 100),
        "crit_dmg": (1, 10, 100),
        "atk_speed": (1, 10, 100),
    },
    "Yang": {"crit_chance": (4, 40, 100), "crit_dmg": (1.8, 18, 100)},
    "Golem Heart": {"crit_chance": (4, 40, 100), "crit_dmg": (1.5, 15, 100)},
    "Onyx": {"crit_chance": (3.5, 35, 100), "crit_dmg": (1.75, 17.5, 100)},
    "Kyubite": {
        "crit_chance": (4, 40, 100),
        "crit_dmg": (1.8, 18, 100),
        "fire_dmg": (4.5, 45, 100),
        "fire_chance": (4.5, 45, 100),
        "fire_duration": (0.5, 5, 1),
    },
    "Rivalite": {"crit_chance": (2, 20, 100)},
    "Yin-Yang": {"crit_chance": (4.5, 45, 100), "crit_dmg": (2, 20, 100)},
    "Galaxite": {
        "crit_chance": (4.5, 45, 100),
        "crit_dmg": (2, 20, 100),
        "blackhole_dmg": (6, 60, 100),
    },
    "Moon Stone": {"moon": (2.5, 25, 100)},
    "Gargantuan": {
        "explosion_dmg": (5, 50, 100),
        "explosion_chance": (3.5, 35, 100),
        "fire_dmg": (2, 20, 100),
        "fire_chance": (2, 20, 100),
        "fire_duration": (0.2, 2, 1),
    },
    "Magmaite": {"explosion_dmg": (3.5, 35, 100), "explosion_chance": (2, 20, 100)},
    "Meteorite": {"explosion_dmg": (6, 60, 100), "explosion_chance": (2.5, 25, 100)},
    "Supermassive Black Hole": {
        "explosion_dmg": (6.5, 65, 100),
        "explosion_chance": (4.5, 45, 100),
        "fire_dmg": (5, 50, 100),
        # C62 fire chance is 4.5, NOT 5 (quirk vs C61)
        "fire_chance": (4.5, 45, 100),
        "fire_duration": (0.5, 5, 1),
    },
    "Sun Stone": {
        "fire_dmg": (3.5, 35, 100),
        "fire_chance": (3.5, 35, 100),
        "fire_duration": (0.5, 5, 1),
    },
    "Fireite": {
        "fire_dmg": (2, 20, 100),
        "fire_chance": (2, 20, 100),
        "fire_duration": (0.2, 2, 1),
    },
    "Malachite": {
        "poison_dmg": (1, 10, 100),
        "poison_chance": (3.3, 33, 100),
        "poison_duration": (0.3, 3, 1),
    },
    "Heavenite": {"smite_dmg": (2.5, 25, 100), "smite_chance": (4, 40, 100)},
}


def _matrix_as_tuples(matrix):
    return {
        ore: {stat: (e["base"], e["max"], e["divisor"]) for stat, e in stats.items()}
        for ore, stats in matrix.items()
    }


def test_expected_matrix_from_all_formulas_txt():
    formulas = load_formulas_from_txt(ROOT / "all_formulas.txt")
    matrix = parse_stat_matrix(formulas)
    assert _matrix_as_tuples(matrix) == EXPECTED


def test_matrix_has_exactly_the_known_ore_set():
    formulas = load_formulas_from_txt(ROOT / "all_formulas.txt")
    matrix = parse_stat_matrix(formulas)
    assert set(matrix) == set(EXPECTED)


def test_all_stat_cells_are_present_in_the_dump():
    formulas = load_formulas_from_txt(ROOT / "all_formulas.txt")
    missing = [cell for cell in STAT_CELLS if cell not in formulas]
    assert missing == []


def test_every_expected_stat_has_a_divisor_of_1_or_100():
    for ore, stats in EXPECTED.items():
        for stat, (_, _, divisor) in stats.items():
            assert divisor in (1, 100), f"{ore}.{stat} divisor {divisor}"
