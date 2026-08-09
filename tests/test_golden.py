"""End-to-end DPS golden tests.

* ``test_workbook_cached_golden`` reproduces the workbook's own cached result
  for its saved config -- the strongest possible check.  Dev-only: skips when
  openpyxl is absent or the workbook cache is missing.
* The rest are hand-computed and run anywhere with the committed ``data/``.
* ``test_engine_constants_match_source`` guards every hardcoded engine literal
  against the raw formula text so the constants cannot silently drift.
"""

import pytest

from build_data.formula_parser import load_formulas_from_txt
from forge_calculator.data import DEFAULT_DATA_DIR, load_game_data
from forge_calculator.engine import (
    Abilities,
    Build,
    OreSlot,
    calculate,
)

ROOT = DEFAULT_DATA_DIR.parent
WORKBOOK = ROOT / "reference" / "Copy of LittleTimmy's Calculator MAIN COPY (UP TO DATE) (1).xlsx"


@pytest.fixture(scope="module")
def game():
    return load_game_data(DEFAULT_DATA_DIR)


# --- workbook-cached golden (dev-only cross-check) ---


def _workbook_cache():
    """Return a ``cell_name -> cached_value`` callable, or None when unusable."""
    try:
        from openpyxl import load_workbook
    except ImportError:
        return None
    if not WORKBOOK.exists():
        return None
    wb = load_workbook(WORKBOOK, data_only=True)
    dps = wb["DPS Calculator"]
    if dps["E10"].value is None:  # cache not saved
        return None
    return lambda cell: dps[cell].value


def test_workbook_cached_golden(game):
    c = _workbook_cache()
    if c is None:
        pytest.skip("workbook cache absent (openpyxl or cached values)")

    build = Build(
        slots=(
            OreSlot(c("C6"), c("D6") or 0.0),
            OreSlot(c("C7"), c("D7") or 0.0),
            OreSlot(c("C8"), c("D8") or 0.0),
            OreSlot(c("C9"), c("D9") or 0.0),
        ),
        weapon_name=c("D12") or "",
        quality=c("E12") or 0.0,
        forge_level=int(c("C13") or 0),
        race=c("C22") or "",
        bonus_weapon_type=c("C23") or "",
        rune_cells=(c("C27") or "None", c("D27") or "None", c("C28") or "None",
                    c("D28") or "None", c("C29") or "None", c("D29") or "None"),
        base_crit_chance=c("C20") or 0.0,
        base_crit_dmg=c("C21") or 0.0,
        armor_crit_chance=c("C41") or 0.0,
        armor_crit_dmg=c("C42") or 0.0,
        armor_lethality=c("C43") or 0.0,
        base_lethality=c("A44") or 0.0,
        abilities=Abilities(
            fire_dmg=c("C34") or 0.0, fire_chance=c("C35") or 0.0, fire_time=c("C36") or 0.0,
            poison_dmg=c("D34") or 0.0, poison_chance=c("D35") or 0.0, poison_time=c("D36") or 0.0,
            blast_dmg=c("E34") or 0.0, blast_chance=c("E35") or 0.0,
        ),
        berserk=c("C53") or 0.0,
        achievement=c("C80") or "None",
    )
    r = calculate(build, game)

    assert r.avg_power == pytest.approx(c("E10"), rel=1e-9)
    assert r.unforged_damage == pytest.approx(c("A18"), rel=1e-9)
    assert r.forged_damage == pytest.approx(c("C18"), rel=1e-9)
    assert r.interval == pytest.approx(c("C19"), rel=1e-9)
    assert r.attack_rate == pytest.approx(c("E21"), rel=1e-9)
    assert r.lethality == pytest.approx(c("E44") or 0.0, rel=1e-9)
    assert r.crit_chance == pytest.approx(c("E45") or 0.0, rel=1e-9)
    assert r.crit_dmg == pytest.approx(c("E46") or 0.0, rel=1e-9)
    assert r.atk_speed == pytest.approx(c("E47") or 0.0, rel=1e-9)

    for cell, val in [
        ("C52", r.moon), ("C57", r.explosion_dmg), ("C58", r.explosion_chance),
        ("C61", r.fire_dmg), ("C62", r.fire_chance), ("C63", r.fire_duration),
        ("C66", r.poison_dmg), ("C67", r.poison_chance), ("C68", r.poison_duration),
        ("C71", r.smite_dmg), ("C72", r.smite_chance), ("C75", r.blackhole_dmg),
        ("C76", r.blackhole_chance),
        ("C84", r.weapon_dps), ("C85", r.explosion_dps), ("C86", r.fire_dps),
        ("C87", r.poison_dps), ("C88", r.smite_dps), ("C89", r.blackhole_dps),
        ("C91", r.total_dps), ("C95", r.min_dps), ("C96", r.max_dps),
        ("E91", r.ttk_25k), ("E92", r.ttk_75k),
    ]:
        assert val == pytest.approx(c(cell) or 0.0, rel=1e-9), f"{cell}: {val} vs cached {c(cell)}"

    # berserk/moonstone mirror the workbook's "N/A" sentinel
    assert (r.berserk is None) == (c("C92") == "N/A")
    assert (r.moonstone is None) == (c("C93") == "N/A")


