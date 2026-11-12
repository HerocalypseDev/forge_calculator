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
const DAGGER_INTERVAL = 0.4667;

const raceNames = loadJSON('Data-Races.json').races.map((r) => r.name);
['Fairy', 'Orc Lord', 'Dryad', 'Kitsune'].forEach((name) =>
  assert(raceNames.indexOf(name) !== -1, name + ' is offered in the race list'));

const orcLord = run('Orc Lord');
approx(orcLord.lethality, 0.40, 'Orc Lord lethality');
approx(orcLord.smash_dps, DAGGER_DMG * 1.0 / (10 + 1 / (0.25 / DAGGER_INTERVAL)), 'Orc Lord smash waits out its cooldown');
approx(orcLord.total_dps, orcLord.weapon_dps + orcLord.smash_dps, 'smash adds to total');

const kitsune = run('Kitsune');
const kitsuneRate = 1.2 / DAGGER_INTERVAL;
approx(kitsune.lethality, 0.20, 'Kitsune lethality');
approx(kitsune.atk_speed, 0.20, 'Kitsune atk speed');
approx(kitsune.crit_dmg, 0.15, 'Kitsune crit dmg');
approx(kitsune.fox_claws_dmg, 0.75, 'Kitsune fox claws dmg is flat');
approx(kitsune.fox_claws_dps, DAGGER_DMG * 0.75 * Math.min(0.25 * kitsuneRate, 3 / 2.22), 'Kitsune fox claws spirits');
approx(kitsune.foxfire_dps, DAGGER_DMG * 1.2 * 0.3 * (1 - Math.exp(-0.5 * kitsuneRate * 3)), 'Kitsune foxfire on boosted damage');
const slowKitsune = run('Kitsune', 'Long Sword');
assert(slowKitsune.attack_rate < 1, 'Long Sword is below one hit per second');
approx(slowKitsune.fox_claws_dps, slowKitsune.unforged_damage * 0.75 * 0.25 * slowKitsune.attack_rate, 'fox claws follow attack rate');

const slowArchangel = run('Archangel', 'Long Sword');
approx(slowArchangel.smite_dmg, 0, 'Archangel adds nothing to ore smite');
approx(slowArchangel.archangel_smite_dps, 1.5 * slowArchangel.unforged_damage / (10 + 1 / (0.33 * slowArchangel.attack_rate)), 'Archangel smite beam');

approx(run('Fairy', 'Spear', 'Spear').lethality, 0.15, 'Fairy spear lethality');
approx(run('Fairy', 'Spear', 'Spear').atk_speed, 0.15, 'Fairy spear atk speed');
approx(run('Fairy', 'Dagger', 'Dagger').atk_speed, 0, 'Fairy without a spear');

['Dagger', 'Great Sword', 'Colossal Sword', 'Great Axe', 'Mace'].forEach((weaponType) =>
  approx(run('Shadow', 'Dagger', weaponType).atk_speed, 0.10, 'Shadow + ' + weaponType + ' atk speed stays flat'));
approx(run('Golem', 'Dagger', 'Colossal Sword').atk_speed, 0.15, 'Golem + Colossal Sword atk speed');
approx(run('Golem', 'Dagger', 'Great Axe').atk_speed, 0.15, 'Golem + Great Axe atk speed');
approx(run('Elf').atk_speed, 0, 'Elf has no atk speed');

approx(run('Orc').lethality, 0.10, 'Orc lethality counted once');
approx(run('Dragonborn').lethality, 0.12, 'Dragonborn lethality counted once');
approx(run('Goblin', 'Dagger', 'Dagger').atk_speed, 0.10, 'Goblin dagger atk speed counted once');

approx(run('Minotaur').lethality, 0, 'Minotaur has no lethality');
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
