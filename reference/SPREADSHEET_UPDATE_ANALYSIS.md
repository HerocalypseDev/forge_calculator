# Spreadsheet Update Analysis: Complete Change Report

**Analysis Date:** 2026-09-11
**Old Version:** Reference documentation (all_formulas_reference_updated.txt)
**New Version:** Copy of LittleTimmy's Calculator MAIN COPY (UP TO DATE) (2).xlsx

---

## EXECUTIVE SUMMARY

The new spreadsheet version introduces:
- **7 new ores** (Fierce Jade, Vanegos, Kitsunite, Marblite, Fichilliumorite, Aether Lotus, Zephyte, Vooite)
- **1 new weapon** (Sharktooth Odachi)
- **1 new DPS component** (Lightning DPS - 7th component)
- **Major formula changes** (Fichilliumorite exclusion, Archangel smite scaling, Berserk multiplicative)
- **New systems** (Ore Power Scaling, Weapon Auto-Select)
- **Structural shifts** (rows moved down 1-5 positions, Achievement cell C80→C85)

---

## PHASE 1: WEAPON CHANGES

### A. New Weapon Added

| Row | Name | Type | Attack Speed | DMG | Notes |
|-----|------|------|--------------|-----|-------|
| 81 | **Sharktooth Odachi** | Colossal Sword | 1.4 | 27.0 | Highest DMG Colossal Sword |

**Impact:**
- VLOOKUP range expanded from `$C$2:$E$80` to `$C$2:$E$81`
- Total weapons: 79 → 80

### B. No Weapon Stat Changes

All existing weapons (rows 2-80) retain their original stats. Only the new weapon was added at row 81.

---

## PHASE 2: FORMULA CHANGES

### A. Ore Multiplier System

#### E6-E9: VLOOKUP Range Expansion
**Old:** `$A$55:$C$195`
**New:** `$A$55:$C$202`

**Change:** Expanded by 7 rows to accommodate new ores. Formula structure unchanged.

#### E10: Weighted Average — MAJOR CHANGE

**Old:**
```
=IFERROR(SUMPRODUCT(D6:D9,E6:E9)/SUM(D6:D9),AVERAGE(E6:E9))
```

**New:**
```
=IFERROR(SUMPRODUCT(D6:D9, E6:E9, (C6:C9<>"Fichilliumorite")*1) / SUMIFS(D6:D9, C6:C9, "<>Fichilliumorite"), AVERAGEIFS(E6:E9, C6:C9, "<>Fichilliumorite"))
```

**Why:** Fichilliumorite (1x multiplier, no combat traits) is now **excluded from the weighted average**. This prevents it from diluting weapon damage when used as a filler ore.

**Impact:** Weapons forged with Fichilliumorite will have higher effective multipliers than before.

### B. NEW: Ore Power Scaling System (I6-L9)

**Completely new system that didn't exist in the old version.**

#### I6-I9: Weapon Ore Detection
```
=IF(C6="Select Ore",0,IF(ISNUMBER(SEARCH("eapon",IFERROR(VLOOKUP(C6,'_OptionsCrafter'!$A$55:$F$202,2,0),""))),1,0))
```

**Purpose:** Returns 1 if ore is a Weapon ore, 0 otherwise. Detects by searching for "eapon" in the category column.

#### J6-J9: Ore Share Fraction
```
=IF(SUM($D$6:$D$9)=0,0,IF(ISNUMBER(D6),D6/SUM($D$6:$D$9),0))
```

**Purpose:** Each ore's percentage of total ore amount (0 if total is 0).

#### K6-K9: Power Scaling Factor
```
=IF(OR(I6=0,J6<0.1),0,MIN(MAX((J6-0.1)*4.5+0.1,0.1),1))
```

**Purpose:** Computes power level for trait scaling:
- 0 if non-weapon ore OR share < 10%
- Linear scaling from 10% share → 0.1 to ~32% share → 1.0
- Capped between 0.1 and 1.0

#### L6-L9: Trait Text Display
```
=IF(K6=0,"",IF(J6>=0.3,VLOOKUP(full trait text),"["&TEXT(K6*100,"0.0")&"% power] "&VLOOKUP(partial trait)))
```

