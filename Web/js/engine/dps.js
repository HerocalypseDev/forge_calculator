/** DPS pipeline (C89-C101, E94-E97) - ported from forge_calculator/engine.py
 * @module engine/dps
 */

import { CAPS, RACE_BERSERK } from './constants.js';
import { weaponBases, attackRate, critBlend, avgOrePower } from './formulas.js';
import { statTotals, calcOreContributions } from './stats.js';
import { procComponents } from './procs.js';
import { slotShares } from './formulas.js';
import { activeTraits } from './traits.js';
import { normalizeBuild } from './normalize.js';

/**
 * Full DPS calculation
 * @param {Build} build
 * @param {GameData} game
 * @returns {CalculateResult}
 */
export function calculate(build, game) {
  build = normalizeBuild(build);
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

  const procs = procComponents(build, shares, game, atkRate);

  // C89-C94 + E94 DPS components
  const weapon_dps = forged * (1 + totals.lethality) * blend * atkRate;
  const explosion_dps = unforged * procs.explosion_dmg * procs.explosion_chance * atkRate;
  const fire_dps = atkRate
    ? unforged * procs.fire_dmg * Math.min(1, procs.fire_chance * atkRate * Math.min(procs.fire_duration, 5))
    : 0.0;
  const poison_dps = atkRate
    ? unforged * procs.poison_dmg * Math.min(1, procs.poison_chance * atkRate * Math.min(procs.poison_duration, 5))
    : 0.0;
  const smite_dps = unforged * atkRate * procs.smite_dmg * Math.min(procs.smite_chance, 1);
  // E77 floors the rate term at 1 -- MAX(1,E21), not MIN
  const blackhole_dps = unforged * procs.blackhole_dmg * procs.blackhole_chance * Math.max(1, atkRate);
  // E81 -- procs are capped by the cooldown: MIN(E21, 1/E80)
  const lightningProcCap = procs.lightning_cooldown > 0
    ? Math.min(atkRate, 1.0 / procs.lightning_cooldown)
    : atkRate;
  const lightning_dps = atkRate
    ? unforged * procs.lightning_dmg * procs.lightning_chance * lightningProcCap
    : 0.0;
  const total_dps = weapon_dps + explosion_dps + fire_dps + poison_dps + smite_dps + blackhole_dps + lightning_dps;
  const proc_total = total_dps - weapon_dps;

  // C97 -- ((E19 * (1 + C54)) * E21) + SUM(C90:C94) + E94. E19*E21 is exactly
  // C89, so berserk is one clean multiplier on the physical hit: it does NOT
  // boost lethality, and the lethality cap never applies to it. E54 adds Minotaur.
  const berserkLevel = build.berserk + (RACE_BERSERK[build.race] ?? 0.0);
  const berserk = berserkLevel !== 0 ? weapon_dps * (1 + berserkLevel) + proc_total : null;

  // C98 -- IF(C53=0, C96, (C89 * (1 + C53)) + C90..C94 + E94): the moon bonus
  // lifts the physical hit, then every proc is added back on top.
  const moonstone = procs.moon !== 0 ? weapon_dps * (1 + procs.moon) + proc_total : null;

  // C100 Min DPS / C101 Max Burst (procs on FORGED C18 - preserved quirk)
  const min_dps = forged * (1 + totals.lethality) * atkRate;
  const max_dps = forged * (1 + totals.lethality) * (build.base_crit_dmg + totals.crit_dmg) * atkRate
    + forged * procs.explosion_dmg * atkRate
    + forged * procs.fire_dmg
    + forged * procs.poison_dmg
    + forged * procs.lightning_dmg * procs.lightning_chance * atkRate
    + procs.smite_dmg * forged
    + procs.blackhole_dmg * forged;

  // E96/E97 TTK
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
    lightning_dmg: procs.lightning_dmg,
    lightning_chance: procs.lightning_chance,
    weapon_dps,
    explosion_dps,
    fire_dps,
    poison_dps,
    smite_dps,
    blackhole_dps,
    lightning_dps,
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