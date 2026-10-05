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

DEFAULT_WORKBOOK = PROJECT_ROOT / "reference" / "UpdatedSpreadsheet.xlsx"

TOL = 1e-6

CELL_ATTRS = [
    ("E10  avg ore power", "avg_power", "E10"),
    ("A18  unforged dmg", "unforged_damage", "A18"),
    ("C18  forged dmg", "forged_damage", "C18"),
    ("E21  eff. hits/sec", "attack_rate", "E21"),
    ("E45  lethality", "lethality", "E45"),
    ("E46  crit chance", "crit_chance", "E46"),
    ("E47  crit dmg", "crit_dmg", "E47"),
    ("E48  atk speed", "atk_speed", "E48"),
    ("C53  moon", "moon", "C53"),
    ("C58  explosion dmg", "explosion_dmg", "C58"),
    ("C59  explosion chance", "explosion_chance", "C59"),
    ("C62  fire dmg", "fire_dmg", "C62"),
    ("C63  fire chance", "fire_chance", "C63"),
    ("C64  fire duration", "fire_duration", "C64"),
    ("C67  poison dmg", "poison_dmg", "C67"),
    ("C68  poison chance", "poison_chance", "C68"),
    ("C69  poison duration", "poison_duration", "C69"),
    ("C72  smite dmg", "smite_dmg", "C72"),
    ("C73  smite chance", "smite_chance", "C73"),
    ("C76  black hole dmg", "blackhole_dmg", "C76"),
    ("C77  black hole chance", "blackhole_chance", "C77"),
    ("C80  lightning dmg", "lightning_dmg", "C80"),
    ("C81  lightning chance", "lightning_chance", "C81"),
    ("C102 physical hit DPS", "weapon_dps", "C102"),
    ("C103 explosion DPS", "explosion_dps", "C103"),
    ("C104 fire DoT DPS", "fire_dps", "C104"),
    ("C105 poison DoT DPS", "poison_dps", "C105"),
    ("C106 smite DPS", "smite_dps", "C106"),
    ("C107 black hole DPS", "blackhole_dps", "C107"),
    ("E107 lightning DPS", "lightning_dps", "E107"),
    ("C111 TOTAL DPS", "total_dps", "C111"),
    ("C112 berserk DPS", "berserk", "C112"),
    ("C113 moon stone DPS", "moonstone", "C113"),
    ("C115 min DPS", "min_dps", "C115"),
    ("C116 max burst DPS", "max_dps", "C116"),
    ("E111 TTK 25k", "ttk_25k", "E111"),
    ("E112 TTK 75k", "ttk_75k", "E112"),
    ("C108 smash DPS", "smash_dps", "C108"),
    ("E108 fox claws DPS", "fox_claws_dps", "E108"),
    ("C109 foxfire DPS", "foxfire_dps", "C109"),
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
        armor_crit_chance=c("C42") or 0.0,
        armor_crit_dmg=c("C43") or 0.0,
        armor_lethality=c("C44") or 0.0,
        base_lethality=c("A45") or 0.0,
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
            got = r.total_dps  # workbook falls back to C111 when the bonus is 0
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
