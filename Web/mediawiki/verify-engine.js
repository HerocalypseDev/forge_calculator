'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const HERE = __dirname;
const SRC = fs.readFileSync(path.join(HERE, 'MediaWiki-ForgeCalculator.js'), 'utf8');

const marker = 'var DATA_TITLES = {';
const idx = SRC.indexOf(marker);
if (idx < 0) { throw new Error('DATA LOADING marker not found'); }
const blockStart = SRC.lastIndexOf('\n', idx) + 1;
const instrumented = SRC.slice(0, blockStart) +
  '  globalThis.__FC = { calculate: calculate, buildGameData: buildGameData };\n' +
  SRC.slice(blockStart);

const mw = {
  config: { get: () => '/w' },
  loader: { using: () => Promise.resolve() },
  log: () => {},
  Api: function () {},
  hook: () => ({ fire: () => {} })
};

const sandbox = {
  console: console,
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
  window: null,
  document: {
    readyState: 'complete',
    getElementById: () => null,
    addEventListener: () => {}
  }
};
sandbox.window = sandbox;
sandbox.window.mediaWiki = mw;

vm.createContext(sandbox);
vm.runInContext(instrumented, sandbox, { filename: 'MediaWiki-ForgeCalculator.js' });

const FC = sandbox.__FC;
if (!FC) { throw new Error('Export hook did not run — engine extraction failed'); }

function loadJSON(name) {
  return JSON.parse(fs.readFileSync(path.join(HERE, name), 'utf8'));
}
const game = FC.buildGameData({
  ores: loadJSON('Data-Ores.json'),
  weapons: loadJSON('Data-Weapons.json'),
  races: loadJSON('Data-Races.json'),
  runes: loadJSON('Data-Runes.json'),
  achievements: loadJSON('Data-Achievements.json')
});

let failures = 0;

function approx(actual, expected, label) {
  const rel = Math.abs(actual - expected) / Math.max(Math.abs(expected), 1e-9);
  const ok = rel <= 1e-6;
  if (!ok) {
    failures++;
    console.log(`  FAIL ${label}: expected ${expected}, got ${actual} (rel ${rel.toExponential(2)})`);
  }
  return ok;
}

function build(args) {
  return Object.assign({
    slots: [ { name: 'None', amount: 0 }, { name: 'None', amount: 0 }, { name: 'None', amount: 0 }, { name: 'None', amount: 0 } ],
    weapon_name: '',
    quality: 0,
    forge_level: 0,
    race: '',
    bonus_weapon_type: '',
    rune_cells: [],
    base_crit_chance: 0,
    base_crit_dmg: 1.45,
    armor_crit_chance: 0,
    armor_crit_dmg: 0,
    armor_lethality: 0,
    base_lethality: 0,
    abilities: { fire_dmg: 0, fire_chance: 0, fire_time: 0, poison_dmg: 0, poison_chance: 0, poison_time: 0, blast_dmg: 0, blast_chance: 0 },
    berserk: 0,
    achievement: 'None'
  }, args);
}

console.log('== Golden cross-checks ==');

let r = FC.calculate(build({ slots: [ { name: 'Wolfarite', amount: 30 }, { name: 'None', amount: 0 }, { name: 'None', amount: 0 }, { name: 'None', amount: 0 } ], weapon_name: 'Dagger' }), game);
approx(r.lethality, 0.15, 'wolfarite lethality');
approx(r.atk_speed, 0.08, 'wolfarite atk_speed');
approx(r.avg_power, 15.48, 'wolfarite avg_power');
approx(r.unforged_damage, 4.3 * 15.48, 'wolfarite unforged');
approx(r.attack_rate, 1.08 / 0.47, 'wolfarite attack_rate');
approx(r.weapon_dps, 175.89891063829785, 'wolfarite weapon_dps');
approx(r.total_dps, r.weapon_dps, 'wolfarite total == weapon');
approx(r.max_dps, 255.05342042553187, 'wolfarite max_dps');

r = FC.calculate(build({ slots: [ { name: 'Wolfarite', amount: 3 }, { name: 'Stone', amount: 27 }, { name: 'None', amount: 0 }, { name: 'None', amount: 0 } ], weapon_name: 'Dagger' }), game);
approx(r.lethality, 0.015, 'gate lethality');
approx(r.atk_speed, 0.008, 'gate atk_speed');

r = FC.calculate(build({ slots: [ { name: 'Gargantuan', amount: 30 }, { name: 'None', amount: 0 }, { name: 'None', amount: 0 }, { name: 'None', amount: 0 } ], weapon_name: 'Dagger' }), game);
approx(r.explosion_dmg, 0.5, 'garg explosion_dmg');
approx(r.explosion_chance, 0.35, 'garg explosion_chance');
approx(r.fire_dmg, 0.2, 'garg fire_dmg');
approx(r.fire_chance, 0.3, 'garg fire_chance');
approx(r.fire_duration, 2.0, 'garg fire_duration');
approx(r.explosion_dps, 24.45755213819254, 'garg explosion_dps');
approx(r.fire_dps, 10.192430228112654, 'garg fire_dps');
approx(r.total_dps, 171.8840249194967, 'garg total_dps');
approx(r.max_dps, 280.50638297872337, 'garg max_dps');

