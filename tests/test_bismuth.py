import pytest

from forge_calculator.data import DEFAULT_DATA_DIR, load_game_data
from forge_calculator.engine import Abilities, Build, OreSlot, calculate


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


@pytest.mark.parametrize("share_amount", [1, 10, 90])
def test_bismuth_flat_procs_ignore_share(game, share_amount):
    r = run(game, ("Bismuth", share_amount), ("Ancienite", 100))
    assert r.explosion_dmg == pytest.approx(0.0875)
    assert r.explosion_chance == pytest.approx(0.0525)
    assert r.fire_dmg == pytest.approx(0.0325)
    assert r.fire_chance == pytest.approx(0.075)
    assert r.fire_duration == 0.0
    assert r.poison_dmg == pytest.approx(0.02)
    assert r.poison_chance == pytest.approx(0.09625)
    assert r.poison_duration == 0.0
    assert r.lightning_dmg == pytest.approx(0.10)
    assert r.lightning_chance == pytest.approx(0.05875)


def test_bismuth_flat_procs_apply_with_zero_amount(game):
    r = run(game, ("Bismuth", 0))
    assert r.explosion_dmg == pytest.approx(0.0875)
    assert r.lightning_dmg == pytest.approx(0.10)


def test_bismuth_attack_speed_ramps_like_any_ore(game):
    assert run(game, ("Bismuth", 5), ("Ancienite", 95)).atk_speed == 0.0
    assert run(game, ("Bismuth", 30), ("Ancienite", 70)).atk_speed == pytest.approx(0.18)


def test_bismuth_lightning_cooldown_caps_the_proc_rate(game):
    r = run(game, ("Bismuth", 10))
    rate = min(r.attack_rate, 1 / 0.375)
    assert r.lightning_dps == pytest.approx(r.unforged_damage * 0.10 * 0.05875 * rate)


def test_bismuth_poison_duration_beats_malachite(game):
    poison_rune = Abilities(poison_time=3.0)
    with_malachite = run(game, ("Malachite", 30), abilities=poison_rune)
    assert with_malachite.poison_duration == pytest.approx(1.0)
    both = run(game, ("Malachite", 30), ("Bismuth", 30), abilities=Abilities(poison_time=0.0))
    assert both.poison_duration == 0.0
    malachite_only = run(game, ("Malachite", 30))
    assert malachite_only.poison_duration == pytest.approx(1.0)


def test_galaxite_and_bismuth_add_the_rainbow_wave(game):
    galaxite = run(game, ("Galaxite", 30))
    both = run(game, ("Galaxite", 30), ("Bismuth", 0))
    assert both.blackhole_dmg == pytest.approx(galaxite.blackhole_dmg + 1.25)
    assert run(game, ("Bismuth", 30)).blackhole_dmg == 0.0


def test_dot_falls_back_to_whole_duration_damage_without_a_chance(game):
    r = calculate(Build(weapon_name="Dagger", abilities=Abilities(fire_dmg=0.1, fire_time=3.0)), game)
    assert r.fire_chance == 0.0
    assert r.fire_dps == pytest.approx(r.unforged_damage * 0.1 * (2.0 + 1))
    p = calculate(Build(weapon_name="Dagger", abilities=Abilities(poison_dmg=0.1)), game)
    assert p.poison_dps == pytest.approx(p.unforged_damage * 0.1 * 1)


def test_dot_keeps_the_refreshing_value_when_it_is_positive(game):
    r = calculate(Build(weapon_name="Dagger", abilities=Abilities(fire_dmg=0.1, fire_chance=0.2, fire_time=3.0)), game)
    expected = r.unforged_damage * 0.1 * min(1, 0.2 * r.attack_rate * 2.0)
    assert r.fire_dps == pytest.approx(expected)
