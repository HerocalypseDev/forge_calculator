/** Engine constants - direct port from forge_calculator/engine.py
 * @module engine/constants
 */

// Share scaling gate and ramp
export const SHARE_GATE = 0.10;
export const RAMP_TOP = 0.30;
export const RAMP_SPAN = RAMP_TOP - SHARE_GATE; // 0.20

// Forge multiplier SWITCH (C18) - level 9 = 1.5 breaks the 0.05/level pattern
export const FORGE_MULT = {
  0: 1.0, 1: 1.05, 2: 1.1, 3: 1.15, 4: 1.2,
  5: 1.25, 6: 1.3, 7: 1.35, 8: 1.4, 9: 1.5
};

// Race lethality addends (E44 SWITCH)
export const RACE_LETHALITY = {
  'Archangel': 0.20,
  'Demon': 0.20,
  'Orc': 0.10,
  'Shadow': 0.05,
  'Dragonborn': 0.12
};

// Class lethality addends (E44 IFS) - SINGULAR "Gauntlet" (quirk)
export const CLASS_LETHALITY = {
  'Felynx,Gauntlet': 0.20,
  'Vampire,Straight Sword': 0.10
};

// Race attack speed addends (E47 SWITCH)
export const RACE_ATK_SPEED = {
  'Shadow': 0.10,
  'Demon': 0.20,
  'Archangel': 0.20
};

// Class attack speed addends (E47 IFS) - PLURAL "Gauntlets" (quirk)
export const CLASS_ATK_SPEED = {
  'Goblin,Dagger': 0.10,
  'Golem,Colossal Sword': 0.15,
  'Golem,Great Axe': 0.15,
  'Felynx,Gauntlets': 0.20
};

// Dragonborn fire bonuses (C61/C62/C63)
export const RACE_FIRE_DMG = { 'Dragonborn': 0.30 };
export const RACE_FIRE_CHANCE = { 'Dragonborn': 0.40 };
export const RACE_FIRE_TIME = { 'Dragonborn': 3 };

// Smite bonuses (C71/C72)
export const RACE_SMITE_DMG = { 'Angel': 0.30, 'Archangel': 1.50 };
export const RACE_SMITE_CHANCE = { 'Angel': 0.50, 'Archangel': 0.33 };

// Minotaur berserk (E53)
export const RACE_BERSERK = { 'Minotaur': 0.30 };

// Stat caps (E44-E47)
export const CAPS = {
  lethality: 1.5,
  crit_chance: 1.0,
  crit_dmg: 1.0,
  atk_speed: 1.5
};

// Active trait power (K6-K9)
export const TRAIT_POWER_SLOPE = 4.5;
export const TRAIT_POWER_FLOOR = 0.1;

// Core stat keys
export const CORE_STATS = ['lethality', 'crit_chance', 'crit_dmg', 'atk_speed'];