
import { EXPECTED_COUNTS, SELECT_ORE, NONE_LABEL } from './constants.js';

async function fetchJson(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load ${path}: ${response.statusText}`);
  }
  return response.json();
}

function buildOres(rawOres) {
  return rawOres.map(raw => ({
    name: raw.name,
    multiplier: raw.multiplier,
    equipment: raw.equipment ?? null,
    trait10: raw.trait10 ?? null,
    trait30: raw.trait30 ?? null,
    comments: raw.comments ?? null,
    stats: raw.stats ?? {}
  }));
}

function buildWeapons(rawWeapons) {
  return rawWeapons.map(raw => ({
    name: raw.name,
    type: raw.type,
    interval: raw.interval,
    damage: raw.damage
  }));
}

function buildRaces(rawRaces) {
  return rawRaces.map(raw => ({
    name: raw.name,
    default_trait: raw.default_trait ?? null,
    available_traits: raw.available_traits ?? []
  }));
}

function buildRunes(rawRunes) {
  return rawRunes.map(raw => ({
    name: raw.name,
    stat: raw.stat ?? null,
    value: raw.value ?? null
  }));
}

function buildAchievements(rawAchievements) {
  return rawAchievements.map(raw => ({
    name: raw.name,
    stat: raw.stat ?? null,
    value: raw.value ?? null
  }));
}

function validateData(data) {
  const counts = {
    ores: data.ores.length,
    weapons: data.weapons.length,
    races: data.races.length,
    runes: data.runes.length,
    achievements: data.achievements.length
  };

  const drift = {};
  for (const [key, expected] of Object.entries(EXPECTED_COUNTS)) {
    if (counts[key] !== expected) {
      drift[key] = { expected, actual: counts[key] };
    }
  }

  if (Object.keys(drift).length > 0) {
    console.warn('Data count drift detected:', drift);
  }

  const oreNames = data.ores.map(o => o.name);
  const dupes = oreNames.filter((name, i) => oreNames.indexOf(name) !== i);
  if (dupes.length > 0) {
    throw new Error(`Duplicate ore names: ${[...new Set(dupes)].join(', ')}`);
  }

  if (!data.weapon_types.length) {
    throw new Error('Empty weapon type list');
  }
  if (!data.race_bonus_types.length) {
    throw new Error('Empty race bonus type list');
  }
}

function buildIndexes(data) {
  data._ore_index = new Map(data.ores.map(o => [o.name, o]));
  data._weapon_index = new Map(data.weapons.map(w => [w.name, w]));
  data._race_index = new Map(data.races.map(r => [r.name, r]));
}

export async function loadGameData() {
  const basePath = '../data';

  const [rawOres, rawWeapons, rawRaces, rawRunes, rawAchievements] = await Promise.all([
    fetchJson(`${basePath}/ores.json`),
    fetchJson(`${basePath}/weapons.json`),
    fetchJson(`${basePath}/races.json`),
    fetchJson(`${basePath}/runes.json`),
    fetchJson(`${basePath}/achievements.json`)
  ]);

  const ores = buildOres(rawOres.ores);
  const weapons = buildWeapons(rawWeapons.weapons);
  const races = buildRaces(rawRaces.races);
  const runes = buildRunes(rawRunes.runes);
  const achievements = buildAchievements(rawAchievements.achievements);

  const data = ({
    ores,
    weapons,
    races,
    runes,
    achievements,
    weapon_types: rawWeapons.types ?? [],
    race_bonus_types: rawWeapons.race_bonus_types ?? [],
    select_ore: rawOres.select_ore ?? SELECT_ORE,
    none_label: rawRunes.none ?? NONE_LABEL,
    constants: {
      selectOreLabel: rawOres.select_ore ?? SELECT_ORE,
      noneLabel: rawRunes.none ?? NONE_LABEL
    }
  });

  buildIndexes(data);
  validateData(data);

  return data;
}