/**
 * Dev-only preview generator (NOT deployed to the wiki).
 *
 * Runs the real MediaWiki-ForgeCalculator.js in a Node vm with a DOM mock,
 * renders the input + results panels with a realistic sample build, and
 * serializes the DOM tree to a static preview.html that links the real
 * Template-ForgeCalculator-styles.css. Open preview.html in a browser to
 * eyeball the dark theme without deploying.
 *
 * Run: node Web/mediawiki/render-preview.js
 * Then:  open Web/mediawiki/preview.html
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
  '  var __fc = { createInputPanel: createInputPanel, createResultsPanel: createResultsPanel,\n' +
  '    buildGameData: buildGameData, calculate: calculate, transformBuildForEngine: transformBuildForEngine,\n' +
  '    recalculate: recalculate };\n' +
  '  Object.defineProperty(__fc, "state", { get: function () { return state; } });\n' +
  '  Object.defineProperty(__fc, "DEFAULT_BUILD", { get: function () { return DEFAULT_BUILD; } });\n' +
  '  globalThis.__FC = __fc;\n' +
  SRC.slice(blockStart);

// --- DOM mock with serialization ---
const VOID_TAGS = new Set(['input', 'img', 'br', 'hr', 'link', 'meta', 'source']);

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

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
    _raw: null,
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

  Object.defineProperty(el, 'innerHTML', {
    get() { return this._raw !== null ? this._raw : this.children.map(serialize).join(''); },
    set(v) { this._raw = String(v); this.children = []; },
    configurable: true
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
  el.remove = function () { if (this.parentNode) { this.parentNode.removeChild(this); } };
  el.addEventListener = function (type, fn) { (this._handlers[type] = this._handlers[type] || []).push(fn); };
  el.dispatchEvent = function (ev) {
    if (!ev.target) { ev.target = this; }
    const fns = this._handlers[ev.type] || [];
    fns.slice().forEach((fn) => fn.call(this, ev));
  };
  el.focus = function () {};
  el.select = function () {};
  el.blur = function () {};
  el._matchesClass = function (cls) { return (this.className || '').split(/\s+/).includes(cls); };
  el.querySelector = function (sel) {
    if (!sel.startsWith('.')) { return null; }
    const cls = sel.slice(1);
    const out = [];
    const walk = (n) => {
      if (n !== el && n._matchesClass && n._matchesClass(cls)) { out.push(n); }
      (n.children || []).forEach(walk);
    };
    this.children.forEach(walk);
    return out.length ? out[0] : null;
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

function serialize(node) {
  if (!node) { return ''; }
  if (node.nodeType === 3) { return esc(node._text); }
  if (node._raw !== null) { return node._raw; }

  const tag = node.tagName;
  const parts = [tag];
  if (node.id) { parts.push(`id="${esc(node.id)}"`); }
  if (node._classes && node._classes.size) { parts.push(`class="${esc(Array.from(node._classes).join(' '))}"`); }
  for (const k of Object.keys(node.attributes)) {
    if (k === 'id') { continue; }
    parts.push(`${k}="${esc(node.attributes[k])}"`); // includes value=, min, max, step, placeholder, title, inputmode
  }
  // style (set directly via el.style.x = ...)
  const styleKeys = Object.keys(node.style).filter((k) => node.style[k] !== undefined && node.style[k] !== '');
  if (styleKeys.length) {
    parts.push(`style="${styleKeys.map((k) => `${k}: ${node.style[k]}`).join('; ')}"`);
  }

  const open = `<${parts.join(' ')}>`;
  if (VOID_TAGS.has(tag)) { return open; }
  const inner = (node.children || []).map(serialize).join('');
  return `${open}${inner}</${tag}>`;
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
  navigator: {
    clipboard: { writeText: () => Promise.resolve() }
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

vm.createContext(sandbox);
vm.runInContext(instrumented, sandbox, { filename: 'MediaWiki-ForgeCalculator.js' });

const FC = sandbox.__FC;
if (!FC) { throw new Error('Export hook did not run'); }

// --- Load data + build gameData via the ACTUAL buildGameData ---
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

// --- Replicate init(): wire state, render panels ---
const state = FC.state;
state.gameData = game;

const root = makeEl('div');
root.className = 'fc-calculator';

const body = makeEl('div');
body.className = 'fc-body';
root.appendChild(body);

const left = makeEl('div');
left.className = 'fc-left';
body.appendChild(left);

const right = makeEl('div');
right.className = 'fc-right';
body.appendChild(right);

state.inputPanel = FC.createInputPanel({
  data: game,
  getBuild: () => state.build,
  onBuildChange: (b) => { state.build = b; },
  onCalculate: FC.recalculate
});
left.appendChild(state.inputPanel);

state.resultsPanel = FC.createResultsPanel({ onCopy: () => {}, onReset: () => {} });
right.appendChild(state.resultsPanel);

// --- Sample build (UI shape, whole percents for armor/ability/berserk) ---
state.build = Object.assign({}, FC.DEFAULT_BUILD, {
  oreSlots: [
    { name: 'Wolfarite', amount: 30 },
    { name: 'Gargantuan', amount: 30 },
    { name: 'Galaxite', amount: 20 },
    { name: 'Malachite', amount: 20 }
  ],
  weaponType: 'Gauntlet',
  weaponName: 'Ironhand',
  quality: 100,
  enhancement: 5,
  race: 'Felynx',
  armorLethality: 20,
  armorCritChance: 15,
  armorCritDmg: 50,
  fireDmg: 15, fireChance: 30, fireTime: 2,
  poisonDmg: 5, poisonChance: 25, poisonTime: 3,
  blastDmg: 25, blastChance: 10,
  berserk: 30,
  runes: ['Crit Chance +15%', 'Crit DMG +15%', 'Crit Chance +15%', 'Crit DMG +15%', 'Crit Chance +15%', 'Crit DMG +15%'],
  achievement: 'Damage Boost +20%'
});

FC.recalculate();
if (state.inputPanel && state.inputPanel.refreshWarnings) { state.inputPanel.refreshWarnings(); }

// --- Emit preview.html ---
const css = fs.readFileSync(path.join(HERE, 'Template-ForgeCalculator-styles.css'), 'utf8');
const html =
  '<!DOCTYPE html>\n' +
  '<html lang="en">\n<head>\n' +
  '<meta charset="utf-8">\n' +
  '<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
  '<title>Forge Calculator — Dark Theme Preview</title>\n' +
  '<style>\n' + css + '\n</style>\n' +
  '</head>\n<body style="background:#0a0a0c; padding:24px;">\n' +
  serialize(root) +
  '\n</body>\n</html>\n';

const out = path.join(HERE, 'preview.html');
fs.writeFileSync(out, html, 'utf8');
console.log('Wrote ' + out + ' (' + (html.length / 1024).toFixed(1) + ' KB)');
console.log('Open it in a browser to preview the dark theme.');