# --- hand-computed single-ore cases ---


def test_wolfarite_single_slot(game):
    # Wolfarite share 1.0 -> lethality 15/100, atk_speed 8/100.
    # Dagger: damage 4.3, interval 0.47; quality 0, forge 0.
    build = Build(slots=(OreSlot("Wolfarite", 30), OreSlot(), OreSlot(), OreSlot()),
                  weapon_name="Dagger")
    r = calculate(build, game)
    assert r.lethality == pytest.approx(0.15)
    assert r.atk_speed == pytest.approx(0.08)
    assert r.avg_power == pytest.approx(15.48)          # Wolfarite multiplier
    assert r.unforged_damage == pytest.approx(4.3 * 15.48)
    assert r.attack_rate == pytest.approx(1.08 / 0.47)
    # C84 = 66.564 * 1.15 * 1.0 (blend, no crit) * 2.29787234
    assert r.weapon_dps == pytest.approx(175.89891063829785)
    assert r.total_dps == pytest.approx(r.weapon_dps)   # no procs
    assert r.min_dps == pytest.approx(r.weapon_dps)     # blend==1
    assert r.max_dps == pytest.approx(0.0)              # no crit dmg, no procs


def test_wolfarite_exactly_at_gate_is_base_not_zero(game):
    # share exactly 0.10 -> the gate is share<0.1, so base value applies
    build = Build(slots=(OreSlot("Wolfarite", 3), OreSlot("Stone", 27), OreSlot(), OreSlot()),
                  weapon_name="Dagger")
    r = calculate(build, game)
    assert r.lethality == pytest.approx(0.015)          # 1.5/100
    assert r.atk_speed == pytest.approx(0.008)          # 0.8/100


def test_gargantuan_procs(game):
    # Gargantuan share 1.0: explosion 50%/35%, fire 20%/20%, duration 2-1=1
    build = Build(slots=(OreSlot("Gargantuan", 30), OreSlot(), OreSlot(), OreSlot()),
                  weapon_name="Dagger")
    r = calculate(build, game)
    assert r.explosion_dmg == pytest.approx(0.5)
    assert r.explosion_chance == pytest.approx(0.35)
    assert r.fire_dmg == pytest.approx(0.2)
    assert r.fire_chance == pytest.approx(0.2)
    assert r.fire_duration == pytest.approx(1.0)        # 2.0 - 1 quirk
    assert r.explosion_dps == pytest.approx(24.01595744680851)
    assert r.fire_dps == pytest.approx(5.48936170212766)
    assert r.total_dps == pytest.approx(166.73936170212767)
    # max-burst uses FORGED C18 for procs
    assert r.max_dps == pytest.approx(81.51702127659576)


def test_malachite_poison(game):
    # Malachite share 1.0: poison 10%/33%, duration 3-2=1
    build = Build(slots=(OreSlot("Malachite", 30), OreSlot(), OreSlot(), OreSlot()),
                  weapon_name="Dagger")
    r = calculate(build, game)
    assert r.poison_dmg == pytest.approx(0.1)
    assert r.poison_chance == pytest.approx(0.33)
    assert r.poison_duration == pytest.approx(1.0)      # 3.0 - 2 quirk
    assert r.poison_dps == pytest.approx(1.9322553191489364)


def test_galaxite_black_hole_c76(game):
    # Galaxite share 1.0: blackhole 60%, and any Galaxite slot triggers C76=0.3
    build = Build(slots=(OreSlot("Galaxite", 30), OreSlot(), OreSlot(), OreSlot()),
                  weapon_name="Dagger")
    r = calculate(build, game)
    assert r.blackhole_dmg == pytest.approx(0.6)
    assert r.blackhole_chance == pytest.approx(0.3)     # COUNTIF/COUNTA = 1/4 >= 0.1
    assert r.crit_chance == pytest.approx(0.45)
    assert r.crit_dmg == pytest.approx(0.2)
    assert r.blackhole_dps == pytest.approx(41.170212765957444)


