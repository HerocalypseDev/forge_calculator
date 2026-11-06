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
  '  globalThis.__FC = {\n' +
  '    calculate: calculate,\n' +
  '    buildGameData: buildGameData,\n' +
  '    transformBuildForEngine: transformBuildForEngine,\n' +
  '    createInputPanel: createInputPanel\n' +
  '  };\n' +
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
vm.runInContext(instrumented, sandbox, { filename: 'MediaWiki-ForgeCalculator.js' });

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
function approx(actual, expected, label, eps) {
  const ok = Math.abs(actual - expected) <= (eps !== undefined ? eps : 1e-6);
  if (!ok) {
    failures++;
    console.log(`  FAIL ${label}: expected ${expected}, got ${actual}`);
  }
  return ok;
}

let build = {
  oreSlots: [
    { name: 'Wolfarite', amount: 30 },
    { name: 'None', amount: 0 },
    { name: 'None', amount: 0 },
    { name: 'None', amount: 0 }
  ],
  weaponType: 'Dagger',
  weaponName: 'Dagger',
  quality: 100,
  enhancement: 0,
  race: 'None',
  armorLethality: 0, armorCritChance: 0, armorCritDmg: 0,
  fireDmg: 0, fireChance: 0, fireTime: 0,
  poisonDmg: 0, poisonChance: 0, poisonTime: 0,
  lightningDmg: 0, lightningChance: 0, lightningCooldown: 0,
  blastDmg: 0, blastChance: 0,
  berserk: 0,
  runes: ['None', 'None', 'None', 'None', 'None', 'None', 'None', 'None', 'None'],
  achievement: 'None'
};

const inputPanel = FC.createInputPanel({
  data: game,
  getBuild: () => build,
  onBuildChange: (nb) => { build = nb; },
  onCalculate: null
});

const byId = {};
const index = (n) => { if (n.id) { byId[n.id] = n; } (n.children || []).forEach(index); };
index(inputPanel);

function commit(id, value) {
  byId[id].value = value;
  byId[id].dispatchEvent({ type: 'change' });
}

console.log('== Golemite inputs render ==');
const fields = ['level', 'fire_dmg', 'fire_chance', 'fire_time', 'poison_dmg', 'poison_chance', 'poison_time',
  'lightning_dmg', 'lightning_chance', 'lightning_cooldown', 'blast_dmg', 'blast_chance', 'smite_dmg',
  'smite_chance', 'blackhole_dmg', 'blackhole_chance', 'resonance_dmg', 'moon', 'lethality', 'crit_chance',
  'crit_dmg', 'atk_speed'];
[1, 2].forEach((g) => fields.forEach((f) => assert(!!byId['fc-golemite-' + g + '-' + f], `Golemite ${g} ${f} input rendered`)));
assert(byId['fc-golemite-1-level'].getAttribute('max') === '25', 'level max is 25');
const tabs = inputPanel.querySelectorAll('.fc-golemite-tab');
assert(tabs.length === 2, 'two Golemite tabs');
const panes = inputPanel.querySelectorAll('.fc-golemite-pane');
assert(!panes[0].classList.contains('fc-hidden') && panes[1].classList.contains('fc-hidden'), 'first Golemite shown first');
tabs[1].dispatchEvent({ type: 'click', preventDefault() {} });
assert(panes[0].classList.contains('fc-hidden') && !panes[1].classList.contains('fc-hidden'), 'second tab shows Golemite 2');

console.log('== Commit + transform ==');
commit('fc-golemite-1-level', '30');
assert(byId['fc-golemite-1-level'].value === '25', 'level clamps to 25');
commit('fc-golemite-2-level', '13.7');
assert(byId['fc-golemite-2-level'].value === '13', 'level is a whole number');
commit('fc-golemite-1-lethality', '10');
commit('fc-golemite-1-fire_dmg', '12');
commit('fc-golemite-1-fire_time', '4');
commit('fc-golemite-2-lightning_cooldown', '2.5');
commit('fc-golemite-2-crit_dmg', '-5');
assert(byId['fc-golemite-2-crit_dmg'].value === '0', 'negative values clamp to 0');
assert(tabs[0].textContent === 'Golemite 1 · Lv 25', `tab shows the level (got ${tabs[0].textContent})`);
const engineBuild = FC.transformBuildForEngine(build);
approx(engineBuild.golemites[0].level, 25, 'level passes through');
approx(engineBuild.golemites[0].lethality, 0.10, 'lethality is a whole percent');
approx(engineBuild.golemites[0].fire_dmg, 0.12, 'fire damage is a whole percent');
approx(engineBuild.golemites[0].fire_time, 4, 'fire time stays in seconds');
approx(engineBuild.golemites[1].lightning_cooldown, 2.5, 'cooldown stays in seconds');

console.log('== Engine end to end ==');
const r = FC.calculate(engineBuild, game);
const base = FC.calculate(FC.transformBuildForEngine(Object.assign({}, build, { golemites: undefined })), game);
approx(r.golemite_dps, r.unforged_damage * (0.06 + 0.02) * 0.66666666666666, 'Golemite DPS from both levels');
approx(r.lethality, base.lethality + 0.10, 'Golemite lethality reaches the stat pool');
approx(r.fire_dmg, 0.12, 'Golemite fire damage reaches fire');
approx(r.total_dps - base.total_dps - r.golemite_dps - r.fire_dps, r.weapon_dps - base.weapon_dps, 'total adds Golemite DPS');

console.log('== setBuild restores and resets ==');
inputPanel.setBuild(Object.assign({}, build, { golemites: [{ level: 18, moon: 20 }, {}] }));
assert(byId['fc-golemite-1-level'].value === '18', 'setBuild restores level');
assert(byId['fc-golemite-1-moon'].value === '20', 'setBuild restores sub-stat');
assert(byId['fc-golemite-2-level'].value === '0', 'missing Golemite resets to 0');
inputPanel.setBuild(Object.assign({}, build, { golemites: undefined }));
assert(byId['fc-golemite-1-level'].value === '0', 'reset clears Golemite level');
assert(tabs[0].textContent === 'Golemite 1', 'reset clears tab level');

console.log(failures === 0 ? 'ALL GOLEMITE-UI CHECKS PASSED ✓' : `${failures} CHECK(S) FAILED ✗`);
process.exit(failures === 0 ? 0 : 1);
