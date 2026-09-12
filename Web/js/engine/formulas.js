
import {
  SHARE_GATE,
  RAMP_SPAN,
  FORGE_MULT
} from './constants.js';

export function shareScaling(base, max, share, divisor = 100, rng = undefined) {
  const gated = !(rng && rng.gated === false);
  if (gated && share < SHARE_GATE) return 0.0;
  let value = base + (max - base) * Math.min((share - SHARE_GATE) / RAMP_SPAN, 1.0);
  value /= divisor;
  if (rng && typeof rng.ceiling === 'number') value = Math.min(rng.ceiling, value);
  if (rng && typeof rng.floor === 'number') value = Math.max(rng.floor, value);
  return value;
}

export function scaleRange(rng, share) {
  return shareScaling(rng.base, rng.max, share, rng.divisor, rng);
}

export function belowGate(rng, share) {
  return rng.gated !== false && share < SHARE_GATE;
}

export function slotShares(slots) {
  const total = slots.reduce((sum, s) => sum + s.amount, 0);
  if (total === 0) return slots.map(() => 0.0);
  return slots.map(s => s.amount / total);
}

export function slotPower(slot, game) {
  if (slot.name === game.select_ore) return 1.0;
  const ore = game._ore_index?.get(slot.name);
  return ore?.multiplier ?? 1.0;
}

export function avgOrePower(slots, game) {
  const kept = slots.filter(s => s.name !== 'Fichilliumorite');
  const powers = kept.map(s => slotPower(s, game));
  const total = kept.reduce((sum, s) => sum + s.amount, 0);
  if (total !== 0) {
    return kept.reduce((sum, s, i) => sum + s.amount * powers[i], 0) / total;
  }
  if (powers.length > 0) {
    return powers.reduce((a, b) => a + b, 0) / powers.length;
  }
  return 1.0;
}

export function forgeMultiplier(level) {
  return FORGE_MULT[level] ?? 1.0;
}

export function weaponBases(weapon, avgPower, quality, forgeLevel) {
  if (!weapon) return [1.0, 1.0];
  const base = weapon.damage * avgPower * (1 + quality / 100.0);
  return [base, base * forgeMultiplier(forgeLevel)];
}

export function attackRate(weapon, atkSpeedTotal) {
  const interval = weapon?.interval ?? 1.0;
  return (1 + atkSpeedTotal) / interval;
}

export function critBlend(ccTotal, cdTotal) {
  const cc = Math.min(ccTotal, 1.0);
  return cc * cdTotal + (1 - cc);
}