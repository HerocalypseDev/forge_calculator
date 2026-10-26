# Game (.rbxlx) vs Calculator Comparison

Date: 2026-10-26

## Prompt

> c:\Users\USER\OneDrive\Documents\01_Projects\omniroute-claude\Data\ForgeExtract    is the result of using  ascript to extract all formulars from thr rbxlx file of the game of this calcualt r& 'c:\Users\USER\Downloads\🎃 The Forge [Guilds]_76558904092080\🎃 The Forge [Guilds]_76558904092080.rbxlx' is the rblx file. now check the workspace calcualtor right now ad comapre with the results from the rbblx file and List out in a tabled form evetyhing tat is different

## Sources

- Game: `omniroute-claude/Data/ForgeExtract/out/scripts/ReplicatedStorage/Shared/Data/` (decompiled Lua):
  `Ore/**`, `Equipments.lua`, `Equipments/BaseTypes/Weapons/*`, `Races/*`, `Runes/Traits/**`,
  `Traits/Primary/**` (proc handlers), `Achievements.lua`, `Qualities.lua`.
- Calculator: `data/ores.json`, `data/weapons.json`, `data/races.json`, `data/runes.json`,
  `forge_calculator/engine.py` (mirrored by `Web/mediawiki/MediaWiki-ForgeCalculator.js`).
- The `.rbxlx` only contains client and shared scripts. Server scripts are absent, so some items
  cannot be verified (see section 5).

## 1. Ore data

| Ore | Field | Calculator | Game |
|---|---|---|---|
| Aite | multiplier | 1.0 | **1.1** |
| Arcane Crystal | multiplier | 7.5 | **9** |
| Fireite | burn chance (max) | 20% | **30%** |
| Gargantuan | burn chance (max) | 20% | **30%** |
| Kyubite | burn chance (max) | 45% | **40%** |
| Aetherit | weapon stats | equipment "Armor", no stats | **+8% attack speed** on weapon (ramps) |
| Kitsunite | lightning cooldown | ramps 0.3s → 3s | **flat 3s** (`{Value = 3}`, not scaled) |
| Marblite | lightning cooldown | ramps 0.5s → 5s | **flat 5s** |
| Kitsunite | smite damage below 10% share | ungated, 5% floor | normal 10% share gate, 5% → 50% |
| Bismuth | attack speed | ramps 1.8% → 18% | **flat 18%** |
| Bismuth | share gate | none (applies at any share) | **needs ≥10% share** like every ore (`GetRunesFromItem` skips shares < 0.1) |
| Bismuth | procs | flat explosion/fire/poison/lightning = T3 rune values ÷ 8 | **Prismatic Shift**: one random T3 rune always active (10s, cooldown 0, re-rolls on next hit) → each rune at full value ~1/4 of the time, not 1/8 |
| Galaxite + Bismuth | +125% | added into black hole damage | separate **Resonance** wave: 125% of hit, capped 200%, fires 1.45s after black hole, radius ×1.2 |
| Galaxite | black hole chance | any Galaxite slot gives 30% (COUNTIF quirk) | needs ≥10% share |
| Sealed Curse, Kokorite, Yin | Berserker trait | shown on weapon | **Armor-only** (whitelist) |
| Tiger's Eye / Wolfarite | move speed | missing | +5% / +6% on weapon (display only) |
| Names | spelling | Aurelia-No-Ki, Evil Eye Ore, Heart of the Island, Lagarite | Aurelia-no-Ki, Evil Eye, Heart Of The Island, Lgarite |
| Candy Ore, North Star | entry | missing | exist, ×1 multiplier (Candy is VisualOnly, North Star is Unobtainable) |

Game Bismuth T3 rune pool (Prismatic Shift): Venom Crumb (poison 16%/s, 12s, 77%), Blast Chip
(explosion 70%, 42%), Flame Spark (fire 26%/s, 4s, 60%), Thunder Shard (lightning 80%, 47%,
3s cooldown, 4 bounces).

## 2. Weapons

Game damage = base type `Damage` × variant `DamageMultiplier`. Game interval shown below is the
calculator's own base interval for the type divided by the variant's `AttackSpeedMultiplier`.

| Weapon | Calculator | Game |
|---|---|---|
| Colossal Gemblade | dmg 23 | **25** |
| Coffin Lid | dmg 25, interval 1.28 | **23**, no attack-speed multiplier (1.40) |
| Executioner's Greataxe | dmg 19.5 | **20.0** |
| Batwing Reaver | dmg 20.0, interval 1.35 | **19.5**, ×0.95 attack speed (1.70) |
| Knight Spear | dmg 7.5 | **10.125** |
| Thornspine | dmg 10.9, interval 0.58 | 10.875, no attack-speed multiplier (0.70) |
| The Carver | interval 1.02 | ×1.1 → **1.09** |
| Jack's Crest | interval 1.26 | ×1.1 → **1.09** |
| Demonic Spear | interval 0.73 | ×0.8 → **0.91** |
| Names only (values match) | Shark's Fang, Boxing Glove, DKG, Ornate short axe, Washimaru, Dark Knight Greatsword | Shark's Fangs, Boxing Gloves, Dark Knight's Gauntlets, Ornate Short Axe, Washi-maru, Dark Knight's Greatsword |

## 3. Races

