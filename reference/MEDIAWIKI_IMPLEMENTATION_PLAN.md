# MediaWiki Calculator Implementation Plan

**Target:** Update MediaWiki Forge Calculator to new spreadsheet version
**Date:** 2026-09-11

---

## STEP 0: BACKUP

Before making any changes:

1. **Export current MediaWiki pages:**
   - `Template:ForgeCalculator`
   - `Template:ForgeCalculator/styles.css` (or equivalent TemplateStyles page)
   - `MediaWiki:Common.js` (or the Forge Calculator JS module page)
   - `Data:Ores.json`
   - `Data:Weapons.json`
   - `Data:Races.json`
   - `Data:Runes.json`
   - `Data:Achievements.json`

2. **Create backup copies:**
   - Copy each page to `User:<your_username>/ForgeCalculator_backup_2026-09-11`
   - Download JSON exports of all Data: pages

3. **Document current state:**
   - Take screenshot of working calculator
   - Record expected DPS values for 2-3 test builds

---

## STEP 1: UPDATE ORE DATA TABLE

### 1A. Add New Ore Entries

**File:** `Data:Ores.json`

Add 7 new ore entries to the ores array. Insert in alphabetical order or append to end:

```json
{
  "name": "Fierce Jade",
  "multiplier": 17.0,
  "category": "Weapons",
  "lethality_min": 2.0,
  "lethality_max": 20.0,
  "crit_dmg_min": 2.0,
  "crit_dmg_max": 20.0,
  "crit_chance_min": 3.5,
  "crit_chance_max": 35.0,
  "trait_min": "+3.5% Physical Damage and +3.5% Movement Speed for 1 second when HP drops below 35% | +3.5% Critical Chance | +2% Critical Damage | +2% Lethality",
  "trait_max": "+35% Physical Damage and +35% Movement Speed for 10 seconds when HP drops below 35% | +35% Critical Chance | +20% Critical Damage | +20% Lethality"
},
{
  "name": "Vanegos",
  "multiplier": 19.5,
  "category": "Weapons",
  "lethality_min": 4.0,
  "lethality_max": 40.0,
  "trait_min": "+4% Lethality",
  "trait_max": "+40% Lethality"
},
{
  "name": "Kitsunite",
  "multiplier": 27.5,
  "category": "Weapons",
  "explosion_dmg_min": 7.0,
  "explosion_dmg_max": 70.0,
  "explosion_proc_min": 4.0,
  "explosion_proc_max": 40.0,
  "fire_dmg_min": 4.0,
  "fire_dmg_max": 40.0,
  "fire_proc_min": 5.0,
  "fire_proc_max": 50.0,
  "fire_duration_min": 0.5,
  "fire_duration_max": 5.0,
  "smite_dmg_min": 2.5,
  "smite_dmg_max": 50.0,
  "smite_dmg_cap_min": 5.0,
  "smite_dmg_cap_max": 50.0,
  "smite_proc_min": 5.0,
  "smite_proc_max": 50.0,
  "lightning_dmg_min": 8.0,
  "lightning_dmg_max": 80.0,
  "lightning_proc_min": 6.0,
  "lightning_proc_max": 60.0,
  "lightning_cooldown_min": 0.3,
  "lightning_cooldown_max": 3.0,
  "trait_min": "6% chance to deal 8% weapon damage up to 5 enemies 0.3s cooldown | +5% smite DMG 5% proc | +4% fire DMG/s for 0.5s (5% proc) | 4% chance for 7% explosion",
  "trait_max": "60% chance to deal 80% weapon damage up to 5 enemies 3s cooldown | +50% smite DMG 50% proc | +40% fire DMG/s for 5s (50% proc) | 40% chance for 70% explosion"
},
{
  "name": "Marblite",
  "multiplier": 18.0,
  "category": "Weapons",
  "lightning_dmg_min": 6.0,
  "lightning_dmg_max": 60.0,
  "lightning_proc_min": 4.0,
  "lightning_proc_max": 40.0,
  "lightning_cooldown_min": 0.5,
  "lightning_cooldown_max": 5.0,
  "trait_min": "4% chance to deal 6% weapon damage, 0.5s cooldown",
  "trait_max": "40% chance to deal 60% weapon damage, 5s cooldown"
},
{
  "name": "Fichilliumorite",
  "multiplier": 1.0,
  "category": "None",
  "excluded_from_average": true,
  "trait_min": "",
  "trait_max": ""
},
{
  "name": "Aether Lotus",
  "multiplier": 18.0,
  "category": "Armor",
  "trait_min": "",
  "trait_max": ""
},
{
  "name": "Zephyte",
  "multiplier": 18.5,
  "category": "Armor",
  "trait_min": "",
  "trait_max": ""
},
{
  "name": "Vooite",
  "multiplier": 21.0,
  "category": "Armor",
  "trait_min": "",
  "trait_max": ""
}
```

### 1B. Update Existing Ore Entry

**Fix Tiger's Eye naming:**

Find the ore entry for "Tigers Eye" or "Tiger's Eye" and ensure the name matches exactly: `"Tiger's Eye"` (with apostrophe).

### 1C. Update Ore VLOOKUP Range Comments

Update any documentation/comments that reference the old range `$A$55:$C$195` to `$A$55:$C$202`.

---

## STEP 2: UPDATE WEAPON DATA TABLE

### 2A. Add New Weapon

**File:** `Data:Weapons.json`

Add the new weapon to the weapons array:

```json
{
  "name": "Sharktooth Odachi",
  "type": "Colossal Sword",
  "attack_speed": 1.4,
  "damage": 27.0
}
```

Insert in alphabetical order within "Colossal Sword" type, or append to end.

### 2B. Verify No Other Weapon Changes

Cross-check all existing weapons to ensure stats are unchanged. The only change should be the addition of Sharktooth Odachi.

### 2C. Update Weapon VLOOKUP Range

Update any comments/documentation referencing `$C$2:$E$80` to `$C$2:$E$81`.

---

## STEP 3: UPDATE FORMULA CELLS

**Order matters!** Update in dependency order.

### 3.1. Update Manual Input Cells (Independent)

