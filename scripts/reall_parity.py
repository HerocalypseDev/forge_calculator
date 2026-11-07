"""UpdatedSpreadsheet.xlsx parity check for the Python engine.

Runs the workbook's own saved default build through ``forge_calculator.engine``
and diffs every cell against the workbook's cached values -- the Python twin of
``Web/mediawiki/reall-golden.js``.  Dev-only audit harness.

    python scripts/reall_parity.py [reference/UpdatedSpreadsheet.xlsx]

Reads the default build and every expected cell straight from the workbook's
own cache rather than hand-typing them, so it stays correct across workbook
revisions without editing this file.
"""

from __future__ import annotations

import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from forge_calculator.data import DEFAULT_DATA_DIR, load_game_data  # noqa: E402
from forge_calculator.engine import Abilities, Build, OreSlot, calculate  # noqa: E402
from scripts.excel_fuzz import golemites_from  # noqa: E402

DEFAULT_WORKBOOK = PROJECT_ROOT / "reference" / "UpdatedSpreadsheet.xlsx"

TOL = 1e-6

CELL_ATTRS = [
    ("E10  avg ore power", "avg_power", "E10"),
    ("A18  unforged dmg", "unforged_damage", "A18"),
    ("C18  forged dmg", "forged_damage", "C18"),
    ("E21  eff. hits/sec", "attack_rate", "E21"),
    ("E72  lethality", "lethality", "E72"),
    ("E73  crit chance", "crit_chance", "E73"),
    ("E74  crit dmg", "crit_dmg", "E74"),
    ("E75  atk speed", "atk_speed", "E75"),
    ("C81  moon", "moon", "C81"),
    ("C87  explosion dmg", "explosion_dmg", "C87"),
    ("C88  explosion chance", "explosion_chance", "C88"),
    ("C91  fire dmg", "fire_dmg", "C91"),
    ("C92  fire chance", "fire_chance", "C92"),
    ("C93  fire duration", "fire_duration", "C93"),
    ("C96  poison dmg", "poison_dmg", "C96"),
    ("C97  poison chance", "poison_chance", "C97"),
    ("C98  poison duration", "poison_duration", "C98"),
    ("C101  smite dmg", "smite_dmg", "C101"),
    ("C102  smite chance", "smite_chance", "C102"),
    ("C105  black hole dmg", "blackhole_dmg", "C105"),
    ("C106  black hole chance", "blackhole_chance", "C106"),
    ("C109  lightning dmg", "lightning_dmg", "C109"),
    ("C110  lightning chance", "lightning_chance", "C110"),
    ("C139 physical hit DPS", "weapon_dps", "C139"),
    ("C140 explosion DPS", "explosion_dps", "C140"),
    ("C141 fire DoT DPS", "fire_dps", "C141"),
    ("C142 poison DoT DPS", "poison_dps", "C142"),
    ("C143 smite DPS", "smite_dps", "C143"),
    ("C144 black hole DPS", "blackhole_dps", "C144"),
    ("E144 lightning DPS", "lightning_dps", "E144"),
    ("C150 TOTAL DPS", "total_dps", "C150"),
    ("C151 berserk DPS", "berserk", "C151"),
    ("C152 moon stone DPS", "moonstone", "C152"),
    ("C154 min DPS", "min_dps", "C154"),
    ("C155 max burst DPS", "max_dps", "C155"),
    ("E150 TTK 25k", "ttk_25k", "E150"),
    ("E151 TTK 75k", "ttk_75k", "E151"),
    ("C145 smash DPS", "smash_dps", "C145"),
    ("E145 fox claws DPS", "fox_claws_dps", "E145"),
    ("C146 foxfire DPS", "foxfire_dps", "C146"),
    ("E146 Golemite DPS", "golemite_dps", "E146"),
    ("C147 Archangel smite DPS", "archangel_smite_dps", "C147"),
    ("E147 Cursed Aura DPS", "cursed_aura_dps", "E147"),
    ("E127 Dark Smite DPS", "dark_smite_dps", "E127"),
    ("E131 Trident Toss DPS", "trident_toss_dps", "E131"),
    ("E162 Reverberation DPS", "reverberation_dps", "E162"),
    ("E164 Frost Slash DPS", "frost_slash_dps", "E164"),
    ("E167 Glacier Explosion DPS", "glacier_explosion_dps", "E167"),
    ("E170 Starfall DPS", "starfall_dps", "E170"),
    ("E174 Stellar Mark DPS", "stellar_mark_dps", "E174"),
    ("E177 Ancient Poison DPS", "ancient_poison_dps", "E177"),
]


def _build_from_cache(c):
    return Build(
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


def main(argv):
    from openpyxl import load_workbook

    xlsx = Path(argv[0]) if argv else DEFAULT_WORKBOOK
    if not xlsx.exists():
        print(f"ERROR: workbook not found: {xlsx}", file=sys.stderr)
        return 1

    wb = load_workbook(xlsx, data_only=True)
    dps = wb["DPS Calculator"]
    if dps["E10"].value is None:
        print("ERROR: workbook has no cached values (open + save in Excel first)",
              file=sys.stderr)
        return 1
    c = lambda cell: dps[cell].value

    game = load_game_data(DEFAULT_DATA_DIR)
    build = _build_from_cache(c)
    r = calculate(build, game)

    print("cell                      workbook            engine         status")
    print("-" * 78)
    fails = 0
    for label, attr, cell in CELL_ATTRS:
        want = c(cell) or 0.0
        got = getattr(r, attr)
        if got is None and attr in ("berserk", "moonstone"):
            got = r.total_dps  # workbook falls back to C141 when the bonus is 0
        ok = got is not None and abs(got - want) <= TOL * max(1.0, abs(want))
        if not ok:
            fails += 1
        shown = "None" if got is None else f"{got:.6f}"
        print(f"{label:<25} {want:>14.6f} {shown:>16} {'  ok' if ok else '  <-- MISMATCH'}")
    print("-" * 78)
    print(f"{xlsx.name} PARITY PASSED" if not fails
          else f"{fails} of {len(CELL_ATTRS)} cells diverge from {xlsx.name}")
    return 1 if fails else 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