| Race | Calculator | Game |
|---|---|---|
| Golem | +15% attack speed with Colossal Sword only | Colossal Sword **and Great Axe** |
| Dragonborn | burn chance = MAX(ore, rune) **+ 40%** | non-stackable: **MAX(ore, rune, 40%)** |
| Angel | smite chance = ore max **+ 50%** | **MAX(ore, 50%)** |
| Archangel | +33% smite chance, smite dmg MIN(50% × rate, 150%) | separate beam: 33% chance per hit, **10s cooldown**, 3 pulses × 50% flat weapon damage, AoE radius 8 |
| Minotaur | +30% berserk (separate multiplier) | Bull's Fury: +30% damage boost (same pool as lethality) + 30% speed, only at ≤50% HP |
| Demon | no fire | Fire trait: +20% fire damage (stacks), 3s, burn chance 0 (~1% actual, see proc chance) |
| Kitsune Fox Claws | 50% chance, 75%, ÷3, no attack-rate term | **25%** chance per hit (100% during Nine-Tailed Spirit), 3 slashes × 25% flat damage, max 3 spirits at once (~2.2s each) |
| Kitsune Foxfire | 2s, scales on unforged damage | **3s** (refresh resets to 3), 30% of damage after damage boost and moon |
| Orc Lord | Warbringer / Lord of War not modelled | +7.5% damage per 10% HP missing; +7.5% attack speed per kill (×5 stacks, 5s) |
| Demon | Cursed Aura / Devil's Finger not modelled | 10% weapon damage/s aura (radius 12); 45%/s dash circle |
| Dryad | inert | Barkskin: +15% crit chance, +15% crit damage in grove; Vital Power: +5% proc damage per 1,000 HP (max +50%) |
| `races.json` `default_trait` text | misaligned (e.g. Human "Physical Damage +5%") | Human is +3% luck/XP. Text is loaded but not used in DPS |

Race values that match: Orc Lord 40%, Archangel/Demon/Kitsune 20% lethality + 20% attack speed,
Dragonborn 12%, Orc 10%, Shadow 5% / 10%, Fairy + Spear 15% / 15%, Felynx + Gauntlet 20% / 20%,
Vampire + Straight Sword 10%, Goblin + Dagger 10%, Kitsune +15% crit damage, Orc Lord Titanic
Earthquake 25% / 100% / 10s.

## 4. Mechanics

| Mechanic | Calculator | Game |
|---|---|---|
| Black hole rate | MAX(1, attack rate) | **1s cooldown** → MIN(rate, 1); damage capped at 250% |
| Explosion cap | 250% per slot, then summed, plus Blast ability uncapped | **total** capped at 250% of hit |
| Poison duration | MIN(dur, 5) | clamp **1–15s**; re-proc adds dur/2; tick damage fixed by first proc |
| Fire re-proc | uptime approximation | adds dur/2 (cap 5s), keeps highest tick, MinTickDamage floor |
| Proc chance | chance% | `chance < random(0,100)` fails → P = (floor(chance)+1)/101, about +1 point on every proc |
| Berserker (input / trait) | separate ×(1+berserk) on weapon hit | damage boost added to lethality pool, ≤35% HP, 60s cooldown, cap 200% |
| Achievements | pick one | **all earned ones stack**. Two crit-chance achievements reach 35% each (70% total), plus damage 20% and attack speed 20% |
| Extra runes | crit chance/dmg/lethality 5–15%, attack speed 5–18% | T1–T3 up to 40% / 40% / 35% / 40% |

Game rune primary ranges (T1 / T2 / T3, Min–Max):

| Rune stat | T1 | T2 | T3 |
|---|---|---|---|
| FireDamage | 5–10 | 10–22 | 18–35 |
| BurnChance | 15–25 | 20–50 | 45–75 |
| BurnDuration | 1–2 | 2–3 | 3–5 |
| PoisonDamage | 4–7 | 7–13 | 13–20 |
| PoisonChance | 25–35 | 35–65 | 60–95 |
| PoisonDuration | 3–6 | 6–10 | 10–14 |
| ExplosionDamage | 20–40 | 40–60 | 60–80 |
| ExplosionChance | 8–20 | 20–35 | 35–50 |
| LightningDamage | 25–40 | 40–65 | 60–100 |
| LightningChance | 12–20 | 20–40 | 35–60 |
| LightningCooldown (lowest wins) | 8–12 | 4–8 | 2–4 |
| CriticalChance | 6–15 | 15–25 | 25–40 |
| CriticalDamage | 5–15 | 15–25 | 20–40 |
| DamageBoost | 5–15 | 12–23 | 20–35 |
| AttackSpeedBoost | 5–18 | 15–30 | 25–40 |

## 5. Cannot be verified (server scripts missing)

| Item | Note |
|---|---|
| Caps (lethality 300%, crit 100%, attack speed 150%) | not in shared code |
| Base swing interval per type | game `Info.AttackSpeed` is a display value (Dagger 0.35 vs calculator 0.47) |
| Weapon-type ore thresholds | not in client code |
| Which damage procs scale on (forged vs unforged) | handlers just receive `Damage` |
| `CalculateDamage` | decompiled code seems to drop the enhancement multiplier when a status is passed; likely a decompiler artifact, unconfirmed |

## 6. Confirmed matches

- Enhancement table 0–9: 1, 1.05 … 1.4, 1.5.
- Quality multiplier `1 + Q/100`.
- Base crit damage 1.45, base crit chance 0.
- Ore power: weighted average of multipliers by share, `NeutralMultiplier` ores (Bismuth,
  Fichilliumorite) excluded; neutral-only build uses their own multiplier.
- Trait ramp: `0.1 + 0.9 × (clamp(share, 0.1, 0.3) − 0.1) / 0.2`, nothing below 10% share.
- Stacking: damage stats sum, chance/duration take the max, lightning cooldown takes the min.
- Attack speed: variant `AttackSpeedMultiplier` × (1 + Σ attack-speed boosts).
