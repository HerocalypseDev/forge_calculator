# forge_calculator

A desktop port of **LittleTimmy's DPS Calculator**, the Excel workbook that
computes DPS for a Minecraft-style forge/weapon build system. The engine is a
cell-for-cell port of the workbook's formulas — every number the app shows
comes from the spreadsheet, not re-created from scratch.

It's a Tkinter app with one interactive tab and a few browse-only ones:

- **Calculator** — set your ore slots, weapon, quality/forge level, race,
  runes, and the rest; every result cell updates live as you type.
- **Ores / Races / Weapons / Achievements / Runes** — the full data sets
  (140 ores, 16 races, 79 weapons, 16 achievements, 47 runes), read-only.

Game data lives in `data/*.json`, committed alongside the code, so the app
runs on the Python standard library alone — no pip install, no workbook.

## Running

```bash
python -m forge_calculator
```

Needs Python 3.10+ and a display (it's a GUI).

## Testing

```bash
python -m pytest            # 69 tests: engine, parsers, data, golden
python scripts/smoke_gui.py # boots the real GUI, drives the calculator, checks all tabs
```

The golden tests compare the engine's output against the cached values stored
in the workbook itself: when the workbook is present they run for real, and
when it's not they skip. The engine reproduces the workbook's saved config
exactly — Ancienite 10 + Aetherit 10 with a Demonic Spear at quality 100 gives
180.91 avg DPS and a 138.19 s TTK on the 25k target.

## Rebuilding the data

The workbook is only needed when regenerating `data/`:

```bash
pip install -e .[build]              # adds openpyxl
python -m scripts.build_data "path/to/workbook.xlsx"
```

## Layout

- `forge_calculator/` — the app. `engine.py` holds all the math (pure and
  headless); `data.py` and `parse.py` load and interpret the JSON; `gui/` is
  the Tkinter layer.
- `build_data/` — build-time only; extracts the workbook into `data/`.
- `data/` — committed, generated JSON; the runtime source of truth.
- `tests/`, `scripts/` — test suite and dev helpers.

`engine.py`, `data.py`, and `parse.py` deliberately never import tkinter or
openpyxl, so the engine stays testable without a GUI or the workbook.

## Credits

The engine and data architecture are a faithful port of **Little Timmy's** DPS
Calculator spreadsheet — the formulas, stat values, and quirks all come from
that workbook. Original reference:

[Little Timmy's Reference Spreadsheet](https://docs.google.com/spreadsheets/d/1sScoEz6bGmu1ZmwzDhgpM1V2kC5YcKgDNWdBPhLryq0/edit?usp=drivesdk)
