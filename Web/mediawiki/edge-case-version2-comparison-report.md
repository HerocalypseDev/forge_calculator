# Edge-case testing report — Version2.xlsx vs reall.xlsx vs the MediaWiki engine

**What this is:** the same 83 edge-case scenarios from `edge-case-testing-report.md`, this
time run three ways — through the real MediaWiki engine, through `reference/Version2.xlsx`,
and through `reference/reall.xlsx` — so all three can be diffed against each other
directly, not just described. Every scenario used the identical build (ores, race, class,
armor, achievement, abilities) across all three; only the workbook file changed.

**Headline result:** across all 83 scenarios, **227 individual field-level differences**
turned up between the three sources. All 227 are fully explained. 159 are a cosmetic
Excel-vs-JS display convention (not a real difference), 60 are three already-documented,
already-approved engine deviations, 2 are an already-reported sheet issue nobody's fixing —
and **6 are new**, all caused by one specific formula edit in `Version2.xlsx` that changes
how Felynx's class bonus behaves. Zero unexplained discrepancies.

## The one real finding: Version2.xlsx breaks Felynx's attack-speed bonus

`reall.xlsx`'s `E48` (attack speed) formula checks for the **plural** "Gauntlets" when
granting Felynx's class bonus. `Version2.xlsx` changed that one condition to the
**singular** "Gauntlet":

```
reall.xlsx    E48: ...AND(C22="Felynx",C23="Gauntlets"),20%...
Version2.xlsx E48: ...AND(C22="Felynx",C23="Gauntlet"),20%...
```

