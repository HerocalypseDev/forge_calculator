/**
 * Focused tests for the MediaWiki +/− number steppers (createStepper):
 *  - Buttons step by opts.step and clamp into [min, max]
 *  - Quality: step 5, min 0, max 100
 *  - Ore amount: step 1, min 0, NO max
 *  - Berserk / armor: step 1, min 0, max from field
 *  - Ability fields: allowZero (0 = "no ability" sits below min; minus on 0
 *    stays 0, plus on 0 jumps to min)
 *  - Every press commits via the field's commit callback
 *  - Non-numeric input falls back to 0
 *
 * Run: node Web/mediawiki/stepper-test.js
 *
 * Strategy: same as validation-warnings-test.js — evaluate the real Common.js
 * source in a Node vm with a minimal DOM mock, export createStepper, then wrap
 * a mock <input> and drive the buttons.
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
  '  globalThis.__FC = { createStepper: createStepper };\n' +
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
  el.addEventListener = function (type, fn) { (this._handlers[type] = this._handlers[type] || []).push(fn); };
  el.dispatchEvent = function (ev) {
    if (!ev.target) { ev.target = this; }
    const fns = this._handlers[ev.type] || [];
    fns.slice().forEach((fn) => fn.call(this, ev));
  };
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

// --- Harness: build a wrapped input and drive its buttons ---
function makeWrappedInput(opts) {
  const parent = makeEl('div');
  const input = makeEl('input');
  parent.appendChild(input);
  const commits = [];
  const wrapper = FC.createStepper(input, Object.assign({
    commit: function () { commits.push(Number(input.value)); }
  }, opts));
  const buttons = wrapper.children.filter((c) => c.tagName === 'button');
  const minus = buttons[0];
  const plus = buttons[1];
  function click(btn) {
    btn.dispatchEvent({ type: 'click', preventDefault: () => {} });
  }
  return { input, wrapper, minus, plus, commits, click };
}

// ---------- Structure ----------
console.log('== Structure ==');
{
  const h = makeWrappedInput({ step: 5, min: 0, max: 100 });
  assert(h.wrapper.className === 'fc-stepper', 'wrapper has class fc-stepper');
  assert(h.minus.getAttribute('aria-label') === 'Decrease', 'minus aria-label');
  assert(h.plus.getAttribute('aria-label') === 'Increase', 'plus aria-label');
  assert(h.input.parentNode === h.wrapper, 'input moved into the wrapper');
  assert(h.wrapper.children[0] === h.input && h.wrapper.children[1] === h.minus && h.wrapper.children[2] === h.plus,
    'order: input, minus, plus');
  assert(h.minus.textContent === '−' && h.plus.textContent === '+', 'button glyphs − and +');
}

// ---------- Quality (step 5, min 0, max 100) ----------
console.log('== Quality (step 5) ==');
{
  const h = makeWrappedInput({ step: 5, min: 0, max: 100 });
  h.click(h.plus);                       // 0 -> 5
  assert(h.input.value === '5' && h.commits[0] === 5, 'plus: 0 -> 5, committed');
  h.click(h.plus);                       // 5 -> 10
  assert(h.input.value === '10' && h.commits[1] === 10, 'plus: 5 -> 10');
  h.click(h.minus);                      // 10 -> 5
  assert(h.input.value === '5' && h.commits[2] === 5, 'minus: 10 -> 5');
  h.input.value = '98';
  h.click(h.plus);                       // 98 + 5 = 103 -> clamp 100
  assert(h.input.value === '100' && h.commits[3] === 100, 'plus: 98 -> clamped 100');
  h.click(h.plus);                       // 100 stays 100
  assert(h.input.value === '100' && h.commits[4] === 100, 'plus: 100 stays 100');
  h.input.value = '2';
  h.click(h.minus);                      // 2 - 5 = -3 -> clamp min 0
  assert(h.input.value === '0' && h.commits[5] === 0, 'minus: 2 -> clamped 0');
  h.click(h.minus);                      // 0 stays 0
  assert(h.input.value === '0' && h.commits[6] === 0, 'minus: 0 stays 0');
}

// ---------- Ore amount (step 1, min 0, NO max) ----------
console.log('== Ore amount (no max) ==');
{
  const h = makeWrappedInput({ step: 1, min: 0 });
  h.input.value = '30';
  h.click(h.plus);
  assert(h.input.value === '31', 'plus: 30 -> 31 (no max clamp)');
  h.input.value = '999';
  h.click(h.plus);
  assert(h.input.value === '1000', 'plus: 999 -> 1000 (no max clamp)');
  h.click(h.minus);
  assert(h.input.value === '999', 'minus: 1000 -> 999');
  h.input.value = '0';
  h.click(h.minus);
  assert(h.input.value === '0', 'minus: 0 stays 0 (min clamp)');
}

// ---------- Berserk / armor (step 1, min 0, max 150 / 100) ----------
console.log('== Berserk / armor clamp ==');
{
  const h = makeWrappedInput({ step: 1, min: 0, max: 150 });
  h.input.value = '149';
  h.click(h.plus);
  assert(h.input.value === '150' && h.commits[0] === 150, 'plus: 149 -> 150');
  h.click(h.plus);
  assert(h.input.value === '150', 'plus: 150 stays 150');
  const a = makeWrappedInput({ step: 1, min: 0, max: 100 });
  a.input.value = '100';
  a.click(a.plus);
  assert(a.input.value === '100', 'armor 100 stays 100');
}

// ---------- Ability fields (allowZero: 0 = no ability, min 1) ----------
console.log('== Ability (allowZero) ==');
{
  const h = makeWrappedInput({ step: 1, min: 1, max: 22, allowZero: true });
  // 0 is the "off" value below min: minus stays 0, plus jumps to min
  h.click(h.minus);
  assert(h.input.value === '0' && h.commits[0] === 0, 'minus on 0 stays 0 (off)');
  h.click(h.plus);
  assert(h.input.value === '1' && h.commits[1] === 1, 'plus on 0 jumps to min 1');
  h.click(h.minus);
  assert(h.input.value === '0' && h.commits[2] === 0, 'minus on 1 drops back to 0 (off)');
  h.input.value = '22';
  h.click(h.plus);
  assert(h.input.value === '22', 'plus: 22 stays 22 (max clamp)');
  h.input.value = '20';
  h.click(h.plus);
  assert(h.input.value === '21', 'plus: 20 -> 21');
  // allowZero also applies to empty/garbage (treated as 0)
  h.input.value = '';
  h.click(h.plus);
  assert(h.input.value === '1' && h.commits[h.commits.length - 1] === 1, 'plus on empty -> min 1');
}

// ---------- Non-numeric / empty input ----------
console.log('== Non-numeric ==');
{
  const h = makeWrappedInput({ step: 5, min: 0, max: 100 });
  h.input.value = 'abc';
  h.click(h.plus);
  assert(h.input.value === '5', 'plus on abc -> 5 (fallback 0 + 5)');
  h.input.value = '';
  h.click(h.plus);
  assert(h.input.value === '5', 'plus on empty -> 5');
}

// ---------- Source-level wiring checks ----------
console.log('== Source wiring ==');
assert(SRC.indexOf('createStepper(amountInput, {') !== -1, 'ore amount wrapped');
assert(SRC.indexOf('createStepper(qualityInput, {') !== -1, 'quality wrapped');
assert(SRC.indexOf('createStepper(berserkInput, {') !== -1, 'berserk wrapped');
assert(SRC.indexOf('allowZero: true') !== -1, 'ability fields use allowZero');

console.log(failures === 0 ? '\nALL STEPPER CHECKS PASSED ✓' : `\n${failures} CHECK(S) FAILED ✗`);
process.exit(failures === 0 ? 0 : 1);
