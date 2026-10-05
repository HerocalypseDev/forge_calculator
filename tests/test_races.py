import math

import pytest

from forge_calculator.data import DEFAULT_DATA_DIR, load_game_data
from forge_calculator.engine import Build, calculate

DAGGER_DMG = 4.3
DAGGER_INTERVAL = 0.47


@pytest.fixture(scope="module")
def game():
    return load_game_data(DEFAULT_DATA_DIR)


def run(game, race, weapon="Dagger", bonus=""):
    return calculate(Build(weapon_name=weapon, race=race, bonus_weapon_type=bonus), game)


def test_orc_lord_brute_force_lethality(game):
    assert run(game, "Orc Lord").lethality == pytest.approx(0.40)


def test_orc_lord_smash_is_rate_capped_by_its_cooldown(game):
    r = run(game, "Orc Lord")
    expected = DAGGER_DMG * 1.0 * 0.25 * min(1 / DAGGER_INTERVAL, 1 / 10)
    assert r.smash_dps == pytest.approx(expected)
    assert r.total_dps == pytest.approx(r.weapon_dps + r.smash_dps)


def test_orc_lord_smash_feeds_max_burst(game):
    with_smash = run(game, "Orc Lord")
    all_crit_hit = with_smash.forged_damage * (1 + with_smash.lethality) * (1.45) * with_smash.attack_rate
    assert with_smash.max_dps == pytest.approx(all_crit_hit + with_smash.forged_damage)


def test_kitsune_stat_bonuses(game):
    r = run(game, "Kitsune")
    assert r.lethality == pytest.approx(0.20)
    assert r.atk_speed == pytest.approx(0.20)


def test_kitsune_fox_claws_steps_with_whole_attacks(game):
    r = run(game, "Kitsune")
    rate = 1.20 / DAGGER_INTERVAL
    assert r.fox_claws_dmg == pytest.approx(math.floor(rate) * 0.075)
    assert r.fox_claws_dps == pytest.approx(DAGGER_DMG * rate * math.floor(rate) * 0.075 * 0.5)


def test_kitsune_fox_claws_is_zero_below_one_hit_per_second(game):
    r = run(game, "Kitsune", weapon="Long Sword")
    assert r.attack_rate < 1
    assert r.fox_claws_dps == 0.0


def test_kitsune_foxfire_uptime(game):
    r = run(game, "Kitsune")
    rate = 1.20 / DAGGER_INTERVAL
    assert r.foxfire_dps == pytest.approx(DAGGER_DMG * 0.3 * min(1, 0.5 * rate * 2))
    slow = run(game, "Kitsune", weapon="Long Sword")
    assert slow.foxfire_dps == pytest.approx(slow.unforged_damage * 0.3 * 0.5 * slow.attack_rate * 2)


def test_kitsune_procs_add_to_every_total(game):
    r = run(game, "Kitsune")
    assert r.total_dps == pytest.approx(r.weapon_dps + r.fox_claws_dps + r.foxfire_dps)


def test_fairy_bonuses_need_a_spear(game):
    spear = run(game, "Fairy", weapon="Spear", bonus="Spear")
    assert spear.lethality == pytest.approx(0.15)
    assert spear.atk_speed == pytest.approx(0.15)
    dagger = run(game, "Fairy", bonus="Dagger")
    assert dagger.lethality == 0.0
    assert dagger.atk_speed == 0.0


@pytest.mark.parametrize("heavy", ["Great Sword", "Colossal Sword", "Great Axe", "Mace"])
def test_shadow_heavy_weapon_attack_speed(game, heavy):
    r = run(game, "Shadow", bonus=heavy)
    assert r.atk_speed == pytest.approx(0.25)
    assert r.lethality == pytest.approx(0.05)


def test_shadow_light_weapon_keeps_flat_bonus_only(game):
    assert run(game, "Shadow", bonus="Dagger").atk_speed == pytest.approx(0.10)


def test_elf_attack_speed(game):
    assert run(game, "Elf").atk_speed == pytest.approx(0.05)


def test_race_bonuses_are_counted_once(game):
    assert run(game, "Orc").lethality == pytest.approx(0.10)
    assert run(game, "Dragonborn").lethality == pytest.approx(0.12)
    assert run(game, "Goblin", bonus="Dagger").atk_speed == pytest.approx(0.10)
    assert run(game, "Felynx", bonus="Gauntlet").lethality == pytest.approx(0.20)
    assert run(game, "Felynx", bonus="Gauntlet").atk_speed == pytest.approx(0.20)


def test_minotaur_lethality(game):
    assert run(game, "Minotaur").lethality == pytest.approx(0.30)


def test_demon_straight_sword_lethality(game):
    assert run(game, "Demon", bonus="Straight Sword").lethality == pytest.approx(0.30)
    assert run(game, "Demon", bonus="Dagger").lethality == pytest.approx(0.20)


def test_dryad_has_no_dps_effect(game):
    assert run(game, "Dryad") == run(game, "")


@pytest.mark.parametrize("race", ["Human", "Minotaur", "Archangel", "Fairy", "Dryad"])
def test_new_procs_only_fire_for_their_race(game, race):
    r = run(game, race)
    assert r.smash_dps == 0.0
    assert r.fox_claws_dps == 0.0
    assert r.foxfire_dps == 0.0
