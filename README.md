# forge_calculator

A desktop port of **LittleTimmy's DPS Calculator**, the Excel workbook that computes DPS for a Minecraft-style forge/weapon build system. The engine is a cell-for-cell port of the workbook's formulas — every number the app shows comes from the spreadsheet, not re-created from scratch.

It's a Tkinter app with one interactive tab and five browse-only tabs:

- **Calculator** — set your ore slots, weapon, quality/forge level, race, runes, abilities, and achievement; every result cell updates live as you type.
- **Ores** — 140 ores with equipment, multipliers, traits @10%/@30%, and a per-ore stat matrix (base → max at 10%/30% share).
- **Races** — 16 races with default trait and full available trait matrix.
- **Weapons** — 79 weapons filterable by type (10 types) and name.
- **Achievements** — 16 achievement bonuses with their stat and value.
- **Runes** — 47 runes with parsed stat and value.

Game data lives in `data/*.json`, committed alongside the code, so the app runs on the **Python standard library alone** — no workbook, no external dependencies at runtime.

---

## Quick Start (for end users)

### Prerequisites

- **Python 3.10 or later** — [Download Python](https://www.python.org/downloads/)
  - On Windows: check **"Add Python to PATH"** during install
  - On macOS: `brew install python` or use the official installer
  - On Linux: `sudo apt install python3 python3-tk` (tkinter is usually a separate package)
- **A graphical display** — this is a GUI application (won't run headless on a server without X11/Wayland forwarding)

### Installation & Running

```bash
# 1. Clone the repository
git clone https://github.com/HerocalypseDev/forge_calculator.git
cd forge_calculator

# 2. Install the package in editable mode
pip install -e .

# 3. Run the calculator
python -m forge_calculator
```

That's it! A window titled "Forge Calculator vX.Y.Z" will open.

> **Note:** `pip install -e .` installs the package in "editable" mode so any code changes you make are immediately reflected without reinstalling. It also makes the `forge_calculator` module importable from anywhere.

---

## Detailed Walkthrough (for first-time users)

### Step 1: Verify Python is installed

Open a terminal/command prompt and run:

```bash
python --version
# or on some systems:
python3 --version
```

You should see something like `Python 3.10.x`, `Python 3.11.x`, or `Python 3.12.x`. If you get "command not found" or an older version (3.9 or below), install/update Python first.

### Step 2: Clone the repository

```bash
git clone https://github.com/HerocalypseDev/forge_calculator.git
cd forge_calculator
```

This creates a `forge_calculator/` folder with all the source code.

### Step 3: Install the package

```bash
pip install -e .
```

What this does:
- Reads `pyproject.toml` / `setup.py`
- Installs the `forge_calculator` package into your Python environment
- The `-e` flag means "editable" — you can edit the code and changes take effect immediately
- No additional packages are downloaded (stdlib only)

### Step 4: Run the application

```bash
python -m forge_calculator
```

The `-m` flag tells Python to run the `forge_calculator` module as a script. This executes `forge_calculator/app.py:main()`, which builds the Tkinter window and starts the event loop.

---

## Using the Calculator

### Inputs (left pane)
| Section | What to do |
|---------|------------|
| **Ore slots (4)** | Type in the search box to filter 140 ores; press **Enter** or click to select. Use the spinner for weight (0–999). Click **☆** to pin a favorite — pinned ores sort to the top. |
| **Weapon** | Optionally filter by type, then search/select a weapon. Set Quality (E12) and Forge level (C13, 0–9). Click **☆** to pin. |
| **Character / stats** | Pick Race and Bonus type. Enter base/armor crit chance, crit DMG, lethality, and Berserk as decimals (e.g., `0.30` = 30%). |
| **Rune slots (6)** | Search/select runes (or "None"). |
| **Ability inputs** | Fire/Poison/Blast damage, chance, and time (seconds). All values are decimals. |
| **Achievement** | Pick one (or "None"). "Damage Boost" feeds lethality. |

### Results (right pane)
Results are grouped into four sections:
- **Core** — ore power, weapon damage, interval, attack rate
- **Stats** — lethality, crit chance/dmg, atk speed, crit blend
- **DPS** — weapon DPS, all proc DPS, total DPS, berserk/moonstone variants, min/max burst
- **Time** — TTK for 25k and 75k HP targets

**Hover any result label** to see its workbook formula (e.g., "C84 = C18 × (1+E44) × crit_blend × E21").

**Status bar** (bottom) shows current Total DPS and active tab.

### Buttons
- **Reset** — restores all inputs to defaults
- **Copy Total DPS** — copies the formatted Total DPS value to clipboard

### Persistence
All inputs, active tab, browse filters, and pinned favorites are saved automatically to `~/.forge_calculator/state.json` and restored on next launch.

---

## For Developers

### Running tests

```bash
# All tests (75 tests: engine, parsers, data, golden, settings)
python -m pytest tests/

# Verbose output
python -m pytest tests/ -v

# Run a specific test file
python -m pytest tests/test_engine.py -v
```

### GUI smoke test (boots real Tkinter window, drives inputs, checks all tabs)

```bash
python scripts/smoke_gui.py
```

This runs headlessly on CI but shows a real window locally. It:
1. Loads the Golden-1 config and asserts result labels
2. Verifies live recompute fires on input change
3. Drives a SearchableCombo: types "gal" → selects Galaxite → asserts recompute
4. Tests state persistence round-trip (isolated config dir)
5. Tests pin/unpin ordering
6. Verifies tooltips are attached
7. Checks all 6 browse tabs render correct row counts

### Regenerating data from the workbook

The workbook is **only needed for this step**. The committed `data/*.json` is the runtime source of truth.

```bash
# 1. Install build dependencies (adds openpyxl)
pip install -e .[build]

# 2. Run the extractor with the path to the workbook
python -m scripts.build_data "path/to/LittleTimmy's Calculator.xlsx"
```

This reads the workbook sheets and writes fresh `data/ores.json`, `data/weapons.json`, `data/races.json`, `data/runes.json`, `data/achievements.json`.

---

## Project Layout

```
forge_calculator/
├── forge_calculator/          # The application package
│   ├── __init__.py
│   ├── __version__.py
│   ├── app.py                 # Entry point: build_app() → Tk root + MainWindow
│   ├── engine.py              # Pure math engine: calculate(build, game) → Result
│   ├── data.py                # GameData + load_game_data() → loads data/*.json
│   ├── parse.py               # Workbook formula parser (build-time only)
│   ├── settings.py            # Persistence: config_dir, load_state, save_state
│   ├── constants.py           # CAPS, FORGE_MULT, etc. (from workbook)
│   └── gui/
│       ├── __init__.py
│       ├── widgets.py         # SearchableCombo, Tooltip, ScrollableFrame, helpers
│       ├── main_window.py     # Notebook + tabs + status bar + persistence
│       ├── calculator_tab.py  # Interactive calculator (inputs + results)
│       ├── ores_tab.py        # Browse ores + stat matrix
│       ├── races_tab.py       # Browse races + trait matrix
│       ├── weapons_tab.py     # Browse weapons (type + name filter)
│       ├── achievements_tab.py# Browse achievements
│       └── runes_tab.py       # Browse runes
├── data/                      # Committed JSON (runtime source of truth)
│   ├── ores.json         (140 ores)
│   ├── weapons.json      (79 weapons)
│   ├── races.json        (16 races)
│   ├── runes.json        (47 runes)
│   └── achievements.json (16 achievements)
├── build_data/                # Build-time extraction scripts
│   └── scripts/build_data.py
├── scripts/                   # Dev helpers
│   └── smoke_gui.py
├── tests/                     # 75 tests
│   ├── test_engine.py
│   ├── test_golden.py
│   ├── test_parser.py
│   ├── test_data.py
│   └── test_settings.py
├── reference/                 # Source workbook + formula exports (not in repo)
├── pyproject.toml             # Package config
└── CLAUDE.md                  # Project instructions for Claude Code
```

---

## Architecture Notes

- **Zero invented mechanics**: Every formula, stat, and constant comes verbatim from the workbook. The engine (`engine.py`) is pure Python — no tkinter, no openpyxl. It's tested against golden values extracted from the workbook itself.
- **Data-driven**: `data/*.json` is generated once from the workbook, then committed. The app never reads the `.xlsx` at runtime.
- **GUI layer only**: All UX improvements (search, pins, tooltips, persistence, status bar) live in `gui/`. The engine and data are untouched.
- **Test suite as tripwire**: 75 pytest tests ensure the engine still matches the workbook. Any drift shows up immediately.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `ModuleNotFoundError: No module named 'tkinter'` | Install tkinter: `sudo apt install python3-tk` (Debian/Ubuntu), `sudo dnf install python3-tkinter` (Fedora), or reinstall Python with "tcl/tk" checked (Windows/macOS) |
| `ImportError: cannot import name 'GameData'` | Run `pip install -e .` from the repo root |
| Window opens tiny / off-screen | Delete `~/.forge_calculator/state.json` to reset window geometry |
| "No display" error on Linux server | Use X11 forwarding (`ssh -X`) or a VNC display; Tkinter requires a display |
| Tests fail after data changes | Re-run `python -m scripts.build_data "path/to/workbook.xlsx"` to regenerate `data/` |

---

## Credits

The engine and data architecture are a faithful port of **Little Timmy's** DPS Calculator spreadsheet — the formulas, stat values, and quirks all come from that workbook.

**Original reference:** [Little Timmy's Reference Spreadsheet](https://docs.google.com/spreadsheets/d/1sScoEz6bGmu1ZmwzDhgpM1V2kC5YcKgDNWdBPhLryq0/edit?usp=drivesdk)

---

## License

MIT — see `LICENSE` if present, otherwise free to use/modify/distribute.