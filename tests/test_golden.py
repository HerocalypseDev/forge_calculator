"""End-to-end DPS golden tests.

* ``test_workbook_cached_golden`` reproduces the workbook's own cached result
  for its saved config -- the strongest possible check.  Dev-only: skips when
  openpyxl is absent or the workbook cache is missing.
* The rest are hand-computed and run anywhere with the committed ``data/``.
* ``test_engine_constants_match_source`` guards every hardcoded engine literal
  against the raw formula text so the constants cannot silently drift.
"""

import pytest

from forge_calculator.data import DEFAULT_DATA_DIR, load_game_data
from forge_calculator.engine import (
    Abilities,
    Build,
    OreSlot,
    calculate,
)

ROOT = DEFAULT_DATA_DIR.parent
WORKBOOK = ROOT / "reference" / "UpdatedSpreadsheet.xlsx"


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
        rune_cells=(c("C27") or "None", c("D27") or "None", c("E27") or "None",
                    c("C28") or "None", c("D28") or "None", c("E28") or "None",
                    c("C29") or "None", c("D29") or "None", c("E29") or "None"),
        base_crit_chance=c("C20") or 0.0,
        base_crit_dmg=c("C21") or 0.0,
        armor_crit_chance=c("C42") or 0.0,
        armor_crit_dmg=c("C43") or 0.0,
        armor_lethality=c("C44") or 0.0,
        base_lethality=c("A45") or 0.0,
        # One row per ability: Fire 34, Poison 35, Lightning 36, Blast 37,
        # with DMG/Chance/Time in columns C/D/E.
        abilities=Abilities(
            fire_dmg=c("C34") or 0.0, fire_chance=c("D34") or 0.0, fire_time=c("E34") or 0.0,
            poison_dmg=c("C35") or 0.0, poison_chance=c("D35") or 0.0, poison_time=c("E35") or 0.0,
            lightning_dmg=c("C36") or 0.0, lightning_chance=c("D36") or 0.0,
            lightning_cooldown=c("E36") or 0.0,
            blast_dmg=c("C37") or 0.0, blast_chance=c("D37") or 0.0,
        ),
        berserk=c("C54") or 0.0,
        achievement=c("C98") or "None",
    )
    r = calculate(build, game)

    assert r.avg_power == pytest.approx(c("E10"), rel=1e-9)
    assert r.unforged_damage == pytest.approx(c("A18"), rel=1e-9)
    assert r.forged_damage == pytest.approx(c("C18"), rel=1e-9)
    assert r.interval == pytest.approx(c("C19"), rel=1e-9)
    assert r.attack_rate == pytest.approx(c("E21"), rel=1e-9)
    assert r.lethality == pytest.approx(c("E45") or 0.0, rel=1e-9)
    assert r.crit_chance == pytest.approx(c("E46") or 0.0, rel=1e-9)
    assert r.crit_dmg == pytest.approx(c("E47") or 0.0, rel=1e-9)
    assert r.atk_speed == pytest.approx(c("E48") or 0.0, rel=1e-9)

    for cell, val in [
        ("C53", r.moon), ("C58", r.explosion_dmg), ("C59", r.explosion_chance),
        ("C62", r.fire_dmg), ("C63", r.fire_chance), ("C64", r.fire_duration),
        ("C67", r.poison_dmg), ("C68", r.poison_chance), ("C69", r.poison_duration),
        ("C72", r.smite_dmg), ("C73", r.smite_chance), ("C76", r.blackhole_dmg),
        ("C77", r.blackhole_chance), ("C80", r.lightning_dmg), ("C81", r.lightning_chance),
        ("C102", r.weapon_dps), ("C103", r.explosion_dps), ("C104", r.fire_dps),
        ("C105", r.poison_dps), ("C106", r.smite_dps), ("C107", r.blackhole_dps),
        ("E107", r.lightning_dps), ("C111", r.total_dps), ("C115", r.min_dps),
        ("E111", r.ttk_25k), ("E112", r.ttk_75k),
        ("C84", r.smash_dmg), ("C85", r.smash_chance), ("C108", r.smash_dps),
        ("C88", r.fox_claws_dmg), ("C89", r.fox_claws_chance), ("E108", r.fox_claws_dps),
        ("C92", r.foxfire_dmg), ("C93", r.foxfire_chance), ("C94", r.foxfire_duration),
        ("C109", r.foxfire_dps),
    ]:
        assert val == pytest.approx(c(cell) or 0.0, rel=1e-9), f"{cell}: {val} vs cached {c(cell)}"

    assert r.max_dps == pytest.approx(c("C116"), rel=1e-9)

    # C97/C98 fall back to C96 in the sheet when the bonus is 0; the engine uses None
    assert (r.berserk if r.berserk is not None else r.total_dps) == pytest.approx(
        c("C112"), rel=1e-9
    )
    assert (r.moonstone if r.moonstone is not None else r.total_dps) == pytest.approx(
        c("C113"), rel=1e-9
    )


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
    # C96 max burst = C18*(1+E44)*(C21+E46)*E21 + procs; C21 base crit dmg = 1.45
    assert r.max_dps == pytest.approx(255.05342042553187)


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
    # max-burst uses FORGED C18 for procs; C21 base crit dmg 1.45 added
    assert r.max_dps == pytest.approx(280.50638297872337)


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
    # E54 = 0 (C54) + 30% (Minotaur).  C97 multiplies the physical hit once --
    # C89*(1+E54) + procs -- rather than folding berserk into lethality, so with
    # no procs this is just weapon_dps * 1.3.
    build = Build(slots=(OreSlot("Wolfarite", 30), OreSlot(), OreSlot(), OreSlot()),
                  weapon_name="Dagger", race="Minotaur")
    r = calculate(build, game)
    assert r.berserk == pytest.approx(r.weapon_dps * 1.30)
    assert r.berserk == pytest.approx(288.32125787234037)
    # same build without the race -> N/A
    plain = Build(slots=(OreSlot("Wolfarite", 30), OreSlot(), OreSlot(), OreSlot()),
                  weapon_name="Dagger")
    assert calculate(plain, game).berserk is None


