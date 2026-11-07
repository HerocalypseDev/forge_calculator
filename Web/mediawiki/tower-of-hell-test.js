'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const HERE = __dirname;
const SRC = fs.readFileSync(path.join(HERE, 'MediaWiki-ForgeCalculator.js'), 'utf8');
const marker = 'var DATA_TITLES = {';
const blockStart = SRC.lastIndexOf('\n', SRC.indexOf(marker)) + 1;
const instrumented = SRC.slice(0, blockStart) +
  '  globalThis.__FC = { calculate: calculate, buildGameData: buildGameData, cooldownRate: cooldownRate };\n' +
  SRC.slice(blockStart);

const sandbox = {
  console: console, setTimeout: setTimeout, clearTimeout: clearTimeout, window: null,
  document: { readyState: 'complete', getElementById: () => null, addEventListener: () => {} }
};
sandbox.window = sandbox;
sandbox.window.mediaWiki = {
  config: { get: () => '/w' }, loader: { using: () => Promise.resolve() }, log: () => {},
  Api: function () {}, hook: () => ({ fire: () => {} })
};
vm.createContext(sandbox);
vm.runInContext(instrumented, sandbox, { filename: 'MediaWiki-ForgeCalculator.js' });
const FC = sandbox.__FC;

const loadJSON = (n) => JSON.parse(fs.readFileSync(path.join(HERE, n), 'utf8'));
const weapons = loadJSON('Data-Weapons.json');
const game = FC.buildGameData({
  ores: loadJSON('Data-Ores.json'), weapons: weapons, races: loadJSON('Data-Races.json'),
  runes: loadJSON('Data-Runes.json'), achievements: loadJSON('Data-Achievements.json')
});

let failures = 0;
function approx(got, want, label) {
  const ok = typeof got === 'number' && Math.abs(got - want) <= 1e-9 * Math.max(1, Math.abs(want));
  if (!ok) { failures++; console.log('  FAIL ' + label + ': expected ' + want + ', got ' + got); }
}
function assert(cond, label) {
  if (!cond) { failures++; console.log('  FAIL ' + label); }
}

const weaponList = Array.isArray(weapons) ? weapons : weapons.weapons;
const spear = weaponList.find((w) => w.type === 'Spear');
const typeOf = (name) => (weaponList.find((w) => w.name === name) || {}).type || '';
const empty = { name: 'Select Ore', amount: 0 };
const solo = (ore, opts) => {
  const o = opts || {};
  const weapon = o.weapon || 'Dagger';
  return FC.calculate(Object.assign({
    slots: [{ name: ore, amount: 10 }].concat(o.extra || [empty, empty, empty]).slice(0, 4),
    weapon_name: weapon, race: o.race || 'Human', bonus_weapon_type: typeOf(weapon)
  }, o.build || {}), game);
};

let r = solo('Iron', { race: 'Fallen Angel' });
approx(r.lethality, 0.20, 'Fallen Angel lethality');
approx(r.atk_speed, 0.10, 'Fallen Angel attack speed');
approx(r.berserk_level, 0.30, 'Fallen Angel berserk');
approx(r.dark_smite_dps, r.unforged_damage * r.attack_rate * 0.35 * 31 / 101, 'Dark Smite DPS');

r = solo('Iron', { race: 'Imp', weapon: spear.name });
approx(r.lethality, 0.25, 'Imp spear lethality');
approx(r.atk_speed, 0.20, 'Imp spear attack speed');
approx(r.trident_toss_dps, r.unforged_damage * 1.2 * Math.min(r.attack_rate, 1 / 8), 'Trident Toss DPS');
approx(r.fire_dps, 0, 'Imp has no fire');
r = solo('Iron', { race: 'Imp' });
assert(r.lethality === 0 && r.trident_toss_dps === 0, 'Imp without a spear gets nothing');

r = solo('Frost Core');
approx(r.lethality, 0.15, 'Frost Core lethality');
approx(r.crit_dmg, 0.10, 'Frost Core crit damage');

r = solo('Echotite');
approx(r.reverberation_chance, 0.20, 'Echotite dagger reverberation');
approx(r.reverberation_dps, r.weapon_dps * 21 / 101, 'Reverberation DPS');
approx(r.explosion_dmg, 0.50, 'Echotite explosion damage');
approx(solo('Echotite', { weapon: spear.name }).reverberation_chance, 0.08, 'Echotite default reverberation');

r = solo('Tetrinite');
approx(r.poison_dmg, 0.40, 'Tetrinite poison');
approx(r.lightning_cooldown, 4, 'Tetrinite lightning cooldown');
approx(r.ancient_poison_dps, r.poison_dps * 0.5 * (1 - Math.pow(1 - 51 / 101, r.attack_rate * 5)), 'Ancient Poison DPS');

r = solo('Frost Star');
approx(r.frost_slash_dps, r.unforged_damage * 0.25 * 31 / 101 * r.attack_rate, 'Frost Slash DPS');
approx(r.starfall_dps, r.unforged_damage * 1.25 * FC.cooldownRate(21 / 101, r.attack_rate, 10), 'Starfall DPS');
approx(r.stellar_mark_dps, r.unforged_damage * 1.5 * r.attack_rate / 5, 'Stellar Mark DPS');
approx(r.glacier_explosion_dps, 0, 'Glacier Explosion needs crits');

r = solo('Frost Star', { extra: [{ name: 'Galaxite', amount: 1 }, empty, empty], build: { armor_crit_chance: 0.5 } });
approx(r.starfall_dps, r.unforged_damage * r.starfall_dmg * 1.8 * FC.cooldownRate(21 / 101, r.attack_rate, 10), 'Starfall with Galaxite');
approx(r.glacier_explosion_dps,
  r.unforged_damage * r.glacier_dmg * 51 / 101 * Math.min(r.crit_chance, 1) * r.attack_rate, 'Glacier Explosion on crits');

r = solo('Frost Star', { race: 'Fallen Angel' });
const rows = ['weapon_dps', 'explosion_dps', 'fire_dps', 'poison_dps', 'smite_dps', 'blackhole_dps', 'lightning_dps',
  'smash_dps', 'fox_claws_dps', 'foxfire_dps', 'archangel_smite_dps', 'cursed_aura_dps', 'golemite_dps',
  'dark_smite_dps', 'trident_toss_dps', 'reverberation_dps', 'frost_slash_dps', 'glacier_explosion_dps',
  'starfall_dps', 'stellar_mark_dps', 'ancient_poison_dps'];
approx(r.total_dps, rows.reduce((s, k) => s + r[k], 0), 'every row joins Total DPS');

console.log(failures ? `\n${failures} CHECK(S) FAILED ✗` : '\nALL TOWER-OF-HELL CHECKS PASSED ✓');
process.exit(failures ? 1 : 0);
