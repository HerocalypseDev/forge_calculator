# Forge Calculator — MediaWiki Deployment Guide

Deploys the Forge Calculator to a Miraheze MediaWiki. The calculator is
data-driven: the JS module fetches five flat JSON pages, the styles come from a
TemplateStyles sheet, and the page itself is a transcludable template.

## Artifact → wiki page map

| Local file (`Web/mediawiki/`) | Wiki page | How to upload |
|-------------------------------|-----------|---------------|
| `Data-Ores.json` | `Data:Ores.json` | Paste raw JSON as the page content |
| `Data-Weapons.json` | `Data:Weapons.json` | Paste raw JSON as the page content |
| `Data-Races.json` | `Data:Races.json` | Paste raw JSON as the page content |
| `Data-Runes.json` | `Data:Runes.json` | Paste raw JSON as the page content |
| `Data-Achievements.json` | `Data:Achievements.json` | Paste raw JSON as the page content |
| `Template-ForgeCalculator-styles.css` | `Template:ForgeCalculator/styles.css` | Paste raw CSS as the page content (TemplateStyles requires it be a `/styles.css` subpage) |
| `Template-ForgeCalculator.wikitext` | `Template:ForgeCalculator` | Paste the wikitext verbatim |
| `MediaWiki-ForgeCalculator.js` | `MediaWiki:ForgeCalculator.js` | Paste the file contents as the page content |
| `forge-calculator.common.js` | `MediaWiki:Common.js` | **Append** the file contents (a single `importScript(...)` line) to the end of the existing page |

## Prerequisites

- **JsonConfig** extension with a `Data:` namespace configured (Miraheze enables
  this by default) so `Data:*.json` pages are served as JSON.
- **TemplateStyles** extension (Miraheze default) for the scoped CSS.
- Interface-editor rights for `MediaWiki:ForgeCalculator.js` and `MediaWiki:Common.js` (admin/bureaucrat).

## Step-by-step

### 1. Upload the five data pages

For each file, create the `Data:` page with the file's contents as the entire
page body (no `<pre>`, no wrapping wikitext). The page body must be valid JSON
as-is.

The JS loader tries, in order: `action=query&prop=revisions` (standard API),
`action=jsondata` (JsonConfig), then `action=raw` (plain fetch). As long as the
page body is raw JSON, at least one of the three will succeed.

Expected shapes (validation counts are enforced at runtime by
`validateData()` and mismatches are only logged, not fatal):

| Page | Content | Expected counts |
|------|---------|-----------------|
| `Data:Ores.json` | `{source, select_ore, formula_only_ores[], ores[140]}` | 140 ores |
| `Data:Weapons.json` | `{source, types[10], race_bonus_types[5], weapons[79]}` | 79 weapons |
| `Data:Races.json` | `{source, trait_headers[15], races[16]}` | 16 races |
| `Data:Runes.json` | `{source, none, runes[47]}` | 47 runes |
| `Data:Achievements.json` | `{source, achievements[16]}` | 16 achievements |

### 2. Upload the TemplateStyles sheet

Create `Template:ForgeCalculator/styles.css` with the full contents of
`Template-ForgeCalculator-styles.css`. Do not change anything — the CSS is
already scoped under `.fc-calculator`, so it cannot leak into other page styles.

> **TemplateStyles sanitizer:** all color/layout values are inlined as literals
> because the TemplateStyles sanitizer does not support CSS custom properties
> (`--fc-*`) or `var(...)`. Do not reintroduce them — the sanitizer strips them
> and the theme silently collapses to default styling.

### 3. Create the template page

Create `Template:ForgeCalculator` with the exact contents of
`Template-ForgeCalculator.wikitext`. It transcludes the stylesheet and renders a
`<div class="fc-calculator" id="fc-root">` shell that the JS mounts into.

Transclude it on any article with `{{ForgeCalculator}}`.

### 4. Upload the calculator JS module

Create `MediaWiki:ForgeCalculator.js` with the full contents of
`MediaWiki-ForgeCalculator.js` as the page body. It is a self-contained IIFE
with its own `window.FC_CALCULATOR_LOADED` guard, so it is safe even if the page
already contains other code. Save.

### 5. Import it from MediaWiki:Common.js

Open `MediaWiki:Common.js` in edit mode and append the single line

```js
importScript('MediaWiki:ForgeCalculator.js');
```

at the end of the page. Save. The calculator script is then fetched and run in
the same global scope as Common.js (shared `mw`, jQuery, and hooks), so the
behaviour is identical to inlining it — the split is purely organisational.
Because the script runs asynchronously, keep it self-contained: it must not call
functions defined in Common.js.

