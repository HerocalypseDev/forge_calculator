"""Trait/rune/achievement/ore-power parsers mirror the workbook's substring logic."""

from forge_calculator.parse import parse_ore_power, parse_trait


# --- parse_trait: the rune vocabulary (formulas A27-A31) ---


def test_rune_vocabulary():
    assert parse_trait("Lethality +14%") == ("lethality", 0.14)
    assert parse_trait("Crit Chance +5%") == ("crit_chance", 0.05)
    assert parse_trait("Crit DMG +10%") == ("crit_dmg", 0.10)
    assert parse_trait("Atk Speed +8%") == ("atk_speed", 0.08)


def test_achievement_vocabulary_damage_boost_feeds_lethality():
    # E44/E45/E47 vocabulary; "Damage Boost" is checked first and feeds lethality
    assert parse_trait("Damage Boost +4%") == ("lethality", 0.04)
    assert parse_trait("Attack Speed +20%") == ("atk_speed", 0.20)


def test_parse_trait_rejects_none_and_empty():
    assert parse_trait("None") is None
    assert parse_trait("None") is None
    assert parse_trait("") is None
    assert parse_trait("  ") is None
    assert parse_trait(None) is None


def test_parse_trait_rejects_unrecognized_text():
    # "Physical Damage +5%" (a race default trait) is not in the vocabulary
    assert parse_trait("Physical Damage +5%") is None
    assert parse_trait("Deals 10% weapon damage/s during combat") is None


def test_parse_trait_value_drops_exactly_one_trailing_char():
    # MID(cell, FIND("+")+1, LEN-FIND-1): everything after first +, minus one char.
    # "+7%" -> "7" -> 7/100 = 0.07 (NOT 0.7: the % is dropped, not parsed).
    assert parse_trait("Crit Chance +7%") == ("crit_chance", 0.07)
    # "+7" leaves an empty remainder after dropping one char -> None (workbook quirk).
    assert parse_trait("Crit Chance +7") is None


def test_parse_trait_case_insensitive():
    assert parse_trait("lethality +15%") == ("lethality", 0.15)
    assert parse_trait("CRIT CHANCE +10%") == ("crit_chance", 0.10)


# --- parse_ore_power: IFERROR(VALUE(SUBSTITUTE(...,"x","")),1) ---


def test_ore_power_strips_x():
    assert parse_ore_power("2.33x") == 2.33
    assert parse_ore_power("3.34x") == 3.34


def test_ore_power_zero():
    assert parse_ore_power("0x") == 0.0


def test_ore_power_malformed_falls_back_to_one():
    assert parse_ore_power("bogus") == 1.0
    assert parse_ore_power(None) == 1.0
    assert parse_ore_power("") == 1.0