**Purpose:**
- Shows **full trait text** if ore share ≥ 30%
- Shows **power-scaled partial trait** with percentage indicator if 10-30%
- Empty if not a weapon ore or < 10% share

**Inconsistency Found:** L6-L9 VLOOKUP column 5 uses `$A$55:$F$202`, but column 4 still uses old `$A$55:$F$195`. This should be updated for consistency.

**Impact:** Users can now see partial traits at 10-30% ore share instead of no display at all.

### C. NEW: Weapon Auto-Select (F12-F21)

**Completely new system.**

#### F12: Auto-Select Formula
```
=IFERROR(__xludf.DUMMYFUNCTION("IFERROR(FILTER({\"Dagger\"; \"Straight Sword\"; \"Mace\"; \"Gauntlet\"; \"Axe\"; \"Katana\"; \"Great Sword\"; \"Spear\"; \"Great Axe\"; \"Colossal Sword\"}, {3; 4; 7; 7; 10; 10; 13; 13; 16; 21} <= 'DPS Calculator'!D10), \"Not enough Ore\")"),"Dagger")
```

**Purpose:** Auto-selects weapon type based on total ore amount (D10).

#### Weapon Type Thresholds

| Weapon Type | Min Ore | Weapon Type | Min Ore |
|-------------|---------|-------------|---------|
| Dagger | 3 | Great Sword | 13 |
| Straight Sword | 4 | Spear | 13 |
| Mace | 7 | Great Axe | 16 |
| Gauntlet | 7 | Colossal Sword | 21 |
| Axe | 10 | Katana | 10 |

**Note:** F13-F21 are Google Sheets FILTER compatibility stubs that fall back to fixed weapon names.

**Impact:** Calculator can now suggest weapon types based on ore quantity.

### D. Armor Bonus Section (C42-E48)

**Major restructuring.**

#### NEW: Armor Bonus Inputs (C42-C44, E42-E44)

**Old:** These cells were computed from formulas
**New:** Manual inputs with cap formulas

| Cell | Input | Cap Formula | Description |
|------|-------|-------------|-------------|
| C42 | 0.56 | `=MIN(C42, 100%)` | Crit Chance armor bonus |
| C43 | 0.12 | `=MIN(C43, 100%)` | Crit DMG armor bonus |
| C44 | 0.34 | `=MIN(C44, 150%)` | Lethality armor bonus |

**Why Changed:** Armor bonuses are now manual inputs for specific armor sets (sealed curse, eye ore, vanegos, fierce jade, frost fossil, kokorite armor).

#### C45: Lethality from Ores — SHIFTED & UPDATED

**Old:** C44
**New:** C45

**Formula Changes:**
- "Tigers Eye" → "Tiger's Eye" (apostrophe added)
- NEW ORES: Fierce Jade (+2%/20%), Vanegos (+4%/40%)
- Adds C44 (armor bonus) instead of old C43

#### C46: Crit Chance Bonus — CHANGED TO MANUAL INPUT

**Old:** Formula-driven IFS
**New:** `0.05` (manual input, default 5%)

**Why:** Simplified from ore-based calculation to manual input.

#### C47: Crit DMG from Ores — SHIFTED & UPDATED

**Old:** C46
**New:** C47

**Formula Changes:**
- NEW ORE: Fierce Jade (+2%/20% Crit DMG)
- Adds C43 (armor crit DMG bonus) instead of old C42
- Some ore values changed (Prismatic Heart, Voidstar, Yeti Heart, Yang)

#### C48: Atk Speed Bonus — CHANGED TO MANUAL INPUT

**Old:** Formula-driven IFS
**New:** `0.06` (manual input, default 6%)

**Why:** Simplified from ore-based calculation to manual input.

#### E45-E48: Stat Totals — SHIFTED

All stat total formulas shifted down 1 row:

| Old | New | Cap |
|-----|-----|-----|
| E44 | E45 | 150% (Lethality) |
| E45 | E46 | 100% (Crit Chance) |
| E46 | E47 | 100% (Crit DMG) |
| E47 | E48 | 150% (Atk Speed) |

