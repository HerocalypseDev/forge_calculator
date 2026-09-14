# Extended.xlsx Diff Report

Comparison of `reference/Extended.xlsx` (new) against `reference/reall.xlsx` (current
authoritative workbook), plus a check of every logic change against the three engines
(`forge_calculator/engine.py`, `Web/mediawiki/MediaWiki-ForgeCalculator.js`, retired
`Web/js/engine/*.js`). Sheet structure is identical (`DPS Calculator`, `_Weapon`,
`_OptionsCrafter`, `_Options`, `IGNORE REF CALC`), and `_Weapon` / `_OptionsCrafter` /
`_Options` are **byte-identical** cell-for-cell — no ore, weapon, race, rune, or
achievement data changed. All real changes live in `DPS Calculator`. `IGNORE REF CALC`
also changed (weapon names in `L3:L13`) but that sheet is explicitly unused ("ignore"
per `CLAUDE.md`).

## 1. Cosmetic-only changes (sample/default build, not logic)

These cells hold the workbook's own example build — changing them does not change any
formula or constant. No engine action needed.

| Cell(s) | Old sample | New sample |
|---|---|---|
| `D7`, `D9` | ore slot 2/4 weights 20 / 0 | 15 / 15 |
| `C9` | `Select Ore` | `Supermassive Black Hole` |
| `C12` / `D12` | `Straight Sword` / `Hook Blade` | `Colossal Sword` / `Excalibur` |
| `C22` | `Archangel` | `Human` |
| `C85` | `Attack Speed +20%` | `None` |
| `C42` / `C43` / `C44` | 0.7 / 0.4 / 0.8 | 0 / 0 / 0 |
| `E22` (array formula, race blurb) | `Physical Damage +20%, Attack Speed +20%` | `N/A` (follows the `C22` change) |

## 2. Real formula/logic changes

### 2.1 Rune grid: 3×2 → 3×3 (C27:E29, was C27:D29)

`A27`–`A31` (lethality / crit chance / crit dmg / the two atk-speed cells) each grew a
third `SEARCH(...)` term per row, now scanning `C27,D27,E27 / C28,D28,E28 / C29,D29,E29`
instead of just `C·,D·`. The rune pool (`_Options` sheet) is unchanged — this is purely
a third input column, not a new rune type.

**Engine status: already correct, no change needed.**
`Web/mediawiki/MediaWiki-ForgeCalculator.js`'s `createRuneSelector` already builds a
**3×3** grid (`for line<3`, `for col<3`, `current` sized 9,
`DEFAULT_BUILD.runes` is `[NONE_LABEL]×9`), and `runeTotals()` loops generically over
whatever array it's given — so it already sums all 9 cells exactly like the new `A27`–
`A31`. `forge_calculator/engine.py`'s `rune_totals()` is likewise a generic loop, so it
tolerates any array length (proven by `fuzz_gen.py`, which already generates 1–4 random
rune entries, not a fixed 6). The retired standalone `Web/js/components/RuneSelector.js`
is hard-coded to `RUNE_SLOT_COUNT = 6` — out of scope since `Web/js` is retired.

**Docs are stale, not code.** `CLAUDE.md`'s UI-invariants section and the "UI Label /
Validation / Placeholder / Layout Overhaul" plan both describe the rune grid as
"3 lines × 2 slots (C27/D27–C29/D29, 6 fixed cells)". The shipped MediaWiki code is
already 3×3/9 cells — the doc text should be corrected to match the code (and now also
matches the new workbook), not the other way around.

### 2.2 `E45`: Felynx + Gauntlet(s) — dead branch now reachable

Old: `IFS(AND(C22="Felynx",C23="Gauntlet"), 20%, ...)` — singular "Gauntlet", which
`C23`'s dropdown never offers (approved deviation #4), so this branch could never fire
in the sheet.
New: `IFS(AND(C22="Felynx",C23="Gauntlets"), 20%, ...)` — plural, matching `C23`'s
actual options and matching `E48`'s existing check. The branch is now genuinely
reachable in the workbook.

**Engine status: already correct, no change needed.** All three engines' `CLASS_LETHALITY`
tables already register **both** spellings (`("Felynx","Gauntlet")` and
`("Felynx","Gauntlets")` → 0.20) defensively, per the existing approved-deviation
write-up. Since the new workbook only ever supplies "Gauntlets", the doubled entry is
harmless and already gives the right answer.

**Doc update needed:** approved deviation #4 in `CLAUDE.md` should note this is now
fixed at the source for `E45`; it's no longer a deviation from the workbook, just a
historical note on why both spellings are registered.

