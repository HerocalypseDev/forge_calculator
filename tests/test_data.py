"""The committed data/*.json loads cleanly and matches the workbook's shape.

These tests pin the extraction counts (140 ores / 79 weapons / 16 races /
47 runes / 16 achievements) and the preserved quirks.  They run against the
committed JSON only -- no workbook, no openpyxl.
"""

import pytest

from forge_calculator.data import (
    DEFAULT_DATA_DIR,
    EXPECTED_COUNTS,
    GameData,
    load_game_data,
)


@pytest.fixture(scope="module")
def data() -> GameData:
    return load_game_data(DEFAULT_DATA_DIR)


def test_counts_match_workbook_extraction(data):
    assert {
        "ores": len(data.ores),
        "weapons": len(data.weapons),
        "races": len(data.races),
        "runes": len(data.runes),
        "achievements": len(data.achievements),
    } == EXPECTED_COUNTS


def test_no_duplicate_ore_names(data):
    names = [o.name for o in data.ores]
    assert len(set(names)) == len(names)


def test_every_ore_has_a_multiplier(data):
    for ore in data.ores:
        assert isinstance(ore.multiplier, float), ore.name


def test_weapon_type_lists(data):
    # C12: 10 weapon types
    assert len(data.weapon_types) == 10
    # C23: 5 race-bonus types -- note the PLURAL "Gauntlets" (quirk preserved)
    assert data.race_bonus_types == (
        "Dagger",
        "Straight Sword",
        "Gauntlets",
        "Great Axe",
        "Colossal Sword",
    )
    # every weapon's type is in the C12 list
    assert {w.type for w in data.weapons} == set(data.weapon_types)


def test_frost_fossil_stats_and_is_weapon(data):
    ore = data.ore("Frost Fossil")
    assert ore is not None
    assert ore.multiplier == pytest.approx(3.34)
    assert ore.is_weapon is True
    rng = ore.stat("lethality")
    assert rng is not None
    assert (rng.base, rng.max, rng.divisor) == (1.75, 17.5, 100)


def test_stone_has_no_stats_and_is_not_weapon(data):
    ore = data.ore("Stone")
    assert ore is not None
    assert ore.multiplier == pytest.approx(0.2)
    assert ore.equipment is None
    assert ore.stats == {}
    assert ore.is_weapon is False


def test_tigers_eye_apostrophe_quirk(data):
    # "Tiger's Eye" (apostrophe) is the catalog ore carrying atk_speed from C47;
    # the formula-only "Tigers Eye" (no apostrophe, C44 lethality) has no row.
    ore = data.ore("Tiger's Eye")
    assert ore is not None
    assert ore.stat("atk_speed") is not None
    assert ore.stat("lethality") is None
    assert data.ore("Tigers Eye") is None


def test_fire_duration_divisor_is_one(data):
    # Gargantuan fire_duration ramps in seconds, not percent -> divisor 1
    ore = data.ore("Gargantuan")
    assert ore.stat("fire_duration").divisor == 1
    assert ore.stat("explosion_dmg").divisor == 100
    assert ore.stat("explosion_chance").divisor == 100
    # Supermassive Black Hole quirk: fire_chance 4.5/45 vs fire_dmg 5/50
    sbh = data.ore("Supermassive Black Hole")
    assert (sbh.stat("fire_dmg").base, sbh.stat("fire_dmg").max) == (5.0, 50.0)
    assert (sbh.stat("fire_chance").base, sbh.stat("fire_chance").max) == (4.5, 45.0)


def test_rune_pool_has_no_none_placeholder(data):
    assert all(r.stat is not None for r in data.runes)
    assert all(r.name != "None" for r in data.runes)
    assert data.none_label == "None"


def test_achievements_none_first_then_bonuses(data):
    assert data.achievements[0].name == "None"
    assert data.achievements[0].stat is None
    bonuses = [a for a in data.achievements if a.name != "None"]
    assert len(bonuses) == 15
    assert all(a.stat is not None and a.value is not None for a in bonuses)


def test_lookup_helpers(data):
    assert data.ore("Does Not Exist") is None
    assert data.weapon("Dagger") is not None
    assert data.weapon("Dagger").type == "Dagger"
    assert data.race("Human") is not None
    assert len(data.weapons_by_type("Dagger")) >= 1
    assert all(w.type == "Dagger" for w in data.weapons_by_type("Dagger"))


def test_weapon_fields_are_numeric(data):
    for w in data.weapons:
        assert isinstance(w.interval, float), w.name
        assert isinstance(w.damage, float), w.name


def test_select_ore_label(data):
    assert data.select_ore == "Select Ore"


def test_load_missing_dir_raises(tmp_path):
    with pytest.raises(Exception):
        load_game_data(tmp_path / "nope")
