/** Regression test: normalizeBuild guards calculate() against missing build fields
 * Missing ability/armor/rune fields must resolve to 0 (not NaN), and
 * base_crit_dmg must default to workbook C21 = 1.45 — never ∞ TTK.
 * Run: node --input-type=module Web/js/engine/normalize.test.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { calculate } from './index.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(HERE, '..', '..', 'data');

function loadJSON(name) {
  return JSON.parse(fs.readFileSync(path.join(DATA, name), 'utf8'));
}

/** Replicate loader.js buildIndexes + data shaping (no fetch needed under node) */
function buildGame() {
  const rawOres = loadJSON('ores.json');
  const rawWeapons = loadJSON('weapons.json');
  const rawRaces = loadJSON('races.json');
  const rawRunes = loadJSON('runes.json');
  const rawAchievements = loadJSON('achievements.json');

  const ores = rawOres.ores.map(raw => ({
    name: raw.name,
    multiplier: raw.multiplier,
    equipment: raw.equipment ?? null,
    trait10: raw.trait10 ?? null,
    trait30: raw.trait30 ?? null,
    comments: raw.comments ?? null,
    stats: raw.stats ?? {}
  }));
  const weapons = rawWeapons.weapons.map(raw => ({
    name: raw.name,
    type: raw.type,
    interval: raw.interval,
    damage: raw.damage
  }));

  const game = {
    ores,
    weapons,
    races: rawRaces.races.map(r => ({
      name: r.name,
      default_trait: r.default_trait ?? null,
      available_traits: r.available_traits ?? []
    })),
    runes: rawRunes.runes.map(r => ({ name: r.name, stat: r.stat ?? null, value: r.value ?? null })),
    achievements: rawAchievements.achievements.map(a => ({ name: a.name, stat: a.stat ?? null, value: a.value ?? null })),
    weapon_types: rawWeapons.types ?? [],
    race_bonus_types: rawWeapons.race_bonus_types ?? [],
    select_ore: rawOres.select_ore ?? 'Select Ore',
    none_label: rawRunes.none ?? 'None',
    constants: {
      selectOreLabel: rawOres.select_ore ?? 'Select Ore',
      noneLabel: rawRunes.none ?? 'None'
    }
  };
  game._ore_index = new Map(game.ores.map(o => [o.name, o]));
  game._weapon_index = new Map(game.weapons.map(w => [w.name, w]));
  game._race_index = new Map(game.races.map(r => [r.name, r]));
  return game;
}

const game = buildGame();

let failures = 0;
function check(cond, msg) {
  if (cond) {
    console.log(`  PASS ${msg}`);
  } else {
    failures++;
    console.error(`  FAIL ${msg}`);
  }
}

console.log('== normalizeBuild regression checks ==');

// A real build with abilities, armor fields, rune_cells, achievement and
// base_crit_dmg ALL OMITTED — the shape that used to produce NaN / ∞ TTK.
const partial = {
  slots: [
    { name: 'Stone', amount: 20 },
    { name: 'Fireite', amount: 20 },
    { name: 'None', amount: 0 },
    { name: 'None', amount: 0 }
  ],
  weapon_name: 'Ironhand',
  quality: 100,
  forge_level: 0,
  race: 'Demon',
  bonus_weapon_type: 'Gauntlet'
};

// 1. Partial build -> every output finite
const r = calculate(partial, game);
check(Number.isFinite(r.total_dps), 'partial build: total_dps finite');
check(Number.isFinite(r.ttk_25k), 'partial build: ttk_25k finite');
check(Number.isFinite(r.ttk_75k), 'partial build: ttk_75k finite');
check(Number.isFinite(r.weapon_dps), 'partial build: weapon_dps finite');
check(Number.isFinite(r.fire_dps), 'partial build: fire_dps finite');
check(Number.isFinite(r.poison_dps), 'partial build: poison_dps finite');
check(Number.isFinite(r.crit_chance), 'partial build: crit_chance finite');
check(Number.isFinite(r.crit_dmg), 'partial build: crit_dmg finite');
check(Number.isFinite(r.attack_rate), 'partial build: attack_rate finite');
check(r.ttk_25k > 0, 'partial build: ttk_25k > 0');

// 2. Missing fields == explicit zeros (absent input cell is 0 in the workbook)
const zeroed = calculate({
  ...partial,
  rune_cells: ['None', 'None', 'None', 'None', 'None', 'None'],
  base_crit_dmg: 1.45,
  armor_crit_chance: 0,
  armor_crit_dmg: 0,
  armor_lethality: 0,
  base_lethality: 0,
  abilities: {
    fire_dmg: 0, fire_chance: 0, fire_time: 0,
    poison_dmg: 0, poison_chance: 0, poison_time: 0,
    blast_dmg: 0, blast_chance: 0
  },
  berserk: 0,
  achievement: 'None'
}, game);
check(r.total_dps === zeroed.total_dps, 'missing fields == explicit zeros (same total_dps)');

// 3. Empty / slotless builds never throw, never NaN
const empty = calculate({}, game);
check(Number.isFinite(empty.total_dps) && empty.ttk_25k > 0, 'calculate({}) finite with positive TTK');
const slotless = calculate({ slots: [] }, game);
check(Number.isFinite(slotless.total_dps) && slotless.ttk_25k > 0, 'calculate({slots:[]}) finite with positive TTK');

// 4. base_crit_dmg defaults to 1.45 when omitted -> blend 1.45 at capped crit
const capped = calculate({
  slots: [
    { name: 'Stone', amount: 20 },
    { name: 'Fireite', amount: 20 },
    { name: 'None', amount: 0 },
    { name: 'None', amount: 0 }
  ],
  weapon_name: 'Ironhand',
  quality: 100,
  forge_level: 0,
  race: 'Demon',
  bonus_weapon_type: 'Gauntlet',
  armor_crit_chance: 1.0
}, game);
check(capped.crit_blend === 1.45, 'base_crit_dmg defaults to 1.45 (blend 1.45 at capped crit)');

console.log(failures === 0 ? '\nALL NORMALIZE CHECKS PASSED ✓' : `\n${failures} CHECK(S) FAILED ✗`);
process.exit(failures === 0 ? 0 : 1);
