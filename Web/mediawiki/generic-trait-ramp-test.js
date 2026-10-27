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

console.log('== Generic single-number trait clauses (Vitality, Swiftness, ...) computed like Lethality ==');

{
  // Wolfarite trait10 "+0.6% Swiftness | -0.8% Vitality", trait30 "+6% Swiftness | -8% Vitality"
  const r = FC.calculate(mk('Wolfarite', 15), game);
  const share = 0.15;
  const swiftness = 0.6 + (6.0 - 0.6) * Math.min((share - 0.10) / 0.20, 1.0);
  const vitality = -0.8 + (-8.0 - -0.8) * Math.min((share - 0.10) / 0.20, 1.0);
  const swStr = '+' + (Math.round(swiftness * 10) / 10) + '% Swiftness';
  const viStr = '-' + (Math.round(Math.abs(vitality) * 10) / 10) + '% Vitality';
  check('Swiftness ramped value matches scaleRange (' + swStr + ')', r.active_traits.indexOf(swStr) !== -1);
  check('Vitality ramped value matches scaleRange (' + viStr + ')', r.active_traits.indexOf(viStr) !== -1);
  check('no [X% power] fallback left for this ore', !/% power\]/.test(r.active_traits));
}

{
  // exact 10% share -> exact base numbers, no interpolation error
  const r = FC.calculate(mk('Wolfarite', 10), game);
  check('10% share: exact base Swiftness/Vitality', r.active_traits.indexOf('+0.6% Swiftness') !== -1 &&
    r.active_traits.indexOf('-0.8% Vitality') !== -1);
}

{
  // Sealed Curse's standalone "-1.5% Movement Speed" (distinct from its berserk
  // clause's "+X% Movement Speed... when HP drops below 35%") is also paired
  // and computed now, via the generic mechanism rather than a named stat slot
  const r = FC.calculate(mk('Sealed Curse', 20), game);
  const share = 0.20;
  const ms = -1.5 + (-15.0 - -1.5) * Math.min((share - 0.10) / 0.20, 1.0);
  const msStr = '-' + (Math.round(Math.abs(ms) * 10) / 10) + '% Movement Speed';
  check('standalone Movement Speed (distinct from the berserk clause) computed: ' + msStr,
    r.active_traits.indexOf(msStr) !== -1);
  check('the armor-only berserk clause is no longer shown on the weapon',
    r.active_traits.indexOf('Physical DMG & ') === -1);
}

{
  // Kokorite has Endurance in addition to Vitality/Swiftness
  const r = FC.calculate(mk('Kokorite', 30), game);
  check('Endurance computed at full (30%) share: -5% Endurance', r.active_traits.indexOf('-5% Endurance') !== -1);
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
  check('berserk_level field is exposed on the result and capped at 2.0 (200%)',
    r.berserk_level === 2.0);
}

{
  const r = FC.calculate(mk('Wolfarite', 30, { berserk: 0 }), game);
  check('no berserk source -> berserk_level is exactly 0 (not null, unlike result.berserk)',
    r.berserk_level === 0);
}

console.log(fails === 0 ? '\nALL GENERIC-TRAIT-RAMP CHECKS PASSED ✓' : '\n' + fails + ' CHECK(S) FAILED ✗');
process.exit(fails ? 1 : 0);
