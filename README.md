# Forge Calculator

A faithful desktop port of **LittleTimmy's DPS Calculator** — a Minecraft-style
forge/weapon build optimizer. Every formula, stat, and rule is ported verbatim
from the source workbook; **no mechanics are invented**.

## Features

- **Interactive DPS Calculator** tab: 4 ore slots, weapon (all 79, grouped by
  type), quality & forge level, race/class bonus, 6 rune slots, base/armor
  crit stats, ability inputs, berserk, and the achievement bonus selector.
  Every result recomputes live as you type (the same numbers the workbook
  produces, to full precision).
- **Browse-only data tabs**: Ores (140, with per-ore share-scaling stat
  matrix), Races (16), Weapons (79 / 10 types), Achievements (16), Runes (47).
- **Zero runtime dependencies**: the app reads committed `data/*.json`; the
  workbook and `openpyxl` are never needed at runtime.

## Run

```bash
python -m forge_calculator
```

(stdlib-only: tkinter ships with Python. A display is required.)

## Test

```bash
python -m pytest            # 69 tests: engine, parsers, data, golden
python scripts/smoke_gui.py # launches the real GUI, drives Golden-1, checks all tabs
```

The golden tests cross-check every engine cell against the workbook's own
cached values (they skip gracefully if the workbook/cache is absent). With the
Golden-1 config (Ancienite 10 + Aetherit 10, Demonic Spear, quality 100) the
app reproduces **180.91 avg DPS** and **138.19 s TTK / 25k** — exactly the
spreadsheet's numbers.

## Rebuild the data (dev)

```bash
pip install -e .[build]                    # openpyxl
python -m scripts.build_data "<path>.xlsx" # regenerates data/*.json
python -m pytest tests/                    # fidelity guard: counts must not drift
```

## Architecture

```
forge_calculator/
├── data.py      GameData + frozen dataclasses + JSON loader/validator
├── parse.py     trait/rune/achievement/ore-power text parsers
├── engine.py    ALL calculation logic (pure, headless-testable)
├── app.py       tk.Tk root + entry point
└── gui/         main_window (notebook) + calculator + browse tabs + widgets
build_data/      build-time only: formula parser + workbook extractor
data/            committed, generated JSON (runtime source of truth)
tests/           pytest suite (engine/golden/parser/data)
scripts/         build_data, peek helpers, GUI smoke test
```

Core rule: `engine.py`, `data.py`, `parse.py` never import tkinter or openpyxl,
so the engine is fully testable headlessly. See `CLAUDE.md` for the preserved
workbook quirks.
