/**
 * Focused test for the MediaWiki results panel DPS Breakdown:
 *  - Renders 7 rows: Weapon / Explosion / Fire / Poison / Smite / Black Hole / Total
 *  - "Explosion DPS" maps to result.explosion_dps (the blast-ability proc, C85)
 *  - "Smite DPS" maps to result.smite_dps (Heavenite/Angel/Archangel proc, C88)
 *
 * This guards the regression where "Blast DPS" showed smite_dps and the real
 * blast (explosion) DPS was hidden even though it feeds total_dps.
 *
 * Run: node Web/mediawiki/results-panel-test.js
 *
 * Strategy: same as verify-engine.js — evaluate the real Common.js source in a
 * Node vm with a DOM mock, inject an export of createResultsPanel before the
 * DATA LOADING section, then render and assert on the live DOM.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const HERE = __dirname;
const SRC = fs.readFileSync(path.join(HERE, 'forge-calculator.common.js'), 'utf8');

// --- Inject an export hook right before the DATA LOADING section ---
const marker = 'var DATA_TITLES = {';
const idx = SRC.indexOf(marker);
if (idx < 0) { throw new Error('DATA LOADING marker not found'); }
const blockStart = SRC.lastIndexOf('\n', idx) + 1;
const instrumented = SRC.slice(0, blockStart) +
  '  globalThis.__FC = { createResultsPanel: createResultsPanel };\n' +
  SRC.slice(blockStart);

// --- DOM mock (createEl + createStatRows need createDocumentFragment) ---
function makeEl(tag) {
  const el = {
    tagName: tag,
    nodeType: tag === 'fragment' ? 11 : 1,
    children: [],
    parentNode: null,
    className: '',
    attributes: {},
    dataset: {},
    style: {},
    id: '',
    _value: '',
    _handlers: {},
    _text: null
  };

  Object.defineProperty(el, 'value', {
    get() { return this._value; },
    set(v) { this._value = (v === undefined || v === null) ? '' : String(v); },
    configurable: true
  });

  // textContent: like a real DOM — getter concatenates child text, setter
  // replaces all children with a single text node.
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

  el.classList = {
    _set: new Set(),
    add(...cs) { cs.forEach((c) => this._set.add(c)); el.className = Array.from(this._set).join(' '); },
    remove(...cs) { cs.forEach((c) => this._set.delete(c)); el.className = Array.from(this._set).join(' '); },
    contains(c) { return this._set.has(c); }
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
  el._matchesClass = function (cls) { return (this.className || '').split(/\s+/).includes(cls); };
  el.querySelector = function (sel) {
    if (!sel.startsWith('.')) { return null; }
    const cls = sel.slice(1);
    const walk = (n) => {
      if (n === el) { n.children.forEach((c) => { const r = walk(c); if (r) { out.push(r); } }); return; }
      if (n._matchesClass && n._matchesClass(cls)) { out.push(n); }
      n.children.forEach((c) => walk(c));
    };
    const out = [];
    this.children.forEach((c) => walk(c));
    return out.length ? out[0] : null;
  };
  el.querySelectorAll = function (sel) {
    if (!sel.startsWith('.')) { return []; }
    const cls = sel.slice(1);
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

let failures = 0;
function assert(cond, label) {
  if (!cond) {
    failures++;
    console.log(`  FAIL ${label}`);
  }
  return cond;
}

// --- Render the panel ---
const panel = FC.createResultsPanel({ onCopy: () => {}, onReset: () => {} });
const dpsCard = panel.querySelectorAll('.fc-card').find((c) =>
  (c.querySelector('.fc-card-title') || {}).textContent === 'DPS Breakdown');
assert(!!dpsCard, 'DPS Breakdown card found');

const labels = (dpsCard.querySelectorAll('.fc-stat-row') || []).map((row) =>
  (row.querySelector('.fc-stat-label') || {}).textContent);
const expectedLabels = ['Weapon DPS', 'Explosion DPS', 'Fire DPS', 'Poison DPS', 'Smite DPS', 'Black Hole DPS', 'Total DPS'];
assert(labels.length === 7, `7 rows rendered (got ${labels.length})`);
assert(JSON.stringify(labels) === JSON.stringify(expectedLabels),
  'row labels match: ' + expectedLabels.join(' | '));

// --- Fake result with distinguishable per-proc values ---
const fake = {
  unforged_damage: 100, avg_power: 2, forged_damage: 200, attack_rate: 1.5,
  weapon_dps: 300, lethality: 0.3, crit_chance: 0.2, crit_dmg: 0.1, atk_speed: 0.2,
  explosion_dps: 28.28, fire_dps: 11.11, poison_dps: 22.22,
  smite_dps: 33.33, blackhole_dps: 44.44, total_dps: 439.38,
  ttk_25k: 56.9, ttk_75k: 170.69, active_traits: null
};
panel.updateResults(fake);

const rows = dpsCard.querySelectorAll('.fc-stat-row');
const val = (i) => (rows[i].querySelector('.fc-stat-val') || {}).textContent;
assert(val(1) === '28.28', `Explosion DPS row shows explosion_dps (got ${val(1)})`);
assert(val(4) === '33.33', `Smite DPS row shows smite_dps (got ${val(4)})`);
assert(val(6) === '439.38', `Total DPS row shows total_dps (got ${val(6)})`);
assert(val(1) !== val(4), 'Explosion and Smite rows are distinct components');
assert(val(3) === '22.22' && val(2) === '11.11', 'Fire/Poison rows map correctly');

// Source-level guard: clipboard uses explosion_dps + smite_dps (no stale "Blast DPS")
console.log('== Clipboard (source) ==');
assert(SRC.indexOf("'Explosion DPS: ' + result.explosion_dps") !== -1, 'clipboard has Explosion DPS');
assert(SRC.indexOf("'Smite DPS: ' + result.smite_dps") !== -1, 'clipboard has Smite DPS');
assert(SRC.indexOf('Blast DPS') === -1, 'no stale "Blast DPS" label remains');

console.log(failures === 0 ? '\nALL RESULTS-PANEL CHECKS PASSED ✓' : `\n${failures} CHECK(S) FAILED ✗`);
process.exit(failures === 0 ? 0 : 1);
