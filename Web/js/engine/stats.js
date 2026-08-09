/** Stat aggregation - ported from forge_calculator/engine.py
 * @module engine/stats
 */

import {
  CORE_STATS,
  SHARE_GATE,
  CAPS,
  RACE_LETHALITY,
  CLASS_LETHALITY,
  RACE_ATK_SPEED,
  CLASS_ATK_SPEED
} from './constants.js';
import { shareScaling } from './formulas.js';
import { parseTrait } from '../utils/parse.js';

/**
 * Sum one stat's share-scaled contributions across slots
 * @param {OreSlot[]} slots
 * @param {number[]} shares
 * @param {GameData} game
 * @param {string} stat
 * @returns {number}
 */
function oreStatSum(slots, shares, game, stat) {
  let total = 0.0;
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    const share = shares[i];
    if (share < SHARE_GATE || slot.name === game.select_ore) continue;
    const ore = game._ore_index?.get(slot.name);
    if (!ore) continue;
    const rng = ore.stats[stat];
    if (!rng) continue;
    total += shareScaling(rng.base, rng.max, share, rng.divisor);
  }
  return total;
}

/**
 * Rune totals from 6 rune cells (A27-A31)
 * @param {string[]} runeCells
 * @returns {Object<string, number>}
 */
export function runeTotals(runeCells) {
  const totals = { lethality: 0.0, crit_chance: 0.0, crit_dmg: 0.0, atk_speed: 0.0 };
  for (const text of runeCells) {
    const parsed = parseTrait(text);
    if (parsed) {
      totals[parsed.stat] += parsed.value;
    }
  }
  return totals;
}

/**
 * Stat totals with caps (E44-E47)
 * @param {Build} build
 * @param {GameData} game
 * @param {Object<string, number>} oreContribs
 * @returns {Object<string, number>}
 */
export function statTotals(build, game, oreContribs) {
  const runes = runeTotals(build.rune_cells);
  const ach = parseTrait(build.achievement);
  const achStat = ach?.stat ?? null;
  const achValue = ach?.value ?? 0.0;

  // Lethality (E44) - includes armor_lethality (C43), base_lethality (A44),
  // race/class bonuses, and achievement
  let lethality = oreContribs.lethality
    + build.armor_lethality
    + runes.lethality
    + build.base_lethality
    + (RACE_LETHALITY[build.race] ?? 0.0)
    + (CLASS_LETHALITY[`${build.race},${build.bonus_weapon_type}`] ?? 0.0)
    + (achStat === 'lethality' ? achValue : 0.0);

  // Crit Chance (E45) - includes armor_crit_chance (C41)
  // Note: base_crit_chance (C20) enters ONLY the crit blend, not E45
  let crit_chance = oreContribs.crit_chance
    + build.armor_crit_chance
    + runes.crit_chance
    + (achStat === 'crit_chance' ? achValue : 0.0);

  // Crit Damage (E46) - includes armor_crit_dmg (C42)
  let crit_dmg = oreContribs.crit_dmg
    + build.armor_crit_dmg
    + runes.crit_dmg;

  // Attack Speed (E47) - includes race/class bonuses and achievement
  let atk_speed = oreContribs.atk_speed
    + runes.atk_speed
    + (RACE_ATK_SPEED[build.race] ?? 0.0)
    + (CLASS_ATK_SPEED[`${build.race},${build.bonus_weapon_type}`] ?? 0.0)
    + (achStat === 'atk_speed' ? achValue : 0.0);

  return {
    lethality: Math.min(lethality, CAPS.lethality),
    crit_chance: Math.min(crit_chance, CAPS.crit_chance),
    crit_dmg: Math.min(crit_dmg, CAPS.crit_dmg),
    atk_speed: Math.min(atk_speed, CAPS.atk_speed)
  };
}

/**
 * Calculate all ore contributions for core stats
 * @param {OreSlot[]} slots
 * @param {number[]} shares
 * @param {GameData} game
 * @returns {Object<string, number>}
 */
export function calcOreContributions(slots, shares, game) {
  const contribs = {};
  for (const stat of CORE_STATS) {
    contribs[stat] = oreStatSum(slots, shares, game, stat);
  }
  return contribs;
}