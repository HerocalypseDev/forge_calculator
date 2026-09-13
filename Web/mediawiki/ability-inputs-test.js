'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const HERE = __dirname;
const SRC = fs.readFileSync(path.join(HERE, 'MediaWiki-ForgeCalculator.js'), 'utf8');

const marker = 'var DATA_TITLES = {';
const idx = SRC.indexOf(marker);
if (idx < 0) { throw new Error('DATA LOADING marker not found'); }
const blockStart = SRC.lastIndexOf('\n', idx) + 1;
const instrumented = SRC.slice(0, blockStart) +
  '  globalThis.__FC = { clampAbilityValue: clampAbilityValue, transformBuildForEngine: transformBuildForEngine, createAbilityGrid: createAbilityGrid };\n' +
  SRC.slice(blockStart);

function makeEl(tag) {
  const el = {
    tagName: tag,
    nodeType: 1,
    children: [],
    parentNode: null,
    className: '',
    attributes: {},
    dataset: {},
    style: {},
    id: '',
    textContent: '',
    _value: '',
    _handlers: {}
  };

  Object.defineProperty(el, 'value', {
    get() { return this._value; },
    set(v) { this._value = (v === undefined || v === null) ? '' : String(v); },
    configurable: true
  });

  el.classList = {
    _set: new Set(),
    add(...cs) { cs.forEach((c) => this._set.add(c)); el.className = Array.from(this._set).join(' '); },
    remove(...cs) { cs.forEach((c) => this._set.delete(c)); el.className = Array.from(this._set).join(' '); },
    contains(c) { return this._set.has(c); },
    toggle(c, force) { if (force === undefined ? !this._set.has(c) : force) { this.add(c); } else { this.remove(c); } }
  };

  el.setAttribute = function (k, v) {
    this.attributes[k] = String(v);
    if (k === 'id') { this.id = String(v); }
    if (k === 'value') { this.value = String(v); }
  };
  el.getAttribute = function (k) { return this.attributes[k]; };
  el.appendChild = function (c) { this.children.push(c); c.parentNode = this; return c; };
  el.append = function (...cs) { cs.forEach((c) => this.appendChild(c)); };
  el.removeChild = function (c) {
    const i = this.children.indexOf(c);
    if (i >= 0) { this.children.splice(i, 1); }
    return c;
  };
  el.addEventListener = function (type, fn) { (this._handlers[type] = this._handlers[type] || []).push(fn); };
  el.dispatchEvent = function (ev) {
    const fns = this._handlers[ev.type] || [];
    fns.slice().forEach((fn) => fn.call(this, ev));
  };
  el.querySelectorAll = function (sel) {
    const out = [];
    const walk = (n) => {
      (n.children || []).forEach((c) => {
        const cls = c.className || '';
        if (sel.startsWith('.') && cls.split(/\s+/).includes(sel.slice(1))) { out.push(c); }
        walk(c);
      });
    };
    walk(this);
    return out;
  };

  return el;
}

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
  window: null,
  document: {
    readyState: 'complete',
    getElementById: () => null,
    addEventListener: () => {},
    createElement: makeEl,
    createTextNode: (t) => ({ nodeType: 3, textContent: String(t), children: [] })
  }
};
sandbox.window = sandbox;
sandbox.window.mediaWiki = mw;

vm.createContext(sandbox);
vm.runInContext(instrumented, sandbox, { filename: 'MediaWiki-ForgeCalculator.js' });

const FC = sandbox.__FC;
if (!FC) { throw new Error('Export hook did not run — extraction failed'); }

let failures = 0;
function assert(cond, label) {
  if (!cond) {
    failures++;
    console.log(`  FAIL ${label}`);
  }
  return cond;
}

console.log('== clampAbilityValue ==');
assert(FC.clampAbilityValue('') === 0, 'empty -> 0 (no ability)');
assert(FC.clampAbilityValue('0') === 0, 'zero -> 0 (no ability)');
assert(FC.clampAbilityValue('0.5') === 0.5, 'no min floor -- passes through');
assert(FC.clampAbilityValue('-5') === -5, 'no min floor -- negative passes through');
assert(FC.clampAbilityValue('1') === 1, 'unchanged');
assert(FC.clampAbilityValue('15') === 15, 'unchanged');
assert(FC.clampAbilityValue('15%') === 15, 'trailing % tolerated');
assert(FC.clampAbilityValue(' 15 ') === 15, 'whitespace tolerated');
assert(FC.clampAbilityValue('22') === 22, 'unchanged');
assert(FC.clampAbilityValue('30') === 30, 'no max ceiling -- passes through');
assert(FC.clampAbilityValue('abc') === 0, 'non-numeric -> 0');
assert(FC.clampAbilityValue('5') === 5, 'no max ceiling on time fields either');
assert(FC.clampAbilityValue('9999') === 9999, 'arbitrarily large values pass through unclamped');