These cells are now manual inputs with cap formulas:

#### A. Add Armor Bonus Input Section (NEW)

**Location:** In your MediaWiki template, add a new input section between Race and the existing stats section.

**HTML/UI to add:**
```html
<div class="fc-armor-bonus-section">
  <h4>Armor Bonuses</h4>
  <p class="fc-input-section-subtext">Enter percentages as decimals (0.15 = 15%). These are manual inputs for armor-specific bonuses.</p>
  
  <div class="fc-input-row">
    <label for="armor-crit-chance">Crit Chance Bonus:</label>
    <input type="number" id="armor-crit-chance" step="0.01" min="0" max="1" value="0.56">
    <span class="fc-cap-note">(Cap: 100%)</span>
  </div>
  
  <div class="fc-input-row">
    <label for="armor-crit-dmg">Crit DMG Bonus:</label>
    <input type="number" id="armor-crit-dmg" step="0.01" min="0" max="1" value="0.12">
    <span class="fc-cap-note">(Cap: 100%)</span>
  </div>
  
  <div class="fc-input-row">
    <label for="armor-lethality">Lethality Bonus:</label>
    <input type="number" id="armor-lethality" step="0.01" min="0" max="1.5" value="0.34">
    <span class="fc-cap-note">(Cap: 150%)</span>
  </div>
</div>
```

**JavaScript engine changes:**

Add to your build state:
```javascript
{
  armor_crit_chance: 0.56,
  armor_crit_dmg: 0.12,
  armor_lethality: 0.34
}
```

Add validation/clamping in your input handler:
```javascript
armor_crit_chance: Math.min(parseFloat(input.value) || 0, 1.0),
armor_crit_dmg: Math.min(parseFloat(input.value) || 0, 1.0),
armor_lethality: Math.min(parseFloat(input.value) || 0, 1.5)
```

#### B. Update Crit Chance Bonus Input

**Old:** Formula-driven IFS
**New:** Manual input, default 0.05 (5%)

**Change your input field:**
```html
<input type="number" id="crit-chance-bonus" step="0.01" min="0" max="1" value="0.05">
```

**Update default in JavaScript:**
```javascript
crit_chance_bonus: 0.05
```

#### C. Update Atk Speed Bonus Input

**Old:** Formula-driven IFS
**New:** Manual input, default 0.06 (6%)

**Change your input field:**
```html
<input type="number" id="atk-speed-bonus" step="0.01" min="0" max="1.5" value="0.06">
```

**Update default in JavaScript:**
```javascript
atk_speed_bonus: 0.06
```

#### D. Add Berserk Input (NEW)

**Location:** Add between Race selection and Armor Bonuses section.

**HTML/UI to add:**
```html
<div class="fc-berserk-section">
  <h4>Berserk</h4>
  <p class="fc-input-section-subtext">Enter percentage as decimal (0.30 = 30%). Minotaur race adds +30% automatically.</p>
  
  <div class="fc-input-row">
    <label for="berserk">Berserk Bonus:</label>
    <input type="number" id="berserk" step="0.01" min="0" max="1.5" value="0">
    <span class="fc-cap-note">(Cap: 150%)</span>
  </div>
</div>
```

**JavaScript engine changes:**
```javascript
// In build state
berserk: 0,

// In calculate function
const total_berserk = build.berserk + (build.race === "Minotaur" ? 0.30 : 0);
```

### 3.2. Update VLOOKUP Ranges (Needed Before Ore Calculations)

Update all VLOOKUP ranges in your JavaScript code:

**Find and replace:**
- `'_OptionsCrafter'!$A$55:$C$195` → `'_OptionsCrafter'!$A$55:$C$202`
- `'_OptionsCrafter'!$A$55:$F$195` → `'_OptionsCrafter'!$A$55:$F$202`
- `'_OptionsCrafter'!$A$55:$G$195` → `'_OptionsCrafter'!$A$55:$G$202`
- `'_Weapon'!$C$2:$E$80` → `'_Weapon'!$C$2:$E$81`

**In your ore lookup function:**
```javascript
function getOreData(oreName) {
  // Update max row from 195 to 202
  const ore = oresData.find(o => o.name === oreName);
  if (!ore) return null;
  
  return {
    multiplier: parseFloat(ore.multiplier) || 1,
    category: ore.category,
    // ... other fields
  };
}
```

### 3.3. Add Ore Power Scaling System (NEW)

This is a completely new system. Add these calculations to your engine.

#### A. Add Weapon Ore Detection

**Purpose:** Determine if an ore is a Weapon ore.

```javascript
function isWeaponOre(ore) {
  if (!ore || ore.name === "Select Ore" || !ore.category) return false;
  return ore.category.toLowerCase().includes("weapon");
}
```

#### B. Calculate Ore Share Fraction

**Purpose:** Each ore's percentage of total ore amount.

```javascript
function calculateOreShares(slots) {
  const totalAmount = slots.reduce((sum, slot) => sum + (slot.amount || 0), 0);
  
  return slots.map(slot => ({
    name: slot.name,
    amount: slot.amount,
    share: totalAmount === 0 ? 0 : (slot.amount || 0) / totalAmount
  }));
}
```

#### C. Calculate Power Scaling Factor

**Purpose:** Compute power level for trait scaling (0 if non-weapon or <10%, linear 0.1–1.0 from 10–32% share).

```javascript
function calculatePowerFactor(isWeapon, share) {
  if (!isWeapon || share < 0.1) return 0;
  
  // Linear scaling from 0.1 at 10% to 1.0 at ~32%
  const power = (share - 0.1) * 4.5 + 0.1;
  return Math.max(0.1, Math.min(1.0, power));
}
```

#### D. Generate Trait Display Text

**Purpose:** Show full or partial trait based on ore share.

```javascript
function formatTraitDisplay(ore, share, powerFactor) {
  if (powerFactor === 0) return "";
  
  if (share >= 0.3) {
    // Full trait text at 30%+ share
    return ore.trait_max || "";
  } else {
    // Power-scaled partial trait with percentage
    const powerPercent = (powerFactor * 100).toFixed(1);
    const partialTrait = ore.trait_min || "";
    return `[${powerPercent}% power] ${partialTrait}`;
  }
}
```

