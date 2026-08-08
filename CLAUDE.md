# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Permanent rules

### Automated GitHub sync
- **Core directive:** Always execute this workflow automatically. Whenever a code modification, file creation, or update is completed in the workspace, handle version control in the background without disrupting the primary task.
- **Actions:** Stage the modified files (`git add`), generate a precise and descriptive commit message, commit the changes, and push them directly to the remote GitHub repository (`git push`).
- **Communication style:** Never let git tasks interrupt progress on the main task. Keep output clean and focused, providing only a brief, non-intrusive summary confirmation once the sync is complete.

## Project overview

`forge_calculator` is a Python reimplementation of "LittleTimmy's DPS Calculator", an Excel spreadsheet that computes DPS (damage per second) for a game's forge/weapon system. The Python package is currently an empty scaffold; the real content lives in the spreadsheet and the two extracted-formula text files.

The goal of this project is to port the workbook's calculation logic into Python so the spreadsheet's exact numbers can be reproduced without Excel.

## Source of truth: the spreadsheet

- `Copy of Copy of LittleTimmy's Calculator MAIN COPY (UP TO DATE) (1).xlsx` — the authoritative workbook. The static lookup data (weapon stats, ore data) is NOT in the text dumps, so this file must be read (e.g. with `openpyxl`) when those tables are needed.
- `all_formulas.txt` and `all_formulas_reference (1).txt` — the same formulas extracted from the workbook in two formats. Use the reference file when porting; it is organized by sheet with cell addresses and per-sheet formula counts.

Workbook sheets:
- **DPS Calculator** (99 formulas) — the main calculation sheet.
- **_Weapon** — weapon lookup table (name → base damage, attack speed), referenced via `VLOOKUP('_Weapon'!$C$2:$E$80, ...)`.
- **_OptionsCrafter** — ore data (multiplier, low/high stat text); the lookup source for the ore rows.
- **_Options** — data only.
- **IGNORE REF CALC** — ignore.

## Domain model (how the calculator works)

Inputs on the DPS Calculator sheet:
- **4 forge slots** (`C6:C9` = ore name, `D6:D9` = weight): an ore contributes a stat only when its share of the total weight exceeds 10%; its power scales from a base to a max value as share grows 10% → 30% (`(share - 0.1) * 4.5 + 0.1`, capped at 1). Each ore grants different stats (Lethality, Crit Chance, Crit DMG, Atk Speed, physical/fire/poison/AOE damage, etc.).
- **Weapon** (`D12` lookup key, `E10` damage % from ores, `E12` level bonus, `C13` enhancement level): base damage × ore damage multiplier × enhancement multiplier.
- **Race/class + weapon type** (`C22`/`C23`): some combos add fixed bonuses (e.g. Goblin+Dagger, Golem+Colossal Sword, Felynx+Gauntlets) and race grants stat bonuses (e.g. Archangel/Demon +crit, Dragonborn +dmg).
- **3 trait slots** (`C27:D29`, `C80` bonus cell): trait text like "+5% Lethality" parsed with SEARCH/FIND/MID/VALUE into stat totals (E44/E45/E46/E47).

Core DPS calculation:
- `A18` = weapon base damage × ore multiplier × level multiplier
- `E44` = total Lethality (cap 150%), `E45` = total Crit Chance (cap 100%), `E46` = total Crit DMG (cap 100%), `E47` = total Atk Speed (cap 150%), `E21` = attacks per second
- **Weapon DPS** `C84` = `A18 * (1+E44) * (MIN(C20+E45,1)*(C21+E46) + (1-MIN(C20+E45,1))) * E21` (base × lethality × expected crit multiplier × attack speed)
- **Total DPS** `C91` = weapon DPS + special-damage terms (black hole, poison/fire, etc.)
- **Time to kill** `E91` = `25000 / C91`, `E92` = `75000 / C91`

## Commands

Setup:
```bash
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -e .
```

Tests:
```bash
python -m pytest             # no tests exist yet; pytest is the anticipated runner (see .gitignore)
```

No linter or formatter is configured.

## Development notes

- When implementing a formula, port from `all_formulas_reference (1).txt` (cell → formula), and cross-check data lookups against the `.xlsx`, since the text dumps contain formulas only, not the static lookup tables.
- `pyproject.toml` uses setuptools; package name `forge-calculator`, importable as `forge_calculator`, requires Python ≥ 3.10. No runtime dependencies are declared yet (an Excel reader will need to be added).
