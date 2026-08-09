/**
 * Differential verification: run the JS engine (from forge-calculator.common.js)
 * on the same random builds the Python engine computed, and compare every
 * result field.
 *
 * Usage: node fuzz_verify.js   (reads fuzz-cases.json, Data-*.json)
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const HERE = __dirname;
const SRC = fs.readFileSync(path.join(HERE, 'forge-calculator.common.js'), 'utf8');

const marker = '* DATA LOADING';
const idx = SRC.indexOf(marker);
const blockStart = SRC.lastIndexOf('/* ===', idx);
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
  document: { readyState: 'complete', getElementById: () => null, addEventListener: () => {} }
};
sandbox.window = sandbox;
sandbox.window.mediaWiki = mw;
vm.createContext(sandbox);
vm.runInContext(instrumented, sandbox, { filename: 'forge-calculator.common.js' });
const FC = sandbox.__FC;

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

const fuzz = JSON.parse(fs.readFileSync(path.join(HERE, 'fuzz-cases.json'), 'utf8'));
const cases = fuzz.cases;

let worst = 0;
let worstLabel = '';
let mismatches = 0;
let checked = 0;

function approx(a, b) {
  if (a === null || b === null) { return a === b; }
  const denom = Math.max(Math.abs(a), Math.abs(b), 1e-9);
  return Math.abs(a - b) / denom <= 1e-6;
}

for (let ci = 0; ci < cases.length; ci++) {
  const c = cases[ci];
  const js = FC.calculate(c.build, game);
  const py = c.result;

  for (const key of Object.keys(py)) {
    if (key === 'active_traits') { continue; } // string; compare separately
    if (py[key] === null || py[key] === undefined) {
      if (js[key] !== null && js[key] !== undefined) {
        mismatches++;
        console.log(`case ${ci} ${key}: expected null, got ${js[key]}`);
      }
      continue;
    }
    if (typeof py[key] === 'number') {
      const a = js[key], b = py[key];
      const rel = Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b), 1e-9);
      if (rel > 1e-6) {
        mismatches++;
        console.log(`case ${ci} ${key}: JS=${a} PY=${b} rel=${rel.toExponential(2)}`);
      }
      if (rel > worst) { worst = rel; worstLabel = `case ${ci} ${key}`; }
      checked++;
    }
  }
  // active_traits string comparison
  if (js.active_traits !== py.active_traits) {
    mismatches++;
    console.log(`case ${ci} active_traits: JS="${js.active_traits}" PY="${py.active_traits}"`);
  }
}

console.log(`\nCompared ${cases.length} builds, ${checked} numeric fields.`);
if (mismatches === 0) {
  console.log(`DIFFERENTIAL FUZZ PASSED ✓  (worst numeric rel error ${worst.toExponential(2)} at ${worstLabel})`);
} else {
  console.log(`${mismatches} MISMATCH(ES) ✗`);
}
process.exit(mismatches === 0 ? 0 : 1);
