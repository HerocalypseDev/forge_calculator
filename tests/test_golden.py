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
    cooldown_rate,
    dot_uptime,
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
    build = Build(slots=(OreSlot("Gargantuan", 30), OreSlot(), OreSlot(), OreSlot()),
                  weapon_name="Dagger")
    r = calculate(build, game)
    a, rate = r.unforged_damage, r.attack_rate
    assert r.explosion_dmg == pytest.approx(0.5)
    assert r.explosion_chance == pytest.approx(0.35)
    assert r.fire_dmg == pytest.approx(0.2)
    assert r.fire_chance == pytest.approx(0.3)
    assert r.fire_duration == pytest.approx(2.0)
    assert r.explosion_dps == pytest.approx(a * 0.5 * 36 / 101 * rate)
    assert r.fire_dps == pytest.approx(a * 0.2 * dot_uptime(31 / 101, rate, 2.0))
    assert r.total_dps == pytest.approx(r.weapon_dps + r.explosion_dps + r.fire_dps)
    assert r.max_dps == pytest.approx(280.50638297872337)


def test_malachite_poison(game):
    build = Build(slots=(OreSlot("Malachite", 30), OreSlot(), OreSlot(), OreSlot()),
                  weapon_name="Dagger")
    r = calculate(build, game)
    assert r.poison_dmg == pytest.approx(0.1)
    assert r.poison_chance == pytest.approx(0.33)
    assert r.poison_duration == pytest.approx(3.0)
    assert r.poison_dps == pytest.approx(r.unforged_damage * 0.1 * dot_uptime(34 / 101, r.attack_rate, 3.0))


def test_galaxite_black_hole_c76(game):
    build = Build(slots=(OreSlot("Galaxite", 30), OreSlot(), OreSlot(), OreSlot()),
                  weapon_name="Dagger")
    r = calculate(build, game)
    assert r.blackhole_dmg == pytest.approx(0.6)
    assert r.blackhole_chance == pytest.approx(0.3)
    assert r.crit_chance == pytest.approx(0.45)
    assert r.crit_dmg == pytest.approx(0.2)
    assert r.blackhole_dps == pytest.approx(r.unforged_damage * 0.6 * cooldown_rate(31 / 101, r.attack_rate, 1.0))


def test_black_hole_chance_needs_ten_percent_galaxite(game):
    build = Build(slots=(OreSlot("Wolfarite", 30), OreSlot(), OreSlot(), OreSlot()),
                  weapon_name="Dagger")
    assert calculate(build, game).blackhole_chance == 0.0
    low = Build(slots=(OreSlot("Galaxite", 1), OreSlot("Wolfarite", 29), OreSlot(), OreSlot()),
                weapon_name="Dagger")
    assert calculate(low, game).blackhole_chance == 0.0


def test_minotaur_berserk_adds_to_lethality(game):
    build = Build(slots=(OreSlot("Wolfarite", 30), OreSlot(), OreSlot(), OreSlot()),
                  weapon_name="Dagger", race="Minotaur")
    r = calculate(build, game)
    assert r.berserk == pytest.approx(r.weapon_dps * (1 + 0.15 + 0.30) / (1 + 0.15))
    plain = Build(slots=(OreSlot("Wolfarite", 30), OreSlot(), OreSlot(), OreSlot()),
                  weapon_name="Dagger")
    assert calculate(plain, game).berserk is None


