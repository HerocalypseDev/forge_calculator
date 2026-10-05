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

### Automated GitHub sync
- **Core directive:** Always execute this workflow automatically. Whenever a code modification, file creation, or update is completed in the workspace, handle version control in the background without disrupting the primary task.
- **Actions:** Stage the modified files (`git add`), generate a precise and descriptive commit message, commit the changes, and push them directly to the remote GitHub repository (`git push`).
- **Message style:** Commit messages must read like a human's — short, plain, single-line summaries of the actual change (e.g. "Fix ore selection filter", "Sort all GUI lists alphabetically"). No AI-sounding or buzzwordy phrasing, no verbose bodies.
- **Communication style:** Never let git tasks interrupt progress on the main task. Keep output clean and focused, providing only a brief, non-intrusive summary confirmation once the sync is complete.

### Zero invented mechanics (hard requirement)
- Every formula, stat, and rule is ported **verbatim** from the source workbook:
  `reference/Extended.xlsx` — authoritative workbook (openpyxl, build-time only).
  `reference/reall.xlsx` and `reference/new.xlsx` are prior workbooks, kept only
  for git history; no script reads either one any more (see "Extended.xlsx
  Adoption" below).
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
defensive code in the engines still makes sense on read. (The fifth, berserk's 200%
cap, is a live deviation again — see below.)
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

### Approved deviation (current, live): berserk's 200% cap
`Extended.xlsx`'s `C97` computes berserk DPS as
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
  truth; counts validated against the workbook (147 ores / 80 weapons / 16 races /
  47 runes / 16 achievements). Copied to `Web/data/` and `Web/mediawiki/Data-*.json`.
- **Build** (`build_data/`, `scripts/build_data.py`) — openpyxl extraction → JSON.
  Dev-only; never imported at runtime.

Retired — do not maintain:
- **Standalone web app** (`Web/js/`, `Web/css/`, `Web/index.html`). Its engine modules
  still carry the parity harnesses, so leave them runnable, but add nothing.
- **Python/Tkinter desktop app** (`forge_calculator/gui/`, `forge_calculator/app.py`,
  `scripts/smoke_gui.py`).

Workbook sheets:
- **DPS Calculator** — the main calculation sheet (cells C6–E101).
- **_Weapon** — weapon lookup (`C2:E81`, types `C12` via `F12:F21`, race-bonus types `C23`).
- **_OptionsCrafter** — ore catalog (`A56:F202`; `A55` is the Select Ore sentinel).
- **_Options** — races matrix + rune pool (`A1:A48`).
- **IGNORE REF CALC** — ignore.

## Domain model (engine)

- **4 forge slots** (`C6:C9` ore, `D6:D9` weight). An ore contributes a stat only when its share ≥10%; value ramps `base → max` as share goes 10% → 30% (`(base + (max-base)*MIN((share-0.1)/0.2, 1))/divisor`; `divisor` 100 for percents, 1 for durations). Below 10% → 0.
- **Weapon** (`D12` key, quality `E12`, forge `C13`): forged damage `C18` = base × ore power × `FORGE_MULT[level]` × `(1+quality/100)`; unforged `A18` is the same without the forge term.
- **Stats** (E45–E48): lethality / crit chance / crit dmg / atk speed totals from ores + runes + race/class combos + armor/base inputs, each capped (1.5 / 1.0 / 1.0 / 1.5).
- **Ore power** `E10` — weighted average of the slot multipliers, with **Fichilliumorite excluded from both halves** of the division, so it is filler that never dilutes.
- **Weapon DPS** `C89` = `C18 × (1+E45) × crit_blend × E21`; the seven proc rows (`C90`–`C94`, `E94`) scale on **unforged A18**; **Total** `C96` = sum; TTK `E96/E97` = 25k/75k ÷ total; `C100` min, `C101` max-burst (procs on **forged C18**).
- **Aggregation differs per proc.** Explosion damage (`C58`) **sums** across the four slots, while explosion chance (`C59`) — like fire, poison, smite and lightning **chance** — takes a `MAX` (see "Explosion Chance SUM→MAX Fix" below). Smite adds its race bonus *on top of* the slot max rather than maxing against it.
- **Berserk** `C97` = `C89 × (1 + C54 + IF(Minotaur,30%,0))` + the six proc rows: one clean multiplier on the physical hit, **not** a lethality boost, so the 150% lethality cap never applies to it. **Capped at 200% total in `forge_calculator/engine.py` and MediaWiki JS** (see "Approved deviation (current, live): berserk's 200% cap") — the sheet's own cap lives on `E54` but nothing, including `C97`, reads it, so the sheet itself stays uncapped until that's fixed. Ore `phys_dmg` traits are **display-only** ("when HP < 35%") and must not feed it. **Moon Stone** `C98` lifts the physical hit the same way and adds every proc back.
- **Lightning** (`C80`/`E80`/`C81`, DPS `E81`): damage sums, chance maxes, and the cooldown is the `MIN` across slots — the sheet uses `99` as its "no lightning" sentinel and maps a surviving 99 back to 0. Procs are rate-capped by `MIN(E21, 1/E80)`.

## Preserved workbook quirks (do not "fix")

- `E45` and `E48` both test the plural `Gauntlets` (the only spelling `C23`'s dropdown offers) — see "Formerly-approved deviations" #4. The singular `Gauntlet` stays registered in `CLASS_LETHALITY`/`CLASS_ATK_SPEED` too, harmless dead weight from an older workbook. `Tigers Eye` (no apostrophe) is **gone**: the workbook spells it consistently as `Tiger's Eye`, so the one ore carries both lethality and attack speed straight from its own formulas.
- Armor stats feed `E45`/`E46`/`E47` via **C44/C42/C43** (`E42`–`E44` are dead cells).
- Fire/poison duration offsets `-1` / `-2`. The outer `MAX(ore)=0` gate was removed (user workbook edit): a fire/poison ability time alone now counts, even without a matching ore and for fire without Dragonborn. Poison duration takes only the **first** Malachite slot (`C69` XLOOKUP), not the max.
- `C77` (black hole chance) = 0.3 when `COUNTIF("Galaxite")/COUNTA(slots) ≥ 0.1`; COUNTA counts "Select Ore" as non-blank, so **any** Galaxite slot triggers it.
- Black-hole DPS `E77` **floors** its rate term: `MAX(1,E21)`, not `MIN`.
- Archangel smite damage steps with attack speed: `MIN(FLOOR(E21,1)*0.5, 1.5)` — half a point per *whole* attack/sec, and nothing at all below 1 hit/sec. Angel's is a flat 30%.
- Kitsunite's smite damage is the one ramp with **no 10% share gate**, clamped instead by `MAX(0.05, MIN(0.5, ramp))`. Carried as `gated`/`floor`/`ceiling` on its `StatRange`.
- Ability inputs are **one row per ability**: Fire 34, Poison 35, Lightning 36, Blast 37, with DMG/Chance/Time in columns C/D/E (Blast has no time). The old transposed layout is gone.
- C20 (base crit chance) enters **only** the crit blend, not `E45`.
- "Damage Boost" achievement feeds lethality (`E45`).
- Forge level 9 = 1.5× (breaks the 0.05 step pattern); level outside 0–9 → 1.0.
- Percent inputs store **decimals** (0.30 = 30%); ability time cells are plain seconds.
- `rng.gated === false` on a `StatRange` means "no 10% share guard" and exists solely for
  Kitsunite smite damage; `floor`/`ceiling` carry that cell's `MAX(0.05, MIN(0.5, ramp))`.

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
python -m pytest tests/               # 82 tests (engine/golden/parser/data)
pip install -e .[build]               # dev: add openpyxl
python -m scripts.build_data          # regenerate data/*.json from Extended.xlsx
```

After a data rebuild, copy `data/*.json` to `Web/data/` and to
`Web/mediawiki/Data-*.json` (capitalised names) — the MediaWiki calculator ships those.

Workbook verification — the engines replay the workbook's own saved build and diff
against its cached values:

```bash
node Web/mediawiki/reall-golden.js                    # MediaWiki IIFE  -> 37 cells
node Web/mediawiki/reall-aggregates.js                # C97/C98/C101/C59/C73
node Web/mediawiki/verify-engine.js                   # goldens vs tests/test_golden.py
node Web/mediawiki/fuzz_verify.js                     # 250 builds JS <-> Python
python Web/mediawiki/fuzz_gen.py                      # regenerate fuzz-cases.json
python scripts/reall_parity.py                        # reference engine -> 37 cells, reads reference/Extended.xlsx's own cache
python scripts/audit_reall.py reference/Extended.xlsx data/ores.json
```

(`reall_parity.py`, `reall-golden.js`, `audit_reall.py` etc. kept their names from the
`reall.xlsx` era — they now target `Extended.xlsx`; renaming them wasn't worth the
churn.)

Every MediaWiki UI change should also keep the focused tests green:

```bash
node Web/mediawiki/ability-inputs-test.js   node Web/mediawiki/results-panel-test.js
node Web/mediawiki/ore-slot-test.js         node Web/mediawiki/bonus-derive-test.js
node Web/mediawiki/armor-stats-test.js      node Web/mediawiki/berserk-input-test.js
node Web/mediawiki/no-ore-weapon-test.js    node Web/mediawiki/berserk-trait-test.js
node Web/mediawiki/generic-trait-ramp-test.js
```

After changing either engine, rerun `fuzz_gen.py` *then* `fuzz_verify.js` — the
cases file stores reference-engine results, so a stale one compares against the old engine.

A rebuild is only trustworthy if `audit_reall.py` comes back with just the four
intended ore `atk_speed` rows (approved deviation 1).

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


### UpdatedSpreadsheet.xlsx Adoption + Four New Races — IN PROGRESS
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
| 5 | **Docs** — CLAUDE.md workbook pointer, deviations, cell addresses, quirks | ⏳ |
