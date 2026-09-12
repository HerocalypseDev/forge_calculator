
export const SHARE_GATE = 0.10;
export const RAMP_TOP = 0.30;
export const RAMP_SPAN = RAMP_TOP - SHARE_GATE;

export const FORGE_MULT = {
  0: 1.0, 1: 1.05, 2: 1.1, 3: 1.15, 4: 1.2,
  5: 1.25, 6: 1.3, 7: 1.35, 8: 1.4, 9: 1.5
};

export const RACE_LETHALITY = {
  'Archangel': 0.20,
  'Demon': 0.20,
  'Orc': 0.10,
  'Shadow': 0.05,
  'Dragonborn': 0.12
};

export const CLASS_LETHALITY = {
  'Felynx,Gauntlet': 0.20,
  'Felynx,Gauntlets': 0.20,
  'Vampire,Straight Sword': 0.10
};

export const RACE_ATK_SPEED = {
  'Shadow': 0.10,
  'Demon': 0.20,
  'Archangel': 0.20
};

export const CLASS_ATK_SPEED = {
  'Goblin,Dagger': 0.10,
  'Golem,Colossal Sword': 0.15,
  'Golem,Great Axe': 0.15,
  'Felynx,Gauntlet': 0.20,
  'Felynx,Gauntlets': 0.20
};

export const RACE_FIRE_DMG = { 'Dragonborn': 0.30 };
export const RACE_FIRE_CHANCE = { 'Dragonborn': 0.40 };
export const RACE_FIRE_TIME = { 'Dragonborn': 3 };

export const RACE_SMITE_DMG = { 'Angel': 0.30 };
export const RACE_SMITE_CHANCE = { 'Angel': 0.50, 'Archangel': 0.33 };

export const RACE_BERSERK = { 'Minotaur': 0.30 };

export const CAPS = {
  lethality: 1.5,
  crit_chance: 1.0,
  crit_dmg: 1.0,
  atk_speed: 1.5
};

export const TRAIT_POWER_SLOPE = 4.5;
export const TRAIT_POWER_FLOOR = 0.1;

export const CORE_STATS = ['lethality', 'crit_chance', 'crit_dmg', 'atk_speed'];