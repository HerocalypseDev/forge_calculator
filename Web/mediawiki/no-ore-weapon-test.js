/**
 * Focused test: with a weapon selected and NO ores, DPS must be computed from
 * the weapon's own base damage (avg ore power = 1.0), not zeroed out.
 *
 *  - Dagger (damage 4.3, interval 0.47), quality 100, all 4 ore slots empty
 *  - base damage = 4.3 * 1.0 * (1 + 100/100) = 8.6
 *  - weapon DPS = 8.6 * 1.0 (lethality) * 1.45 (crit blend) * (1/0.47) = 18.30
 *
 * Strategy: render the REAL input panel + results panel in a Node DOM mock,
 * drive the weapon dropdown to select Dagger (ores stay empty), then run the
 * same path as the Calculate DPS button: calculate(transformBuildForEngine(build)).
 *
 * Run: node Web/mediawiki/no-ore-weapon-test.js
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
  '    createInputPanel: createInputPanel,\n' +
  '    createResultsPanel: createResultsPanel\n' +
  '  };\n' +
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
function approx(a, b, label, eps) {
  const ok = Math.abs(a - b) <= (eps !== undefined ? eps : 1e-6);
  if (!ok) {
    failures++;
    console.log(`  FAIL ${label}: expected ${b}, got ${a}`);
  }
  return ok;
}

// --- Render the real input panel + results panel ---
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
  runes: ['None', 'None', 'None', 'None', 'None', 'None'],
  achievement: 'None'
};

let recalc = null;
const inputPanel = FC.createInputPanel({
  data: game,
  getBuild: () => build,
  onBuildChange: (nb) => { build = nb; },
  onCalculate: null // wired below
});
const resultsPanel = FC.createResultsPanel({ onCopy: () => {}, onReset: () => {} });

// Replicate the real init wiring: onCalculate -> recalculate
recalc = function () {
  const result = FC.calculate(FC.transformBuildForEngine(build), game);
  resultsPanel.updateResults(result);
  return result;
};

console.log('== Initial state (no weapon, no ores) ==');
{
  const r = recalc();
  assert(r.weapon_name === 'None' || build.weaponName === 'None', 'no weapon in build');
}

console.log('== Select Dagger via the real weapon dropdown ==');
{
  // Find the weapon input by id within the rendered input panel tree
  let weaponInput = null;
  const findId = (n) => {
    if (weaponInput) { return; }
    if (n.id === 'weapon-name-input') { weaponInput = n; return; }
    (n.children || []).forEach(findId);
  };
  findId(inputPanel);
  assert(!!weaponInput, 'weapon dropdown input exists (id weapon-name-input)');
  weaponInput.dispatchEvent({ type: 'focus' });

  const items = weaponInput.parentNode.querySelectorAll('.fc-searchable-item');
  assert(items.length > 0, 'weapon list rendered after focus (got ' + items.length + ' items)');

  // Click the item whose data-value is "Dagger". The click handler lives on the
  // list container (real browser bubbling); the mock has no bubbling, so
  // dispatch on the container with the item as event target.
  let clicked = null;
  for (const it of items) {
    if (it.dataset.value === 'Dagger') {
      it.parentNode.dispatchEvent({ type: 'click', target: it });
      clicked = it;
      break;
    }
  }
  assert(!!clicked, 'found and clicked Dagger item');
  assert(build.weaponName === 'Dagger', 'build.weaponName = Dagger (got ' + build.weaponName + ')');
  assert(build.quality === 100, 'quality stays 100');
  assert(build.oreSlots.every((s) => s.name === 'None' && s.amount === 0), 'all 4 ore slots still empty');
}

console.log('== Calculate with weapon + empty ores ==');
{
  const r = recalc();

  // Dagger: damage 4.3, interval 0.47, quality 100 -> base = 4.3*1*(1+1) = 8.6
  approx(r.avg_power, 1.0, 'avg ore power = 1.0 with no ores');
  approx(r.unforged_damage, 8.6, 'base damage from weapon: 4.3 * 2.0');
  approx(r.forged_damage, 8.6, 'forged == unforged at forge level 0');
  approx(r.attack_rate, 1 / 0.47, 'attack rate from Dagger interval');
  // No crit chance, so the crit blend is 1.0: weapon DPS = base * 1 * (1/0.47)
  approx(r.weapon_dps, 8.6 / 0.47, 'weapon DPS = base * crit blend(1.0) * attack rate');
  approx(r.total_dps, 8.6 / 0.47, 'total == weapon DPS (no procs)');
  assert(r.ttk_25k !== null && r.ttk_25k > 0, 'finite, positive TTK (not infinity)');

  // Results panel display
  const dpsRows = resultsPanel.querySelectorAll('.fc-stat-row');
  // dpsCard is the 3rd card: 7 rows starting at a known offset; find "Total DPS"
  let totalRow = null;
  let baseRow = null;
  const walk = (n) => {
    (n.children || []).forEach((c) => {
      const text = c.textContent || '';
      if (c._matchesClass && c._matchesClass('fc-stat-row')) {
        if (text.indexOf('Total DPS') !== -1) { totalRow = c; }
        if (text.indexOf('Base Damage') !== -1 && text.indexOf('Base Damage:') === -1) { baseRow = c; }
      }
      walk(c);
    });
  };
  walk(resultsPanel);
  assert(!!totalRow, 'results panel shows a Total DPS row');
  if (totalRow) {
    const val = (totalRow.textContent || '').replace('Total DPS', '').trim();
    approx(parseFloat(val), r.total_dps, 'Total DPS row displays ' + r.total_dps.toFixed(2) + ' (got ' + val + ')', 0.01);
  }
  if (baseRow) {
    const val = (baseRow.textContent || '').replace('Base Damage', '').trim();
    approx(parseFloat(val), 8.6, 'Base Damage row displays 8.6 (got ' + val + ')', 0.01);
  }
}

console.log('== Sanity: same weapon with an ore still differs ==');
{
  build = Object.assign({}, build, {
    oreSlots: [
      { name: 'Wolfarite', amount: 30 },
      { name: 'None', amount: 0 },
      { name: 'None', amount: 0 },
      { name: 'None', amount: 0 }
    ]
  });
  const r = recalc();
  assert(r.avg_power !== 1.0, 'with an ore, avg power is no longer 1.0');
}

console.log(failures === 0 ? '\nALL NO-ORE-WEAPON CHECKS PASSED ✓' : `\n${failures} CHECK(S) FAILED ✗`);
process.exit(failures === 0 ? 0 : 1);