#### E. Update Ore Processing Loop

**In your main calculate function:**

```javascript
function calculate(build, gameData) {
  // ... existing code ...
  
  // Calculate ore shares and power factors
  const oreShares = calculateOreShares(build.slots);
  
  const processedSlots = oreShares.map((slot, idx) => {
    const ore = getOreData(slot.name, gameData.ores);
    const isWeapon = isWeaponOre(ore);
    const powerFactor = calculatePowerFactor(isWeapon, slot.share);
    const traitDisplay = formatTraitDisplay(ore, slot.share, powerFactor);
    
    return {
      ...slot,
      ore,
      isWeapon,
      powerFactor,
      traitDisplay
    };
  });
  
  // Use processedSlots for all subsequent calculations
  // ...
}
```

### 3.4. Add Weapon Auto-Select System (NEW)

This is optional UI enhancement. Add if you want auto-suggestion of weapon types.

#### A. Create Weapon Type Threshold Lookup

```javascript
const WEAPON_THRESHOLDS = {
  "Dagger": 3,
  "Straight Sword": 4,
  "Mace": 7,
  "Gauntlet": 7,
  "Axe": 10,
  "Katana": 10,
  "Great Sword": 13,
  "Spear": 13,
  "Great Axe": 16,
  "Colossal Sword": 21
};

function autoSelectWeaponType(totalOre) {
  // Find highest weapon type that fits the ore amount
  const types = Object.entries(WEAPON_THRESHOLDS)
    .filter(([type, min]) => totalOre >= min)
    .sort((a, b) => b[1] - a[1]);
  
  return types.length > 0 ? types[0][0] : "Dagger";
}
```

#### B. Add UI Element (Optional)

```html
<div class="fc-auto-weapon-section">
  <div class="fc-stat-row">
    <span class="fc-stat-label">Suggested Weapon Type:</span>
    <span class="fc-stat-val" id="suggested-weapon-type">—</span>
  </div>
</div>
```

#### C. Wire to Calculation

```javascript
// In calculate function
const totalOre = build.slots.reduce((sum, slot) => sum + (slot.amount || 0), 0);
const suggestedType = autoSelectWeaponType(totalOre);

// Update UI
document.getElementById('suggested-weapon-type').textContent = suggestedType;
```

### 3.5. Update Weighted Ore Average Formula

**This is the most critical change.**

**Old formula:**
```javascript
const weightedAvg = totalAmount === 0 
  ? average(multipliers) 
  : sumProduct(amounts, multipliers) / totalAmount;
```

**New formula (exclude Fichilliumorite):**
```javascript
function calculateWeightedAverage(slots) {
  // Filter out Fichilliumorite
  const nonFichSlots = slots.filter(s => s.name !== "Fichilliumorite");
  
  if (nonFichSlots.length === 0) {
    // All slots are Fichilliumorite, use average
    const multipliers = slots.map(s => s.multiplier || 1);
    return multipliers.reduce((a, b) => a + b, 0) / multipliers.length;
  }
  
  // Calculate weighted average excluding Fichilliumorite
  const totalAmount = nonFichSlots.reduce((sum, s) => sum + (s.amount || 0), 0);
  
  if (totalAmount === 0) {
    const multipliers = nonFichSlots.map(s => s.multiplier || 1);
    return multipliers.reduce((a, b) => a + b, 0) / multipliers.length;
  }
  
  const weightedSum = nonFichSlots.reduce((sum, s) => {
    return sum + (s.amount || 0) * (s.multiplier || 1);
  }, 0);
  
  return weightedSum / totalAmount;
}
```

### 3.6. Update Stat Total Formulas

All stat totals need to reference the new armor bonus inputs.

#### A. Lethality Total (E45)

**Add armor_lethality to the formula:**

```javascript
function calculateTotalLethality(build, runeLethality, oreLethality) {
  const raceBonus = getRaceLethalityBonus(build.race);
  const weaponBonus = getWeaponRaceBonus(build.race, build.weapon_type);
  const achievementBonus = getAchievementBonus(build.achievement, "Damage Boost");
  
  const total = runeLethality 
    + (build.armor_lethality || 0)  // NEW: armor bonus
    + oreLethality 
    + raceBonus 
    + weaponBonus 
    + achievementBonus;
  
  return Math.min(total, 1.5); // Cap at 150%
}

function getRaceLethalityBonus(race) {
  const bonuses = {
    "Archangel": 0.20,
    "Demon": 0.20,
    "Orc": 0.10,
    "Shadow": 0.05,
    "Dragonborn": 0.12
  };
  return bonuses[race] || 0;
}

function getWeaponRaceBonus(race, weaponType) {
  const bonuses = [
    { race: "Felynx", type: "Gauntlet", bonus: 0.20 },
    { race: "Vampire", type: "Straight Sword", bonus: 0.10 }
  ];
  
  const match = bonuses.find(b => b.race === race && b.type === weaponType);
  return match ? match.bonus : 0;
}
```

#### B. Crit Chance Total (E46)

**Change from ore-based to manual input:**

```javascript
function calculateTotalCritChance(build, runeCritChance) {
  const achievementBonus = getAchievementBonus(build.achievement, "Crit Chance");
  
  const total = runeCritChance 
    + (build.crit_chance_bonus || 0.05)  // Manual input, default 5%
    + achievementBonus;
  
  return Math.min(total, 1.0); // Cap at 100%
}
```

#### C. Crit DMG Total (E47)

**Add armor_crit_dmg to the formula:**

```javascript
function calculateTotalCritDmg(build, runeCritDmg, oreCritDmg) {
  const total = runeCritDmg 
    + oreCritDmg 
    + (build.armor_crit_dmg || 0);  // NEW: armor bonus
  
  return Math.min(total, 1.0); // Cap at 100%
}
```

#### D. Atk Speed Total (E48)

**Add new race bonuses and change to manual input:**

