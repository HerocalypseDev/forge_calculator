/**
 * Focused tests for the MediaWiki build-validation warnings:
 *  - W1: no weapon selected
 *  - W2: all ore amounts 0
 *  - W3: per-slot ore picked but amount 0
 *  - W4: per-slot ore share < 10% gate
 *  - W5: quality 0
 *  - DOM: warnings box hidden when clean, shown with one div per warning,
 *    re-renders live via refreshWarnings()
 *
 * Run: node Web/mediawiki/validation-warnings-test.js
 *
 * Strategy: same as ore-slot-test.js — evaluate the real Common.js source in a
 * Node vm with a minimal DOM mock, inject exports before the DATA LOADING
 * section, then assert directly on computeWarnings and a real rendered panel.
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
  '  globalThis.__FC = { computeWarnings: computeWarnings, createInputPanel: createInputPanel };\n' +
  SRC.slice(blockStart);

// --- DOM mock ---
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
        return (n.children || []).map(collect).join('');
      };
      return this._text !== null ? this._text : collect(this);
    },
    set(v) {
      this._text = String(v);
      this.children = [];
    }
  });

  Object.defineProperty(el, 'firstChild', {
    get() { return this.children.length ? this.children[0] : null; }
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
  el.replaceChild = function (newC, oldC) {
    const i = this.children.indexOf(oldC);
    if (i >= 0) { this.children.splice(i, 1, newC); }
    newC.parentNode = this;
    oldC.parentNode = null;
    return oldC;
  };
  el.remove = function () {
    if (this.parentNode) { this.parentNode.removeChild(this); }
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
  el.scrollIntoView = function () {};
  el._matchesClass = function (cls) { return (this.className || '').split(/\s+/).includes(cls); };
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
  requestAnimationFrame: (fn) => fn(),
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
sandbox.document.body = makeEl('body');
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

// ---------- computeWarnings: pure W1–W5 logic ----------
console.log('== computeWarnings ==');

function build(overrides) {
  return Object.assign({
    oreSlots: [
      { name: 'None', amount: 0 },
      { name: 'None', amount: 0 },
      { name: 'None', amount: 0 },
      { name: 'None', amount: 0 }
    ],
    weaponName: 'None',
    quality: 100
  }, overrides);
}

const W1 = 'No weapon selected — weapon damage and most DPS will be 0.';
const W2 = 'No ore amounts entered — Average Multiplier is 1.00x and no ore stats or traits apply.';
const W5 = 'Quality is 0% — damage is at base (1.0x), not the usual 2x from 100%.';

// W1 + W2 (default empty build, quality 100)
{
  const w = FC.computeWarnings(build());
  assert(w.length === 2, 'default build -> exactly W1 + W2');
  assert(w[0] === W1, 'W1 exact message');
  assert(w[1] === W2, 'W2 exact message');
}

// Clean build -> no warnings
{
  const w = FC.computeWarnings(build({
    weaponName: 'Dagger',
    oreSlots: [
      { name: 'Wolfarite', amount: 30 },
      { name: 'Stone', amount: 30 },
      { name: 'None', amount: 0 },
      { name: 'None', amount: 0 }
    ],
    quality: 100
  }));
  assert(w.length === 0, 'clean build -> no warnings');
}

// W1 only (weapon missing, but ores + quality present)
{
  const w = FC.computeWarnings(build({
    oreSlots: [{ name: 'Wolfarite', amount: 30 }, { name: 'None', amount: 0 }, { name: 'None', amount: 0 }, { name: 'None', amount: 0 }],
    quality: 100
  }));
  assert(w.length === 1 && w[0] === W1, 'no weapon only -> W1');
}

// W5 only (weapon + ores, quality 0)
{
  const w = FC.computeWarnings(build({
    weaponName: 'Dagger',
    oreSlots: [{ name: 'Wolfarite', amount: 30 }, { name: 'None', amount: 0 }, { name: 'None', amount: 0 }, { name: 'None', amount: 0 }],
    quality: 0
  }));
  assert(w.length === 1 && w[0] === W5, 'quality 0 only -> W5');
}

// W3: ore selected but amount 0 (takes precedence over W4)
{
  const w = FC.computeWarnings(build({
    weaponName: 'Dagger',
    oreSlots: [
      { name: 'Wolfarite', amount: 30 },
      { name: 'Stone', amount: 0 },
      { name: 'None', amount: 0 },
      { name: 'None', amount: 0 }
    ],
    quality: 100
  }));
  assert(w.length === 1, 'one W3 warning');
  assert(w[0] === 'Slot 2: Stone is selected but amount is 0.', 'W3 exact message (slot 2)');
}

// W4: ore share below the 10% gate
{
  const w = FC.computeWarnings(build({
    weaponName: 'Dagger',
    oreSlots: [
      { name: 'Wolfarite', amount: 30 },
      { name: 'Stone', amount: 1 },
      { name: 'None', amount: 0 },
      { name: 'None', amount: 0 }
    ],
    quality: 100
  }));
  assert(w.length === 1, 'one W4 warning');
  assert(w[0] === 'Slot 2: Stone is below 10% share — it contributes no stats.', 'W4 exact message (slot 2)');
}

// W1 + W2 + W5 together
{
  const w = FC.computeWarnings(build({ quality: 0 }));
  assert(w.length === 3, 'empty + quality 0 -> W1 + W2 + W5');
  assert(w[2] === W5, 'W5 last');
}

// Multi-slot W3s (all slots have a picked ore with amount 0)
{
  const w = FC.computeWarnings(build({
    weaponName: 'Dagger',
    oreSlots: [
      { name: 'Wolfarite', amount: 30 },
      { name: 'Stone', amount: 0 },
      { name: 'Fireite', amount: 0 },
      { name: 'None', amount: 0 }
    ],
    quality: 100
  }));
  assert(w.length === 2, 'two W3 warnings for slots 2 and 3');
  assert(w[1] === 'Slot 3: Fireite is selected but amount is 0.', 'W3 fires on slot 3');
}

// Exact 10% share is NOT a warning (gate is strictly below)
{
  const w = FC.computeWarnings(build({
    weaponName: 'Dagger',
    oreSlots: [
      { name: 'Wolfarite', amount: 9 },
      { name: 'Stone', amount: 81 },
      { name: 'None', amount: 0 },
      { name: 'None', amount: 0 }
    ],
    quality: 100
  }));
  assert(w.length === 0, 'exactly 10% share -> no warning');
}

// ---------- DOM: real panel, refreshWarnings ----------
console.log('== DOM panel ==');
const data = {
  constants: { noneLabel: 'None', selectOreLabel: 'Select Ore' },
  ores: [{ name: 'Wolfarite', multiplier: 2.33 }, { name: 'Stone', multiplier: 1.0 }],
  weapon_types: ['Dagger'],
  weapons: [{ name: 'Dagger', type: 'Dagger' }],
  races: [{ name: 'Human' }],
  runes: [],
  achievements: []
};

let liveBuild = build();
const panel = FC.createInputPanel({
  data: data,
  getBuild: function () { return liveBuild; },
  onBuildChange: function (b) { liveBuild = b; },
  onCalculate: function () {}
});

function warningTexts() {
  return panel.querySelectorAll('.fc-warning').map((w) => w.textContent.trim());
}
function warningsHidden() {
  const box = panel.querySelectorAll('.fc-warnings')[0];
  return box.classList.contains('fc-hidden');
}

// Default empty build -> W1 + W2 shown, box visible
panel.refreshWarnings();
{
  const texts = warningTexts();
  assert(texts.length === 2, 'default build shows 2 warnings');
  assert(texts[0] === '⚠ ' + W1, 'DOM warning 1 rendered');
  assert(texts[1] === '⚠ ' + W2, 'DOM warning 2 rendered');
  assert(!warningsHidden(), 'warnings box visible when warnings exist');
}

// Clean build -> box hidden
liveBuild = build({
  weaponName: 'Dagger',
  oreSlots: [
    { name: 'Wolfarite', amount: 30 },
    { name: 'Stone', amount: 30 },
    { name: 'None', amount: 0 },
    { name: 'None', amount: 0 }
  ],
  quality: 100
});
panel.refreshWarnings();
{
  assert(warningTexts().length === 0, 'clean build -> no warning divs');
  assert(warningsHidden(), 'warnings box hidden when clean');
}

// Live update: change build -> warnings re-render in place
liveBuild = build({
  oreSlots: [
    { name: 'Wolfarite', amount: 30 },
    { name: 'Stone', amount: 0 },
    { name: 'None', amount: 0 },
    { name: 'None', amount: 0 }
  ],
  quality: 100
});
panel.refreshWarnings();
{
  const texts = warningTexts();
  assert(warningsHidden() === false, 'warnings visible after re-render');
  assert(texts.length === 2, 're-rendered with 2 warnings');
  assert(texts[0] === '⚠ ' + W1, 'W1 re-rendered');
  assert(texts[1] === '⚠ ' + 'Slot 2: Stone is selected but amount is 0.', 'W3 re-rendered');
}

// Quality 0 warning appears live
liveBuild = build({ weaponName: 'Dagger', quality: 0 });
panel.refreshWarnings();
{
  assert(warningTexts().length === 2, 'weapon + quality 0 -> W2 + W5');
  assert(warningTexts()[1] === '⚠ ' + W5, 'W5 rendered');
}

// ---------- Source-level wiring checks ----------
console.log('== Source wiring ==');
assert(SRC.indexOf('state.inputPanel.refreshWarnings()') !== -1, 'handleBuildChange calls refreshWarnings (live update)');
assert(SRC.indexOf('fc-warnings fc-hidden') !== -1, 'warnings box starts hidden');

console.log(failures === 0 ? '\nALL VALIDATION-WARNINGS CHECKS PASSED ✓' : `\n${failures} CHECK(S) FAILED ✗`);
process.exit(failures === 0 ? 0 : 1);
