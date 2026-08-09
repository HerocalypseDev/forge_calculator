/** Active traits (C14) - ported from forge_calculator/engine.py
 * @module engine/traits
 */

import { SHARE_GATE, TRAIT_POWER_SLOPE, TRAIT_POWER_FLOOR } from './constants.js';

/**
 * Active weapon trait text (C14)
 * @param {Build} build
 * @param {number[]} shares
 * @param {GameData} game
 * @returns {string}
 */
export function activeTraits(build, shares, game) {
  const parts = [];
  for (let i = 0; i < build.slots.length; i++) {
    const slot = build.slots[i];
    const share = shares[i];
    if (slot.name === game.select_ore || share < SHARE_GATE) continue;
    const ore = game._ore_index?.get(slot.name);
    if (!ore || !ore.is_weapon) continue;

    const power = Math.min(
      Math.max((share - SHARE_GATE) * TRAIT_POWER_SLOPE + TRAIT_POWER_FLOOR, TRAIT_POWER_FLOOR),
      1.0
    );

    let text = '';
    if (share >= 0.3) {
      text = ore.trait30 ?? '';
    } else {
      const trait10 = ore.trait10 ?? '';
      if (trait10) {
        text = `[${(power * 100).toFixed(1)}% power] ${trait10}`;
      }
    }
    if (text) parts.push(text);
  }
  return parts.length ? parts.join(' | ') : 'No active weapon traits';
}