**NEW Race Bonuses Added to E48 (Atk Speed):**
- Goblin + Dagger: +10%
- Golem + Colossal Sword: +15%
- Golem + Great Axe: +15%
- Felynx + Gauntlets: +20%

### E. Extra Traits (C53-E54)

#### C53: Moon Stone — SHIFTED
**Old:** C52
**New:** C53
**Formula:** Unchanged structure (2.5%–25% multiplicative bonus)

#### E53: Moon Multiplier — SHIFTED
**Old:** E52
**New:** E53
**Formula:** `=1+C53`

#### C54: Berserk Bonus — SHIFTED TO MANUAL INPUT
**Old:** C53 (formula)
**New:** C54 (manual input, default 0.0)

#### E54: Total Berserk — SHIFTED
**Old:** E53
**New:** E54
**Formula:** `=C54+IF(C22="Minotaur",30%,0)`

### F. On-Hit Traits — ALL SHIFTED

All on-hit trait sections shifted down 1 row:

| Section | Old Rows | New Rows |
|---------|----------|----------|
| Explosion | C57-E58 | C58-E59 |
| Fire | C61-E63 | C62-E64 |
| Poison | C66-E68 | C67-E69 |
| Smite | C71-E72 | C72-E73 |
| Black Hole | C75-E76 | C76-E77 |

#### NEW ORE: Kitsunite (Multi-Trait Ore)

Kitsunite contributes to **4 on-hit categories**:

| Category | DMG Min-Max | Proc Min-Max | Duration |
|----------|-------------|--------------|----------|
| Explosion | 7%-70% | 4%-40% | — |
| Fire | 4%-40% | 5%-50% | 0.5s-5s |
| Smite | 2.5%-50%* | 5%-50% | — |
| Lightning | 8%-80% | 6%-60% | 0.3s-3s |

*Kitsunite smite has special 5% minimum and 50% maximum caps.

#### Smite: Archangel Scaling — MAJOR CHANGE

**Old:** Flat +150% smite DMG
**New:** Scales with attack speed

```
=IF(C22="Archangel",MIN(FLOOR(E21,1)*0.5,1.5),0)
```

**Scaling:**
- 1 hit/sec: +50% smite DMG
- 2 hits/sec: +100% smite DMG
- 3+ hits/sec: +150% smite DMG (capped)

**Why:** Balances fast-attack builds vs slow heavy weapons.

#### Poison Duration (C69) — COMPLETELY REWRITTEN

**Old:** Manual IFS stack with MAX/MIN logic for each ore slot
**New:** XLOOKUP/BYROW/LAMBDA array formula

```
XLOOKUP("Malachite", $C$6:$C$9, BYROW($D$6:$D$9, LAMBDA(row, IF(SUM($D$6:$D$9)=0, 0, IF(row/SUM($D$6:$D$9)<0.1, 0, 0.3+2.7*MIN((row/SUM($D$6:$D$9)-0.1)/0.2, 1))))), 0)
```

**Key Change:** Now uses **FIRST** Malachite slot only (XLOOKUP returns first match), not MAX of all Malachite slots.

**Duration Calculation:** `MAX(0, MAX(duration_value, E35) - 2)` where E35 is poison cooldown/duration from runes.

#### Black Hole DPS (E77) — RESTRUCTURED

**Old:**
```
=A18*C75*C76*E21
```

**New:**
```
=E13*C77*C82*MIN(E21,1)
```

**Changes:**
- Uses E13 (which = A18, base weapon DMG) instead of A18 directly
- References C82 (Black Hole Radius multiplier)

**CRITICAL BUG:** C82 is **EMPTY** (None). This means Black Hole DPS = 0 until C82 is populated.

**Per Galaxite description:** "+6.5% Black Hole Radius" — C82 should be a radius multiplier, but it's not implemented yet.

### G. NEW: Lightning DPS Section (C80-E81)

**Completely new on-hit category — 7th DPS component.**

#### C80: Lightning DMG %
```
=IFS(C6="Kitsunite",...,C6="Marblite",...,TRUE,0) + C36
```

**Ores:**
- Kitsunite: +8%/80%
- Marblite: +6%/60%

