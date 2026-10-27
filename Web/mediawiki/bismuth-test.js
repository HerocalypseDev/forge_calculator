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

const low = run([['Bismuth', 9], ['Ancienite', 91]]);
approx(low.atk_speed, 0, 'Bismuth below 10% gives no attack speed');
approx(low.prismatic_shift_dps, 0, 'Bismuth below 10% gives no Prismatic Shift');
const gated = run([['Bismuth', 10], ['Ancienite', 90]]);
approx(gated.atk_speed, 0.18, 'Bismuth attack speed is a flat 18% from 10% share');
approx(gated.explosion_dmg + gated.fire_dmg + gated.poison_dmg + gated.lightning_dmg, 0, 'Bismuth has no ordinary proc stats');
const rate = gated.attack_rate, a = gated.unforged_damage;
const uptime = (c, d) => { const load = c * rate * d; return Math.min(1, load / (1 + load / 2)); };
const expected = (a * 0.16 * uptime(78 / 101, 12) + a * 0.7 * 43 / 101 * rate +
  a * 0.26 * uptime(61 / 101, 4) + a * 0.8 / (3 + 1 / (48 / 101 * rate))) / 4;
approx(gated.prismatic_shift_dps, expected, 'Prismatic Shift is a quarter of each full T3 rune');

const galaxite = run([['Galaxite', 30], ['Ancienite', 60]]);
approx(run([['Galaxite', 30], ['Bismuth', 10], ['Ancienite', 50]]).blackhole_dmg, galaxite.blackhole_dmg + 1.25, 'Galaxite + Bismuth rainbow wave');
approx(run([['Galaxite', 30], ['Bismuth', 0], ['Ancienite', 60]]).blackhole_dmg, galaxite.blackhole_dmg, 'rainbow wave needs 10% Bismuth');
approx(run([['Malachite', 30]]).poison_duration, 3, 'Malachite poison duration');

const dot = run([], { abilities: { fire_dmg: 0.1, fire_time: 3 } });
approx(dot.fire_dps, dot.unforged_damage * 0.1 * Math.min(1, (dot.attack_rate * 3 / 101) / (1 + dot.attack_rate * 3 / 101 / 2)), 'fire with 0% chance still burns 1 in 101 hits');

console.log(failures === 0 ? 'ALL BISMUTH CHECKS PASSED ✓' : failures + ' CHECK(S) FAILED ✗');
process.exit(failures ? 1 : 0);
