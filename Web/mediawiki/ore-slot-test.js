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
  '  globalThis.__FC = { createOreSlot: createOreSlot };\n' +
  SRC.slice(blockStart);

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

const calls = [];
const slot = FC.createOreSlot({
  index: 0,
  oreNames: ['Wolfarite', 'Stone', 'Fireite'],
  noneLabel: 'None',
  selectOreLabel: 'Select Ore',
  prompt: 'Select Ores',
  oreMultipliers: { Wolfarite: 2.33, Stone: 1.0 },
  value: 'Wolfarite',
  amount: 30,
  onChange: (name, amount) => calls.push([name, amount])
});

const amountInput = slot.querySelectorAll('.fc-ore-slot-amount')[0];
const dropdown = slot.getDropdown();

function selectOre(name) {
  dropdown.open(true);
  const list = dropdown.children[2];
  const item = (list.children || []).find((c) => c.dataset.value === name);
  assert(!!item, `item exists in list: ${name}`);
  list.dispatchEvent({ type: 'click', target: item });
}

console.log('== Initial state ==');
assert(slot.getValue().name === 'Wolfarite' && slot.getValue().amount === 30, 'initial ore+amount kept');
assert(amountInput.value === '30', 'amount input shows 30');

console.log('== Change ore resets amount ==');
selectOre('Stone');
assert(slot.getValue().name === 'Stone' && slot.getValue().amount === 0, 'ore=Stone, amount reset to 0');
assert(calls[calls.length - 1][0] === 'Stone' && calls[calls.length - 1][1] === 0, 'onChange fired (Stone, 0)');
assert(amountInput.value === '0', 'amount input displays 0');

console.log('== Re-select same ore preserves amount ==');
amountInput.value = '25';
amountInput.dispatchEvent({ type: 'change' });
assert(calls[calls.length - 1][1] === 25, 'amount 25 committed');
selectOre('Stone');
assert(slot.getValue().name === 'Stone' && slot.getValue().amount === 25, 're-select same ore keeps amount 25');
assert(calls[calls.length - 1][1] === 25, 'onChange fired (Stone, 25)');

console.log('== Remove ore resets amount ==');
selectOre('Select Ores');
assert(slot.getValue().name === 'None' && slot.getValue().amount === 0, 'ore removed -> None, amount 0');
assert(calls[calls.length - 1][0] === 'None' && calls[calls.length - 1][1] === 0, 'onChange fired (None, 0)');
assert(amountInput.value === '0', 'amount input displays 0');

console.log('== Programmatic setValue preserves amount ==');
slot.setValue('Fireite', 40);
assert(slot.getValue().name === 'Fireite' && slot.getValue().amount === 40, 'setValue restores ore+amount');
assert(amountInput.value === '40', 'amount input shows 40');
assert(calls[calls.length - 1][0] === 'None', 'setValue does not fire onChange');

console.log('== Source checks ==');
var RESET_BLOCK = /onChange:\s*function \(newName\)[\s\S]{0,240}?if \(parsed !== currentName\) \{[\s\S]{0,120}?currentAmount = 0;[\s\S]{0,80}?amountInput\.value = 0;/;
assert(RESET_BLOCK.test(SRC), 'createOreSlot dropdown onChange zeroes currentAmount and the amount input when the ore changes');

console.log(failures === 0 ? '\nALL ORE-SLOT CHECKS PASSED ✓' : `\n${failures} CHECK(S) FAILED ✗`);
process.exit(failures === 0 ? 0 : 1);