def test_black_hole_chance_requires_galaxite(game):
    build = Build(slots=(OreSlot("Wolfarite", 30), OreSlot(), OreSlot(), OreSlot()),
                  weapon_name="Dagger")
    assert calculate(build, game).blackhole_chance == 0.0


def test_minotaur_berserk(game):
    # E53 = 0 (C53) + 30% (Minotaur); C92 = procs + C18*(1+MIN(0.15+0.30,1.5))*blend*E21
    build = Build(slots=(OreSlot("Wolfarite", 30), OreSlot(), OreSlot(), OreSlot()),
                  weapon_name="Dagger", race="Minotaur")
    r = calculate(build, game)
    assert r.berserk == pytest.approx(221.78558297872337)
    # same build without the race -> N/A
    plain = Build(slots=(OreSlot("Wolfarite", 30), OreSlot(), OreSlot(), OreSlot()),
                  weapon_name="Dagger")
    assert calculate(plain, game).berserk is None


# --- engine-vs-source guard: every hardcoded constant must appear in the formulas ---


def _load_formulas():
    return load_formulas_from_txt(ROOT / "reference" / "all_formulas.txt")


def _guard(formulas, cell, fragment, label):
    assert fragment in formulas[cell], f"{label}: {fragment!r} not found in {cell}"


def test_engine_constants_match_source():
    formulas = _load_formulas()

    # forge SWITCH: level 9 = 1.5 (the pattern-breaking quirk)
    _guard(formulas, "C18", "1.5", "forge level 9")
    _guard(formulas, "C18", "SWITCH", "forge uses SWITCH")

    # E44 race/class lethality addends
    for frag in ["20%", "10%", "5%", "12%"]:
        _guard(formulas, "E44", frag, "race lethality")
    _guard(formulas, "E44", '"Gauntlet"', "E44 class bonus singular")
    _guard(formulas, "E44", "150%", "lethality cap")

    # E47 race/class atk-speed addends (plural Gauntlets)
    _guard(formulas, "E47", '"Gauntlets"', "E47 class bonus plural")
    _guard(formulas, "E47", "15%", "Golem class atk speed")
    _guard(formulas, "E47", "150%", "atk speed cap")

    # E45/E46 caps
    _guard(formulas, "E45", "100%", "crit chance cap")
    _guard(formulas, "E46", "100%", "crit dmg cap")

    # share gate and ramp
    _guard(formulas, "C44", "0.1", "share gate")
    _guard(formulas, "C44", "0.2", "share ramp span")

    # armor inputs folded into C44/C45/C46
    _guard(formulas, "C44", "+C43", "armor lethality wired into C44")
    _guard(formulas, "C45", "+C41", "armor CC wired into C45")
    _guard(formulas, "C46", "+C42", "armor CD wired into C46")

    # proc wiring
    _guard(formulas, "C57", "+E34", "blast dmg input")
    _guard(formulas, "C58", "E35", "blast chance input")
    _guard(formulas, "C61", "+C34", "fire dmg input")
    _guard(formulas, "C62", "0.4", "Dragonborn fire chance")
    _guard(formulas, "C63", "-1", "fire duration -1")
    _guard(formulas, "C63", '"Dragonborn",3', "Dragonborn fire time")
    _guard(formulas, "C66", "+D34", "poison dmg input")
    _guard(formulas, "C68", "-2", "poison duration -2")
    _guard(formulas, "C71", "150%", "Archangel smite dmg")
    _guard(formulas, "C72", "50%", "Angel smite chance")
    _guard(formulas, "C72", "33%", "Archangel smite chance")
    _guard(formulas, "C76", "0.3", "black hole threshold value")
    _guard(formulas, "C76", "0.1", "black hole threshold ratio")

    # berserk
    _guard(formulas, "E53", "30%", "Minotaur berserk")
    _guard(formulas, "E53", "C53", "berserk input")

    # procs on unforged A18; C84/C96 on forged C18.
    # (E58/E72 are not usable here -- _OptionsCrafter has same-named trait
    # cells -- so the pattern is proven via E57, E76 and C96.)
    _guard(formulas, "E57", "A18", "explosion dps on A18")
    _guard(formulas, "E76", "A18", "black hole dps on A18")
    _guard(formulas, "C96", "C18", "max-burst on C18")

    # active-trait power slope and weapon test
    _guard(formulas, "K6", "4.5", "trait power slope")
    _guard(formulas, "I6", '"eapon"', "is-weapon substring")
    _guard(formulas, "L6", "0.3", "trait30 threshold")