console.log('== transformBuildForEngine ==');
function uiBuild(overrides) {
  return Object.assign({
    oreSlots: [], weaponName: 'Dagger', quality: 100, enhancement: 0,
    race: 'None',
    armorLethality: 0, armorCritChance: 0, armorCritDmg: 0,
    fireDmg: 0, fireChance: 0, fireTime: 0,
    poisonDmg: 0, poisonChance: 0, poisonTime: 0,
    lightningDmg: 0, lightningChance: 0, lightningCooldown: 0,
    blastDmg: 0, blastChance: 0,
    runes: [], achievement: 'None'
  }, overrides);
}
{
  const eng = FC.transformBuildForEngine(uiBuild({
    fireDmg: 15, fireChance: 50, fireTime: 2,
    poisonDmg: 7, poisonChance: 35, poisonTime: 4,
    lightningDmg: 80, lightningChance: 60, lightningCooldown: 2,
    blastDmg: 40, blastChance: 20
  })).abilities;
  assert(eng.fire_dmg === 0.15, 'fire_dmg 15% -> 0.15');
  assert(eng.fire_chance === 0.5, 'fire_chance 50% -> 0.5');
  assert(eng.fire_time === 2, 'fire_time seconds unchanged');
  assert(eng.poison_dmg === 0.07, 'poison_dmg 7% -> 0.07');
  assert(eng.poison_chance === 0.35, 'poison_chance 35% -> 0.35');
  assert(eng.poison_time === 4, 'poison_time seconds unchanged');
  assert(eng.lightning_dmg === 0.8, 'lightning_dmg 80% -> 0.8');
  assert(eng.lightning_chance === 0.6, 'lightning_chance 60% -> 0.6');
  assert(eng.lightning_cooldown === 2, 'lightning_cooldown seconds unchanged');
  assert(eng.blast_dmg === 0.4, 'blast_dmg 40% -> 0.4');
  assert(eng.blast_chance === 0.2, 'blast_chance 20% -> 0.2');
}
{
  const eng = FC.transformBuildForEngine(uiBuild({
    fireDmg: 100, fireChance: 100, poisonDmg: 100, poisonChance: 100, blastDmg: 100, blastChance: 100
  })).abilities;
  assert(eng.fire_dmg === 1 && eng.fire_chance === 1, '100% -> 1.0');
}
{
  const eng = FC.transformBuildForEngine(uiBuild()).abilities;
  const allZero = ['fire_dmg', 'fire_chance', 'fire_time', 'poison_dmg', 'poison_chance',
    'poison_time', 'lightning_dmg', 'lightning_chance', 'lightning_cooldown',
    'blast_dmg', 'blast_chance'].every((k) => eng[k] === 0);
  assert(allZero, 'default build -> all ability values 0');
}

console.log('== createAbilityGrid ==');
let lastValues = null;
const grid = FC.createAbilityGrid({
  values: {
    fireDmg: 0, fireChance: 0, fireTime: 0,
    poisonDmg: 0, poisonChance: 0, poisonTime: 0,
    lightningDmg: 0, lightningChance: 0, lightningCooldown: 0,
    blastDmg: 0, blastChance: 0
  },
  onChange: (v) => { lastValues = v; }
});

const inputs = grid.querySelectorAll('.fc-ability-input');
assert(inputs.length === 11, '11 ability inputs rendered');

const byId = {};
inputs.forEach((inp) => { byId[inp.id] = inp; });

const expected = {
  fireDmg: { step: '1' },
  fireChance: { step: '1' },
  fireTime: { step: '1' },
  poisonDmg: { step: '1' },
  poisonChance: { step: '1' },
  poisonTime: { step: '1' },
  lightningDmg: { step: '1' },
  lightningChance: { step: '1' },
  lightningCooldown: { step: '0.1' },
  blastDmg: { step: '1' },
  blastChance: { step: '1' }
};
Object.keys(expected).forEach((key) => {
  const inp = byId[key];
  const exp = expected[key];
  assert(inp, `input exists: ${key}`);
  assert(inp && inp.getAttribute('min') === undefined, `${key} has no min attribute`);
  assert(inp && inp.getAttribute('max') === undefined, `${key} has no max attribute`);
  assert(inp && inp.getAttribute('step') === exp.step, `${key} step=${exp.step}`);
  assert(inp && inp.getAttribute('placeholder') === '0', `${key} placeholder=0`);
  assert(inp && (inp.getAttribute('title') || '').indexOf('Range:') === -1, `${key} title no longer shows a range`);
  assert(inp && (inp.getAttribute('title') || '').indexOf('0 = no ability') !== -1, `${key} title mentions 0 = no ability`);
});

