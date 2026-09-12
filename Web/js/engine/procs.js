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
import { scaleRange, belowGate } from './formulas.js';

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
    if (slot.name === game.select_ore) continue;
    const ore = game._ore_index?.get(slot.name);
    if (!ore) continue;
    const rng = ore.stats[stat];
    if (!rng) continue;
    if (belowGate(rng, share)) continue;
    vals.push(scaleRange(rng, share));
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
 * Value of the FIRST slot holding `name` (C69 XLOOKUP; 0 when absent)
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
    return scaleRange(rng, shares[i]);
  }
  return 0.0;
}

/**
 * C72's race addends: Angel is flat 30%, Archangel instead scales with attack
 * speed -- IF(C22="Archangel", MIN(FLOOR(E21,1)*0.5, 1.5), 0), i.e. half a point
 * per WHOLE attack per second (a step, not a ramp), capped at 150%. Below
 * 1 hit/sec an Archangel gets nothing.
 * @param {string} race
 * @param {number} atkRate
 * @returns {number}
 */
function smiteRaceDmg(race, atkRate) {
  if (race === 'Archangel') return Math.min(Math.floor(atkRate) * 0.5, 1.5);
  return RACE_SMITE_DMG[race] ?? 0.0;
}

/**
 * E80 -- the shortest lightning cooldown, or 0 when there is none.
 * The sheet uses 99 as a "no lightning here" sentinel per slot and for an empty
 * E36, then maps a surviving 99 back to 0; omitting absent terms is equivalent.
 * @param {number[]} oreTerms
 * @param {number} abilityCooldown
 * @returns {number}
 */
function lightningCooldown(oreTerms, abilityCooldown) {
  const terms = oreTerms.slice();
  if (abilityCooldown) terms.push(abilityCooldown);
  return terms.length ? Math.min(...terms) : 0.0;
}

/**
 * All proc components (C53-C81)
 * These feed DPS rows C90-C94/E94, which scale on UNFORGED A18.
 *
 * Note which cells aggregate across slots and which take the best slot: the
 * explosion pair (C58/C59) SUMS -- C59 is written SUM(slot1..slot4, D37) --
 * while fire, poison, smite and lightning chance all take a MAX. For smite,
 * the race addend is ADDED on top rather than maxed against.
 * @param {Build} build
 * @param {number[]} shares
 * @param {GameData} game
 * @param {number} [atkRate=0] E21, needed only by the Archangel smite addend
 * @returns {Object}
 */
export function procComponents(build, shares, game, atkRate = 0) {
  const fireTerms = slotVals(build.slots, shares, game, 'fire_duration');

  return {
    moon: slotSum(build.slots, shares, game, 'moon'),
    explosion_dmg: slotSum(build.slots, shares, game, 'explosion_dmg') + build.abilities.blast_dmg,
    explosion_chance: slotSum(build.slots, shares, game, 'explosion_chance') + build.abilities.blast_chance,
    fire_dmg: slotSum(build.slots, shares, game, 'fire_dmg')
      + (RACE_FIRE_DMG[build.race] ?? 0.0)
      + build.abilities.fire_dmg,
    fire_chance: Math.max(slotMax(build.slots, shares, game, 'fire_chance'), build.abilities.fire_chance)
      + (RACE_FIRE_CHANCE[build.race] ?? 0.0),
    fire_duration: duration(fireTerms, RACE_FIRE_TIME[build.race] ?? 0, build.abilities.fire_time, 1),
    poison_dmg: slotSum(build.slots, shares, game, 'poison_dmg') + build.abilities.poison_dmg,
    poison_chance: Math.max(slotMax(build.slots, shares, game, 'poison_chance'), build.abilities.poison_chance),
    poison_duration: duration([firstSlotVal(build.slots, shares, game, 'Malachite', 'poison_duration')], 0, build.abilities.poison_time, 2),
    smite_dmg: slotSum(build.slots, shares, game, 'smite_dmg') + smiteRaceDmg(build.race, atkRate),
    smite_chance: slotMax(build.slots, shares, game, 'smite_chance') + (RACE_SMITE_CHANCE[build.race] ?? 0.0),
    blackhole_dmg: slotSum(build.slots, shares, game, 'blackhole_dmg'),
    blackhole_chance: blackholeChance(build.slots, game),
    lightning_dmg: slotSum(build.slots, shares, game, 'lightning_dmg') + build.abilities.lightning_dmg,
    lightning_chance: Math.max(slotMax(build.slots, shares, game, 'lightning_chance'), build.abilities.lightning_chance),
    lightning_cooldown: lightningCooldown(
      slotVals(build.slots, shares, game, 'lightning_cooldown'),
      build.abilities.lightning_cooldown
    )
  };
}