```javascript
function calculateTotalAtkSpeed(build, runeAtkSpeed) {
  const raceBonus = getRaceAtkSpeedBonus(build.race);
  const weaponBonus = getWeaponAtkSpeedBonus(build.race, build.weapon_type);
  const achievementBonus = getAchievementBonus(build.achievement, "Attack Speed");
  
  const total = runeAtkSpeed 
    + (build.atk_speed_bonus || 0.06)  // Manual input, default 6%
    + raceBonus 
    + weaponBonus 
    + achievementBonus;
  
  return Math.min(total, 1.5); // Cap at 150%
}

function getRaceAtkSpeedBonus(race) {
  const bonuses = {
    "Shadow": 0.10,
    "Demon": 0.20,
    "Archangel": 0.20
  };
  return bonuses[race] || 0;
}

function getWeaponAtkSpeedBonus(race, weaponType) {
  const bonuses = [
    { race: "Goblin", type: "Dagger", bonus: 0.10 },
    { race: "Golem", type: "Colossal Sword", bonus: 0.15 },
    { race: "Golem", type: "Great Axe", bonus: 0.15 },
    { race: "Felynx", type: "Gauntlet", bonus: 0.20 }
  ];
  
  const match = bonuses.find(b => b.race === race && b.type === weaponType);
  return match ? match.bonus : 0;
}
```

### 3.7. Update On-Hit Trait Formulas

All on-hit trait formulas shifted down 1 row, but more importantly, several got functional changes.

#### A. Explosion (C58-E59)

**Add Kitsunite ore:**

```javascript
function calculateExplosionDmg(slots, blastAbilityDmg) {
  let totalDmg = blastAbilityDmg || 0;
  
  for (const slot of slots) {
    if (slot.share < 0.1) continue;
    
    const ore = slot.ore;
    if (!ore) continue;
    
    // Scale factor
    const scale = Math.min((slot.share - 0.1) / 0.2, 1);
    
    // Check for explosion ores
    if (ore.name === "Gargantuan") {
      totalDmg += (5 + (50 - 5) * scale) / 100;
    } else if (ore.name === "Magmaite") {
      totalDmg += (3.5 + (35 - 3.5) * scale) / 100;
    } else if (ore.name === "Meteorite") {
      totalDmg += (6 + (60 - 6) * scale) / 100;
    } else if (ore.name === "Supermassive Black Hole") {
      totalDmg += (6.5 + (65 - 6.5) * scale) / 100;
    } else if (ore.name === "Kitsunite") {  // NEW
      totalDmg += (7 + (70 - 7) * scale) / 100;
    }
  }
  
  return totalDmg;
}

function calculateExplosionProc(slots, blastAbilityProc) {
  let maxProc = blastAbilityProc || 0;
  
  for (const slot of slots) {
    if (slot.share < 0.1) continue;
    
    const ore = slot.ore;
    if (!ore) continue;
    
    const scale = Math.min((slot.share - 0.1) / 0.2, 1);
    
    let proc = 0;
    if (ore.name === "Gargantuan") {
      proc = (3.5 + (35 - 3.5) * scale) / 100;
    } else if (ore.name === "Magmaite") {
      proc = (2 + (20 - 2) * scale) / 100;
    } else if (ore.name === "Meteorite") {
      proc = (2.5 + (25 - 2.5) * scale) / 100;
    } else if (ore.name === "Supermassive Black Hole") {
      proc = (4.5 + (45 - 4.5) * scale) / 100;
    } else if (ore.name === "Kitsunite") {  // NEW
      proc = (4 + (40 - 4) * scale) / 100;
    }
    
    maxProc = Math.max(maxProc, proc);
  }
  
  return maxProc;
}
```

#### B. Fire (C62-E64)

**Add Kitsunite ore and Dragonborn race bonus:**

```javascript
function calculateFireDmg(slots, fireAbilityDmg, race) {
  let totalDmg = fireAbilityDmg || 0;
  
  // Dragonborn racial bonus
  if (race === "Dragonborn") {
    totalDmg += 0.30;
  }
  
  for (const slot of slots) {
    if (slot.share < 0.1) continue;
    
    const ore = slot.ore;
    if (!ore) continue;
    
    const scale = Math.min((slot.share - 0.1) / 0.2, 1);
    
    if (ore.name === "Gargantuan") {
      totalDmg += (2 + (20 - 2) * scale) / 100;
    } else if (ore.name === "Sun Stone") {
      totalDmg += (3.5 + (35 - 3.5) * scale) / 100;
    } else if (ore.name === "Fireite") {
      totalDmg += (2 + (20 - 2) * scale) / 100;
    } else if (ore.name === "Kyubite") {
      totalDmg += (4.5 + (45 - 4.5) * scale) / 100;
    } else if (ore.name === "Supermassive Black Hole") {
      totalDmg += (5 + (50 - 5) * scale) / 100;
    } else if (ore.name === "Kitsunite") {  // NEW
      totalDmg += (4 + (40 - 4) * scale) / 100;
    }
  }
  
  return totalDmg;
}

function calculateFireProc(slots, fireAbilityProc, race) {
  let maxProc = fireAbilityProc || 0;
  
  // Dragonborn racial bonus
  if (race === "Dragonborn") {
    maxProc += 0.40;
  }
  
  for (const slot of slots) {
    if (slot.share < 0.1) continue;
    
    const ore = slot.ore;
    if (!ore) continue;
    
    const scale = Math.min((slot.share - 0.1) / 0.2, 1);
    
    let proc = 0;
    if (ore.name === "Gargantuan") {
      proc = (2 + (20 - 2) * scale) / 100;
    } else if (ore.name === "Sun Stone") {
      proc = (3.5 + (35 - 3.5) * scale) / 100;
    } else if (ore.name === "Fireite") {
      proc = (2 + (20 - 2) * scale) / 100;
    } else if (ore.name === "Kyubite") {
      proc = (4.5 + (45 - 4.5) * scale) / 100;
    } else if (ore.name === "Supermassive Black Hole") {
      proc = (4.5 + (45 - 4.5) * scale) / 100;
    } else if (ore.name === "Kitsunite") {  // NEW
      proc = (5 + (50 - 5) * scale) / 100;
    }
    
    maxProc = Math.max(maxProc, proc);
  }
  
  return maxProc;
}

function calculateFireDuration(slots, fireAbilityDuration, race) {
  let maxDuration = fireAbilityDuration || 0;
  
  // Dragonborn racial bonus
  if (race === "Dragonborn") {
    maxDuration += 3;
  }
  
  for (const slot of slots) {
    if (slot.share < 0.1) continue;
    
    const ore = slot.ore;
    if (!ore) continue;
    
    const scale = Math.min((slot.share - 0.1) / 0.2, 1);
    
    let duration = 0;
    if (ore.name === "Gargantuan" || ore.name === "Fireite") {
      duration = (0.2 + (2 - 0.2) * scale);
    } else if (ore.name === "Sun Stone" || ore.name === "Kyubite" || ore.name === "Supermassive Black Hole" || ore.name === "Kitsunite") {
      duration = (0.5 + (5 - 0.5) * scale);
    }
    
    maxDuration = Math.max(maxDuration, duration);
  }
  
  // Subtract 1 second for application timing (workbook formula)
  return Math.max(maxDuration - 1, 0);
}
```

