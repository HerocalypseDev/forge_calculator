import pytest

from forge_calculator.data import DEFAULT_DATA_DIR, load_game_data
from forge_calculator.engine import Abilities, Build, OreSlot, calculate, dot_uptime, game_chance


@pytest.fixture(scope="module")
def game():
    return load_game_data(DEFAULT_DATA_DIR)


def slots(*pairs):
    filled = [OreSlot(name, amount) for name, amount in pairs]
    return tuple(filled + [OreSlot()] * (4 - len(filled)))


def run(game, *pairs, **kwargs):
    return calculate(Build(slots=slots(*pairs), weapon_name="Dagger", **kwargs), game)


def test_bismuth_ore_is_in_the_catalog(game):
    ore = game.ore("Bismuth")
    assert ore.multiplier == 8.0
    assert ore.is_weapon


def test_pumpkinite_ore_is_in_the_catalog(game):
    ore = game.ore("Pumpkinite")
    assert ore.multiplier == 1.5
    assert ore.stats == {}


@pytest.mark.parametrize("amount", [10, 50])
def test_bismuth_procs_are_one_eighth_of_each_t3_rune(game, amount):
    r = run(game, ("Bismuth", amount), ("Ancienite", 100 - amount))
    assert r.explosion_dmg == pytest.approx(0.0875)
    assert r.explosion_chance == pytest.approx(0.0525)
    assert r.fire_dmg == pytest.approx(0.0325)
    assert r.fire_chance == pytest.approx(0.075)
    assert r.fire_duration == pytest.approx(1.0)
    assert r.poison_dmg == pytest.approx(0.02)
    assert r.poison_chance == pytest.approx(0.09625)
    assert r.poison_duration == pytest.approx(1.5)
    assert r.lightning_dmg == pytest.approx(0.10)
    assert r.lightning_chance == pytest.approx(0.05875)
    assert r.lightning_cooldown == pytest.approx(0.375)


def test_bismuth_needs_ten_percent_share(game):
    r = run(game, ("Bismuth", 9), ("Ancienite", 91))
    assert (r.explosion_dmg, r.fire_dmg, r.poison_dmg, r.lightning_dmg, r.atk_speed) == (0.0, 0.0, 0.0, 0.0, 0.0)


def test_bismuth_attack_speed_ramps_like_any_ore(game):
    assert run(game, ("Bismuth", 10), ("Ancienite", 90)).atk_speed == pytest.approx(0.018)
    assert run(game, ("Bismuth", 30), ("Ancienite", 70)).atk_speed == pytest.approx(0.18)


def test_bismuth_poison_duration_is_one_more_term(game):
    assert run(game, ("Malachite", 30), ("Bismuth", 30)).poison_duration == pytest.approx(3.0)


def test_galaxite_and_bismuth_add_the_rainbow_wave_when_both_are_gated(game):
    galaxite = run(game, ("Galaxite", 30), ("Ancienite", 70))
    both = run(game, ("Galaxite", 30), ("Bismuth", 10), ("Ancienite", 60))
    assert both.blackhole_dmg == pytest.approx(galaxite.blackhole_dmg + 1.25)
    low = run(game, ("Galaxite", 30), ("Bismuth", 5), ("Ancienite", 65))
    assert low.blackhole_dmg == pytest.approx(run(game, ("Galaxite", 30), ("Ancienite", 70)).blackhole_dmg)


def test_game_chance_rolls_on_integers():
    assert game_chance(0.0, True) == pytest.approx(1 / 101)
    assert game_chance(0.30, True) == pytest.approx(31 / 101)
    assert game_chance(0.045, True) == pytest.approx(5 / 101)
    assert game_chance(1.5, True) == 1.0
    assert game_chance(0.5, False) == 0.0


def test_dot_without_a_chance_still_burns_one_percent(game):
    r = calculate(Build(weapon_name="Dagger", abilities=Abilities(fire_dmg=0.1, fire_time=3.0)), game)
    assert r.fire_duration == 3.0
    assert r.fire_dps == pytest.approx(r.unforged_damage * 0.1 * dot_uptime(1 / 101, r.attack_rate, 3.0))


def test_dot_duration_defaults_to_one_second_and_is_clamped(game):
    assert calculate(Build(weapon_name="Dagger", abilities=Abilities(poison_dmg=0.1)), game).poison_duration == 1.0
    assert calculate(Build(weapon_name="Dagger", abilities=Abilities(fire_dmg=0.1, fire_time=9.0)), game).fire_duration == 5.0
    assert calculate(Build(weapon_name="Dagger", abilities=Abilities(poison_dmg=0.1, poison_time=20.0)), game).poison_duration == 15.0
    assert calculate(Build(weapon_name="Dagger", abilities=Abilities(fire_time=3.0)), game).fire_duration == 0.0


def test_dot_uptime_follows_half_duration_refreshes():
    assert dot_uptime(0.0, 2.0, 3.0) == 0.0
    assert dot_uptime(0.1, 1.0, 2.0) == pytest.approx(0.2 / 1.1)
    assert dot_uptime(0.5, 2.0, 3.0) == 1.0
