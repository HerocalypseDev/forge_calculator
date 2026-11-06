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
const ORES = process.env.FC_ORES
  ? JSON.parse(fs.readFileSync(process.env.FC_ORES, 'utf8'))
  : loadJSON('Data-Ores.json');

const game = FC.buildGameData({
  ores: ORES,
  weapons: loadJSON('Data-Weapons.json'),
  races: loadJSON('Data-Races.json'),
  runes: loadJSON('Data-Runes.json'),
  achievements: loadJSON('Data-Achievements.json')
});

const build = {
  slots: [
    { name: 'Snowite', amount: 12 },
    { name: 'Kitsunite', amount: 15 },
    { name: 'Moon Stone', amount: 15 },
    { name: 'Bismuth', amount: 15 }
  ],
  weapon_name: 'Colossal Terrorblade',
  quality: 100,
  forge_level: 0,
  race: 'Human',
  bonus_weapon_type: 'Dagger',
  rune_cells: ['None', 'None', 'None', 'None', 'None', 'None', 'None', 'None', 'None'],
  base_crit_chance: 0,
  base_crit_dmg: 1.45,
  armor_crit_chance: 0,
  armor_crit_dmg: 0,
  armor_lethality: 0,
  base_lethality: 0,
  abilities: {
    fire_dmg: 0, fire_chance: 0, fire_time: 0,
    poison_dmg: 0, poison_chance: 0, poison_time: 0,
    lightning_dmg: 0, lightning_chance: 0, lightning_cooldown: 0,
    blast_dmg: 0, blast_chance: 0
  },
  berserk: 0,
  achievement: 'None'
};

const r = FC.calculate(build, game);

const expected = [
  ['E10  avg ore power',     'avg_power',        14.107142857142858],
  ['A18  unforged dmg',      'unforged_damage',  620.7142857142858],
  ['C18  forged dmg',        'forged_damage',    620.7142857142858],
  ['E21  eff. hits/sec',     'attack_rate',      0.8985608552631578],
  ['E72  lethality',         'lethality',        0.0],
  ['E73  crit chance',       'crit_chance',      0.0],
  ['E74  crit dmg',          'crit_dmg',         0.0],
  ['E75  atk speed',         'atk_speed',        0.15015789473684207],
  ['C81  moon',              'moon',             0.20855263157894732],
  ['C87  explosion dmg',     'explosion_dmg',    0.6714473684210526],
  ['C88  explosion chance',  'explosion_chance', 0.33368421052631575],
  ['C91  fire dmg',          'fire_dmg',         0.3661842105263158],
  ['C92  fire chance',       'fire_chance',      0.41710526315789465],
  ['C93  fire duration',     'fire_duration',    4.171052631578947],
  ['C96  poison dmg',        'poison_dmg',       0.02],
  ['C97  poison chance',     'poison_chance',    0.09625],
  ['C98  poison duration',   'poison_duration',  1.5],
  ['C101  smite dmg',         'smite_dmg',        0.4124999999999999],
  ['C102  smite chance',      'smite_chance',     0.41710526315789465],
  ['C105  black hole dmg',    'blackhole_dmg',    0.0],
  ['C106  black hole chance', 'blackhole_chance', 0.0],
  ['C109  lightning dmg',     'lightning_dmg',    0.7673684210526315],
  ['C110  lightning chance',  'lightning_chance', 0.5005263157894736],
  ['C113  smash dmg',         'smash_dmg',        0.0],
  ['C117  fox claws dmg',     'fox_claws_dmg',    0.0],
  ['C118  fox claws chance',  'fox_claws_chance', 0.0],
  ['C121  foxfire dmg',       'foxfire_dmg',      0.0],
  ['C122  foxfire chance',    'foxfire_chance',   0.0],
  ['C123  foxfire duration',  'foxfire_duration', 0.0],
  ['C131 physical hit DPS',  'weapon_dps',       557.7495594454887],
  ['C132 explosion DPS',     'explosion_dps',    126.06912983703904],
  ['C133 fire DoT DPS',      'fire_dps',         199.09906016473872],
  ['C134 poison DoT DPS',    'poison_dps',       1.5530545787570254],
  ['C135 smite DPS',         'smite_dps',        95.67337739993157],
  ['C136 black hole DPS',    'blackhole_dps',    0.0],
  ['E136 lightning DPS',     'lightning_dps',    184.69326652467464],
  ['C137 smash DPS',         'smash_dps',        0.0],
  ['E137 fox claws DPS',     'fox_claws_dps',    0.0],
  ['C138 foxfire DPS',       'foxfire_dps',      0.0],
  ['C141 TOTAL DPS',         'total_dps',        1164.8374479506297],
  ['C142 berserk DPS',       'berserk',          1164.8374479506297],
  ['C143 moon stone DPS',    'moonstone',        1281.157586334985],
  ['C145 min DPS',           'min_dps',          557.7495594454887],
  ['C146 max burst DPS',     'max_dps',          1893.2159966004567],
  ['E141 TTK 25k',           'ttk_25k',          21.462222084277975],
  ['E142 TTK 75k',           'ttk_75k',          64.38666625283392]
];

const TOL = 1e-6;
let fails = 0;
console.log('cell                      workbook            engine         status');
console.log('-'.repeat(78));
for (const [label, key, want] of expected) {
  let got = r[key];
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
console.log(fails === 0
  ? 'UpdatedSpreadsheet.xlsx PARITY PASSED'
  : fails + ' of ' + expected.length + ' cells diverge from UpdatedSpreadsheet.xlsx');
process.exit(fails ? 1 : 0);