#### C. Poison (C67-E69)

**MAJOR CHANGE: First Malachite slot only (XLOOKUP behavior)**

```javascript
function calculatePoisonDmg(slots, poisonAbilityDmg) {
  let totalDmg = poisonAbilityDmg || 0;
  
  for (const slot of slots) {
    if (slot.share < 0.1) continue;
    
    const ore = slot.ore;
    if (!ore || ore.name !== "Malachite") continue;
    
    const scale = Math.min((slot.share - 0.1) / 0.2, 1);
    totalDmg += (1 + (10 - 1) * scale) / 100;
  }
  
  return totalDmg;
}

function calculatePoisonProc(slots, poisonAbilityProc) {
  let maxProc = poisonAbilityProc || 0;
  
  for (const slot of slots) {
    if (slot.share < 0.1) continue;
    
    const ore = slot.ore;
    if (!ore || ore.name !== "Malachite") continue;
    
    const scale = Math.min((slot.share - 0.1) / 0.2, 1);
    const proc = (3.3 + (33 - 3.3) * scale) / 100;
    
    maxProc = Math.max(maxProc, proc);
  }
  
  return maxProc;
}

function calculatePoisonDuration(slots, poisonAbilityDuration) {
  // NEW: XLOOKUP/BYROW/LAMBDA equivalent
  // Returns duration from FIRST Malachite slot only
  
  for (const slot of slots) {
    if (slot.share < 0.1) continue;
    
    const ore = slot.ore;
    if (!ore || ore.name !== "Malachite") continue;
    
    // First Malachite slot found
    const scale = Math.min((slot.share - 0.1) / 0.2, 1);
    const rawDuration = 0.3 + 2.7 * scale;
    
    // Add rune ability duration
    const totalDuration = Math.max(rawDuration, poisonAbilityDuration || 0);
    
    // Subtract 2 seconds for application timing
    return Math.max(totalDuration - 2, 0);
  }
  
  // No Malachite found
  return Math.max((poisonAbilityDuration || 0) - 2, 0);
}
```

#### D. Smite (C72-E73)

**MAJOR CHANGE: Archangel scales with attack speed**

```javascript
function calculateSmiteDmg(slots, race, hitsPerSecond) {
  let totalDmg = 0;
  
  for (const slot of slots) {
    if (slot.share < 0.1) continue;
    
    const ore = slot.ore;
    if (!ore) continue;
    
    const scale = Math.min((slot.share - 0.1) / 0.2, 1);
    
    if (ore.name === "Heavenite") {
      totalDmg += (2.5 + (25 - 2.5) * scale) / 100;
    } else if (ore.name === "Kitsunite") {
      // Special capped values
      const rawDmg = (2.5 + (50 - 2.5) * scale) / 100;
      totalDmg += Math.max(0.05, Math.min(0.50, rawDmg));
    }
  }
  
  // Race bonuses
  if (race === "Angel") {
    totalDmg += 0.30;
  } else if (race === "Archangel") {
    // NEW: Scales with attack speed (FLOOR hits/sec × 0.5, capped at 1.5)
    const archangelBonus = Math.min(Math.floor(hitsPerSecond) * 0.5, 1.5);
    totalDmg += archangelBonus;
  }
  
  return totalDmg;
}

function calculateSmiteProc(slots, race) {
  let maxProc = 0;
  
  for (const slot of slots) {
    if (slot.share < 0.1) continue;
    
    const ore = slot.ore;
    if (!ore) continue;
    
    const scale = Math.min((slot.share - 0.1) / 0.2, 1);
    
    let proc = 0;
    if (ore.name === "Heavenite") {
      proc = (4 + 36 * scale) / 100;
    } else if (ore.name === "Kitsunite") {
      proc = (5 + 45 * scale) / 100;
    }
    
    maxProc = Math.max(maxProc, proc);
  }
  
  // Race bonuses
  if (race === "Angel") {
    maxProc += 0.50;
  } else if (race === "Archangel") {
    maxProc += 0.33;
  }
  
  return maxProc;
}
```

#### E. Black Hole (C76-E77)

**KNOWN ISSUE: C82 is empty, Black Hole DPS will be 0**

```javascript
function calculateBlackHoleDmg(slots) {
  let totalDmg = 0;
  
  for (const slot of slots) {
    if (slot.share < 0.1) continue;
    
    const ore = slot.ore;
    if (!ore || ore.name !== "Galaxite") continue;
    
    const scale = Math.min((slot.share - 0.1) / 0.2, 1);
    totalDmg += (6 + (60 - 6) * scale) / 100;
  }
  
  return totalDmg;
}

function calculateBlackHoleProc(slots) {
  // 30% proc if any Galaxite slot has >= 10% share
  const hasGalaxite = slots.some(s => s.ore && s.ore.name === "Galaxite" && s.share >= 0.1);
  return hasGalaxite ? 0.30 : 0;
}

function calculateBlackHoleDPS(baseDmg, procChance, hitsPerSecond) {
  // ISSUE: C82 (Black Hole Radius) is empty, treated as 0
  const radiusMultiplier = 0; // C82 is empty in spreadsheet
  
  if (radiusMultiplier === 0) {
    console.warn("Black Hole Radius multiplier (C82) is not implemented. Black Hole DPS = 0");
    return 0;
  }
  
  return baseDmg * procChance * radiusMultiplier * Math.min(hitsPerSecond, 1);
}
```

