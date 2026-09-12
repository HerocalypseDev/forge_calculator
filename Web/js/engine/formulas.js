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
 *
 * `rng` carries the two optional modifiers some cells wrap around the ramp:
 * `gated === false` drops the 10% guard (Kitsunite smite damage), and
 * `floor`/`ceiling` apply that cell's MAX(f, MIN(c, ramp)) after the divisor.
 * @param {number} base
 * @param {number} max
 * @param {number} share
 * @param {number} [divisor=100]
 * @param {StatRange} [rng]
 * @returns {number}
 */
export function shareScaling(base, max, share, divisor = 100, rng = undefined) {
  const gated = !(rng && rng.gated === false);
  if (gated && share < SHARE_GATE) return 0.0;
  let value = base + (max - base) * Math.min((share - SHARE_GATE) / RAMP_SPAN, 1.0);
  value /= divisor;
  if (rng && typeof rng.ceiling === 'number') value = Math.min(rng.ceiling, value);
  if (rng && typeof rng.floor === 'number') value = Math.max(rng.floor, value);
  return value;
}

/**
 * shareScaling for a StatRange, honouring its modifiers.
 * @param {StatRange} rng
 * @param {number} share
 * @returns {number}
 */
export function scaleRange(rng, share) {
  return shareScaling(rng.base, rng.max, share, rng.divisor, rng);
}

/**
 * True when an ore's stat contributes nothing at this share.
 * Ungated stats (Kitsunite smite damage) still pay out below the 10% gate.
 * @param {StatRange} rng
 * @param {number} share
 * @returns {boolean}
 */
export function belowGate(rng, share) {
  return rng.gated !== false && share < SHARE_GATE;
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
 *
 * IFERROR(IFERROR(SUMPRODUCT(D6:D9, E6:E9, (C6:C9<>"Fichilliumorite")*1)
 *   / SUMIFS(D6:D9, C6:C9, "<>Fichilliumorite"),
 *   AVERAGEIFS(E6:E9, C6:C9, "<>Fichilliumorite")), 1)
 *
 * Fichilliumorite drops out of both the numerator and the denominator, so it is
 * filler that never dilutes the average.
 * @param {OreSlot[]} slots
 * @param {GameData} game
 * @returns {number}
 */
export function avgOrePower(slots, game) {
  const kept = slots.filter(s => s.name !== 'Fichilliumorite');
  const powers = kept.map(s => slotPower(s, game));
  const total = kept.reduce((sum, s) => sum + s.amount, 0);
  if (total !== 0) {
    return kept.reduce((sum, s, i) => sum + s.amount * powers[i], 0) / total;
  }
  // 0/0 in the sheet -> the AVERAGEIFS fallback over the same kept multipliers
  if (powers.length > 0) {
    return powers.reduce((a, b) => a + b, 0) / powers.length;
  }
  // nothing left at all -> the outer IFERROR's 1
  return 1.0;
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