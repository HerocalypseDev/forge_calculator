# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Permanent rules

### Automated GitHub sync
- **Core directive:** Always execute this workflow automatically. Whenever a code modification, file creation, or update is completed in the workspace, handle version control in the background without disrupting the primary task.
- **Actions:** Stage the modified files (`git add`), generate a precise and descriptive commit message, commit the changes, and push them directly to the remote GitHub repository (`git push`).
- **Message style:** Commit messages must read like a human's — short, plain, single-line summaries of the actual change (e.g. "Fix ore selection filter", "Sort all GUI lists alphabetically"). No AI-sounding or buzzwordy phrasing, no verbose bodies, no `Co-Authored-By: Claude` trailer.
- **Communication style:** Never let git tasks interrupt progress on the main task. Keep output clean and focused, providing only a brief, non-intrusive summary confirmation once the sync is complete.

### Zero invented mechanics (hard requirement)
- Every formula, stat, and rule is ported **verbatim** from the three sources:
  - `reference/Copy of LittleTimmy's Calculator MAIN COPY (UP TO DATE) (1).xlsx` — authoritative workbook (openpyxl, build-time only)
  - `reference/all_formulas.txt` and `reference/all_formulas_reference (1).txt` — the same formulas in two formats; use the reference file (row order, per-sheet) when porting
- Never hand-type a number that the workbook computes. Stat matrices are derived from formula strings; constants are guarded by `tests/test_golden.py::test_engine_constants_match_source`.

### Dynamic Plan Tracking & Memory
- **Plan Storage:** Whenever a new development plan or roadmap is created while in **Plan Mode**, you must add a summary of that plan to `CLAUDE.md` under a dedicated tracking section **immediately when the plan is made** — before any implementation work begins. Do not wait until the plan's phases have been implemented to record it.
- **Progress Updates:** Each phase is marked done **individually, as soon as that phase is completed and committed** (never batch-marking the whole plan done at the end). Whenever a specific part, task, or phase of the active plan is completed, committed, and pushed to GitHub, immediately update `CLAUDE.md` to tick, check off, or cross out **only that phase**, so the tracking table reflects the true state at every step.

## Project overview

`forge_calculator` is a Python/Tkinter desktop app that reproduces "LittleTimmy's DPS Calculator", an Excel workbook computing DPS for a game's forge/weapon system. The engine, data, and GUI are complete:

- **Engine** (`forge_calculator/engine.py`) — pure, headless, fully tested. `calculate(build, game)` → every workbook cell (E10…E92).
- **Data** (`forge_calculator/data.py`, `data/*.json`) — committed JSON is the runtime source of truth; counts validated against the workbook (140 ores / 79 weapons / 16 races / 47 runes / 16 achievements).
- **GUI** (`forge_calculator/gui/`) — ttk.Notebook: interactive Calculator tab + browse-only Ores/Races/Weapons/Achievements/Runes tabs.
- **Build** (`build_data/`, `scripts/build_data.py`) — openpyxl extraction → JSON. Dev-only; never imported at runtime.

Workbook sheets:
- **DPS Calculator** (99 formulas) — the main calculation sheet (cells C6–E96).
- **_Weapon** — weapon lookup (`C2:E80`, types `C12`, race-bonus types `C23`).
- **_OptionsCrafter** — ore catalog (`A56:F195`) + stat formulas (C44–C76).
- **_Options** — races matrix + rune pool (`A1:A48`).
- **IGNORE REF CALC** — ignore.

## Domain model (engine)

- **4 forge slots** (`C6:C9` ore, `D6:D9` weight). An ore contributes a stat only when its share ≥10%; value ramps `base → max` as share goes 10% → 30% (`(base + (max-base)*MIN((share-0.1)/0.2, 1))/divisor`; `divisor` 100 for percents, 1 for durations). Below 10% → 0.
- **Weapon** (`D12` key, quality `E12`, forge `C13`): forged damage `C18` = base × ore power × `FORGE_MULT[level]` × `(1+quality/100)`; unforged `A18` is the same without the forge term.
- **Stats** (E44–E47): lethality / crit chance / crit dmg / atk speed totals from ores + runes + race/class combos + armor/base inputs, each capped (1.5 / 1.0 / 1.0 / 1.5).
- **Weapon DPS** `C84` = `C18 × (1+E44) × crit_blend × E21`; procs (C85–C89) scale on **unforged A18**; **Total** `C91` = sum; TTK `E91/E92` = 25k/75k ÷ total; `C95` min, `C96` max-burst (procs on **forged C18**).

