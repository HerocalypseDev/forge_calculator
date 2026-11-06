import pytest

from forge_calculator.data import load_game_data
from forge_calculator.engine import (
    Abilities,
    Build,
    Golemite,
    OreSlot,
    calculate,
    golemite_damage,
)


@pytest.fixture(scope="module")
def game():
    return load_game_data()


def run(game, *golemites, slots=None, abilities=Abilities(), race=""):
    pair = tuple(golemites) + (Golemite(),) * (2 - len(golemites))
    filled = slots or (OreSlot("Wolfarite", 30),)
    return calculate(
        Build(
            slots=tuple(filled) + (OreSlot(),) * (4 - len(filled)),
            weapon_name="Dagger",
            abilities=abilities,
            race=race,
            golemites=pair,
        ),
        game,
    )


def test_golemite_damage_ramps_from_level_13_to_25():
    assert golemite_damage(12, 100.0) == 0.0
    assert golemite_damage(13, 100.0) == pytest.approx(2.0)
    assert golemite_damage(19, 100.0) == pytest.approx(100 * (0.02 + 6 * 0.04 / 12))
    assert golemite_damage(25, 100.0) == pytest.approx(6.0)
    assert golemite_damage(40, 100.0) == pytest.approx(6.0)


def test_golemite_dps_joins_every_total_but_not_max_burst(game):
    base = run(game)
    r = run(game, Golemite(level=25), Golemite(level=13))
    expected = (0.06 + 0.02) * r.unforged_damage * 0.66666666666666
    assert r.golemite_dps == pytest.approx(expected)
    assert r.total_dps == pytest.approx(base.total_dps + expected)
    assert r.max_dps == pytest.approx(base.max_dps)
    berserk = run(game, Golemite(level=25), race="Minotaur")
    assert berserk.berserk == pytest.approx(run(game, race="Minotaur").berserk + berserk.golemite_dps)


def test_golemite_stats_feed_the_capped_pools(game):
    r = run(game, Golemite(lethality=0.1, crit_chance=0.05, crit_dmg=0.2, atk_speed=0.1), Golemite(lethality=0.05))
    base = run(game)
    assert r.lethality == pytest.approx(base.lethality + 0.15)
    assert r.crit_chance == pytest.approx(base.crit_chance + 0.05)
    assert r.crit_dmg == pytest.approx(base.crit_dmg + 0.2)
    assert r.atk_speed == pytest.approx(base.atk_speed + 0.1)
    capped = run(game, Golemite(lethality=5.0))
    assert capped.lethality == pytest.approx(3.0)


def test_golemite_dots_add_damage_and_max_chance_and_time(game):
    r = run(game, Golemite(fire_dmg=0.1, fire_chance=0.3, fire_time=4), Golemite(fire_dmg=0.05, fire_chance=0.2),
            abilities=Abilities(fire_dmg=0.02, fire_chance=0.1, fire_time=2))
    assert r.fire_dmg == pytest.approx(0.17)
    assert r.fire_chance == pytest.approx(0.3)
    assert r.fire_duration == 4.0
    p = run(game, Golemite(poison_dmg=0.04, poison_chance=0.25, poison_time=20))
    assert p.poison_dmg == pytest.approx(0.04)
    assert p.poison_chance == pytest.approx(0.25)
    assert p.poison_duration == 15.0


def test_golemite_blast_inside_the_cap_and_its_chance_feeds_explosion(game):
    r = run(game, Golemite(blast_dmg=2.0, blast_chance=0.3), Golemite(blast_dmg=1.0),
            abilities=Abilities(blast_dmg=0.1, blast_chance=0.1))
    assert r.explosion_dmg == pytest.approx(2.5)
    assert r.explosion_chance == pytest.approx(0.3)
    smite_only = run(game, Golemite(smite_dmg=0.4))
    assert smite_only.explosion_chance == 0.0


def test_golemite_smite_and_moon_sit_outside_their_caps(game):
    r = run(game, Golemite(smite_dmg=0.5, smite_chance=0.4), slots=(OreSlot("Heavenite", 100),), race="Angel")
    assert r.smite_dmg == pytest.approx(0.25 + 0.3 + 0.5)
    assert r.smite_chance == pytest.approx(0.5)
    moon = run(game, Golemite(moon=0.4), Golemite(moon=0.2), slots=(OreSlot("Moon Stone", 100),))
    assert moon.moon == pytest.approx(0.25 + 0.6)
    assert moon.moonstone == pytest.approx(moon.weapon_dps * 1.85 + (moon.total_dps - moon.weapon_dps))


def test_golemite_black_hole_and_resonance(game):
    alone = run(game, Golemite(blackhole_dmg=0.5, blackhole_chance=0.2, resonance_dmg=0.3))
    assert alone.blackhole_dmg == pytest.approx(0.8)
    assert alone.blackhole_chance == pytest.approx(0.2)
    assert alone.blackhole_dps > 0
    no_source = run(game, Golemite(resonance_dmg=0.3, blackhole_chance=0.2))
    assert no_source.blackhole_dmg == 0.0
    galaxite = run(game, Golemite(resonance_dmg=0.3), slots=(OreSlot("Galaxite", 30), OreSlot("Bismuth", 70)))
    assert galaxite.blackhole_dmg == pytest.approx(0.6 + 0.3 + 1.25)
    assert galaxite.blackhole_chance == pytest.approx(0.3)


def test_golemite_lightning_cooldown_needs_another_cooldown_source(game):
    alone = run(game, Golemite(lightning_dmg=0.4, lightning_chance=0.2, lightning_cooldown=3))
    assert alone.lightning_dmg == pytest.approx(0.4)
    assert alone.lightning_chance == pytest.approx(0.2)
    assert alone.lightning_cooldown == 10.0
    with_rune = run(game, Golemite(lightning_cooldown=3),
                    abilities=Abilities(lightning_dmg=0.2, lightning_cooldown=6))
    assert with_rune.lightning_cooldown == 3.0
