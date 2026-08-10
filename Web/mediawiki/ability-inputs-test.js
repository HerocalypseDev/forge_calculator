/**
 * Focused tests for the MediaWiki ability inputs (Fire / Poison / Blast):
 *  - clampAbilityValue: 0/empty = "no ability"; non-zero clamps into [min,max]
 *  - createAbilityGrid: min/max/step/placeholder/title attributes + clamping
 *    on change / blur / (debounced) input
 *  - transformBuildForEngine: whole-percent UI values -> decimal engine values
 *
 * Run: node Web/mediawiki/ability-inputs-test.js
 *
 * Strategy: same as verify-engine.js — evaluate the real Common.js source in a
 * Node vm with a minimal DOM mock, inject exports before the DATA LOADING
 * section, then assert directly on the injected functions.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const HERE = __dirname;
const SRC = fs.readFileSync(path.join(HERE, 'MediaWiki-ForgeCalculator.js'), 'utf8');

// --- Inject an export hook right before the DATA LOADING section ---
const marker = 'var DATA_TITLES = {';
const idx = SRC.indexOf(marker);
if (idx < 0) { throw new Error('DATA LOADING marker not found'); }
const blockStart = SRC.lastIndexOf('\n', idx) + 1;
const instrumented = SRC.slice(0, blockStart) +
  '  globalThis.__FC = { clampAbilityValue: clampAbilityValue, transformBuildForEngine: transformBuildForEngine, createAbilityGrid: createAbilityGrid };\n' +
  SRC.slice(blockStart);

// --- Minimal DOM mock ---
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

// --- Sandbox ---
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

// ---------- clampAbilityValue ----------
console.log('== clampAbilityValue ==');
assert(FC.clampAbilityValue('', 1, 22) === 0, 'empty -> 0 (no ability)');
assert(FC.clampAbilityValue('0', 1, 22) === 0, 'zero -> 0 (no ability)');
assert(FC.clampAbilityValue('0.5', 1, 22) === 1, 'below min -> min');
assert(FC.clampAbilityValue('-5', 1, 22) === 1, 'negative -> min');
assert(FC.clampAbilityValue('1', 1, 22) === 1, 'min stays');
assert(FC.clampAbilityValue('15', 1, 22) === 15, 'in-range stays');
assert(FC.clampAbilityValue('15%', 1, 22) === 15, 'trailing % tolerated');
assert(FC.clampAbilityValue(' 15 ', 1, 22) === 15, 'whitespace tolerated');
assert(FC.clampAbilityValue('22', 1, 22) === 22, 'max stays');
assert(FC.clampAbilityValue('30', 1, 22) === 22, 'above max -> max');
assert(FC.clampAbilityValue('abc', 1, 22) === 0, 'non-numeric -> 0');
assert(FC.clampAbilityValue('5', 1, 3) === 3, 'time above max -> max');
assert(FC.clampAbilityValue('2', 1, 6) === 2, 'time in-range stays');

// ---------- transformBuildForEngine ----------
console.log('== transformBuildForEngine ==');
function uiBuild(overrides) {
  return Object.assign({
    oreSlots: [], weaponName: 'Dagger', quality: 100, enhancement: 0,
    race: 'None',
    armorLethality: 0, armorCritChance: 0, armorCritDmg: 0,
    fireDmg: 0, fireChance: 0, fireTime: 0,
    poisonDmg: 0, poisonChance: 0, poisonTime: 0,
    blastDmg: 0, blastChance: 0,
    runes: [], achievement: 'None'
  }, overrides);
}
{
  const eng = FC.transformBuildForEngine(uiBuild({
    fireDmg: 15, fireChance: 50, fireTime: 2,
    poisonDmg: 7, poisonChance: 35, poisonTime: 4,
    blastDmg: 40, blastChance: 20
  })).abilities;
  assert(eng.fire_dmg === 0.15, 'fire_dmg 15% -> 0.15');
  assert(eng.fire_chance === 0.5, 'fire_chance 50% -> 0.5');
  assert(eng.fire_time === 2, 'fire_time seconds unchanged');
  assert(eng.poison_dmg === 0.07, 'poison_dmg 7% -> 0.07');
  assert(eng.poison_chance === 0.35, 'poison_chance 35% -> 0.35');
  assert(eng.poison_time === 4, 'poison_time seconds unchanged');
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
    'poison_time', 'blast_dmg', 'blast_chance'].every((k) => eng[k] === 0);
  assert(allZero, 'default build -> all ability values 0');
}

// ---------- createAbilityGrid (DOM) ----------
console.log('== createAbilityGrid ==');
let lastValues = null;
const grid = FC.createAbilityGrid({
  values: {
    fireDmg: 0, fireChance: 0, fireTime: 0,
    poisonDmg: 0, poisonChance: 0, poisonTime: 0,
    blastDmg: 0, blastChance: 0
  },
  onChange: (v) => { lastValues = v; }
});

const inputs = grid.querySelectorAll('.fc-ability-input');
assert(inputs.length === 8, '8 ability inputs rendered');

const byId = {};
inputs.forEach((inp) => { byId[inp.id] = inp; });

// Expected attributes per field: {min, max, placeholder, titleContains}
const expected = {
  fireDmg: { min: '1', max: '22', placeholder: '1-22%', title: 'Range: 1-22%' },
  fireChance: { min: '1', max: '50', placeholder: '1-50%', title: 'Range: 1-50%' },
  fireTime: { min: '1', max: '3', placeholder: '1-3s', title: 'Range: 1-3s' },
  poisonDmg: { min: '1', max: '7', placeholder: '1-7%', title: 'Range: 1-7%' },
  poisonChance: { min: '1', max: '35', placeholder: '1-35%', title: 'Range: 1-35%' },
  poisonTime: { min: '1', max: '6', placeholder: '1-6s', title: 'Range: 1-6s' },
  blastDmg: { min: '1', max: '40', placeholder: '1-40%', title: 'Range: 1-40%' },
  blastChance: { min: '1', max: '20', placeholder: '1-20%', title: 'Range: 1-20%' }
};
Object.keys(expected).forEach((key) => {
  const inp = byId[key];
  const exp = expected[key];
  assert(inp, `input exists: ${key}`);
  assert(inp && inp.getAttribute('min') === exp.min, `${key} min=${exp.min}`);
  assert(inp && inp.getAttribute('max') === exp.max, `${key} max=${exp.max}`);
  assert(inp && inp.getAttribute('step') === '1', `${key} step=1`);
  assert(inp && inp.getAttribute('placeholder') === exp.placeholder, `${key} placeholder=${exp.placeholder}`);
  assert(inp && (inp.getAttribute('title') || '').indexOf(exp.title) !== -1, `${key} title shows range`);
  assert(inp && (inp.getAttribute('title') || '').indexOf('0 = no ability') !== -1, `${key} title mentions 0 = no ability`);
});

// change event clamps (no debounce on 'change')
byId.fireDmg.value = '30';
byId.fireDmg.dispatchEvent({ type: 'change' });
assert(lastValues.fireDmg === 22, 'change: fireDmg 30 -> clamped 22');
assert(byId.fireDmg.value === '22', 'change: input snaps to 22');

byId.fireChance.value = '0.5';
byId.fireChance.dispatchEvent({ type: 'change' });
assert(lastValues.fireChance === 1, 'change: fireChance 0.5 -> min 1');

byId.fireTime.value = '9';
byId.fireTime.dispatchEvent({ type: 'change' });
assert(lastValues.fireTime === 3, 'change: fireTime 9 -> max 3');

// blur event clamps
byId.poisonDmg.value = '0';
byId.poisonDmg.dispatchEvent({ type: 'blur' });
assert(lastValues.poisonDmg === 0, 'blur: poisonDmg 0 stays 0 (no ability)');

byId.poisonChance.value = '60';
byId.poisonChance.dispatchEvent({ type: 'blur' });
assert(lastValues.poisonChance === 35, 'blur: poisonChance 60 -> max 35');

// empty clears to 0
byId.blastDmg.value = '';
byId.blastDmg.dispatchEvent({ type: 'change' });
assert(lastValues.blastDmg === 0, 'change: empty -> 0');

// debounced input event clamps after the debounce window
byId.fireDmg.value = '5';
byId.fireDmg.dispatchEvent({ type: 'input' });
setTimeout(() => {
  assert(lastValues.fireDmg === 5, 'input: fireDmg 5 commits after debounce');

  // setValues / getValues round-trip (percent space)
  grid.setValues({ fireDmg: 15 });
  assert(byId.fireDmg.value === '15', 'setValues: fireDmg 15 displays');
  const vals = grid.getValues();
  assert(vals.fireDmg === 15 && vals.fireChance === 1 && vals.fireTime === 3, 'getValues reflects last committed values');

  // ---------- Source-level checks for section header ----------
  console.log('== Section header (source) ==');
  assert(SRC.indexOf("'Abilities (From Runes)'") !== -1, "header is 'Abilities (From Runes)'");
  assert(SRC.indexOf('fc-ability-section-subtext') !== -1, 'subtext class present');
  assert(SRC.indexOf('Input abilities from Runes') !== -1, 'subtext mentions abilities from runes');
  assert(SRC.indexOf('Enter percentage as whole number') !== -1, 'subtext explains whole-number percents');

  console.log(failures === 0 ? '\nALL ABILITY-INPUT CHECKS PASSED ✓' : `\n${failures} CHECK(S) FAILED ✗`);
  process.exit(failures === 0 ? 0 : 1);
}, 250);