### 2.3 `C48` (ore attack-speed ramp) restored as a live formula

Old `reall.xlsx`: `C48` was a bare `0.0` input cell (the ramp had been deleted — this is
approved deviation #1, worked around by reading `new.xlsx`'s `C48` via
`LEGACY_STAT_CELLS`).
New `Extended.xlsx`: `C48` is a full `IFS(...)` ramp again (Yeti Heart 1→10%, Tiger's
Eye 0.75→7.5%, Wolfarite 0.8→8%, Fierce Jade 1.5→15%, all over `$D$6:$D$9`).

**Engine status: already correct — the constants match exactly.** `new.xlsx`'s legacy
`C48` used the same four ores and the same ramp endpoints, just summed over
`$D$6:$D$10` (an extra 5th slot `new.xlsx` still had). `Extended.xlsx`'s restored `C48`
uses `$D$6:$D$9` (4 slots), matching the current 4-slot engine model exactly. No numeric
change.

**Doc update needed:** approved deviation #1 is now moot for `Extended.xlsx` — the
formula lives in the workbook itself again, so once `Extended.xlsx` becomes
authoritative, `new.xlsx`/`LEGACY_STAT_CELLS` can be retired and `C48` parsed normally
like every other stat cell.

### 2.4 `E54` gets a `MIN(200%, …)` cap — but it's a dead cell

Old: `E54 = C54 + IF(C22="Minotaur",30%,0)`, uncapped.
New: `E54 = MIN(200%, C54 + IF(C22="Minotaur",30%,0))`.

This looks like approved deviation #5 ("Berserk is capped at 200% total, MediaWiki JS
only") landing in the source workbook. **But it doesn't actually cap anything real**: a
full-workbook reference search shows **no formula on `DPS Calculator` reads `E54`** —
neither `C97` (Total Berserk DPS) nor `C98` (Moon Stone DPS) touch it; `C97` recomputes
`C54 + IF(Minotaur,30%,0)` inline (see 2.5) without ever going through the capped `E54`.
`E54` is purely a display/summary cell.

**This is a genuine discrepancy worth flagging, not just a doc update:**
- `MediaWiki-ForgeCalculator.js` line ~693 computes
  `berserkLevel = Math.min(build.berserk + RACE_BERSERK[...], CAPS.berserk /* 2.0 */)`
  and uses that **capped** value to compute the actual `berserk` DPS output — i.e. the
  MediaWiki engine's cap changes real output, unlike the new workbook where the
  equivalent cap sits on a cell nothing consumes.
- `forge_calculator/engine.py` and the retired `Web/js/engine/dps.js` do **not** cap
  `berserk_level` at all — which, by coincidence, is what now actually matches the new
  workbook's real (uncapped) `C97` math more closely than the MediaWiki JS does.
- In practice this is still inert today: MediaWiki's UI caps the manual berserk input at
  150%, and Minotaur only adds 30%, so the highest total either engine can reach (180%)
  never hits the 200% ceiling either way. But it's no longer accurate to describe the
  MediaWiki cap as "matching an uncapped sheet's intent" — the sheet now has a cap too,
  it just doesn't do anything.

### 2.5 `C97` (Total Berserk DPS) now includes the Minotaur bonus inline

