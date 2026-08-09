/** Core math formulas - ported from forge_calculator/engine.py
 * @module engine/formulas
 */

import {
  SHARE_GATE,
  RAMP_SPAN,
  FORGE_MULT
} from './constants.js';

/**
 * Share scaling formula
 * IF(share < 0.1, 0, (base + (max - base) * MIN((share - 0.1) / 0.2, 1)) / divisor)
 * @param {number} base
 * @param {number} max
 * @param {number} share
 * @param {number} [divisor=100]
 * @returns {number}
 */
export function shareScaling(base, max, share, divisor = 100) {
  if (share < SHARE_GATE) return 0.0;
  const value = base + (max - base) * Math.min((share - SHARE_GATE) / RAMP_SPAN, 1.0);
  return value / divisor;
}

/**
 * Calculate slot shares (J6:J9)
 * Each slot's share of total amount (0 when total is 0)
 * @param {OreSlot[]} slots
 * @returns {number[]}
 */
export function slotShares(slots) {
  const total = slots.reduce((sum, s) => sum + s.amount, 0);
  if (total === 0) return slots.map(() => 0.0);
  return slots.map(s => s.amount / total);
}

/**
 * Get ore power multiplier for a slot (E6:E9)
 * "Select Ore" and missing ores resolve to 1
 * @param {OreSlot} slot
 * @param {GameData} game
 * @returns {number}
 */
export function slotPower(slot, game) {
  if (slot.name === game.select_ore) return 1.0;
  const ore = game._ore_index?.get(slot.name);
  return ore?.multiplier ?? 1.0;
}

/**
 * Average ore power (E10)
 * SUMPRODUCT(D6:D9, E6:E9) / SUM(D6:D9) with fallback to AVERAGE(E6:E9)
 * @param {OreSlot[]} slots
 * @param {GameData} game
 * @returns {number}
 */
export function avgOrePower(slots, game) {
  const powers = slots.map(s => slotPower(s, game));
  const total = slots.reduce((sum, s) => sum + s.amount, 0);
  if (total !== 0) {
    return slots.reduce((sum, s, i) => sum + s.amount * powers[i], 0) / total;
  }
  return powers.length ? powers.reduce((a, b) => a + b, 0) / powers.length : 0.0;
}

/**
 * Forge multiplier from level (C18 SWITCH)
 * Falls through to default 1 outside levels 0-9
 * @param {number} level
 * @returns {number}
 */
export function forgeMultiplier(level) {
  return FORGE_MULT[level] ?? 1.0;
}

/**
 * Weapon base damages (A18 unforged, C18 forged)
 * Both: damage * avg_power * (1 + quality/100)
 * Forged additionally multiplies by forge multiplier
 * @param {Weapon|null} weapon
 * @param {number} avgPower
 * @param {number} quality
 * @param {number} forgeLevel
 * @returns {[number, number]} [unforged, forged]
 */
export function weaponBases(weapon, avgPower, quality, forgeLevel) {
  if (!weapon) return [1.0, 1.0];
  const base = weapon.damage * avgPower * (1 + quality / 100.0);
  return [base, base * forgeMultiplier(forgeLevel)];
}

/**
 * Attack rate (E21) = (1 + atk_speed_total) / interval
 * @param {Weapon|null} weapon
 * @param {number} atkSpeedTotal
 * @returns {number}
 */
export function attackRate(weapon, atkSpeedTotal) {
  const interval = weapon?.interval ?? 1.0;
  return (1 + atkSpeedTotal) / interval;
}

/**
 * Crit blend multiplier (part of C84)
 * MIN(cc, 1) * cd + (1 - MIN(cc, 1))
 * @param {number} ccTotal
 * @param {number} cdTotal
 * @returns {number}
 */
export function critBlend(ccTotal, cdTotal) {
  const cc = Math.min(ccTotal, 1.0);
  return cc * cdTotal + (1 - cc);
}