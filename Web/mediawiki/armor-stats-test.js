/**
 * Focused test for whole-percent armor stats entry:
 *  - Armor Stats inputs use step=1 (whole percents), not decimals (step 0.01)
 *  - max attribute = stat cap (lethality 150, crit chance/dmg 100)
 *  - Commit clamps into [0, max]; non-numeric/empty -> 0
 *  - transformBuildForEngine divides the 3 armor pct fields by 100
 *  - Armor Stats section has a whole-percent subtext
 *
 * Run: node Web/mediawiki/armor-stats-test.js
 *
 * Strategy: same as the other component tests — evaluate the real Common.js
 * source in a Node vm with a DOM mock, inject an export of createStatInput +
 * transformBuildForEngine before the DATA LOADING section, then drive the
 * rendered inputs.
 */
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
  '  globalThis.__FC = { createStatInput: createStatInput, transformBuildForEngine: transformBuildForEngine };\n' +
  SRC.slice(blockStart);

// --- DOM mock (createEl + events + querySelectorAll) ---
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

// --- Render the stat input group ---
const calls = [];
const stat = FC.createStatInput({
  values: { armorLethality: 0, armorCritChance: 0, armorCritDmg: 0 },
  onChange: (v) => calls.push(v)
});

const inputs = stat.querySelectorAll('.fc-stat-input-input');
assert(inputs.length === 3, '3 armor stat inputs rendered (got ' + inputs.length + ')');

const byId = {};
for (const el of inputs) { byId[el.id] = el; }
assert(byId.armorLethality && byId.armorCritChance && byId.armorCritDmg, 'inputs have expected ids');

// --- 1. Whole-percent attributes ---
console.log('== Input attributes ==');
assert(byId.armorLethality.getAttribute('step') === '1', 'lethality step=1 (whole percent)');
assert(byId.armorCritChance.getAttribute('step') === '1', 'crit chance step=1');
assert(byId.armorCritDmg.getAttribute('step') === '1', 'crit dmg step=1');
assert(byId.armorLethality.getAttribute('max') === '150', 'lethality max=150 (cap)');
assert(byId.armorCritChance.getAttribute('max') === '100', 'crit chance max=100 (cap)');
assert(byId.armorCritDmg.getAttribute('max') === '100', 'crit dmg max=100 (cap)');
assert(byId.armorCritChance.getAttribute('min') === '0', 'crit chance min=0');

// --- 2. Commit clamping ---
console.log('== Commit clamping ==');
function commit(el, value) {
  el.value = value;
  el.dispatchEvent({ type: 'change' });
}

commit(byId.armorLethality, '200');
assert(stat.getValues().armorLethality === 150, 'lethality 200 -> clamped to 150');
commit(byId.armorCritChance, '-5');
assert(stat.getValues().armorCritChance === 0, 'crit chance -5 -> clamped to 0');
commit(byId.armorCritDmg, '30');
assert(stat.getValues().armorCritDmg === 30, 'crit dmg 30 stays 30');
assert(byId.armorCritDmg.value === '30', 'input displays the percent');
commit(byId.armorCritChance, 'abc');
assert(stat.getValues().armorCritChance === 0, 'non-numeric -> 0');
assert(byId.armorCritChance.value === '0', 'input snaps to 0');
assert(calls[calls.length - 1].armorCritChance === 0, 'onChange emitted with clamped value');

// --- 3. transformBuildForEngine divides by 100 ---
console.log('== transformBuildForEngine ==');
function uiBuild(overrides) {
  return Object.assign({
    oreSlots: [], weaponName: 'None', quality: 100, enhancement: 0, race: 'None',
    armorLethality: 0, armorCritChance: 0, armorCritDmg: 0,
    fireDmg: 0, fireChance: 0, fireTime: 0,
    poisonDmg: 0, poisonChance: 0, poisonTime: 0,
    blastDmg: 0, blastChance: 0,
    runes: [], achievement: 'None'
  }, overrides);
}
{
  const eng = FC.transformBuildForEngine(uiBuild({ armorLethality: 15, armorCritChance: 100, armorCritDmg: 50 }));
  assert(eng.armor_lethality === 0.15, 'lethality 15% -> 0.15');
  assert(eng.armor_crit_chance === 1.0, 'crit chance 100% -> 1.0');
  assert(eng.armor_crit_dmg === 0.5, 'crit dmg 50% -> 0.5');
}

// --- 4. Source-level guards ---
console.log('== Source checks ==');
assert(SRC.indexOf('/ 100') !== -1 && SRC.indexOf('armorCritChance') !== -1, 'transform divides armor percents by 100');
assert(SRC.indexOf('fc-input-section-subtext') !== -1, 'Armor Stats whole-percent subtext present');
assert(SRC.indexOf('step: 1') !== -1, 'createStatInput uses whole-percent step');
assert(!SRC.includes('inputmode: \'decimal\'') || SRC.indexOf('inputmode: \'numeric\'') !== -1,
  'armor inputs use numeric inputmode');

console.log(failures === 0 ? '\nALL ARMOR-STATS CHECKS PASSED ✓' : `\n${failures} CHECK(S) FAILED ✗`);
process.exit(failures === 0 ? 0 : 1);
