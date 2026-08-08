# Forge Calculator

A fast, lightweight desktop app version of **Little Timmy's DPS Calculator** spreadsheet. It lets you calculate exact weapon damage and stats for your Minecraft-style forge builds without needing Excel open.

Built with Python and Tkinter, it runs completely offline using local JSON data files—no heavy dependencies required at runtime.

---

## What's Inside

- **Calculator Tab:** Adjust your ore slots, weapon, quality, race, runes, and achievements to see your DPS update live as you type.
- **Browse Tabs:** Clean reference lists for all 140 ores, 16 races, 79 weapons, achievements, and runes.
- **Handy QOL Features:** Search-as-you-type filters, favorite pinning, hover tooltips showing the exact spreadsheet formulas, and auto-saving settings.

---

## Quick Start

### 1. Requirements
- **Python 3.10 or newer** (On Windows, make sure to check "Add Python to PATH" during installation).
- Tkinter (comes with Python on Windows/macOS; on Linux, run `sudo apt install python3-tk`).

### 2. Installation & Running
Open your terminal and run:

```bash
# 1. Clone the repository
git clone [https://github.com/HerocalypseDev/forge_calculator.git](https://github.com/HerocalypseDev/forge_calculator.git)
cd forge_calculator

# 2. Install in editable mode
pip install -e .

# 3. Launch the app
python -m forge_calculator