Nothing else about Felynx changed — `E45` (lethality) still checks the singular
"Gauntlet" in **both** files, unchanged. And the game only ever produces the **plural**
weapon-type string "Gauntlets" (that's the only option in the sheet's own `C23`
dropdown, and it's what the MediaWiki weapon data uses too). Put together:

| Build | reall.xlsx | Version2.xlsx |
|---|---|---|
| Felynx + a real "Gauntlets" weapon | E45 misses (needs singular) → **0% lethality**; E48 hits (needs plural, gets it) → **+20% atk speed** | E45 misses → **0% lethality**; E48 now also misses (needs singular, gets plural) → **0% atk speed** |

**In other words: in `reall.xlsx`, Felynx got a real, working +20% attack-speed bonus on
Gauntlets weapons. In `Version2.xlsx`, that formula edit silently zeroed it out — Felynx
now gets nothing at all from either bonus, on the only weapon-type string the game
actually produces.** This isn't reachable through the sheet's own `C23` dropdown testing
alone (the dropdown never offers the singular "Gauntlet"), which is exactly why it went
unnoticed — you'd only find it by, as here, feeding the formula evaluator the singular
spelling directly to see which branch was even alive.

Measured directly (Hook Blade, no armor, no achievement, `weapon_dps` == `total_dps`
since nothing procs on Felynx alone):

| Scenario | lethality | atk_speed | weapon_dps |
|---|---|---|---|
| **8A** — bonus_weapon_type = **"Gauntlet"** (singular, not reachable via the dropdown) | reall: 20%, V2: 20% *(unchanged — E45 always matched singular)* | reall: **0%**, V2: **20%** | reall: 19.04, V2: **22.85** |
| **8B** — bonus_weapon_type = **"Gauntlets"** (plural — the only real in-game value) | reall: 0%, V2: 0% *(unchanged — E45 never matches plural)* | reall: **20%**, V2: **0%** | reall: **19.04**, V2: **15.87** |

8B is the one that matters for actual gameplay: a Felynx player's real weapon-type string
is always "Gauntlets", and their physical hit DPS on it **drops from 19.04 to 15.87 —
a 16.7% loss** — purely from this formula edit, with no ore, race, or weapon change.

A larger, more realistic build (all four attack-speed ores stacked + achievement) shows
the same effect at bigger numbers:

| Scenario 13H (Felynx + Gauntlets + full atk-speed ore stack + achievement) | reall.xlsx | Version2.xlsx |
|---|---|---|
| atk_speed (E48) | 40% | **20%** |
| weapon_dps / total_dps | 434.80 | **372.69** (−14.3%) |

**The MediaWiki calculator itself is unaffected either way.** Approved deviation #4 in
`CLAUDE.md` already has the JS engine register *both* spellings for *both* bonuses, so
Felynx always gets the full +20%/+20% in the calculator regardless of which workbook is
authoritative (JS gives 22.85/613.55 in both scenarios — see the tables above). This
finding only matters if `Version2.xlsx` is meant to become the new source of truth: if
so, the calculator would now be *more generous* to Felynx than the "new" spreadsheet
says it should be, the mirror image of the already-approved deviation. Worth a decision
on which one is actually correct before promoting `Version2.xlsx`, since the two
spreadsheet versions no longer agree with each other on this one race.

## Everything else: fully explained by already-known deviations, zero new surprises

| Category | Scenarios affected | What it is |
|---|---|---|
| Excel-always-computes | 82 of 83 scenarios (159 field-rows) | `berserk`/`moonstone` cells in the sheet have no way to be "blank" — the formula always runs and returns `weapon_dps` when the multiplier is 1×. The JS engine explicitly returns `null` there instead, purely so the UI can hide an inactive row. Not a numeric disagreement — once you substitute "sheet value equals total_dps" for "JS says null," every one of these matches exactly. |
| Approved deviation #3 (Max Burst) | 25 scenarios | `C101`'s bare `+C80` vs. the engine's `C18*C80*C81*E21`, already signed off in `CLAUDE.md`. Fires in every scenario with any lightning chance >0 (including builds not nominally "about" lightning — Kitsunite alone carries a lightning stat, so scenarios 1F/4C/4D/4I/4J/4K/8A/8B pull it in too). Max Burst isn't shown in the calculator. |
| Approved deviation #1 (ore attack speed) | 9 scenarios | `E48` in **both** workbooks has no ore-ramp term at all anymore — it only reads race/class/achievement/a bare manual-input cell. The engine deliberately keeps computing ore-sourced attack speed (from the four atk-speed ores) as a restoration of functionality the sheet dropped. Confirmed directly: scenario 13C (Yeti Heart alone @30%, nothing else) gives the sheet 0% atk_speed and the engine 10% — cascading into weapon_dps (46.21 vs 50.83) exactly as the deviation predicts. |
| Approved deviation #2 (Minotaur berserk) | 4 scenarios | `C97` reads the bare manual-berserk cell only; the engine adds Minotaur's own +30%. Confirmed directly: scenario 7A (Minotaur, no manual berserk) gives the sheet a 1.0× berserk multiplier (no bonus at all) and the engine 1.3×. |
| Documented open issue (`C64`) | 1 scenario | Fire's duration cell reads `C37` (Blast's damage cell) instead of `E34` (Fire's own time), a pre-existing sheet bug already logged in `CLAUDE.md` as "reported, not worked around." Scenario 2E (fire ability alone, no Blast input) hits it head-on: the sheet computes 0 fire uptime because `C37` is 0, while the engine correctly reads `E34` and gets a real value. |
| **Felynx Gauntlet(s) spelling (new)** | 2 scenarios | Described above — the one genuinely new divergence, introduced by `Version2.xlsx`'s `E48` edit. |

**Unexplained discrepancies: 0.** Every one of the 227 field-level differences resolves
to one of the six rows above.

## Methodology

All 83 scenario definitions live once, in `scenarios84.json`, generated by
`build_scenarios.js` — the same parameter set feeds both the JS engine run
(`js_run_84.js`, via the real `calculate()`) and the spreadsheet run (`py_run_84.py`, via
the formula evaluator used throughout this project), so there's no risk of the two sides
testing subtly different builds. Both `Version2.xlsx` and `reall.xlsx` were evaluated
from a completely fresh workbook load per scenario. `compare_84_v3.py` then classified
every mismatch by inspecting the actual build parameters (race, ore names, ability
fields) rather than scenario labels, to rule out mis-tagging. Full raw output for all
three sources is preserved in the session scratchpad
(`js_84_results.json` / `sheet_v2_results.json` / `sheet_reall_results.json`).
No repository files were changed by this testing pass other than this report.
