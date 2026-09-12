'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const HERE = __dirname;
const SRC = fs.readFileSync(path.join(HERE, 'MediaWiki-ForgeCalculator.js'), 'utf8');

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
vm.runInContext(instrumented, sandbox, { filename: 'MediaWiki-ForgeCalculator.js' });

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

console.log('== Engine class bonuses (race + derived weapon type) ==');
function calcLeth(build) { return FC.calculate(build, game).lethality; }
function calcAtk(build) { return FC.calculate(build, game).atk_speed; }

const base = FC.transformBuildForEngine(uiBuild({ race: 'None', weaponName: 'None' }));
assert(calcLeth(base) === 0 && calcAtk(base) === 0, 'baseline has no class bonuses');

assert(calcLeth(FC.transformBuildForEngine(uiBuild({ race: 'Felynx', weaponName: 'Ironhand' }))) === 0.2,
  'Felynx + Gauntlet -> +20% lethality (E45)');
assert(calcLeth(FC.transformBuildForEngine(uiBuild({ race: 'Vampire', weaponName: 'Falchion' }))) === 0.1,
  'Vampire + Straight Sword -> +10% lethality (E45)');
assert(calcAtk(FC.transformBuildForEngine(uiBuild({ race: 'Felynx', weaponName: 'Ironhand' }))) === 0.2,
  'Felynx + Gauntlet -> +20% attack speed (E48, both spellings registered)');

assert(calcAtk(FC.transformBuildForEngine(uiBuild({ race: 'Goblin', weaponName: 'Dagger' }))) === 0.1,
  'Goblin + Dagger -> +10% atk speed (E48)');
assert(calcAtk(FC.transformBuildForEngine(uiBuild({ race: 'Golem', weaponName: 'Great Sword' }))) === 0.15,
  'Golem + Colossal Sword -> +15% atk speed (E48)');
assert(calcAtk(FC.transformBuildForEngine(uiBuild({ race: 'Golem', weaponName: 'Double Battle Axe' }))) === 0.15,
  'Golem + Great Axe -> +15% atk speed (E47)');

console.log('== Source checks ==');
assert(SRC.indexOf('Select Bonus Type') === -1, 'no "Select Bonus Type" prompt remains');
assert(SRC.indexOf('bonus-type-select') === -1, 'no bonus-type dropdown id remains');
assert(SRC.indexOf('bonus_weapon_type: deriveBonusType(build)') !== -1, 'transform uses deriveBonusType');
assert(SRC.indexOf("'Felynx,Gauntlet'") !== -1, 'E45 Felynx+Gauntlet key present');
assert(SRC.indexOf("'Felynx,Gauntlets'") !== -1, 'E48 Felynx+Gauntlets key present');
assert(SRC.indexOf("'Goblin,Dagger'") !== -1, 'E48 Goblin+Dagger key present');

console.log(failures === 0 ? '\nALL BONUS-DERIVE CHECKS PASSED ✓' : `\n${failures} CHECK(S) FAILED ✗`);
process.exit(failures === 0 ? 0 : 1);
