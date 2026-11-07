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
  '  globalThis.__FC = { createResultsPanel: createResultsPanel };\n' +
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

const panel = FC.createResultsPanel({ onCopy: () => {}, onReset: () => {} });
const dpsCard = panel.querySelectorAll('.fc-card').find((c) =>
  (c.querySelector('.fc-card-title') || {}).textContent === 'DPS Breakdown');
assert(!!dpsCard, 'DPS Breakdown card found');

const labels = (dpsCard.querySelectorAll('.fc-stat-row') || []).map((row) =>
  (row.querySelector('.fc-stat-label') || {}).textContent);
const expectedLabels = ['Weapon DPS', 'Explosion DPS', 'Fire DPS', 'Poison DPS', 'Smite DPS', 'Black Hole DPS', 'Lightning DPS', 'Smash DPS', 'Fox Claws DPS', 'Foxfire DPS', 'Archangel Smite DPS', 'Cursed Aura DPS', 'Golemite DPS', 'Dark Smite DPS', 'Trident Toss DPS', 'Reverberation DPS', 'Frost Slash DPS', 'Glacier Explosion DPS', 'Starfall DPS', 'Stellar Mark DPS', 'Ancient Poison DPS', 'Total DPS', 'Total Berserk DPS', 'Total Moonstone DPS'];
assert(labels.length === 24, `24 rows rendered (got ${labels.length})`);
assert(JSON.stringify(labels) === JSON.stringify(expectedLabels),
  'row labels match: ' + expectedLabels.join(' | '));

const fake = {
  unforged_damage: 100, avg_power: 2, forged_damage: 200, attack_rate: 1.5,
  weapon_dps: 300, lethality: 0.3, crit_chance: 0.2, crit_dmg: 0.1, atk_speed: 0.2,
  explosion_dps: 28.28, fire_dps: 11.11, poison_dps: 22.22,
  smite_dps: 33.33, blackhole_dps: 44.44, lightning_dps: 55.55,
  smash_dps: 66.66, fox_claws_dps: 77.77, foxfire_dps: 88.88,
  archangel_smite_dps: 23.45, cursed_aura_dps: 34.56, golemite_dps: 45.67, dark_smite_dps: 1.01, trident_toss_dps: 2.02, reverberation_dps: 3.03,
  frost_slash_dps: 4.04, glacier_explosion_dps: 5.05, starfall_dps: 6.06, stellar_mark_dps: 7.07, ancient_poison_dps: 8.08,
  total_dps: 728.24,
  berserk: 512.5, moonstone: 600,
  ttk_25k: 56.9, ttk_75k: 170.69, active_traits: null
};
panel.updateResults(fake);

const rows = dpsCard.querySelectorAll('.fc-stat-row');
const val = (i) => (rows[i].querySelector('.fc-stat-val') || {}).textContent;
assert(val(1) === '28.28', `Explosion DPS row shows explosion_dps (got ${val(1)})`);
assert(val(4) === '33.33', `Smite DPS row shows smite_dps (got ${val(4)})`);
assert(val(6) === '55.55', `Lightning DPS row shows lightning_dps (got ${val(6)})`);
assert(val(7) === '66.66', `Smash DPS row shows smash_dps (got ${val(7)})`);
assert(val(8) === '77.77', `Fox Claws DPS row shows fox_claws_dps (got ${val(8)})`);
assert(val(9) === '88.88', `Foxfire DPS row shows foxfire_dps (got ${val(9)})`);
assert(val(10) === '23.45', `Archangel Smite DPS row (got ${val(10)})`);
assert(val(11) === '34.56', `Cursed Aura DPS row (got ${val(11)})`);
assert(val(12) === '45.67', `Golemite DPS row shows golemite_dps (got ${val(12)})`);
['1.01', '2.02', '3.03', '4.04', '5.05', '6.06', '7.07', '8.08'].forEach((want, i) =>
  assert(val(13 + i) === want, `new proc row ${13 + i} shows its DPS (got ${val(13 + i)})`));
assert(val(21) === '728.24', `Total DPS row shows total_dps (got ${val(21)})`);
assert(val(22) === '512.50', `Total Berserk DPS row shows berserk (got ${val(22)})`);
assert(val(23) === '600.00', `Total Moonstone DPS row shows moonstone (got ${val(23)})`);
assert(val(1) !== val(4), 'Explosion and Smite rows are distinct components');
assert(val(3) === '22.22' && val(2) === '11.11', 'Fire/Poison rows map correctly');

