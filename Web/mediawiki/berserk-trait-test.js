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
const game = FC.buildGameData({
  ores: loadJSON('Data-Ores.json'), weapons: loadJSON('Data-Weapons.json'),
  races: loadJSON('Data-Races.json'), runes: loadJSON('Data-Runes.json'),
  achievements: loadJSON('Data-Achievements.json')
});

function mk(oreName, amount) {
  return {
    slots: [
      { name: oreName, amount: amount },
      { name: 'None', amount: 100 - amount },
      { name: 'None', amount: 0 },
      { name: 'None', amount: 0 }
    ],
    weapon_name: 'Dagger', quality: 100, forge_level: 0, race: '', bonus_weapon_type: '',
    rune_cells: [], base_crit_chance: 0, base_crit_dmg: 1.45,
    armor_crit_chance: 0, armor_crit_dmg: 0, armor_lethality: 0, base_lethality: 0,
    abilities: {
      fire_dmg: 0, fire_chance: 0, fire_time: 0, poison_dmg: 0, poison_chance: 0, poison_time: 0,
      lightning_dmg: 0, lightning_chance: 0, lightning_cooldown: 0, blast_dmg: 0, blast_chance: 0
    },
    berserk: 0, achievement: 'None'
  };
}

let fails = 0;
function check(label, cond) {
  if (!cond) { fails++; console.log('  FAIL: ' + label); } else { console.log('  ok: ' + label); }
}

console.log('== Berserk-group trait text now computed like every other stat ==');

{
  // 10% share -- base value, exact, no "[X% power]" prefix on the berserk clause
  const r = FC.calculate(mk('Fierce Jade', 10), game);
  check('10% share: exact base wording present',
    r.active_traits.indexOf('+3.5% Physical DMG & +3.5% Movement Speed for 1s (when HP < 35%)') !== -1);
  check('10% share: no [X% power] prefix on the berserk clause',
    !/\[[\d.]+% power\][^\n]*Physical DMG/.test(r.active_traits));
}

{
  // partway between 10% and 30% -- must match the exact scaleRange ramp, same
  // formula every other stat (lethality, crit, atk speed) uses
  const r = FC.calculate(mk('Fierce Jade', 20), game);
  const share = 0.20;
  const expectedPct = 3.5 + (35.0 - 3.5) * Math.min((share - 0.10) / 0.20, 1.0);
  const expectedDur = 1.0 + (10.0 - 1.0) * Math.min((share - 0.10) / 0.20, 1.0);
  const pctStr = (Math.round(expectedPct * 10) / 10) + '%';
  const durStr = (Math.round(expectedDur * 10) / 10) + 's';
  check('20% share: ramped percentage matches scaleRange (' + pctStr + ')',
    r.active_traits.indexOf('+' + pctStr + ' Physical DMG & +' + pctStr + ' Movement Speed for ' + durStr) !== -1);
}

{
  // 30%+ share -- exact max value, matches the ore's trait30 numbers verbatim
  const r30 = FC.calculate(mk('Fierce Jade', 30), game);
  const r100 = FC.calculate(mk('Fierce Jade', 100), game);
  check('30% share: exact max wording present',
    r30.active_traits.indexOf('+35% Physical DMG & +35% Movement Speed for 10s (when HP < 35%)') !== -1);
  check('100% share: identical to 30% (already fully ramped)',
    r100.active_traits === r30.active_traits);
}

{
  // Yin-Yang has the berserk clause next to plain percentage clauses -- the
  // berserk clause comes from structured build-time data, the rest from the
  // generic runtime pairing. Neither should show [X% power].
  const r = FC.calculate(mk('Yin-Yang', 25), game);
  check('the berserk clause itself is computed, not shown as [X% power] raw text',
    r.active_traits.indexOf('Physical DMG & ') !== -1 &&
    !/\[[\d.]+% power\][^\n]*Physical Damage and/.test(r.active_traits));
  check('no [X% power] fallback left anywhere for this ore',
    !/% power\]/.test(r.active_traits));
}

{
  // Sealed Curse's Berserker trait is armor-only in the game, so a weapon never shows it
  const r = FC.calculate(mk('Sealed Curse', 25), game);
  check('armor-only Berserker (Sealed Curse) is not shown on a weapon',
    r.active_traits.indexOf('Physical DMG') === -1);
}

{
  // an ore with no berserk-clause trait at all is completely unaffected
  const r = FC.calculate(mk('Wolfarite', 15), game);
  check('ore without the trait: no "Physical DMG" text appears at all',
    r.active_traits.indexOf('Physical DMG') === -1);
}

{
  // numeric DPS must NOT change -- phys_dmg/move_speed/berserk_duration are
  // display-only and must never feed the real berserk_level calculation
  const withRace = FC.calculate(Object.assign(mk('Fierce Jade', 30), { race: 'Minotaur', berserk: 0 }), game);
  const withoutOre = FC.calculate(Object.assign(mk('None', 0), { race: 'Minotaur', berserk: 0 }), game);
  check('Fierce Jade\'s phys_dmg trait does not change berserkLevel (still exactly weapon_dps * 1.3)',
    Math.abs(withRace.berserk - withRace.weapon_dps * 1.3) < 1e-9);
  check('sanity: an unrelated build also gets exactly weapon_dps * 1.3 from Minotaur alone',
    withoutOre.berserk === null || Math.abs(withoutOre.berserk - withoutOre.weapon_dps * 1.3) < 1e-9);
}

console.log(fails === 0 ? '\nALL BERSERK-TRAIT CHECKS PASSED ✓' : '\n' + fails + ' CHECK(S) FAILED ✗');
process.exit(fails ? 1 : 0);
