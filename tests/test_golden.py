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
from scripts.excel_fuzz import golemites_from

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
        armor_crit_chance=c("C69") or 0.0,
        armor_crit_dmg=c("C70") or 0.0,
        armor_lethality=c("C71") or 0.0,
        base_lethality=c("A72") or 0.0,
        # One row per ability: Fire 34, Poison 35, Lightning 36, Blast 37,
        # with DMG/Chance/Time in columns C/D/E.
        abilities=Abilities(
            fire_dmg=c("C34") or 0.0, fire_chance=c("D34") or 0.0, fire_time=c("E34") or 0.0,
            poison_dmg=c("C35") or 0.0, poison_chance=c("D35") or 0.0, poison_time=c("E35") or 0.0,
            lightning_dmg=c("C36") or 0.0, lightning_chance=c("D36") or 0.0,
            lightning_cooldown=c("E36") or 0.0,
            blast_dmg=c("C37") or 0.0, blast_chance=c("D37") or 0.0,
        ),
        berserk=c("C82") or 0.0,
        achievement=c("C135") or "None",
        golemites=golemites_from(c, sheet_typo=True),
    )
    r = calculate(build, game)

    assert r.avg_power == pytest.approx(c("E10"), rel=1e-9)
    assert r.unforged_damage == pytest.approx(c("A18"), rel=1e-9)
    assert r.forged_damage == pytest.approx(c("C18"), rel=1e-9)
    assert r.interval == pytest.approx(c("C19"), rel=1e-9)
    assert r.attack_rate == pytest.approx(c("E21"), rel=1e-9)
    assert r.lethality == pytest.approx(c("E72") or 0.0, rel=1e-9)
    assert r.crit_chance == pytest.approx(c("E73") or 0.0, rel=1e-9)
    assert r.crit_dmg == pytest.approx(c("E74") or 0.0, rel=1e-9)
    assert r.atk_speed == pytest.approx(c("E75") or 0.0, rel=1e-9)

    for cell, val in [
        ("C81", r.moon), ("C87", r.explosion_dmg), ("C88", r.explosion_chance),
        ("C91", r.fire_dmg), ("C92", r.fire_chance), ("C93", r.fire_duration),
        ("C96", r.poison_dmg), ("C97", r.poison_chance), ("C98", r.poison_duration),
        ("C101", r.smite_dmg), ("C102", r.smite_chance), ("C105", r.blackhole_dmg),
        ("C106", r.blackhole_chance), ("C109", r.lightning_dmg), ("C110", r.lightning_chance),
        ("C139", r.weapon_dps), ("C140", r.explosion_dps), ("C141", r.fire_dps),
        ("C142", r.poison_dps), ("C143", r.smite_dps), ("C144", r.blackhole_dps),
        ("E144", r.lightning_dps), ("C150", r.total_dps), ("C154", r.min_dps),
        ("E150", r.ttk_25k), ("E151", r.ttk_75k),
        ("C113", r.smash_dmg), ("C114", r.smash_chance), ("C145", r.smash_dps),
        ("C117", r.fox_claws_dmg), ("C118", r.fox_claws_chance), ("E145", r.fox_claws_dps),
        ("C121", r.foxfire_dmg), ("C122", r.foxfire_chance), ("C123", r.foxfire_duration),
        ("C146", r.foxfire_dps), ("E146", r.golemite_dps),
        ("C147", r.archangel_smite_dps), ("E147", r.cursed_aura_dps),
        ("C148", r.dark_smite_dps), ("E148", r.trident_toss_dps),
        ("C162", r.reverberation_chance), ("E162", r.reverberation_dps),
        ("C164", r.frost_slash_dmg), ("E164", r.frost_slash_dps),
        ("C167", r.glacier_dmg), ("E167", r.glacier_explosion_dps),
        ("C170", r.starfall_dmg), ("E170", r.starfall_dps), ("E172", r.starfall_cooldown),
        ("C174", r.stellar_mark_dmg), ("E174", r.stellar_mark_dps),
        ("C177", r.ancient_poison_dmg), ("E177", r.ancient_poison_dps),
    ]:
        assert val == pytest.approx(c(cell) or 0.0, rel=1e-9), f"{cell}: {val} vs cached {c(cell)}"

    assert r.max_dps == pytest.approx(c("C155"), rel=1e-9)

    # C126/C127 fall back to C125 in the sheet when the bonus is 0; the engine uses None
    assert (r.berserk if r.berserk is not None else r.total_dps) == pytest.approx(
        c("C151"), rel=1e-9
    )
    assert (r.moonstone if r.moonstone is not None else r.total_dps) == pytest.approx(
        c("C152"), rel=1e-9
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
    # C113 = 66.564 * 1.15 * 1.0 (blend, no crit) * 2.29787234
    assert r.weapon_dps == pytest.approx(175.89891063829785)
    assert r.total_dps == pytest.approx(r.weapon_dps)   # no procs
    assert r.min_dps == pytest.approx(r.weapon_dps)     # blend==1
    # C125 max burst = C18*(1+E71)*(C21+E73)*E21 + procs; C21 base crit dmg = 1.45
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
    assert r.fire_chance == pytest.approx(0.2)
    assert r.fire_duration == pytest.approx(2.0)
    assert r.explosion_dps == pytest.approx(a * 0.5 * 36 / 101 * rate)
    assert r.fire_dps == pytest.approx(a * 0.2 * dot_uptime(21 / 101, rate, 2.0))
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


def test_black_hole_chance_needs_any_galaxite(game):
    build = Build(slots=(OreSlot("Wolfarite", 30), OreSlot(), OreSlot(), OreSlot()),
                  weapon_name="Dagger")
    assert calculate(build, game).blackhole_chance == 0.0
    low = Build(slots=(OreSlot("Galaxite", 1), OreSlot("Wolfarite", 29), OreSlot(), OreSlot()),
                weapon_name="Dagger")
    r = calculate(low, game)
    assert r.blackhole_chance == 0.3
    assert r.blackhole_dmg == 0.0
    assert r.blackhole_dps == 0.0


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
    for row in ws.iter_rows(min_row=1, max_row=180, min_col=1, max_col=12):
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

    for frag in ['"Orc Lord", 0.4', '"Archangel", 0.2', '"Demon", 0.2', '"Fallen Angel", 0.2', '"Dragonborn", 0.12', '"Orc", 0.1', '"Shadow", 0.05']:
        _guard(formulas, "E72", frag, "race lethality")
    _guard(formulas, "E72", 'AND(C22="Felynx", C23="Gauntlet"), 0.2', "E72 Felynx gauntlet")
    _guard(formulas, "E72", 'AND(C22="Vampire", C23="Straight Sword"), 0.1', "Vampire straight sword lethality")
    _guard(formulas, "E72", "0), 3)", "lethality cap")
    _guard(formulas, "E72", 'AND(C22="Imp", C23="Spear"), 0.25', "Imp spear lethality")
    _guard(formulas, "E72", '+IF(C22="Kitsune", 0.2, 0)+IF(AND(C22="Fairy", C23="Spear"), 0.15, 0)', "Kitsune / Fairy added after the cap")
    _guard(formulas, "E72", 'IF(C22="Orc Lord", INT(MIN(1, MAX(0, C83))*10+0.000001)*0.075, 0)', "Warbringer")
    assert "Minotaur" not in formulas["E72"]

    _guard(formulas, "E75", 'AND(C22="Felynx",C23="Gauntlet")', "E75 Felynx gauntlet")
    _guard(formulas, "E75", 'AND(C22="Golem",OR(C23="Colossal Sword",C23="Great Axe")),15%', "Golem heavy weapons")
    _guard(formulas, "E75", 'AND(C22="Goblin",C23="Dagger"),10%', "Goblin class atk speed")
    _guard(formulas, "E75", '"Fallen Angel",10%', "Fallen Angel atk speed")
    _guard(formulas, "E75", 'AND(C22="Imp",C23="Spear"),20%', "Imp spear atk speed")
    _guard(formulas, "E75", ",150%)", "atk speed cap")
    _guard(formulas, "E75", '+IF(C22="Kitsune",20%,0)+IF(AND(C22="Fairy",C23="Spear"),15%,0)', "Kitsune / Fairy after the cap")
    _guard(formulas, "E75", 'IF(C22="Orc Lord",MIN(5,MAX(0,INT(E83)))*7.5%,0)', "Lord of War")
    assert '"Elf"' not in formulas["E75"]

    _guard(formulas, "E73", "100%", "crit chance cap")
    _guard(formulas, "E73", 'IF(AND(C22="Dryad",C76="Yes"),15%,0)', "Barkskin crit chance")
    _guard(formulas, "E74", 'MIN(A29+C74,100%)+IF(C22="Kitsune",15%,0)+IF(AND(C22="Dryad",C76="Yes"),15%,0)', "crit dmg")

    _guard(formulas, "C72", "0.1", "share gate")
    _guard(formulas, "C72", "0.2", "share ramp span")
    _guard(formulas, "C72", "+C71", "armor lethality wired into C72")
    _guard(formulas, "C73", "+C69", "armor CC wired into C73")
    _guard(formulas, "C74", "+C70", "armor CD wired into C74")
    for cell in ["C72", "C75"]:
        assert "C22" not in formulas[cell], f"{cell} must hold ore terms only"

    _guard(formulas, "C81", "MIN(1.5,", "moon cap")
    _guard(formulas, "C87", "MIN(2.5,", "explosion total cap")
    _guard(formulas, "C87", "+C37+C47+C48)", "blast and Golemite blast dmg inside the cap")
    _guard(formulas, "C88", "D37", "blast chance input")
    _guard(formulas, "C88", "MAX(", "explosion chance maxes")
    _guard(formulas, "C91", '+IF(C22="Dragonborn",0.3,0)+IF(C22="Demon",0.2,0)+C34', "race fire dmg")
    _guard(formulas, "C92", 'D34,IF(C22="Dragonborn",0.4,0), D41, D42)', "Dragonborn burn chance maxed")
    _guard(formulas, "C93", 'IF(C91<=0,0,MIN(5,MAX(1,', "fire duration clamp")
    _guard(formulas, "C93", 'IF(OR(C22="Dragonborn",C22="Demon"),3,0),E34', "race fire time")
    _guard(formulas, "C96", "+C35", "poison dmg input")
    _guard(formulas, "C97", "D35", "poison chance input")
    _guard(formulas, "C98", "IF(C96<=0,0,MIN(15,MAX(1,", "poison duration clamp")
    _guard(formulas, "C101", "MIN(2.5,", "smite dmg cap")
    _guard(formulas, "C101", 'IF(C22="Angel",0.3,0)', "Angel smite dmg")
    _guard(formulas, "C102", ',IF(C22="Angel",0.5,0), D49, D50)', "Angel smite chance maxed")
    for cell in ["C101", "C102"]:
        assert "Archangel" not in formulas[cell]
    assert "MIN(2.5" not in formulas["C105"]
    _guard(formulas, "C105", '(C6:C9="Galaxite")', "black hole Galaxite ramp")
    _guard(formulas, "C105", "(6 + 54 * IF(", "black hole Galaxite ramp values")
    _guard(formulas, "C105", 'IF(OR(COUNTIF(C6:C9,"Galaxite")>0, C51>0, C52>0), C53 + C54 + IF(COUNTIF(C6:C9,"Bismuth")>0, 1.25, 0), 0) + C51 + C52', "Resonance and Golemite black hole")
    _guard(formulas, "C106", 'MAX(D51, D52, IF(SUMIF($C$6:$C$9, "Galaxite", $D$6:$D$9) > 0, 0.3, 0))', "black hole chance")
    _guard(formulas, "C109", "+C36", "lightning dmg input")
    _guard(formulas, "C110", "D36", "lightning chance input")
    _guard(formulas, "E109", "=99,10,MIN(", "default lightning cooldown")

    _guard(formulas, "E88", "MIN(1,(INT(ROUND(C88*100,2))+1)/101)", "integer proc roll")
    _guard(formulas, "E92", "/(1+(", "DoT uptime")
    _guard(formulas, "E106", "E13*C105*", "black hole dps")
    _guard(formulas, "E106", "/(1+1/(", "black hole 1 s cooldown")
    _guard(formulas, "E110", "/(E109+1/(", "lightning cooldown rate")
    _guard(formulas, "E114", "E13*C113/(E113+1/(C114*E21))", "smash cooldown rate")
    _guard(formulas, "C113", '"Orc Lord",1', "smash dmg")
    _guard(formulas, "E113", '"Orc Lord",10', "smash cooldown")
    _guard(formulas, "C114", '"Orc Lord",0.25', "smash chance")
    _guard(formulas, "C117", 'IF(C22="Kitsune", 0.75, 0)', "fox claws dmg")
    _guard(formulas, "C118", '"Kitsune",0.25', "fox claws chance")
    _guard(formulas, "E118", "E13*C117*MIN(C118*E21,3/2.22)", "fox claws spirits")
    _guard(formulas, "C121", '"Kitsune",0.3', "foxfire dmg")
    _guard(formulas, "C122", '"Kitsune",0.5', "foxfire chance")
    _guard(formulas, "C123", '"Kitsune",3', "foxfire duration")
    _guard(formulas, "E122", "A18*(1+E72)*C121*(1-EXP(-C122*E21*C123))", "foxfire uptime")
    _guard(formulas, "E146", "=E62", "Golemite DPS row")
    for cell, frag in [("C87", "8.75/100"), ("C88", "5.25/100"), ("C91", "3.25/100"), ("C92", "7.5/100"),
                       ("C96", "2/100"), ("C97", "9.625/100"), ("C109", "10/100"), ("C110", "5.875/100")]:
        _guard(formulas, cell, f'C6="Bismuth",IF(SUM($D$6:$D$9)=0,0,IF(D6/SUM($D$6:$D$9)<0.1,0,{frag}))', "Bismuth one-eighth T3 rune")
    _guard(formulas, "E109", 'C6="Bismuth",IF(SUM($D$6:$D$9)=0,99,IF(D6/SUM($D$6:$D$9)<0.1,99,0.375))', "Bismuth lightning cooldown")
    _guard(formulas, "C147", "1.5*A18/(10+1/(0.33*E21))", "Archangel smite beam")
    _guard(formulas, "E147", '"Demon",0.1*A18', "Cursed Aura")
    _guard(formulas, "E92", '"Dryad",MIN(INT(MAX(0,E76)/1000),10)*0.05', "Vital Power")

    _guard(formulas, "E82", 'MIN(200%,C82)+IF(C22="Minotaur",30%,0)+if(C22="Fallen Angel",30%,0)', "berserk")
    _guard(formulas, "C151", "C18*(1+E72+E82)", "berserk adds to lethality")
    _guard(formulas, "E88", "A18", "explosion dps on A18")
    _guard(formulas, "C155", "C18", "max-burst on C18")
    for cell in ["C150", "C151", "C152"]:
        _guard(formulas, cell, "C145+E145+C146+C147+E147+E146+C148+E148+E162+E164+E167+E170+E174+E177",
               f"{cell} includes every proc row")
    _guard(formulas, "C155", "C113*C18", "max burst adds smash on forged C18")
    for cell in ["C91", "C92", "C93"]:
        assert "Imp" not in formulas[cell], f"{cell}: Imp spear bonuses are lethality and attack speed, not fire"

    _guard(formulas, "C126", 'IF(C22="Fallen Angel", 0.35, 0)', "Dark Smite dmg")
    _guard(formulas, "C127", 'IF(C22="Fallen Angel", 0.3, 0)', "Dark Smite chance")
    _guard(formulas, "E127", "A18*E21*C126*IF(C126>0,MIN(1,(INT(ROUND(C127*100,2))+1)/101),0)", "Dark Smite DPS")
    _guard(formulas, "C130", 'IF(AND(C22="Imp", C12="Spear"), 120%, 0%)', "Trident Toss dmg")
    _guard(formulas, "C131", 'IF(AND(C22="Imp", C12="Spear"), 100%, 0%)', "Trident Toss chance")
    _guard(formulas, "E130", 'IF(AND(C22="Imp", C12="Spear"), 8, 0)', "Trident Toss cooldown")
    _guard(formulas, "E131", "E13 * C130 * C131 * MIN(E21, 1/E130)", "Trident Toss DPS")
    _guard(formulas, "C162", 'SWITCH(C23,"Dagger",20,"Straight Sword",16,"Gauntlet",12,8)/100', "Reverberation chance")
    _guard(formulas, "C162", 'C6="Echotite"', "Reverberation ore")
    _guard(formulas, "E162", "C139*IF(C162>0,MIN(1,(INT(ROUND(C162*100,2))+1)/101),0)", "Reverberation DPS")
    _guard(formulas, "E164", "A18*C164*IF(C164>0,MIN(1,(INT(ROUND(C165*100,2))+1)/101),0)*E21", "Frost Slash DPS")
    _guard(formulas, "E167", "*MIN(C20+E73,1)*E21", "Glacier Explosion on crits")
    _guard(formulas, "E170", 'IF(SUMIF($C$6:$C$9,"Galaxite",$D$6:$D$9)>0,225/125,1)/(E172+1/(', "Starfall Galaxite and cooldown")
    _guard(formulas, "C175", "IF(C174<=0,0,5)", "Stellar Mark hits")
    _guard(formulas, "E174", "A18*C174*E21/C175", "Stellar Mark DPS")
    _guard(formulas, "E177", "E97*C177*(1-(1-IF(C177>0,MIN(1,(INT(ROUND(C178*100,2))+1)/101),0))^(E21*C179))", "Ancient Poison uptime")

    for cell, frag in [
        ("C72", "+C57+C58"), ("C73", "+C59+C60"), ("C74", "+C61+C62"), ("C75", "+C63+C64"),
        ("C81", "+C55+C56"), ("C91", "+C34+C41+C42"), ("C92", "D41, D42)"), ("C93", "E34, E41, E42)"),
        ("C96", "+C35+C43+C44"), ("C97", "D35 , D43, D44)"), ("C98", "E35, E43, E44)"),
        ("C101", ")+C49+C50"), ("C102", "D49, D50)"), ("C109", "+C36+C45+C46"), ("C110", "D36 , D45,D46)"),
        ("E109", "IF(E45=0,99,E45),IF(E46=0,99,E46)"),
    ]:
        _guard(formulas, cell, frag, "Golemite sub-stat wiring")
    _guard(formulas, "C88", "D37, C49, C50)", "explosion chance reads C49/C50, engine reads the Golemite blast chances D47/D48 by request")
    for cell, level in [("E56", "E54"), ("E57", "E55")]:
        _guard(formulas, cell, f"=IF({level} < 13, 0, E13 * (0.02 + (MIN(25, {level}) - 13) * (0.04 / 12)))", "Golemite damage")
    _guard(formulas, "E60", "=E56*E58", "Golemite 1 DPS")
    _guard(formulas, "E61", "=E57*E59", "Golemite 2 DPS")
    _guard(formulas, "E62", "=E60+E61", "Golemite total DPS")
    _guard(formulas, "C155", "C113*C18", "max burst leaves out Golemite DPS")
    assert "E146" not in formulas["C155"]

    # E10 drops Fichilliumorite from both halves of the weighted average
    _guard(formulas, "E10", "Fichilliumorite", "E10 excludes Fichilliumorite")
    _guard(formulas, "E10", '"<>Bismuth")=0), 8', "E10 Bismuth-only power")
    _guard(formulas, "E10", '"<>Fichilliumorite")=0), 1', "E10 Fichilliumorite-only power")
    _guard(formulas, "E10", '(C6:C9<>"Bismuth")*(C6:C9<>"Select Ore")', "E10 excludes Bismuth and Select Ore")

    # active-trait power slope and weapon test
    _guard(formulas, "K6", "4.5", "trait power slope")
    _guard(formulas, "I6", '"eapon"', "is-weapon substring")
    _guard(formulas, "L6", "0.3", "trait30 threshold")
