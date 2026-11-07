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
  '    createInputPanel: createInputPanel,\n' +
  '    deriveGolemiteStats: deriveGolemiteStats,\n' +
  '    setGameData: function (g) { state.gameData = g; }\n' +
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
  achievements: loadJSON('Data-Achievements.json'),
  oreRarity: loadJSON('Data-OreRarity.json')
});
FC.setGameData(game);

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
    { name: 'Stone', amount: 10 },
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

function slots(list) {
  const out = list.map(([name, amount]) => ({ name, amount }));
  while (out.length < 4) { out.push({ name: 'None', amount: 0 }); }
  return out;
}

console.log('== Rarity and scaling ==');
let d = FC.deriveGolemiteStats(slots([['Wolfarite', 30]]), game);
assert(d.rarity === 'Exotic', `Wolfarite Golemite is Exotic (got ${d.rarity})`);
approx(d.scaling, 0.28, 'Exotic scaling is 0.28');
approx(d.stats.lethality, 0.15 * 0.28, 'Wolfarite lethality is its full weapon trait x 0.28');
approx(d.stats.atk_speed, 0.08 * 0.28, 'Wolfarite attack speed x 0.28');
d = FC.deriveGolemiteStats(slots([['Wolfarite', 20], ['Stone', 10]]), game);
assert(d.rarity === 'Exotic', 'rarity is the rarest ore used, not the most common');
approx(d.stats.lethality, 0.15 * 0.28, 'share above 30% keeps the full trait');
d = FC.deriveGolemiteStats(slots([['Stone', 10]]), game);
assert(d.rarity === 'Common', 'Stone Golemite is Common');
approx(d.stats.lethality, 0, 'Stone gives no traits');
d = FC.deriveGolemiteStats(slots([['Wolfarite', 0], ['Stone', 10]]), game);
assert(d.rarity === 'Common', 'an ore with amount 0 does not set the rarity');
d = FC.deriveGolemiteStats(slots([]), game);
assert(d.rarity === null, 'no ores means no rarity');

console.log('== Weapon rules carry over ==');
d = FC.deriveGolemiteStats(slots([['Fireite', 10]]), game);
approx(d.stats.fire_dmg, 0.20 * 0.18, 'Fireite fire damage x Legendary 0.18');
approx(d.stats.fire_chance, 0.20 * 0.18, 'Fireite fire chance x 0.18');
approx(d.stats.fire_time, 2, 'fire duration is not scaled');
d = FC.deriveGolemiteStats(slots([['Wolfarite', 95], ['Fireite', 5]]), game);
approx(d.stats.fire_dmg, 0, 'an ore below 10% share gives no trait, like on a weapon');
d = FC.deriveGolemiteStats(slots([['Galaxite', 10], ['Bismuth', 10]]), game);
assert(d.rarity === 'Divine', 'Galaxite + Bismuth is Divine');
approx(d.stats.blackhole_dmg, 0.60 * 0.30, 'Galaxite black hole damage x 0.30');
approx(d.stats.blackhole_chance, 0.30 * 0.30, 'black hole chance x 0.30');
approx(d.stats.resonance_dmg, 1.25 * 0.30, 'Galaxite + Bismuth Resonance x 0.30');
d = FC.deriveGolemiteStats(slots([['Wolfarite', 30]]), Object.assign({}, game, { ore_rarity: {} }));
assert(d.rarity === null && d.stats.lethality === 0, 'without rarity data a Golemite adds nothing');

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
[1, 2].forEach((g) => {
  assert(!!byId['fc-golemite-' + g + '-level'], `Golemite ${g} level input rendered`);
  for (let s = 0; s < 4; s++) {
    assert(!!byId['fc-golemite-' + g + '-slot-' + s], `Golemite ${g} slot ${s + 1} ore slot rendered`);
    assert(!!byId['fc-golemite-' + g + '-slot-' + s + '-amount'], `Golemite ${g} slot ${s + 1} amount rendered`);
  }
  assert(!!byId['fc-golemite-' + g + '-summary'], `Golemite ${g} summary rendered`);
  ['fire_dmg', 'lethality', 'moon', 'lightning_cooldown'].forEach((f) => {
    assert(!byId['fc-golemite-' + g + '-' + f], `old manual ${f} box is gone`);
  });
});
assert(!!byId['ore-slot-0'], 'weapon ore slots keep their ids');
assert(byId['fc-golemite-1-level'].getAttribute('max') === '25', 'level max is 25');
const tabs = inputPanel.querySelectorAll('.fc-golemite-tab');
assert(tabs.length === 2, 'two Golemite tabs');
const panes = inputPanel.querySelectorAll('.fc-golemite-pane');
assert(!panes[0].classList.contains('fc-hidden') && panes[1].classList.contains('fc-hidden'), 'first Golemite shown first');
tabs[1].dispatchEvent({ type: 'click', preventDefault() {} });
assert(panes[0].classList.contains('fc-hidden') && !panes[1].classList.contains('fc-hidden'), 'second tab shows Golemite 2');
assert(byId['fc-golemite-1-summary'].textContent.indexOf('Add the ores') !== -1, 'empty Golemite asks for ores');

