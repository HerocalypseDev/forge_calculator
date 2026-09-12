# Forge Calculator: JS Engine vs new.xlsx Workbook Formula Comparison Report

## Overview
This report compares the standalone JavaScript engine (`Web/js/engine/*.js`) formulas against the formulas in the updated workbook (`reference/new.xlsx`). The analysis is based on the spreadsheet update analysis provided in `reference/SPREADSHEET_UPDATE_ANALYSIS.md` and direct formula extraction from the workbook.

## Key Changes in new.xlsx (Summary from SPREADSHEET_UPDATE_ANALYSIS.md)

### Major Formula Changes:
1. **E10 (Average Ore Power)**: Now excludes Fichilliumorite from weighted average.
2. **Ore Power Scaling System (I6-L9)**: New system for displaying partial traits at 10-30% ore share.
3. **Weapon Auto-Select (F12-F21)**: New system to suggest weapon type based on total ore amount.
4. **Armor Bonus Section (C42-E48)**: Restructured with manual inputs for armor bonuses.
5. **Stat Totals Shifted**: All stat total formulas shifted down 1 row (E44→E45, etc.).
6. **Berserk Formula**: Changed from additive to multiplicative with lethality.
7. **Lightning DPS Section (C80-E81)**: New 7th DPS component.
8. **Achievement Cell**: Shifted from C80 to C85.
9. **DPS Results Shifted**: All DPS components shifted down 5 rows to accommodate new sections.
10. **Max Burst DPS (C101)**: Now includes Lightning DPS term.
11. **Smite (Archangel)**: Now scales with attack speed instead of flat bonus.
12. **Poison Duration (C69)**: Now uses FIRST Malachite slot only (XLOOKUP) instead of MAX.
13. **Black Hole DPS (E77)**: References empty C82 (Black Hole Radius multiplier) - currently zero.

## Detailed Comparison: JS Engine vs new.xlsx

### 1. Average Ore Power (E10)
- **Workbook**: `=IFERROR(IFERROR(SUMPRODUCT(D6:D9, E6:E9, (C6:C9<>"Fichilliumorite")*1) / SUMIFS(D6:D9, C6:C9, "<>Fichilliumorite"), AVERAGEIFS(E6:E9, C6:C9, "<>Fichilliumorite")), 1)`
- **JS Engine**: 
  - `avgOrePower` function in `formulas.js` does **not** implement the Fichilliumorite exclusion.
  - Current implementation: standard weighted average without exclusion.
- **Difference**: JS engine does not exclude Fichilliumorite from weighted average.
- **Impact**: Builds using Fichilliumorite will have lower effective ore power in JS engine than in workbook.

### 2. Weapon Base Damage (A18, C18)
- **Workbook**:
  - A18: `=IFERROR(VLOOKUP(D12,'_Weapon'!$C$2:$E$81,3,0)*E10*(1+E12/100),1)`
  - C18: `=IFERROR(VLOOKUP(D12,'_Weapon'!$C$2:$E$81,3,0)*E10*SWITCH(C13,0,1,1,1.05,2,1.1,3,1.15,4,1.2,5,1.25,6,1.3,7,1.35,8,1.4,9,1.5,1)*(1+E12/100),1)`
- **JS Engine**:
  - `weaponBases` function in `formulas.js`:
    ```javascript
    export function weaponBases(weapon, avgPower, quality, forgeLevel) {
      if (!weapon) return [1.0, 1.0];
      const base = weapon.damage * avgPower * (1 + quality / 100.0);
      return [base, base * forgeMultiplier(forgeLevel)];
    }
    ```
- **Difference**: None. The JS engine correctly implements the weapon base damage formulas.
- **Note**: The JS engine uses the normalized `avgPower` (which currently lacks Fichilliumorite exclusion) and the same forge multiplier SWITCH.

