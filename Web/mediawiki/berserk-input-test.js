/**
 * Focused test for the Berserk input (MediaWiki):
 *  - Berserk field uses whole-percent entry (30 = 30%), step=1, max = lethality
 *    cap (150), min 0
 *  - Commit clamps into [0, 150]; non-numeric/empty -> 0
 *  - transformBuildForEngine divides berserk by 100 (decimal for the engine)
 *  - Engine end-to-end: build.berserk feeds the berserk burst (C92), Minotaur
 *    race adds +30% on top (E53), and 0 + no Minotaur -> null (renders "—")
 *
 * Run: node Web/mediawiki/berserk-input-test.js
 *
 * Strategy: render the real input panel in a Node DOM mock, drive the berserk
 * number input, then run calculate(transformBuildForEngine(build)) — the exact
 * path the Calculate DPS button uses.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const HERE = __dirname;
const SRC = fs.readFileSync(path.join(HERE, 'forge-calculator.common.js'), 'utf8');

const marker = 'var DATA_TITLES = {';
const idx = SRC.indexOf(marker);
if (idx < 0) { throw new Error('DATA LOADING marker not found'); }
const blockStart = SRC.lastIndexOf('\n', idx) + 1;
const instrumented = SRC.slice(0, blockStart) +
  '  globalThis.__FC = {\n' +
  '    calculate: calculate,\n' +
  '    buildGameData: buildGameData,\n' +
  '    transformBuildForEngine: transformBuildForEngine,\n' +
  '    createInputPanel: createInputPanel\n' +
  '  };\n' +
  SRC.slice(blockStart);

// --- DOM mock (createEl + events + querySelector) ---
function makeEl(tag) {
  const el = {
    tagName: tag,
    nodeType: tag === 'fragment' ? 11 : 1,
    children: [],
    parentNode: null,
    attributes: {},
    dataset: {},
    style: {},
    id: '',
    _value: '',
    _handlers: {},
    _text: null,
    _classes: new Set()
  };

  Object.defineProperty(el, 'className', {
    get() { return Array.from(el._classes).join(' '); },
    set(v) { el._classes = new Set(String(v).split(/\s+/).filter(Boolean)); }
  });
  el.classList = {
    add(...cs) { cs.forEach((c) => el._classes.add(c)); },
    remove(...cs) { cs.forEach((c) => el._classes.delete(c)); },
    contains(c) { return el._classes.has(c); },
    toggle(c, force) {
      if (force === undefined ? !el._classes.has(c) : force) { el._classes.add(c); } else { el._classes.delete(c); }
    }
  };

  Object.defineProperty(el, 'value', {
    get() { return this._value; },
    set(v) { this._value = (v === undefined || v === null) ? '' : String(v); },
    configurable: true
  });

  Object.defineProperty(el, 'textContent', {
    get() {
      const collect = (n) => {
        if (n.nodeType === 3) { return n._text; }
        if (n._text !== null) { return n._text; }
        return (n.children || []).map(collect).join('');
      };
      return this._text !== null ? this._text : collect(this);
    },
    set(v) {
      this._text = String(v);
      this.children = [];
    }
  });

  el.setAttribute = function (k, v) {
    this.attributes[k] = String(v);
    if (k === 'id') { this.id = String(v); }
    if (k === 'value') { this.value = String(v); }
    if (k.indexOf('data-') === 0) { this.dataset[k.slice(5)] = String(v); }
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
    if (!ev.target) { ev.target = this; }
    const fns = this._handlers[ev.type] || [];
    fns.slice().forEach((fn) => fn.call(this, ev));
  };
  el.focus = function () {};
  el.blur = function () {};
  el.select = function () {};
  el.contains = function (n) {
    let cur = n;
    while (cur) { if (cur === this) { return true; } cur = cur.parentNode; }
    return false;
  };
  el.remove = function () { if (this.parentNode) { this.parentNode.removeChild(this); } };
  el._matchesClass = function (cls) { return (this.className || '').split(/\s+/).includes(cls); };
  el.querySelector = function (sel) {
    const cls = sel.replace(/\[[^\]]*\]/g, '').slice(1);
    let out = null;
    const walk = (n) => {
      if (out) { return; }
      (n.children || []).forEach((c) => {
        if (out) { return; }
        if (c._matchesClass && c._matchesClass(cls)) { out = c; return; }
        walk(c);
      });
    };
    walk(this);
    return out;
  };
  el.querySelectorAll = function (sel) {
    const cls = sel.replace(/\[[^\]]*\]/g, '').slice(1);
    const out = [];
    const walk = (n) => {
      (n.children || []).forEach((c) => {
        if (c._matchesClass && c._matchesClass(cls)) { out.push(c); }
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
    createTextNode: (t) => ({ nodeType: 3, _text: String(t), children: [] }),
    createDocumentFragment: () => makeEl('fragment')
  }
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

let failures = 0;
function assert(cond, label) {
  if (!cond) {
    failures++;
    console.log(`  FAIL ${label}`);
  }
  return cond;
}
function approx(actual, expected, label, eps) {
  const ok = Math.abs(actual - expected) <= (eps !== undefined ? eps : 1e-6);
  if (!ok) {
    failures++;
    console.log(`  FAIL ${label}: expected ${expected}, got ${actual}`);
  }
  return ok;
}

// --- Render the real input panel with a stub build ---
let build = {
  oreSlots: [
    { name: 'None', amount: 0 },
    { name: 'None', amount: 0 },
    { name: 'None', amount: 0 },
    { name: 'None', amount: 0 }
  ],
  weaponType: 'None',
  weaponName: 'None',
  quality: 100,
  enhancement: 0,
  race: 'None',
  armorLethality: 0, armorCritChance: 0, armorCritDmg: 0,
  fireDmg: 0, fireChance: 0, fireTime: 0,
  poisonDmg: 0, poisonChance: 0, poisonTime: 0,
  blastDmg: 0, blastChance: 0,
  berserk: 0,
  runes: ['None', 'None', 'None', 'None', 'None', 'None'],
  achievement: 'None'
};

let lastBuild = build;
const inputPanel = FC.createInputPanel({
  data: game,
  getBuild: () => build,
  onBuildChange: (nb) => { build = nb; lastBuild = nb; },
  onCalculate: null
});

// Find the berserk input by id within the rendered panel tree
let berserkInput = null;
const findId = (n) => {
  if (berserkInput) { return; }
  if (n.id === 'berserk') { berserkInput = n; return; }
  (n.children || []).forEach(findId);
};
findId(inputPanel);

function commit(value) {
  berserkInput.value = value;
  berserkInput.dispatchEvent({ type: 'change' });
}

console.log('== Input attributes ==');
assert(!!berserkInput, 'berserk input rendered (id berserk)');
assert(berserkInput.getAttribute('min') === '0', 'min=0');
assert(berserkInput.getAttribute('max') === '150', 'max=150 (lethality cap)');
assert(berserkInput.getAttribute('step') === '1', 'step=1 (whole percent)');
assert(berserkInput.getAttribute('inputmode') === 'numeric', 'numeric inputmode');

console.log('== Commit clamping ==');
commit('200');
assert(lastBuild.berserk === 150, '200 -> clamped to 150');
assert(berserkInput.value === '150', 'input snaps to 150');
commit('-5');
assert(lastBuild.berserk === 0, '-5 -> clamped to 0');
commit('abc');
assert(lastBuild.berserk === 0, 'non-numeric -> 0');
commit('30');
assert(lastBuild.berserk === 30, '30 stays 30');
commit('0');
assert(lastBuild.berserk === 0, '0 stays 0 (no berserk)');

console.log('== transformBuildForEngine divides by 100 ==');
{
  const eng = FC.transformBuildForEngine(Object.assign({}, build, { berserk: 30 }));
  assert(eng.berserk === 0.3, 'berserk 30% -> 0.3');
  const eng2 = FC.transformBuildForEngine(Object.assign({}, build, { berserk: 150 }));
  assert(eng2.berserk === 1.5, 'berserk 150% -> 1.5');
}

console.log('== Engine end-to-end (C92 berserk burst) ==');
function uiBuild(overrides) {
  return Object.assign({
    oreSlots: [
      { name: 'None', amount: 0 },
      { name: 'None', amount: 0 },
      { name: 'None', amount: 0 },
      { name: 'None', amount: 0 }
    ],
    weaponName: 'Dagger', quality: 100, enhancement: 0, race: 'None',
    armorLethality: 0, armorCritChance: 0, armorCritDmg: 0,
    fireDmg: 0, fireChance: 0, fireTime: 0,
    poisonDmg: 0, poisonChance: 0, poisonTime: 0,
    blastDmg: 0, blastChance: 0,
    berserk: 0,
    runes: [], achievement: 'None'
  }, overrides);
}
{
  // Minotaur race (+30%) + 30% input -> berserk_level 0.60.
  // Dagger Q100: base = 4.3 * 2 = 8.6, atk rate 1/0.47, blend 1.0 (no crit).
  // berserk = 8.6 * (1 + 0.60) / 0.47 = 29.2766...
  const r = FC.calculate(FC.transformBuildForEngine(
    uiBuild({ race: 'Minotaur', berserk: 30 })
  ), game);
  approx(r.berserk, 8.6 * 1.6 / 0.47, 'Minotaur + 30% berserk DPS');
  assert(r.berserk !== null && r.berserk > r.weapon_dps, 'berserk > weapon DPS (lethality boosted)');

  // No Minotaur, 30% input -> berserk_level 0.30 -> 8.6 * 1.3 / 0.47
  const r2 = FC.calculate(FC.transformBuildForEngine(
    uiBuild({ race: 'None', berserk: 30 })
  ), game);
  approx(r2.berserk, 8.6 * 1.3 / 0.47, 'manual 30% berserk DPS (no Minotaur)');

  // Zero input, no Minotaur -> null (results row renders "—")
  const r3 = FC.calculate(FC.transformBuildForEngine(
    uiBuild({ race: 'None', berserk: 0 })
  ), game);
  assert(r3.berserk === null, 'berserk 0 + no Minotaur -> null');

  // Berserk must NOT change the normal total DPS (it is a separate burst row)
  const plain = FC.calculate(FC.transformBuildForEngine(uiBuild({ race: 'None', berserk: 0 })), game);
  const berserked = FC.calculate(FC.transformBuildForEngine(uiBuild({ race: 'None', berserk: 30 })), game);
  assert(plain.total_dps === berserked.total_dps, 'normal total_dps unchanged by berserk input');
}

console.log('== setBuild restores the berserk value ==');
inputPanel.setBuild(Object.assign({}, build, { berserk: 150 }));
assert(berserkInput.value === '150', 'setBuild(berserk 150) -> input shows 150');
inputPanel.setBuild(Object.assign({}, build, { berserk: 0 }));
assert(berserkInput.value === '0', 'setBuild(berserk 0) -> input shows 0');

console.log(failures === 0 ? '\nALL BERSERK-INPUT CHECKS PASSED ✓' : `\n${failures} CHECK(S) FAILED ✗`);
process.exit(failures === 0 ? 0 : 1);