#### F. Lightning (C80-E81) — NEW

**Completely new DPS component:**

```javascript
function calculateLightningDmg(slots, lightningAbilityDmg) {
  let totalDmg = lightningAbilityDmg || 0;
  
  for (const slot of slots) {
    if (slot.share < 0.1) continue;
    
    const ore = slot.ore;
    if (!ore) continue;
    
    const scale = Math.min((slot.share - 0.1) / 0.2, 1);
    
    if (ore.name === "Kitsunite") {
      totalDmg += (8 + (80 - 8) * scale) / 100;
    } else if (ore.name === "Marblite") {
      totalDmg += (6 + (60 - 6) * scale) / 100;
    }
  }
  
  return totalDmg;
}

function calculateLightningCooldown(slots, lightningAbilityCooldown) {
  let minCooldown = lightningAbilityCooldown || Infinity;
  
  for (const slot of slots) {
    if (slot.share < 0.1) continue;
    
    const ore = slot.ore;
    if (!ore) continue;
    
    const scale = Math.min((slot.share - 0.1) / 0.2, 1);
    
    let cooldown = Infinity;
    if (ore.name === "Kitsunite") {
      cooldown = 0.3 + (3 - 0.3) * scale;
    } else if (ore.name === "Marblite") {
      cooldown = 0.5 + (5 - 0.5) * scale;
    }
    
    minCooldown = Math.min(minCooldown, cooldown);
  }
  
  // If no lightning ore, return 0 (no cooldown = no lightning)
  return minCooldown === Infinity ? 0 : minCooldown;
}

function calculateLightningProc(slots, lightningAbilityProc) {
  let maxProc = lightningAbilityProc || 0;
  
  for (const slot of slots) {
    if (slot.share < 0.1) continue;
    
    const ore = slot.ore;
    if (!ore) continue;
    
    const scale = Math.min((slot.share - 0.1) / 0.2, 1);
    
    let proc = 0;
    if (ore.name === "Marblite") {
      proc = (4 + (40 - 4) * scale) / 100;
    } else if (ore.name === "Kitsunite") {
      proc = (6 + (60 - 6) * scale) / 100;
    }
    
    maxProc = Math.max(maxProc, proc);
  }
  
  return maxProc;
}

function calculateLightningDPS(baseDmg, lightningDmg, procChance, cooldown, hitsPerSecond) {
  if (cooldown === 0) return 0; // No lightning ore
  
  // Capped at 1 proc per cooldown period
  const effectiveProcsPerSecond = Math.min(hitsPerSecond, 1 / cooldown);
  
  return baseDmg * lightningDmg * procChance * effectiveProcsPerSecond;
}
```

### 3.8. Update Achievement Cell References

**Old:** Achievement at C80
**New:** Achievement at C85

Update all formula references:

```javascript
// Find and replace in your code:
// C80 → C85 (in achievement parsing)
// E80 → E85 (in achievement display)
```

### 3.9. Update DPS Result Formulas

#### A. Physical Hit DPS (C89)

```javascript
// No functional change, just row shift
function calculatePhysicalDPS(weaponDmg, lethality, critChance, critDmg, hitsPerSecond) {
  const critBlend = Math.min(critChance, 1) * (1 + critDmg) + (1 - Math.min(critChance, 1));
  return weaponDmg * (1 + lethality) * critBlend * hitsPerSecond;
}
```

#### B. Total Average DPS (C96) — NOW 7 COMPONENTS

```javascript
function calculateTotalDPS(physicalDPS, explosionDPS, fireDPS, poisonDPS, smiteDPS, blackHoleDPS, lightningDPS) {
  return physicalDPS + explosionDPS + fireDPS + poisonDPS + smiteDPS + blackHoleDPS + lightningDPS;
}
```

#### C. Berserk DPS (C97) — MULTIPLICATIVE CHANGE

**OLD:**
```javascript
const combinedLethBerserk = Math.min(lethality + berserk, 1.5);
const berserkDPS = nonPhysicalDPS + weaponDmg * (1 + combinedLethBerserk) * critBlend * hitsPerSecond;
```

**NEW:**
```javascript
function calculateBerserkDPS(totalDPS, berserk, weaponDmg, lethality, critChance, critDmg, hitsPerSecond, nonPhysicalDPS) {
  if (berserk === 0) return totalDPS;
  
  // Multiplicative: (1 + Lethality) × (1 + Berserk)
  const lethalityFactor = 1 + Math.min(lethality, 1.5);
  const berserkFactor = 1 + berserk;
  const critBlend = Math.min(critChance, 1) * (1 + critDmg) + (1 - Math.min(critChance, 1));
  
  const berserkPhysicalDPS = weaponDmg * lethalityFactor * berserkFactor * critBlend * hitsPerSecond;
  
  return nonPhysicalDPS + berserkPhysicalDPS;
}
```

#### D. Moon Stone DPS (C98)

```javascript
function calculateMoonStoneDPS(totalDPS, moonBonus, physicalDPS, nonPhysicalDPS) {
  if (moonBonus === 0) return totalDPS;
  
  // Multiplicative on physical DPS only
  return physicalDPS * (1 + moonBonus) + nonPhysicalDPS;
}
```

#### E. Min DPS (C100)

```javascript
function calculateMinDPS(weaponDmg, lethality, hitsPerSecond) {
  // No crits, just base damage
  return weaponDmg * (1 + lethality) * hitsPerSecond;
}
```

#### F. Max Burst DPS (C101) — NOW INCLUDES LIGHTNING

