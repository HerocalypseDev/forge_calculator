/**
 * reall.xlsx parity check for the MediaWiki engine.
 *
 * Runs the workbook's own default build (the state reall.xlsx was saved in)
 * through MediaWiki-ForgeCalculator.js and diffs every cell against the
 * workbook's cached values. Dev-only audit harness.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const HERE = __dirname;
const SRC = fs.readFileSync(path.join(HERE, 'MediaWiki-ForgeCalculator.js'), 'utf8');

const marker = 'var DATA_TITLES = {';
const idx = SRC.indexOf(marker);
const blockStart = SRC.lastIndexOf('\n', idx) + 1;
const instrumented = SRC.slice(0, blockStart) +
  '  globalThis.__FC = { calculate: calculate, buildGameData: buildGameData };\n' +
  SRC.slice(blockStart);

const mw = {
  config: { get: () => '/w' },
  loader: { using: () => Promise.resolve() },
  log: () => {},
  Api: function () {},
  hook: () => ({ fire: () => {} })
};
const sandbox = {
  console: console, setTimeout: setTimeout, clearTimeout: clearTimeout, window: null,
  document: { readyState: 'complete', getElementById: () => null, addEventListener: () => {} }
};
sandbox.window = sandbox;
sandbox.window.mediaWiki = mw;
vm.createContext(sandbox);
vm.runInContext(instrumented, sandbox, { filename: 'MediaWiki-ForgeCalculator.js' });
const FC = sandbox.__FC;

const loadJSON = (n) => JSON.parse(fs.readFileSync(path.join(HERE, n), 'utf8'));
// FC_ORES=<path> swaps in a different ore catalog, to separate data drift from
// genuine formula bugs.
const ORES = process.env.FC_ORES
  ? JSON.parse(fs.readFileSync(process.env.FC_ORES, 'utf8'))
  : loadJSON('Data-Ores.json');

// reall.xlsx deleted the ore attack-speed ramp (its C48 is a bare input), but the
// maintainer's call was that this was a sheet regression, so the engine keeps
// deriving atk_speed from ores (sourced from new.xlsx C48).  That is a deliberate,
// permanent deviation: any build holding Fierce Jade / Tiger's Eye / Wolfarite /
// Yeti Heart gets a higher E48 than this workbook computes, which cascades into
// every DPS cell.  Strip it here so this harness measures FORMULA fidelity
// against the cached values rather than re-reporting that known deviation.
// FC_KEEP_ATK_SPEED=1 leaves it in, to see the size of the divergence.
if (!process.env.FC_KEEP_ATK_SPEED) {
  for (const ore of (ORES.ores || ORES)) {
    if (ore.stats) { delete ore.stats.atk_speed; }
  }
}
const game = FC.buildGameData({
  ores: ORES,
  weapons: loadJSON('Data-Weapons.json'),
  races: loadJSON('Data-Races.json'),
  runes: loadJSON('Data-Runes.json'),
  achievements: loadJSON('Data-Achievements.json')
});

// --- The workbook's saved default build (DPS Calculator, reall.xlsx) ---
const build = {
  slots: [
    { name: 'Fierce Jade', amount: 15 },   // C6/D6
    { name: 'Kitsunite', amount: 20 },     // C7/D7
    { name: 'Galaxite', amount: 15 },      // C8/D8
    { name: 'Select Ore', amount: 0 }      // C9/D9
  ],
  weapon_name: 'Hook Blade',               // D12
  quality: 100,                            // E12
  forge_level: 9,                          // C13
  race: 'Archangel',                       // C22
  bonus_weapon_type: 'Dagger',             // C23
  rune_cells: ['None', 'None', 'None', 'None', 'None', 'None'],
  base_crit_chance: 0,                     // C20
  base_crit_dmg: 1.45,                     // C21
  armor_crit_chance: 0.7,                  // C42
  armor_crit_dmg: 0.4,                     // C43
  armor_lethality: 0.8,                    // C44
  base_lethality: 0,                       // A45 (empty)
  abilities: {                             // rows 34-37, all zero
    fire_dmg: 0, fire_chance: 0, fire_time: 0,
    poison_dmg: 0, poison_chance: 0, poison_time: 0,
    lightning_dmg: 0, lightning_chance: 0, lightning_cooldown: 0,
    blast_dmg: 0, blast_chance: 0
  },
  berserk: 0,                              // C54
  achievement: 'Attack Speed +20%'         // C85
};

const r = FC.calculate(build, game);

// A few of the workbook's cached cells, used to restate C101 below.
const WB_C18 = 584.1;          // forged weapon damage
const WB_C80 = 0.8;            // lightning DMG %
const WB_C81 = 0.6;            // lightning proc chance
const WB_E21 = 2.692307692;    // effective hits/sec

// C101's final term is a bare "+C80" in the sheet -- the raw lightning PERCENTAGE
// (0.8), not damage, while every other term is scaled by C18 and/or E21. The
// maintainer's call is that this is an authoring slip and the term should scale
// like the other procs, so the expectation is the cached C101 with that applied.
const C101 = 10346.10962 - WB_C80 + WB_C18 * WB_C80 * WB_C81 * WB_E21;

// --- Workbook cached values ---
const expected = [
  ['E10  avg ore power',     'avg_power',        23.6],
  ['A18  unforged dmg',      'unforged_damage',  389.4],
  ['C18  forged dmg',        'forged_damage',    584.1],
  ['E21  eff. hits/sec',     'attack_rate',      2.692307692],
  ['E45  lethality',         'lethality',        1.2],
  ['E46  crit chance',       'crit_chance',      1.0],
  ['E47  crit dmg',          'crit_dmg',         0.8],
  ['E48  atk speed',         'atk_speed',        0.4],
  ['C53  moon',              'moon',             0],
  ['C58  explosion dmg',     'explosion_dmg',    0.7],
  ['C59  explosion chance',  'explosion_chance', 0.4],
  ['C62  fire dmg',          'fire_dmg',         0.4],
  ['C63  fire chance',       'fire_chance',      0.5],
  ['C64  fire duration',     'fire_duration',    4],
  ['C67  poison dmg',        'poison_dmg',       0],
  ['C68  poison chance',     'poison_chance',    0],
  ['C69  poison duration',   'poison_duration',  0],
  ['C72  smite dmg',         'smite_dmg',        1.5],
  ['C73  smite chance',      'smite_chance',     0.83],
  ['C76  black hole dmg',    'blackhole_dmg',    0.6],
  ['C77  black hole chance', 'blackhole_chance', 0.3],
  ['C80  lightning dmg',     'lightning_dmg',    0.8],
  ['C81  lightning chance',  'lightning_chance', 0.6],
  ['C89  physical hit DPS',  'weapon_dps',       7784.255769],
  ['C90  explosion DPS',     'explosion_dps',    293.5476923],
  ['C91  fire DoT DPS',      'fire_dps',         155.76],
  ['C92  poison DoT DPS',    'poison_dps',       0],
  ['C93  smite DPS',         'smite_dps',        1305.238846],
  ['C94  black hole DPS',    'blackhole_dps',    188.7092308],
  ['E94  lightning DPS',     'lightning_dps',    62.304],
  ['C96  TOTAL DPS',         'total_dps',        9789.815538],
  ['C97  berserk DPS',       'berserk',          9789.815538],
  ['C98  moon stone DPS',    'moonstone',        9789.815538],
  ['C100 min DPS',           'min_dps',          3459.669231],
  ['C101 max burst DPS*',    'max_dps',          C101],
  ['E96  TTK 25k',           'ttk_25k',          2.553674265],
  ['E97  TTK 75k',           'ttk_75k',          7.661022795]
];

const TOL = 1e-6;
let fails = 0;
console.log('cell                      workbook            engine         status');
console.log('-'.repeat(78));
for (const [label, key, want] of expected) {
  let got = r[key];
  // C97/C98 are "N/A" in the engine when berserk/moon are zero; workbook falls
  // back to C96 in that case, so compare against total for a fair check.
  if (got === null && (key === 'berserk' || key === 'moonstone')) { got = r.total_dps; }
  const ok = got !== null && got !== undefined &&
    Math.abs(got - want) <= TOL * Math.max(1, Math.abs(want));
  if (!ok) { fails++; }
  console.log(
    label.padEnd(25),
    String(want).padStart(14),
    String(got === null ? 'null' : Number(got).toFixed(6)).padStart(16),
    ok ? '  ok' : '  <-- MISMATCH'
  );
}
console.log('-'.repeat(78));
console.log('* C101 restated for the scaled-lightning decision; ore atk_speed '
  + 'excluded (see the notes at the top of this file)');
console.log(fails === 0
  ? 'reall.xlsx PARITY PASSED'
  : fails + ' of ' + expected.length + ' cells diverge from reall.xlsx');
process.exit(fails ? 1 : 0);
