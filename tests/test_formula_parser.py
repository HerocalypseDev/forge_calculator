"""The stat-matrix parser must extract EXACTLY the known base/max/divisor table.

This is the guard against hand-typing: the matrix is derived from the formula
strings in the workbook itself (``reference/Extended.xlsx``).  The old
``all_formulas*.txt`` dumps are gone -- they kept drifting from the workbook,
which is the actual authority, so the tests read the workbook directly.

Entries are ``(base, max, divisor)``.  A gated flat (``IF(share<0.1, 0, value)``)
parses as ``base == max``.
"""

from pathlib import Path

import pytest

from build_data.formula_parser import STAT_CELLS, parse_stat_matrix

ROOT = Path(__file__).resolve().parent.parent
WORKBOOK = ROOT / "reference" / "UpdatedSpreadsheet.xlsx"

EXPECTED = {
    "Crimsonite": {"lethality": (2.0, 20.0, 100)},
    "Eye Ore": {"lethality": (1.5, 15.0, 100)},
    "Fierce Jade": {
        "lethality": (2.0, 20.0, 100),
        "crit_chance": (3.5, 35.0, 100),
        "crit_dmg": (2.0, 20.0, 100),
        "atk_speed": (1.5, 15.0, 100),
    },
    "Aetherit": {"atk_speed": (0.8, 8.0, 100)},
    "Fireite": {
        "fire_dmg": (2.0, 20.0, 100),
        "fire_chance": (3.0, 30.0, 100),
        "fire_duration": (0.2, 2.0, 1),
    },
    "Frost Fossil": {"lethality": (1.75, 17.5, 100)},
    "Galaxite": {
        "crit_chance": (4.5, 45.0, 100),
        "crit_dmg": (2.0, 20.0, 100),
        "blackhole_dmg": (6.0, 60.0, 100),
    },
    "Gargantuan": {
        "explosion_dmg": (5.0, 50.0, 100),
        "explosion_chance": (3.5, 35.0, 100),
        "fire_dmg": (2.0, 20.0, 100),
        "fire_chance": (3.0, 30.0, 100),
        "fire_duration": (0.2, 2.0, 1),
    },
    "Golem Heart": {
        "crit_chance": (4.0, 40.0, 100),
        "crit_dmg": (1.5, 15.0, 100),
    },
    "Heavenite": {
        "smite_dmg": (2.5, 25.0, 100),
        "smite_chance": (4.0, 40.0, 100),
    },
    "Kitsunite": {
        "explosion_dmg": (7.0, 70.0, 100),
        "explosion_chance": (4.0, 40.0, 100),
        "fire_dmg": (4.0, 40.0, 100),
        "fire_chance": (5.0, 50.0, 100),
        "fire_duration": (0.5, 5.0, 1),
        "smite_dmg": (5.0, 50.0, 100),
        "smite_chance": (5.0, 50.0, 100),
        "lightning_dmg": (8.0, 80.0, 100),
        "lightning_chance": (6.0, 60.0, 100),
        "lightning_cooldown": (3.0, 3.0, 1),
    },
    "Kokorite": {"lethality": (3.0, 30.0, 100)},
    "Kyubite": {
        "crit_chance": (4.0, 40.0, 100),
        "crit_dmg": (1.8, 18.0, 100),
        "fire_dmg": (4.5, 45.0, 100),
        "fire_chance": (4.0, 40.0, 100),
        "fire_duration": (0.5, 5.0, 1),
    },
    "Magmaite": {
        "explosion_dmg": (3.5, 35.0, 100),
        "explosion_chance": (2.0, 20.0, 100),
    },
    "Malachite": {
        "poison_dmg": (1.0, 10.0, 100),
        "poison_chance": (3.3, 33.0, 100),
        "poison_duration": (0.3, 3.0, 1),
    },
    "Marblite": {
        "lightning_dmg": (6.0, 60.0, 100),
        "lightning_chance": (4.0, 40.0, 100),
        "lightning_cooldown": (5.0, 5.0, 1),
    },
    "Meteorite": {
        "explosion_dmg": (6.0, 60.0, 100),
        "explosion_chance": (2.5, 25.0, 100),
    },
    "Moon Stone": {"moon": (2.5, 25.0, 100)},
    "Onyx": {
        "crit_chance": (3.5, 35.0, 100),
        "crit_dmg": (1.75, 17.5, 100),
    },
    "Prismatic Heart": {
        "crit_chance": (2.0, 20.0, 100),
        "crit_dmg": (0.5, 5.0, 100),
    },
    "Rivalite": {"crit_chance": (2.0, 20.0, 100)},
    "Sealed Curse": {"lethality": (3.0, 30.0, 100)},
    "Sun Stone": {
        "fire_dmg": (3.5, 35.0, 100),
        "fire_chance": (3.5, 35.0, 100),
        "fire_duration": (0.5, 5.0, 1),
    },
    "Supermassive Black Hole": {
        "explosion_dmg": (6.5, 65.0, 100),
        "explosion_chance": (4.5, 45.0, 100),
        "fire_dmg": (5.0, 50.0, 100),
        "fire_chance": (4.5, 45.0, 100),
        "fire_duration": (0.5, 5.0, 1),
    },
    "Tiger's Eye": {
        "lethality": (0.5, 5.0, 100),
        "atk_speed": (0.75, 7.5, 100),
    },
    "Bismuth": {"atk_speed": (18.0, 18.0, 100)},
    "Vanegos": {"lethality": (4.0, 40.0, 100)},
    "Voidstar": {
        "crit_chance": (3.3, 33.0, 100),
        "crit_dmg": (1.5, 15.0, 100),
    },
    "Wolfarite": {
        "lethality": (1.5, 15.0, 100),
        "atk_speed": (0.8, 8.0, 100),
    },
    "Yang": {
        "crit_chance": (4.0, 40.0, 100),
        "crit_dmg": (1.8, 18.0, 100),
    },
    "Yeti Heart": {
        "crit_chance": (3.0, 30.0, 100),
        "crit_dmg": (1.0, 10.0, 100),
        "atk_speed": (1.0, 10.0, 100),
    },
    "Yin-Yang": {
        "crit_chance": (4.5, 45.0, 100),
        "crit_dmg": (2.0, 20.0, 100),
    },
}


