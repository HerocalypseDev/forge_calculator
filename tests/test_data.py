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
    assert len(data.weapon_types) == 11
    assert "Halberd" in data.weapon_types
    assert data.race_bonus_types == (
        "Dagger",
        "Straight Sword",
        "Gauntlet",
        "Great Axe",
        "Colossal Sword",
        "Spear",
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


def test_tigers_eye_carries_lethality_and_attack_speed(data):
    ore = data.ore("Tiger's Eye")
    assert ore is not None
    assert ore.stat("lethality") is not None
    assert ore.stat("atk_speed") is not None


def test_berserk_group_traits_parsed_from_trait_text(data):
    """phys_dmg/move_speed/berserk_duration have no DPS Calculator formula cell --

    they're parsed straight out of each ore's own trait10/trait30 sentences
    ("+X% Physical Damage and +Y% Movement Speed for Z second(s) when HP drops
    below 35%"), since every ore carrying this trait phrases it identically and
    the numbers follow the same base-at-10%-share -> max-at-30%-share ramp every
    formula-backed stat uses. Exactly 5 ores in the catalog have it.
    """
    expected = {
        "Sealed Curse": (2.0, 20.0, 0.6, 6.0),
        "Yin": (2.5, 25.0, 0.8, 8.0),
        "Kokorite": (2.5, 25.0, 0.8, 8.0),
        "Yin-Yang": (2.5, 25.0, 0.8, 8.0),
        "Fierce Jade": (3.5, 35.0, 1.0, 10.0),
    }
    found = {
        o.name for o in data.ores
        if o.stat("phys_dmg") or o.stat("move_speed") or o.stat("berserk_duration")
    }
    assert found == set(expected)

    for name, (pd_base, pd_max, dur_base, dur_max) in expected.items():
        ore = data.ore(name)
        phys = ore.stat("phys_dmg")
        move = ore.stat("move_speed")
        dur = ore.stat("berserk_duration")
        assert (phys.base, phys.max, phys.divisor) == (pd_base, pd_max, 100)
        assert (move.base, move.max, move.divisor) == (pd_base, pd_max, 100)
        assert (dur.base, dur.max, dur.divisor) == (dur_base, dur_max, 1)

    # an ore with no such trait sentence at all gets nothing invented
    assert data.ore("Wolfarite").stat("phys_dmg") is None


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


def test_weapon_type_ore_thresholds_from_f12():
    from pathlib import Path
    import json
    raw = json.loads((Path(__file__).resolve().parent.parent / "data" / "weapons.json").read_text(encoding="utf-8"))
    assert raw["type_min_ore"] == {
        "Dagger": 3, "Straight Sword": 4, "Mace": 7, "Gauntlet": 7, "Axe": 10, "Katana": 10,
        "Great Sword": 13, "Spear": 13, "Great Axe": 16, "Halberd": 16, "Colossal Sword": 21,
    }
    assert raw["not_enough_ore"] == "Not enough Ore"
    assert set(raw["type_min_ore"]) == set(raw["types"])