### 3. Stats (E44-E48) - Lethality, Crit Chance, Crit DMG, Atk Speed
- **Workbook Formulas** (from extracted formulas, note shifted rows):
  - **C45 (Lethality)**: Complex IFS with ore-specific formulas + race/class/achievement bonuses + armor bonus (C44)
  - **C46 (Crit Chance)**: IFS with ore-specific formulas + achievement bonus
  - **C47 (Crit DMG)**: IFS with ore-specific formulas + armor bonus (C43)
  - **C48 (Atk Speed)**: IFS with ore-specific formulas + race/class bonuses + achievement bonus
- **JS Engine**:
  - `stats.js` implements:
    - `oreStatSum`: sums share-scaled ore contributions for each stat
    - `statTotals`: adds armor, rune, base, race, class, and achievement bonuses, then applies caps
- **Difference**:
  - The JS engine correctly sums contributions from ores, runes, armor, race, class, and achievements.
  - However, the JS engine does **not** implement the per-ore IFS formulas exactly as in the workbook for each stat. Instead, it uses a generic `shareScaling` function based on each ore's stat ranges.
  - **Verification Needed**: Do the ore stat ranges in the JS data match the per-ore formulas in the workbook?
- **Impact**: If the ore stat ranges in `data/*.json` match the workbook's per-ore formulas, then the results should be identical. Any mismatch in data will cause differences.

### 4. Proc Components (C52-C76)
- **Workbook**:
  - Moon (C53): IFS per ore
  - Explosion DMG (C58): IFS per ore + blast_dmg (E34)
  - Explosion Chance (C59): MAX of (per-ore IFS, blast_chance (E35))
  - Fire DMG (C62): IFS per ore + race fire dmg + fire_dmg (E34)
  - Fire Chance (C63): MAX of (per-ore IFS, fire_chance (E35)) + race fire chance
  - Fire Duration (C64): `MAX( MAX(ore terms, race time, ability time) - 1, 0 )`
  - Poison DMG (C67): IFS per ore + poison_dmg (D34)
  - Poison Chance (C68): MAX of (per-ore IFS, poison_chance (D35))
  - Poison Duration (C69): `MAX(0, MAX( FIRST Malachite slot duration, poison_time (E35) ) - 2 )` [Note: uses FIRST slot only via XLOOKUP]
  - Smite DMG (C72): IFS per ore + race smite dmg (with special handling for Kitsunite: MIN(5%, MAX(50%)))
  - Smite Chance (C73): MAX of (per-ore IFS, race smite chance)
  - Black Hole DMG (C76): IFS per ore
  - Black Hole Chance (C77): `=IF(COUNTIF(C6:C9, "Galaxite")/COUNTA(C6:C9)>=0.1, 0.3, 0)`
- **JS Engine**:
  - `procs.js` implements:
    - `slotVals`, `slotMax`, `slotSum`, `firstSlotVal` helpers
    - `procComponents` function that:
      - Sums ore contributions for each stat (moon, explosion_dmg, etc.)
      - Adds ability inputs (blast_dmg, fire_dmg, etc.) where appropriate
      - Uses `MAX` for explosion_chance, fire_chance, poison_chance, smite_chance
      - For fire_duration: uses `_duration` helper with `minus=1` on aggregated fire_terms + race time + ability time
      - For poison_duration: uses `_duration` helper with `minus=2` on **first Malachite slot only** + ability time
      - For blackhole_chance: implements the COUNTIF/COUNTA formula correctly
