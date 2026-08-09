/**
 * Focused test for the auto-derived race/class weapon-type bonus:
 *  - The "Select Bonus Type" dropdown is gone from the UI (source-level)
 *  - transformBuildForEngine maps the selected weapon to its `type` as the
 *    engine's bonus_weapon_type (no weapon selected -> '')
 *  - The engine's class-bonus tables (workbook E44 lethality / E47 atk speed)
 *    are reachable with those derived weapon types, end to end through the
 *    real transform + calculate pipeline
 *
 * Run: node Web/mediawiki/bonus-derive-test.js
 *
 * Strategy: same as fuzz_verify.js — evaluate the real Common.js source in a
 * Node vm, inject an export hook after the state/transform definitions (right
 * before `function recalculate`), load the real Data: JSON pages, then assert
 * on live engine output.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const HERE = __dirname;
const SRC = fs.readFileSync(path.join(HERE, 'forge-calculator.common.js'), 'utf8');

// --- Inject an export hook right before `function recalculate()` — at that
// point state, deriveBonusType and transformBuildForEngine are all defined.
const marker = 'function recalculate() {';
const idx = SRC.indexOf(marker);
if (idx < 0) { throw new Error('recalculate marker not found'); }
const blockStart = SRC.lastIndexOf('\n', idx) + 1;
const instrumented = SRC.slice(0, blockStart) +
  '  globalThis.__FC = {\n' +
  '    calculate: calculate,\n' +
  '    buildGameData: buildGameData,\n' +
  '    transformBuildForEngine: transformBuildForEngine,\n' +
  '    setGameData: function (g) { state.gameData = g; }\n' +
  '  };\n' +
  SRC.slice(blockStart);

// --- Minimal sandbox (no DOM rendering needed) ---
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
if (!FC) { throw new Error('Export hook did not run — extraction failed'); }

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
FC.setGameData(game);

let failures = 0;
function assert(cond, label) {
  if (!cond) {
    failures++;
    console.log(`  FAIL ${label}`);
  }
  return cond;
}

// --- UI-format build fixture ---
function uiBuild(overrides) {
  return Object.assign({
    oreSlots: [
      { name: 'None', amount: 0 }, { name: 'None', amount: 0 },
      { name: 'None', amount: 0 }, { name: 'None', amount: 0 }
    ],
    weaponName: 'Ironhand',
    weaponType: 'All Types',
    quality: 100,
    enhancement: 0,
    race: 'Felynx',
    armorLethality: 0, armorCritChance: 0, armorCritDmg: 0,
    fireDmg: 0, fireChance: 0, fireTime: 0,
    poisonDmg: 0, poisonChance: 0, poisonTime: 0,
    blastDmg: 0, blastChance: 0,
    runes: [],
    achievement: 'None'
  }, overrides);
}

// --- 1. Transform derives bonus type from the weapon ---
console.log('== transformBuildForEngine derives bonus type ==');
let eng = FC.transformBuildForEngine(uiBuild({ weaponName: 'Ironhand' }));
assert(eng.bonus_weapon_type === 'Gauntlet', 'Ironhand -> Gauntlet');
eng = FC.transformBuildForEngine(uiBuild({ weaponName: 'Great Sword' }));
assert(eng.bonus_weapon_type === 'Colossal Sword', 'Great Sword -> Colossal Sword');
eng = FC.transformBuildForEngine(uiBuild({ weaponName: 'Double Battle Axe' }));
assert(eng.bonus_weapon_type === 'Great Axe', 'Double Battle Axe -> Great Axe');
eng = FC.transformBuildForEngine(uiBuild({ weaponName: 'None' }));
assert(eng.bonus_weapon_type === '', 'no weapon -> empty bonus type');
eng = FC.transformBuildForEngine(uiBuild({ weaponName: 'Not A Real Weapon' }));
assert(eng.bonus_weapon_type === '', 'unknown weapon -> empty bonus type');

// --- 2. Engine class bonuses reachable with derived types (workbook E44/E47) ---
console.log('== Engine class bonuses (race + derived weapon type) ==');
function calcLeth(build) { return FC.calculate(build, game).lethality; }
function calcAtk(build) { return FC.calculate(build, game).atk_speed; }

// Baseline: no race -> 0 / 0
const base = FC.transformBuildForEngine(uiBuild({ race: 'None', weaponName: 'None' }));
assert(calcLeth(base) === 0 && calcAtk(base) === 0, 'baseline has no class bonuses');

// E44 lethality: Felynx+Gauntlet, Vampire+Straight Sword
assert(calcLeth(FC.transformBuildForEngine(uiBuild({ race: 'Felynx', weaponName: 'Ironhand' }))) === 0.2,
  'Felynx + Gauntlet -> +20% lethality (E44)');
assert(calcLeth(FC.transformBuildForEngine(uiBuild({ race: 'Vampire', weaponName: 'Falchion' }))) === 0.1,
  'Vampire + Straight Sword -> +10% lethality (E44)');
assert(calcAtk(FC.transformBuildForEngine(uiBuild({ race: 'Felynx', weaponName: 'Ironhand' }))) === 0,
  'Felynx + Gauntlet gives NO attack speed (E47 wants plural Gauntlets)');

// E47 atk speed: Goblin+Dagger, Golem+Colossal Sword, Golem+Great Axe
assert(calcAtk(FC.transformBuildForEngine(uiBuild({ race: 'Goblin', weaponName: 'Dagger' }))) === 0.1,
  'Goblin + Dagger -> +10% atk speed (E47)');
assert(calcAtk(FC.transformBuildForEngine(uiBuild({ race: 'Golem', weaponName: 'Great Sword' }))) === 0.15,
  'Golem + Colossal Sword -> +15% atk speed (E47)');
assert(calcAtk(FC.transformBuildForEngine(uiBuild({ race: 'Golem', weaponName: 'Double Battle Axe' }))) === 0.15,
  'Golem + Great Axe -> +15% atk speed (E47)');

// --- 3. Source-level: bonus dropdown gone, derive logic present ---
console.log('== Source checks ==');
assert(SRC.indexOf('Select Bonus Type') === -1, 'no "Select Bonus Type" prompt remains');
assert(SRC.indexOf('bonus-type-select') === -1, 'no bonus-type dropdown id remains');
assert(SRC.indexOf('bonus_weapon_type: deriveBonusType(build)') !== -1, 'transform uses deriveBonusType');
assert(SRC.indexOf("'Felynx,Gauntlet'") !== -1, 'E44 Felynx+Gauntlet key present');
assert(SRC.indexOf("'Goblin,Dagger'") !== -1, 'E47 Goblin+Dagger key present');

console.log(failures === 0 ? '\nALL BONUS-DERIVE CHECKS PASSED ✓' : `\n${failures} CHECK(S) FAILED ✗`);
process.exit(failures === 0 ? 0 : 1);
