# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Permanent rules

### No comments in code (hard requirement)
- **Never write comments.** No `//`, no `/* */`, no JSDoc, no docstring-style block
  headers — in any code you write or edit. This applies to new files as well as edits
  to existing ones.
- Do not reintroduce comments that have been stripped, and do not add one to explain a
  tricky line. Make the code self-explanatory instead: name things clearly, pull a
  confusing expression into a well-named variable or helper.
- When a workbook cell reference genuinely needs recording, put it in a **name**
  (`blackholeRateFloor`) rather than a comment, or document it in `CLAUDE.md` under the
  domain-model / quirks sections.
- This applies to every language in the repo, Python included — no `#` comments either.
  Existing Python docstrings may stay where they are, but don't add new ones.

### MediaWiki only (hard requirement)
- **The only calculator that is still maintained is the MediaWiki one.** Confine all
  changes to `Web/mediawiki/` and its data files.
- The standalone web app (`Web/js/`, `Web/css/`, `Web/index.html`) and the
  Python/Tkinter desktop app (`forge_calculator/gui/`, `scripts/smoke_gui.py`) are
  **retired**. Do not add features to them, port fixes into them, or update them to
  track the workbook.
- `forge_calculator/engine.py`, `forge_calculator/data.py` and `tests/` are **still in
  scope** — they are the tested reference the MediaWiki engine is verified against
  (`fuzz_verify.js` diffs JS against the Python engine), not part of the desktop app.
  Keep them correct.
- `build_data/` and `scripts/build_data.py` stay in scope: they generate the data the
  MediaWiki calculator ships.
- If a change would require touching a retired file, say so and stop rather than
  editing it.

### "Switch to old UI" (saved pre-overhaul calculator)
- The calculator UI before the wiki-style overhaul is kept on GitHub as branch **`old-ui`** and tag
  **`old-ui-2026-11-06`** (commit `9a2cc79`, the version that was live until the overhaul). Never delete
  or rewrite that branch or tag.
- When the user says **"switch to old UI"** (or similar), do this without asking again:
  1. On `main`, take the old stylesheet whole: `git checkout old-ui-2026-11-06 -- Web/mediawiki/Template-ForgeCalculator-styles.css`.
  2. Rebuild `Web/mediawiki/MediaWiki-ForgeCalculator.js` from two halves: everything **before**
     `var DATA_TITLES = {` from the **current** `main` file (the engine — keeps every formula and data
     change made since the snapshot), and everything **from** `var DATA_TITLES = {` to the end from the
     `old-ui-2026-11-06` file (loader, UI components, `init`).
  3. If the current UI gained inputs or results the old UI lacks (new build fields, new DPS rows), port
     only those into the old-UI half so no feature is lost; keep the old layout and styling otherwise.
  4. `node --check`, then every MediaWiki test and `fuzz_verify.js`; fix anything that fails.
  5. Commit and push, then deploy with `python scripts/deploy_wiki.py --apply` and check the live page
     in a browser.
- **"Switch back to new UI"** is the same procedure in reverse, using the last `main` commit that had the
  wiki-style UI (`git log -- Web/mediawiki/Template-ForgeCalculator-styles.css`).

### Automated GitHub sync
- **Core directive:** Always execute this workflow automatically. Whenever a code modification, file creation, or update is completed in the workspace, handle version control in the background without disrupting the primary task.
- **Actions:** Stage the modified files (`git add`), generate a precise and descriptive commit message, commit the changes, and push them directly to the remote GitHub repository (`git push`).
- **Message style:** Commit messages must read like a human's — short, plain, single-line summaries of the actual change (e.g. "Fix ore selection filter", "Sort all GUI lists alphabetically"). No AI-sounding or buzzwordy phrasing, no verbose bodies.
- **Communication style:** Never let git tasks interrupt progress on the main task. Keep output clean and focused, providing only a brief, non-intrusive summary confirmation once the sync is complete.

### Zero invented mechanics (hard requirement)
- Every formula, stat, and rule is ported **verbatim** from the source workbook:
  `reference/UpdatedSpreadsheet.xlsx` — authoritative workbook (openpyxl, build-time only).
  Every older workbook (`Extended.xlsx`, `reall.xlsx`, `new.xlsx`, `Version2.xlsx`,
  `Newchnages*.xlsx`) was deleted from `reference/`; they survive only in git history
  (see "UpdatedSpreadsheet.xlsx Adoption" below).
- Never hand-type a number that the workbook computes. Stat matrices are derived from formula strings; constants are guarded by `tests/test_golden.py::test_engine_constants_match_source`.
- **Verify against the workbook, not against the old data.** `scripts/audit_reall.py`
  diffs every per-ore range in `data/ores.json` against the sheet, and the three
  parity harnesses replay the workbook's own saved build through each engine.
  Commit `e512c81` hand-edited the JSON instead of rebuilding it, which silently
  broke 7 ore multipliers and most of Kitsunite for three commits.

### Formerly-approved deviations (resolved in Extended.xlsx — historical)
The engines carried five deliberate deviations from the older `reall.xlsx`. Four of
them are now moot: `reference/Extended.xlsx` fixes the sheet formula to match what
the engines already did. Kept here only so the "both spellings registered" / similar
defensive code in the engines still makes sense on read. (The fifth, berserk's 200% cap, was a live deviation until
`UpdatedSpreadsheet.xlsx` fixed it at the source — see below.)
1. **Ore attack speed.** `reall.xlsx`'s `C48` was a bare input cell (the ramp had
   been deleted); the engines derived the stat from `new.xlsx`'s `C48` instead.
   `Extended.xlsx` restores `C48` as a live formula with identical constants, so
   `C48` is now parsed straight from the main workbook like every other stat cell
   (`STAT_CELLS`, not a separate legacy pass).
2. **Minotaur reaching Berserk DPS.** `reall.xlsx`'s `C97` referenced the bare
   `C54`, giving Minotaur no berserk multiplier; the engines added `RACE_BERSERK`
   themselves. `Extended.xlsx`'s `C97` adds `IF(C22="Minotaur",30%,0)` inline —
   matches the engines verbatim now.
3. **Max Burst's lightning term.** `reall.xlsx`'s `C101` ended with a bare `+C80`
   (the raw lightning percentage); the engines scaled it as `C18*C80*C81*E21` like
   every other proc. `Extended.xlsx`'s `C101` already uses the full term.
4. **Felynx + Gauntlets both class bonuses.** `reall.xlsx`'s `E45` tested the
   singular `Gauntlet`, which the `C23` dropdown never offers, so the branch could
   never fire; `E48` tested the plural and did. The engines registered both
   spellings in `CLASS_LETHALITY`/`CLASS_ATK_SPEED` so the bonus was reachable
   either way. `Extended.xlsx`'s `E45` now tests the plural `Gauntlets` too, same
   as `E48` — genuinely reachable at the source. Both spellings stay registered in
   the engines; harmless now that only the plural is ever seen.

`C64` reading `C37` (the Blast row's DMG cell) instead of `E34` (Fire's own Time)
was also fixed at the source — `Extended.xlsx`'s `C64` reads `E34`, matching what
the engines always did via `fire_time`.

### Approved deviation (current, live): Golemite blast chance in `C88`
The sheet's explosion chance `C88` ends `MAX(..., D37, C49, C50)`. `C49`/`C50` are the Golemite
**Smite damage** cells; the Golemite **Blast chance** cells `D47`/`D48` are read nowhere. The user
confirmed it is a typo, so both engines take `MAX(..., blast_chance, golemite blast chances)`.
`test_engine_constants_match_source` guards the sheet's current `C49, C50` text so a fix at the
source is noticed; `scripts/excel_fuzz.py` mirrors the typo (`sheet_typo=True`) only when comparing
against Excel. Once the sheet reads `D47, D48`, drop the `sheet_typo` flag and this section.

