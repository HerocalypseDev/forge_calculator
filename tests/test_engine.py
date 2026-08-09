"""Engine core math: share scaling, slots, power, forge, weapon base,
attack rate, rune totals, stat aggregation and caps.  Pure engine + data
(no workbook, no tkinter)."""

import pytest

from forge_calculator.data import DEFAULT_DATA_DIR, load_game_data
from forge_calculator.engine import (
    Abilities,
    Build,
    OreSlot,
    avg_ore_power,
    attack_rate,
    calculate,
    crit_blend,
    forge_multiplier,
    rune_totals,
    share_scaling,
    slot_shares,
    stat_totals,
    weapon_bases,
)


@pytest.fixture(scope="module")
def game():
    return load_game_data(DEFAULT_DATA_DIR)


# --- share_scaling: IF(share<0.1,0,(base+(max-base)*MIN((share-0.1)/0.2,1))/div) ---


def test_share_gate_below_ten_percent_is_zero():
    assert share_scaling(1.5, 15, 0.05) == 0.0
    assert share_scaling(1.5, 15, 0.0) == 0.0
    assert share_scaling(1.5, 15, 0.0999) == 0.0


def test_share_at_gate_equals_base():
    assert share_scaling(1.5, 15, 0.10) == pytest.approx(1.5 / 100)


def test_share_ramp_midpoint():
    # Wolfarite lethality: share 0.25 -> (1.5 + 0.75*(15-1.5))/100 = 0.11625
    assert share_scaling(1.5, 15, 0.25) == pytest.approx(0.11625)


def test_share_at_ramp_top_equals_max():
    assert share_scaling(1.5, 15, 0.30) == pytest.approx(15 / 100)


def test_share_clamped_above_ramp_top():
    assert share_scaling(1.5, 15, 0.5) == pytest.approx(15 / 100)
    assert share_scaling(1.5, 15, 1.0) == pytest.approx(15 / 100)


def test_share_duration_divisor_is_one():
    # fire_duration base 0.2 max 2.0, divisor 1 (no /100)
    assert share_scaling(0.2, 2.0, 1.0, divisor=1) == pytest.approx(2.0)


# --- slot_shares (J6:J9) ---


def test_slot_shares_even_split():
    slots = (OreSlot("A", 10), OreSlot("B", 10), OreSlot("Select Ore", 0), OreSlot("Select Ore", 0))
    assert slot_shares(slots) == (0.5, 0.5, 0.0, 0.0)


def test_slot_shares_zero_total():
    slots = (OreSlot("Select Ore", 0), OreSlot("Select Ore", 0), OreSlot("Select Ore", 0), OreSlot("Select Ore", 0))
    assert slot_shares(slots) == (0.0, 0.0, 0.0, 0.0)


def test_slot_shares_proportional():
    slots = (OreSlot("A", 10), OreSlot("B", 20), OreSlot("C", 30), OreSlot("D", 40))
    assert slot_shares(slots) == (0.1, 0.2, 0.3, 0.4)


# --- avg_ore_power (E10) ---


def test_avg_ore_power_golden(game):
    slots = (OreSlot("Ancienite", 10), OreSlot("Aetherit", 10), OreSlot("Select Ore", 0), OreSlot("Select Ore", 0))
    # (10*13.33 + 10*2.55)/20 = 7.94
    assert avg_ore_power(slots, game) == pytest.approx(7.94)


def test_avg_ore_power_all_select_ore_is_one(game):
    slots = (OreSlot(), OreSlot(), OreSlot(), OreSlot())
    assert avg_ore_power(slots, game) == pytest.approx(1.0)


def test_avg_ore_power_select_ore_slot_is_one(game):
    # A "Select Ore" slot with a nonzero amount pulls power toward 1 (E6 = 1)
    slots = (OreSlot("Ancienite", 10), OreSlot("Select Ore", 10), OreSlot("Select Ore", 0), OreSlot("Select Ore", 0))
    assert avg_ore_power(slots, game) == pytest.approx((10 * 13.33 + 10 * 1.0) / 20)


# --- forge_multiplier (C18 SWITCH) ---


def test_forge_multiplier_scale():
    assert forge_multiplier(0) == 1.0
    assert forge_multiplier(1) == 1.05
    assert forge_multiplier(4) == 1.2
    assert forge_multiplier(8) == 1.4


