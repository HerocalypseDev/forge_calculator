# Forge Calculator — Web Version

A browser-based port of the **Little Timmy's DPS Calculator**, built with vanilla JavaScript (ES modules) and CSS. No build step, no dependencies — just open `index.html` in a browser.

## Quick Start

```bash
# Option 1: Open directly (some browsers block ES modules on file://)
# Just double-click Web/index.html

# Option 2: Serve locally (recommended)
cd Web
npx serve .
# or
python -m http.server 8000
# Then open http://localhost:8000 (or 3000 for serve)
```

## Project Structure

```
Web/
├── index.html              # Entry point
├── css/
│   ├── calculator.css      # Main calculator styles
│   ├── wiki-styles.css     # Wiki-style tables for browse tabs
│   └── responsive.css      # Mobile/desktop breakpoints
├── js/
│   ├── main.js             # App bootstrap, tab routing
│   ├── components/         # UI components (each self-contained)
│   │   ├── AppLayout.js       # Root layout + tab bar
│   │   ├── InputPanel.js      # Left panel: ore slots, weapon, race, etc.
│   │   ├── ResultsPanel.js    # Right panel: DPS cards, stats
│   │   ├── OreSlot.js         # Single ore dropdown + weight input
│   │   ├── WeaponSelector.js  # Weapon type → weapon + quality + enhancement
│   │   ├── StatInput.js       # Armor/base stat number inputs
│   │   ├── AbilityGrid.js     # Fire/Poison/Blast ability inputs
│   │   ├── RuneSelector.js    # Rune dropdowns
│   │   ├── SearchableDropdown.js  # Reusable searchable <select>
│   │   ├── Tooltip.js         # Hover tooltip utility
│   │   ├── StatRow.js         # Single result row (label + value)
│   │   └── ResultsCard.js     # Card wrapper for result sections
│   ├── engine/           # Pure calculation logic (port of Python engine)
│   │   ├── index.js         # calculate(build) → results object
│   │   ├── constants.js     # FORGE_MULT, caps, divisors
│   │   ├── formulas.js      # Ore contribution, weapon damage, stats
│   │   ├── stats.js         # Lethality, crit, attack speed totals
│   │   ├── procs.js         # Fire/poison/blast/galaxite proc math
│   │   ├── dps.js           # Weapon DPS + total DPS
│   │   └── traits.js        # Race/class bonuses, rune effects
│   ├── data/             # Data loading & schemas
│   │   ├── index.js         # loadAll() → {ores, weapons, races, runes, achievements}
│   │   ├── loader.js        # fetch + cache JSON
│   │   ├── schemas.js       # Zod-like validation (lightweight)
│   │   └── constants.js     # Derived constants (ore categories, etc.)
│   └── utils/
│       ├── dom.js         # Small DOM helpers
│       ├── events.js      # Event bus / pub-sub
│       ├── format.js      # Number formatting (DPS, percentages, time)
│       ├── parse.js       # Input parsing/validation
│       └── object.js      # Object utilities
└── moduleoredata.txt       # (reference) raw ore data export
    moduleores.txt          # (reference)
    modulecrafting recipie.txt
    html file.txt           # (reference) original HTML prototype
    css file.txt
```

## Data Source

The web version consumes the **same JSON data** as the Python desktop app:

```
../forge_calculator/data/
├── ores.json        # 140 ores with stats, categories, formulas
├── weapons.json     # 79 weapons with base damage, type, speed
├── races.json       # 16 races with bonuses
├── runes.json       # 47 runes with effects
└── achievements.json # 16 achievements
```

These files are copied/served alongside the web app. The `js/data/loader.js` fetches them at runtime.

## Architecture Notes

- **ES Modules** — `type="module"` on script tag, all imports/exports are static.
- **No framework** — Components are plain classes with a `render()` method returning a DOM node.
- **Event bus** — `utils/events.js` for loose coupling (e.g., input changes → recalc).
- **Single calculation entry** — `engine/index.js:calculate(build)` mirrors Python's `engine.calculate()`.
- **Responsive** — CSS Grid/Flex with breakpoints at 640px, 1024px, 1440px.

## Browser Support

- Chrome/Edge 89+, Firefox 78+, Safari 15+ (ES modules, optional chaining, nullish coalescing)
- No transpilation needed for modern browsers.

## Development

No build tools. Edit files, refresh browser.

To add a new ore/weapon/race: update the JSON in `../forge_calculator/data/`, restart the local server.

## License

Same as the main project (see root `LICENSE`).