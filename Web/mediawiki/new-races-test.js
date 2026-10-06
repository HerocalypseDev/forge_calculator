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
function assert(cond, label) {
  if (!cond) { failures++; console.log('  FAIL ' + label); }
}
const run = (race, weapon, bonus) => FC.calculate({
  slots: [], weapon_name: weapon || 'Dagger', race: race, bonus_weapon_type: bonus || ''
}, game);

const DAGGER_DMG = 4.3;
const DAGGER_INTERVAL = 0.47;

const raceNames = loadJSON('Data-Races.json').races.map((r) => r.name);
['Fairy', 'Orc Lord', 'Dryad', 'Kitsune'].forEach((name) =>
  assert(raceNames.indexOf(name) !== -1, name + ' is offered in the race list'));

const orcLord = run('Orc Lord');
approx(orcLord.lethality, 0.40, 'Orc Lord lethality');
approx(orcLord.smash_dps, DAGGER_DMG * 1.0 * 0.25 * Math.min(1 / DAGGER_INTERVAL, 1 / 10), 'Orc Lord smash dps');
approx(orcLord.total_dps, orcLord.weapon_dps + orcLord.smash_dps, 'smash adds to total');

const kitsune = run('Kitsune');
const kitsuneRate = 1.2 / DAGGER_INTERVAL;
approx(kitsune.lethality, 0.20, 'Kitsune lethality');
approx(kitsune.atk_speed, 0.20, 'Kitsune atk speed');
approx(kitsune.fox_claws_dps, DAGGER_DMG * kitsuneRate * Math.floor(kitsuneRate) * 0.075 * 0.5, 'Kitsune fox claws dps');
approx(kitsune.foxfire_dps, DAGGER_DMG * 0.3 * Math.min(1, 0.5 * kitsuneRate * 2), 'Kitsune foxfire dps');
approx(run('Kitsune', 'Long Sword').fox_claws_dps, 0, 'fox claws needs a whole hit per second');

approx(run('Fairy', 'Spear', 'Spear').lethality, 0.15, 'Fairy spear lethality');
approx(run('Fairy', 'Spear', 'Spear').atk_speed, 0.15, 'Fairy spear atk speed');
approx(run('Fairy', 'Dagger', 'Dagger').atk_speed, 0, 'Fairy without a spear');

['Dagger', 'Great Sword', 'Colossal Sword', 'Great Axe', 'Mace'].forEach((weaponType) =>
  approx(run('Shadow', 'Dagger', weaponType).atk_speed, 0.10, 'Shadow + ' + weaponType + ' atk speed stays flat'));
approx(run('Golem', 'Dagger', 'Colossal Sword').atk_speed, 0.15, 'Golem + Colossal Sword atk speed');
approx(run('Golem', 'Dagger', 'Great Axe').atk_speed, 0, 'Golem + Great Axe gets nothing');
approx(run('Elf').atk_speed, 0.05, 'Elf atk speed');

approx(run('Orc').lethality, 0.10, 'Orc lethality counted once');
approx(run('Dragonborn').lethality, 0.12, 'Dragonborn lethality counted once');
approx(run('Goblin', 'Dagger', 'Dagger').atk_speed, 0.10, 'Goblin dagger atk speed counted once');

approx(run('Minotaur').lethality, 0.30, 'Minotaur lethality');
approx(run('Demon', 'Dagger', 'Straight Sword').lethality, 0.20, 'Demon gets no straight sword bonus');
approx(run('Demon', 'Dagger', 'Dagger').lethality, 0.20, 'Demon without a straight sword');

approx(FC.calculate({ slots: [], weapon_name: 'Dagger', race: 'Orc Lord', armor_lethality: 2.8 }, game).lethality, 3.0, 'lethality caps at 300%');
approx(FC.calculate({ slots: [], weapon_name: 'Dagger', race: 'Orc Lord', armor_lethality: 2.5 }, game).lethality, 2.9, 'lethality under the cap is untouched');

const dryad = run('Dryad');
const noRace = run('');
assert(JSON.stringify(dryad) === JSON.stringify(noRace), 'Dryad has no DPS effect');

['Human', 'Minotaur', 'Fairy', 'Dryad'].forEach((race) => {
  const r = run(race);
  assert(r.smash_dps === 0 && r.fox_claws_dps === 0 && r.foxfire_dps === 0, race + ' gets no race procs');
});

console.log(failures === 0 ? 'ALL NEW-RACES CHECKS PASSED ✓' : failures + ' CHECK(S) FAILED ✗');
process.exit(failures ? 1 : 0);