- **Differences**:
  1. **Explosion DMG**: JS engine adds `build.abilities.blast_dmg` to the sum - matches workbook (+E34).
  2. **Explosion Chance**: JS engine uses `Math.max(slotMax(...), build.abilities.blast_chance)` - matches workbook (MAX(...,E35)).
  3. **Fire DMG**: JS engine adds race fire dmg and `build.abilities.fire_dmg` - matches workbook (+C34).
  4. **Fire Chance**: JS engine uses `Math.max(slotMax(...), build.abilities.fire_chance) + race fire chance` - matches workbook (MAX(...,C35)+0.4).
  5. **Fire Duration**: JS engine aggregates all fire_terms (from ores) then applies `_duration(..., minus=1)` - this is **NOT** the same as the workbook.
     - Workbook: `MAX( IFS(...) - 1, 0 )` per ore, then takes the MAX? Actually, looking at the workbook, fire duration (C63) is:
       `=MAX( IFS(C6="Gargantuan", ...), IFS(C7="Gargantuan", ...), ... ) - 1` but clamped at 0.
     - JS engine: sums the fire_terms (which are share-scaled per ore) then applies the duration formula once.
     - **This is a difference**. The workbook calculates the duration per ore slot, then takes the maximum? Let's re-examine.
  6. **Poison Duration**: JS engine uses `firstSlotVal` for Malachite - matches workbook (FIRST slot only).
  7. **Smite DMG**: JS engine sums ore contributions and adds race smite dmg. **Does not implement the Kitsunite special cap** (MIN(5%, MAX(50%))).
  8. **Smite Chance**: JS engine uses `Math.max(slotMax(...), RACE_SMITE_CHANCE[build.race])` - matches workbook.
  9. **Black Hole DMG**: JS engine sums ore contributions - matches workbook.
  10. **Black Hole Chance**: JS engine implements the formula correctly - matches workbook.
  11. **Blast**: Handled in explosion dmg/chance as above.

### 5. DPS Components (C84-C94, E94)
- **Workbook**:
  - C89 (Physical Hit DPS): `=C18*(1+E45)*(MIN(C20+E46,1)*(C21+E47)+(1-MIN(C20+E46,1)))*E21`
  - C90 (Explosion DPS): `=E59` [which is `=A18*C58*C59*E21`]
  - C91 (Fire DoT DPS): `=E63` [which is `=IF(E21=0,0,A18*C62*MIN(1,C63*E21*MIN(C64,5)))`]
  - C92 (Poison DoT DPS): `=E68` [similar to fire]
  - C93 (Smite DPS): `=E73` [which is `=A18*E21*C72*MIN(C73,1)`]
  - C94 (Black Hole DPS): `=E77` [which is `=E13*C77*C76*MAX(1,E21)` - **BUG: C76 is empty**]
  - E94 (Lightning DPS): `=E81` [which is `=IFERROR(E13 * C80 * C81 * MIN(E21, 1/E80), 0)`]
  - C96 (Total Average DPS): `=C89+C90+C91+C92+C93+C94+E94`
  - C97 (Berserk DPS): `=((E19 * (1 + C54)) * E21) + SUM(C90:C94) + E94` [Note: multiplicative with lethality]
  - C98 (Moon Stone DPS): `=IF(C53=0, C96, (C89 * (1 + C53)) + C90 + C91 + C92 + C93 + C94 + E94]`
  - C100 (Min DPS): `=C18*(1+E45)*E21`
  - C101 (Max Burst DPS): `=C18*(1+E45)*(C21+E47)*E21+C18*C58*E21+C18*C62+C18*C67+C72*C18+C76*C18+C80`