```javascript
function calculateMaxBurstDPS(weaponDmg, lethality, critDmg, hitsPerSecond, explosionDmg, fireDmg, poisonDmg, smiteDmg, blackHoleDmg, lightningDmg) {
  // All crits + all on-hit procs
  const maxWeaponDPS = weaponDmg * (1 + lethality) * (1 + critDmg) * hitsPerSecond;
  
  // Note: On-hit values here are the DMG% values, not DPS
  // They get multiplied by weaponDmg
  return maxWeaponDPS 
    + weaponDmg * explosionDmg * hitsPerSecond
    + weaponDmg * fireDmg  // Fire is per-second
    + weaponDmg * poisonDmg  // Poison is per-second
    + smiteDmg * weaponDmg
    + blackHoleDmg * weaponDmg
    + lightningDmg;  // Already a percentage
}
```

---

## STEP 4: UPDATE MEDIAWIKI TEMPLATE/HTML

### 4A. Add Lightning DPS to Results Display

**Location:** In your DPS results section, add a new row after Black Hole DPS.

**HTML to add:**
```html
<div class="fc-stat-row">
  <span class="fc-stat-label">Lightning DPS:</span>
  <span class="fc-stat-val" id="lightning-dps">0.00</span>
</div>
```

**JavaScript to update:**
```javascript
document.getElementById('lightning-dps').textContent = lightningDPS.toFixed(2);
```

### 4B. Update Total DPS Row

**Change label and formula:**
```html
<div class="fc-stat-row fc-total-row">
  <span class="fc-stat-label">Total DPS (7 components):</span>
  <span class="fc-stat-val" id="total-dps">0.00</span>
</div>
```

### 4C. Add Ore Power Display (Optional)

If you want to show power-scaled traits in the UI:

```html
<div class="fc-traits-section">
  <h4>Active Traits</h4>
  <div id="active-traits" class="fc-traits-display">
    <!-- Populated by JavaScript -->
  </div>
</div>
```

**JavaScript:**
```javascript
function updateTraitsDisplay(processedSlots) {
  const traitsContainer = document.getElementById('active-traits');
  traitsContainer.innerHTML = '';
  
  for (const slot of processedSlots) {
    if (slot.traitDisplay) {
      const traitDiv = document.createElement('div');
      traitDiv.className = 'fc-trait-item';
      traitDiv.textContent = `${slot.name}: ${slot.traitDisplay}`;
      traitsContainer.appendChild(traitDiv);
    }
  }
}
```

### 4D. Update CSS for New Sections

Add to your TemplateStyles CSS:

```css
/* Armor Bonus Section */
.fc-armor-bonus-section {
  margin: 1em 0;
  padding: 0.75em;
  background: var(--fc-card-bg, #f8f9fa);
  border: 1px solid var(--fc-border, #ddd);
  border-radius: 4px;
}

.fc-armor-bonus-section h4 {
  margin: 0 0 0.5em 0;
  font-size: 1.1em;
}

/* Berserk Section */
.fc-berserk-section {
  margin: 1em 0;
  padding: 0.75em;
  background: var(--fc-card-bg, #f8f9fa);
  border: 1px solid var(--fc-border, #ddd);
  border-radius: 4px;
}

/* Input Subtext */
.fc-input-section-subtext {
  font-size: 0.85em;
  color: #666;
  margin-bottom: 0.5em;
}

/* Cap Note */
.fc-cap-note {
  font-size: 0.85em;
  color: #666;
  margin-left: 0.5em;
}

/* Traits Display */
.fc-traits-display {
  white-space: normal;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.fc-trait-item {
  margin: 0.25em 0;
  padding: 0.25em;
  background: var(--fc-highlight-bg, #fff);
  border-left: 3px solid var(--fc-accent, #4a90d9);
  padding-left: 0.5em;
}

/* Total Row Highlight */
.fc-total-row {
  font-weight: bold;
  font-size: 1.1em;
  border-top: 2px solid var(--fc-border, #ddd);
  padding-top: 0.5em;
  margin-top: 0.5em;
}

/* Lightning DPS Row */
.fc-stat-row:has(#lightning-dps) {
  /* Optional: special styling for new DPS component */
}
```

---

## STEP 5: UPDATE DOCUMENTATION

### 5A. Update Wiki Help Text

Update any documentation that references:
- 6 DPS components → 7 DPS components
- Old cell references → New cell references
- Flat Archangel smite → Attack-speed scaling
- Additive Berserk → Multiplicative Berserk

### 5B. Update Ore Table in Wiki

Add new ores to your wiki's ore reference table:

| Ore | Multiplier | Category | Key Traits |
|-----|------------|----------|------------|
| **Fierce Jade** | 17x | Weapon | Lethality + Crit DMG + Crit Chance |
| **Vanegos** | 19.5x | Weapon | Highest Lethality (40%) |
| **Kitsunite** | 27.5x | Weapon | Multi-trait: Explosion + Fire + Smite + Lightning |
| **Marblite** | 18x | Weapon | Lightning DPS |
| **Fichilliumorite** | 1x | Base | Excluded from average, no combat traits |

### 5C. Document Known Issues

Add a "Known Issues" section:

```markdown
## Known Issues

### Black Hole DPS = 0
The Black Hole Radius multiplier (cell C82 in the spreadsheet) is not implemented. 
Galaxite ore currently provides no DPS benefit. This will be fixed in a future update.

### Lightning DPS Cooldown
Lightning DPS is capped at 1 proc per cooldown period, matching the spreadsheet behavior.

### Poison Duration (First Malachite Only)
Multiple Malachite slots do not stack duration. Only the first Malachite slot's duration is used.
```

---

## STEP 6: VERIFICATION

### 6A. Test Cases to Run

#### Test 1: Fichilliumorite Exclusion

**Setup:**
- Slot 1: 10 Crimsonite
- Slot 2: 5 Fichilliumorite
- Weapon: Any

**Expected:**
- Weighted average = 5.8x (Crimsonite only)
- NOT (10×5.8 + 5×1) / 15 = 4.2x

**Verify:** `average_multiplier` should equal 5.8

#### Test 2: Kitsunite Lightning DPS

**Setup:**
- Slot 1: 30 Kitsunite (100% share)
- Weapon: Any
- Base DMG: 100