## Preserved workbook quirks (do not "fix")

- `Gauntlet` (singular, E44) vs `Gauntlets` (plural, E47/C23); `Tigers Eye` (formula-only) vs `Tiger's Eye` (catalog).
- Armor stats feed E44/E45/E46 via **C41/C42/C43** (E41–E43 are dead cells).
- Fire/poison duration offsets `-1` / `-2`. The outer `MAX(ore)=0` gate was removed (user workbook edit): a fire/poison ability time alone now counts, even without a matching ore and for fire without Dragonborn. Poison duration takes only the **first** Malachite slot (C68 XLOOKUP), not the max.
- `C76` (black hole chance) = 0.3 when `COUNTIF("Galaxite")/COUNTA(slots) ≥ 0.1`; COUNTA counts "Select Ore" as non-blank, so **any** Galaxite slot triggers it.
- Cross-wired ability inputs: Fire DMG=C34 / Chance=C35 / Time=C36, Poison=D34/D35/D36, Blast=E34/E35 (no time).
- C20 (base crit chance) enters **only** the crit blend, not E45.
- "Damage Boost" achievement feeds lethality (E44).
- Forge level 9 = 1.5× (breaks the 0.05 step pattern); level outside 0–9 → 1.0.
- Percent inputs store **decimals** (0.30 = 30%); ability time cells are plain seconds.

## Commands

```bash
python -m forge_calculator            # run the app (stdlib-only)
python -m pytest tests/               # 79 tests (engine/golden/parser/data)
python scripts/smoke_gui.py           # real-GUI smoke: Golden-1 labels + all tabs
pip install -e .[build]               # dev: add openpyxl
python -m scripts.build_data "<xlsx>" # regenerate data/*.json
```

No linter or formatter is configured.

## Development Plan Tracking

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
| **Rune 3×2 grid** — 6 fixed cells (C27/D27–C29/D29); `runes` → 6-element array in DEFAULT_BUILD (web only) | `createRuneSelector` + CSS | `RuneSelector.js` + CSS | — | ✅ Done | 4aaa441 |

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
| **Whole-percent format** — `createStatInput` fields use `step:1`, `max` = stat cap (lethality 150, crit chance/dmg 100); `transformBuildForEngine` divides the 3 armor pct fields by 100 | `forge-calculator.common.js` | ✅ Done | (this session) |
| **Commit clamping** — `[0, max]` clamp on change; non-numeric/empty → 0 | `createStatInput` | ✅ Done | (this session) |
| **Subtext** — "Enter percentages as whole numbers (15 = 15%)." under the Armor Stats title | `forge-calculator.common.js` + `.fc-input-section-subtext` in `Template-ForgeCalculator-styles.css` | ✅ Done | (this session) |
| **Test** — `armor-stats-test.js`: DOM-level checks for step/max/min attrs, clamp on commit, percent→decimal transform, no stale decimal inputmode | `Web/mediawiki/armor-stats-test.js` | ✅ Done | (this session) |

**Verification:** `node Web/mediawiki/armor-stats-test.js` → ALL ARMOR-STATS CHECKS PASSED; `verify-engine.js` / `fuzz_verify.js` / `ability-inputs-test.js` / `results-panel-test.js` / `ore-slot-test.js` / `bonus-derive-test.js` all pass; `node --check` clean. Engine untouched.

### MediaWiki Berserk Input — COMPLETED ✅
**Goal:** Add a manual Berserk input to the MediaWiki calculator. Berserk was engine-supported (`build.berserk`, workbook C53) but hardcoded to 0 in every UI — the only way to get "Total Berserk DPS" was the Minotaur race (+30%, E53). New "Berserk" section between Race and Armor Stats: whole-percent entry (30 = 30%), clamps to the lethality cap (150), transform divides by 100. Engine/formulas untouched — the input feeds the existing `build.berserk` + Minotaur path (C92). MediaWiki-only, same precedent as Abilities/Armor.

| Change | Where | Status | Commit |
|--------|-------|--------|--------|
| **Berserk section** — "Berserk" input section (label, whole-percent subtext, number field `id="berserk"`, min 0 / max 150 / step 1, inputmode numeric, debounced `input` + `change` clamp `[0,150]`, non-numeric/empty → 0) | `forge-calculator.common.js` `createInputPanel` (reuses `.fc-stat-input-*` CSS) | ✅ Done | (this session) |
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