Old: `C97 = ((E19 * (1 + C54)) * E21) + SUM(C90:C94) + E94` — bare `C54`, no race term
(approved deviation #2: "Minotaur reaches Berserk DPS... the engines use E54").
New: `C97 = ((E19 * (1 + C54 + IF(C22="Minotaur",30%,0))) * E21) + SUM(C90:C94) + E94`.

**Engine status: already correct.** All three engines already add
`RACE_BERSERK.get(build.race, 0.0)` (Minotaur → +30%) to the manual `build.berserk`
input for this exact multiplier, per approved deviation #2. The new workbook formula is
uncapped, same as `engine.py`/`Web/js`; see 2.4 for the one place (MediaWiki JS) this now
diverges.

**Doc update needed:** approved deviation #2 is resolved at the source in
`Extended.xlsx`; keep the note only as history for why the term is `RACE_BERSERK`-aware.

### 2.6 `C64` — the long-open fire-duration bug is fixed

`CLAUDE.md` has documented, since the reall.xlsx realignment, that `C64` read `C37` (the
Blast row's *DMG* cell) instead of `E34` (Fire's own *Time* cell) — listed under "Still
open in the sheet (reported, not worked around)".

New `Extended.xlsx`: every occurrence of `C37` inside `C64`'s formula is now `E34`.

**Engine status: already correct, no change needed.** All three engines already read
`build.abilities.fire_time` (the `E34` reading) for this term — that was a deliberate
engine-side correction of the known bug. The new workbook now agrees with the engines
verbatim, so this stops being a documented deviation and becomes a plain match.

**Doc update needed:** remove the "Still open in the sheet" note in `CLAUDE.md`'s
Preserved-quirks section — it's fixed in `Extended.xlsx`.

### 2.7 `C101` (Max Burst) lightning term fixed

Old: `...+C72*C18+C76*C18+C80` — bare `C80` (raw lightning % ), approved deviation #3.
New: `...+C72*C18+C76*C18+C18*C80*C81*E21` — full proc-rate expression, matching how
every other proc scales.

**Engine status: already correct, no change needed.** All three engines already compute
this term as `C18*C80*C81*E21` per approved deviation #3. `Extended.xlsx` now matches
verbatim.

**Doc update needed:** approved deviation #3 is resolved at the source; keep only as
history.

### 2.8 `A30` — cosmetic display bug, no engine impact

`A30` (feeds only the `C30` "Total" summary string, e.g. "12.0% Leth +…% AS") had its
search text changed from `"Atk Speed"` to `" Atk Speed "` (padded with spaces on both
sides). Rune pool strings are formatted like `"Atk Speed +5%"` — no leading space — so
`SEARCH(" Atk Speed ", …)` can never match, meaning `A30` now always evaluates to 0.
The cell that actually feeds the real stat (`E48`, attack-speed total) is `A31`, whose
search text (`"Atk Speed"`, unpadded) was **not** changed and still works correctly.

**No engine action** — `A30` isn't referenced anywhere except that cosmetic summary
string, which MediaWiki's UI doesn't render. Purely a workbook authoring slip, worth
flagging to whoever owns the sheet but harmless to every calculator.

## 3. Summary table

| # | Change | Was it an approved deviation? | Engine action needed |
|---|---|---|---|
| 2.1 | Rune grid 3×2 → 3×3 | No (new) | None — MediaWiki JS + Python already generic/9-wide |
| 2.2 | `E45` Gauntlet→Gauntlets | Deviation #4 | None — both spellings already registered |
| 2.3 | `C48` ramp restored | Deviation #1 | None — constants already match `new.xlsx` |
| 2.4 | `E54` capped (dead cell) | Deviation #5 | **Flag only** — MediaWiki JS caps real output, workbook's cap doesn't; harmless today, worth a decision |
| 2.5 | `C97` adds Minotaur inline | Deviation #2 | None — already added via `RACE_BERSERK` |
| 2.6 | `C64` reads `E34` not `C37` | Documented open bug | None — engines already used `E34` |
| 2.7 | `C101` lightning term fixed | Deviation #3 | None — engines already use the full term |
| 2.8 | `A30` display-only regression | — | None — cell unused by any engine |

**Net result: zero required code changes.** Every numeric behavior change in
`Extended.xlsx` either (a) is cosmetic sample data, or (b) is the workbook catching up to
a fix the engines already carried as a documented "approved deviation." The one loose
end is 2.4 — a decision on whether MediaWiki's berserk cap should keep clamping real
output even though the workbook's own cap doesn't.

## 4. Recommended follow-ups

1. **Decide whether `Extended.xlsx` becomes the new authoritative workbook.** If so, it
   should be renamed/promoted the same way `new.xlsx` → `reall.xlsx` was, `build_data.py`
   rerun, `data/*.json` + `Web/mediawiki/Data-*.json` refreshed, and all four
   verification harnesses (`reall-golden.js`, `reall-aggregates.js`, `verify-engine.js`,
   `fuzz_verify.js`) rerun against it.
2. **Update `CLAUDE.md`:**
   - Approved deviations #1, #2, #3, #4 are resolved at the source in `Extended.xlsx` —
     reword as historical notes rather than live deviations.
   - The "Still open in the sheet" `C64`/`C37` note is fixed — remove it.
   - The "Rune 3×2 grid" UI-invariant and plan-table description is stale — it's 3×3/9
     cells in the shipped MediaWiki code already; correct the doc.
   - `LEGACY_STAT_CELLS`/`new.xlsx` dependency becomes removable once `Extended.xlsx`
     ships (its `C48` is self-contained).
3. **Resolve the `E54` berserk-cap question (2.4)** — either drop the MediaWiki-JS-only
   200% cap (since the source workbook's cap is provably inert) or keep it as a
   deliberate MediaWiki-only safety clamp, and update the approved-deviation text to say
   so accurately either way.