byId.fireDmg.value = '30';
byId.fireDmg.dispatchEvent({ type: 'change' });
assert(lastValues.fireDmg === 30, 'change: fireDmg 30 passes through unclamped');
assert(byId.fireDmg.value === '30', 'change: input keeps 30, no snapping');

byId.fireChance.value = '0.5';
byId.fireChance.dispatchEvent({ type: 'change' });
assert(lastValues.fireChance === 0.5, 'change: fireChance 0.5 passes through, no min floor');

byId.fireTime.value = '9';
byId.fireTime.dispatchEvent({ type: 'change' });
assert(lastValues.fireTime === 9, 'change: fireTime 9 passes through, no max ceiling');

byId.poisonDmg.value = '0';
byId.poisonDmg.dispatchEvent({ type: 'blur' });
assert(lastValues.poisonDmg === 0, 'blur: poisonDmg 0 stays 0 (no ability)');

byId.poisonChance.value = '60';
byId.poisonChance.dispatchEvent({ type: 'blur' });
assert(lastValues.poisonChance === 60, 'blur: poisonChance 60 passes through, no max ceiling');

byId.lightningDmg.value = '120';
byId.lightningDmg.dispatchEvent({ type: 'change' });
assert(lastValues.lightningDmg === 120, 'change: lightningDmg 120 passes through, no max ceiling');

byId.lightningCooldown.value = '0.1';
byId.lightningCooldown.dispatchEvent({ type: 'change' });
assert(lastValues.lightningCooldown === 0.1, 'change: lightningCooldown 0.1 passes through, no min floor');

byId.lightningCooldown.value = '2.5';
byId.lightningCooldown.dispatchEvent({ type: 'blur' });
assert(lastValues.lightningCooldown === 2.5, 'blur: fractional cooldown preserved');

byId.blastDmg.value = '';
byId.blastDmg.dispatchEvent({ type: 'change' });
assert(lastValues.blastDmg === 0, 'change: empty -> 0');

console.log('== non-numeric ability input warnings ==');
assert(grid.getInvalidAbilityWarnings().length === 0, 'no warnings before typing garbage');

byId.blastChance.value = 'abc';
byId.blastChance.dispatchEvent({ type: 'change' });
assert(lastValues.blastChance === 0, 'change: non-numeric -> 0 (still zeroed, just no longer range-clamped)');
assert(
  grid.getInvalidAbilityWarnings().indexOf('Blast Chance ability only takes numerical values.') !== -1,
  'non-numeric blastChance surfaces a warning'
);

byId.blastChance.value = '10';
byId.blastChance.dispatchEvent({ type: 'change' });
assert(lastValues.blastChance === 10, 'change: valid number after garbage commits normally');
assert(grid.getInvalidAbilityWarnings().length === 0, 'warning clears once a valid number is entered');

byId.fireDmg.value = '5';
byId.fireDmg.dispatchEvent({ type: 'input' });
setTimeout(() => {
  assert(lastValues.fireDmg === 5, 'input: fireDmg 5 commits after debounce');

  grid.setValues({ fireDmg: 15 });
  assert(byId.fireDmg.value === '15', 'setValues: fireDmg 15 displays');
  const vals = grid.getValues();
  assert(vals.fireDmg === 15 && vals.fireChance === 0.5 && vals.fireTime === 9, 'getValues reflects last committed values');

  console.log('== Section header (source) ==');
  assert(SRC.indexOf("'Abilities (From Runes)'") !== -1, "header is 'Abilities (From Runes)'");
  assert(SRC.indexOf('fc-input-section-subtext') !== -1, 'subtext class present');
  assert(SRC.indexOf('Input abilities from Runes') !== -1, 'subtext mentions abilities from runes');
  assert(SRC.indexOf('Enter percentage as whole number') !== -1, 'subtext explains whole-number percents');

  console.log(failures === 0 ? '\nALL ABILITY-INPUT CHECKS PASSED ✓' : `\n${failures} CHECK(S) FAILED ✗`);
  process.exit(failures === 0 ? 0 : 1);
}, 250);