r = FC.calculate(build({ slots: [ { name: 'Malachite', amount: 30 }, { name: 'None', amount: 0 }, { name: 'None', amount: 0 }, { name: 'None', amount: 0 } ], weapon_name: 'Dagger' }), game);
approx(r.poison_dmg, 0.1, 'malachite poison_dmg');
approx(r.poison_chance, 0.33, 'malachite poison_chance');
approx(r.poison_duration, 3.0, 'malachite poison_duration');
approx(r.poison_dps, 2.7520000000000002, 'malachite poison_dps');

r = FC.calculate(build({ slots: [ { name: 'Galaxite', amount: 30 }, { name: 'None', amount: 0 }, { name: 'None', amount: 0 }, { name: 'None', amount: 0 } ], weapon_name: 'Dagger' }), game);
approx(r.blackhole_dmg, 0.6, 'galaxite blackhole_dmg');
approx(r.blackhole_chance, 0.3, 'galaxite blackhole_chance');
approx(r.crit_chance, 0.45, 'galaxite crit_chance');
approx(r.crit_dmg, 0.2, 'galaxite crit_dmg');
approx(r.blackhole_dps, 25.481075570281636, 'galaxite blackhole_dps');

r = FC.calculate(build({ slots: [ { name: 'Wolfarite', amount: 30 }, { name: 'None', amount: 0 }, { name: 'None', amount: 0 }, { name: 'None', amount: 0 } ], weapon_name: 'Dagger' }), game);
approx(r.blackhole_chance, 0.0, 'blackhole requires galaxite');

r = FC.calculate(build({ slots: [ { name: 'Wolfarite', amount: 30 }, { name: 'None', amount: 0 }, { name: 'None', amount: 0 }, { name: 'None', amount: 0 } ], weapon_name: 'Dagger', race: 'Minotaur' }), game);
approx(r.berserk, r.weapon_dps * 1.45 / 1.15, 'minotaur berserk adds 30% to lethality');
approx(r.berserk, 221.78558297872337, 'minotaur berserk');
r = FC.calculate(build({ slots: [ { name: 'Wolfarite', amount: 30 }, { name: 'None', amount: 0 }, { name: 'None', amount: 0 }, { name: 'None', amount: 0 } ], weapon_name: 'Dagger' }), game);
approx(r.berserk === null ? 0 : 1, 0, 'no-race berserk is null');

r = FC.calculate(build({ slots: [ { name: 'Wolfarite', amount: 30 }, { name: 'None', amount: 0 }, { name: 'None', amount: 0 }, { name: 'None', amount: 0 } ], weapon_name: 'Dagger', achievement: 'Damage Boost +20%' }), game);
approx(r.lethality, Math.min(0.15 + 0.20, 1.5), 'achievement lethality');

approx(game.ores.length, 149, 'ore count');
approx(game.weapons.length, 87, 'weapon count');
approx(game.races.length, 20, 'race count');
approx(game.runes.length, 46, 'rune count');
approx(game.achievements.length, 16, 'achievement count');

r = FC.calculate(build({ weapon_name: 'Dagger', abilities: { fire_dmg: 0.1, fire_chance: 0, fire_time: 5, poison_dmg: 0, poison_chance: 0, poison_time: 0, blast_dmg: 0, blast_chance: 0 } }), game);
approx(r.fire_duration, 5.0, 'fire time with fire damage');
r = FC.calculate(build({ weapon_name: 'Dagger', abilities: { fire_dmg: 0, fire_chance: 0, fire_time: 0, poison_dmg: 0.1, poison_chance: 0, poison_time: 5, blast_dmg: 0, blast_chance: 0 } }), game);
approx(r.poison_duration, 5.0, 'poison time with poison damage');

r = FC.calculate(build({ weapon_name: 'Dagger', abilities: {}, armor_crit_chance: undefined }), game);
let nanFail = 0;
if (!Number.isFinite(r.total_dps)) { nanFail++; console.log('  FAIL partial build: total_dps not finite'); }
if (!(r.ttk_25k > 0)) { nanFail++; console.log('  FAIL partial build: ttk_25k not > 0'); }
failures += nanFail;
if (nanFail === 0) { console.log('  PASS partial build: total_dps finite, ttk_25k > 0'); }
const partialTotal = r.total_dps;
r = FC.calculate(build({ weapon_name: 'Dagger' }), game);
approx(partialTotal, r.total_dps, 'partial build == full-zero-abilities total');

console.log(failures === 0 ? '\nALL GOLDEN CHECKS PASSED ✓' : `\n${failures} CHECK(S) FAILED ✗`);
process.exit(failures === 0 ? 0 : 1);