#### E80: Lightning Cooldown (seconds)
```
=SUM(IF(MIN(IFS(...Kitsunite cooldown...,...Marblite cooldown...))=99, 0, MAX(MIN(...), 0)))
```

**Cooldowns:**
- Kitsunite: 0.3s–3s
- Marblite: 0.5s–5s

Returns 0 if no lightning ore present.

#### C81: Lightning Proc Chance %
```
=MAX(IFS(...Kitsunite: 6%/60%...,...Marblite: 4%/40%...), D36)
```

#### E81: Lightning DPS
```
=IFERROR(E13*C80*C81*MIN(E21,1/E80), 0)
```

**Formula:** BaseDMG × Lightning% × ProcChance × MIN(Hits/sec, 1/Cooldown)

**Impact:** Lightning DPS is capped at 1 proc per cooldown period.

### H. Achievement Cell — SHIFTED

**Old:** C80
**New:** C85

All references to achievement cell updated throughout formulas (E45, E46, E48, E85).

### I. DPS Results — ALL SHIFTED

| Old | New | Content |
|-----|-----|---------|
| C84 | C89 | Physical Hit DPS |
| C85 | C90 | Explosion DPS |
| C86 | C91 | Fire DoT DPS |
| C87 | C92 | Poison DoT DPS |
| C88 | C93 | Smite DPS |
| C89 | C94 | Black Hole DPS |
| — | **E94** | **Lightning DPS (NEW)** |
| C91 | C96 | Total Average DPS |
| C92 | C97 | Berserk DPS |
| C93 | C98 | Moon Stone DPS |
| C95 | C100 | Min DPS |
| C96 | C101 | Max Burst DPS |

#### C96: Total Average DPS — NOW 7 COMPONENTS

**Old:** `=C84+C85+C86+C87+C88+C89` (6 components)
**New:** `=C89+C90+C91+C92+C93+C94+E94` (7 components)

#### C97: Berserk DPS — MAJOR CHANGE (Additive → Multiplicative)

**Old:**
```
=IF(E53=0, C91, (C85+C86+C87+C88+C89 + C18*MIN(E44+E53,150%)*...))
```
Lethality and Berserk were **additive** and capped together at 150%.

**New:**
```
=IF(E54=0, C96, (C90+C91+C92+C93+C94+E94 + C18*(1+MIN(E45,150%))*(1+E54)*...))
```
Lethality and Berserk are now **multiplicative**:
- `(1 + MIN(Lethality, 150%)) × (1 + Berserk)`

**Impact:** High lethality + high berserk builds are now **much stronger**.

**Example:**
- Old: 100% lethality + 50% berserk → MIN(150%, 150%) = 150% total
- New: (1+1.0) × (1+0.5) = 3.0 = **200% total**

#### C101: Max Burst DPS — NOW INCLUDES LIGHTNING

**Old:** 6 terms (Weapon crit + Explosion + Fire + Poison + Smite + Black Hole)
**New:** 7 terms (adds C80 Lightning DMG%)

---

## PHASE 3: NEW ORES

### Complete List of New Ores

| Row | Name | Multiplier | Category | Traits |
|-----|------|------------|----------|--------|
| 196 | **Fierce Jade** | 17x | Weapons | +2%/20% Lethality, +2%/20% Crit DMG, +3.5%/35% Crit Chance, conditional Physical DMG/Speed buff |
| 197 | Aether Lotus | 18x | Armor | (No trait formulas extracted) |
| 198 | Zephyte | 18.5x | Armor | (No trait formulas extracted) |
| 199 | **Vanegos** | 19.5x | Weapons | +4%/40% Lethality |
| 200 | Vooite | 21x | Armor | (No trait formulas extracted) |
| 201 | **Kitsunite** | 27.5x | Weapons | Multi-trait: Explosion + Fire + Smite + Lightning |
| 202 | **Fichilliumorite** | 1x | None | **EXCLUDED from weighted average**, no combat traits |

### Detailed Ore Trait Analysis

