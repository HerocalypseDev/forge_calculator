# Forge Calculator v1.0.0

First public release — a complete cell-for-cell desktop port of **LittleTimmy's DPS Calculator**, the Excel workbook for Minecraft-style forge/weapon build DPS calculations.

---

## 📥 Download

- **Windows x64**: `ForgeCalculator.exe` (11.9 MB) — single portable executable, no installation required

---

## ✨ Features

### Interactive Calculator
- **4 ore slots** with weight (0–999) — search 140 ores as you type
- **Weapon picker** — filter by type (10 types) or name (79 weapons)
- **Character stats** — race (16), bonus type, base/armor crit chance, crit DMG, lethality, Berserk
- **6 rune slots** — search 47 runes
- **Ability inputs** — Fire/Poison/Blast damage, chance, time
- **Achievement** — 16 options (Damage Boost feeds lethality)

### Live Recompute
Every result updates instantly as you type — no "Calculate" button needed.

### Smart UX
- **Search-as-you-type** on all dropdowns (ores, weapons, runes, races, achievements)
- **Quick-pin favorites** — click ★ to pin ores/weapon to top of lists
- **Hover tooltips** — formulas on results (e.g., "C84 = C18 × (1+E44) × crit_blend × E21"), full ore/weapon detail on combos
- **State persistence** — all inputs, active tab, filters, and pins restore on restart (`~/.forge_calculator/state.json`)
- **Status bar** — Total DPS + active tab at bottom
- **Invalid-input highlighting** — red background on non-numeric entries
- **Reset / Copy buttons** — restore defaults, copy Total DPS to clipboard
- **Grouped results** — Core / Stats / DPS / Time sections

### Browse Tabs (Read-only)
- **Ores** — 140 ores with equipment, multipliers, traits @10%/@30%, per-ore stat matrix
- **Races** — 16 races with default trait + full available trait matrix
- **Weapons** — 79 weapons filterable by type + name
- **Achievements** — 16 bonuses with stat/value
- **Runes** — 47 runes with parsed stat/value

---

## 🎯 Accuracy Guarantee

- **Zero invented mechanics** — every formula, stat, and constant ported verbatim from the source workbook
- **75 automated tests** verify engine matches workbook golden values
- **Data-driven** — `data/*.json` generated once from workbook, then committed as runtime source of truth

---

## 🖥️ Requirements

- **Windows 10/11** (x64)
- No Python or other dependencies needed — fully self-contained

---

## 🚀 Quick Start

1. Download `ForgeCalculator.exe`
2. Double-click to run
3. Pick ores, weapon, race, runes — results update live

---

## 📊 Example (Golden-1 Config)

| Setting | Value |
|---------|-------|
| Ore 1 | Ancienite ×10 |
| Ore 2 | Aetherit ×10 |
| Weapon | Demonic Spear |
| Quality | 100 |
| Forge | 0 |
| Base Crit DMG | 1.45 |

**Result:** ~180.91 avg DPS, 138.19 s TTK (25k HP)

---

## 🔧 For Developers

```bash
git clone https://github.com/HerocalypseDev/forge_calculator.git
cd forge_calculator
pip install -e .
python -m forge_calculator        # run from source
python -m pytest tests/           # 75 tests
python scripts/smoke_gui.py       # GUI smoke test
```

**Regenerate data from workbook:**
```bash
pip install -e .[build]
python -m scripts.build_data "path/to/workbook.xlsx"
```

---

## 📝 Credits

Based on **[Little Timmy's Reference Spreadsheet](https://docs.google.com/spreadsheets/d/1sScoEz6bGmu1ZmwzDhgpM1V2kC5YcKgDNWdBPhLryq0/edit?usp=drivesdk)** — all formulas, stats, and quirks come from that workbook.

---

## 📄 License

MIT — free to use, modify, distribute.