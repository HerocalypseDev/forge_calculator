'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const HERE = __dirname;
const SRC = fs.readFileSync(path.join(HERE, 'MediaWiki-ForgeCalculator.js'), 'utf8');

const marker = 'var DATA_TITLES = {';
const idx = SRC.indexOf(marker);
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
  ores: ORES,
  weapons: loadJSON('Data-Weapons.json'),
  races: loadJSON('Data-Races.json'),
  runes: loadJSON('Data-Runes.json'),
  achievements: loadJSON('Data-Achievements.json')
});


let failures = 0;
function approx(got, want, label) {
  const ok = typeof got === 'number' && Math.abs(got - want) <= 1e-9 * Math.max(1, Math.abs(want));
  if (!ok) { failures++; console.log('  FAIL ' + label + ': expected ' + want + ', got ' + got); }
}
const run = (slots, extra) => FC.calculate(Object.assign({
  slots: slots.map(([name, amount]) => ({ name: name, amount: amount })), weapon_name: 'Dagger'
}, extra || {}), game);

approx(run([['Bismuth', 5], ['Bismuth', 3]]).avg_power, 8, 'Bismuth alone has ore power 8');
approx(run([['Ancienite', 10], ['Bismuth', 30]]).avg_power, 13.33, 'Bismuth never dilutes the average');
approx(run([['Fichilliumorite', 10], ['Bismuth', 10]]).avg_power, 1, 'Bismuth with Fichilliumorite falls back to 1');
approx(run([['Ancienite', 10], ['Select Ore', 10]]).avg_power, 13.33, 'Select Ore slots are ignored');

const flat = run([['Bismuth', 1], ['Ancienite', 100]]);
approx(flat.explosion_dmg, 0.0875, 'Bismuth explosion dmg is flat');
approx(flat.explosion_chance, 0.0525, 'Bismuth explosion chance is flat');
approx(flat.fire_dmg, 0.0325, 'Bismuth fire dmg is flat');
approx(flat.poison_chance, 0.09625, 'Bismuth poison chance is flat');
approx(flat.lightning_dmg, 0.10, 'Bismuth lightning dmg is flat');
approx(flat.lightning_chance, 0.05875, 'Bismuth lightning chance is flat');
approx(run([['Bismuth', 30], ['Ancienite', 70]]).atk_speed, 0.18, 'Bismuth atk speed ramps');

const galaxite = run([['Galaxite', 30]]);
approx(run([['Galaxite', 30], ['Bismuth', 0]]).blackhole_dmg, galaxite.blackhole_dmg + 1.25, 'Galaxite + Bismuth rainbow wave');
approx(run([['Malachite', 30], ['Bismuth', 30]]).poison_duration, 0, 'Bismuth poison duration beats Malachite');
approx(run([['Malachite', 30]]).poison_duration, 1, 'Malachite poison duration');

const dot = run([], { abilities: { fire_dmg: 0.1, fire_time: 3 } });
approx(dot.fire_dps, dot.unforged_damage * 0.1 * 3, 'fire DoT falls back to whole-duration damage');

console.log(failures === 0 ? 'ALL BISMUTH CHECKS PASSED ✓' : failures + ' CHECK(S) FAILED ✗');
process.exit(failures ? 1 : 0);
