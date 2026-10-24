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
    { name: 'Select Ore', amount: 0 },
    { name: 'Select Ore', amount: 0 },
    { name: 'Select Ore', amount: 0 },
    { name: 'Select Ore', amount: 0 }
  ],
  weapon_name: 'Must have at least 3 ores',
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
  ['E10  avg ore power',     'avg_power',        1],
  ['A18  unforged dmg',      'unforged_damage',  1],
  ['C18  forged dmg',        'forged_damage',    1],
  ['E21  eff. hits/sec',     'attack_rate',      1],
  ['E45  lethality',         'lethality',        0],
  ['E46  crit chance',       'crit_chance',      0],
  ['E47  crit dmg',          'crit_dmg',         0],
  ['E48  atk speed',         'atk_speed',        0],
  ['C53  moon',              'moon',             0],
  ['C58  explosion dmg',     'explosion_dmg',    0],
  ['C59  explosion chance',  'explosion_chance', 0],
  ['C62  fire dmg',          'fire_dmg',         0],
  ['C63  fire chance',       'fire_chance',      0],
  ['C64  fire duration',     'fire_duration',    0],
  ['C67  poison dmg',        'poison_dmg',       0],
  ['C68  poison chance',     'poison_chance',    0],
  ['C69  poison duration',   'poison_duration',  0],
  ['C72  smite dmg',         'smite_dmg',        0],
  ['C73  smite chance',      'smite_chance',     0],
  ['C76  black hole dmg',    'blackhole_dmg',    0],
  ['C77  black hole chance', 'blackhole_chance', 0],
  ['C80  lightning dmg',     'lightning_dmg',    0],
  ['C81  lightning chance',  'lightning_chance', 0],
  ['C84  smash dmg',         'smash_dmg',        0],
  ['C88  fox claws dmg',     'fox_claws_dmg',    0],
  ['C89  fox claws chance',  'fox_claws_chance', 0],
  ['C92  foxfire dmg',       'foxfire_dmg',      0],
  ['C93  foxfire chance',    'foxfire_chance',   0],
  ['C94  foxfire duration',  'foxfire_duration', 0],
  ['C102 physical hit DPS',  'weapon_dps',       1],
  ['C103 explosion DPS',     'explosion_dps',    0],
  ['C104 fire DoT DPS',      'fire_dps',         0],
  ['C105 poison DoT DPS',    'poison_dps',       0],
  ['C106 smite DPS',         'smite_dps',        0],
  ['C107 black hole DPS',    'blackhole_dps',    0],
  ['E107 lightning DPS',     'lightning_dps',    0],
  ['C108 smash DPS',         'smash_dps',        0],
  ['E108 fox claws DPS',     'fox_claws_dps',    0],
  ['C109 foxfire DPS',       'foxfire_dps',      0],
  ['C111 TOTAL DPS',         'total_dps',        1],
  ['C112 berserk DPS',       'berserk',          1],
  ['C113 moon stone DPS',    'moonstone',        1],
  ['C115 min DPS',           'min_dps',          1],
  ['C116 max burst DPS',     'max_dps',          1.45],
  ['E111 TTK 25k',           'ttk_25k',          25000],
  ['E112 TTK 75k',           'ttk_75k',          75000]
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