def test_berserk_input_caps_at_200_percent_before_minotaur(game):
    build = Build(slots=(OreSlot("Wolfarite", 30), OreSlot(), OreSlot(), OreSlot()),
                  weapon_name="Dagger", race="Minotaur", berserk=5.0)
    r = calculate(build, game)
    assert r.berserk_level == pytest.approx(2.3)
    assert r.berserk == pytest.approx(r.weapon_dps * (1 + 0.15 + 2.3) / 1.15)
    under = Build(slots=(OreSlot("Wolfarite", 30), OreSlot(), OreSlot(), OreSlot()),
                  weapon_name="Dagger", berserk=1.5)
    assert calculate(under, game).berserk_level == pytest.approx(1.5)


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

    _guard(formulas, "C18", "1.5", "forge level 9")
    _guard(formulas, "C18", "SWITCH", "forge uses SWITCH")

    for frag in ['"Orc Lord", 0.4', '"Archangel", 0.2', '"Demon", 0.2', '"Dragonborn", 0.12', '"Orc", 0.1', '"Shadow", 0.05']:
        _guard(formulas, "E45", frag, "race lethality")
    _guard(formulas, "E45", 'AND(C22="Felynx", C23="Gauntlet"), 0.2', "E45 Felynx gauntlet")
    _guard(formulas, "E45", 'AND(C22="Vampire", C23="Straight Sword"), 0.1', "Vampire straight sword lethality")
    _guard(formulas, "E45", "0), 3)", "lethality cap")
    _guard(formulas, "E45", '+IF(C22="Kitsune",0.2,0)+IF(AND(C22="Fairy",C23="Spear"),0.15,0)', "Kitsune / Fairy added after the cap")
    _guard(formulas, "E45", 'IF(C22="Orc Lord",INT(MIN(1,MAX(0,C55))*10+0.000001)*0.075,0)', "Warbringer")
    assert "Minotaur" not in formulas["E45"]

    _guard(formulas, "E48", 'AND(C22="Felynx",C23="Gauntlet")', "E48 Felynx gauntlet")
    _guard(formulas, "E48", 'AND(C22="Golem",OR(C23="Colossal Sword",C23="Great Axe")),15%', "Golem heavy weapons")
    _guard(formulas, "E48", 'AND(C22="Goblin",C23="Dagger"),10%', "Goblin class atk speed")
    _guard(formulas, "E48", ",150%)", "atk speed cap")
    _guard(formulas, "E48", '+IF(C22="Kitsune",20%,0)+IF(AND(C22="Fairy",C23="Spear"),15%,0)', "Kitsune / Fairy after the cap")
    _guard(formulas, "E48", 'IF(C22="Orc Lord",MIN(5,MAX(0,INT(E55)))*7.5%,0)', "Lord of War")
    assert '"Elf"' not in formulas["E48"]

    _guard(formulas, "E46", "100%", "crit chance cap")
    _guard(formulas, "E46", 'IF(AND(C22="Dryad",C49="Yes"),15%,0)', "Barkskin crit chance")
    _guard(formulas, "E47", 'MIN(A29+C47,100%)+IF(C22="Kitsune",15%,0)+IF(AND(C22="Dryad",C49="Yes"),15%,0)', "crit dmg")

    _guard(formulas, "C45", "0.1", "share gate")
    _guard(formulas, "C45", "0.2", "share ramp span")
    _guard(formulas, "C45", "+C44", "armor lethality wired into C45")
    _guard(formulas, "C46", "+C42", "armor CC wired into C46")
    _guard(formulas, "C47", "+C43", "armor CD wired into C47")
    for cell in ["C45", "C48"]:
        assert "C22" not in formulas[cell], f"{cell} must hold ore terms only"

    _guard(formulas, "C53", "MIN(1.5,", "moon cap")
    _guard(formulas, "C58", "MIN(2.5,", "explosion total cap")
    _guard(formulas, "C58", "+C37)", "blast dmg inside the cap")
    _guard(formulas, "C59", "D37", "blast chance input")
    _guard(formulas, "C59", "MAX(", "explosion chance maxes")
    _guard(formulas, "C62", '+IF(C22="Dragonborn",0.3,0)+IF(C22="Demon",0.2,0)+C34', "race fire dmg")
    _guard(formulas, "C63", 'D34,IF(C22="Dragonborn",0.4,0))', "Dragonborn burn chance maxed")
    _guard(formulas, "C64", 'IF(C62<=0,0,MIN(5,MAX(1,', "fire duration clamp")
    _guard(formulas, "C64", 'IF(OR(C22="Dragonborn",C22="Demon"),3,0),E34', "race fire time")
    _guard(formulas, "C67", "+C35", "poison dmg input")
    _guard(formulas, "C68", "D35", "poison chance input")
    _guard(formulas, "C69", "IF(C67<=0,0,MIN(15,MAX(1,", "poison duration clamp")
    _guard(formulas, "C72", "MIN(2.5,", "smite dmg cap")
    _guard(formulas, "C72", 'IF(C22="Angel",0.3,0)', "Angel smite dmg")
    _guard(formulas, "C73", ',IF(C22="Angel",0.5,0))', "Angel smite chance maxed")
    for cell in ["C72", "C73"]:
        assert "Archangel" not in formulas[cell]
    _guard(formulas, "C76", "MIN(2.5,", "black hole dmg cap")
    _guard(formulas, "C76", ">=0.1),1.25,0)", "rainbow wave")
    _guard(formulas, "C77", '"Galaxite"', "black hole chance")
    _guard(formulas, "C77", ">=0.1,0.3,0)", "black hole chance gate")
    _guard(formulas, "C80", "+C36", "lightning dmg input")
    _guard(formulas, "C81", "D36", "lightning chance input")
    _guard(formulas, "E80", "=99,10,MIN(", "default lightning cooldown")

    _guard(formulas, "E59", "MIN(1,(INT(ROUND(C59*100,2))+1)/101)", "integer proc roll")
    _guard(formulas, "E63", "/(1+(", "DoT uptime")
    _guard(formulas, "E77", "E13*C76*", "black hole dps")
    _guard(formulas, "E77", "/(1+1/(", "black hole 1 s cooldown")
    _guard(formulas, "E81", "/(E80+1/(", "lightning cooldown rate")
    _guard(formulas, "E85", "E13*C84/(E84+1/(C85*E21))", "smash cooldown rate")
    _guard(formulas, "C84", '"Orc Lord",1', "smash dmg")
    _guard(formulas, "E84", '"Orc Lord",10', "smash cooldown")
    _guard(formulas, "C85", '"Orc Lord",0.25', "smash chance")
    _guard(formulas, "C88", 'IF(C22="Kitsune", 0.75, 0)', "fox claws dmg")
    _guard(formulas, "C89", '"Kitsune",0.25', "fox claws chance")
    _guard(formulas, "E89", "E13*C88*MIN(C89*E21,3/2.22)", "fox claws spirits")
    _guard(formulas, "C92", '"Kitsune",0.3', "foxfire dmg")
    _guard(formulas, "C93", '"Kitsune",0.5', "foxfire chance")
    _guard(formulas, "C94", '"Kitsune",3', "foxfire duration")
    _guard(formulas, "E93", "A18*(1+E45)*C92*(1-EXP(-C93*E21*C94))", "foxfire uptime")
    _guard(formulas, "E109", "78/101*E21*12", "Venom Crumb")
    _guard(formulas, "E109", "A18*0.7*43/101*E21", "Blast Chip")
    _guard(formulas, "E109", "61/101*E21*4", "Flame Spark")
    _guard(formulas, "E109", "A18*0.8*", "Thunder Shard")
    _guard(formulas, "E109", "(3+1/(48/101*E21))", "Thunder Shard cooldown")
    _guard(formulas, "C110", "1.5*A18/(10+1/(0.33*E21))", "Archangel smite beam")
    _guard(formulas, "E110", '"Demon",0.1*A18', "Cursed Aura")
    _guard(formulas, "E63", '"Dryad",MIN(INT(MAX(0,E49)/1000),10)*0.05', "Vital Power")

    _guard(formulas, "E54", 'MIN(200%,C54)+IF(C22="Minotaur",30%,0)', "berserk")
    _guard(formulas, "C112", "C18*(1+E45+E54)", "berserk adds to lethality")
    _guard(formulas, "E59", "A18", "explosion dps on A18")
    _guard(formulas, "C116", "C18", "max-burst on C18")
    for cell in ["C111", "C112", "C113"]:
        _guard(formulas, cell, "C108+E108+C109+E109+C110+E110", f"{cell} includes every proc row")
    _guard(formulas, "C116", "C84*C18", "max burst adds smash on forged C18")

    # E10 drops Fichilliumorite from both halves of the weighted average
    _guard(formulas, "E10", "Fichilliumorite", "E10 excludes Fichilliumorite")
    _guard(formulas, "E10", '"<>Bismuth")=0), 8', "E10 Bismuth-only power")
    _guard(formulas, "E10", '"<>Fichilliumorite")=0), 1', "E10 Fichilliumorite-only power")
    _guard(formulas, "E10", '(C6:C9<>"Bismuth")*(C6:C9<>"Select Ore")', "E10 excludes Bismuth and Select Ore")

    # active-trait power slope and weapon test
    _guard(formulas, "K6", "4.5", "trait power slope")
    _guard(formulas, "I6", '"eapon"', "is-weapon substring")
    _guard(formulas, "L6", "0.3", "trait30 threshold")