def test_berserk_caps_at_200_percent(game):
    build = Build(slots=(OreSlot("Wolfarite", 30), OreSlot(), OreSlot(), OreSlot()),
                  weapon_name="Dagger", race="Minotaur", berserk=5.0)
    r = calculate(build, game)
    assert r.berserk == pytest.approx(r.weapon_dps * 3.0)

    # just under the cap is untouched
    under = Build(slots=(OreSlot("Wolfarite", 30), OreSlot(), OreSlot(), OreSlot()),
                  weapon_name="Dagger", race="Minotaur", berserk=1.5)
    r_under = calculate(under, game)
    assert r_under.berserk == pytest.approx(r_under.weapon_dps * 2.80)


# --- engine-vs-source guard: every hardcoded constant must appear in the formulas ---


def _load_formulas():
    """Read the DPS sheet's formula strings straight from the workbook.

    The old ``all_formulas.txt`` dumps were deleted (and kept going stale against
    the workbook), so the workbook is now the only source.  Needs openpyxl.
    """
    openpyxl = pytest.importorskip("openpyxl")
    if not WORKBOOK.exists():
        pytest.skip(f"workbook not available: {WORKBOOK.name}")
    ws = openpyxl.load_workbook(WORKBOOK, data_only=False)["DPS Calculator"]
    out = {}
    for row in ws.iter_rows(min_row=1, max_row=125, min_col=1, max_col=12):
        for cell in row:
            val = cell.value
            val = getattr(val, "text", val)  # unwrap ArrayFormula
            if isinstance(val, str) and val.startswith("="):
                out[cell.coordinate] = val
    return out


def _guard(formulas, cell, fragment, label):
    assert cell in formulas, f"{label}: {cell} has no formula"
    assert fragment in formulas[cell], f"{label}: {fragment!r} not found in {cell}"


