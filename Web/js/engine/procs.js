
import {
  SHARE_GATE,
  RACE_FIRE_DMG,
  RACE_FIRE_CHANCE,
  RACE_FIRE_TIME,
  RACE_SMITE_DMG,
  RACE_SMITE_CHANCE
} from './constants.js';
import { scaleRange, belowGate } from './formulas.js';

function duration(oreTerms, raceTime, abilityTime, minus) {
  const top = Math.max(...oreTerms, raceTime ?? 0, abilityTime ?? 0);
  return Math.max(top - minus, 0.0);
}

function blackholeChance(slots, game) {
  const galaxite = slots.filter(s => s.name === 'Galaxite').length;
  const nonblank = slots.filter(s => s.name).length;
  if (nonblank === 0) return 0.0;
  return galaxite / nonblank >= 0.1 ? 0.3 : 0.0;
}

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

function slotMax(slots, shares, game, stat) {
  const vals = slotVals(slots, shares, game, stat);
  return vals.length ? Math.max(...vals) : 0.0;
}

function slotSum(slots, shares, game, stat) {
  return slotVals(slots, shares, game, stat).reduce((a, b) => a + b, 0.0);
}

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

function smiteRaceDmg(race, atkRate) {
  if (race === 'Archangel') return Math.min(Math.floor(atkRate) * 0.5, 1.5);
  return RACE_SMITE_DMG[race] ?? 0.0;
}

function lightningCooldown(oreTerms, abilityCooldown) {
  const terms = oreTerms.slice();
  if (abilityCooldown) terms.push(abilityCooldown);
  return terms.length ? Math.min(...terms) : 0.0;
}

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