import math

import pytest

from forge_calculator.data import DEFAULT_DATA_DIR, load_game_data
from forge_calculator.engine import Build, OreSlot, calculate

DAGGER_DMG = 4.3
DAGGER_INTERVAL = 0.4667


@pytest.fixture(scope="module")
def game():
    return load_game_data(DEFAULT_DATA_DIR)


def _slots(*pairs):
    filled = [OreSlot(name, amount) for name, amount in pairs]
    return tuple(filled + [OreSlot()] * (4 - len(filled)))


def run(game, race, weapon="Dagger", bonus=""):
    return calculate(Build(weapon_name=weapon, race=race, bonus_weapon_type=bonus), game)


def test_orc_lord_brute_force_lethality(game):
    assert run(game, "Orc Lord").lethality == pytest.approx(0.40)


def test_orc_lord_smash_waits_out_its_cooldown(game):
    r = run(game, "Orc Lord")
    rate = 1 / DAGGER_INTERVAL
    expected = DAGGER_DMG * 1.0 / (10 + 1 / (0.25 * rate))
    assert r.smash_dps == pytest.approx(expected)
    assert r.total_dps == pytest.approx(r.weapon_dps + r.smash_dps)


def test_orc_lord_warbringer_and_lord_of_war_stack_after_the_caps(game):
    base = calculate(Build(weapon_name="Dagger", race="Orc Lord"), game)
    hurt = calculate(Build(weapon_name="Dagger", race="Orc Lord", orc_lord_hp_missing=0.47, orc_lord_kill_stacks=9), game)
    assert hurt.lethality == pytest.approx(base.lethality + 4 * 0.075)
    assert hurt.atk_speed == pytest.approx(base.atk_speed + 5 * 0.075)
    other = calculate(Build(weapon_name="Dagger", race="Orc", orc_lord_hp_missing=0.5, orc_lord_kill_stacks=5), game)
    assert other.lethality == pytest.approx(0.10)


def test_orc_lord_smash_feeds_max_burst(game):
    with_smash = run(game, "Orc Lord")
    all_crit_hit = with_smash.forged_damage * (1 + with_smash.lethality) * (1.45) * with_smash.attack_rate
    assert with_smash.max_dps == pytest.approx(all_crit_hit + with_smash.forged_damage)


def test_kitsune_stat_bonuses(game):
    r = run(game, "Kitsune")
    assert r.lethality == pytest.approx(0.20)
    assert r.atk_speed == pytest.approx(0.20)
    assert r.crit_dmg == pytest.approx(0.15)


def test_kitsune_fox_claws_spirits(game):
    r = run(game, "Kitsune")
    rate = 1.20 / DAGGER_INTERVAL
    assert r.fox_claws_dmg == pytest.approx(0.75)
    assert r.fox_claws_chance == pytest.approx(0.25)
    assert r.fox_claws_dps == pytest.approx(DAGGER_DMG * 0.75 * min(0.25 * rate, 3 / 2.22))


def test_kitsune_fox_claws_follow_attack_rate(game):
    r = run(game, "Kitsune", weapon="Long Sword")
    assert r.fox_claws_dps == pytest.approx(r.unforged_damage * 0.75 * 0.25 * r.attack_rate)


def test_kitsune_foxfire_uses_boosted_damage(game):
    r = run(game, "Kitsune")
    rate = 1.20 / DAGGER_INTERVAL
    assert r.foxfire_duration == 3.0
    assert r.foxfire_dps == pytest.approx(DAGGER_DMG * 1.2 * 0.3 * (1 - math.exp(-0.5 * rate * 3)))


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


@pytest.mark.parametrize("weapon_type", ["Great Sword", "Colossal Sword", "Great Axe", "Mace", "Dagger"])
def test_shadow_attack_speed_is_flat(game, weapon_type):
    r = run(game, "Shadow", bonus=weapon_type)
    assert r.atk_speed == pytest.approx(0.10)
    assert r.lethality == pytest.approx(0.05)


def test_elf_has_no_attack_speed(game):
    assert run(game, "Elf").atk_speed == 0.0


def test_golem_attack_speed_needs_a_heavy_weapon(game):
    assert run(game, "Golem", bonus="Colossal Sword").atk_speed == pytest.approx(0.15)
    assert run(game, "Golem", bonus="Great Axe").atk_speed == pytest.approx(0.15)
    assert run(game, "Golem", bonus="Mace").atk_speed == 0.0


def test_archangel_smite_is_a_cooldown_beam(game):
    r = run(game, "Archangel")
    assert r.smite_dmg == 0.0
    assert r.smite_chance == 0.0
    assert r.archangel_smite_dps == pytest.approx(1.5 * DAGGER_DMG / (10 + 1 / (0.33 * r.attack_rate)))


def test_angel_and_dragonborn_chances_do_not_stack(game):
    heaven = (calculate(Build(weapon_name="Dagger", race="Angel", slots=_slots(("Heavenite", 30))), game))
    assert heaven.smite_chance == pytest.approx(0.5)
    fire = calculate(Build(weapon_name="Dagger", race="Dragonborn", slots=_slots(("Kitsunite", 30))), game)
    assert fire.fire_chance == pytest.approx(0.5)
    assert fire.fire_dmg == pytest.approx(0.4 + 0.3)


def test_demon_fire_and_cursed_aura(game):
    r = run(game, "Demon")
    assert r.fire_dmg == pytest.approx(0.2)
    assert r.fire_duration == 3.0
    assert r.cursed_aura_dps == pytest.approx(0.1 * DAGGER_DMG)
    assert r.fire_dps > 0


def test_dryad_grove_and_vital_power(game):
    grove = calculate(Build(weapon_name="Dagger", race="Dryad", dryad_in_grove=True), game)
    assert grove.crit_chance == pytest.approx(0.15)
    assert grove.crit_dmg == pytest.approx(0.15)
    hp = calculate(Build(weapon_name="Dagger", race="Dryad", dryad_max_hp=12500), game)
    assert hp.trait_damage_multiplier == pytest.approx(1.5)
    assert calculate(Build(weapon_name="Dagger", race="Dryad", dryad_max_hp=3999), game).trait_damage_multiplier == pytest.approx(1.15)


def test_race_bonuses_are_counted_once(game):
    assert run(game, "Orc").lethality == pytest.approx(0.10)
    assert run(game, "Dragonborn").lethality == pytest.approx(0.12)
    assert run(game, "Goblin", bonus="Dagger").atk_speed == pytest.approx(0.10)
    assert run(game, "Felynx", bonus="Gauntlet").lethality == pytest.approx(0.20)
    assert run(game, "Felynx", bonus="Gauntlet").atk_speed == pytest.approx(0.20)


def test_minotaur_has_no_lethality(game):
    assert run(game, "Minotaur").lethality == 0.0


def test_demon_lethality_ignores_weapon_type(game):
    assert run(game, "Demon", bonus="Straight Sword").lethality == pytest.approx(0.20)
    assert run(game, "Demon", bonus="Dagger").lethality == pytest.approx(0.20)


def test_dryad_has_no_dps_effect(game):
    assert run(game, "Dryad") == run(game, "")


@pytest.mark.parametrize("race", ["Human", "Minotaur", "Archangel", "Fairy", "Dryad"])
def test_new_procs_only_fire_for_their_race(game, race):
    r = run(game, race)
    assert r.smash_dps == 0.0
    assert r.fox_claws_dps == 0.0
    assert r.foxfire_dps == 0.0