### Resolved deviation (historical): no Demon + Straight Sword bonus
One `UpdatedSpreadsheet.xlsx` revision's `E45` contained `AND(C22="Demon",C23="Straight Sword"),10%`
(added in the user's double-count-fix edit; no earlier workbook had it). The user confirmed it
was wrong, so the engines dropped it ahead of the sheet; the next upload removed it from `E45`
too, so the engines are verbatim again. `test_engine_constants_match_source` asserts `E45` has no
`AND(C22="Demon"` branch.

That same upload also **removed two attack-speed bonuses from `E48`**, both ported:
**Golem + Great Axe** (Golem now gets its +15% only with a Colossal Sword) and **Shadow + Great
Sword / Colossal Sword / Great Axe / Mace +15%** (Shadow is back to a flat 10%). `E45` was also
rewritten with decimal constants (`0.2` instead of `20%`, cap `3` instead of `300%`) and a more
defensive Damage Boost parse — same values, no engine change.

### Resolved deviation (historical): lethality cap 300%
The user confirmed the game's lethality cap rose to **300%** before the sheet did, so the
engines briefly capped at 300% while `E45` still said 150%. The user then updated the
workbook: `E45`'s last argument is now `300%` (the only change in that upload), so
`CAPS["lethality"] = 3.0` / `CAPS.lethality = 3.0` are verbatim again and
`test_engine_constants_match_source` guards `E45`'s `300%`. The Armor Lethality input's max
is 300 to match.

### Resolved deviation (historical): race bonuses double-counted by the sheet
The first `UpdatedSpreadsheet.xlsx` appended race terms to the ends of `C45`/`C48` that
repeated `E45`/`E48` (Orc and Dragonborn lethality, Goblin + Dagger attack speed counted
twice); the engines counted each once. **The user fixed the sheet:** `C45`/`C48` are pure
ore cells again and every race/class bonus lives once in `E45`/`E48`, so the engines are
verbatim. That fix also added **Minotaur +30% lethality** (on top of its `E54` +30%
berserk), ported, and **Demon + Straight Sword +10% lethality**, which the user later
confirmed is wrong and is not ported.
`test_engine_constants_match_source` asserts `C45`/`C48` no longer reference `C22`.

Current race/class terms. The **pool** terms sit inside the `E45`/`E48` caps; the **after-cap**
terms are separate race tags in the game (Kitsune's Trickery, Fae's Reach, Warbringer, Lord of War)
and are added after the cap:

| Race | Lethality (`E45`) | Attack speed (`E48`) |
|------|-------------------|----------------------|
| Orc Lord | 40% pool + Warbringer 7.5% per full 10% HP missing (`C55`) | Lord of War 7.5% per kill stack, max 5 (`E55`) |
| Archangel, Demon | 20% pool | 20% pool |
| Kitsune | 20% after cap | 20% after cap (+15% crit dmg after cap in `E47`) |
| Dragonborn | 12% | — |
| Orc | 10% | — |
| Shadow | 5% | 10% |
| Fairy + Spear | 15% after cap | 15% after cap |
| Felynx + Gauntlet | 20% | 20% |
| Vampire + Straight Sword | 10% | — |
| Goblin + Dagger | — | 10% |
| Golem + Colossal Sword or Great Axe | — | 15% |
| Dryad in Healing Grove (`C49`) | +15% crit chance and +15% crit dmg after cap | — |

Minotaur has no lethality; its Bull's Fury +30% sits in the berserk pool (`E54`).

### Resolved deviation (historical): berserk's 200% cap
**Resolved at the source in `UpdatedSpreadsheet.xlsx`:** Total Berserk DPS (`C112`) is now
`=((E19 * (1 + E54)) * E21) + SUM(C103:C107) + E107+C108+E108+C109` — it reads the capped
`E54` exactly as proposed below, so the engines' `CAPS.berserk = 2.0` clamp is now verbatim,
not a deviation. History follows.

`Extended.xlsx`'s `C97` computed berserk DPS as
`((E19 * (1 + C54 + IF(C22="Minotaur",30%,0))) * E21) + SUM(C90:C94) + E94` — an
inline, **uncapped** recomputation of the addend. `E54` right next to it already
computes `MIN(200%, C54 + IF(C22="Minotaur",30%,0))`, the same expression capped —
but nothing on `DPS Calculator`, including `C97`, ever reads `E54`. The user has
confirmed this is a spreadsheet bug (the intent was clearly for `E54` to cap every
berserk source at 200% total) and will fix `C97` to read `E54` later; until then,
all three engines deliberately diverge from the sheet's real (uncapped) `C97` output
to enforce the cap themselves:

- `forge_calculator/engine.py`: `CAPS["berserk"] = 2.0`; `berserk_level =
  min(build.berserk + RACE_BERSERK.get(build.race, 0.0), CAPS["berserk"])`.
- `Web/mediawiki/MediaWiki-ForgeCalculator.js`: `CAPS.berserk = 2.0`; `berserkLevel
  = Math.min(build.berserk + RACE_BERSERK[...], CAPS.berserk)`.
- **Not** ported to the retired `Web/js/` standalone engine, per the "MediaWiki
  only" rule (no fixes into retired code).

**Spreadsheet fix, when applied:** change `C97` from the inline recomputation above
to `=((E19 * (1 + E54)) * E21) + SUM(C90:C94) + E94` — i.e. reference `E54` instead
of duplicating its expression. Once that's live in the workbook, this stops being a
deviation and the code comments (`forge_calculator/engine.py`'s `berserk_level`
comment, this section) should be updated to say so.

Regression tests proving the clamp actually triggers: `tests/test_golden.py::test_berserk_caps_at_200_percent`
(manual 500% + Minotaur 30% → capped to 200%) and the `E54  berserk caps at 200%
total` check in `Web/mediawiki/reall-aggregates.js`. **The cap is reachable from the UI
itself now, not just direct engine calls** — the manual Berserk input's max was raised to
200% (see "Armor Stat & Berserk Input Cap Increase" below), so 200% manual + Minotaur's
+30% = 230% genuinely hits the clamp through the real input box, not only in tests.

### Dynamic Plan Tracking & Memory
- **Plan Storage:** Whenever a new development plan or roadmap is created while in **Plan Mode**, you must add a summary of that plan to `CLAUDE.md` under a dedicated tracking section **immediately when the plan is made** — before any implementation work begins. Do not wait until the plan's phases have been implemented to record it.
- **Progress Updates:** Each phase is marked done **individually, as soon as that phase is completed and committed** (never batch-marking the whole plan done at the end). Whenever a specific part, task, or phase of the active plan is completed, committed, and pushed to GitHub, immediately update `CLAUDE.md` to tick, check off, or cross out **only that phase**, so the tracking table reflects the true state at every step.

## Project overview

`forge_calculator` reproduces "LittleTimmy's DPS Calculator", an Excel workbook
computing DPS for a game's forge/weapon system. **The shipping product is the MediaWiki
calculator**; see the "MediaWiki only" rule above.

Maintained:
- **MediaWiki calculator** (`Web/mediawiki/`) — `MediaWiki-ForgeCalculator.js` is the
  whole app as one IIFE (engine + data loader + UI), deployed as `MediaWiki:ForgeCalculator.js`
  and imported from `MediaWiki:Common.js`. Styles in `Template-ForgeCalculator-styles.css`,
  data in `Data-*.json`. Deploy steps in `Web/mediawiki/DEPLOY.md`.
- **Reference engine** (`forge_calculator/engine.py`) — pure, headless, fully tested.
  `calculate(build, game)` → every workbook cell (E10…E101). Not part of any shipped UI:
  it exists so `fuzz_verify.js` can differentially verify the MediaWiki engine against it.
- **Data** (`forge_calculator/data.py`, `data/*.json`) — committed JSON is the source of
  truth; counts validated against the workbook (149 ores / 87 weapons / 20 races /
  46 runes / 16 achievements). Copied to `Web/data/` and `Web/mediawiki/Data-*.json`.
- **Build** (`build_data/`, `scripts/build_data.py`) — openpyxl extraction → JSON.
  Dev-only; never imported at runtime.

Retired — do not maintain:
- **Standalone web app** (`Web/js/`, `Web/css/`, `Web/index.html`). Its engine modules
  still carry the parity harnesses, so leave them runnable, but add nothing.
- **Python/Tkinter desktop app** (`forge_calculator/gui/`, `forge_calculator/app.py`,
  `scripts/smoke_gui.py`).

Workbook sheets:
- **DPS Calculator** — the main calculation sheet (cells C6–E146; Golemite block rows 39–64).
- **_Weapon** — weapon lookup (`C2:E90`, 89 weapons, types from `F12`'s `FILTER` literal — 11 incl. `Halberd`, race-bonus types `C23`).
- **_OptionsCrafter** — ore catalog (`A61:F209`; `A60` is the Select Ore sentinel).
- **_Options** — races (`B1:C20` dropdown + descriptions, availability matrix `E1:AA21`) + rune pool (`A1:A48`).
- **IGNORE REF CALC** — ignore.

## Domain model (engine)

The workbook follows the game's own code as extracted from the `.rbxlx` (see
`Forge_Game_vs_Calculator_Report.docx` and the "Game (.rbxlx) Alignment" plan below). Where the
game has a cooldown, a refresh rule or a random roll, the sheet uses its expected value.

- **4 forge slots** (`C6:C9` ore, `D6:D9` weight). An ore contributes a stat only when its share ≥10%; value ramps `base → max` as share goes 10% → 30% (`(base + (max-base)*MIN((share-0.1)/0.2, 1))/divisor`; `divisor` 100 for percents, 1 for durations). Below 10% → 0. A **gated flat** `IF(share<0.1, 0, value)` (Bismuth's procs) parses as `base == max`.
- **Weapon** (`D12` key, quality `E12`, forge `C13`): forged damage `C18` = base × ore power × `FORGE_MULT[level]` × `(1+quality/100)`; unforged `A18` is the same without the forge term. Weapon intervals are the average combo `HitCooldown` of the base type ÷ the variant's `AttackSpeedMultiplier`.
- **Stats** (`E45`–`E48`): the item/race-trait pool (ores, runes, armor inputs, achievements, pool race terms) is capped at 3.0 / 1.0 / 1.0 / 1.5; the after-cap race terms above are added on top.
- **Ore power** `E10` — a build of only Bismuth is a flat **8**, only Fichilliumorite a flat **1**; otherwise the weighted average of the slot multipliers with **Fichilliumorite, Bismuth, Select Ore and blank slots excluded from both halves** (fallback `AVERAGEIFS`, then 1).
- **Proc chances roll on integers** (game: `chance < math.random(0,100)` fails): every DPS cell uses `IF(proc exists, MIN(1,(INT(ROUND(chance*100,2))+1)/101), 0)` — `game_chance`/`gameChance`. A proc with 0% chance still fires 1 time in 101 (Demon's own burn). Not used for Smash, Fox Claws, Foxfire or the Archangel beam, which roll `math.random()` floats.
- **Cooldown procs** (lightning `E81`, Smash `E85`, black hole `E77` with its hard 1 s cooldown, Thunder Shard, Archangel beam): procs/s = `1/(cooldown + 1/(chance × E21))` — `cooldown_rate`/`cooldownRate`. Lightning with no cooldown source uses the game default 10 s (`E80`).
- **DoTs** (fire `E63`, poison `E68`): a re-proc adds half the duration, so uptime = `MIN(1, L/(1+L/2))` with `L = chance × E21 × duration` — `dot_uptime`/`dotUptime`. Duration (`C64`/`C69`) is 0 without a DoT, otherwise the longest source clamped to fire 1–5 s / poison 1–15 s (default 1 s). Poison takes the best Malachite slot, no first-slot rule.
- **Caps on damage**: explosion `C58` = `MIN(2.5, Σslots + Blast)`; smite `C72` = `MIN(2.5, Σslots + Angel 30%)`; black hole `C76` = `MIN(2.5, Galaxite)`, plus the Resonance +125% when Galaxite **and** Bismuth are each ≥10% of the ores; moon `C53` = `MIN(1.5, Σ)`.
- **Chance stacking**: chances and durations take the `MAX` across slots, abilities and race (Dragonborn burn 40% and Angel smite 50% are maxed, not added); damage sums; lightning cooldown takes the `MIN`.
- **Trait-damage multiplier** (Dryad Vital Power, `E49` max HP): `1 + MIN(INT(HP/1000),10) × 5%` on fire, poison, lightning, black hole (incl. Resonance) 
- **Bismuth** (user's choice, not the game's Prismatic Shift): attack speed ramps 1.8% → 18%; its procs are every T3 rune ÷ 8 as gated flats in the normal proc cells — explosion 8.75% / 5.25%, fire 3.25% / 7.5% / 0.5 s, poison 2% / 9.625% / 1.5 s, lightning 10% / 5.875% / 0.375 s cooldown — so they stack with other ores' procs and need ≥10% Bismuth. No Prismatic Shift row (`E109` is empty).
- **Race procs**: Smash (Orc Lord) 100% × `1/(10 + 1/(0.25×E21))`; Fox Claws (Kitsune) `0.75 × A18 × MIN(0.25 × E21, 3/2.22)` (max 3 spirits of ~2.22 s); Foxfire (Kitsune) `A18 × (1+E45) × 30% × (1 − e^(−0.5 × E21 × 3))` (reset-to-3 s refresh, boosted damage); Archangel beam (`C110`) `1.5 × A18 / (10 + 1/(0.33×E21))`, separate from ore smite; Cursed Aura (Demon, `E110`) `10% × A18` per second; Demon also gets +20% fire damage and a 3 s burn time.
- **Results block rows 102–116**: physical hit `C102` = `C18 × (1+E45) × crit_blend × E21`; every proc row scales on **unforged A18**; Total `C111` = all rows incl. `C110`/`E110`; TTK `E111/E112` = 25k / 75k ÷ total (Asura stays 75k for its two phases); `C115` min, `C116` max burst (procs on **forged C18**).
- **Berserk** `C112` = `C18 × (1 + E45 + E54) × crit_blend × E21` + every proc row, `E54 = MIN(200%, C54) + Minotaur 30%` — berserk is **additive with lethality** (same damage-boost pool in the game). **Moon Stone** `C113` = `C102 × (1+C53)` + every proc row.
- **Golemites** (rows 39–64, two of them): sub-stats `C41`–`D64` feed the existing cells — lethality / crit chance / crit dmg / attack speed join the capped pools (`C72`–`C75`); fire, poison, lightning damage add, their chances and times join the `MAX`; blast damage sits inside the 250% explosion cap; smite damage (`C101`) and moon boost (`C81`) are added **after** their caps; Golemite black-hole damage and Resonance (`C53`/`C54`) add to `C105`; Golemite black-hole chance joins `C106`'s `MAX`; Golemite lightning cooldowns join `E109`'s `MIN` only when an ore or rune cooldown exists (otherwise the 10 s default stands, verbatim). Golemite DPS `E56`/`E57` = `A18 × (2% + (MIN(25, lvl) − 13) × 0.04/12)` from level 13, × the fixed 0.66666666666666 hits/s (`E58`/`E59`); the total (`E62` → `E138`) joins Total / Berserk / Moon Stone DPS but not Max Burst.
- **Black hole** `C105` = Galaxite's per-slot ramp (`SUMPRODUCT`, no cap) + Golemite black-hole damage, plus — when Galaxite is slotted at all or a Golemite has black-hole damage — Golemite Resonance and +125% if Bismuth is slotted at all (any amount). `C106` = `MAX(Golemite chances, 30% if any Galaxite amount > 0)`.
- **Situational inputs**: Dryad `C49` (in Healing Grove, Yes/No) and `E49` (max HP); Orc Lord `C55` (HP missing %) and `E55` (kill stacks 0–5). All default to off/0.

## Preserved workbook quirks (do not "fix")

- `E45` and `E48` test the singular `Gauntlet` (the weapon data's real type). Both spellings stay registered at 20% in `CLASS_LETHALITY`/`CLASS_ATK_SPEED`; the plural is harmless dead weight.
- Armor stats feed `E45`/`E46`/`E47` via **C44/C42/C43** (`E42`–`E44` are dead cells).
- Kept from the sheet against the game (user's choice): burn chance Fireite / Gargantuan 2→20%, Kyubite 4.5→45%; Kitsunite smite damage is the one ramp with **no 10% share gate**, clamped `MAX(0.05, MIN(0.5, ramp))` (`gated`/`floor`/`ceiling` on its `StatRange`); Kitsunite / Marblite lightning cooldown ramps 0.3→3 s / 0.5→5 s; Bismuth attack speed ramps; Bismuth procs are the ÷8 flats above.
- Each slot is ramped on its own share; the same ore in two slots is not merged into one share (the game keys shares by ore). Only the black-hole / Resonance / Prismatic Shift gates sum an ore's slots (`SUMIF`).
- Ability inputs are **one row per ability**: Fire 34, Poison 35, Lightning 36, Blast 37, with DMG/Chance/Time in columns C/D/E (Blast has no time).
- C20 (base crit chance) enters **only** the crit blend, not `E45`.
- "Damage Boost" achievement feeds lethality (`E45`); one achievement dropdown is kept (`C98`) by request although the game stacks all earned ones.
- Forge level 9 = 1.5× (breaks the 0.05 step pattern); level outside 0–9 → 1.0.
- Percent inputs store **decimals** (0.30 = 30%); ability time cells are plain seconds.
- The workbook is a Google Sheets export: formulas use bare `IFS`/`SWITCH`/`FILTER` and `__xludf.DUMMYFUNCTION`. Edit it by patching the sheet XML (openpyxl strips cached values); to evaluate it in Excel, make a copy with `_xlfn.` prefixes first.

## UI invariants (MediaWiki)

Not workbook formulas — behaviour the tests lock down, recorded here because the code
carries no comments.

- **Ability inputs are no longer range-clamped (removed by request).** `ABILITY_RANGES`
  still exists and still drives the fractional-vs-whole `step` hint per field (Lightning
  Cooldown's `0.3` lower bound needs `step=0.1`, everything else is `step=1`), but its
  `min`/`max` are no longer read as HTML attributes or enforced by `clampAbilityValue` —
  a player can type any value from a rune roll the game ever offers without it snapping
  to a coded ceiling. Placeholder is a plain `0` and the tooltip just says
  "`<Field> (from runes). 0 = no ability.`" — no range is displayed because none is
  enforced. This was a deliberate UI decision, not a workbook fact, so — same as the
  ranges it replaces — it's exempt from "zero invented mechanics."
- `clampAbilityValue` treats `0`, empty and non-numeric alike as **"no ability" → 0**;
  any other numeric text passes through unchanged, unclamped. A **non-numeric** entry
  (e.g. "abc") is zeroed and additionally surfaces a warning in the shared `.fc-warnings`
  box ("`<Section> <Field> ability only takes numerical values.`"), the same mechanism
  used for the ore-slot-without-amount warning. `createAbilityGrid` tracks this per-field
  in a local `invalidFields` map (`container.getInvalidAbilityWarnings()`), separate from
  `computeWarnings(build)` since the invalid raw text never survives into `build` (it's
  zeroed on commit before the warning is read).
- **`setValue` deliberately does not fire `onChange`.** That is why a state restore or
  Reset keeps a slot's typed amount, while actually changing the ore in the dropdown
  zeroes it (`createOreSlot`). Changing this breaks `ore-slot-test.js`.
- **Weapon types need a minimum total ore amount** (sheet `F12`: `FILTER(types, thresholds <= D10)`, `D10` = sum of the four slot amounts). The thresholds are extracted into `weapons.json` as `type_min_ore` (Dagger 3, Straight Sword 4, Mace/Gauntlet 6, Axe/Katana 8, Great Sword/Spear 11, Great Axe/Halberd 15, Colossal Sword 19 — the game's `ItemRarity.lua` `min_ores`) plus the `not_enough_ore` fallback text. The weapon-type and weapon dropdowns only offer unlocked types (below 3 total the type list is just "Not enough Ore"); `setOreTotal` refreshes them on every ore-amount change and on `setBuild`. Like the sheet, an already-chosen weapon is **not** cleared when the total drops; `computeWarnings` adds "`<Type>` weapons need at least N total ore (you have M)." instead. UI-only, no engine change.
- **Golemite inputs** live in their own section with one tab per Golemite; the tab label shows the level and rarity. Each Golemite is a Level (whole number, 0–25) plus 4 ore slots (`createOreSlot` with `idPrefix`), stored as `{level, slots}`. The sub-stats are never typed: `deriveGolemiteStats(slots, game)` (engine half) works out the ore traits exactly like a weapon (same share ramp, gates, `MAX`/sum rules and the 250% / 150% caps) and multiplies every damage, chance and stat trait by `GOLEMITE_TRAIT_SCALING[rarity]`; durations and the lightning cooldown are not scaled. The rarity is the highest `GOLEMITE_RARITY_ORDER` rarity among ores with an amount > 0, read from `game.ore_rarity` (`Data:OreRarity.json`, built by `scripts/fetch_ore_rarity.py` from the wiki's `Module:Ore/Data`). A missing rarity page loads as `{}`, which makes every Golemite add nothing. The pane shows a read-only summary (rarity, scaling, non-zero stats). User-given rule, not a workbook formula; the engine's Golemite cells are unchanged.
- Ore `atk_speed` is **not** reachable from the MediaWiki UI — there is no attack-speed
  input, so it only ever arrives from ores, runes, race and achievements.
- **Active Traits' free-text clauses are computed when they safely can be, approximated
  otherwise.** Below 30% share, `activeTraits` tries to pair each `|`-separated clause in
  `trait10` against the same-position clause in `trait30` (`splitTraitClauses` +
  `parsePercentClause`): if both are a clean `"+X% Label"` with an identical label after the
  number is stripped, it computes the real `scaleRange` ramp instead of guessing. This
  covers Vitality/Swiftness/Endurance/Stamina/plain Movement Speed — none of these have a
  DPS Calculator formula cell (see "Berserk-Group Trait Text..." below for the structured-data
  equivalent), so they're never invented, only algebra on numbers already in the workbook's
  own trait text. A clause that doesn't cleanly pair (a second embedded number, a differently
  worded counterpart, no clause at that position at all) falls back to the original
  `"[X% power]"` approximation — still present for genuinely compound free text like "Freeze
  enemies for 0.2 seconds. 1.5% chance on hit. Has cooldown of 15" (Prismatic Heart, Snowite,
  Iceite, Golem Heart). Verify with `node Web/mediawiki/generic-trait-ramp-test.js`.

## Commands

```bash
python -m pytest tests/               # 138 tests (engine/golden/parser/data/races/bismuth/golemite)
pip install -e .[build]               # dev: add openpyxl
python -m scripts.build_data          # regenerate data/*.json from UpdatedSpreadsheet.xlsx
python scripts/fetch_ore_rarity.py    # ore rarities from the wiki's Module:Ore/Data -> data/ore_rarity.json + Data-OreRarity.json
```

After a data rebuild, copy `data/*.json` to `Web/data/` and to
`Web/mediawiki/Data-*.json` (capitalised names) — the MediaWiki calculator ships those.

Workbook verification:

```bash
node Web/mediawiki/reall-golden.js                    # MediaWiki IIFE  -> 46 cells of the saved build
node Web/mediawiki/reall-aggregates.js                # berserk/moon stone/max burst/explosion/smite aggregates
node Web/mediawiki/verify-engine.js                   # goldens vs tests/test_golden.py
node Web/mediawiki/fuzz_verify.js                     # 250 builds JS <-> Python
python Web/mediawiki/fuzz_gen.py                      # regenerate fuzz-cases.json
python scripts/reall_parity.py                        # reference engine -> saved-build cells, read from the workbook's own cache
python scripts/audit_reall.py reference/UpdatedSpreadsheet.xlsx data/ores.json
python -m scripts.excel_fuzz gen builds.json 80 7     # random builds for Excel (Windows + Excel only)
powershell scripts/excel_batch.ps1 -Path <_xlfn copy>.xlsx -BuildsJson builds.json -OutJson excel.json
python -m scripts.excel_fuzz compare builds.json excel.json   # Excel (the workbook itself) vs engine.py, 43 cells
```

The saved build in the workbook is Snowite 12 / Kitsunite 15 / Moon Stone 15 / Bismuth 15 with a
Colossal Terrorblade on a Human, so the saved-build harnesses exercise Bismuth,
moon, lightning, smite and fire. After a formula edit, the cached values come from an Excel
recalculation of an `_xlfn.`-prefixed copy until the user re-saves the workbook through Google Sheets.

Every MediaWiki UI change should also keep the focused tests green:

```bash
node Web/mediawiki/ability-inputs-test.js   node Web/mediawiki/results-panel-test.js
node Web/mediawiki/ore-slot-test.js         node Web/mediawiki/bonus-derive-test.js
node Web/mediawiki/armor-stats-test.js      node Web/mediawiki/berserk-input-test.js
node Web/mediawiki/no-ore-weapon-test.js    node Web/mediawiki/berserk-trait-test.js
node Web/mediawiki/generic-trait-ramp-test.js  node Web/mediawiki/new-races-test.js
node Web/mediawiki/bismuth-test.js         node Web/mediawiki/golemite-ui-test.js
node Web/mediawiki/validation-warnings-test.js
```

`copy-stat-test.js` (expects the pre-`fc-is-capped` inline cap colour) and `icon-test.js`
(4 failures) were already red before the UpdatedSpreadsheet.xlsx adoption and are not in
the list above.

After changing either engine, rerun `fuzz_gen.py` *then* `fuzz_verify.js` — the
cases file stores reference-engine results, so a stale one compares against the old engine.

A rebuild is only trustworthy if `audit_reall.py` comes back with **0 ore-range problems**.

Retired, kept only as parity harnesses: `node Web/js/engine/reall-golden.test.mjs`,
`node Web/js/engine/normalize.test.mjs`. `scripts/smoke_gui.py` drives the retired
desktop GUI and no longer needs to pass for a MediaWiki change.

No linter or formatter is configured.

## Development Plan Tracking

### reall.xlsx Realignment — COMPLETED ✅
**Goal:** `reference/reall.xlsx` replaced `new.xlsx` as the authoritative workbook. An
audit found the MediaWiki engine wrong on **27 of 37 cells** for the workbook's own
default build (Total DPS 4,631 vs 9,790 — 47% of correct). Two independent causes:
`Data-*.json` had been hand-edited rather than rebuilt (commit `e512c81`), and the JS
engines carried seven genuine formula bugs. Full findings in
`forge_calculator/REALL_FORMULA_AUDIT.md`.

| Phase | Work | Status | Commit |
|-------|------|--------|--------|
| 0 | **Audit** — formula-by-formula diff vs the workbook's cached values; added `reall-golden.js`, `reall-aggregates.js`, `audit_reall.py` | ✅ Done | bea8525 |
| 1 | **Data rebuild** — extractor retargeted to the new layout (ore catalog `A56:F202`, weapons `2..81`, achievements `C85`, `C12` validation now a range ref); parser rewritten for the four ramp spellings + nested `IF`/`OR` groups + the Kitsunite clamp; `ArrayFormula` unwrapping; ore `atk_speed` merged from `new.xlsx`. Fixed 7 multipliers, Tanto + 3 more weapons, and 30 ore ranges | ✅ Done | 1346641 |
| 2 | **Engine alignment** — all three engines: Archangel smite `MIN(FLOOR(E21,1)*0.5,1.5)`; smite chance `MAX(ores)+race`; black hole `MAX(1,E21)`; explosion chance additive; berserk as a single multiplier on `C89`; Moon Stone adds procs back; Fichilliumorite excluded from `E10`; `gated`/`floor`/`ceiling` on `StatRange`; Felynx both spellings. Also fixed the standalone `avgOrePower` fallback (summed slot objects, not powers) and its missing lightning result fields | ✅ Done | 7c5fd5f |
| 3 | **Lightning ability inputs** — the sheet's Lightning row (`C36`/`D36`/`E36`) was entirely unwired in the MediaWiki UI; added the three fields, the build/transform plumbing, and the ability terms in `procComponents` | ✅ Done | 74993ca |
| 4 | **Tests re-synced** — parser + constants tests now read the workbook (the `all_formulas.txt` they used was deleted in `c6d3e31`); goldens, fuzz cases and the four stale MediaWiki tests updated; restored the `clampAbilityValue` guard that had gone missing from the source | ✅ Done | eed8632 |
| 5 | **Docs** — this file: workbook pointer, approved deviations, corrected cell addresses, ability-grid layout, verification commands | ✅ Done | (this session) |

**Verification:** `pytest tests/` → **82 passed**; `scripts/reall_parity.py`,
`reall-golden.js`, `reall-golden.test.mjs`, `reall-aggregates.js` → all PARITY PASSED;
`verify-engine.js` → ALL GOLDEN CHECKS PASSED; `fuzz_verify.js` → DIFFERENTIAL FUZZ
PASSED (250 builds, 9,506 numeric fields, worst rel err 2.75e-16); all 7 focused
MediaWiki tests PASS; `smoke_gui.py` → SMOKE OK.

**Baseline note:** the suites were already red before this work began — `pytest` had 4
failures, `verify-engine.js` 1, `fuzz_verify.js` 974 mismatches, and 4 MediaWiki tests
failed (confirmed by running them at `4a3f4e3`). `active_traits` is no longer compared
across engines: the desktop and web sides render it deliberately differently, so only
the numeric fields are a parity contract.


### UX Polish Plan (Phases 1–5) — COMPLETED ✅
**Goal:** Transform barebones input UX (readonly Comboboxes) into a polished desktop app with search, persistence, favorites, tooltips, and responsiveness.

| Phase | Feature | Status | Commit |
|-------|---------|--------|--------|
| 1 | **SearchableCombo** — search-as-you-type dropdown with keyboard nav (Up/Down/Enter/Esc); applied to 12 calculator combos; browse-tab filters with Esc-to-clear | ✅ Done | c38e6be |
| 2 | **State Persistence** — `settings.py` (stdlib JSON), `MainWindow.capture_state/restore_state`, app startup restore + `WM_DELETE_WINDOW` save; 75 tests incl. `test_settings.py` | ✅ Done | c38e6be |
| 3 | **Favorites / Quick-Pins** — ★/☆ toggle on 4 ore slots + weapon; pinned items sort to top of combo via `set_values()`; persisted in state | ✅ Done | c38e6be |
| 4 | **Tooltips** — `Tooltip` class (350ms hover); result rows show formula summaries; ore/weapon combos show live stat detail | ✅ Done | 11464c1 |
| 5 | **Responsiveness & Polish** — status bar (Total DPS + active tab), invalid-input red highlighting, Reset/Copy buttons, results grouped under Core/Stats/DPS/Time headers | ✅ Done | ade84eb |

**Verification:** `pytest tests/` (75 passed), `scripts/smoke_gui.py` (SMOKE OK), manual run at 900×620 and maximized.

### UI/UX Fixes & Improvements — COMPLETED ✅
**Goal:** Address six targeted UI/UX improvements for cleaner, more intuitive experience.

| Task | Description | Status | Commit |
|------|-------------|--------|--------|
| 1 | **Dropdown Toggle** — SearchableCombo arrow button toggles open/close on repeated clicks | ✅ Done | (this session) |
| 2 | **Remove Favorites** — Strip star buttons, pinned sorting, and persistence logic entirely | ✅ Done | (this session) |
| 3 | **Remove Cell References** — Replace all spreadsheet coords (E12, C13, etc.) with clean labels | ✅ Done | (this session) |
| 4 | **Quality Default = 100** — Startup and Reset now default Quality to 100 (2× damage) | ✅ Done | (this session) |
| 5 | **Forge → Enhancement** — Rename "Forge level" to "Enhancement" everywhere | ✅ Done | (this session) |
| 6 | **Results Redesign** — Card-based layout with Labelframes, separators, bold Total DPS | ✅ Done | (this session) |
| 7 | **None Default in Dropdowns** — Race, Bonus Type, Weapon Type, Weapon, and 4 Ore slots all include "None" as first option and default to it | ✅ Done | (this session) |

**Verification:** `pytest tests/` (75 passed), `scripts/smoke_gui.py` (SMOKE OK), manual run at 900×620 and maximized.

### MediaWiki Deployment Plan (Phases 1–5) — COMPLETED ✅
**Goal:** Port the standalone web calculator (`Web/`) to a Miraheze MediaWiki as a transcludable template — flat `Data:` JSON pages, one TemplateStyles sheet, one Common.js module.
**Plan file:** `.claude/plans/mossy-dazzling-puppy.md`. Artifacts in `Web/mediawiki/`.

| Phase | Feature | Status | Commit |
|-------|---------|--------|--------|
| 1 | **Flat Data JSON** — `Data-Ores/Weapons/Races/Runes/Achievements.json` (byte-identical to `Web/data/*.json`) | ✅ Done | 205757e |
| 2 | **TemplateStyles CSS** — 3 sheets merged into one, scoped under `.fc-calculator`, `--fc-*` vars | ✅ Done | 205757e |
| 3 | **Template:ForgeCalculator wikitext** — transcludable shell with noscript + loading placeholders | ✅ Done | 205757e |
| 4 | **Common.js module** — single IIFE (engine + loader + components); data fetched from `Data:` pages with 3 API fallbacks; fixed `is_weapon` derivation (`"eapon" in equipment.lower()`) | ✅ Done | 205757e |
| 5 | **Deploy guide + verification** — `DEPLOY.md`; `verify-engine.js` (9 golden checks) + `fuzz_verify.js` (250 builds, 8755 numeric fields, active_traits) all pass | ✅ Done | 205757e |

**Verification:** `node Web/mediawiki/verify-engine.js` → ALL GOLDEN CHECKS PASSED; `node Web/mediawiki/fuzz_verify.js` → DIFFERENTIAL FUZZ PASSED (worst rel err 5.19e-16). Deploy steps in `Web/mediawiki/DEPLOY.md`.

### Manual Calculation Refactor — COMPLETED ✅
**Goal:** Move the web calculator to explicit "Calculate DPS" triggering, remove auto-recalc and two display metrics. Mirrored in both the MediaWiki IIFE and the standalone ESM app.

| Change | MediaWiki (`Web/mediawiki/`) | Standalone (`Web/js/`) | Status | Commit |
|--------|------------------------------|------------------------|--------|--------|
| **Calculate DPS button** — manual trigger below inputs; inputs hold pending state; no partial re-renders on change | `forge-calculator.common.js` (+ `fc-calc-btn` in `Template-ForgeCalculator-styles.css`) | `main.js`, `InputPanel.js` (+ `.ep-btn`/`.ep-calc-btn` in `css/calculator.css`) | ✅ Done | 2d9ac4d |
| **Disable auto-recalc** — removed `scheduleRecalc`/`recalcTimeout`; `handleBuildChange` only stores build; `onCalculate: recalculate` wired in `init` | `forge-calculator.common.js` | `main.js` | ✅ Done | 2d9ac4d |
| **Remove Crit Blend** — dropped from Core DPS card and clipboard copy | `forge-calculator.common.js` | `main.js`, `ResultsPanel.js` | ✅ Done | 2d9ac4d |
| **Remove Burst section** — card, update block, and clipboard section removed; engine still returns `min_dps`/`max_dps`/`crit_blend` for fuzz parity | `forge-calculator.common.js` | `main.js`, `ResultsPanel.js` | ✅ Done | 2d9ac4d |
| **Fix pre-existing standalone bug** — duplicate `deepClone` declaration (import + local func) was a module SyntaxError; removed unused `debounce`/`fmt4` imports | — | `main.js`, `ResultsPanel.js` | ✅ Done | 2d9ac4d |

**Verification:** `node Web/mediawiki/verify-engine.js` → ALL GOLDEN CHECKS PASSED; `node Web/mediawiki/fuzz_verify.js` → DIFFERENTIAL FUZZ PASSED (worst rel err 5.19e-16); `node --check`/`node --input-type=module --check` clean on all modified JS.

### UI Label / Validation / Placeholder / Layout Overhaul — COMPLETED ✅
**Goal:** UX polish pass across all three calculators (MediaWiki IIFE, standalone ESM, Python/Tkinter desktop): cap Quality at 100, rename result labels, replace "None" dropdown placeholders with contextual "Select X" prompts (internal sentinel stays `"None"`), remove Base Crit Chance (web only), show each ore's multiplier, rebuild Runes as 3 lines × 2 slots (web only). Engine/formulas untouched.

| Change | MediaWiki | Standalone | Desktop | Status | Commit |
|--------|-----------|------------|---------|--------|--------|
| **Quality cap (100)** — `max`/`to=100`, clamp in change handler / `_build()` | `forge-calculator.common.js` | `WeaponSelector.js` | `calculator_tab.py` | ✅ Done | 4aaa441 |
| **Label renames** — Base Damage, Average Multiplier, Weapon Damage, Time taken to defeat Golem/Asura, Ore Slots | cards + clipboard | `ResultsPanel.js`, `main.js` | result cards | ✅ Done | 4aaa441 |
| **"Select X" placeholders** — prompt-first dropdown options, `toUI`/`fromUI` at state boundaries; desktop `_build`/`get_state`/`set_state`/`_reset` translate prompt ↔ sentinel | `forge-calculator.common.js` | `WeaponSelector.js`, `InputPanel.js` | `calculator_tab.py` | ✅ Done | 4aaa441 |
| **Remove Base Crit Chance** — UI field, DEFAULT_BUILD, `base_crit_chance: 0` (web only) | `forge-calculator.common.js` | `StatInput.js`, `InputPanel.js`, `main.js` | — | ✅ Done | 4aaa441 |
| **Per-ore multiplier** — `×multiplier` readout beside each slot, live-updated | `.fc-ore-slot-mult` CSS | `OreSlot.js` + `.ep-ore-slot-mult` CSS | `_update_ore_mult` label | ✅ Done | 4aaa441 |
| **Rune grid** — MediaWiki was later widened to 3×3 (9 cells, C27:E29; `runes` → 9-element array in DEFAULT_BUILD); standalone stayed 3×2 (6 fixed cells, C27/D27–C29/D29) since it's retired. `runeTotals`/`rune_totals` loop generically in all three engines, so grid width was never an engine change | `createRuneSelector` + CSS | `RuneSelector.js` + CSS | — | ✅ Done | 4aaa441 (later widened to 9, see "Extended.xlsx Adoption") |

**Verification:** `node Web/mediawiki/verify-engine.js` → ALL GOLDEN CHECKS PASSED; `node Web/mediawiki/fuzz_verify.js` → DIFFERENTIAL FUZZ PASSED; `python -m pytest tests/` → 75 passed; `python scripts/smoke_gui.py` → SMOKE OK (incl. new quality-cap + quality 100→50 recompute checks).

### MediaWiki Abilities Input Overhaul — COMPLETED ✅
**Goal:** MediaWiki-only pass on the Abilities section: label it as rune-sourced, switch percent inputs to whole-percent entry (15 = 15%), and clamp each ability field to its valid range via `min`/`max` attrs, change/blur validation, and range placeholders/tooltips. **The engine is untouched** — the clamp ranges are **user-specified UI validation constraints** (game rune-ability ranges), not formula constants, so they don't fall under the "Zero invented mechanics" rule (same precedent as the Quality cap). Standalone `Web/js` and desktop are intentionally not changed.

| Change | Where | Status | Commit |
|--------|-------|--------|--------|
| **Section labeling** — "Abilities" → "Abilities (From Runes)" + subtext ("Enter percentages as whole numbers (15 = 15%). Leave 0 for no ability.") | `forge-calculator.common.js` | ✅ Done | (this session) |
| **Whole-percent format** — UI/build store percents (15 = 15%); `transformBuildForEngine` divides the 6 pct fields by 100, times stay seconds | `forge-calculator.common.js` | ✅ Done | (this session) |
| **Clamp ranges** — Fire DMG/Chance/Time 1–22/1–50/1–3s; Poison 1–7/1–35/1–6s; Blast 1–40/1–20. `0`/empty/non-numeric = no ability (keeps `DEFAULT_BUILD` + reset at 0) | `ABILITY_RANGES` + `clampAbilityValue` in `forge-calculator.common.js` | ✅ Done | (this session) |
| **min/max + step + placeholder + tooltip** — HTML attrs = clamp range, `step=1`, range hints (`1-22%`, `1-3s`) + title tooltips ("Range: X–Y. 0 = no ability.") | `createAbilityGrid` | ✅ Done | (this session) |
| **Validation on change/blur/input** — debounced `input` + `change` + `blur` all clamp | `forge-calculator.common.js` | ✅ Done | (this session) |
| **CSS** — `.fc-ability-section-title`/`.fc-ability-section-subtext` (plain class selectors, TemplateStyles-safe). No `:invalid`/`:out-of-range` neutralizer — the TemplateStyles sanitizer rejects form-state pseudo-classes; range is enforced purely in JS | `Template-ForgeCalculator-styles.css` | ✅ Done | (this session) |
| **Tests** — new `ability-inputs-test.js`: DOM-level checks for clamp logic, min/max/step/placeholder/title attrs, change/blur/input clamping, percent→decimal transform | `Web/mediawiki/ability-inputs-test.js` | ✅ Done | (this session) |

**Known behavior (intentional):** clamping is silent — a value outside the range snaps to the bound on blur/change; the valid range is always visible in the field's placeholder and hover tooltip.

### DPS Breakdown Blast/Smite Display Fix — COMPLETED ✅
**Goal:** Fix the web results panel showing the wrong DPS component for the Blast ability. The "Blast DPS" row displayed `smite_dps` (a separate Heavenite / Angel / Archangel proc, workbook C88) while the real blast proc `explosion_dps` (C85 — fed by the Blast ability inputs E34/E35 and by Gargantuan/Magmaite/Meteorite/SSBH ores) was folded into `total_dps` but never displayed — so blast ability inputs appeared to "do nothing" in the DPS breakdown. Root cause was a porting bug shared by **both** web versions; the desktop GUI (`calculator_tab.py`) already shows the two procs separately. Fixed to match the desktop: DPS Breakdown now has 7 rows.

| Change | MediaWiki (`Web/mediawiki/`) | Standalone (`Web/js/`) | Status | Commit |
|--------|------------------------------|------------------------|--------|--------|
| **DPS Breakdown rows** — Weapon / **Explosion** / Fire / Poison / **Smite** / Black Hole / Total (was Weapon / Fire / Poison / "Blast" / Black Hole / Total) | `forge-calculator.common.js` dps card + `updateResults` | `ResultsPanel.js` | ✅ Done | (this session) |
| **Clipboard** — add `Explosion DPS`, rename `Blast DPS` → `Smite DPS` | `formatResultsForClipboard` | `main.js` | ✅ Done | (this session) |
| **Regression test** — `results-panel-test.js`: renders real panel in a Node DOM mock, asserts 7 row labels + `explosion_dps`↔Explosion / `smite_dps`↔Smite mapping + no stale "Blast DPS" label | `Web/mediawiki/results-panel-test.js` | — | ✅ Done | (this session) |

**Verification:** `node Web/mediawiki/verify-engine.js` → ALL GOLDEN CHECKS PASSED; `node Web/mediawiki/fuzz_verify.js` → DIFFERENTIAL FUZZ PASSED (worst rel err 5.19e-16); `node Web/mediawiki/ability-inputs-test.js` and `results-panel-test.js` → PASSED; `node --check` clean on all modified JS. Engine untouched — this is display/porting only.

**Note for users:** Fire/Poison abilities no longer need a matching fire/poison ore — the workbook's duration gate was removed (see the Fire/Poison Ability Traits section below).

### Active Traits Text Overflow Fix — COMPLETED ✅
**Goal:** The Active Traits card rendered its (long, multi-trait) text as a `.fc-stat-row`/`.fc-stat-val`, which is `flex-shrink:0` inside an `overflow:hidden` card — long trait strings overflowed and got clipped. Replaced the stat row with a full-width wrapping block in both web versions.

| Change | MediaWiki (`Web/mediawiki/`) | Standalone (`Web/js/`) | Status | Commit |
|--------|------------------------------|------------------------|--------|--------|
| **Traits render** — `.fc-traits-block` with label on top + `.fc-traits-value` below (`white-space:normal; overflow-wrap:anywhere; word-break:break-word`) instead of a flex stat row | `forge-calculator.common.js` `updateResults` | `ResultsPanel.js` | ✅ Done | (this session) |
| **CSS** — `.fc-traits-block`/`-label`/`-value` (plain class selectors, TemplateStyles-safe); mobile size tweak at ≤520px | `Template-ForgeCalculator-styles.css` | `calculator.css` | ✅ Done | (this session) |
| **Regression test** — `results-panel-test.js` now asserts the traits block renders with the full text preserved (no truncation) and no stat row is used | `Web/mediawiki/results-panel-test.js` | — | ✅ Done | (this session) |

**Verification:** `node Web/mediawiki/results-panel-test.js` → ALL RESULTS-PANEL CHECKS PASSED; `verify-engine.js` / `ability-inputs-test.js` / `fuzz_verify.js` all pass; `node --check` clean on all modified JS. Display-only change — engine untouched.

### Ore Slot Amount Reset on Ore Change — COMPLETED ✅
**Goal:** When an ore is changed to a different ore (or removed via the prompt) in an ore slot, the slot's amount resets to 0. Re-selecting the same ore keeps the typed amount; programmatic `setValue` (state restore / Reset) preserves the amount (the dropdown's `setValue` does not fire `onChange`).

| Change | MediaWiki (`Web/mediawiki/`) | Standalone (`Web/js/`) | Status | Commit |
|--------|------------------------------|------------------------|--------|--------|
| **Amount reset** — dropdown `onChange` compares new name vs current; on change/removal it zeroes `currentAmount` + the amount input before emitting | `forge-calculator.common.js` `createOreSlot` | `OreSlot.js` | ✅ Done | (this session) |
| **Regression test** — `ore-slot-test.js`: renders the real slot, drives the dropdown via item clicks, asserts reset on change/removal, preserve on same-ore re-select, preserve on `setValue` | `Web/mediawiki/ore-slot-test.js` | — | ✅ Done | (this session) |

**Verification:** `node Web/mediawiki/ore-slot-test.js` → ALL ORE-SLOT CHECKS PASSED; `verify-engine.js` / `ability-inputs-test.js` / `results-panel-test.js` / `fuzz_verify.js` all pass; `node --check` clean. Engine untouched.

### Fire/Poison Ability Traits Without Ores — COMPLETED ✅
**Goal:** Mirror the user's workbook edit (C63/C68) that removed the fire/poison duration gate, so rune ability traits contribute DPS without a matching fire/poison ore (and for fire without Dragonborn). Poison duration uses only the FIRST Malachite slot (C68 XLOOKUP), not the max. Ported to all three engines; the stat-matrix parser was taught to extract from the new XLOOKUP array formula.

| Change | Python | Standalone (`Web/js/`) | MediaWiki (`Web/mediawiki/`) | Status | Commit |
|--------|--------|------------------------|------------------------------|--------|--------|
| **Duration gate removed** — `_duration`/`duration` drops the `MAX(ore)=0` gate; ability time alone counts | `engine.py` | `procs.js` | `forge-calculator.common.js` | ✅ Done | (this session) |
| **Poison first-Malachite** — `first_slot_val`/`firstSlotVal` helper (C68 XLOOKUP semantics) | `engine.py` | `procs.js` | `forge-calculator.common.js` | ✅ Done | (this session) |
| **Reference files** — C63/C68 replaced with the workbook's new formulas (C68 whitespace-normalized `-2`) | `all_formulas.txt` + `all_formulas_reference (1).txt` | — | — | ✅ Done | (this session) |
| **Parser** — `_XLOOKUP_SCALE` path in `parse_stat_matrix` so Malachite `poison_duration (0.3,3,1)` still parses from the new C68 (txt + workbook) | `build_data/formula_parser.py` | — | — | ✅ Done | (this session) |
| **Tests** — 5 engine cases (fire/poison time alone, Dragonborn combine, first-Malachite) + golden check #10 | `tests/test_engine.py` | — | `verify-engine.js` | ✅ Done | (this session) |
| **Fuzz regenerated** — `fuzz-cases.json` rebuilt (138 fire-alone + 129 poison-alone cases now positive) | — | — | `fuzz-cases.json` | ✅ Done | (this session) |

**Verification:** `python -m pytest tests/` → 79 passed, 1 skipped; `node Web/mediawiki/verify-engine.js` → ALL GOLDEN CHECKS PASSED (10 checks); `node Web/mediawiki/fuzz_verify.js` → DIFFERENTIAL FUZZ PASSED (250 builds, 8755 fields, worst rel err 5.19e-16); `node --check` clean on both edited JS engines; `python scripts/smoke_gui.py` → SMOKE OK.

### Auto-Derived Race/Class Weapon Bonus — COMPLETED ✅
**Goal:** Remove the "Select Bonus Type" dropdown from the web calculators and auto-detect the race/class weapon-type bonus from the selected weapon's type. The workbook E44/E47 formulas check `AND(C22=<race>, C23=<bonus type>)`; C23 is now always the equipped weapon's type (workbook intends the bonus to come from the actual weapon). No engine/formula changes — the derivation lives in the UI transform layer, so `fuzz_verify.js` (which calls `calculate` directly with its own `bonus_weapon_type`) is unaffected.

| Change | MediaWiki (`Web/mediawiki/`) | Standalone (`Web/js/`) | Status | Commit |
|--------|------------------------------|------------------------|--------|--------|
| **Remove Bonus Type input** — dropdown, label, `BONUS_PROMPT`, `bonusType` build field, `setBuild`/`updateFromBuild` line all removed; "Race & Bonus" → "Race" | `forge-calculator.common.js` `createInputPanel` | `InputPanel.js` | ✅ Done | (this session) |
| **Auto-derive** — `deriveBonusType(build)` resolves `gameData._weapon_index.get(weaponName).type`; `transformBuildForEngine` sets `bonus_weapon_type` from it (empty when no weapon) | `forge-calculator.common.js` | `main.js` | ✅ Done | (this session) |
| **Clipboard** — `| Bonus: …` → `| Weapon-Type Bonus: <derived>` | `formatResultsForClipboard` | `formatResultsForClipboard` | ✅ Done | (this session) |
| **CSS** — `.fc-bonus-wrapper`/`.ep-bonus-wrapper` rules removed (incl. responsive label group) | `Template-ForgeCalculator-styles.css` | `calculator.css`, `responsive.css` | ✅ Done | (this session) |
| **Regression test** — `bonus-derive-test.js`: transform maps Ironhand→Gauntlet etc., engine reaches E44/E47 bonuses end-to-end (Felynx+Gauntlet→20% lethality, Vampire+Straight Sword→10%, Goblin+Dagger / Golem+Colossal Sword / Golem+Great Axe→10/15/15% atk speed), no stale bonus UI in source | `Web/mediawiki/bonus-derive-test.js` | — | ✅ Done | (this session) |

**Verification:** `node Web/mediawiki/verify-engine.js` → ALL GOLDEN CHECKS PASSED; `node Web/mediawiki/fuzz_verify.js` → DIFFERENTIAL FUZZ PASSED (250 builds, 8755 fields, worst rel err 5.19e-16); `node Web/mediawiki/bonus-derive-test.js` / `ability-inputs-test.js` / `results-panel-test.js` / `ore-slot-test.js` → all PASSED; `node --check` clean on modified JS. Engine and Python/desktop untouched. Note: the Felynx **plural** "Gauntlets" atk-speed bonus (E47) stays unreachable — no weapon has type "Gauntlets" (documented workbook quirk).

### Base Crit Damage Fix (100% crit → 0 DPS) — COMPLETED ✅
**Goal:** Fix the porting bug where a 100% crit chance with 0% crit-damage bonus produced **0 weapon DPS** (and `ttk = infinity` when no proc added DPS). Root cause: the workbook's crit blend (C84) is `MIN(C20+E45,1)*(C21+E46)+(1-MIN(C20+E45,1))`, where **C21 = 1.45** is the workbook's *base* crit damage (a crit deals 145% before bonuses). The port hardcoded `base_crit_dmg: 0`, so at 100% crit chance `blend = 1*0 + 0 = 0`. Fixed the default to the workbook's 1.45 everywhere (base crit chance C20=0 was already correct). The engine blend/max-DPS formulas were already correct — only the base value was wrong.

| Change | Where | Status | Commit |
|--------|-------|--------|--------|
| **Engine default** — `Build.base_crit_dmg: 0.0 → 1.45` (C21) | `forge_calculator/engine.py` | ✅ Done | (this session) |
| **Desktop GUI** — `base_crit_dmg=0.0 → 1.45` | `forge_calculator/gui/calculator_tab.py` | ✅ Done | (this session) |
| **Web transforms** — `base_crit_dmg: 0 → 1.45` | `forge-calculator.common.js`, `Web/js/main.js` | ✅ Done | (this session) |
| **Goldens updated** — wolfarite max_dps `0 → 255.05`, gargantuan `81.52 → 280.51` (C96 includes C21); workbook-cached golden now validates the 1.45 math directly | `tests/test_golden.py`, `verify-engine.js` | ✅ Done | (this session) |
| **Repro** — `zero_dps_repro.js` demonstrates the fixed path (weapon DPS 0 → 135.6, blend 1.45, finite TTK) | `Web/mediawiki/zero_dps_repro.js` | ✅ Done | (this session) |

**Verification:** `python -m pytest tests/` → **80 passed** (workbook-cached golden now runs and confirms C21 math); `node Web/mediawiki/verify-engine.js` → ALL GOLDEN CHECKS PASSED; `node Web/mediawiki/fuzz_verify.js` → DIFFERENTIAL FUZZ PASSED (250 builds, 8755 fields, worst rel err 5.19e-16); all focused tests (`ability-inputs`/`results-panel`/`ore-slot`/`bonus-derive`) PASSED; `node --check` clean; `python scripts/smoke_gui.py` → SMOKE OK. Fuzz untouched (`fuzz_gen.py` passes `base_crit_dmg` explicitly, so parity holds). Note: `min_dps`/`weapon_dps` at 0% crit are unchanged (blend = 1); only `max_dps` (C96, assumes all crits) and weapon DPS at **non-zero** crit chance change.

### MediaWiki Armor Stats Whole-Percent Input — COMPLETED ✅
**Goal:** MediaWiki-only pass on the Armor Stats section: enter percentages as whole numbers (15 = 15%) instead of decimals (0.15). Values clamp to the stat cap on commit; `transformBuildForEngine` divides the 3 armor pct fields by 100 before the engine. The engine itself is untouched — the /100 lives in the UI transform (same precedent as the Abilities whole-percent overhaul). Standalone `Web/js` and desktop keep decimal inputs.

| Change | Where | Status | Commit |
|--------|-------|--------|--------|
| **Whole-percent format** — `createStatInput` fields use `step:1`, `max` = stat cap (lethality 150, crit chance/dmg 100 at the time); `transformBuildForEngine` divides the 3 armor pct fields by 100. *(Crit Damage's max was later raised to 150 — see "Armor Stat & Berserk Input Cap Increase" below.)* | `forge-calculator.common.js` | ✅ Done | (this session) |
| **Commit clamping** — `[0, max]` clamp on change; non-numeric/empty → 0 | `createStatInput` | ✅ Done | (this session) |
| **Subtext** — "Enter percentages as whole numbers (15 = 15%)." under the Armor Stats title | `forge-calculator.common.js` + `.fc-input-section-subtext` in `Template-ForgeCalculator-styles.css` | ✅ Done | (this session) |
| **Test** — `armor-stats-test.js`: DOM-level checks for step/max/min attrs, clamp on commit, percent→decimal transform, no stale decimal inputmode | `Web/mediawiki/armor-stats-test.js` | ✅ Done | (this session) |

**Verification:** `node Web/mediawiki/armor-stats-test.js` → ALL ARMOR-STATS CHECKS PASSED; `verify-engine.js` / `fuzz_verify.js` / `ability-inputs-test.js` / `results-panel-test.js` / `ore-slot-test.js` / `bonus-derive-test.js` all pass; `node --check` clean. Engine untouched.

### MediaWiki Berserk Input — COMPLETED ✅
**Goal:** Add a manual Berserk input to the MediaWiki calculator. Berserk was engine-supported (`build.berserk`, workbook C53) but hardcoded to 0 in every UI — the only way to get "Total Berserk DPS" was the Minotaur race (+30%, E53). New "Berserk" section between Race and Armor Stats: whole-percent entry (30 = 30%), clamped to 150 at the time (borrowed the lethality cap as a placeholder — Berserk didn't have its own cap yet), transform divides by 100. Engine/formulas untouched — the input feeds the existing `build.berserk` + Minotaur path (C92). MediaWiki-only, same precedent as Abilities/Armor. *(The input max was later raised to 200 once Berserk got its own real cap — see "Armor Stat & Berserk Input Cap Increase" below.)*

| Change | Where | Status | Commit |
|--------|-------|--------|--------|
| **Berserk section** — "Berserk" input section (label, whole-percent subtext, number field `id="berserk"`, min 0 / max 150 (later 200) / step 1, inputmode numeric, debounced `input` + `change` clamp `[0,150]` (later `[0,200]`), non-numeric/empty → 0) | `forge-calculator.common.js` `createInputPanel` (reuses `.fc-stat-input-*` CSS) | ✅ Done | (this session) |
| **Build state** — `berserk: 0` in `DEFAULT_BUILD`; `setBuild` restores the input value | `forge-calculator.common.js` | ✅ Done | (this session) |
| **Transform** — `berserk: (Number(build.berserk) || 0) / 100` (whole-percent → decimal for the engine) | `forge-calculator.common.js` `transformBuildForEngine` | ✅ Done | (this session) |
| **Test** — `berserk-input-test.js`: renders the real input panel, checks attrs + clamp, /100 transform, C92 end-to-end (Minotaur+30% → 8.6·1.6/0.47, manual 30% → 8.6·1.3/0.47, 0+no Minotaur → null, total_dps unchanged), setBuild restore | `Web/mediawiki/berserk-input-test.js` | ✅ Done | (this session) |

**Verification:** `node Web/mediawiki/berserk-input-test.js` → ALL BERSERK-INPUT CHECKS PASSED; `verify-engine.js` / `fuzz_verify.js` / `ability-inputs-test.js` / `results-panel-test.js` / `ore-slot-test.js` / `bonus-derive-test.js` / `armor-stats-test.js` / `no-ore-weapon-test.js` all pass; `node --check` clean. Engine untouched.

### Web Engine Input Normalization (NaN/∞ TTK fix) — COMPLETED ✅
**Goal:** The web calculators showed **"∞" in Time taken** when any `abilities.*` or `armor_*` build field reached the engine as `undefined` — `Math.max(ore, undefined)` = NaN in JS → `fire_dps`/`poison_dps` → `total_dps` = NaN → `25000/NaN` = NaN → `fmtTime` renders any non-finite value as "∞". Fixed at the `calculate()` boundary so the engine is **total** for any input shape; valid builds are bit-for-bit unchanged (an absent input cell is 0 in the workbook, so missing → 0 is not an invented mechanic). **Out of scope (by design, left untouched):** slow weapons (`interval ≥ ~1.47s`, 10 of 79) legitimately show "Weapon DPS" below "Weapon Damage" — DPS = per-hit × (1+lethality) × crit_blend × attack_rate, and attack_rate < 1 for slow weapons. Crit chance never lowers DPS (blend is 1.0 at 0%, ≥1.45 at capped crit).

| Change | Standalone (`Web/js/`) | MediaWiki (`Web/mediawiki/`) | Status | Commit |
|--------|------------------------|------------------------------|--------|--------|
| **normalizeBuild()** — coerce every numeric build field to finite (missing/invalid → 0), `base_crit_dmg` defaults to workbook C21 = 1.45 (missing cell is the workbook base, not "no crits"), slots sanitized `{name, amount}`, called first in `calculate()` | `engine/normalize.js` (new) + call in `dps.js` | `forge-calculator.common.js` (ES5 `normalizeBuild`/`num`) + call in `calculate()` | ✅ Done | (this session) |
| **duration() micro-guard** — `?? 0` on race/ability time args so a stray `undefined` can never NaN the duration | `engine/procs.js` | (IIFE loop-based `duration` already NaN-safe) | ✅ Done | (this session) |
| **Transform hardening** — `Number(x) || 0` on ability, armor, quality, enhancement, and ore-amount fields | `main.js` | `forge-calculator.common.js` transform (pct fields → `(Number(x)||0)/100`) | ✅ Done | (this session) |
| **Regression tests** — partial build → finite `total_dps` + `ttk > 0`; missing == explicit zeros; `calculate({})`/`calculate({slots:[]})` finite; `base_crit_dmg` omitted → blend 1.45 at capped crit | `engine/normalize.test.mjs` (new) | golden check #11 in `verify-engine.js` | ✅ Done | (this session) |

**Verification:** `node Web/js/engine/normalize.test.mjs` → ALL NORMALIZE CHECKS PASSED; `node Web/mediawiki/verify-engine.js` → ALL GOLDEN CHECKS PASSED (11 checks); `node Web/mediawiki/fuzz_verify.js` → DIFFERENTIAL FUZZ PASSED (250 builds, 8755 fields, worst rel err 5.19e-16 — unchanged, proving `normalizeBuild` is a no-op for valid builds); `node --check` clean on all modified JS; `python -m pytest tests/` → 80 passed; `python scripts/smoke_gui.py` → SMOKE OK. Python engine unchanged (`Build`/`Abilities` dataclasses already default every numeric field to 0.0).

### MediaWiki Common.js → importScript Split — COMPLETED ✅
**Goal:** Move the calculator IIFE out of `MediaWiki:Common.js` into its own `MediaWiki:ForgeCalculator.js` page, imported via a single `importScript(...)` line in Common.js. Purely organisational — the imported script runs in the same global scope (shared `mw`, jQuery, hooks), so behaviour is identical. Safe because the IIFE is already self-contained (own `FC_CALCULATOR_LOADED` guard) and bootstraps with a `document.readyState === 'loading'` guard, so it initializes exactly once whether it loads before or after `DOMContentLoaded`.

| Change | Where | Status | Commit |
|--------|-------|--------|--------|
| **Module split** — full IIFE moved byte-identical to `MediaWiki-ForgeCalculator.js` (→ wiki page `MediaWiki:ForgeCalculator.js`); `forge-calculator.common.js` (→ `MediaWiki:Common.js`) reduced to a single `importScript('MediaWiki:ForgeCalculator.js');` line | `Web/mediawiki/MediaWiki-ForgeCalculator.js` (new), `Web/mediawiki/forge-calculator.common.js` | ✅ Done | (this session) |
| **Harness retarget** — 10 consumers (`verify-engine.js`, `fuzz_verify.js`, `zero_dps_repro.js`, all 7 `*-test.js`, `fuzz_gen.py` docstring) now read `MediaWiki-ForgeCalculator.js` | `Web/mediawiki/*.js` | ✅ Done | (this session) |
| **DEPLOY.md** — artifact map + new steps 4/5 (create `MediaWiki:ForgeCalculator.js`, append the import line to Common.js), maintenance + source-files notes | `Web/mediawiki/DEPLOY.md` | ✅ Done | (this session) |

**Verification:** `node Web/mediawiki/verify-engine.js` → ALL GOLDEN CHECKS PASSED; `node Web/mediawiki/fuzz_verify.js` → DIFFERENTIAL FUZZ PASSED (250 builds, 8755 fields, worst rel err 5.19e-16); all 7 `*-test.js` + `zero_dps_repro.js` PASSED; `node --check` clean on the new module and the stripped Common.js artifact. Engine byte-identical — display/organisation only.

### Explosion Chance SUM→MAX Fix — COMPLETED ✅
**Goal:** `C59` (explosion chance) in `reference/reall.xlsx` was `=SUM(slot1..slot4, D37)`, additively stacking every explosion-triggering ore's chance. The user identified this as a workbook design bug — every other chance stat (fire, poison, smite, lightning `C81`) takes a `MAX` across slots, with the ability term folded into the same `MAX` (confirmed against `C81`'s literal `MAX(slot1..slot4, D36)` pattern). Unlike the open `C64` issue (documented, not fixed), the user chose to correct the workbook itself so "ported verbatim from the source workbook" stays true, rather than carrying this as an engine-only deviation.

| Change | Where | Status | Commit |
|--------|-------|--------|--------|
| **Workbook formula edit** — `C59`'s outer `SUM(` → `MAX(` via direct XML patch inside the xlsx zip (not an openpyxl round-trip, which silently strips all cached formula values on save); cached `<v>` values untouched since the default build's result is identical either way (only one ore triggers explosion there) | `reference/reall.xlsx` | ✅ Done | (this session) |
| **Data rebuild** — `scripts/build_data.py` rerun; `data/ores.json` unchanged (ramp extraction doesn't depend on the outer aggregator keyword), only `data/meta.json`'s formula hash moved. Also restored an unrelated pre-existing working-tree deletion of `reference/new.xlsx` (needed for the ore atk_speed legacy merge) before rebuilding, so 4 ores didn't silently lose `atk_speed` | `data/*.json` | ✅ Done | (this session) |
| **Engine ports** — `explosion_chance` changed from `slot_sum(...) + blast_chance` to `max(slot_max(...), blast_chance)` in all three engines | `forge_calculator/engine.py`, `Web/mediawiki/MediaWiki-ForgeCalculator.js`, `Web/js/engine/procs.js` | ✅ Done | (this session) |
| **Test fix** — `reall-aggregates.js`'s 2-ore explosion-chance check asserted the old additive result (0.45); corrected to `Math.max` (0.25) | `Web/mediawiki/reall-aggregates.js` | ✅ Done | (this session) |
| **Fuzz regenerated** — `fuzz_gen.py` rerun so `fuzz-cases.json` stores results from the corrected Python engine | `Web/mediawiki/fuzz-cases.json` | ✅ Done | (this session) |
| **Docs** — domain-model aggregation bullet updated | `CLAUDE.md` | ✅ Done | (this session) |

**Verification:** `python -m pytest tests/` → 82 passed; `python scripts/audit_reall.py reference/reall.xlsx data/ores.json` → 0 ore-range problems; `node Web/mediawiki/reall-golden.js` / `reall-aggregates.js` / `python scripts/reall_parity.py` → all PARITY/AGGREGATES PASSED (explosion chance now shows `MAX` not `additive`); `node Web/mediawiki/verify-engine.js` → ALL GOLDEN CHECKS PASSED; `node Web/mediawiki/fuzz_verify.js` → DIFFERENTIAL FUZZ PASSED (250 builds, 9506 fields, worst rel err 2.75e-16); all 7 focused MediaWiki tests PASSED; `node Web/js/engine/reall-golden.test.mjs` / `normalize.test.mjs` PASSED; `python scripts/smoke_gui.py` → SMOKE OK. Single-ore golden tests (Gargantuan, default build) were unaffected since SUM and MAX agree when only one term is non-zero.

### Extended.xlsx Adoption — COMPLETED ✅
**Goal:** `reference/Extended.xlsx` arrived as a candidate successor to `reall.xlsx`. A
cell-by-cell diff (`Diff report.md`) found every formula change either fixed a sheet bug
the engines had already worked around, or was cosmetic sample data — see "Formerly-approved
deviations" above for the resolved list. The user then confirmed **`Extended.xlsx` is now
the authoritative workbook; `reall.xlsx`, `new.xlsx`, `Newchnages.xlsx`, `Newchnages2.xlsx`,
and `Version2.xlsx` are all outdated** (kept in `reference/` for git history only, read by
no script).

| Phase | Work | Status |
|-------|------|--------|
| 1 | **Build pipeline retarget** — `scripts/build_data.py`'s `DEFAULT_XLSX` → `Extended.xlsx`; `C48` (ore atk speed) folded into `STAT_CELLS` and parsed straight from the main workbook; `LEGACY_STAT_CELLS`/`LEGACY_WORKBOOK`/`_legacy_matrix` removed from `build_data/extract.py` and `build_data/formula_parser.py` entirely | ✅ Done |
| 2 | **Data rebuild** — `python -m scripts.build_data` rerun; counts unchanged (147/80/16/47/16, `_Weapon`/`_OptionsCrafter`/`_Options` are byte-identical to `reall.xlsx`); only `data/meta.json`'s workbook name/hash and `data/ores.json`'s source string changed. Copied to `Web/data/` and `Web/mediawiki/Data-*.json` | ✅ Done |
| 3 | **`scripts/audit_reall.py`** — added `C48` to its own `CELL_STATS` table (it had never read C48, from the reall.xlsx-era bare-input days) → **0 ore-range problems** against the rebuilt `data/ores.json` | ✅ Done |
| 4 | **Python engine parity** — `tests/test_golden.py`'s `WORKBOOK` → `Extended.xlsx`; `test_workbook_cached_golden` now reads the real `game` fixture (the old `_game_without_ore_atk_speed` strip-and-reload workaround is gone, since `C48` is live in the main workbook now); `rune_cells` extended to 9 cells (`C27:E29`); the `C101` max-burst assertion no longer needs the old "undo the bare-`+C80` bug" restatement, since `Extended.xlsx`'s `C101` is already correct. `tests/test_formula_parser.py`'s legacy-workbook merge removed (single-workbook parse now reproduces the full `EXPECTED` matrix, `C48` included). `scripts/reall_parity.py` rewritten to read the default build and every expected cell from the workbook's own cache dynamically (was hand-typed `EXPECTED` constants tied to the old sample build — a rebuild-breaking pattern the "zero invented mechanics" rule exists to avoid) | ✅ Done |
| 5 | **JS harness parity** — `Web/mediawiki/reall-golden.js` and `reall-aggregates.js` updated to the new default build (`Fierce Jade`/`Kitsunite`/`Galaxite`/`Supermassive Black Hole`, `Excalibur`, `Human`, 9-slot rune grid) and the workbook's own cached values (transcribed via the Python-side dump, not hand-derived); `fuzz_gen.py` rerun so `fuzz-cases.json` stores results from the migrated Python engine | ✅ Done |
| 6 | **Berserk cap (deviation #5)** — initially removed `CAPS.berserk` to match `Extended.xlsx`'s `C97` verbatim (uncapped, since `E54`'s `MIN(200%, …)` is a dead cell nothing reads). The user then judged the sheet's dead cap a spreadsheet bug and asked for the 200% cap to be enforced engine-side regardless, pending a manual fix to `C97` later — see "Approved deviation (current, live): berserk's 200% cap". Re-added `CAPS.berserk = 2.0` to both `forge_calculator/engine.py` and `MediaWiki-ForgeCalculator.js` (not the retired `Web/js/`), with regression tests that actually exercise the clamp (`test_berserk_caps_at_200_percent`, `reall-aggregates.js`'s 530%→200% check) | ✅ Done |
| 7 | **Docs** — `CLAUDE.md`: "Zero invented mechanics" repointed to `Extended.xlsx`; the five former deviations rewritten as resolved history; the `C64`/`C37` "still open" note removed (fixed at the source); Berserk/Gauntlet domain-model bullets updated; `Build.rune_cells` default widened to 9 cells and several stale cell-reference comments in `forge_calculator/engine.py`'s `Build` dataclass fixed in passing (`armor_crit_chance`/`armor_crit_dmg`/`armor_lethality`/`base_lethality`/`berserk`/`achievement` were citing the wrong row, off by one from what the passing tests actually used) | ✅ Done |

**Verification:** `python -m pytest tests/` → 83 passed (incl.
`test_berserk_caps_at_200_percent`); `python scripts/audit_reall.py
reference/Extended.xlsx data/ores.json` → 0 problems; `python scripts/reall_parity.py` →
PARITY PASSED (37 cells, dynamic); `node Web/mediawiki/reall-golden.js` → PARITY PASSED;
`node Web/mediawiki/reall-aggregates.js` → AGGREGATES MATCH (incl. the 530%→200% berserk
cap check); `node
Web/mediawiki/verify-engine.js` → ALL GOLDEN CHECKS PASSED; `node
Web/mediawiki/fuzz_verify.js` → DIFFERENTIAL FUZZ PASSED (250 builds, 9506 fields, worst
rel err 2.75e-16); all 7 focused MediaWiki tests PASSED; `node --check` clean on the
modified engine; `node Web/js/engine/reall-golden.test.mjs` / `normalize.test.mjs` PASSED
(untouched, still frozen against the old `reall.xlsx` sample per "MediaWiki only");
`python scripts/smoke_gui.py` → SMOKE OK.

### Berserk-Group Trait Text Parsed Into Real Ramps — COMPLETED ✅
**Goal:** The Active Traits card showed most ore stats (Lethality, Crit Chance, Fire DMG,
etc.) as real computed numbers via each stat's `{base, max, divisor}` ramp, but five ores'
"+X% Physical Damage and +X% Movement Speed for Y second(s) when HP drops below 35%"
trait — a real, formula-shaped ramp that the workbook just never gave its own DPS
Calculator cell — fell back to showing the raw 10%-share sentence with an approximate
`[Z% power]` prefix, the same generic fallback used for traits with no numeric backing at
all (Vitality, Swiftness, Health Regen, damage-reduction chance, etc.). The two cases look
identical in the UI but aren't: the berserk-clause numbers in every ore's `trait10`/`trait30`
text scale by exactly ×10 between the two breakpoints, the same base→max pattern every
formula-backed stat uses — verified across all 147 ores before writing anything. The
`[Z% power]` fallback stays exactly as before for everything else (Vitality and friends),
per the user's explicit request — this was scoped to the traits that already had a
recognized slot in `TRAIT_STAT_DISPLAY` (`phys_dmg`/`move_speed`/`berserk_duration`, group
`'berserk'`), not a general free-text-number parser.

| Change | Where | Status |
|--------|-------|--------|
| **`BERSERK_TRAIT_RE` + `extract_berserk_trait_stats`** — regex pulls the two percentages and the duration out of `trait10`/`trait30` verbatim (`"+X% Physical Damage and +Y% Movement Speed for Z second(s) when HP drops below 35%"`); only fires when the phrase is found in BOTH breakpoints, so a partial match never produces a fabricated ramp | `build_data/extract.py` | ✅ Done |
| **Wired into `extract()`** — merged into each ore's `stats` dict via `setdefault`, same pattern as the old `new.xlsx` legacy merge, so it can never shadow a real formula-cell stat | `build_data/extract.py` | ✅ Done |
| **Data rebuilt** — exactly the 5 ores with this trait (Sealed Curse, Yin, Kokorite, Yin-Yang, Fierce Jade) gained `phys_dmg`/`move_speed`/`berserk_duration` entries; every other ore/count unchanged. Copied to `Web/mediawiki/Data-Ores.json` and `Web/data/` | `data/ores.json` + copies | ✅ Done |
| **No MediaWiki JS engine change needed** — `activeTraits`'s `merged`/`formatTraitGroup('berserk', ...)`/`isTraitClaimed` machinery already handled any `ore.stats` key with a `TRAIT_STAT_DISPLAY` entry generically; it was only ever the *data* that was missing these three keys | `MediaWiki-ForgeCalculator.js` | ✅ Done (no-op) |
| **`scripts/audit_reall.py`** — independently re-derives `phys_dmg`/`move_speed`/`berserk_duration` straight from `_OptionsCrafter`'s own trait columns (its own copy of the regex, not imported from `build_data`, so it's a genuine cross-check) and diffs against the shipped JSON | `scripts/audit_reall.py` | ✅ Done |
| **Python reference engine untouched** — its own `active_traits()` always prints the raw `trait10`/`trait30` sentence verbatim regardless of stat keys (a structurally different, simpler renderer, already documented as allowed to diverge from MediaWiki's); unaffected by the new `ore.stats` keys since it never reads them for trait display | `forge_calculator/engine.py` | ✅ Done (no-op, confirmed) |
| **Tests** — `tests/test_data.py::test_berserk_group_traits_parsed_from_trait_text` (exact ore set + exact base/max/divisor for all 5, plus a negative check that an unrelated ore gets nothing invented); `Web/mediawiki/berserk-trait-test.js` (exact base text at 10% share with no `[X% power]` prefix, the ramped value at 20% share matches `scaleRange`'s formula bit-for-bit, exact max text at 30%/100% share, an ore without the trait shows nothing, and `berserkLevel`/`C97` numeric DPS is provably untouched by the trait) | `tests/test_data.py`, `Web/mediawiki/berserk-trait-test.js` | ✅ Done |

**Verification:** `python -m pytest tests/` → 84 passed; `python scripts/audit_reall.py
reference/Extended.xlsx data/ores.json` → 0 problems (independent cross-check, not just the
same code re-run); `python scripts/reall_parity.py` / `node reall-golden.js` / `node
reall-aggregates.js` / `node verify-engine.js` → all still PASSED (numeric DPS untouched, as
expected — this is a display-only change); `node Web/mediawiki/fuzz_verify.js` → DIFFERENTIAL
FUZZ PASSED (250 builds, 9506 fields, worst rel err 2.75e-16 — proves the new ore stat keys
don't leak into any numeric field either engine computes); `node berserk-trait-test.js` →
ALL BERSERK-TRAIT CHECKS PASSED (10/10); all other 7 focused MediaWiki tests still pass;
`python scripts/smoke_gui.py` → SMOKE OK.

### Generic Trait-Clause Ramp + Stats Card Berserk Row + Cap Color — COMPLETED ✅
**Goal:** Three related MediaWiki-only UI requests. (1) Vitality/Swiftness/Endurance/Stamina
and plain (non-berserk-clause) Movement Speed still showed the `[X% power]` approximation
below 30% share, same as any other unrecognized free text — but unlike genuinely compound
traits, these are always a single clean `"+X% Label"` clause that scales the same
base-at-10%→max-at-30% way as every formula-backed stat. Rather than extending the
Python-build-time/`TRAIT_STAT_DISPLAY` approach per named stat (an ever-growing allowlist),
this is solved generically at display time: pair each `trait10` clause with its same-position
`trait30` clause and, if both are a clean single-number percentage with an identical label,
compute the real value. (2) The Stats (Capped) card gained a fifth row showing total Berserk
level as a percentage, since Berserk has had a real 200% cap since the last session. (3) The
cap-exceeded highlight was changed from a light pink to a true red — this took **two**
attempts: the first (setting `valueEl.style.color` inline) looked right in isolation but
never actually took effect in the real UI, because every `.fc-sv-*` value color in
`Template-ForgeCalculator-styles.css` (`.fc-sv-pct` included) is declared `!important`, and
`!important` beats an inline style unconditionally. The real fix moves the cap indicator to
a CSS class (`.fc-is-capped`) with both `!important` *and* higher selector specificity than
`.fc-sv-pct`, so it wins the cascade regardless of source order.

| Change | Where | Status |
|--------|-------|--------|
| **`splitTraitClauses`/`parsePercentClause`/generic pairing in `activeTraits`** — below 30% share, each unclaimed clause tries to pair against its same-index `trait30` counterpart; on a clean match (`"+X% Label"` on both sides, identical label after the number) computes `scaleRange({base, max, divisor:100}, share)` instead of the old power estimate. Anything that doesn't cleanly pair (compound/multi-number text, mismatched label, missing counterpart) falls through to the unchanged `[X% power]` fallback — verified across the whole 147-ore catalog before writing anything (0 clause-count mismatches; every "label mismatch" found was already claimed by a known stat or a genuine multi-number clause) | `MediaWiki-ForgeCalculator.js` | ✅ Done |
| **`berserk_level` exposed on the `calculate()` result** — the raw capped fraction (e.g. `2.0` for 200%), separate from `berserk` (the DPS value); `0` when no source is active (unlike `berserk`, which is `null`) | `MediaWiki-ForgeCalculator.js` | ✅ Done |
| **Stats (Capped) card: 5th row "Berserk"** — `pctFmt(result.berserk_level)`, red when `>= CAPS.berserk`; the other four rows' cap checks switched from hardcoded `1.5`/`1.0`/`1.0`/`1.5` literals to `CAPS.lethality`/`CAPS.crit_chance`/`CAPS.crit_dmg`/`CAPS.atk_speed` in the same pass | `MediaWiki-ForgeCalculator.js` (`createResultsPanel`) | ✅ Done |
| **Clipboard export** — `formatResultsForClipboard`'s Stats (Capped) section gained a matching `Berserk: X% (CAPPED)` line, same `CAPS.*` cleanup | `MediaWiki-ForgeCalculator.js` | ✅ Done |
| **Cap color, take 1 (insufficient)** — `CAP_COLOR = '#cc0000'` constant, `createStatRow`/`updateStatRow` set `valueEl.style.color`. Silently overridden in the browser by `.fc-sv-pct { color: #ce93d8 !important; }` — user reported the value was still pink | `MediaWiki-ForgeCalculator.js` | ⚠️ Shipped, then reverted |
| **Cap color, take 2 (actual fix)** — `CAP_CLASS = 'fc-is-capped'`; both functions now `classList.add`/`classList.toggle` the class instead of touching `style.color`. New stylesheet rule `.fc-stat-row .fc-stat-val.fc-is-capped { color: #cc0000 !important; }` — three classes beat `.fc-sv-pct`'s two, so it wins the cascade no matter where either rule sits in the file | `MediaWiki-ForgeCalculator.js`, `Template-ForgeCalculator-styles.css` | ✅ Done |
| **`berserk-trait-test.js` updated** — its Sealed Curse check had asserted Vitality/Stamina/plain-Movement-Speed *still* show `[X% power]`; that's no longer true now that the generic parser handles them, so the check was corrected to assert the opposite (no `% power]` left at all for that ore) | `Web/mediawiki/berserk-trait-test.js` | ✅ Done |
| **New `generic-trait-ramp-test.js`** — Swiftness/Vitality ramped-value checks against `scaleRange`'s own formula (both mid-ramp and exact-10%-share), Sealed Curse's standalone Movement Speed clause (distinct from its berserk clause) computed correctly, Endurance at full share, a genuinely unparseable compound clause (Prismatic Heart's "Freeze enemies...") still falls back to `[X% power]`, an ore with only claimed stats has no stray extras, the Stats-card/`berserk_level` checks, and — added for the take-2 fix — no inline `style.color` remains, `CAP_CLASS` is toggled via `classList`, the stylesheet defines `.fc-is-capped` as `#cc0000 !important`, and a specificity check (counts classes per comma-separated selector branch, not summed across the list — the first version of this check was itself wrong for that reason and had to be fixed) confirms `.fc-is-capped` outranks `.fc-sv-pct` | `Web/mediawiki/generic-trait-ramp-test.js` | ✅ Done |

**Verification:** `python -m pytest tests/` → 84 passed (unaffected — this is MediaWiki-JS-only);
`node Web/mediawiki/reall-golden.js` / `reall-aggregates.js` / `verify-engine.js` → all still
PASSED; `node Web/mediawiki/fuzz_verify.js` → DIFFERENTIAL FUZZ PASSED (250 builds, 9506
fields, worst rel err 2.75e-16 — `berserk_level`/trait text are outside the numeric parity
contract, confirmed unchanged); `node berserk-trait-test.js` / `generic-trait-ramp-test.js` →
both ALL CHECKS PASSED; all other 7 focused MediaWiki tests still pass; `node --check` clean;
`python scripts/smoke_gui.py` → SMOKE OK. A full-catalog scan (every weapon-eligible ore at
15% share) confirmed the `[X% power]` fallback still fires for genuinely compound text
(Prismatic Heart, Snowite, Iceite, Golem Heart) and nowhere else.

### Armor Stat & Berserk Input Cap Increase — COMPLETED ✅
**Goal:** By request — raise two input ceilings that were narrower than their real stat cap.
Armor Crit Damage's input maxed out at 100 even though `CAPS.crit_dmg` allows up to 150 total
(armor is just one of several sources feeding that stat, same as Lethality, whose input
already correctly maxed at 150). The Berserk input maxed out at 150 — a placeholder borrowed
from the Lethality cap when the field was first added, before Berserk had its own real cap;
now that it does (`CAPS.berserk = 2.0`, see "Approved deviation (current, live): berserk's
200% cap" above), the input should match it. Armor Lethality (already 150) and Armor Crit
Chance (100 — its real cap, `CAPS.crit_chance`, unchanged) were left as they were.

| Change | Where | Status |
|--------|-------|--------|
| **Armor Crit Damage: 100 → 150** — `createStatInput`'s `fields` array, `armorCritDmg` entry's `max` | `MediaWiki-ForgeCalculator.js` | ✅ Done |
| **Berserk input: 150 → 200** — both the `<input max>` attribute and `commitBerserk`'s `Math.min(..., 150)` clamp | `MediaWiki-ForgeCalculator.js` | ✅ Done |
| **Tests updated** — `armor-stats-test.js`: `max` attribute assertion 100→150, added a clamp-at-boundary check (200 → clamped to 150, mirroring the existing Lethality one); `berserk-input-test.js`: `max` attribute assertion 150→200 (and its stale "(lethality cap)" comment corrected to "(berserk cap)"), the clamp-boundary check moved from "200 → clamped to 150" to "250 → clamped to 200" | `Web/mediawiki/armor-stats-test.js`, `Web/mediawiki/berserk-input-test.js` | ✅ Done |

**Verification:** `python -m pytest tests/` → 84 passed (unaffected — MediaWiki-JS-only);
`node --check` clean; `node armor-stats-test.js` / `berserk-input-test.js` → both ALL CHECKS
PASSED; all other 7 focused MediaWiki tests still pass; `node Web/mediawiki/fuzz_verify.js` →
DIFFERENTIAL FUZZ PASSED (250 builds, 9506 fields — these are just input-box ceilings, the
underlying `calculate()` math and its caps are untouched); `python scripts/smoke_gui.py` →
SMOKE OK.


### UpdatedSpreadsheet.xlsx Adoption + Four New Races — COMPLETED ✅
**Goal:** `reference/UpdatedSpreadsheet.xlsx` replaces `Extended.xlsx` as the authoritative
workbook (all older workbooks deleted from `reference/`). It adds four races — **Fairy**,
**Orc Lord**, **Dryad**, **Kitsune** — three new race proc rows (Smash 83–85, Fox Claws
87–89, Foxfire 91–94), moves achievements to `C98` and the results block to rows 102–116,
caps explosion/smite damage at 250%, and makes Total Berserk DPS (`C112`) read `E54`
(resolving the berserk-cap deviation at the source). The race bonuses the sheet appends to
`C45`/`C48` duplicate some existing `E45`/`E48` terms (Orc, Dragonborn lethality;
Goblin+Dagger attack speed); **by the user's decision those double counts are not ported**
— each race bonus is counted once — until the sheet is fixed.

| Phase | Work | Status |
|-------|------|--------|
| 1 | **Workbook swap** — rename to `UpdatedSpreadsheet.xlsx`, delete old workbooks, retarget build/test/parity paths; extractor reads achievements from `C98`, races from `B1:B20`/`E2:AA21`, weapon types from `F12`'s `FILTER` literal (the saved build is empty, so its cache is useless); data rebuilt (20 races, `Spear` in `C23`); results-cell addresses in tests moved to rows 102–116 | ✅ Done |
| 2 | **Engines** — new race stat bonuses (Fairy+Spear, Orc Lord, Kitsune lethality; Fairy+Spear, Shadow+heavy, Elf, Kitsune attack speed; no double counts); `MIN(2.5, …)` caps on explosion (per slot) and smite damage; Smash / Fox Claws / Foxfire DPS rows; totals, berserk, Moon Stone and Max Burst updated — Python + MediaWiki; saved-build parity (`reall_parity.py`, `reall-golden.js`, `test_workbook_cached_golden`) retargeted to the workbook's saved Kitsune build incl. the new proc cells; fuzz now also draws weapon types from `C12` and compares the new fields | ✅ Done |
| 3 | **MediaWiki UI** — DPS Breakdown (now 13 rows: Smash / Fox Claws / Foxfire after Lightning, with `fc-sv-smash`/`-foxclaws`/`-foxfire` colours) + clipboard rows; `results-panel-test.js` updated | ✅ Done |
| 4 | **Tests** — `tests/test_races.py` (22 cases) + `Web/mediawiki/new-races-test.js`: every new race bonus, Smash/Fox Claws/Foxfire maths, no double counts, Dryad inert; `test_engine_constants_match_source` guards every new constant and the 2.5 caps; fuzz regenerated | ✅ Done |
| 5 | **Docs** — CLAUDE.md workbook pointer, double-count deviation, berserk deviation marked resolved, results-block/race-proc/achievement cell addresses, Gauntlet spelling quirk, commands | ✅ Done |

**Verification:** `pytest tests/` → 106 passed; `audit_reall.py` → 0 ore-range problems;
`reall_parity.py` / `reall-golden.js` → PARITY PASSED against the workbook's saved Kitsune
build (incl. Foxfire 134.66 of Total 915.27); `reall-aggregates.js` → AGGREGATES MATCH;
`verify-engine.js` → ALL GOLDEN CHECKS PASSED; `fuzz_verify.js` → DIFFERENTIAL FUZZ PASSED
(250 builds, 12,005 fields); all focused MediaWiki tests incl. `new-races-test.js` PASSED.

**Follow-up — sheet's double counts fixed by the user:** the corrected workbook replaced
`reference/UpdatedSpreadsheet.xlsx` (only `C45`/`C48`/`E45`/`E48` changed). Engines gained
Minotaur +30% lethality and Demon + Straight Sword +10%; the double-count deviation section
became historical; `C45`/`C48` race-term guards moved to `E45`/`E48`; the two Minotaur goldens
(`test_minotaur_berserk`, `verify-engine.js`, `berserk-input-test.js`) rescaled by the new
lethality (×1.45/1.15 and ×1.3, verified by hand). `pytest` → 108 passed; all parity, fuzz
and focused MediaWiki tests PASSED.

### October 2026 Workbook Adoption (Bismuth, Pumpkinite, Halberd) — COMPLETED ✅
**Goal:** the user's "LittleTimmy's Calculator MAIN COPY (UP TO DATE)" replaced
`reference/UpdatedSpreadsheet.xlsx` (same file name kept; older copy deleted). Every formula
change was ported verbatim to both engines.

| Phase | Work | Status |
|-------|------|--------|
| 1 | **Data + Python** — extractor ranges moved (`_Weapon` 2..88, `_OptionsCrafter` 61..209); parser restricted to slot tests `C6`–`C9` and taught flat literals (`C6="Bismuth", 8.75/100`) and `COUNTIF(...,"Bismuth"), 1.5`; data rebuilt (149 ores, 87 weapons, 11 weapon types); engine: Bismuth/Fichilliumorite solo ore power, Bismuth excluded from `E10`, Bismuth poison time priority, Galaxite+Bismuth +125% black hole, DoT `E64`/`E69` fallback, flat Fox Claws ÷3, linear Archangel smite, Kitsune +15% crit dmg, Minotaur lethality / Elf attack speed removed; `audit_reall.py` reads flat values; `tests/test_bismuth.py` | ✅ Done |
| 2 | **MediaWiki** — same engine changes in `MediaWiki-ForgeCalculator.js`, `EXPECTED_COUNTS` 149/87/20; fuzz regenerated; `reall-golden.js` retargeted to the workbook's (empty) saved build; `bismuth-test.js` | ✅ Done |
| 3 | **Docs** — this file | ✅ Done |
| 4 | **Re-upload fixes** — Tiger's Eye `C48` re-checked (C8 branch still misspelled, patched in the reference copy); weapon-type ore thresholds from `F12` extracted and enforced in the MediaWiki dropdowns + warning; `no-ore-weapon-test.js` updated for the rule | ✅ Done |

**Verification:** `pytest tests/` → 125 passed; `audit_reall.py` → 0 ore-range problems (1
FORMULA-ONLY note: `Tiger s Eye`); `reall_parity.py` / `reall-golden.js` / `reall-aggregates.js`
→ PASSED; `verify-engine.js` → ALL GOLDEN CHECKS PASSED; `fuzz_verify.js` → DIFFERENTIAL FUZZ
PASSED (250 builds, 12,003 fields); all focused MediaWiki tests incl. `bismuth-test.js` PASSED.


### Game (.rbxlx) Alignment of the Workbook — COMPLETED ✅
**Goal:** `Copy of LittleTimmy's Calculator MAIN COPY (UP TO DATE) (4).xlsx` replaces
`reference/UpdatedSpreadsheet.xlsx` (same file name kept), then the workbook is edited to match
the game's own code as extracted from the `.rbxlx` (see `Forge_Game_vs_Calculator_Report.docx`),
and the calculator follows it verbatim. Decisions confirmed by the user: everything in the report
except Candy Ore / North Star (not added) and Asura's Incarnate (stays 75,000 HP, two phases).
Bismuth = Prismatic Shift expected value (¼ × each full T3 rune, own row, ≥10% share); cooldown
procs (lightning, Smash, black hole 1 s) use `1/(cd + 1/(chance × hits/s))`; fire/poison DoT use
game durations (fire 1–5 s, poison 1–15 s, default 1 s, no −1/−2 offsets); every integer-rolled
proc chance is game-exact `(FLOOR(chance%)+1)/101`; Archangel smite is its own beam row; berserk
is additive with lethality; Fox Claws `0.75 × A18 × MIN(0.25 × hits/s, 3/2.22)`; caps apply to the
item/race-trait pool and Kitsune Trickery / Fae's Reach add after; moon capped 150%; Demon Cursed
Aura row; Orc Lord (HP missing %, kill stacks) and Dryad (in grove, max HP) inputs near Berserk;
one achievement dropdown kept; game spellings for renamed ores/weapons; Berserker text removed
from armor-only ores; Bismuth and Aetherit text updated. Edited cells lose their cached values
until the user re-saves the workbook through Google Sheets.

| Phase | Work | Status |
|-------|------|--------|
| 1 | **Workbook swap** — new file in `reference/`, `C48` ore-name typos fixed (`FierceJade`, `Tiger'sEye`, `YetiHeart`), data rebuilt (unchanged), `reall-golden.js` retargeted to the new saved build (Snowite 12 / Kitsunite 15 / Moon Stone 15 / Bismuth 15, Colossal Terrorblade, Human): 46 cells PARITY PASSED | ✅ |
| 2 | **Sheet data** — Aite 1.1x, Arcane Crystal 9x; ore renames Evil Eye / Lgarite / Aurelia-no-Ki / Heart Of The Island and weapon renames Shark's Fangs / Boxing Gloves / Dark Knight's Gauntlets / Ornate Short Axe / Washi-maru / Dark Knight's Greatsword (shared strings only, no formula referenced them); 10 weapon damage / interval fixes (`_Weapon` F ratios re-cached); Berserker clause dropped from Sealed Curse / Yin / Kokorite text; Aetherit → Weapons with attack-speed text; Bismuth text rewritten to the game; `Crit Chance +5%` rune removed (46 runes); `F12` thresholds 3/4/6/6/8/8/11/11/15/15/19. Data rebuilt, tests updated | ✅ |
| 3 | **Sheet formulas** — 45 cells rewritten by a generator (XML patch, Google spelling kept): Bismuth out of every proc cell, flat gated 18% AS; Aetherit AS ramp; burn chances; Kitsunite/Marblite flat cooldowns; Kitsunite smite gated ramp; explosion total cap; DoT/cooldown/black-hole/Fox Claws/Foxfire game formulas; game-exact chance rounding; caps order; moon cap; additive berserk; Prismatic Shift (`E109`), Archangel beam (`C110`), Cursed Aura (`E110`); inputs `C49`/`E49` (Dryad) and `C55`/`E55` (Orc Lord), spacer merges B49/B55/B110 removed. Caches filled from an Excel recalculation of an `_xlfn.`-prefixed copy | ✅ |
| 4 | **Data rebuild** — parser and `audit_reall.py` read the gated flat `IF(share<0.1,miss,value)` form and the plain per-slot `C69`; rebuilt stats differ only where intended (Aetherit AS, 3 burn chances, Kitsunite/Marblite flat cooldown, Kitsunite smite 5→50 gated, Bismuth flat 18% AS and no proc stats); audit 0 problems | ✅ |
| 5 | **Python engine + tests** — `engine.py` rewritten to the new cells (new `Build` fields `dryad_in_grove`, `dryad_max_hp`, `orc_lord_hp_missing`, `orc_lord_kill_stacks`; new results `prismatic_shift_dps`, `archangel_smite_dps`, `cursed_aura_dps`, `lightning_cooldown`, `trait_damage_multiplier`, `berserk_level`). New `scripts/excel_fuzz.py` + `scripts/excel_batch.ps1`: 80 random builds pushed through Excel (the workbook itself) match the engine on all 43 cells. `pytest` → 129 passed | ✅ |
| 6 | **MediaWiki engine + UI + tests + fuzz** — JS engine mirrors the Python one; UI gains a "Race Situational" section (Orc Lord HP missing % / kill stacks, Dryad grove checkbox / max HP; shown only for that race) and DPS rows Prismatic Shift / Archangel Smite / Cursed Aura (+ clipboard, `fc-sv-prismatic` / `fc-sv-aura` colours). `fuzz_gen.py` covers the new inputs and fields: 250 builds, 13,426 fields, JS ≡ Python; every focused test updated and passing | ✅ |
| 7 | **Docs** — CLAUDE.md race table, domain model, quirks and commands rewritten for the game-aligned workbook | ✅ |
| 8 | **Partial rollback (user request)** — report section 1.3 back to the sheet's own values (burn chance Fireite/Gargantuan 20%, Kyubite 45%; Kitsunite smite ungated + clamped; Kitsunite/Marblite cooldown ramps; Bismuth attack speed ramp) and section 1.4 Bismuth back to the ÷8 T3-rune procs (now gated flats in the proc cells); Prismatic Shift row, engine code and UI row removed. Built from the committed workbook — the working copy had been re-saved in desktop Excel (`_xludf.IFS`, `#NAME?`, `C49 = Yes`) and was discarded. Excel 80-build parity re-run | ✅ |

### Golemite Workbook Adoption (November 2026) — COMPLETED ✅
**Goal:** `Copy of LittleTimmy's Calculator MAIN COPY (UP TO DATE) (5).xlsx` replaces
`reference/UpdatedSpreadsheet.xlsx` (same file name kept). It inserts a **Golemite Stats** block
(rows 39–64) that pushes every cell below row 38 down (rows 39–49 +27, 50–55 +28, 56–110 +29,
111–116 +30: lethality `E72`, crit `E73`/`E74`, attack speed `E75`, achievement `C127`, results
`C131`–`C146`). Two Golemites each carry a level (`E54`/`E55`) and sub-stats (`C41`–`D64`) that
feed the existing stat and proc cells; Golemite DPS (`E62` → `E138`) is added to Total, Berserk
and Moon Stone DPS. Also: two new Halberds and several weapon damage/interval changes in
`_Weapon` (`C2:E90`); black hole (`C105`) rewritten as `SUMPRODUCT`, its Resonance and chance
gates now test whether Galaxite / Bismuth are slotted at all. User decisions: explosion chance
`C88` uses the Golemite **Blast** chances `D47`/`D48` (the sheet's `C49`/`C50` is a typo);
Golemite smite damage and moon boost stay outside the 250% / 150% caps as in the sheet. Lightning cooldown `E109` is ported verbatim: its "no cooldown source → 10 s" test ignores the Golemite cooldowns, so a Golemite cooldown only counts next to an ore or rune cooldown.

| Phase | Work | Status |
|-------|------|--------|
| 1 | **Workbook swap + data** — cell addresses moved in extractor, parser, audit, parity and tests; parser and audit read the `SUMPRODUCT` black-hole ramp; data rebuilt (89 weapons) | ✅ |
| 2 | **Python engine + tests** — Golemite build inputs, stat/proc wiring, Golemite DPS, black-hole gates; parity + goldens; Excel fuzz (230 builds incl. Golemites) EXCEL PARITY PASSED | ✅ |
| 3 | **MediaWiki engine + UI + tests + fuzz** — same engine changes in JS, tabbed Golemite input section (level + grouped sub-stats, whole percents), Golemite DPS row + clipboard line, `golemite-ui-test.js`; fuzz 250 builds / 13,537 fields JS ≡ Python; previewed in Chromium on the live wiki skin (desktop / tablet / mobile) with local code swapped in, rune Abilities overflow fixed | ✅ |
| 4 | **Deploy + docs** — `deploy_wiki.py --apply`: Data:Ores / Weapons / Achievements, styles.css, ForgeCalculator.js (revs 17134–17138); live page checked in Chromium, Golemite DPS shows, no console errors; CLAUDE.md domain model, deviation, UI invariant and commands updated | ✅ |

### Wiki-Style Calculator Remodel — COMPLETED ✅ (merged and deployed; old UI kept as `old-ui`)
**Goal:** restyle and restructure the MediaWiki calculator to match the wiki's own article pages
(Home, Guide, Weapons, Items, Ores, Golemite), surveyed in Chromium. Kept on its own branch for the
user to review; not deployed. Engine and data untouched.

| Phase | Work | Status |
|-------|------|--------|
| 1 | **Survey** — wiki uses `Template:Article Header`: hero with Cinzel/Lora serif title, `#cccccc` description, stats strip, art on the right behind a fade; "◆ TITLE ◆———◆" section headers in `#FFB74D`; underline tabs (`#999` → white, 2px gold bar); `#0a0a0a` page, `#111212` cards, `#4d4d4d` borders, 8–14px radius; gold `#F9B65B` primary buttons, `#333` secondary | ✅ |
| 2 | **Structure** — `createHero` (badge, title, description, live Total DPS / Golem / Asura strip, `Gradient Weapons.webp` art), `sectionHeader` (dot + title + line), `createTabber` (Weapon & Ores / Race & Bonuses / Runes & Armor / Abilities / Golemites), `createActionBar` (sticky Reset / Calculate DPS under the tabs); results become a full-width "Results" section with a three-column card grid | ✅ |
| 3 | **Stylesheet rewrite** — `Template-ForgeCalculator-styles.css` rewritten from scratch on the wiki palette with the same class names; responsive at 1000 / 720 / 440px; previewed on the live wiki skin (desktop, tablet, mobile) with local JS/CSS swapped in; all MediaWiki tests pass | ✅ |
| 4 | **Wiki preview** — branch build uploaded as a separate preview, live calculator untouched: `User:HeroDev/Calculator preview` (root `fc-preview-root`), `Template:ForgeCalculator/Preview/styles.css`, `User:HeroDev/ForgeCalculatorPreview.js` (guard `FC_CALCULATOR_PREVIEW_LOADED`), loaded by one line in `User:HeroDev/common.js`, so only that account sees it. TemplateStyles rejects `:focus-visible`; the sheet uses `:focus` | ✅ |
| 5 | **Focus, sizes, fonts** — no focus outline / shadow / box on tabs, input borders never change colour; text ~12% bigger and taller controls; only the wiki's two font stacks (`"Segoe UI", ui-sans-serif, system-ui, -apple-system, sans-serif` everywhere, `Cinzel, "Palatino Linotype", Palatino, Georgia, serif` for the hero title only) | ✅ |
| 6 | **Old UI saved + merge + deploy** — branch `old-ui` / tag `old-ui-2026-11-06`, "switch to old UI" rule added above; branch merged into `main` and deployed live | ✅ |

### Golemites Forged From Ores — COMPLETED ✅
**Goal:** replace the Golemite tab's 21 manual sub-stat boxes with the same 4 ore slots the
weapon uses. Rule given by the user (not in the workbook, so it is a UI derivation feeding the
existing Golemite sub-stat cells; the engines are unchanged): a Golemite's ore traits are worked
out exactly like a weapon's (per-slot share ramp 10% → 30%, same gates and caps), then every
damage / chance / stat trait is multiplied by the ore-trait scaling of the Golemite's rarity. The
rarity is the highest rarity among the ores used. Scaling: Common 0.06, Uncommon 0.08, Rare 0.12,
Epic 0.15, Legendary 0.18, Mythic 0.23, Relic 0.25, Exotic 0.28, Divine 0.30 (mining damage is
ignored — the calculator has no mining). Durations and the lightning cooldown are not scaled.
Ore rarities come from the wiki's `Module:Ore/Data`. Manual sub-stat entry is removed; the tab
shows a read-only summary of the rarity, scaling and resulting stats.

| Phase | Work | Status |
|-------|------|--------|
| 1 | **Rarity data** — `scripts/fetch_ore_rarity.py` reads `Module:Ore/Data` into `data/ore_rarity.json` / `Web/mediawiki/Data-OreRarity.json` (`Data:OreRarity.json`); loader and `deploy_wiki.py` ship it. All 149 ores matched | ✅ |
| 2 | **Derivation** — `deriveGolemiteStats(slots, game)` in the engine half of the IIFE (survives a UI swap) | ✅ |
| 3 | **UI** — Golemite panes get Level + 4 ore slots + summary; build state `{level, slots}`; `transformBuildForEngine` derives the sub-stats; old sub-stat CSS removed | ✅ |
| 4 | **Tests** — `golemite-ui-test.js` rewritten (rarity, scaling, weapon rules, UI, end to end); every MediaWiki test, parity harness, `fuzz_verify.js` and `pytest` green | ✅ |
| 5 | **Deploy + docs** — `deploy_wiki.py --apply`: styles.css rev 17424, ForgeCalculator.js rev 17425; Data:OreRarity.json already live | ✅ |

### Tower of Hell Ores + Fallen Angel / Imp Workbook Adoption (November 2026) — IN PROGRESS
**Goal:** `Copy of LittleTimmy's Calculator MAIN COPY (UP TO DATE) (5).xlsx` (Nov 7) replaces
`reference/UpdatedSpreadsheet.xlsx`. It adds races **Fallen Angel** (20% lethality, 10% attack speed,
30% berserk, Dark Smite 35% at 30% chance, rows 125–127) and **Imp** (Trident Toss 120%, 8 s, Spear
only, rows 129–131), weapons Moon Crescent Spear / Royal Guardian's Glaive / Sharktooth Odachi rows
(`_Weapon` to row 93), ores Royal Boneite, Echotite, Frost Core, Tetrinite, Bizzarite, Frost Star
(`_OptionsCrafter` to row 215, no trait formulas yet), and moves achievements to `C135` and the
results block to rows 139–155. The four weapon ores' traits are missing from the sheet; they are
added to the workbook first (XML patch, Google spelling) and then ported verbatim.

User decisions:
- New ore traits ramp like other ores: the wiki number is the 30%-share value and 10% share gives a
  tenth of it; chances, cooldowns and durations are gated flats.
- Sheet bugs fixed in the sheet: Dark Smite (`C148`) and Trident Toss (`E148`) join Total / Berserk /
  Moon Stone; Imp's "Physical Damage +25% / Attack Speed +20% (Spears Only)" go to `E72` / `E75`
  pools, and the fire terms the sheet put in `C91`–`C93` for Imp are removed.
- Echotite Explosion 40% / 50%, Tetrinite Poison 75% / 40% / 6 s and Lightning 50% / 70% / 4 s join
  the existing explosion, poison and lightning cells; Frost Core Lethality 15% and Crit Damage 10%
  join `C72` / `C74`; Frost Star Polar Shift gives ¼ of 10% to attack speed, lethality and crit dmg.
- New rows (below the results block, all on unforged `A18`, game-exact chance rounding):
  Reverberation = physical hit × chance (8%; Dagger 20%, Straight Sword 16%, Gauntlet 12%);
  Frost Slash 25% at 30%; Glacier Explosion 65% at 50% × crit chance; Starfall 125% (225% with any
  Galaxite) at 20% with a 10 s cooldown; Stellar Mark 150% every 5th hit; Ancient Poison = poison
  DPS × 50% × mark uptime (50% chance, 5 s). Snow, Fracture, Echoes of Decay and slows add no DPS.
- Every new proc also joins Max Burst on forged `C18`.

| Phase | Work | Status |
|-------|------|--------|
| 1 | **Workbook** — new file in `reference/`; Imp fire terms dropped from `C91`–`C93`, Imp +25% / +20% added to `E72` / `E75`; new ore branches in `C72`, `C74`, `C75`, `C87`, `C88`, `C96`–`C98`, `C109`, `C110`, `E109`; new block rows 161–179 (Reverberation `E162`, Frost Slash `E164`, Glacier Explosion `E167`, Starfall `E170` / cooldown `E172`, Stellar Mark `E174`, Ancient Poison `E177`); `C148`, `E148` and the new rows join `C150`–`C152`, new procs join `C155`; trait text for the 4 ores in `_OptionsCrafter` D/E; caches from Excel (`C105` array-entered in the `_xlfn.` copy) | ✅ |
| 2 | **Data** — extractor ranges `_Weapon` 2..93, `_OptionsCrafter` 61..215, achievements `C135`; parser + audit read the 11 new stat cells (`C164`–`C179`, `E172`); data rebuilt (155 ores, 92 weapons, 22 races), audit 0 problems, rarities refetched (155 of 155) | ✅ |
| 3 | **Python engine + tests** — Fallen Angel, Imp, new procs, totals; goldens, parity, Excel fuzz | ⏳ |
| 4 | **MediaWiki engine + UI + tests + fuzz** — same engine, new DPS rows and clipboard lines | ⏳ |
| 5 | **Deploy + docs** | ⏳ |