panel.updateResults({ ...fake, berserk: null, moonstone: null });
assert(val(22) === '—', `null berserk renders as "—" (got ${val(22)})`);
assert(val(23) === '—', `null moonstone renders as "—" (got ${val(23)})`);
panel.updateResults(fake);

console.log('== Active Traits block ==');
const longTraits = 'Cinder Blade — Fire Damage | Shadow Essence — Lethality + Critical Damage | ' +
  'A very long trait description that should wrap onto multiple lines instead of being clipped';
fake.active_traits = longTraits;
panel.updateResults(fake);

const traitsCard = panel.querySelectorAll('.fc-card').find((c) =>
  (c.querySelector('.fc-card-title') || {}).textContent === 'Active Traits');
assert(!!traitsCard, 'Active Traits card found');
const traitsLabel = traitsCard.querySelector('.fc-traits-label');
const traitsValue = traitsCard.querySelector('.fc-traits-value');
assert(traitsLabel && traitsLabel.textContent === 'Active Traits', 'traits label rendered');
assert(!!traitsValue, 'traits value element rendered');
assert(traitsValue.textContent === longTraits, 'full trait text preserved (no truncation)');
assert(!traitsCard.querySelector('.fc-stat-row'), 'traits use the wrapping block, not a stat row');

console.log('== Hero card + card classes ==');
const totalCard = panel.querySelectorAll('.fc-card').find((c) =>
  (c.querySelector('.fc-card-title') || {}).textContent === 'Total DPS');
assert(!!totalCard, 'Total DPS hero card found');
assert(totalCard.classList.contains('fc-card--total'), 'hero card has fc-card--total modifier');

const byTitle = (t) => panel.querySelectorAll('.fc-card').find((c) =>
  (c.querySelector('.fc-card-title') || {}).textContent === t);
const cardClasses = [
  ['Core DPS', 'fc-card--core'],
  ['Stats (Capped)', 'fc-card--stats'],
  ['DPS Breakdown', 'fc-card--dps'],
  ['Time to Kill', 'fc-card--ttk'],
  ['Active Traits', 'fc-card--traits']
];
cardClasses.forEach(([title, cls]) =>
  assert((byTitle(title) || {}).classList && byTitle(title).classList.contains(cls),
    `${title} card has ${cls} modifier`));

const heroRows = totalCard.querySelectorAll('.fc-stat-row');
const heroVal = totalCard.querySelector('.fc-stat-val');
assert(heroRows.length === 1, `hero card has exactly one row (got ${heroRows.length})`);
assert(heroVal && heroVal.textContent === '728.24', `hero card shows total_dps (got ${heroVal && heroVal.textContent})`);

const cardsContainer = panel.querySelector('.fc-results-cards');
const order = (cardsContainer.children || []).map((c) =>
  (c.querySelector('.fc-card-title') || {}).textContent);
assert(JSON.stringify(order) === JSON.stringify(
  ['Total DPS', 'DPS Breakdown', 'Stats (Capped)', 'Active Traits', 'Core DPS', 'Time to Kill']),
  'cards appended in reference order: ' + order.join(' | '));

console.log('== Clipboard (source) ==');
assert(SRC.indexOf("'Explosion DPS: ' + result.explosion_dps") !== -1, 'clipboard has Explosion DPS');
assert(SRC.indexOf("'Smite DPS: ' + result.smite_dps") !== -1, 'clipboard has Smite DPS');
assert(SRC.indexOf("'Smash DPS: ' + result.smash_dps") !== -1, 'clipboard has Smash DPS');
assert(SRC.indexOf("'Fox Claws DPS: ' + result.fox_claws_dps") !== -1, 'clipboard has Fox Claws DPS');
assert(SRC.indexOf("'Foxfire DPS: ' + result.foxfire_dps") !== -1, 'clipboard has Foxfire DPS');
assert(SRC.indexOf('Blast DPS') === -1, 'no stale "Blast DPS" label remains');

console.log(failures === 0 ? '\nALL RESULTS-PANEL CHECKS PASSED ✓' : `\n${failures} CHECK(S) FAILED ✗`);
process.exit(failures === 0 ? 0 : 1);