#### Fierce Jade (196)
```
Min: +3.5% Physical Damage and +3.5% Movement Speed for 1 second when HP drops below 35% | +3.5% Critical Chance | +2% Critical Damage | +2% Lethality
Max: +35% Physical Damage and +35% Movement Speed for 10 seconds when HP drops below 35% | +35% Critical Chance | +20% Critical Damage | +20% Lethality
```

**Provides:**
- Lethality: +2%/20% (via C45 formula)
- Crit DMG: +2%/20% (via C47 formula)
- Crit Chance: +3.5%/35% (via formula)
- Conditional buff: Physical DMG + Movement Speed when HP < 35%

**Note:** The conditional buff is not implemented in the DPS calculator (it's a survivability/mobility mechanic).

#### Vanegos (199)
```
Min: +4% Lethality
Max: +40% Lethality
```

**Provides:**
- Highest lethality bonus in game (+4%/40%)
- Pure lethality, no other stats

**Impact:** Best-in-slot for lethality builds.

#### Kitsunite (201)
```
Min: 6% chance to deal 8% weapon damage up to 5 enemies 0.3s cooldown | +5% smite DMG 5% proc | +4% fire DMG/s for 0.5s (5% proc) | 4% chance for 7% explosion
Max: 60% chance to deal 80% weapon damage up to 5 enemies 3s cooldown | +50% smite DMG 50% proc | +40% fire DMG/s for 5s (50% proc) | 40% chance for 70% explosion
```

**Provides:**
- **Lightning/Freeze:** 8%/80% DMG, 6%/60% proc, 0.3s-3s cooldown (C80, C81, E80)
- **Smite:** 2.5%/50% DMG (special capped), 5%/50% proc (C72, C73)
- **Fire:** 4%/40% DMG, 5%/50% proc, 0.5%/5% duration (C62, C63, C64)
- **Explosion:** 7%/70% DMG, 4%/40% proc (C58, C59)

**Impact:** Ultimate multi-trait ore. Contributes to 4 different DPS categories simultaneously.

#### Marblite (187, mentioned in formulas but row 187 is earlier)
```
Min: 4% chance to deal 6% weapon damage, 0.5s cooldown
Max: 40% chance to deal 60% weapon damage, 5s cooldown
```

**Provides:**
- **Lightning:** 6%/60% DMG, 4%/40% proc, 0.5s-5s cooldown (C80, C81, E80)

**Note:** Marblite is row 187, which was already in the old range. It appears to be a pre-existing ore that now provides Lightning DPS in the new formula system.

#### Fichilliumorite (202)
```
Multiplier: 1x
Category: None
No trait formulas
```

**Special Behavior:**
- **EXCLUDED from weighted ore average** (E10 formula)
- Provides no combat traits
- 1x multiplier (base ore)

**Purpose:** Filler ore that doesn't dilute weapon damage. Use when you need ore quantity without affecting stats.

**Example:** If you have 10 Crimsonite + 5 Fichilliumorite:
- Old: Weighted avg = (10×5.8 + 5×1) / 15 = 4.2x
- New: Weighted avg = 10×5.8 / 10 = 5.8x (Fichilliumorite excluded)

### Armor Ores (197, 198, 200)

Aether Lotus, Zephyte, and Vooite are categorized as "Armor" ores and don't have weapon trait formulas in the DPS Calculator sheet. They likely provide defensive/utility stats not captured in the DPS calculation.

---

## PHASE 4: STRUCTURAL CHANGES

### A. VLOOKUP Range Expansions

| Sheet | Old Range | New Range | Rows Added |
|-------|-----------|-----------|------------|
| _OptionsCrafter | $A$55:$C$195 | $A$55:$C$202 | +7 |
| _OptionsCrafter | $A$55:$F$195 | $A$55:$F$202 | +7 |
| _OptionsCrafter | $A$55:$G$195 | $A$55:$G$202 | +7 |
| _Weapon | $C$2:$E$80 | $C$2:$E$81 | +1 |

**Inconsistency:** L6-L9 column 4 VLOOKUP still references `$A$55:$F$195` instead of `$A$55:$F$202`.

### B. Cell Reference Shifts

**Pattern:** Most DPS Calculator cells shifted down 1-5 rows. This appears to be due to new rows added for the Lightning section and armor bonus inputs.

| Content | Old Cell | New Cell | Shift |
|---------|----------|----------|-------|
| Lethality total | C44/E44 | C45/E45 | +1 |
| Crit Chance total | C45/E45 | C46/E46 | +1 |
| Crit DMG total | C46/E46 | C47/E47 | +1 |
| Atk Speed total | C47/E47 | C48/E48 | +1 |
| Moon Stone | C52/E52 | C53/E53 | +1 |
| Berserk | C53/E53 | C54/E54 | +1 |
| Explosion | C57-E58 | C58-E59 | +1 |
| Fire | C61-E63 | C62-E64 | +1 |
| Poison | C66-E68 | C67-E69 | +1 |
| Smite | C71-E72 | C72-E73 | +1 |
| Black Hole | C75-E76 | C76-E77 | +1 |
| Achievement | C80 | C85 | +5 |
| Physical DPS | C84 | C89 | +5 |
| Total DPS | C91 | C96 | +5 |
| Berserk DPS | C92 | C97 | +5 |
| Moon DPS | C93 | C98 | +5 |
| Min DPS | C95 | C100 | +5 |
| Max Burst DPS | C96 | C101 | +5 |

### C. New Rows Added

**Rows 42-44:** New armor bonus manual input section
**Rows 80-81:** New Lightning DPS section
**Row 85:** Achievement cell moved here (was row 80)

---

## AMBIGUOUS CHANGES & POTENTIAL BUGS

### 1. Inconsistent VLOOKUP Range in L6-L9

**Issue:** Column 5 uses `$A$55:$F$202`, but column 4 uses `$A$55:$F$195`.

**Impact:** If any new ore (rows 196-202) is selected, column 4 VLOOKUP will fail while column 5 succeeds.

**Recommendation:** Update column 4 VLOOKUP to `$A$55:$F$202` for consistency.

### 2. Empty C82 Cell (Black Hole Radius)

**Issue:** C82 is empty, making Black Hole DPS = 0 for all builds.

**Impact:** Galaxite ore provides no DPS benefit despite trait description.

**Recommendation:** Populate C82 with a Black Hole Radius multiplier formula or input field.

### 3. Poison Duration: First Malachite Only

**Issue:** C69 uses XLOOKUP which returns only the FIRST Malachite slot's duration, not the maximum.

**Impact:** Multiple Malachite slots don't stack duration. This may be intentional game balance.

### 4. "Tigers Eye" → "Tiger's Eye"

**Issue:** Formula used "Tigers Eye" (no apostrophe) but ore name is "Tiger's Eye" (with apostrophe).

**Status:** Fixed in new version (apostrophe added to formula).

### 5. Kitsunite Smite Cap

**Issue:** Kitsunite smite DMG has a special MIN(5%, MAX(50%)) cap that's different from other ores.

**Impact:** Must handle Kitsunite separately in smite calculations.

### 6. Marblite Row Number

**Issue:** Marblite appears in row 187 (within old range) but is treated as a "new" Lightning ore in formulas.

**Status:** Marblite existed before but now has a purpose (Lightning DPS) that wasn't implemented in the old version.

---

## SUMMARY OF DPS IMPACT

### Builds That Got Stronger

1. **Fichilliumorite users:** No longer dilutes multiplier
2. **High Lethality + Berserk:** Multiplicative instead of additive
3. **Fast-attack Archangel:** Smite scales with attack speed (up to 150%)
4. **Kitsunite builds:** 4 different on-hit DPS sources
5. **Vanegos builds:** Highest lethality bonus available

### Builds That Got Weaker

1. **Slow-attack Archangel:** Smite bonus reduced from flat 150%
2. **Galaxite builds:** Black Hole DPS = 0 (C82 bug)
3. **Multi-Malachite builds:** Duration no longer stacks (first slot only)

### New Build Options

1. **Lightning builds:** Kitsunite + Marblite for 7th DPS source
2. **Hybrid on-hit:** Kitsunite provides explosion + fire + smite + lightning
3. **Lethality stacking:** Vanegos + Fierce Jade for +6%/60% combined