The module mounts only when it finds an element with `id="fc-root"`, so it is a
no-op on every page that does not transclude the template.

### 6. Upload the section-icon PNGs

Upload **11 PNG icons** to the wiki with these exact filenames:

| Icon | Filename | Used in |
|------|----------|---------|
| Weapon | `ForgeCalculator-weapon.png` | Weapon section |
| Ore | `ForgeCalculator-ore.png` | Ore Slots section |
| Race | `ForgeCalculator-race.png` | Race section |
| Berserk | `ForgeCalculator-berserk.png` | Berserk section |
| Achievement | `ForgeCalculator-achievement.png` | Achievement section |
| Rune | `ForgeCalculator-rune.png` | Runes section |
| Armor | `ForgeCalculator-armor.png` | Armor Stats section |
| Ability | `ForgeCalculator-ability.png` | Abilities (fallback icon) |
| Fire | `ForgeCalculator-fire.png` | Fire ability card |
| Blast | `ForgeCalculator-blast.png` | Blast ability card |
| Poison | `ForgeCalculator-poison.png` | Poison ability card |

The JS builds each `<img>` src from the wiki's own path
(`Special:Redirect/file/<name>`), so no URL or hash path needs to be written
down — just use the exact filename above. The 20px display size is set by
`width`/`height` attributes; upload any source resolution and the browser scales
it down. If a file is missing, its section falls back to the `ability` icon; if
you rename any file, update `SECTION_ICON_URLS` in `MediaWiki-ForgeCalculator.js`.

## Verification

Run this locally before deploying (from `Web/mediawiki/`, with the Python
engine on the `PYTHONPATH`):

```bash
# 1. Golden cross-checks against tests/test_golden.py (9 hand-computed builds)
node verify-engine.js          # → ALL GOLDEN CHECKS PASSED

# 2. Differential fuzz against the Python engine (250 random builds)
PYTHONPATH="C:\Users\USER\OneDrive\Documents\forge_calculator" \
  python fuzz_gen.py           # regenerates fuzz-cases.json if data changed
node fuzz_verify.js            # → DIFFERENTIAL FUZZ PASSED ✓

# 3. Runtime data shape sanity
python -m json.tool Data-Ores.json > /dev/null   # valid JSON for each file
```

On-wiki checklist (after deploying, in a sandbox page or `Special:BlankPage`):

| Step | Expect |
|------|--------|
| Load a page transcluding `{{ForgeCalculator}}` | Calculator renders; no console errors |
| Search a weapon / ore / race name | Dropdown filters as you type; Enter selects |
| Change quality or enhancement | Results update in real time |
| Click Copy | Results copied to clipboard (clipboard requires HTTPS — Miraheze provides it) |
| Narrow window to ≤520px | Layout stacks into a single column |
| View in dark mode | Text remains readable (dark palette inlined) |

## Troubleshooting

- **"Failed to load calculator data"** — a `Data:` page is missing or its body is
  not raw JSON. Confirm all five pages exist and start with `{`.
- **Counts are off by a few ores/weapons** — the engine still runs; a mismatch is
  logged to the console (search for `Forge Calculator: data count drift`). Update
  `EXPECTED_COUNTS` in the JS module or the data page and re-push.
- **Styles look unstyled** — the `<templatestyles>` tag must reference
  `Template:ForgeCalculator/styles.css` exactly (the template page already does).

## Maintenance

- Data updates: regenerate `Web/data/*.json` via `python -m scripts.build_data`,
  copy into `Web/mediawiki/Data-*.json`, re-run `fuzz_gen.py` +
  `fuzz_verify.js`, then re-paste the five `Data:` pages.
- Engine or UI changes: edit `MediaWiki-ForgeCalculator.js`, re-run
  `verify-engine.js` + `fuzz_verify.js`, then re-paste into
  `MediaWiki:ForgeCalculator.js` (Common.js only holds the `importScript` line and
  never changes).
- CSS changes: edit `Template-ForgeCalculator-styles.css`, then re-paste into
  `Template:ForgeCalculator/styles.css`.

## Source files (read-only references)

- `verify-engine.js` — Node harness that evaluates the real calculator IIFE
  (`MediaWiki-ForgeCalculator.js`) in a `vm` sandbox with browser mocks and runs
  the golden assertions.
- `fuzz_gen.py` — deterministic random-build generator (Python engine).
- `fuzz_verify.js` — differential comparator (JS engine vs Python results).
- `fuzz-cases.json` — generated corpus (250 builds); do not hand-edit.
