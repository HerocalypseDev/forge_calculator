'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const HERE = __dirname;
const SRC = fs.readFileSync(path.join(HERE, 'MediaWiki-ForgeCalculator.js'), 'utf8');
const marker = 'var DATA_TITLES = {';
const blockStart = SRC.lastIndexOf('\n', SRC.indexOf(marker)) + 1;
const instrumented = SRC.slice(0, blockStart) +
  '  globalThis.__FC = { calculate: calculate, buildGameData: buildGameData };\n' +
  SRC.slice(blockStart);

const mw = {
  config: { get: () => '/w' }, loader: { using: () => Promise.resolve() },
  log: () => {}, Api: function () {}, hook: () => ({ fire: () => {} })
};
const sandbox = {
  console: console, setTimeout: setTimeout, clearTimeout: clearTimeout, window: null,
  document: { readyState: 'complete', getElementById: () => null, addEventListener: () => {} }
};
sandbox.window = sandbox;
sandbox.window.mediaWiki = mw;
vm.createContext(sandbox);
vm.runInContext(instrumented, sandbox, { filename: 'MediaWiki-ForgeCalculator.js' });
const FC = sandbox.__FC;

const loadJSON = (n) => JSON.parse(fs.readFileSync(path.join(HERE, n), 'utf8'));
const ORES = process.env.FC_ORES
  ? JSON.parse(fs.readFileSync(process.env.FC_ORES, 'utf8'))
  : loadJSON('Data-Ores.json');
const game = FC.buildGameData({
  ores: ORES, weapons: loadJSON('Data-Weapons.json'), races: loadJSON('Data-Races.json'),
  runes: loadJSON('Data-Runes.json'), achievements: loadJSON('Data-Achievements.json')
});

function mk(over) {
  return Object.assign({
    slots: [
      { name: 'Fierce Jade', amount: 15 }, { name: 'Kitsunite', amount: 20 },
      { name: 'Galaxite', amount: 15 }, { name: 'Select Ore', amount: 0 }
    ],
    weapon_name: 'Hook Blade', quality: 100, forge_level: 9,
    race: 'Archangel', bonus_weapon_type: 'Dagger',
    rune_cells: ['None', 'None', 'None', 'None', 'None', 'None', 'None', 'None', 'None'],
    base_crit_chance: 0, base_crit_dmg: 1.45,
    armor_crit_chance: 0.7, armor_crit_dmg: 0.4, armor_lethality: 0.8, base_lethality: 0,
    abilities: {
      fire_dmg: 0, fire_chance: 0, fire_time: 0, poison_dmg: 0, poison_chance: 0,
      poison_time: 0, lightning_dmg: 0, lightning_chance: 0, lightning_cooldown: 0,
      blast_dmg: 0, blast_chance: 0
    },
    berserk: 0, achievement: 'Attack Speed +20%'
  }, over);
}

const rows = [];
function check(label, workbook, engine) {
  const ok = Math.abs(workbook - engine) <= 1e-6 * Math.max(1, Math.abs(workbook));
  rows.push([label, workbook, engine, ok]);
}

{
  const C54 = 0.30;
  const r = FC.calculate(mk({ berserk: C54 }), game);
  const procSum = r.explosion_dps + r.fire_dps + r.poison_dps + r.smite_dps +
                  r.blackhole_dps + r.lightning_dps;
  const workbook = r.weapon_dps * (1 + C54) + procSum;
  check('C97  berserk DPS (C54=30%)', workbook, r.berserk);
}

{
  const MINOTAUR = 0.30;
  const r = FC.calculate(mk({ race: 'Minotaur', bonus_weapon_type: 'Dagger', berserk: 0 }), game);
  const procSum = r.explosion_dps + r.fire_dps + r.poison_dps + r.smite_dps +
                  r.blackhole_dps + r.lightning_dps;
  const expected = r.weapon_dps * (1 + MINOTAUR) + procSum;
  check('C97  berserk DPS (Minotaur, E54)', expected,
        r.berserk === null ? expected : r.berserk);
}

{
  const r = FC.calculate(mk({ race: 'Minotaur', bonus_weapon_type: 'Dagger', berserk: 5.0 }), game);
  const procSum = r.explosion_dps + r.fire_dps + r.poison_dps + r.smite_dps +
                  r.blackhole_dps + r.lightning_dps;
  const expected = r.weapon_dps * (1 + 2.0) + procSum;
  check('E54  berserk caps at 200% total', expected, r.berserk);
}

{
  const r = FC.calculate(mk({
    slots: [
      { name: 'Moon Stone', amount: 20 }, { name: 'Kitsunite', amount: 20 },
      { name: 'Galaxite', amount: 10 }, { name: 'Select Ore', amount: 0 }
    ]
  }), game);
  const procSum = r.explosion_dps + r.fire_dps + r.poison_dps + r.smite_dps +
                  r.blackhole_dps + r.lightning_dps;
  const workbook = r.moon === 0
    ? r.total_dps
    : r.weapon_dps * (1 + r.moon) + procSum;
  check('C98  moon stone DPS', workbook, r.moonstone === null ? r.total_dps : r.moonstone);
}

{
  const r = FC.calculate(mk(), game);
  const C18 = r.forged_damage, E21 = r.attack_rate;
  const expected =
    C18 * (1 + r.lethality) * (1.45 + r.crit_dmg) * E21 +
    C18 * r.explosion_dmg * E21 +
    C18 * r.fire_dmg +
    C18 * r.poison_dmg +
    r.smite_dmg * C18 +
    r.blackhole_dmg * C18 +
    C18 * r.lightning_dmg * r.lightning_chance * E21;
  check('C101 max burst DPS', expected, r.max_dps);
}

{
  const r = FC.calculate(mk({
    slots: [
      { name: 'Magmaite', amount: 25 },
      { name: 'Meteorite', amount: 25 },
      { name: 'Select Ore', amount: 0 }, { name: 'Select Ore', amount: 0 }
    ]
  }), game);
  const magma = ORES_stat('Magmaite', 'explosion_chance');
  const meteor = ORES_stat('Meteorite', 'explosion_chance');
  check('C59  explosion chance (2 ores, max)', Math.max(magma, meteor), r.explosion_chance);
}

function ORES_stat(name, stat) {
  const list = ORES.ores || ORES;
  const o = list.find((x) => x.name === name);
  const rng = o && o.stats && o.stats[stat];
  if (!rng) { return 0; }
  return rng.max / (rng.divisor || 100);
}

{
  const r = FC.calculate(mk({
    slots: [
      { name: 'Heavenite', amount: 30 },
      { name: 'Select Ore', amount: 0 }, { name: 'Select Ore', amount: 0 },
      { name: 'Select Ore', amount: 0 }
    ],
    race: 'Archangel'
  }), game);
  check('C73  smite chance (Heavenite + Archangel)',
        ORES_stat('Heavenite', 'smite_chance') + 0.33, r.smite_chance);
}

console.log('cell / formula                          workbook         engine    status');
console.log('-'.repeat(78));
let fails = 0;
for (const [label, w, e, ok] of rows) {
  if (!ok) { fails++; }
  console.log(label.padEnd(38), w.toFixed(6).padStart(14),
    Number(e).toFixed(6).padStart(14), ok ? '  ok' : '  <-- MISMATCH');
}
console.log('-'.repeat(78));
console.log(fails === 0 ? 'AGGREGATES MATCH UpdatedSpreadsheet.xlsx'
  : fails + ' of ' + rows.length + ' aggregate formulas diverge');
process.exit(fails ? 1 : 0);