- **JS Engine**:
  - `dps.js` implements:
    - `weapon_dps`: `forged * (1 + totals.lethality) * blend * atkRate`
    - `explosion_dps`: `unforged * procs.explosion_dmg * procs.explosion_chance * atkRate`
    - `fire_dps`: `atkRate ? unforged * procs.fire_dmg * Math.min(1, procs.fire_chance * atkRate * Math.min(procs.fire_duration, 5)) : 0.0`
    - `poison_dps`: similar to fire
    - `smite_dps`: `unforged * atkRate * procs.smite_dmg * Math.min(procs.smite_chance, 1)`
    - `blackhole_dps`: `unforged * procs.blackhole_dmg * procs.blackhole_chance * atkRate`
    - `lightning_dps`: Not implemented in the provided JS engine files! (We see references to lightning in the workbook but not in the JS engine we examined)
    - `total_dps`: sum of all 6 components (missing lightning)
    - `berserk`: calculated as `(explosion_dps + fire_dps + poison_dps + smite_dps + blackhole_dps) + forged * (1 + lethBoosted) * blend * atkRate` where `lethBoosted = Math.min(totals.lethality + berserkLevel, CAPS.lethality)`
    - `moonstone`: `procs.moon !== 0 ? weapon_dps * (1 + procs.moon) : null`
    - `min_dps`: `forged * (1 + totals.lethality) * atkRate`
    - `max_dps`: `forged * (1 + totals.lethality) * (build.base_crit_dmg + totals.crit_dmg) * atkRate + forged * procs.explosion_dmg * atkRate + forged * procs.fire_dmg + forged * procs.poison_dmg + procs.smite_dmg * forged + procs.blackhole_dmg * forged`
    - `ttk_25k`/`ttk_75k`: `25000/total_dps` etc.
- **Differences**:
  1. **Missing Lightning DPS**: The JS engine we examined does **not** include lightning DPS in the calculation. This is a major discrepancy.
  2. **Berserk Formula**: 
     - Workbook: `=((E19 * (1 + C54)) * E21) + SUM(C90:C94) + E94`
       - This is: `(unforged * (1 + E45) * (1 + C54) * E21) + sum(proc dps) + lightning_dps`
       - Note: `(1 + E45)` is `(1 + lethality total)`, and `(1 + C54)` is `(1 + berserk bonus)`
       - So: `unforged * (1 + lethality) * (1 + berserk) * E21 + sum(proc dps) + lightning_dps`
       - But wait, the workbook uses `E19` which is `=C18*(1+E45)*(MIN(C20+E46,1)*(C21+E47)+(1-MIN(C20+E46,1)))` - the unforged DPS with crit.
       - Actually, looking again: `E19` is the unforged DPS with crit (column D19 in the workbook is "Avg DMG per Hit (with crit)").
       - So the workbook berserk formula is: `(unforged DPS with crit) * (1 + berserk bonus) * E21 + sum(proc dps) + lightning_dps`
       - Which simplifies to: `unforged * (1 + lethality) * crit_blend * (1 + berserk) * E21 + sum(proc dps) + lightning_dps`
  - JS engine: 
      - `lethBoosted = Math.min(totals.lethality + berserkLevel, CAPS.lethality)`
      - `berserk = explosion_dps + fire_dps + poison_dps + smite_dps + blackhole_dps + forged * (1 + lethBoosted) * blend * atkRate`
      - This is: `sum(proc dps) + forged * (1 + min(lethality+berserk, 1.5)) * crit_blend * atkRate`
      - Note: uses **forged** damage, not unforged, and applies the berserk boost to lethality before multiplying by crit_blend and forge.
      - This is **different** from the workbook.
  3. **Black Hole DPS**: JS engine uses `unforged * procs.blackhole_dmg * procs.blackhole_chance * atkRate` which matches the workbook structure, but note the workbook has `=E13*C77*C76*MAX(1,E21)` where `E13 = A18` (unforged base damage) and `MAX(1,E21)` is strange (should be just `E21`?). 
     - Actually, `MAX(1,E21)` in the workbook ensures at least 1 hit/sec? But `E21` is hits/sec, so it should be just `E21`. This might be a typo in the workbook.
     - However, the JS engine correctly uses `atkRate` which is hits/sec.
  4. **Lightning DPS**: Missing entirely from JS engine.

### 6. Normalization
- **JS Engine**: Includes `normalize.js` that coerces missing/invalid fields to 0 (except base_crit_dmg defaults to 1.45).
- **Workbook**: Treats blank cells as 0 implicitly.

## Specific Issues Found in JS Engine vs Workbook

