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

function mk(oreName, amount, over) {
  return Object.assign({
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
  }, over || {});
}

let fails = 0;
function check(label, cond) {
  if (!cond) { fails++; console.log('  FAIL: ' + label); } else { console.log('  ok: ' + label); }
}

console.log('== Generic single-number trait clauses computed like Lethality, armor-type clauses hidden ==');

{
  const r = FC.calculate(mk('Stolen Heart', 20), game);
  const lsStr = '+' + ((0.7 + (7.0 - 0.7) * 0.5) / 100 * 100).toFixed(1) + '% Life Steal';
  check('Life Steal ramped value matches scaleRange (' + lsStr + ')', r.active_traits.indexOf(lsStr) !== -1);
  check('no [X% power] fallback left for this ore', !/% power\]/.test(r.active_traits));
}

{
  const r = FC.calculate(mk('Stolen Heart', 10), game);
  check('10% share: exact base Life Steal', r.active_traits.indexOf('+0.7% Life Steal') !== -1);
}

{
  const r = FC.calculate(mk('Wolfarite', 15), game);
  check('Swiftness and Vitality are armor-type traits and not shown',
    r.active_traits.indexOf('Swiftness') === -1 && r.active_traits.indexOf('Vitality') === -1);
  check('Wolfarite weapon stats still shown', r.active_traits.indexOf('Lethality') !== -1);
}

{
  const r = FC.calculate(mk('Sealed Curse', 20), game);
  check('standalone Movement Speed and Stamina are not shown',
    r.active_traits.indexOf('Movement Speed') === -1 && r.active_traits.indexOf('Stamina') === -1);
  check('the armor-only berserk clause is no longer shown on the weapon',
    r.active_traits.indexOf('Physical DMG & ') === -1);
}

{
  const r = FC.calculate(mk('Kokorite', 30), game);
  check('Endurance is not shown', r.active_traits.indexOf('Endurance') === -1);
}

{
  const r = FC.calculate(mk('Bismuth', 30), game);
  check('Bismuth regen and heal text is not shown', !/health/i.test(r.active_traits));
  check('Bismuth rune proc is still shown', r.active_traits.indexOf('T3 attack rune') !== -1);
}

{
  // genuinely compound / multi-number clauses (no leading clean "+X% Label")
  // must still fall back to the old [X% power] approximation -- e.g.
  // Prismatic Heart's "Freeze enemies for 0.2 seconds. 1.5% chance on hit..."
  const r = FC.calculate(mk('Prismatic Heart', 15), game);
  check('a genuinely unparseable compound clause still uses [X% power]', /% power\]/.test(r.active_traits));
}

{
  // an ore with only known numeric stats and no free-text extras at all is untouched
  const r = FC.calculate(mk('Marblite', 18), game);
  check('ore with only claimed stats: no stray extras, no [X% power]',
    !/% power\]/.test(r.active_traits) && r.active_traits.indexOf('Lightning DMG') !== -1);
}

console.log('\n== Stats (Capped) card: Berserk row + red cap color ==');

{
  check('createResultsPanel/statsCard source has a Berserk row', /label:\s*'Berserk'/.test(SRC));
  check('statsCard update reads statRows[4] for berserk_level', /statRows\[4\][\s\S]{0,80}berserk_level/.test(SRC));
}

{
  // The cap indicator must be a CSS class, not an inline style.color -- every
  // .fc-sv-* value color in the stylesheet is !important, and !important beats
  // an inline style every time, so setting style.color from JS silently never
  // took effect (the original bug this test now guards against).
  check('no more #ff5555 (old pink) anywhere in the JS', SRC.indexOf('#ff5555') === -1);
  check('no inline style.color used for the cap indicator anymore',
    !/valueEl\.style\.color\s*=/.test(SRC));
  check('cap indicator is a CSS class (CAP_CLASS), toggled via classList',
    /CAP_CLASS\s*=\s*'fc-is-capped'/.test(SRC) &&
    /classList\.add\(CAP_CLASS\)/.test(SRC) &&
    /classList\.toggle\(CAP_CLASS/.test(SRC));

  const css = fs.readFileSync(path.join(HERE, 'Template-ForgeCalculator-styles.css'), 'utf8');
  const capRuleMatch = /\.fc-is-capped\s*\{[^}]*color:\s*#cc0000\s*!important/.exec(css) ||
    /\.fc-is-capped[^{]*\{[^}]*color:\s*#cc0000\s*!important/.exec(css);
  check('stylesheet defines .fc-is-capped as true red with !important', !!capRuleMatch);

  // Specificity is per comma-separated branch, not summed across the whole
  // selector list -- take the branch that actually mentions the class in
  // question and count its own classes.
  function specificityFor(selectorListText, targetClass) {
    const branches = selectorListText.split(',');
    let max = 0;
    for (const branch of branches) {
      if (branch.indexOf(targetClass) === -1) { continue; }
      const n = (branch.match(/\.[A-Za-z-]+/g) || []).length;
      if (n > max) { max = n; }
    }
    return max;
  }
  const pctSelectorText = (css.match(/([^{}]*\.fc-sv-pct[^{}]*)\{/) || [])[1] || '';
  const capSelectorText = (css.match(/([^{}]*\.fc-is-capped[^{}]*)\{/) || [])[1] || '';
  check('.fc-is-capped has higher selector specificity than .fc-sv-pct (so it always wins, regardless of source order)',
    specificityFor(capSelectorText, '.fc-is-capped') > specificityFor(pctSelectorText, '.fc-sv-pct'));
}

{
  const r = FC.calculate(mk('Wolfarite', 30, { race: 'Minotaur', berserk: 190 }), game);
  check('berserk_level field is exposed: input capped at 200%, Minotaur 30% on top',
    Math.abs(r.berserk_level - 2.3) < 1e-12);
}

{
  const r = FC.calculate(mk('Wolfarite', 30, { berserk: 0 }), game);
  check('no berserk source -> berserk_level is exactly 0 (not null, unlike result.berserk)',
    r.berserk_level === 0);
}

console.log(fails === 0 ? '\nALL GENERIC-TRAIT-RAMP CHECKS PASSED ✓' : '\n' + fails + ' CHECK(S) FAILED ✗');
process.exit(fails ? 1 : 0);
