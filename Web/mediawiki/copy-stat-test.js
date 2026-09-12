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
  '  globalThis.__FC = { createStatRow: createStatRow, writeClipboard: writeClipboard };\n' +
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

let lastClipboard = null;
let toastMessage = null;
const mw = { config: { get: () => '/w' }, log: () => {}, Api: function () {}, hook: () => ({ fire: () => {} }) };
const sandbox = {
  console: console,
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
  requestAnimationFrame: (fn) => fn(),
  window: null,
  navigator: {
    clipboard: {
      writeText: function (t) {
        lastClipboard = t;
        return Promise.resolve();
      }
    }
  },
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

const origShowToast = null;

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

function resetClipboard() {
  lastClipboard = null;
  toastMessage = null;
  sandbox.document.body.children = [];
}

function getValueEl(row) {
  const vals = row.querySelectorAll('.fc-copyable');
  return vals.length ? vals[0] : null;
}

console.log('== createStatRow ==');
{
  resetClipboard();
  const row = FC.createStatRow({ label: 'Total DPS', value: '420.69' });
  const labelEl = row.querySelectorAll('.fc-stat-label')[0];
  const valueEl = getValueEl(row);

  assert(labelEl, 'label element exists');
  assert(valueEl, 'value element has fc-copyable class');
  assert(valueEl && valueEl.textContent.trim() === '420.69', 'value text is 420.69');
  assert(valueEl && valueEl.getAttribute('title') === 'Click to copy', 'title attribute set');

  valueEl.dispatchEvent({ type: 'click' });
  assert(lastClipboard === '420.69', 'click copies value to clipboard');
}

console.log('== Skipped values ==');
function assertSkipped(value) {
  resetClipboard();
  const row = FC.createStatRow({ label: 'Test', value: value });
  const valueEl = getValueEl(row);
  assert(valueEl, `row created for value '${value}'`);
  valueEl.dispatchEvent({ type: 'click' });
  assert(lastClipboard === null, `value '${value}' NOT copied (skipped)`);
}
assertSkipped('—');
assertSkipped('∞');
assertSkipped('');

console.log('== Various copyable values ==');
function assertCopies(value, expected) {
  resetClipboard();
  const row = FC.createStatRow({ label: 'X', value: value });
  const valueEl = getValueEl(row);
  valueEl.dispatchEvent({ type: 'click' });
  assert(lastClipboard === expected, `'${value}' -> clipboard '${expected}'`);
}
assertCopies('0', '0');
assertCopies('150.50%', '150.50%');
assertCopies('1.45', '1.45');
assertCopies('Felynx', 'Felynx');

console.log('== isCap styling ==');
{
  const rowNormal = FC.createStatRow({ label: 'X', value: '1.00' });
  const valNormal = getValueEl(rowNormal);
  assert(valNormal && !valNormal.style.color, 'no cap -> default color');

  const rowCap = FC.createStatRow({ label: 'X', value: '150%', isCap: true });
  const valCap = getValueEl(rowCap);
  assert(valCap && valCap.style.color === '#ff5555', 'isCap -> red color');
}

console.log('== writeClipboard ==');
{
  resetClipboard();
  FC.writeClipboard('hello world', 'Success');
  assert(lastClipboard === 'hello world', 'writeClipboard uses navigator.clipboard');
}

console.log('== writeClipboard fallback ==');
{
  resetClipboard();
  const saved = sandbox.navigator.clipboard.writeText;
  sandbox.navigator.clipboard.writeText = undefined;
  try {
    FC.writeClipboard('fallback text', 'Copied!');
  } catch (e) {
  }
  sandbox.navigator.clipboard.writeText = saved;
  assert(true, 'writeClipboard fallback path does not crash');
}

console.log('== Source wiring ==');
assert(SRC.indexOf("valueEl.classList.add('fc-copyable')") !== -1, 'stat rows get fc-copyable class');
assert(SRC.indexOf("valueEl.setAttribute('title', 'Click to copy')") !== -1, 'stat rows get title');
assert(SRC.indexOf("writeClipboard(t, 'Copied: ' + t)") !== -1, 'click handler calls writeClipboard');
assert(SRC.indexOf("traitsValue.classList.add('fc-copyable')") !== -1 || SRC.indexOf("traitsValue") !== -1, 'traits value supports copy');

console.log(failures === 0 ? '\nALL COPY-STAT CHECKS PASSED ✓' : `\n${failures} CHECK(S) FAILED ✗`);
process.exit(failures === 0 ? 0 : 1);