### Confirmed Differences:
1. **Ore Power Average (E10)**: JS engine does not exclude Fichilliumorite from weighted average.
2. **Lightning DPS**: Missing from JS engine calculations.
3. **Berserk Calculation**: JS engine uses forged damage and applies berserk as a lethality boost before crit blend, while workbook uses unforged DPS with crit and applies berserk as a separate multiplier after crit blend.
4. **Smite DMG for Kitsunite**: JS engine does not implement the special cap (MIN(5%, MAX(50%))).
5. **Fire Duration Calculation**: JS engine aggregates ore contributions before applying duration formula, while workbook appears to calculate per-ore then take max (needs verification).
6. **Black Hole Radius (C82)**: Workbook references an empty cell C82, making Black Hole DPS zero. JS engine does not have this issue as it doesn't reference such a cell, but the formula is structurally correct.

### Verification Needed:
- Compare the ore stat ranges in `data/*.json` with the per-ore formulas in the workbook to ensure the `shareScaling` approach yields identical results.
- Examine the exact fire duration formula in the workbook to confirm whether it's per-ore max or aggregated.

## Impact on Builds

### Builds Affected by Missing Lightning DPS:
- Any build using Kitsunite or Marblite will have lower total DPS in JS engine than in workbook.

### Builds Affected by Berserk Difference:
- High lethality + high berserk builds will differ significantly due to:
  - JS using forged vs workbook using unforged as base
  - JS applying berserk to lethality before crit blend vs workbook applying after
  - Example: 100% lethality + 50% berserk
    - Workbook: `(1+1.0) * (1+0.5) = 3.0` multiplier on unforged DPS with crit
    - JS: `(1 + min(1.0+0.5, 1.5)) = (1+1.5) = 2.5` multiplier on forged DPS * crit blend
    - Additionally, forged = unforged * forge_mult * (1+quality), so JS base is higher by forge_mult*(1+quality)
    - Net effect depends on forge level and quality.

### Builds Affected by Fichilliumorite Exclusion:
- Builds using Fichilliumorite as filler will have higher ore power in workbook than in JS engine.

### Builds Affected by Kitsunite Smite Cap:
- Builds relying on Kitsunite for smite DPS will have potentially higher smite DPS in JS engine (no cap) than in workbook.

## Recommendations for JS Engine Alignment

1. **Implement Fichilliumorite Exclusion in E10**: Modify `avgOrePower` to exclude Fichilliumorite from weighted average.
2. **Add Lightning DPS Component**: 
   - Add lightning proc components similar to fire/poison.
   - Include in total DPS and max burst DPS.
3. **Review Berserk Formula**: Align with workbook's approach (unforged DPS with crit base, multiplicative after crit blend).
4. **Implement Kitsunite Smite Cap**: Add special handling for Kitsunite in smite DMG calculation.
5. **Verify Fire Duration Formula**: Confirm workbook's intent and adjust JS if needed.
6. **Address Black Hole Radius**: While JS engine doesn't have the C82 bug, ensure the black hole formula is correct (should it use `atkRate` or something else?).

## Conclusion

The JS engine currently deviates from the workbook in several key areas, most notably:
- Missing Lightning DPS (7th component)
- Different berserk calculation
- Ore power average not excluding Fichilliumorite
- Missing Kitsunite smite cap

These differences will result in DPS discrepancies between the JS engine and the workbook, particularly for builds utilizing the new ores (Kitsunite, Marblite, Fichilliumorite, Vanegos) and high lethality/berserk combinations.

To achieve bit-for-bit parity with the workbook (as required by the project's "Zero invented mechanics" rule), the JS engine must be updated to match the workbook formulas exactly.

## Note on Data Files
The JS engine relies on `data/*.json` for ore and weapon stats. Ensure these files are generated from the new.xlsx workbook using the build script (`scripts/build_data.py`) to maintain consistency.

---
*Report generated: $(date)*