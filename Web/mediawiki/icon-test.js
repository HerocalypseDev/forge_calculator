/**
 * Focused test for the MediaWiki section icons.
 *
 * Guards the regression where icons were hand-built as raw <img src> tags.
 * On this wiki images are referenced as [[File:...]] wikitext (the same
 * convention the templates use), so the JS must:
 *  - NOT construct <img src=".../Special:Redirect/file/..."> directly
 *  - collect .fc-section-icon placeholders while the input panel renders
 *  - resolve them in one batched mw.Api().parse() call whose wikitext is
 *    [[File:<file>|frameless|link=File:<file>|alt=<title>]]
 *  - inject the parsed <a><img></a> markup (Special:FilePath src + alt) into
 *    each placeholder once the parse resolves
 *
 * Run: node Web/mediawiki/icon-test.js
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
  '  globalThis.__FC = { createInputPanel: createInputPanel, buildGameData: buildGameData };\n' +
  SRC.slice(blockStart);

// --- DOM mock (same shape render-preview.js uses; add innerHTML) ---
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

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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
    parts.push(`${k}="${esc(node.attributes[k])}"`);
  }
  const open = `<${parts.join(' ')}>`;
  const inner = (node.children || []).map(serialize).join('');
  return `${open}${inner}</${tag}>`;
}

// --- Api mock: records the wikitext, returns the parser's canonical HTML ---
let parsedWikitext = null;
function ApiMock() {}
ApiMock.prototype.parse = function (wikitext) {
  parsedWikitext = wikitext;
  const lines = String(wikitext).split('\n\n').filter(Boolean);
  const paras = lines.map((line) => {
    const fileM = line.match(/File:([^|\]]+)/);
    const altM = line.match(/alt=([^|\]]+)/);
    const file = fileM ? fileM[1] : '';
    const alt = altM ? altM[1] : '';
    return `<p><a href="/w/File:${file}" title="File:${file}"><img alt="${alt}" src="/w/Special:FilePath/${file}" decoding="async" width="20" height="20"></a></p>`;
  });
  return Promise.resolve(paras.join('\n'));
};

const mw = {
  config: { get: () => '/w' },
  loader: { using: () => Promise.resolve() },
  log: () => {},
  Api: ApiMock,
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

// Expected icon -> alt per section (in render order: Ore, Weapon, Race,
// Berserk, Armor Stats, Abilities, Runes, Achievement, then Fire/Poison/Blast).
const EXPECTED = [
  ['ForgeCalculator-ore.png', 'Ore Slots'],
  ['ForgeCalculator-weapon.png', 'Weapon'],
  ['ForgeCalculator-race.png', 'Race'],
  ['ForgeCalculator-berserk.png', 'Berserk'],
  ['ForgeCalculator-armor.png', 'Armor Stats'],
  ['ForgeCalculator-ability.png', 'Abilities (From Runes)'],
  ['ForgeCalculator-rune.png', 'Runes'],
  ['ForgeCalculator-achievement.png', 'Achievement'],
  ['ForgeCalculator-fire.png', 'Fire'],
  ['ForgeCalculator-poison.png', 'Poison'],
  ['ForgeCalculator-blast.png', 'Blast']
];

(async function () {
  // --- Source-level: no raw <img>/Special:Redirect builder may survive ---
  console.log('== source guard ==');
  assert(SRC.indexOf('Special:Redirect') === -1, 'source contains no Special:Redirect');
  assert(SRC.indexOf('SECTION_ICON_URLS') === -1, 'source contains no SECTION_ICON_URLS');
  assert(SRC.indexOf("createEl('img'") === -1, 'source builds no <img> via createEl');

  // --- Render the input panel ---
  const build = { oreSlots: [{ name: 'None', amount: 0 }, { name: 'None', amount: 0 }, { name: 'None', amount: 0 }, { name: 'None', amount: 0 }] };
  const panel = FC.createInputPanel({
    data: game,
    getBuild: () => build,
    onBuildChange: (b) => Object.assign(build, b),
    onCalculate: () => {}
  });

  console.log('== placeholders ==');
  const icons = panel.querySelectorAll('.fc-section-icon');
  assert(icons.length === 11, `11 section-icon placeholders (got ${icons.length})`);
  for (let i = 0; i < icons.length; i++) {
    assert(icons[i].children.length === 0, `placeholder #${i} is empty before parse (no raw <img>)`);
  }

  // Let the mw.loader.using(...).then(...) chain run: loadSectionIcons sends the
  // batched parse, then fills each placeholder. A macrotask flush covers both.
  await new Promise((r) => setTimeout(r, 0));

  console.log('== wikitext convention ==');
  assert(typeof parsedWikitext === 'string' && parsedWikitext.length > 0, 'loadSectionIcons sent a batched api.parse() call');
  const lines = parsedWikitext.split('\n\n').filter(Boolean);
  assert(lines.length === 11, `parse batch has 11 [[File:...]] lines (got ${lines.length})`);
  assert(parsedWikitext.indexOf('<img') === -1, 'parse input is wikitext, not HTML');
  assert(parsedWikitext.indexOf('Special:Redirect') === -1, 'parse input uses no Special:Redirect');
  assert(parsedWikitext.indexOf('[[File:ForgeCalculator-weapon.png|frameless|link=File:ForgeCalculator-weapon.png|alt=Weapon]]') !== -1,
    'weapon icon uses [[File:...|frameless|link=File:...|alt=Weapon]]');
  const allConventional = EXPECTED.every(([file, alt]) =>
    parsedWikitext.indexOf(`[[File:${file}|frameless|link=File:${file}|alt=${alt}]]`) !== -1);
  assert(allConventional, 'every icon follows [[File:<f>|frameless|link=File:<f>|alt=<t>]]');

  // --- The parse has resolved — check every placeholder is filled ---
  // (order-independent: panel DOM order differs from placeholder-creation order)
  console.log('== parsed injection ==');
  const filled = icons.map((el) => el.innerHTML);
  assert(filled.every((h) => h !== ''), 'all 11 placeholders were filled by the parse');
  for (let i = 0; i < EXPECTED.length; i++) {
    const [file, alt] = EXPECTED[i];
    const hits = filled.filter((h) =>
      h.indexOf(`src="/w/Special:FilePath/${file}"`) !== -1 && h.indexOf(`alt="${alt}"`) !== -1);
    assert(hits.length === 1, `exactly one icon resolves [[File:${file}]] -> Special:FilePath + alt="${alt}"`);
    const html = hits[0] || '';
    assert(html.indexOf('<a ') !== -1 && html.indexOf('</a>') !== -1, `${file} wrapped in an <a> link to the file page`);
    assert(html.indexOf(`href="/w/File:${file}"`) !== -1, `${file} links to File:${file}`);
  }

  console.log(failures === 0 ? '\nALL ICON CHECKS PASSED' : `\n${failures} FAILURES`);
  process.exitCode = failures === 0 ? 0 : 1;
})();
