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
  '    weaponTraitLines: weaponTraitLines,\n' +
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

function traitsFor(overrides) {
  const b = Object.assign({}, build, overrides);
  return FC.calculate(FC.transformBuildForEngine(b), game).active_traits.split('\n');
}
function has(lines, text, label) {
  return assert(lines.indexOf(text) !== -1, `${label} (wanted "${text}", got ${JSON.stringify(lines)})`);
}

console.log('== Weapon trait summary ==');
let lines = FC.weaponTraitLines(slots([['Wolfarite', 30]]), game);
has(lines, '+15% Lethality', 'Wolfarite gives full lethality at 30% share');
has(lines, '+8% Attack Speed', 'Wolfarite gives full attack speed');
has(lines, '+6% Swiftness', 'free-text clause listed too');
assert(FC.weaponTraitLines(slots([['Wolfarite', 1], ['Stone', 20]]), game).indexOf('+15% Lethality') === -1,
  'an ore below 10% share gives no trait');
assert(FC.weaponTraitLines(slots([]), game).length === 0, 'no ores means no traits');

build = Object.assign({}, build, { oreSlots: slots([['Wolfarite', 30]]) });
const panel = FC.createInputPanel({ data: game, getBuild: () => build, onBuildChange: (nb) => { build = nb; }, onCalculate: null });
const ids = {};
const walk = (n) => { if (n.id) { ids[n.id] = n; } (n.children || []).forEach(walk); };
walk(panel);
const box = ids['fc-weapon-traits'];
assert(!!box, 'weapon trait box rendered under the ore slots');
assert(box.textContent.indexOf('+15% Lethality') !== -1, 'weapon trait box lists the ore traits');
panel.setBuild(Object.assign({}, build, { oreSlots: slots([]) }));
assert(box.textContent.indexOf('Add ores') !== -1, 'setBuild with no ores shows the empty hint');
panel.setBuild(Object.assign({}, build, { oreSlots: slots([['Wolfarite', 30]]) }));
assert(box.textContent.indexOf('+15% Lethality') !== -1, 'setBuild refreshes the weapon trait box');
build = Object.assign({}, build, { oreSlots: slots([['Stone', 10]]) });

console.log('== Golemite traits join Active Traits ==');
lines = traitsFor({ golemites: [{ level: 13, slots: slots([['Wolfarite', 30]]) }, { level: 0, slots: slots([]) }] });
has(lines, '+4.2% Lethality', 'Exotic Wolfarite Golemite lethality 15% x 0.28');
lines = traitsFor({
  oreSlots: slots([['Wolfarite', 30]]),
  golemites: [{ level: 13, slots: slots([['Wolfarite', 30]]) }, { level: 0, slots: slots([]) }]
});
has(lines, '+19.2% Lethality', 'Golemite lethality adds to the weapon lethality');

console.log('== Rune abilities, runes and achievement join Active Traits ==');
lines = traitsFor({ fireDmg: 10, fireChance: 20, fireTime: 2 });
has(lines, '+10% Fire DMG/s for 2s (+20% chance on hit)', 'fire ability shown');
lines = traitsFor({ blastDmg: 30, blastChance: 15 });
has(lines, '+30% Explosion DMG (+15% chance)', 'blast ability shown as explosion');
lines = traitsFor({ lightningDmg: 40, lightningChance: 25, lightningCooldown: 3 });
has(lines, '+40% Lightning DMG (+25% chance, 3s cooldown)', 'lightning ability shown');
lines = traitsFor({ runes: ['Crit Chance +6%', 'Crit Chance +10%', 'None', 'None', 'None', 'None', 'None', 'None', 'None'] });
has(lines, '+16% Crit Chance', 'rune stats add up');
lines = traitsFor({ achievement: 'Attack Speed +8%' });
has(lines, '+8% Attack Speed', 'achievement shown');

console.log('== Race traits join Active Traits ==');
has(traitsFor({ race: 'Orc' }), '+10% Lethality', 'Orc lethality');
has(traitsFor({ race: 'Demon' }), '+20% Attack Speed', 'Demon attack speed');
has(traitsFor({ race: 'Demon' }), 'Cursed Aura: 10% weapon DMG/s', 'Demon Cursed Aura');
has(traitsFor({ race: 'Minotaur' }), '+30% Berserk', 'Minotaur berserk');
has(traitsFor({ race: 'Minotaur', berserk: 50 }), '+80% Berserk', 'manual berserk adds to race berserk');
has(traitsFor({ race: 'Kitsune' }), '+20% Lethality', 'Kitsune lethality');
has(traitsFor({ race: 'Kitsune' }), 'Fox Claws: 75% DMG (25% chance, up to 3 spirits)', 'Kitsune Fox Claws');
has(traitsFor({ race: 'Kitsune' }), 'Foxfire: 30% DMG (50% chance, 3s)', 'Kitsune Foxfire');
has(traitsFor({ race: 'Orc Lord' }), 'Smash: 100% DMG (25% chance, 10s cooldown)', 'Orc Lord Smash');
has(traitsFor({ race: 'Orc Lord', orcLordKillStacks: 2 }), '+15% Attack Speed', 'Lord of War stacks');
has(traitsFor({ race: 'Dragonborn' }), '+30% Fire DMG/s for 3s (+40% chance on hit)', 'Dragonborn burn');
const gauntlet = game.weapons.find((w) => w.type === 'Gauntlet');
has(traitsFor({ race: 'Felynx', weaponType: 'Gauntlet', weaponName: gauntlet.name }), '+20% Lethality', 'Felynx + Gauntlet class bonus');
assert(traitsFor({ race: 'Felynx' }).indexOf('+20% Lethality') === -1, 'Felynx without a Gauntlet gets no bonus');
has(traitsFor({ race: 'Dryad', dryadInGrove: true }), '+15% Crit Chance', 'Dryad grove crit chance');
has(traitsFor({ race: 'Dryad', dryadMaxHp: 4200 }), '+20% Fire, Poison, Lightning & Black Hole DMG (Vital Power)', 'Dryad Vital Power');
assert(traitsFor({ race: 'Human' })[0] === 'No active traits', 'Human with a traitless ore has no active traits');

if (failures) {
  console.log(`\n${failures} ACTIVE-TRAITS CHECK(S) FAILED`);
  process.exit(1);
}
console.log('\nALL ACTIVE-TRAITS CHECKS PASSED ✓');