def _formula_text(ws, coord):
    """Formula string, unwrapping openpyxl's ArrayFormula (C69's XLOOKUP)."""
    val = ws[coord].value
    return getattr(val, "text", val) or ""


def _workbook_formulas(path, cells):
    openpyxl = pytest.importorskip("openpyxl")
    if not path.exists():
        pytest.skip(f"workbook not available: {path.name}")
    ws = openpyxl.load_workbook(path, data_only=False)["DPS Calculator"]
    return {cell: _formula_text(ws, cell) for cell in cells}


@pytest.fixture(scope="module")
def matrix():
    return parse_stat_matrix(_workbook_formulas(WORKBOOK, STAT_CELLS))


def _as_tuple(entry):
    base = (entry["base"], entry["max"], entry["divisor"])
    mods = {k: v for k, v in entry.items() if k not in ("base", "max", "divisor")}
    return base + (mods,) if mods else base


def _matrix_as_tuples(m):
    return {ore: {stat: _as_tuple(e) for stat, e in stats.items()} for ore, stats in m.items()}


def test_expected_matrix_from_workbook(matrix):
    assert _matrix_as_tuples(matrix) == EXPECTED


def test_matrix_has_exactly_the_known_ore_set(matrix):
    assert set(matrix) == set(EXPECTED)


def test_all_stat_cells_have_a_formula():
    formulas = _workbook_formulas(WORKBOOK, STAT_CELLS)
    missing = [cell for cell, text in formulas.items() if not text.startswith("=")]
    assert missing == []


def test_every_expected_stat_has_a_divisor_of_1_or_100():
    for ore, stats in EXPECTED.items():
        for stat, entry in stats.items():
            assert entry[2] in (1, 100), f"{ore}.{stat} divisor {entry[2]}"


def test_every_ore_stat_is_gated(matrix):
    odd = {
        (ore, stat)
        for ore, stats in matrix.items()
        for stat, e in stats.items()
        if e.get("gated") is False or e.get("floor") is not None or e.get("ceiling") is not None
    }
    assert odd == set()


def test_durations_use_divisor_one(matrix):
    """Seconds-valued ramps must not be divided by 100."""
    for ore, stats in matrix.items():
        for stat, entry in stats.items():
            if stat.endswith(("_duration", "_cooldown")):
                assert entry["divisor"] == 1, f"{ore}.{stat}"
