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
  - `reference/Copy of Copy of LittleTimmy's Calculator MAIN COPY (UP TO DATE) (1).xlsx` — authoritative workbook (openpyxl, build-time only)
  - `reference/all_formulas.txt` and `reference/all_formulas_reference (1).txt` — the same formulas in two formats; use the reference file (row order, per-sheet) when porting
- Never hand-type a number that the workbook computes. Stat matrices are derived from formula strings; constants are guarded by `tests/test_golden.py::test_engine_constants_match_source`.

### Dynamic Plan Tracking & Memory
- **Plan Storage:** Whenever a new development plan or roadmap is created while in **Plan Mode**, you must automatically add a summary of that plan directly into the `CLAUDE.md` file under a dedicated tracking section.
- **Progress Updates:** Whenever a specific part, task, or phase of the active plan is completed, committed, and pushed to GitHub, you must immediately update `CLAUDE.md` to mark, check off, or cross out that completed phase so the project memory stays completely up to date.

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
- Fire/poison duration quirks: `-1` / `-2`, and an ability time alone does nothing without a matching fire/poison ore (outer `MAX(ore)=0` gate).
- `C76` (black hole chance) = 0.3 when `COUNTIF("Galaxite")/COUNTA(slots) ≥ 0.1`; COUNTA counts "Select Ore" as non-blank, so **any** Galaxite slot triggers it.
- Cross-wired ability inputs: Fire DMG=C34 / Chance=C35 / Time=C36, Poison=D34/D35/D36, Blast=E34/E35 (no time).
- C20 (base crit chance) enters **only** the crit blend, not E45.
- "Damage Boost" achievement feeds lethality (E44).
- Forge level 9 = 1.5× (breaks the 0.05 step pattern); level outside 0–9 → 1.0.
- Percent inputs store **decimals** (0.30 = 30%); ability time cells are plain seconds.

## Commands

```bash
python -m forge_calculator            # run the app (stdlib-only)
python -m pytest tests/               # 69 tests (engine/golden/parser/data)
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