def test_forge_level_nine_breaks_pattern():
    # 0.05/level would give 1.45; the workbook pins level 9 to 1.5
    assert forge_multiplier(9) == 1.5


def test_forge_multiplier_out_of_range_defaults_to_one():
    # SWITCH default is 1 for any unmatched level
    assert forge_multiplier(10) == 1.0
    assert forge_multiplier(-1) == 1.0


# --- weapon_bases (A18 / C18) ---


def test_weapon_bases_golden_unforged_equals_forged(game):
    weapon = game.weapon("Demonic Spear")
    unforged, forged = weapon_bases(weapon, 7.94, quality=100, forge_level=0)
    # 9.0 * 7.94 * 2.0 = 142.92
    assert unforged == pytest.approx(142.92)
    assert forged == pytest.approx(142.92)


def test_weapon_bases_forge_scales_forged_only(game):
    weapon = game.weapon("Demonic Spear")
    unforged, forged = weapon_bases(weapon, 7.94, quality=100, forge_level=9)
    assert unforged == pytest.approx(142.92)
    assert forged == pytest.approx(142.92 * 1.5)


def test_weapon_bases_missing_weapon_is_one():
    assert weapon_bases(None, 7.94, 100, 9) == (1.0, 1.0)


# --- attack_rate (E21) ---


def test_attack_rate_golden(game):
    weapon = game.weapon("Demonic Spear")
    assert attack_rate(weapon, atk_speed_total=0.0) == pytest.approx(1 / 0.79)


def test_attack_rate_with_atk_speed(game):
    weapon = game.weapon("Demonic Spear")
    assert attack_rate(weapon, atk_speed_total=0.5) == pytest.approx(1.5 / 0.79)


def test_attack_rate_missing_weapon_interval_one():
    assert attack_rate(None, 0.0) == pytest.approx(1.0)


# --- rune_totals (A27-A31) ---


def test_rune_totals_sums_by_stat():
    cells = ("Lethality +10%", "Crit Chance +5%", "Atk Speed +8%", "Lethality +15%", "None", "Crit DMG +10%")
    totals = rune_totals(cells)
    assert totals["lethality"] == pytest.approx(0.25)
    assert totals["crit_chance"] == pytest.approx(0.05)
    assert totals["crit_dmg"] == pytest.approx(0.10)
    assert totals["atk_speed"] == pytest.approx(0.08)


def test_rune_totals_none_only():
    totals = rune_totals(("None",) * 6)
    assert totals == {"lethality": 0.0, "crit_chance": 0.0, "crit_dmg": 0.0, "atk_speed": 0.0}


# --- stat_totals (E44-E47) + caps ---


def test_stat_totals_empty_build_is_zero():
    build = Build()
    empty = {"lethality": 0.0, "crit_chance": 0.0, "crit_dmg": 0.0, "atk_speed": 0.0}
    assert stat_totals(build, game, empty) == empty


def test_stat_totals_caps(game):
    # A44 feeds E44; C41 feeds C45; C42 feeds C46 -- all capped.
    build = Build(base_lethality=10.0, armor_crit_chance=2.0, armor_crit_dmg=2.0)
    ore = {"lethality": 0.0, "crit_chance": 0.0, "crit_dmg": 0.0, "atk_speed": 0.0}
    totals = stat_totals(build, game, ore)
    assert totals["lethality"] == 1.5
    assert totals["crit_chance"] == 1.0
    assert totals["crit_dmg"] == 1.0


def test_stat_totals_race_lethality_bonuses(game):
    ore = {"lethality": 0.0, "crit_chance": 0.0, "crit_dmg": 0.0, "atk_speed": 0.0}
    for race, bonus in [("Archangel", 0.20), ("Demon", 0.20), ("Orc", 0.10), ("Shadow", 0.05), ("Dragonborn", 0.12)]:
        totals = stat_totals(Build(race=race), game, ore)
        assert totals["lethality"] == pytest.approx(bonus), race


def test_stat_totals_class_lethality_singular_gauntlet(game):
    ore = {"lethality": 0.0, "crit_chance": 0.0, "crit_dmg": 0.0, "atk_speed": 0.0}
    totals = stat_totals(Build(race="Felynx", bonus_weapon_type="Gauntlet"), game, ore)
    assert totals["lethality"] == pytest.approx(0.20)
    # the plural "Gauntlets" must NOT trigger the E44 class bonus (quirk)
    totals = stat_totals(Build(race="Felynx", bonus_weapon_type="Gauntlets"), game, ore)
    assert totals["lethality"] == pytest.approx(0.0)


