/** DPS pipeline (C84-C96, E91-E92) - ported from forge_calculator/engine.py
 * @module engine/dps
 */

import { CAPS, RACE_BERSERK } from './constants.js';
import { weaponBases, attackRate, critBlend, avgOrePower } from './formulas.js';
import { statTotals, calcOreContributions } from './stats.js';
import { procComponents } from './procs.js';
import { slotShares } from './formulas.js';
import { activeTraits } from './traits.js';

/**
 * Full DPS calculation
 * @param {Build} build
 * @param {GameData} game
 * @returns {CalculateResult}
 */
export function calculate(build, game) {
  const shares = slotShares(build.slots);
  const avgPower = avgOrePower(build.slots, game);

  const weapon = game._weapon_index?.get(build.weapon_name) ?? null;
  const [unforged, forged] = weaponBases(weapon, avgPower, build.quality, build.forge_level);
  const interval = weapon?.interval ?? 1.0;

  const oreContribs = calcOreContributions(build.slots, shares, game);
  const totals = statTotals(build, game, oreContribs);
  const atkRate = attackRate(weapon, totals.atk_speed);

  const blend = critBlend(
    build.base_crit_chance + totals.crit_chance,
    build.base_crit_dmg + totals.crit_dmg
  );

  const procs = procComponents(build, shares, game);

  // C84-C89 DPS components
  const weapon_dps = forged * (1 + totals.lethality) * blend * atkRate;
  const explosion_dps = unforged * procs.explosion_dmg * procs.explosion_chance * atkRate;
  const fire_dps = atkRate
    ? unforged * procs.fire_dmg * Math.min(1, procs.fire_chance * atkRate * Math.min(procs.fire_duration, 5))
    : 0.0;
  const poison_dps = atkRate
    ? unforged * procs.poison_dmg * Math.min(1, procs.poison_chance * atkRate * Math.min(procs.poison_duration, 5))
    : 0.0;
  const smite_dps = unforged * atkRate * procs.smite_dmg * Math.min(procs.smite_chance, 1);
  const blackhole_dps = unforged * procs.blackhole_dmg * procs.blackhole_chance * atkRate;
  const total_dps = weapon_dps + explosion_dps + fire_dps + poison_dps + smite_dps + blackhole_dps;

  // C92 Berserk: E53 = C53 + Minotaur 30%
  const berserkLevel = build.berserk + (RACE_BERSERK[build.race] ?? 0.0);
  let berserk = null;
  if (berserkLevel !== 0) {
    const lethBoosted = Math.min(totals.lethality + berserkLevel, CAPS.lethality);
    berserk = explosion_dps + fire_dps + poison_dps + smite_dps + blackhole_dps
      + forged * (1 + lethBoosted) * blend * atkRate;
  }

  // C93 Moonstone: E52 = 1 + C52, applied to weapon DPS only
  const moonstone = procs.moon !== 0 ? weapon_dps * (1 + procs.moon) : null;

  // C95 Min DPS / C96 Max Burst (procs on FORGED C18 - preserved quirk)
  const min_dps = forged * (1 + totals.lethality) * atkRate;
  const max_dps = forged * (1 + totals.lethality) * (build.base_crit_dmg + totals.crit_dmg) * atkRate
    + forged * procs.explosion_dmg * atkRate
    + forged * procs.fire_dmg
    + forged * procs.poison_dmg
    + procs.smite_dmg * forged
    + procs.blackhole_dmg * forged;

  // E91/E92 TTK
  const ttk_25k = total_dps > 0 ? 25000 / total_dps : null;
  const ttk_75k = total_dps > 0 ? 75000 / total_dps : null;

  return {
    avg_power: avgPower,
    unforged_damage: unforged,
    forged_damage: forged,
    interval,
    attack_rate: atkRate,
    lethality: totals.lethality,
    crit_chance: totals.crit_chance,
    crit_dmg: totals.crit_dmg,
    atk_speed: totals.atk_speed,
    crit_blend: blend,
    moon: procs.moon,
    explosion_dmg: procs.explosion_dmg,
    explosion_chance: procs.explosion_chance,
    fire_dmg: procs.fire_dmg,
    fire_chance: procs.fire_chance,
    fire_duration: procs.fire_duration,
    poison_dmg: procs.poison_dmg,
    poison_chance: procs.poison_chance,
    poison_duration: procs.poison_duration,
    smite_dmg: procs.smite_dmg,
    smite_chance: procs.smite_chance,
    blackhole_dmg: procs.blackhole_dmg,
    blackhole_chance: procs.blackhole_chance,
    weapon_dps,
    explosion_dps,
    fire_dps,
    poison_dps,
    smite_dps,
    blackhole_dps,
    total_dps,
    berserk,
    moonstone,
    min_dps,
    max_dps,
    ttk_25k,
    ttk_75k,
    active_traits: activeTraits(build, shares, game)
  };
}