**Expected:**
- Lightning DMG: 80%
- Lightning Proc: 60%
- Lightning Cooldown: 3s
- At 1 hit/sec: Lightning DPS = 100 × 0.8 × 0.6 × min(1, 1/3) = 16
- At 3 hits/sec: Lightning DPS = 100 × 0.8 × 0.6 × min(3, 1/3) = 16 (capped)

**Verify:** `lightning_dps` should be non-zero with Kitsunite

#### Test 3: Archangel Smite Scaling

**Setup:**
- Race: Archangel
- Weapon: Dagger (fast, 1.0s interval = 1 hit/sec)
- No Heavenite

**Expected:**
- At 1 hit/sec: +50% smite DMG
- At 2 hits/sec: +100% smite DMG
- At 3+ hits/sec: +150% smite DMG (capped)

**Verify:** `smite_dps` increases with faster weapons

#### Test 4: Berserk Multiplicative

**Setup:**
- Lethality: 100% (1.0)
- Berserk: 50% (0.5)
- Weapon DMG: 100
- No crits

**Old behavior:**
- Combined = min(1.0 + 0.5, 1.5) = 1.5
- DPS = 100 × 1.5 = 150

**New behavior:**
- Multiplicative = (1 + 1.0) × (1 + 0.5) = 3.0
- DPS = 100 × 3.0 = 300

**Verify:** `berserk_dps` should be ~2× the old additive formula

#### Test 5: Multi-Malachite Duration

**Setup:**
- Slot 1: 20 Malachite (40% share)
- Slot 2: 10 Malachite (20% share)
- Weapon: Any

**Expected:**
- Only Slot 1's duration counts (XLOOKUP returns first match)
- Slot 1 duration: 0.3 + 2.7 × min((0.4-0.1)/0.2, 1) = 3.0s
- Effective duration: max(3.0 - 2, 0) = 1.0s

**Verify:** `poison_duration` should be 1.0, NOT 2.0 (if stacking)

#### Test 6: Total DPS = 7 Components

**Setup:**
- All DPS components active (Kitsunite + other ores)

**Expected:**
```
total_dps = physical_dps + explosion_dps + fire_dps + poison_dps + smite_dps + black_hole_dps + lightning_dps
```

**Verify:** Manually sum the 7 components, compare to `total_dps`

### 6B. Edge Cases to Check

1. **All Fichilliumorite:** Weighted average should use AVERAGEIFS fallback
2. **No lightning ore:** Lightning DPS should be 0, not NaN
3. **No Galaxite:** Black Hole DPS should be 0
4. **0% ore share:** All ore bonuses should be 0
5. **100% ore share:** Ore bonus should be at max value
6. **Achievement at new location:** Achievement bonuses should still apply

### 6C. Regression Tests

Run your existing test suite (if any) to ensure no existing functionality broke:

```bash
# If you have tests
npm test
# or
python -m pytest tests/
```

---

## CHECKLIST SUMMARY

### Data Updates
- [ ] Add 7 new ores to `Data:Ores.json`
- [ ] Add 1 new weapon to `Data:Weapons.json`
- [ ] Fix Tiger's Eye apostrophe

### Engine Updates
- [ ] Update VLOOKUP ranges (195→202, 80→81)
- [ ] Implement Fichilliumorite exclusion in weighted average
- [ ] Add ore power scaling system (I-K columns)
- [ ] Add weapon auto-select (optional)
- [ ] Add armor bonus inputs (C42-C44)
- [ ] Change C46/C48 to manual inputs
- [ ] Add Berserk input
- [ ] Update stat total formulas (E45-E48)
- [ ] Add Kitsunite to explosion/fire/smite formulas
- [ ] Update Archangel smite scaling (attack speed)
- [ ] Update poison duration (first Malachite only)
- [ ] Add Lightning DPS (C80-E81, E94)
- [ ] Update Berserk DPS (multiplicative)
- [ ] Update Total DPS (7 components)
- [ ] Update Max Burst DPS (include Lightning)

### UI Updates
- [ ] Add armor bonus input section
- [ ] Add Berserk input section
- [ ] Add Lightning DPS display row
- [ ] Update Total DPS label (7 components)
- [ ] Add traits display (optional)
- [ ] Update CSS for new sections

### Documentation Updates
- [ ] Update ore reference table
- [ ] Update cell reference documentation
- [ ] Add known issues section
- [ ] Document Archangel smite scaling change
- [ ] Document Berserk multiplicative change

### Verification
- [ ] Test Fichilliumorite exclusion
- [ ] Test Kitsunite Lightning DPS
- [ ] Test Archangel smite scaling
- [ ] Test Berserk multiplicative
- [ ] Test Malachite first-slot-only
- [ ] Test Total DPS = 7 components
- [ ] Run existing test suite

---

## IMPLEMENTATION ORDER

**Recommended order to minimize breakage:**

1. **Data layer** (ores, weapons) — no code impact yet
2. **Engine formulas** — update calculations
3. **UI inputs** — add new input fields
4. **UI displays** — add new result rows
5. **CSS styling** — polish new sections
6. **Documentation** — update wiki pages
7. **Testing** — run verification suite

**Total estimated effort:** 4-8 hours depending on your codebase structure.

---

## POST-IMPLEMENTATION

After completing all changes:

1. **Run verification suite** (Step 6)
2. **Take screenshot** of working calculator with new features
3. **Update CLAUDE.md** in your repo to reflect new version
4. **Commit and push** to version control
5. **Deploy to MediaWiki** following your normal deployment process
6. **Monitor for user feedback** on new DPS calculations

---

## QUESTIONS / AMBIGUITIES TO RESOLVE

Before implementing, confirm with your spreadsheet maintainer:

1. **Black Hole Radius (C82):** Is this a placeholder? Should it be implemented?
2. **L6-L9 inconsistent range:** Should column 4 VLOOKUP be updated to 202?
3. **Armor ores (Aether Lotus, Zephyte, Vooite):** Do they have traits not captured in DPS Calculator?
4. **Kitsunite conditional buff:** The "Physical DMG when HP < 35%" is not in DPS calc — intentional?
5. **Achievement C85:** Is this now a permanent location, or might it shift again?

---

**End of Implementation Plan**