def test_stat_totals_atk_speed_plural_gauntlets(game):
    ore = {"lethality": 0.0, "crit_chance": 0.0, "crit_dmg": 0.0, "atk_speed": 0.0}
    totals = stat_totals(Build(race="Felynx", bonus_weapon_type="Gauntlets"), game, ore)
    assert totals["atk_speed"] == pytest.approx(0.20)
    # singular "Gauntlet" must NOT trigger the E47 class bonus (quirk)
    totals = stat_totals(Build(race="Felynx", bonus_weapon_type="Gauntlet"), game, ore)
    assert totals["atk_speed"] == pytest.approx(0.0)


def test_stat_totals_achievement_feeds_correct_stat(game):
    ore = {"lethality": 0.0, "crit_chance": 0.0, "crit_dmg": 0.0, "atk_speed": 0.0}
    totals = stat_totals(Build(achievement="Damage Boost +4%"), game, ore)
    assert totals["lethality"] == pytest.approx(0.04)
    totals = stat_totals(Build(achievement="Crit Chance +7%"), game, ore)
    assert totals["crit_chance"] == pytest.approx(0.07)
    totals = stat_totals(Build(achievement="Attack Speed +12%"), game, ore)
    assert totals["atk_speed"] == pytest.approx(0.12)


# --- crit_blend (part of C84) ---


def test_crit_blend_no_crit_is_one():
    assert crit_blend(cc_total=0.0, cd_total=1.45) == pytest.approx(1.0)


def test_crit_blend_full_crit_is_cd():
    assert crit_blend(cc_total=1.0, cd_total=2.0) == pytest.approx(2.0)


def test_crit_blend_cc_capped_at_one():
    assert crit_blend(cc_total=1.5, cd_total=2.0) == pytest.approx(2.0)


def test_crit_blend_partial():
    # cc 0.5, cd 2.0 -> 0.5*2.0 + 0.5*1 = 1.5
    assert crit_blend(cc_total=0.5, cd_total=2.0) == pytest.approx(1.5)


# --- fire/poison duration without matching ores (C63/C68, gate removed) ---


def test_fire_ability_time_alone_counts(game):
    # no fire ore, no Dragonborn: fire_time 5 -> max(5,0)-1 = 4
    assert calculate(Build(abilities=Abilities(fire_time=5)), game).fire_duration == pytest.approx(4.0)
    # fire_time below the -1 offset stays 0
    assert calculate(Build(abilities=Abilities(fire_time=0.5)), game).fire_duration == pytest.approx(0.0)


def test_poison_ability_time_alone_counts(game):
    # no Malachite: poison_time 5 -> max(5,0)-2 = 3
    assert calculate(Build(abilities=Abilities(poison_time=5)), game).poison_duration == pytest.approx(3.0)


def test_fire_dragonborn_time_combines(game):
    # Dragonborn time 3 beats a 1s ability: max(3,1)-1 = 2
    assert calculate(Build(race="Dragonborn", abilities=Abilities(fire_time=1)), game).fire_duration == pytest.approx(2.0)
    # a longer ability time beats Dragonborn: max(3,5)-1 = 4
    assert calculate(Build(race="Dragonborn", abilities=Abilities(fire_time=5)), game).fire_duration == pytest.approx(4.0)


def test_poison_first_malachite_slot_wins(game):
    # first Malachite slot is below the 10% gate, a later one is not; C68's
    # XLOOKUP returns the FIRST slot only, so its 0 is never overridden.
    slots = (OreSlot("Malachite", 1), OreSlot("Stone", 9), OreSlot("Malachite", 10), OreSlot("Select Ore", 0))
    assert calculate(Build(slots=slots), game).poison_duration == pytest.approx(0.0)


def test_poison_first_malachite_combines_with_time(game):
    # a single high-share Malachite gives 3.0, maxed with poison_time 5 -> 3
    slots = (OreSlot("Malachite", 10), OreSlot("Select Ore", 0), OreSlot("Select Ore", 0), OreSlot("Select Ore", 0))
    r = calculate(Build(slots=slots, abilities=Abilities(poison_time=5)), game)
    assert r.poison_duration == pytest.approx(3.0)
