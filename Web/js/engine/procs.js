/** Proc components (C52-C76) - ported from forge_calculator/engine.py
 * @module engine/procs
 */

import {
  SHARE_GATE,
  RACE_FIRE_DMG,
  RACE_FIRE_CHANCE,
  RACE_FIRE_TIME,
  RACE_SMITE_DMG,
  RACE_SMITE_CHANCE
} from './constants.js';
import { shareScaling } from './formulas.js';

/**
 * Duration calculation (C63/C68): MAX(MAX(ore, race, ability) - N, 0)
 * No ore gate, so an ability time alone counts.
 * @param {number[]} oreTerms
 * @param {number} raceTime
 * @param {number} abilityTime
 * @param {number} minus
 * @returns {number}
 */
function duration(oreTerms, raceTime, abilityTime, minus) {
  const top = Math.max(...oreTerms, raceTime ?? 0, abilityTime ?? 0);
  return Math.max(top - minus, 0.0);
}

/**
 * Black hole chance (C76)
 * IF(COUNTIF(C6:C9, "Galaxite") / COUNTA(C6:C9) >= 0.1, 0.3, 0)
 * COUNTA counts "Select Ore" as non-blank, so any Galaxite slot triggers it
 * @param {OreSlot[]} slots
 * @param {GameData} game
 * @returns {number}
 */
function blackholeChance(slots, game) {
  const galaxite = slots.filter(s => s.name === 'Galaxite').length;
  const nonblank = slots.filter(s => s.name).length; // "Select Ore" counts
  if (nonblank === 0) return 0.0;
  return galaxite / nonblank >= 0.1 ? 0.3 : 0.0;
}

/**
 * Get all scaled values for a stat across slots
 * @param {OreSlot[]} slots
 * @param {number[]} shares
 * @param {GameData} game
 * @param {string} stat
 * @returns {number[]}
 */
function slotVals(slots, shares, game, stat) {
  const vals = [];
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    const share = shares[i];
    if (share < SHARE_GATE || slot.name === game.select_ore) continue;
    const ore = game._ore_index?.get(slot.name);
    if (!ore) continue;
    const rng = ore.stats[stat];
    if (!rng) continue;
    vals.push(shareScaling(rng.base, rng.max, share, rng.divisor));
  }
  return vals;
}

/**
 * Max value for a stat across slots
 * @param {OreSlot[]} slots
 * @param {number[]} shares
 * @param {GameData} game
 * @param {string} stat
 * @returns {number}
 */
function slotMax(slots, shares, game, stat) {
  const vals = slotVals(slots, shares, game, stat);
  return vals.length ? Math.max(...vals) : 0.0;
}

/**
 * Sum of values for a stat across slots
 * @param {OreSlot[]} slots
 * @param {number[]} shares
 * @param {GameData} game
 * @param {string} stat
 * @returns {number}
 */
function slotSum(slots, shares, game, stat) {
  return slotVals(slots, shares, game, stat).reduce((a, b) => a + b, 0.0);
}

/**
 * Value of the FIRST slot holding `name` (C68 XLOOKUP; 0 when absent)
 * @param {OreSlot[]} slots
 * @param {number[]} shares
 * @param {GameData} game
 * @param {string} name
 * @param {string} stat
 * @returns {number}
 */
function firstSlotVal(slots, shares, game, name, stat) {
  for (let i = 0; i < slots.length; i++) {
    if (slots[i].name !== name) continue;
    const ore = game._ore_index?.get(name);
    const rng = ore?.stats[stat];
    if (!rng) return 0.0;
    return shareScaling(rng.base, rng.max, shares[i], rng.divisor);
  }
  return 0.0;
}

/**
 * All proc components (C52-C76)
 * These feed DPS rows C85-C89, which scale on UNFORGED A18
 * @param {Build} build
 * @param {number[]} shares
 * @param {GameData} game
 * @returns {Object}
 */
export function procComponents(build, shares, game) {
  const fireTerms = slotVals(build.slots, shares, game, 'fire_duration');

  return {
    moon: slotSum(build.slots, shares, game, 'moon'),
    explosion_dmg: slotSum(build.slots, shares, game, 'explosion_dmg') + build.abilities.blast_dmg,
    explosion_chance: Math.max(slotMax(build.slots, shares, game, 'explosion_chance'), build.abilities.blast_chance),
    fire_dmg: slotSum(build.slots, shares, game, 'fire_dmg')
      + (RACE_FIRE_DMG[build.race] ?? 0.0)
      + build.abilities.fire_dmg,
    fire_chance: Math.max(slotMax(build.slots, shares, game, 'fire_chance'), build.abilities.fire_chance)
      + (RACE_FIRE_CHANCE[build.race] ?? 0.0),
    fire_duration: duration(fireTerms, RACE_FIRE_TIME[build.race] ?? 0, build.abilities.fire_time, 1),
    poison_dmg: slotSum(build.slots, shares, game, 'poison_dmg') + build.abilities.poison_dmg,
    poison_chance: Math.max(slotMax(build.slots, shares, game, 'poison_chance'), build.abilities.poison_chance),
    poison_duration: duration([firstSlotVal(build.slots, shares, game, 'Malachite', 'poison_duration')], 0, build.abilities.poison_time, 2),
    smite_dmg: slotSum(build.slots, shares, game, 'smite_dmg') + (RACE_SMITE_DMG[build.race] ?? 0.0),
    smite_chance: Math.max(slotMax(build.slots, shares, game, 'smite_chance'), RACE_SMITE_CHANCE[build.race] ?? 0.0),
    blackhole_dmg: slotSum(build.slots, shares, game, 'blackhole_dmg'),
    blackhole_chance: blackholeChance(build.slots, game)
  };
}