def test_engine_constants_match_source():
    formulas = _load_formulas()

    # forge SWITCH: level 9 = 1.5 (the pattern-breaking quirk)
    _guard(formulas, "C18", "1.5", "forge level 9")
    _guard(formulas, "C18", "SWITCH", "forge uses SWITCH")

    # E45 race/class lethality addends
    for frag in ["20%", "10%", "5%", "12%"]:
        _guard(formulas, "E45", frag, "race lethality")
    _guard(formulas, "E45", 'AND(C22="Felynx",C23="Gauntlet")', "E45 Felynx gauntlet")
    _guard(formulas, "E45", "150%", "lethality cap")

    # E48 race/class atk-speed addends (plural Gauntlets)
    _guard(formulas, "E48", 'AND(C22="Felynx",C23="Gauntlet")', "E48 Felynx gauntlet")
    _guard(formulas, "E48", "15%", "Golem class atk speed")
    _guard(formulas, "E48", "150%", "atk speed cap")

    # E46/E47 caps
    _guard(formulas, "E46", "100%", "crit chance cap")
    _guard(formulas, "E47", "100%", "crit dmg cap")

    # share gate and ramp
    _guard(formulas, "C45", "0.1", "share gate")
    _guard(formulas, "C45", "0.2", "share ramp span")

    # armor inputs folded into C45/C46/C47
    _guard(formulas, "C45", "+C44", "armor lethality wired into C45")
    _guard(formulas, "C46", "+C42", "armor CC wired into C46")
    _guard(formulas, "C47", "+C43", "armor CD wired into C47")

    # ability wiring -- one row per ability, DMG/Chance/Time in C/D/E
    _guard(formulas, "C58", "+ C37", "blast dmg input")
    _guard(formulas, "C59", "D37", "blast chance input")
    _guard(formulas, "C62", "+C34", "fire dmg input")
    _guard(formulas, "C63", "D34", "fire chance input")
    _guard(formulas, "C63", "0.4", "Dragonborn fire chance")
    _guard(formulas, "C64", "-1", "fire duration -1")
    _guard(formulas, "C64", '"Dragonborn",3', "Dragonborn fire time")
    _guard(formulas, "C67", "+C35", "poison dmg input")
    _guard(formulas, "C68", "D35", "poison chance input")
    _guard(formulas, "C69", "- 2", "poison duration -2")
    _guard(formulas, "C69", "XLOOKUP", "poison duration reads the first Malachite")
    _guard(formulas, "C80", "+C36", "lightning dmg input")
    _guard(formulas, "C81", "D36", "lightning chance input")
    _guard(formulas, "E80", "E36", "lightning cooldown input")

    # explosion aggregates additively (C58 via "+", C59 via SUM)
    _guard(formulas, "C59", "SUM(", "explosion chance sums across slots")

    # smite: Archangel damage steps with attack speed, chance is an added IFS
    _guard(formulas, "C72", "FLOOR(E21,1)*0.5", "Archangel smite dmg steps on E21")
    _guard(formulas, "C72", "1.5", "Archangel smite dmg cap")
    _guard(formulas, "C73", "0.5", "Angel smite chance")
    _guard(formulas, "C73", "0.33", "Archangel smite chance")

    # black hole
    _guard(formulas, "C77", "0.3", "black hole threshold value")
    _guard(formulas, "C77", "0.1", "black hole threshold ratio")
    _guard(formulas, "E77", "MAX(1,E21)", "black hole DPS floors its rate at 1")

    # berserk
    _guard(formulas, "E54", "30%", "Minotaur berserk")
    _guard(formulas, "E54", "C54", "berserk input")
    _guard(formulas, "C112", "E54", "berserk multiplies the physical hit")

    # procs on unforged A18; C89/C101 on forged C18.
    # (E58/E72 are not usable here -- _OptionsCrafter has same-named trait
    # cells -- so the pattern is proven via E59, E76 and C101.)
    _guard(formulas, "E59", "A18", "explosion dps on A18")
    _guard(formulas, "E76", "A18", "black hole dps on A18")
    _guard(formulas, "C116", "C18", "max-burst on C18")

    _guard(formulas, "E45", '"Orc Lord",40%', "Orc Lord lethality")
    _guard(formulas, "E45", '"Minotaur",30%', "Minotaur lethality")
    _guard(formulas, "E45", '"Kitsune",20%', "Kitsune lethality")
    _guard(formulas, "E45", 'AND(C22="Fairy",C23="Spear"),15%', "Fairy spear lethality")
    _guard(formulas, "E45", 'AND(C22="Demon",C23="Straight Sword"),10%', "Demon straight sword lethality")
    _guard(formulas, "E48", 'AND(C22="Fairy",C23="Spear"),15%', "Fairy spear atk speed")
    _guard(formulas, "E48", '"Elf",5%', "Elf atk speed")
    _guard(formulas, "E48", '"Kitsune",20%', "Kitsune atk speed")
    for heavy in ["Great Sword", "Colossal Sword", "Great Axe", "Mace"]:
        _guard(formulas, "E48", f'C23="{heavy}"', "Shadow heavy-weapon atk speed")
    for cell in ["C45", "C48"]:
        assert "C22" not in formulas[cell], f"{cell} must hold ore terms only"
    _guard(formulas, "C58", "MIN(2.5,", "explosion dmg per-slot cap")
    _guard(formulas, "C72", "MIN(2.5,", "smite dmg cap")

    _guard(formulas, "C84", '"Orc Lord",1', "smash dmg")
    _guard(formulas, "E84", '"Orc Lord",10', "smash cooldown")
    _guard(formulas, "C85", '"Orc Lord",0.25', "smash chance")
    _guard(formulas, "E85", "E13 * C84 * C85 * MIN(E21, 1/E84)", "smash dps")
    _guard(formulas, "C88", "MIN(FLOOR(E21,1)*0.075,0.75)", "fox claws dmg steps on E21")
    _guard(formulas, "C89", '"Kitsune",0.5', "fox claws chance")
    _guard(formulas, "E89", "A18*E21*C88*MIN(C89,1)", "fox claws dps")
    _guard(formulas, "C92", '"Kitsune",0.3', "foxfire dmg")
    _guard(formulas, "C93", '"Kitsune",0.5', "foxfire chance")
    _guard(formulas, "C94", '"Kitsune",2', "foxfire duration")
    _guard(formulas, "E93", "A18*C92*MIN(1,C93*E21*MIN(C94,5))", "foxfire dps uptime")
    _guard(formulas, "C111", "C108+E108+C109", "total includes the race procs")
    _guard(formulas, "C112", "C108+E108+C109", "berserk includes the race procs")
    _guard(formulas, "C113", "C108+E108+C109", "moon stone includes the race procs")
    _guard(formulas, "C116", "C84*C18", "max burst adds smash on forged C18")

    # E10 drops Fichilliumorite from both halves of the weighted average
    _guard(formulas, "E10", "Fichilliumorite", "E10 excludes Fichilliumorite")

    # active-trait power slope and weapon test
    _guard(formulas, "K6", "4.5", "trait power slope")
    _guard(formulas, "I6", '"eapon"', "is-weapon substring")
    _guard(formulas, "L6", "0.3", "trait30 threshold")
