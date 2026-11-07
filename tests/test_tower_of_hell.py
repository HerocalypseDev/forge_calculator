import math

import pytest

from forge_calculator.data import load_game_data
from forge_calculator.engine import Build, OreSlot, calculate, cooldown_rate


@pytest.fixture(scope="module")
def game():
    return load_game_data()


def solo(ore, weapon="Dagger", race="Human", amount=10.0, **kw):
    weapon_type = load_game_data().weapon(weapon).type
    return Build(slots=(OreSlot(ore, amount), OreSlot(), OreSlot(), OreSlot()),
                 weapon_name=weapon, race=race, bonus_weapon_type=weapon_type, **kw)


def spear(game):
    return next(w for w in game.weapons if w.type == "Spear")


def test_fallen_angel_pool_berserk_and_dark_smite(game):
    r = calculate(solo("Iron", race="Fallen Angel"), game)
    assert r.lethality == pytest.approx(0.20)
    assert r.atk_speed == pytest.approx(0.10)
    assert r.berserk_level == pytest.approx(0.30)
    assert r.dark_smite_dps == pytest.approx(r.unforged_damage * r.attack_rate * 0.35 * 31 / 101)


def test_imp_spear_bonuses_and_trident_toss(game):
    w = spear(game)
    r = calculate(solo("Iron", weapon=w.name, race="Imp"), game)
    assert r.lethality == pytest.approx(0.25)
    assert r.atk_speed == pytest.approx(0.20)
    assert r.trident_toss_dps == pytest.approx(r.unforged_damage * 1.2 * min(r.attack_rate, 1 / 8))
    assert r.fire_dps == 0


def test_imp_without_spear_gets_nothing(game):
    r = calculate(solo("Iron", race="Imp"), game)
    assert r.lethality == 0 and r.atk_speed == 0 and r.trident_toss_dps == 0


def test_frost_core_ramps_lethality_and_crit_damage(game):
    full = calculate(solo("Frost Core"), game)
    assert full.lethality == pytest.approx(0.15)
    assert full.crit_dmg == pytest.approx(0.10)
    half = calculate(Build(slots=(OreSlot("Frost Core", 1), OreSlot("Iron", 4), OreSlot(), OreSlot()),
                           weapon_name="Dagger"), game)
    assert half.lethality == pytest.approx((1.5 + 13.5 * 0.5) / 100)


def test_echotite_reverberation_by_weapon_type(game):
    dagger = calculate(solo("Echotite"), game)
    assert dagger.reverberation_chance == pytest.approx(0.20)
    assert dagger.reverberation_dps == pytest.approx(dagger.weapon_dps * 21 / 101)
    assert dagger.explosion_dmg == pytest.approx(0.50)
    assert dagger.explosion_chance == pytest.approx(0.40)
    w = spear(game)
    other = calculate(solo("Echotite", weapon=w.name), game)
    assert other.reverberation_chance == pytest.approx(0.08)


def test_tetrinite_poison_lightning_and_ancient_poison(game):
    r = calculate(solo("Tetrinite"), game)
    assert r.poison_dmg == pytest.approx(0.40)
    assert r.poison_chance == pytest.approx(0.75)
    assert r.poison_duration == pytest.approx(6)
    assert r.lightning_dmg == pytest.approx(0.70)
    assert r.lightning_cooldown == pytest.approx(4)
    uptime = 1 - (1 - 51 / 101) ** (r.attack_rate * 5)
    assert r.ancient_poison_dps == pytest.approx(r.poison_dps * 0.50 * uptime)


def test_frost_star_procs(game):
    r = calculate(solo("Frost Star"), game)
    rate, a18 = r.attack_rate, r.unforged_damage
    assert r.frost_slash_dps == pytest.approx(a18 * 0.25 * 31 / 101 * rate)
    assert r.glacier_explosion_dps == 0
    assert r.starfall_cooldown == pytest.approx(10)
    assert r.starfall_dps == pytest.approx(a18 * 1.25 * cooldown_rate(21 / 101, rate, 10))
    assert r.stellar_mark_dps == pytest.approx(a18 * 1.5 * rate / 5)
    assert r.lethality == pytest.approx(0.025)
    assert r.atk_speed == pytest.approx(0.025)


def test_starfall_with_galaxite_and_glacier_on_crits(game):
    b = Build(slots=(OreSlot("Frost Star", 10), OreSlot("Galaxite", 1), OreSlot(), OreSlot()),
              weapon_name="Dagger", armor_crit_chance=0.5)
    r = calculate(b, game)
    star = r.starfall_dmg
    assert r.starfall_dps == pytest.approx(r.unforged_damage * star * 1.8 * cooldown_rate(21 / 101, r.attack_rate, 10))
    assert r.glacier_explosion_dps == pytest.approx(
        r.unforged_damage * r.glacier_dmg * 51 / 101 * min(r.crit_chance, 1) * r.attack_rate)


def test_new_rows_join_every_total(game):
    r = calculate(solo("Frost Star", race="Fallen Angel"), game)
    extra = (r.dark_smite_dps + r.frost_slash_dps + r.starfall_dps + r.stellar_mark_dps
             + r.glacier_explosion_dps + r.reverberation_dps + r.ancient_poison_dps + r.trident_toss_dps)
    assert extra > 0
    rows = (r.weapon_dps + r.explosion_dps + r.fire_dps + r.poison_dps + r.smite_dps + r.blackhole_dps
            + r.lightning_dps + r.smash_dps + r.fox_claws_dps + r.foxfire_dps + r.archangel_smite_dps
            + r.cursed_aura_dps + r.golemite_dps + extra)
    assert r.total_dps == pytest.approx(rows)
    assert r.berserk == pytest.approx(r.total_dps + r.forged_damage * 0.30 * r.crit_blend * r.attack_rate)
    assert math.isfinite(r.max_dps) and r.max_dps > r.total_dps