console.log('== setBuild + amount commits ==');
inputPanel.setBuild(Object.assign({}, build, {
  golemites: [{ level: 30, slots: slots([['Wolfarite', 20], ['Stone', 10]]) }, { level: 13.7, slots: slots([['Fireite', 10]]) }]
}));
assert(byId['fc-golemite-1-level'].value === '25', 'level clamps to 25');
assert(byId['fc-golemite-2-level'].value === '13', 'level is a whole number');
assert(byId['fc-golemite-1-slot-0-amount'].value === '20', 'setBuild restores ore amounts');
assert(tabs[0].textContent === 'Golemite 1 · Lv 25 · Exotic', `tab shows level and rarity (got ${tabs[0].textContent})`);
const summary1 = byId['fc-golemite-1-summary'].textContent;
assert(summary1.indexOf('Exotic') !== -1 && summary1.indexOf('Ore traits ×0.28') !== -1, `summary shows rarity and scaling (got ${summary1})`);
assert(summary1.indexOf('Lethality') !== -1 && summary1.indexOf('4.2%') !== -1, 'summary shows the scaled lethality');
const summary2 = byId['fc-golemite-2-summary'].textContent;
assert(summary2.indexOf('Fire Duration') !== -1 && summary2.indexOf('2s') !== -1, 'summary shows durations in seconds');

commit('fc-golemite-1-level', '20');
assert(build.golemites[0].level === 20, 'level commit reaches the build');
commit('fc-golemite-1-slot-0-amount', '0');
assert(build.golemites[0].slots[0].amount === 0, 'amount commit reaches the build');
assert(tabs[0].textContent === 'Golemite 1 · Lv 20 · Common', `rarity drops when Wolfarite is emptied (got ${tabs[0].textContent})`);
assert(byId['fc-golemite-1-summary'].textContent.indexOf('no weapon traits') !== -1, 'Stone-only Golemite says it has no traits');
commit('fc-golemite-1-slot-0-amount', '20');

console.log('== Transform + engine end to end ==');
const engineBuild = FC.transformBuildForEngine(build);
approx(engineBuild.golemites[0].level, 20, 'level passes through');
approx(engineBuild.golemites[0].lethality, 0.15 * 0.28, 'derived lethality reaches the engine build');
approx(engineBuild.golemites[1].fire_dmg, 0.20 * 0.18, 'derived fire damage reaches the engine build');
approx(engineBuild.golemites[1].fire_time, 2, 'fire time stays in seconds');
const r = FC.calculate(engineBuild, game);
const base = FC.calculate(FC.transformBuildForEngine(Object.assign({}, build, { golemites: undefined })), game);
approx(r.golemite_dps, r.unforged_damage * ((0.02 + 7 * 0.04 / 12) + 0.02) * 0.66666666666666, 'Golemite DPS from both levels');
approx(r.lethality, base.lethality + 0.15 * 0.28, 'Golemite lethality reaches the stat pool');
approx(r.fire_dmg, 0.20 * 0.18, 'Golemite fire damage reaches fire');

console.log('== Reset ==');
inputPanel.setBuild(Object.assign({}, build, { golemites: undefined }));
assert(byId['fc-golemite-1-level'].value === '0', 'reset clears Golemite level');
assert(byId['fc-golemite-1-slot-0-amount'].value === '0', 'reset clears Golemite ores');
assert(tabs[0].textContent === 'Golemite 1', 'reset clears tab text');

console.log(failures === 0 ? 'ALL GOLEMITE-UI CHECKS PASSED ✓' : `${failures} CHECK(S) FAILED ✗`);
process.exit(failures === 0 ? 0 : 1);
