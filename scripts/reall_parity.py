"""reall.xlsx parity check for the Python engine.

Runs the workbook's own saved default build through ``forge_calculator.engine``
and diffs every cell against the workbook's cached values -- the Python twin of
``Web/mediawiki/reall-golden.js``.  Dev-only audit harness.

    python scripts/reall_parity.py [reference/reall.xlsx]

reall.xlsx deleted the ore attack-speed ramp, but the engine deliberately keeps
deriving it (from new.xlsx C48).  That known deviation is isolated here by
dropping atk_speed from the catalog, so this measures formula fidelity.  Pass
--keep-atk-speed to see the divergence it causes instead.
"""

from __future__ import annotations

import json
import shutil
import sys
import tempfile
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from forge_calculator.data import DEFAULT_DATA_DIR, load_game_data  # noqa: E402
from forge_calculator.engine import Abilities, Build, OreSlot, calculate  # noqa: E402

# The workbook's saved default build (DPS Calculator, reall.xlsx).
BUILD = Build(
    slots=(
        OreSlot("Fierce Jade", 15),   # C6/D6
        OreSlot("Kitsunite", 20),     # C7/D7
        OreSlot("Galaxite", 15),      # C8/D8
        OreSlot("Select Ore", 0),     # C9/D9
    ),
    weapon_name="Hook Blade",         # D12
    quality=100.0,                    # E12
    forge_level=9,                    # C13
    race="Archangel",                 # C22
    bonus_weapon_type="Dagger",       # C23
    rune_cells=("None",) * 6,
    base_crit_chance=0.0,             # C20
    base_crit_dmg=1.45,               # C21
    armor_crit_chance=0.7,            # C42
    armor_crit_dmg=0.4,               # C43
    armor_lethality=0.8,              # C44
    base_lethality=0.0,               # A45 (empty)
    abilities=Abilities(),            # rows 34-37, all zero
    berserk=0.0,                      # C54
    achievement="Attack Speed +20%",  # C85
)

# A few of the workbook's cached cells, used to restate C101 below.
_WB_C18 = 584.1            # forged weapon damage
_WB_C80 = 0.8              # lightning DMG %
_WB_C81 = 0.6              # lightning proc chance
_WB_E21 = 2.692307692      # effective hits/sec

# C101's final term is a bare "+C80" in the sheet -- the raw lightning PERCENTAGE
# (0.8), not damage, while every other term is scaled by C18 and/or E21.  The
# maintainer's call is that this is an authoring slip and the term should scale
# like the other procs, so the expectation is the cached C101 with that applied.
_C101 = 10346.10962 - _WB_C80 + _WB_C18 * _WB_C80 * _WB_C81 * _WB_E21

# Workbook cached values.
EXPECTED = [
    ("E10  avg ore power", "avg_power", 23.6),
    ("A18  unforged dmg", "unforged_damage", 389.4),
    ("C18  forged dmg", "forged_damage", 584.1),
    ("E21  eff. hits/sec", "attack_rate", 2.692307692),
    ("E45  lethality", "lethality", 1.2),
    ("E46  crit chance", "crit_chance", 1.0),
    ("E47  crit dmg", "crit_dmg", 0.8),
    ("E48  atk speed", "atk_speed", 0.4),
    ("C53  moon", "moon", 0.0),
    ("C58  explosion dmg", "explosion_dmg", 0.7),
    ("C59  explosion chance", "explosion_chance", 0.4),
    ("C62  fire dmg", "fire_dmg", 0.4),
    ("C63  fire chance", "fire_chance", 0.5),
    ("C64  fire duration", "fire_duration", 4.0),
    ("C67  poison dmg", "poison_dmg", 0.0),
    ("C68  poison chance", "poison_chance", 0.0),
    ("C69  poison duration", "poison_duration", 0.0),
    ("C72  smite dmg", "smite_dmg", 1.5),
    ("C73  smite chance", "smite_chance", 0.83),
    ("C76  black hole dmg", "blackhole_dmg", 0.6),
    ("C77  black hole chance", "blackhole_chance", 0.3),
    ("C80  lightning dmg", "lightning_dmg", 0.8),
    ("C81  lightning chance", "lightning_chance", 0.6),
    ("C89  physical hit DPS", "weapon_dps", 7784.255769),
    ("C90  explosion DPS", "explosion_dps", 293.5476923),
    ("C91  fire DoT DPS", "fire_dps", 155.76),
    ("C92  poison DoT DPS", "poison_dps", 0.0),
    ("C93  smite DPS", "smite_dps", 1305.238846),
    ("C94  black hole DPS", "blackhole_dps", 188.7092308),
    ("E94  lightning DPS", "lightning_dps", 62.304),
    ("C96  TOTAL DPS", "total_dps", 9789.815538),
    ("C97  berserk DPS", "berserk", 9789.815538),
    ("C98  moon stone DPS", "moonstone", 9789.815538),
    ("C100 min DPS", "min_dps", 3459.669231),
    ("C101 max burst DPS*", "max_dps", _C101),
    ("E96  TTK 25k", "ttk_25k", 2.553674265),
    ("E97  TTK 75k", "ttk_75k", 7.661022795),
]

TOL = 1e-6


def _load_without_atk_speed():
    """Load the catalog with ore ``atk_speed`` removed, via a throwaway data dir."""
    tmp = Path(tempfile.mkdtemp(prefix="fc-parity-"))
    try:
        for name in ("ores", "weapons", "races", "runes", "achievements"):
            shutil.copyfile(DEFAULT_DATA_DIR / f"{name}.json", tmp / f"{name}.json")
        path = tmp / "ores.json"
        raw = json.loads(path.read_text(encoding="utf-8"))
        for ore in raw["ores"]:
            (ore.get("stats") or {}).pop("atk_speed", None)
        path.write_text(json.dumps(raw), encoding="utf-8")
        return load_game_data(tmp)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def main(argv):
    keep_atk = "--keep-atk-speed" in argv
    game = load_game_data() if keep_atk else _load_without_atk_speed()

    r = calculate(BUILD, game)

    print("cell                      workbook            engine         status")
    print("-" * 78)
    fails = 0
    for label, attr, want in EXPECTED:
        got = getattr(r, attr)
        if got is None and attr in ("berserk", "moonstone"):
            got = r.total_dps  # workbook falls back to C96 when the bonus is 0
        ok = got is not None and abs(got - want) <= TOL * max(1.0, abs(want))
        if not ok:
            fails += 1
        shown = "None" if got is None else f"{got:.6f}"
        print(f"{label:<25} {want:>14} {shown:>16} {'  ok' if ok else '  <-- MISMATCH'}")
    print("-" * 78)
    print("* C101 restated for the scaled-lightning decision; ore atk_speed "
          "excluded (see module docstring)")
    print("reall.xlsx PARITY PASSED" if not fails
          else f"{fails} of {len(EXPECTED)} cells diverge from reall.xlsx")
    return 1 if fails else 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
