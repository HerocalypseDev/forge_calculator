(function (mw) {
  'use strict';

  if (!mw || !mw.config || !document.getElementById) {
    return;
  }
  if (window.FC_CALCULATOR_LOADED) {
    return;
  }
  window.FC_CALCULATOR_LOADED = true;

  var NONE_LABEL = 'None';
  var SELECT_ORE = 'Select Ore';

  var SHARE_GATE = 0.10;
  var RAMP_TOP = 0.30;
  var RAMP_SPAN = RAMP_TOP - SHARE_GATE;

  var FORGE_MULT = {
    0: 1.0, 1: 1.05, 2: 1.1, 3: 1.15, 4: 1.2,
    5: 1.25, 6: 1.3, 7: 1.35, 8: 1.4, 9: 1.5
  };

  var RACE_LETHALITY = {
    'Archangel': 0.20,
    'Demon': 0.20,
    'Orc': 0.10,
    'Shadow': 0.05,
    'Dragonborn': 0.12,
    'Orc Lord': 0.40
  };

  var CLASS_LETHALITY = {
    'Felynx,Gauntlet': 0.20,
    'Felynx,Gauntlets': 0.20,
    'Vampire,Straight Sword': 0.10
  };

  var RACE_ATK_SPEED = {
    'Shadow': 0.10,
    'Demon': 0.20,
    'Archangel': 0.20
  };

  var CLASS_ATK_SPEED = {
    'Goblin,Dagger': 0.10,
    'Golem,Colossal Sword': 0.15,
    'Golem,Great Axe': 0.15,
    'Felynx,Gauntlet': 0.20,
    'Felynx,Gauntlets': 0.20
  };

  var UNCAPPED_RACE_LETHALITY = { 'Kitsune': 0.20 };
  var UNCAPPED_CLASS_LETHALITY = { 'Fairy,Spear': 0.15 };
  var UNCAPPED_RACE_ATK_SPEED = { 'Kitsune': 0.20 };
  var UNCAPPED_CLASS_ATK_SPEED = { 'Fairy,Spear': 0.15 };
  var UNCAPPED_RACE_CRIT_DMG = { 'Kitsune': 0.15 };
  var DRYAD_GROVE_CRIT_CHANCE = 0.15;
  var DRYAD_GROVE_CRIT_DMG = 0.15;
  var DRYAD_VITAL_POWER_STEP_HP = 1000;
  var DRYAD_VITAL_POWER_PER_STEP = 0.05;
  var DRYAD_VITAL_POWER_MAX_STEPS = 10;
  var ORC_LORD_WARBRINGER_PER_TENTH = 0.075;
  var ORC_LORD_LORD_OF_WAR_PER_STACK = 0.075;
  var ORC_LORD_LORD_OF_WAR_MAX_STACKS = 5;

  var RACE_FIRE_DMG = { 'Dragonborn': 0.30, 'Demon': 0.20 };
  var RACE_FIRE_CHANCE = { 'Dragonborn': 0.40 };
  var RACE_FIRE_TIME = { 'Dragonborn': 3, 'Demon': 3 };

  var RACE_SMITE_DMG = { 'Angel': 0.30 };
  var RACE_SMITE_CHANCE = { 'Angel': 0.50 };

  var RACE_BERSERK = { 'Minotaur': 0.30 };

  var RACE_SMASH_DMG = { 'Orc Lord': 1.0 };
  var RACE_SMASH_COOLDOWN = { 'Orc Lord': 10.0 };
  var RACE_SMASH_CHANCE = { 'Orc Lord': 0.25 };

  var RACE_FOX_CLAWS_DMG = { 'Kitsune': 0.75 };
  var RACE_FOX_CLAWS_CHANCE = { 'Kitsune': 0.25 };
  var FOX_CLAWS_SPIRITS = 3;
  var FOX_CLAWS_SPIRIT_TIME = 2.22;

  var RACE_FOXFIRE_DMG = { 'Kitsune': 0.3 };
  var RACE_FOXFIRE_CHANCE = { 'Kitsune': 0.5 };
  var RACE_FOXFIRE_TIME = { 'Kitsune': 3.0 };

  var ARCHANGEL_SMITE_DMG = 1.5;
  var ARCHANGEL_SMITE_CHANCE = 0.33;
  var ARCHANGEL_SMITE_COOLDOWN = 10.0;
  var DEMON_CURSED_AURA_DMG = 0.1;

  var EXPLOSION_DMG_CAP = 2.5;
  var SMITE_DMG_CAP = 2.5;
  var MOON_CAP = 1.5;
  var FIRE_TIME_RANGE = [1.0, 5.0];
  var POISON_TIME_RANGE = [1.0, 15.0];
  var DEFAULT_LIGHTNING_COOLDOWN = 10.0;
  var BLACKHOLE_CHANCE = 0.3;
  var BLACKHOLE_COOLDOWN = 1.0;
  var GALAXITE_BISMUTH_WAVE = 1.25;
  var PROC_ROLL_SIDES = 101;
  var GOLEMITE_MIN_LEVEL = 13;
  var GOLEMITE_MAX_LEVEL = 25;
  var GOLEMITE_BASE_DMG = 0.02;
  var GOLEMITE_DMG_RAMP = 0.04;
  var GOLEMITE_RAMP_LEVELS = 12;
  var GOLEMITE_HITS_PER_SECOND = 0.66666666666666;
  var GOLEMITE_RARITY_ORDER = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic', 'Relic', 'Exotic', 'Divine'];
  var GOLEMITE_TRAIT_SCALING = {
    Common: 0.06,
    Uncommon: 0.08,
    Rare: 0.12,
    Epic: 0.15,
    Legendary: 0.18,
    Mythic: 0.23,
    Relic: 0.25,
    Exotic: 0.28,
    Divine: 0.30
  };
  var GOLEMITE_FIELDS = [
    'level', 'fire_dmg', 'fire_chance', 'fire_time', 'poison_dmg', 'poison_chance', 'poison_time',
    'lightning_dmg', 'lightning_chance', 'lightning_cooldown', 'blast_dmg', 'blast_chance',
    'smite_dmg', 'smite_chance', 'blackhole_dmg', 'blackhole_chance', 'resonance_dmg', 'moon',
    'lethality', 'crit_chance', 'crit_dmg', 'atk_speed'
  ];

  var AVG_POWER_EXCLUDED = ['Fichilliumorite', 'Bismuth'];
  var SOLO_ORE_POWER = { 'Bismuth': 8.0, 'Fichilliumorite': 1.0 };

  var CAPS = {
    lethality: 3.0,
    crit_chance: 1.0,
    crit_dmg: 1.0,
    atk_speed: 1.5,
    berserk: 2.0
  };

  var TRAIT_POWER_SLOPE = 4.5;
  var TRAIT_POWER_FLOOR = 0.1;

  var CAP_CLASS = 'fc-is-capped';

  var CORE_STATS = ['lethality', 'crit_chance', 'crit_dmg', 'atk_speed'];

  var EXPECTED_COUNTS = {
    ores: 149,
    weapons: 89,
    races: 20,
    runes: 46,
    achievements: 16
  };

  function shareScaling(base, max, share, divisor, rng) {
    if (divisor === undefined) { divisor = 100; }
    var gated = !(rng && rng.gated === false);
    if (gated && share < SHARE_GATE) { return 0.0; }
    var value = base + (max - base) * Math.min((share - SHARE_GATE) / RAMP_SPAN, 1.0);
    value = value / divisor;
    if (rng && typeof rng.ceiling === 'number') { value = Math.min(rng.ceiling, value); }
    if (rng && typeof rng.floor === 'number') { value = Math.max(rng.floor, value); }
    return value;
  }

  function scaleRange(rng, share) {
    return shareScaling(rng.base, rng.max, share, rng.divisor, rng);
  }

  function slotShares(slots) {
    var total = 0;
    for (var i = 0; i < slots.length; i++) { total += slots[i].amount; }
    if (total === 0) { return slots.map(function () { return 0.0; }); }
    return slots.map(function (s) { return s.amount / total; });
  }

  function slotPower(slot, game) {
    if (slot.name === game.select_ore) { return 1.0; }
    var ore = game._ore_index.get(slot.name);
    return (ore && typeof ore.multiplier === 'number') ? ore.multiplier : 1.0;
  }

  function filledSlotNames(slots, game) {
    var names = [];
    for (var i = 0; i < slots.length; i++) {
      if (slots[i].name && slots[i].name !== game.select_ore) { names.push(slots[i].name); }
    }
    return names;
  }

  function soloOrePower(slots, game) {
    var filled = filledSlotNames(slots, game);
    if (!filled.length) { return null; }
    for (var name in SOLO_ORE_POWER) {
      var allSame = true;
      for (var i = 0; i < filled.length; i++) { if (filled[i] !== name) { allSame = false; } }
      if (allSame) { return SOLO_ORE_POWER[name]; }
    }
    return null;
  }

  function avgOrePower(slots, game) {
    var solo = soloOrePower(slots, game);
    if (solo !== null) { return solo; }
    var powers = [];
    var amounts = [];
    for (var i = 0; i < slots.length; i++) {
      var slot = slots[i];
      if (!slot.name || slot.name === game.select_ore || AVG_POWER_EXCLUDED.indexOf(slot.name) !== -1) { continue; }
      powers.push(slotPower(slot, game));
      amounts.push(slot.amount);
    }
    var total = 0;
    for (var j = 0; j < amounts.length; j++) { total += amounts[j]; }
    if (total !== 0) {
      var weighted = 0;
      for (var k = 0; k < powers.length; k++) { weighted += amounts[k] * powers[k]; }
      return weighted / total;
    }
    if (powers.length) {
      var sum = 0;
      for (var m = 0; m < powers.length; m++) { sum += powers[m]; }
      return sum / powers.length;
    }
    return 1.0;
  }

  function forgeMultiplier(level) {
    return FORGE_MULT[level] !== undefined ? FORGE_MULT[level] : 1.0;
  }

  function weaponBases(weapon, avgPower, quality, forgeLevel) {
    if (!weapon) { return [1.0, 1.0]; }
    var base = weapon.damage * avgPower * (1 + quality / 100.0);
    return [base, base * forgeMultiplier(forgeLevel)];
  }

  function attackRate(weapon, atkSpeedTotal) {
    var interval = (weapon && typeof weapon.interval === 'number') ? weapon.interval : 1.0;
    return (1 + atkSpeedTotal) / interval;
  }

  function critBlend(ccTotal, cdTotal) {
    var cc = Math.min(ccTotal, 1.0);
    return cc * cdTotal + (1 - cc);
  }

  var STAT_PATTERNS = [
    ['lethality', ['Damage Boost', 'Lethality']],
    ['crit_chance', ['Crit Chance']],
    ['crit_dmg', ['Crit DMG']],
    ['atk_speed', ['Attack Speed', 'Atk Speed']]
  ];

  function extractValue(text) {
    var idx = text.indexOf('+');
    if (idx < 0) { return null; }
    var rest = text.slice(idx + 1);
    if (!rest) { return null; }
    var numStr = rest.slice(0, -1).trim();
    var val = parseFloat(numStr);
    return isNaN(val) ? null : val;
  }

  function parseTrait(text) {
    if (!text) { return null; }
    var stripped = String(text).trim();
    if (!stripped || stripped.toLowerCase() === 'none') { return null; }
    var raw = extractValue(stripped);
    if (raw === null) { return null; }
    var low = stripped.toLowerCase();
    for (var i = 0; i < STAT_PATTERNS.length; i++) {
      var stat = STAT_PATTERNS[i][0];
      var keys = STAT_PATTERNS[i][1];
      for (var j = 0; j < keys.length; j++) {
        if (low.indexOf(keys[j].toLowerCase()) !== -1) {
          return { stat: stat, value: raw / 100.0 };
        }
      }
    }
    return null;
  }


  var TRAIT_STAT_DISPLAY = {
    lethality: { name: 'Lethality', group: 'simple', agg: 'sum' },
    crit_chance: { name: 'Crit Chance', group: 'simple', agg: 'sum' },
    crit_dmg: { name: 'Crit DMG', group: 'simple', agg: 'sum' },
    atk_speed: { name: 'Attack Speed', group: 'simple', agg: 'sum' },
    moon: { name: 'Moonboost', group: 'simple', agg: 'sum' },
    phys_dmg: { name: 'Physical DMG', group: 'berserk', agg: 'sum' },
    move_speed: { name: 'Movement Speed', group: 'berserk', agg: 'sum' },
    berserk_duration: { name: 'Berserk Duration', group: 'berserk', agg: 'max' },
    fire_dmg: { name: 'Fire DMG/s', group: 'fire', agg: 'sum' },
    fire_chance: { name: 'Fire Chance', group: 'fire', agg: 'max' },
    fire_duration: { name: 'Fire Duration', group: 'fire', agg: 'max' },
    explosion_dmg: { name: 'Explosion DMG', group: 'explosion', agg: 'sum' },
    explosion_chance: { name: 'Explosion Chance', group: 'explosion', agg: 'max' },
    poison_dmg: { name: 'Poison DMG/s', group: 'poison', agg: 'sum' },
    poison_chance: { name: 'Poison Chance', group: 'poison', agg: 'max' },
    poison_duration: { name: 'Poison Duration', group: 'poison', agg: 'max' },
    smite_dmg: { name: 'Smite DMG', group: 'smite', agg: 'sum' },
    smite_chance: { name: 'Smite Chance', group: 'smite', agg: 'max' },
    lightning_dmg: { name: 'Lightning DMG', group: 'lightning', agg: 'sum' },
    lightning_chance: { name: 'Lightning Chance', group: 'lightning', agg: 'max' },
    lightning_cooldown: { name: 'Lightning Cooldown', group: 'lightning', agg: 'min' },
    blackhole_dmg: { name: 'Black Hole DMG', group: 'blackhole', agg: 'sum' },
    blackhole_chance: { name: 'Black Hole Chance', group: 'blackhole', agg: 'max' },
    blackhole_radius: { name: 'Black Hole Radius', group: 'blackhole', agg: 'sum' }
  };

  var TRAIT_CLAIM_PATTERNS = {
    lethality: /Lethality/i,
    crit_chance: /Crit(?:ical)?\s*Chance/i,
    crit_dmg: /Crit(?:ical)?\s*Dam(?:age)?/i,
    atk_speed: /(?:Attack|Atk)\s*Speed/i,
    moon: /Moonboost/i,
    phys_dmg: /Physical\s*Damage/i,
    move_speed: /Movement\s*Speed.*(?:for\s*[\d.]+\s*s|HP\s*drops|below\s*35%|when\s*HP)/i,
    berserk_duration: /HP\s*drops\s*below|when\s*HP/i,
    fire_dmg: /fire|burn/i,
    fire_chance: /fire|burn/i,
    fire_duration: /fire|burn/i,
    explosion_dmg: /Explosion/i,
    explosion_chance: /Explosion/i,
    smite_dmg: /smite/i,
    smite_chance: /smite/i,
    poison_dmg: /poison/i,
    poison_chance: /poison/i,
    poison_duration: /poison/i,
    lightning_dmg: /chance\s*to\s*deal/i,
    lightning_chance: /chance\s*to\s*deal/i,
    lightning_cooldown: /chance\s*to\s*deal|cooldown/i,
    blackhole_dmg: /Black\s*Hole\s*Damage/i,
    blackhole_chance: /Black\s*Hole\s*Chance/i,
    blackhole_radius: /Black\s*Hole\s*Radius/i
  };

  var TRAIT_GROUP_ORDER = ['simple', 'berserk', 'fire', 'explosion', 'poison', 'smite', 'lightning', 'blackhole'];

  var TRAIT_GROUP_KEYS = {
    simple: ['lethality', 'crit_chance', 'crit_dmg', 'atk_speed', 'moon'],
    berserk: ['phys_dmg', 'move_speed', 'berserk_duration'],
    fire: ['fire_dmg', 'fire_chance', 'fire_duration'],
    explosion: ['explosion_dmg', 'explosion_chance'],
    poison: ['poison_dmg', 'poison_chance', 'poison_duration'],
    smite: ['smite_dmg', 'smite_chance'],
    lightning: ['lightning_dmg', 'lightning_chance', 'lightning_cooldown'],
    blackhole: ['blackhole_dmg', 'blackhole_chance', 'blackhole_radius']
  };

  function isTraitClaimed(sub, ore) {
    if (!ore.stats) return false;
    var keys = Object.keys(ore.stats);
    for (var i = 0; i < keys.length; i++) {
      var pat = TRAIT_CLAIM_PATTERNS[keys[i]];
      if (pat && pat.test(sub)) return true;
    }
    return false;
  }

  function fmtPct(val) {
    var pct = val * 100;
    var sign = pct < -0.005 ? '-' : '+';
    var str = Math.abs(pct).toFixed(1);
    if (str.slice(-2) === '.0') str = str.slice(0, -2);
    return sign + str + '%';
  }

  function fmtDur(val) {
    var str = val.toFixed(1);
    if (str.slice(-2) === '.0') str = str.slice(0, -2);
    return str + 's';
  }

  function aggStat(agg, a, b) {
    if (agg === 'max') return Math.max(a, b);
    if (agg === 'min') return Math.min(a, b);
    return a + b;
  }

  function formatTraitGroup(group, merged) {
    var keys = TRAIT_GROUP_KEYS[group];
    if (!keys) return '';
    var vals = {};
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (merged[k] !== undefined && merged[k] !== 0) vals[k] = merged[k];
    }
    if (Object.keys(vals).length === 0) return '';
    var info = TRAIT_STAT_DISPLAY;

    if (group === 'simple') {
      var parts = [];
      for (var j = 0; j < keys.length; j++) {
        var sk = keys[j];
        if (vals[sk] !== undefined) {
          parts.push(fmtPct(vals[sk]) + ' ' + info[sk].name);
        }
      }
      return parts.join('\n');
    }

    if (group === 'berserk') {
      var pd = vals.phys_dmg || 0;
      var ms = vals.move_speed || 0;
      var bd = vals.berserk_duration !== undefined ? vals.berserk_duration : 0;
      return fmtPct(pd) + ' Physical DMG & ' + fmtPct(ms) + ' Movement Speed for ' + fmtDur(bd) + ' (when HP < 35%)';
    }

    if (group === 'fire') {
      var fd = vals.fire_dmg || 0;
      var fc = vals.fire_chance !== undefined ? vals.fire_chance : 0;
      var fdt = vals.fire_duration !== undefined ? vals.fire_duration : 0;
      return fmtPct(fd) + ' Fire DMG/s for ' + fmtDur(fdt) + ' (' + fmtPct(fc) + ' chance on hit)';
    }

    if (group === 'explosion') {
      var ed = vals.explosion_dmg || 0;
      var ec = vals.explosion_chance !== undefined ? vals.explosion_chance : 0;
      return fmtPct(ed) + ' Explosion DMG (' + fmtPct(ec) + ' chance)';
    }

    if (group === 'poison') {
      var pd2 = vals.poison_dmg || 0;
      var pc = vals.poison_chance !== undefined ? vals.poison_chance : 0;
      var pdt = vals.poison_duration !== undefined ? vals.poison_duration : 0;
      return fmtPct(pd2) + ' Poison DMG/s for ' + fmtDur(pdt) + ' (' + fmtPct(pc) + ' chance on hit)';
    }

    if (group === 'smite') {
      var sd = vals.smite_dmg || 0;
      var sc = vals.smite_chance !== undefined ? vals.smite_chance : 0;
      return fmtPct(sd) + ' Smite DMG (' + fmtPct(sc) + ' chance on hit)';
    }

    if (group === 'lightning') {
      var ld = vals.lightning_dmg || 0;
      var lc = vals.lightning_chance !== undefined ? vals.lightning_chance : 0;
      var lco = vals.lightning_cooldown !== undefined ? vals.lightning_cooldown : 0;
      return fmtPct(ld) + ' Lightning DMG (' + fmtPct(lc) + ' chance, ' + fmtDur(lco) + ' cooldown)';
    }

    if (group === 'blackhole') {
      var bd2 = vals.blackhole_dmg || 0;
      var bc = vals.blackhole_chance !== undefined ? vals.blackhole_chance : 0;
      var br = vals.blackhole_radius || 0;
      return fmtPct(bd2) + ' Black Hole DMG (' + fmtPct(bc) + ' chance, ' + fmtPct(br) + ' radius)';
    }

    return '';
  }

  var TRAIT_PREFIX_RE = /^(Both|Armor\s*only|Weapons\s*only|\(Armor\s*only\))\s*:\s*/i;
  var PERCENT_CLAUSE_RE = /^([+-]?\d+(?:\.\d+)?)\s*%\s*(.+)$/;

  function splitTraitClauses(text) {
    if (!text) { return []; }
    var cleaned = text.replace(/\n/g, ' | ');
    var subs = cleaned.split(/\s*\|\s*/);
    var out = [];
    for (var i = 0; i < subs.length; i++) {
      var sub = subs[i].replace(TRAIT_PREFIX_RE, '').trim();
      if (sub) { out.push(sub); }
    }
    return out;
  }

  function parsePercentClause(clause) {
    var m = PERCENT_CLAUSE_RE.exec(clause);
    if (!m) { return null; }
    return { value: parseFloat(m[1]), rawLabel: m[2].trim(), label: m[2].trim().toLowerCase() };
  }

  function activeTraits(build, shares, game) {
    var merged = {};
    var extras = [];

    for (var i = 0; i < build.slots.length; i++) {
      var slot = build.slots[i];
      var share = shares[i];
      if (slot.name === game.select_ore || share < SHARE_GATE) continue;
      var ore = game._ore_index.get(slot.name);
      if (!ore || !ore.is_weapon) continue;

      if (ore.stats) {
        var statKeys = Object.keys(ore.stats);
        for (var j = 0; j < statKeys.length; j++) {
          var sk = statKeys[j];
          var info = TRAIT_STAT_DISPLAY[sk];
          if (!info) continue;
          var rng = ore.stats[sk];
          var val = scaleRange(rng, share);
          if (merged[sk] === undefined) {
            merged[sk] = val;
          } else {
            merged[sk] = aggStat(info.agg, merged[sk], val);
          }
        }
      }

      var subs10 = splitTraitClauses(ore.trait10);
      var subs30 = splitTraitClauses(ore.trait30);
      var subs = share >= 0.3 ? subs30 : subs10;
      if (!subs.length) continue;

      for (var k = 0; k < subs.length; k++) {
        var sub = subs[k];
        if (isTraitClaimed(sub, ore)) continue;

        if (share < 0.3) {
          // Most ores phrase every "|"-separated clause identically between
          // trait10 and trait30 (same wording, just bigger numbers), scaling
          // by the same base-at-10%-share -> max-at-30%-share ramp every
          // formula-backed stat uses. When this clause and its same-position
          // trait30 counterpart are both a plain "+X% Label", compute the
          // real ramped value instead of guessing at one -- same principle as
          // the berserk-group traits, just done generically at display time
          // instead of needing a named stat slot per trait. Anything that
          // doesn't cleanly pair (a different label, a second embedded
          // number, no matching clause at all) falls back to the original
          // "[X% power]" approximation unchanged.
          var parsed10 = parsePercentClause(sub);
          var parsed30 = subs30[k] !== undefined ? parsePercentClause(subs30[k]) : null;
          if (parsed10 && parsed30 && parsed10.label === parsed30.label) {
            var ramped = scaleRange({ base: parsed10.value, max: parsed30.value, divisor: 100 }, share);
            extras.push(fmtPct(ramped) + ' ' + parsed10.rawLabel);
          } else {
            var power = Math.min(
              Math.max((share - SHARE_GATE) * TRAIT_POWER_SLOPE + TRAIT_POWER_FLOOR, TRAIT_POWER_FLOOR),
              1.0
            );
            extras.push('[' + (power * 100).toFixed(1) + '% power] ' + sub);
          }
        } else {
          extras.push(sub);
        }
      }
    }

    var parts = [];
    for (var g = 0; g < TRAIT_GROUP_ORDER.length; g++) {
      var group = TRAIT_GROUP_ORDER[g];
      var fmt = formatTraitGroup(group, merged);
      if (fmt) parts.push(fmt);
    }

    for (var e = 0; e < extras.length; e++) {
      parts.push(extras[e]);
    }

    return parts.length ? parts.join('\n') : 'No active weapon traits';
  }

  function oreStatSum(slots, shares, game, stat) {
    var total = 0.0;
    for (var i = 0; i < slots.length; i++) {
      var slot = slots[i];
      var share = shares[i];
      if (slot.name === game.select_ore) { continue; }
      var ore = game._ore_index.get(slot.name);
      if (!ore) { continue; }
      var rng = ore.stats[stat];
      if (!rng) { continue; }
      if (rng.gated !== false && share < SHARE_GATE) { continue; }
      total += scaleRange(rng, share);
    }
    return total;
  }

  function runeTotals(runeCells) {
    var totals = { lethality: 0.0, crit_chance: 0.0, crit_dmg: 0.0, atk_speed: 0.0 };
    for (var i = 0; i < runeCells.length; i++) {
      var parsed = parseTrait(runeCells[i]);
      if (parsed) { totals[parsed.stat] += parsed.value; }
    }
    return totals;
  }

  function raceValue(table, race) {
    return table[race] !== undefined ? table[race] : 0.0;
  }

  function oreShare(slots, shares, name) {
    var total = 0.0;
    for (var i = 0; i < slots.length; i++) { if (slots[i].name === name) { total += shares[i]; } }
    return total;
  }

  function roundHalfUp(value, digits) {
    var scale = Math.pow(10, digits);
    return Math.floor(Math.abs(value) * scale + 0.5) / scale * (value >= 0 ? 1 : -1);
  }

  function gameChance(chance, exists) {
    if (!exists) { return 0.0; }
    return Math.min(1.0, (Math.floor(roundHalfUp(chance * 100, 2)) + 1) / PROC_ROLL_SIDES);
  }

  function golemiteValues(build, field) {
    return build.golemites.map(function (g) { return g[field]; });
  }

  function golemiteSum(build, field) {
    return golemiteValues(build, field).reduce(function (a, b) { return a + b; }, 0.0);
  }

  function golemiteDamage(level, unforged) {
    if (level < GOLEMITE_MIN_LEVEL) { return 0.0; }
    var steps = Math.min(GOLEMITE_MAX_LEVEL, level) - GOLEMITE_MIN_LEVEL;
    return unforged * (GOLEMITE_BASE_DMG + steps * (GOLEMITE_DMG_RAMP / GOLEMITE_RAMP_LEVELS));
  }

  function golemiteRarity(slots, game) {
    var rarities = game.ore_rarity || {};
    var best = -1;
    for (var i = 0; i < slots.length; i++) {
      var slot = slots[i];
      if (!(slot.amount > 0) || slot.name === game.select_ore) { continue; }
      var rank = GOLEMITE_RARITY_ORDER.indexOf(rarities[slot.name]);
      if (rank > best) { best = rank; }
    }
    return best < 0 ? null : GOLEMITE_RARITY_ORDER[best];
  }

  function oreAmount(slots, name) {
    var total = 0.0;
    for (var i = 0; i < slots.length; i++) { if (slots[i].name === name) { total += slots[i].amount; } }
    return total;
  }

  function deriveGolemiteStats(rawSlots, game) {
    var slots = (rawSlots || []).map(function (s) { return { name: s.name, amount: Math.max(0, Number(s.amount) || 0) }; });
    var stats = {};
    GOLEMITE_FIELDS.forEach(function (f) { if (f !== 'level') { stats[f] = 0.0; } });
    var rarity = golemiteRarity(slots, game);
    if (!rarity) { return { rarity: null, scaling: 0.0, stats: stats }; }
    var k = GOLEMITE_TRAIT_SCALING[rarity];
    var shares = slotShares(slots);
    var hasGalaxite = oreAmount(slots, 'Galaxite') > 0;
    var cooldowns = slotVals(slots, shares, game, 'lightning_cooldown');

    stats.lethality = oreStatSum(slots, shares, game, 'lethality') * k;
    stats.crit_chance = oreStatSum(slots, shares, game, 'crit_chance') * k;
    stats.crit_dmg = oreStatSum(slots, shares, game, 'crit_dmg') * k;
    stats.atk_speed = oreStatSum(slots, shares, game, 'atk_speed') * k;
    stats.fire_dmg = slotSum(slots, shares, game, 'fire_dmg') * k;
    stats.fire_chance = slotMax(slots, shares, game, 'fire_chance') * k;
    stats.fire_time = slotMax(slots, shares, game, 'fire_duration');
    stats.poison_dmg = slotSum(slots, shares, game, 'poison_dmg') * k;
    stats.poison_chance = slotMax(slots, shares, game, 'poison_chance') * k;
    stats.poison_time = slotMax(slots, shares, game, 'poison_duration');
    stats.lightning_dmg = slotSum(slots, shares, game, 'lightning_dmg') * k;
    stats.lightning_chance = slotMax(slots, shares, game, 'lightning_chance') * k;
    stats.lightning_cooldown = cooldowns.length ? Math.min.apply(null, cooldowns) : 0.0;
    stats.blast_dmg = Math.min(EXPLOSION_DMG_CAP, slotSum(slots, shares, game, 'explosion_dmg')) * k;
    stats.blast_chance = slotMax(slots, shares, game, 'explosion_chance') * k;
    stats.smite_dmg = Math.min(SMITE_DMG_CAP, slotSum(slots, shares, game, 'smite_dmg')) * k;
    stats.smite_chance = slotMax(slots, shares, game, 'smite_chance') * k;
    stats.blackhole_dmg = slotSum(slots, shares, game, 'blackhole_dmg') * k;
    stats.blackhole_chance = hasGalaxite ? BLACKHOLE_CHANCE * k : 0.0;
    stats.resonance_dmg = hasGalaxite && oreAmount(slots, 'Bismuth') > 0 ? GALAXITE_BISMUTH_WAVE * k : 0.0;
    stats.moon = Math.min(MOON_CAP, slotSum(slots, shares, game, 'moon')) * k;
    return { rarity: rarity, scaling: k, stats: stats };
  }

  function traitDamageMultiplier(build) {
    if (build.race !== 'Dryad') { return 1.0; }
    var steps = Math.min(Math.floor(Math.max(0, build.dryad_max_hp) / DRYAD_VITAL_POWER_STEP_HP), DRYAD_VITAL_POWER_MAX_STEPS);
    return 1.0 + steps * DRYAD_VITAL_POWER_PER_STEP;
  }

  function statTotals(build, game, oreContribs) {
    var runes = runeTotals(build.rune_cells);
    var ach = parseTrait(build.achievement);
    var achStat = ach ? ach.stat : null;
    var achValue = ach ? ach.value : 0.0;
    var race = build.race;
    var cls = build.race + ',' + build.bonus_weapon_type;
    var inGrove = race === 'Dryad' && build.dryad_in_grove;

    var lethality = oreContribs.lethality
      + build.armor_lethality
      + golemiteSum(build, 'lethality')
      + runes.lethality
      + build.base_lethality
      + raceValue(RACE_LETHALITY, race)
      + raceValue(CLASS_LETHALITY, cls)
      + (achStat === 'lethality' ? achValue : 0.0);
    var warbringer = 0.0;
    if (race === 'Orc Lord') {
      var missing = Math.min(1.0, Math.max(0.0, build.orc_lord_hp_missing));
      warbringer = Math.floor(missing * 10 + 1e-6) * ORC_LORD_WARBRINGER_PER_TENTH;
    }

    var crit_chance = oreContribs.crit_chance
      + build.armor_crit_chance
      + golemiteSum(build, 'crit_chance')
      + runes.crit_chance
      + (achStat === 'crit_chance' ? achValue : 0.0);

    var crit_dmg = oreContribs.crit_dmg + build.armor_crit_dmg + golemiteSum(build, 'crit_dmg') + runes.crit_dmg;

    var atk_speed = oreContribs.atk_speed
      + golemiteSum(build, 'atk_speed')
      + runes.atk_speed
      + raceValue(RACE_ATK_SPEED, race)
      + raceValue(CLASS_ATK_SPEED, cls)
      + (achStat === 'atk_speed' ? achValue : 0.0);
    var lordOfWar = 0.0;
    if (race === 'Orc Lord') {
      var stacks = Math.min(ORC_LORD_LORD_OF_WAR_MAX_STACKS, Math.max(0, Math.floor(build.orc_lord_kill_stacks)));
      lordOfWar = stacks * ORC_LORD_LORD_OF_WAR_PER_STACK;
    }

    return {
      lethality: Math.min(lethality, CAPS.lethality)
        + raceValue(UNCAPPED_RACE_LETHALITY, race)
        + raceValue(UNCAPPED_CLASS_LETHALITY, cls)
        + warbringer,
      crit_chance: Math.min(crit_chance, CAPS.crit_chance) + (inGrove ? DRYAD_GROVE_CRIT_CHANCE : 0.0),
      crit_dmg: Math.min(crit_dmg, CAPS.crit_dmg)
        + raceValue(UNCAPPED_RACE_CRIT_DMG, race)
        + (inGrove ? DRYAD_GROVE_CRIT_DMG : 0.0),
      atk_speed: Math.min(atk_speed, CAPS.atk_speed)
        + raceValue(UNCAPPED_RACE_ATK_SPEED, race)
        + raceValue(UNCAPPED_CLASS_ATK_SPEED, cls)
        + lordOfWar
    };
  }

  function calcOreContributions(slots, shares, game) {
    var contribs = {};
    for (var i = 0; i < CORE_STATS.length; i++) {
      contribs[CORE_STATS[i]] = oreStatSum(slots, shares, game, CORE_STATS[i]);
    }
    return contribs;
  }

  function slotVals(slots, shares, game, stat) {
    var vals = [];
    for (var i = 0; i < slots.length; i++) {
      var slot = slots[i];
      var share = shares[i];
      if (slot.name === game.select_ore) { continue; }
      var ore = game._ore_index.get(slot.name);
      if (!ore) { continue; }
      var rng = ore.stats[stat];
      if (!rng) { continue; }
      if (rng.gated !== false && share < SHARE_GATE) { continue; }
      vals.push(scaleRange(rng, share));
    }
    return vals;
  }

  function maxOf(vals) {
    var m = 0.0;
    for (var i = 0; i < vals.length; i++) { if (vals[i] > m) { m = vals[i]; } }
    return m;
  }

  function slotMax(slots, shares, game, stat) {
    return maxOf(slotVals(slots, shares, game, stat));
  }

  function slotSum(slots, shares, game, stat) {
    var vals = slotVals(slots, shares, game, stat);
    var total = 0.0;
    for (var i = 0; i < vals.length; i++) { total += vals[i]; }
    return total;
  }

  function dotDuration(dmg, terms, range) {
    if (dmg <= 0) { return 0.0; }
    return Math.min(range[1], Math.max(range[0], maxOf(terms)));
  }

  function procComponents(build, shares, game) {
    var ab = build.abilities;
    var race = build.race;
    var names = build.slots.map(function (s) { return s.name; });
    var golemiteBlackholeSource = golemiteValues(build, 'blackhole_dmg').some(function (v) { return v > 0; });
    var resonance = 0.0;
    if (names.indexOf('Galaxite') !== -1 || golemiteBlackholeSource) {
      resonance = golemiteSum(build, 'resonance_dmg') + (names.indexOf('Bismuth') !== -1 ? GALAXITE_BISMUTH_WAVE : 0.0);
    }
    var galaxiteAmount = 0.0;
    build.slots.forEach(function (s) { if (s.name === 'Galaxite') { galaxiteAmount += s.amount; } });

    var fireDmg = slotSum(build.slots, shares, game, 'fire_dmg') + raceValue(RACE_FIRE_DMG, race) + ab.fire_dmg
      + golemiteSum(build, 'fire_dmg');
    var poisonDmg = slotSum(build.slots, shares, game, 'poison_dmg') + ab.poison_dmg + golemiteSum(build, 'poison_dmg');
    var lightningDmg = slotSum(build.slots, shares, game, 'lightning_dmg') + ab.lightning_dmg
      + golemiteSum(build, 'lightning_dmg');
    var cooldowns = slotVals(build.slots, shares, game, 'lightning_cooldown');
    if (ab.lightning_cooldown) { cooldowns.push(ab.lightning_cooldown); }
    var golemiteCooldowns = golemiteValues(build, 'lightning_cooldown').filter(function (cd) { return cd; });
    var lightningCooldown = 0.0;
    if (lightningDmg > 0) {
      lightningCooldown = cooldowns.length
        ? Math.min.apply(null, cooldowns.concat(golemiteCooldowns))
        : DEFAULT_LIGHTNING_COOLDOWN;
    }

    return {
      moon: Math.min(MOON_CAP, slotSum(build.slots, shares, game, 'moon')) + golemiteSum(build, 'moon'),
      explosion_dmg: Math.min(EXPLOSION_DMG_CAP, slotSum(build.slots, shares, game, 'explosion_dmg') + ab.blast_dmg
        + golemiteSum(build, 'blast_dmg')),
      explosion_chance: Math.max.apply(null, [slotMax(build.slots, shares, game, 'explosion_chance'), ab.blast_chance]
        .concat(golemiteValues(build, 'blast_chance'))),
      fire_dmg: fireDmg,
      fire_chance: Math.max.apply(null, [slotMax(build.slots, shares, game, 'fire_chance'), ab.fire_chance,
        raceValue(RACE_FIRE_CHANCE, race)].concat(golemiteValues(build, 'fire_chance'))),
      fire_duration: dotDuration(fireDmg,
        slotVals(build.slots, shares, game, 'fire_duration').concat([raceValue(RACE_FIRE_TIME, race), ab.fire_time])
          .concat(golemiteValues(build, 'fire_time')),
        FIRE_TIME_RANGE),
      poison_dmg: poisonDmg,
      poison_chance: Math.max.apply(null, [slotMax(build.slots, shares, game, 'poison_chance'), ab.poison_chance]
        .concat(golemiteValues(build, 'poison_chance'))),
      poison_duration: dotDuration(poisonDmg,
        slotVals(build.slots, shares, game, 'poison_duration').concat([ab.poison_time])
          .concat(golemiteValues(build, 'poison_time')),
        POISON_TIME_RANGE),
      smite_dmg: Math.min(SMITE_DMG_CAP, slotSum(build.slots, shares, game, 'smite_dmg') + raceValue(RACE_SMITE_DMG, race))
        + golemiteSum(build, 'smite_dmg'),
      smite_chance: Math.max.apply(null, [slotMax(build.slots, shares, game, 'smite_chance'), raceValue(RACE_SMITE_CHANCE, race)]
        .concat(golemiteValues(build, 'smite_chance'))),
      blackhole_dmg: slotSum(build.slots, shares, game, 'blackhole_dmg') + resonance + golemiteSum(build, 'blackhole_dmg'),
      blackhole_chance: Math.max.apply(null, [galaxiteAmount > 0 ? BLACKHOLE_CHANCE : 0.0]
        .concat(golemiteValues(build, 'blackhole_chance'))),
      lightning_dmg: lightningDmg,
      lightning_chance: Math.max.apply(null, [slotMax(build.slots, shares, game, 'lightning_chance'), ab.lightning_chance]
        .concat(golemiteValues(build, 'lightning_chance'))),
      lightning_cooldown: lightningCooldown,
      smash_dmg: raceValue(RACE_SMASH_DMG, race),
      smash_cooldown: raceValue(RACE_SMASH_COOLDOWN, race),
      smash_chance: raceValue(RACE_SMASH_CHANCE, race),
      fox_claws_dmg: raceValue(RACE_FOX_CLAWS_DMG, race),
      fox_claws_chance: raceValue(RACE_FOX_CLAWS_CHANCE, race),
      foxfire_dmg: raceValue(RACE_FOXFIRE_DMG, race),
      foxfire_chance: raceValue(RACE_FOXFIRE_CHANCE, race),
      foxfire_duration: raceValue(RACE_FOXFIRE_TIME, race)
    };
  }

  function dotUptime(chance, atkRate, duration) {
    var load = chance * atkRate * duration;
    return Math.min(1.0, load / (1 + load / 2));
  }

  function cooldownRate(chance, atkRate, cooldown) {
    if (chance <= 0 || atkRate <= 0) { return 0.0; }
    return 1.0 / (cooldown + 1.0 / (chance * atkRate));
  }

  function num(v) {
    var n = Number(v);
    return n === n && n !== Infinity && n !== -Infinity ? n : 0;
  }

  function baseCritDmg(v) {
    if (v === null || v === undefined || v === '') { return 1.45; }
    var n = Number(v);
    return n === n && n !== Infinity && n !== -Infinity ? n : 1.45;
  }

  function normalizeBuild(build) {
    var b = build || {};
    var slots = b.slots ? b.slots.slice() : [];
    return {
      slots: slots.map(function (s) {
        return { name: String(s && s.name != null ? s.name : ''), amount: num(s && s.amount) };
      }),
      weapon_name: typeof b.weapon_name === 'string' ? b.weapon_name : '',
      quality: num(b.quality),
      forge_level: num(b.forge_level),
      race: typeof b.race === 'string' ? b.race : '',
      bonus_weapon_type: typeof b.bonus_weapon_type === 'string' ? b.bonus_weapon_type : '',
      rune_cells: b.rune_cells ? b.rune_cells.map(String) : [],
      base_crit_chance: num(b.base_crit_chance),
      base_crit_dmg: baseCritDmg(b.base_crit_dmg),
      armor_crit_chance: num(b.armor_crit_chance),
      armor_crit_dmg: num(b.armor_crit_dmg),
      armor_lethality: num(b.armor_lethality),
      base_lethality: num(b.base_lethality),
      abilities: {
        blast_dmg: num(b.abilities && b.abilities.blast_dmg),
        blast_chance: num(b.abilities && b.abilities.blast_chance),
        fire_dmg: num(b.abilities && b.abilities.fire_dmg),
        fire_chance: num(b.abilities && b.abilities.fire_chance),
        fire_time: num(b.abilities && b.abilities.fire_time),
        poison_dmg: num(b.abilities && b.abilities.poison_dmg),
        poison_chance: num(b.abilities && b.abilities.poison_chance),
        poison_time: num(b.abilities && b.abilities.poison_time),
        lightning_dmg: num(b.abilities && b.abilities.lightning_dmg),
        lightning_chance: num(b.abilities && b.abilities.lightning_chance),
        lightning_cooldown: num(b.abilities && b.abilities.lightning_cooldown)
      },
      berserk: num(b.berserk),
      achievement: typeof b.achievement === 'string' ? b.achievement : '',
      dryad_in_grove: b.dryad_in_grove === true,
      dryad_max_hp: num(b.dryad_max_hp),
      orc_lord_hp_missing: num(b.orc_lord_hp_missing),
      orc_lord_kill_stacks: num(b.orc_lord_kill_stacks),
      golemites: [0, 1].map(function (i) {
        var src = (b.golemites && b.golemites[i]) || {};
        var g = {};
        GOLEMITE_FIELDS.forEach(function (f) { g[f] = num(src[f]); });
        return g;
      })
    };
  }

  function calculate(build, game) {
    build = normalizeBuild(build);
    var shares = slotShares(build.slots);
    var avgPower = avgOrePower(build.slots, game);

    var weapon = game._weapon_index.get(build.weapon_name) || null;
    var bases = weaponBases(weapon, avgPower, build.quality, build.forge_level);
    var unforged = bases[0];
    var forged = bases[1];
    var interval = (weapon && typeof weapon.interval === 'number') ? weapon.interval : 1.0;

    var oreContribs = calcOreContributions(build.slots, shares, game);
    var totals = statTotals(build, game, oreContribs);
    var atkRate = attackRate(weapon, totals.atk_speed);

    var blend = critBlend(
      build.base_crit_chance + totals.crit_chance,
      build.base_crit_dmg + totals.crit_dmg
    );

    var procs = procComponents(build, shares, game);
    var tdm = traitDamageMultiplier(build);
    var race = build.race;

    var weapon_dps = forged * (1 + totals.lethality) * blend * atkRate;
    var explosion_dps = unforged * procs.explosion_dmg * gameChance(procs.explosion_chance, procs.explosion_dmg > 0) * atkRate;
    var fire_dps = atkRate && procs.fire_dmg > 0
      ? unforged * procs.fire_dmg * tdm * dotUptime(gameChance(procs.fire_chance, true), atkRate, procs.fire_duration)
      : 0.0;
    var poison_dps = atkRate && procs.poison_dmg > 0
      ? unforged * procs.poison_dmg * tdm * dotUptime(gameChance(procs.poison_chance, true), atkRate, procs.poison_duration)
      : 0.0;
    var smite_dps = unforged * atkRate * procs.smite_dmg * gameChance(procs.smite_chance, procs.smite_dmg > 0);
    var blackhole_dps = procs.blackhole_dmg > 0 && procs.blackhole_chance > 0
      ? unforged * procs.blackhole_dmg * tdm * cooldownRate(gameChance(procs.blackhole_chance, true), atkRate, BLACKHOLE_COOLDOWN)
      : 0.0;
    var lightning_dps = procs.lightning_dmg > 0
      ? unforged * procs.lightning_dmg * tdm * cooldownRate(gameChance(procs.lightning_chance, true), atkRate, procs.lightning_cooldown)
      : 0.0;
    var smash_dps = unforged * procs.smash_dmg * cooldownRate(procs.smash_chance, atkRate, procs.smash_cooldown);
    var fox_claws_dps = unforged * procs.fox_claws_dmg
      * Math.min(procs.fox_claws_chance * atkRate, FOX_CLAWS_SPIRITS / FOX_CLAWS_SPIRIT_TIME);
    var foxfire_dps = atkRate
      ? unforged * (1 + totals.lethality) * procs.foxfire_dmg * (1 - Math.exp(-procs.foxfire_chance * atkRate * procs.foxfire_duration))
      : 0.0;
    var archangel_smite_dps = race === 'Archangel' && atkRate > 0
      ? ARCHANGEL_SMITE_DMG * unforged * cooldownRate(ARCHANGEL_SMITE_CHANCE, atkRate, ARCHANGEL_SMITE_COOLDOWN)
      : 0.0;
    var cursed_aura_dps = race === 'Demon' ? DEMON_CURSED_AURA_DMG * unforged : 0.0;
    var golemite_dps = 0.0;
    build.golemites.forEach(function (g) {
      golemite_dps += golemiteDamage(g.level, unforged) * GOLEMITE_HITS_PER_SECOND;
    });

    var proc_total = explosion_dps + fire_dps + poison_dps + smite_dps + blackhole_dps + lightning_dps
      + smash_dps + fox_claws_dps + foxfire_dps + archangel_smite_dps + cursed_aura_dps + golemite_dps;
    var total_dps = weapon_dps + proc_total;

    var berserkLevel = Math.min(build.berserk, CAPS.berserk) + raceValue(RACE_BERSERK, race);
    var berserk = berserkLevel !== 0
      ? forged * (1 + totals.lethality + berserkLevel) * blend * atkRate + proc_total
      : null;

    var moonstone = procs.moon !== 0 ? weapon_dps * (1 + procs.moon) + proc_total : null;

    var min_dps = forged * (1 + totals.lethality) * atkRate;
    var max_dps = forged * (1 + totals.lethality) * (build.base_crit_dmg + totals.crit_dmg) * atkRate
      + forged * procs.explosion_dmg * atkRate
      + forged * procs.fire_dmg
      + forged * procs.poison_dmg
      + procs.smite_dmg * forged
      + procs.blackhole_dmg * forged
      + forged * procs.lightning_dmg * procs.lightning_chance * atkRate
      + procs.smash_dmg * forged;

    var ttk_25k = total_dps > 0 ? 25000 / total_dps : null;
    var ttk_75k = total_dps > 0 ? 75000 / total_dps : null;

    return {
      avg_power: avgPower,
      unforged_damage: unforged,
      forged_damage: forged,
      interval: interval,
      attack_rate: atkRate,
      lethality: totals.lethality,
      crit_chance: totals.crit_chance,
      crit_dmg: totals.crit_dmg,
      atk_speed: totals.atk_speed,
      crit_blend: blend,
      moon: procs.moon,
      explosion_dmg: procs.explosion_dmg,
      explosion_chance: procs.explosion_chance,
      fire_dmg: procs.fire_dmg,
      fire_chance: procs.fire_chance,
      fire_duration: procs.fire_duration,
      poison_dmg: procs.poison_dmg,
      poison_chance: procs.poison_chance,
      poison_duration: procs.poison_duration,
      smite_dmg: procs.smite_dmg,
      smite_chance: procs.smite_chance,
      blackhole_dmg: procs.blackhole_dmg,
      blackhole_chance: procs.blackhole_chance,
      lightning_dmg: procs.lightning_dmg,
      lightning_chance: procs.lightning_chance,
      lightning_cooldown: procs.lightning_cooldown,
      weapon_dps: weapon_dps,
      explosion_dps: explosion_dps,
      fire_dps: fire_dps,
      poison_dps: poison_dps,
      smite_dps: smite_dps,
      blackhole_dps: blackhole_dps,
      lightning_dps: lightning_dps,
      total_dps: total_dps,
      berserk_level: berserkLevel,
      berserk: berserk,
      moonstone: moonstone,
      min_dps: min_dps,
      max_dps: max_dps,
      ttk_25k: ttk_25k,
      ttk_75k: ttk_75k,
      active_traits: activeTraits(build, shares, game),
      smash_dmg: procs.smash_dmg,
      smash_chance: procs.smash_chance,
      fox_claws_dmg: procs.fox_claws_dmg,
      fox_claws_chance: procs.fox_claws_chance,
      foxfire_dmg: procs.foxfire_dmg,
      foxfire_chance: procs.foxfire_chance,
      foxfire_duration: procs.foxfire_duration,
      smash_dps: smash_dps,
      fox_claws_dps: fox_claws_dps,
      foxfire_dps: foxfire_dps,
      archangel_smite_dps: archangel_smite_dps,
      cursed_aura_dps: cursed_aura_dps,
      golemite_dps: golemite_dps,
      trait_damage_multiplier: tdm
    };
  }

  var DATA_TITLES = {
    ores: 'Data:Ores.json',
    weapons: 'Data:Weapons.json',
    races: 'Data:Races.json',
    runes: 'Data:Runes.json',
    achievements: 'Data:Achievements.json',
    oreRarity: 'Data:OreRarity.json'
  };

  function native(p) {
    return new Promise(function (resolve, reject) {
      Promise.resolve(p).then(resolve, reject);
    });
  }

  function loadViaQuery(api, title) {
    return native(api.get({
      action: 'query',
      titles: title,
      prop: 'revisions',
      rvslots: 'main',
      rvprop: 'content',
      formatversion: 2
    })).then(function (res) {
      var page = res.query.pages[0];
      var rev = page && page.revisions && page.revisions[0];
      var slot = rev && rev.slots && rev.slots.main;
      if (!slot || typeof slot.content !== 'string') {
        throw new Error('No content returned for ' + title);
      }
      return JSON.parse(slot.content);
    });
  }

  function loadViaJsondata(api, title) {
    return native(api.get({ action: 'jsondata', format: 'json', title: title })).then(function (res) {
      var jsondata = res.jsondata;
      if (jsondata && typeof jsondata === 'object' && jsondata.data !== undefined) {
        return jsondata.data;
      }
      if (jsondata && typeof jsondata === 'object' && jsondata.status === 'ok' && jsondata.data !== undefined) {
        return jsondata.data;
      }
      if (jsondata && typeof jsondata === 'object') {
        return jsondata;
      }
      throw new Error('Unexpected jsondata response for ' + title);
    });
  }

  function loadViaRaw(title) {
    var url = mw.config.get('wgScriptPath') + '/index.php?title=' + encodeURIComponent(title) + '&action=raw';
    return window.fetch(url, { credentials: 'same-origin' }).then(function (r) {
      if (!r.ok) { throw new Error('HTTP ' + r.status + ' for ' + title); }
      return r.json();
    });
  }

  function loadJSONPage(title) {
    var attempts = [
      function () {
        return native(mw.loader.using('mediawiki.api')).then(function () {
          return loadViaQuery(new mw.Api(), title);
        });
      },
      function () {
        return native(mw.loader.using('mediawiki.api')).then(function () {
          return loadViaJsondata(new mw.Api(), title);
        });
      },
      function () { return loadViaRaw(title); }
    ];

    return new Promise(function (resolve, reject) {
      var i = 0;
      var lastErr = null;
      function next() {
        if (i >= attempts.length) {
          reject(new Error('Failed to load ' + title + ' (' + (lastErr ? lastErr.message : 'unknown error') + ')'));
          return;
        }
        var attempt = attempts[i++];
        Promise.resolve().then(attempt).then(resolve, function (err) {
          lastErr = err;
          if (mw.log) { mw.log('Forge Calculator: ' + title + ' loading method ' + i + ' failed: ' + err.message); }
          next();
        });
      }
      next();
    });
  }

  function buildGameData(files) {
    var rawOres = files.ores;
    var rawWeapons = files.weapons;
    var rawRaces = files.races;
    var rawRunes = files.runes;
    var rawAchievements = files.achievements;

    var ores = rawOres.ores.map(function (raw) {
      return {
        name: raw.name,
        multiplier: raw.multiplier,
        equipment: raw.equipment != null ? raw.equipment : null,

        is_weapon: raw.equipment != null && String(raw.equipment).toLowerCase().indexOf('eapon') !== -1,
        trait10: raw.trait10 != null ? raw.trait10 : null,
        trait30: raw.trait30 != null ? raw.trait30 : null,
        comments: raw.comments != null ? raw.comments : null,
        stats: raw.stats || {}
      };
    });

    var weapons = rawWeapons.weapons.map(function (raw) {
      return {
        name: raw.name,
        type: raw.type,
        interval: raw.interval,
        damage: raw.damage
      };
    });

    var races = rawRaces.races.map(function (raw) {
      return {
        name: raw.name,
        default_trait: raw.default_trait != null ? raw.default_trait : null,
        available_traits: raw.available_traits || []
      };
    });

    var runes = rawRunes.runes.map(function (raw) {
      return {
        name: raw.name,
        stat: raw.stat != null ? raw.stat : null,
        value: raw.value != null ? raw.value : null
      };
    });

    var achievements = rawAchievements.achievements.map(function (raw) {
      return {
        name: raw.name,
        stat: raw.stat != null ? raw.stat : null,
        value: raw.value != null ? raw.value : null
      };
    });

    var data = {
      ores: ores,
      weapons: weapons,
      races: races,
      runes: runes,
      achievements: achievements,
      weapon_types: rawWeapons.types || [],
      race_bonus_types: rawWeapons.race_bonus_types || [],
      weapon_type_min_ore: rawWeapons.type_min_ore || {},
      not_enough_ore: rawWeapons.not_enough_ore || 'Not enough Ore',
      select_ore: rawOres.select_ore || SELECT_ORE,
      none_label: rawRunes.none || NONE_LABEL,
      ore_rarity: (files.oreRarity && files.oreRarity.rarities) || {},
      constants: {
        selectOreLabel: rawOres.select_ore || SELECT_ORE,
        noneLabel: rawRunes.none || NONE_LABEL
      }
    };

    data._ore_index = new Map(data.ores.map(function (o) { return [o.name, o]; }));
    data._weapon_index = new Map(data.weapons.map(function (w) { return [w.name, w]; }));
    data._race_index = new Map(data.races.map(function (r) { return [r.name, r]; }));

    validateData(data);
    return data;
  }

  function validateData(data) {
    var counts = {
      ores: data.ores.length,
      weapons: data.weapons.length,
      races: data.races.length,
      runes: data.runes.length,
      achievements: data.achievements.length
    };

    var drift = {};
    for (var key in EXPECTED_COUNTS) {
      if (counts[key] !== EXPECTED_COUNTS[key]) {
        drift[key] = { expected: EXPECTED_COUNTS[key], actual: counts[key] };
      }
    }
    if (Object.keys(drift).length > 0 && mw.log) {
      mw.log('Forge Calculator: data count drift detected', drift);
    }


    var seen = {};
    for (var i = 0; i < data.ores.length; i++) {
      var name = data.ores[i].name;
      if (seen[name]) {
        throw new Error('Duplicate ore name: ' + name);
      }
      seen[name] = true;
    }
  }

  function loadGameData() {
    return Promise.all([
      loadJSONPage(DATA_TITLES.ores),
      loadJSONPage(DATA_TITLES.weapons),
      loadJSONPage(DATA_TITLES.races),
      loadJSONPage(DATA_TITLES.runes),
      loadJSONPage(DATA_TITLES.achievements),
      loadJSONPage(DATA_TITLES.oreRarity).then(null, function () { return null; })
    ]).then(function (all) {
      return buildGameData({
        ores: all[0],
        weapons: all[1],
        races: all[2],
        runes: all[3],
        achievements: all[4],
        oreRarity: all[5]
      });
    });
  }

  function createEl(tag, attrs, children) {
    var el = document.createElement(tag);
    attrs = attrs || {};
    children = children || [];
    for (var key in attrs) {
      if (!Object.prototype.hasOwnProperty.call(attrs, key)) { continue; }
      var value = attrs[key];
      if (key === 'class') {
        el.className = value;
      } else if (key === 'style' && typeof value === 'object') {
        for (var s in value) { el.style[s] = value[s]; }
      } else if (key.indexOf('on') === 0 && typeof value === 'function') {
        el.addEventListener(key.slice(2).toLowerCase(), value);
      } else if (key === 'dataset') {
        for (var d in value) { el.dataset[d] = value[d]; }
      } else {
        el.setAttribute(key, value);
      }
    }
    for (var i = 0; i < children.length; i++) {
      var child = children[i];
      if (typeof child === 'string') {
        el.appendChild(document.createTextNode(child));
      } else if (child) {
        el.appendChild(child);
      }
    }
    return el;
  }

  function empty(el) {
    while (el.firstChild) { el.removeChild(el.firstChild); }
  }

  var CLASS_DROPDOWN = 'fc-searchable-dropdown';
  var CLASS_INPUT = 'fc-searchable-input';
  var CLASS_ARROW = 'fc-searchable-arrow';
  var CLASS_LIST = 'fc-searchable-list';
  var CLASS_ITEM = 'fc-searchable-item';
  var CLASS_ITEM_HIGHLIGHTED = 'fc-searchable-item--highlighted';
  var CLASS_HIDDEN = 'fc-hidden';

  function debounce(fn, delay) {
    var timeoutId = null;
    return function () {
      var args = Array.prototype.slice.call(arguments);
      if (timeoutId) { clearTimeout(timeoutId); }
      timeoutId = setTimeout(function () { fn.apply(null, args); }, delay);
    };
  }

  function createSearchableDropdown(opts) {
    var options = opts.options;
    var onChange = opts.onChange;
    var placeholder = opts.placeholder || '';
    var id = opts.id || ('dropdown-' + Math.random().toString(36).slice(2));
    var dropdownId = id;

    var isOpen = false;
    var highlightedIndex = -1;
    var filteredOptions = options;
    var currentValue = opts.value;

    var container = createEl('div', { class: CLASS_DROPDOWN });

    var input = createEl('input', {
      type: 'text',
      class: CLASS_INPUT,
      placeholder: placeholder,
      value: currentValue,
      'aria-autocomplete': 'list',
      'aria-controls': dropdownId + '-list',
      'aria-expanded': 'false',
      'aria-haspopup': 'listbox',
      id: dropdownId + '-input',
      autocomplete: 'off',
      spellcheck: 'false'
    });

    var arrow = createEl('button', {
      type: 'button',
      class: CLASS_ARROW,
      'aria-label': 'Toggle dropdown',
      tabindex: -1
    }, ['▾']);

    var listContainer = createEl('div', {
      class: CLASS_LIST + ' ' + CLASS_HIDDEN,
      id: dropdownId + '-list',
      role: 'listbox',
      'aria-label': placeholder || 'Options'
    });

    function filterOptions(searchTerm) {
      var term = searchTerm.toLowerCase().trim();
      if (!term) { return options; }
      var filtered = [];
      for (var i = 0; i < options.length; i++) {
        if (options[i].toLowerCase().indexOf(term) !== -1) { filtered.push(options[i]); }
      }
      return filtered;
    }

    function renderList() {
      empty(listContainer);
      highlightedIndex = -1;

      if (filteredOptions.length === 0) {
        listContainer.appendChild(createEl('div', { class: CLASS_ITEM + ' fc-searchable-no-results' }, ['No results']));
        return;
      }

      for (var i = 0; i < filteredOptions.length; i++) {
        var opt = filteredOptions[i];
        var item = createEl('div', {
          class: CLASS_ITEM,
          role: 'option',
          'aria-selected': 'false',
          'data-index': i,
          'data-value': opt
        }, [opt]);
        listContainer.appendChild(item);
      }
    }

    function highlightIndex(index) {
      var items = listContainer.querySelectorAll('.' + CLASS_ITEM + '[data-index]');
      for (var i = 0; i < items.length; i++) {
        var item = items[i];
        var isHighlighted = (i === index);
        item.classList.toggle(CLASS_ITEM_HIGHLIGHTED, isHighlighted);
        item.setAttribute('aria-selected', isHighlighted ? 'true' : 'false');
      }
      highlightedIndex = index;
    }

    function selectHighlighted() {
      if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
        var newValue = filteredOptions[highlightedIndex];
        currentValue = newValue;
        input.value = newValue;
        onChange(newValue);
        close();
      }
    }

    function open(showAll) {
      if (isOpen) { return; }
      isOpen = true;
      listContainer.classList.remove(CLASS_HIDDEN);
      input.setAttribute('aria-expanded', 'true');
      arrow.textContent = '▴';
      filteredOptions = filterOptions(showAll ? '' : (input.value === currentValue ? '' : input.value));
      renderList();
      input.focus();
    }

    function close() {
      if (!isOpen) { return; }
      isOpen = false;
      listContainer.classList.add(CLASS_HIDDEN);
      input.setAttribute('aria-expanded', 'false');
      arrow.textContent = '▾';
      highlightedIndex = -1;
    }

    function toggle(showAll) {
      if (isOpen) { close(); } else { open(showAll); }
    }

    var handleInput = debounce(function (e) {
      var term = e.target.value;
      filteredOptions = filterOptions(term);
      renderList();
      if (!isOpen && filteredOptions.length > 0) { open(); }
    }, 100);

    function handleKeydown(e) {
      if (!isOpen) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open();
        }
        return;
      }

      var items = listContainer.querySelectorAll('.' + CLASS_ITEM + '[data-index]');
      var maxIndex = items.length - 1;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          if (highlightedIndex < maxIndex) {
            highlightIndex(highlightedIndex + 1);
            if (items[highlightedIndex] && items[highlightedIndex].scrollIntoView) {
              items[highlightedIndex].scrollIntoView({ block: 'nearest' });
            }
          }
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (highlightedIndex > 0) {
            highlightIndex(highlightedIndex - 1);
            if (items[highlightedIndex] && items[highlightedIndex].scrollIntoView) {
              items[highlightedIndex].scrollIntoView({ block: 'nearest' });
            }
          } else if (highlightedIndex === 0) {
            highlightIndex(-1);
          }
          break;
        case 'Enter':
          e.preventDefault();
          selectHighlighted();
          break;
        case 'Escape':
          e.preventDefault();
          close();
          input.blur();
          break;
        case 'Tab':
          selectHighlighted();
          break;
      }
    }

    function handleItemClick(e) {
      var target = e.target;
      while (target && target !== listContainer && !target.classList.contains(CLASS_ITEM)) {
        target = target.parentNode;
      }
      if (target && target.classList.contains(CLASS_ITEM) && target.dataset.value) {
        var value = target.dataset.value;
        currentValue = value;
        input.value = value;
        onChange(value);
        close();
      }
    }

    function handleClickOutside(e) {
      if (!container.contains(e.target)) { close(); }
    }

    function handleArrowClick(e) {
      e.preventDefault();
      e.stopPropagation();
      toggle(true);
    }

    input.addEventListener('input', handleInput);
    input.addEventListener('keydown', handleKeydown);
    input.addEventListener('focus', function () {
      input.select();
      if (!isOpen && options.length > 0) { open(); }
    });
    arrow.addEventListener('click', handleArrowClick);
    listContainer.addEventListener('click', handleItemClick);
    document.addEventListener('click', handleClickOutside);

    container.setValue = function (val) {
      currentValue = val;
      input.value = val;
    };
    container.getValue = function () { return currentValue; };
    container.open = open;
    container.close = close;
    container.setOptions = function (newOptions) {
      options = newOptions;
      filteredOptions = filterOptions('');
      renderList();
    };
    container.updateOptions = function (newOptions) {
      options = newOptions;
      filteredOptions = filterOptions(input.value === currentValue ? '' : input.value);
      renderList();
      if (!isOpen && filteredOptions.length > 0) { open(); }
    };

    container.append(input, arrow, listContainer);
    return container;
  }

  function createOreSlot(opts) {
    var index = opts.index;
    var oreNames = opts.oreNames;
    var noneLabel = opts.noneLabel;
    var selectOreLabel = opts.selectOreLabel;
    var prompt = opts.prompt || noneLabel;
    var oreMultipliers = opts.oreMultipliers || {};
    var onChange = opts.onChange;

    var slotId = (opts.idPrefix || 'ore-slot-') + index;
    var currentName = opts.value || noneLabel;
    var currentAmount = opts.amount || 0;

    var options = [prompt].concat(oreNames.filter(function (n) { return n !== selectOreLabel; }));

    function toUI(val) { return (val === noneLabel || val === undefined) ? prompt : val; }
    function fromUI(val) { return val === prompt ? noneLabel : val; }

    var container = createEl('div', { class: 'fc-ore-slot', id: slotId });
    var label = createEl('label', { class: 'fc-ore-slot-label', for: slotId + '-ore' }, ['Slot ' + (index + 1)]);
    var fields = createEl('div', { class: 'fc-ore-slot-fields' });

    var dropdownWrapper = createEl('div', { class: 'fc-ore-slot-dropdown' });
    var dropdown = createSearchableDropdown({
      options: options,
      value: toUI(currentName),
      placeholder: prompt,
      id: slotId + '-ore',
      onChange: function (newName) {
        var parsed = fromUI(newName);
        if (parsed !== currentName) {
          currentName = parsed;
          currentAmount = 0;
          amountInput.value = 0;
        }
        updateMult();
        onChange(currentName, currentAmount);
      }
    });
    dropdownWrapper.appendChild(dropdown);

    var multLabel = createEl('span', { class: 'fc-ore-slot-mult' }, ['']);
    function updateMult() {
      var m = Number(oreMultipliers[currentName]);
      multLabel.textContent = m ? '×' + String(parseFloat(m.toFixed(2))) : '';
    }

    var amountInput = createEl('input', {
      type: 'number',
      class: 'fc-ore-slot-amount',
      id: slotId + '-amount',
      value: currentAmount,
      min: '0',
      step: '1',
      placeholder: '0',
      inputmode: 'decimal'
    });

    function commitAmount() {
      currentAmount = parseFloat(amountInput.value) || 0;
      amountInput.value = currentAmount;
      onChange(currentName, currentAmount);
    }

    var handleAmountChange = debounce(commitAmount, 150);
    amountInput.addEventListener('input', handleAmountChange);
    amountInput.addEventListener('change', commitAmount);

    fields.append(dropdownWrapper, multLabel, amountInput);
    container.append(label, fields);

    container.setValue = function (name, amt) {
      currentName = name;
      currentAmount = amt;
      dropdown.setValue(toUI(name));
      amountInput.value = amt;
      updateMult();
    };
    container.getValue = function () { return { name: currentName, amount: currentAmount }; };
    container.getDropdown = function () { return dropdown; };

    updateMult();
    return container;
  }

  function createWeaponSelector(opts) {
    var weaponTypes = opts.weaponTypes;
    var weapons = opts.weapons;
    var noneLabel = opts.noneLabel;
    var weaponTypePrompt = opts.weaponTypePrompt || noneLabel;
    var weaponPrompt = opts.weaponPrompt || noneLabel;
    var enhancementPrompt = opts.enhancementPrompt || noneLabel;
    var onChange = opts.onChange;


    function toUI(val, sentinel, prompt) {
      return (val === sentinel || val === undefined) ? prompt : val;
    }
    function fromUI(val, sentinel, prompt) {
      return val === prompt ? sentinel : val;
    }

    var QUALITY_MAX = 100;

    var typeMinOre = opts.typeMinOre || {};
    var notEnoughOre = opts.notEnoughOre || 'Not enough Ore';
    var oreTotal = Number(opts.oreTotal) || 0;
    var currentType = opts.weaponType || noneLabel;
    var currentWeapon = opts.weaponName || noneLabel;

    function allowedTypes() {
      return weaponTypes.filter(function (t) {
        return typeMinOre[t] === undefined || typeMinOre[t] <= oreTotal;
      });
    }

    function typeOptionList() {
      var allowed = allowedTypes();
      if (!allowed.length) { return [weaponTypePrompt, notEnoughOre]; }
      return [weaponTypePrompt, 'All Types'].concat(allowed);
    }

    function weaponsForType(type) {
      var allowed = allowedTypes();
      return weapons.filter(function (w) {
        if (allowed.indexOf(w.type) === -1) { return false; }
        return type === noneLabel || type === 'All Types' || w.type === type;
      });
    }

    function weaponOptionList(type) {
      return [weaponPrompt].concat(weaponsForType(type).map(function (w) { return w.name; }));
    }
    var currentQuality = (opts.quality !== undefined && opts.quality !== null) ? opts.quality : 100;
    var currentEnhancement = (opts.enhancement !== undefined && opts.enhancement !== null) ? opts.enhancement : 0;

    var container = createEl('div', { class: 'fc-weapon-selector' });

    var typeWrapper = createEl('div', { class: 'fc-weapon-type-wrapper' });
    var typeLabel = createEl('label', { for: 'weapon-type' }, ['Weapon Type']);
    var typeDropdown = createSearchableDropdown({
      options: typeOptionList(),
      value: toUI(currentType, noneLabel, weaponTypePrompt),
      placeholder: weaponTypePrompt,
      id: 'weapon-type',
      onChange: function (newType) {
        currentType = newType === notEnoughOre ? noneLabel : fromUI(newType, noneLabel, weaponTypePrompt);
        if (newType === notEnoughOre) { typeDropdown.setValue(weaponTypePrompt); }
        var weaponNames = weaponOptionList(currentType);
        weaponDropdown.updateOptions(weaponNames);
        if (weaponNames.indexOf(currentWeapon) === -1) {
          currentWeapon = noneLabel;
          weaponDropdown.setValue(weaponPrompt);
        }
        onChange(currentType, currentWeapon, currentQuality, currentEnhancement);
      }
    });
    typeWrapper.append(typeLabel, typeDropdown);

    var weaponWrapper = createEl('div', { class: 'fc-weapon-wrapper' });
    var weaponLabel = createEl('label', { for: 'weapon-name' }, ['Weapon']);
    var weaponDropdown = createSearchableDropdown({
      options: weaponOptionList(currentType),
      value: toUI(currentWeapon, noneLabel, weaponPrompt),
      placeholder: weaponPrompt,
      id: 'weapon-name',
      onChange: function (newWeapon) {
        currentWeapon = fromUI(newWeapon, noneLabel, weaponPrompt);
        onChange(currentType, currentWeapon, currentQuality, currentEnhancement);
      }
    });
    weaponWrapper.append(weaponLabel, weaponDropdown);

    var qualityWrapper = createEl('div', { class: 'fc-quality-wrapper' });
    var qualityLabel = createEl('label', { for: 'quality' }, ['Quality']);
    var qualityInput = createEl('input', {
      type: 'number',
      class: 'fc-quality-input',
      id: 'quality',
      value: currentQuality,
      min: '0',
      max: String(QUALITY_MAX),
      step: '5',
      inputmode: 'decimal'
    });
    function clampQuality(v) {
      return Math.min(parseFloat(v) || 0, QUALITY_MAX);
    }
    function commitQuality() {
      currentQuality = clampQuality(qualityInput.value);
      qualityInput.value = currentQuality;
      onChange(currentType, currentWeapon, currentQuality, currentEnhancement);
    }
    var handleQualityChange = debounce(commitQuality, 150);
    qualityInput.addEventListener('input', handleQualityChange);
    qualityInput.addEventListener('change', commitQuality);
    qualityWrapper.append(qualityLabel, qualityInput);

    var enhancementWrapper = createEl('div', { class: 'fc-enhancement-wrapper' });
    var enhancementLabel = createEl('label', { for: 'enhancement' }, ['Enhancement']);
    var enhancementLevels = [];
    for (var i = 0; i < 10; i++) { enhancementLevels.push(String(i)); }
    var enhancementOptions = [enhancementPrompt].concat(enhancementLevels);
    var enhancementDropdown = createSearchableDropdown({
      options: enhancementOptions,
      value: String(currentEnhancement),
      placeholder: enhancementPrompt,
      id: 'enhancement',
      onChange: function (newEnhancement) {
        currentEnhancement = newEnhancement === enhancementPrompt ? 0 : parseInt(newEnhancement, 10);
        onChange(currentType, currentWeapon, currentQuality, currentEnhancement);
      }
    });
    enhancementWrapper.append(enhancementLabel, enhancementDropdown);

    container.append(typeWrapper, weaponWrapper, qualityWrapper, enhancementWrapper);

    container.setValues = function (type, name, qual, enh) {
      currentType = type;
      currentWeapon = name;
      currentQuality = qual;
      currentEnhancement = enh;
      typeDropdown.setValue(toUI(type, noneLabel, weaponTypePrompt));
      weaponDropdown.setValue(toUI(name, noneLabel, weaponPrompt));
      qualityInput.value = qual;
      enhancementDropdown.setValue(String(enh));
    };

    container.setOreTotal = function (total) {
      oreTotal = Number(total) || 0;
      typeDropdown.setOptions(typeOptionList());
      weaponDropdown.setOptions(weaponOptionList(currentType));
    };

    container.getTypeOptions = typeOptionList;
    container.getWeaponOptions = function () { return weaponOptionList(currentType); };

    return container;
  }

  function createStatInput(opts) {
    var onChange = opts.onChange;
    var currentValues = {};
    for (var k in opts.values) { currentValues[k] = opts.values[k]; }

    var container = createEl('div', { class: 'fc-stat-input' });




    var fields = [
      { key: 'armorLethality', label: 'Armor Lethality', placeholder: '0', min: 0, max: 300, step: 1 },
      { key: 'armorCritChance', label: 'Armor Crit Chance', placeholder: '0', min: 0, max: 100, step: 1 },
      { key: 'armorCritDmg', label: 'Armor Crit Damage', placeholder: '0', min: 0, max: 150, step: 1 }
    ];

    for (var i = 0; i < fields.length; i++) {
      (function (field) {
        var row = createEl('div', { class: 'fc-stat-input-row' });
        var label = createEl('label', { class: 'fc-stat-input-label', for: field.key }, [field.label]);
        var input = createEl('input', {
          type: 'number',
          class: 'fc-stat-input-input',
          id: field.key,
          value: currentValues[field.key] !== undefined ? currentValues[field.key] : '',
          min: String(field.min),
          max: String(field.max),
          step: field.step,
          placeholder: field.placeholder,
          inputmode: 'numeric'
        });

        function commit() {
          currentValues[field.key] = Math.max(0, Math.min(parseFloat(input.value) || 0, field.max));
          input.value = currentValues[field.key];
          var out = {};
          for (var k2 in currentValues) { out[k2] = currentValues[k2]; }
          onChange(out);
        }
        var handleChange = debounce(commit, 150);
        input.addEventListener('input', handleChange);
        input.addEventListener('change', commit);

        var fieldWrapper = createEl('div', { class: 'fc-stat-input-field' });
        fieldWrapper.appendChild(input);
        row.append(label, fieldWrapper);
        container.appendChild(row);
      })(fields[i]);
    }

    container.setValues = function (values) {
      for (var key in values) { currentValues[key] = values[key]; }
      for (var j = 0; j < fields.length; j++) {
        var el = container.querySelector('#' + fields[j].key);
        if (el) { el.value = currentValues[fields[j].key] !== undefined ? currentValues[fields[j].key] : ''; }
      }
    };

    container.getValues = function () {
      var out = {};
      for (var k3 in currentValues) { out[k3] = currentValues[k3]; }
      return out;
    };

    return container;
  }



  var ABILITY_RANGES = {
    fireDmg: { min: 1, max: 22, unit: 'pct' },
    fireChance: { min: 1, max: 50, unit: 'pct' },
    fireTime: { min: 1, max: 3, unit: 'sec' },
    poisonDmg: { min: 1, max: 7, unit: 'pct' },
    poisonChance: { min: 1, max: 35, unit: 'pct' },
    poisonTime: { min: 1, max: 6, unit: 'sec' },
    lightningDmg: { min: 1, max: 80, unit: 'pct' },
    lightningChance: { min: 1, max: 60, unit: 'pct' },
    lightningCooldown: { min: 0.3, max: 5, unit: 'sec' },
    blastDmg: { min: 1, max: 40, unit: 'pct' },
    blastChance: { min: 1, max: 20, unit: 'pct' }
  };



  function clampAbilityValue(raw) {
    if (raw === '' || raw === undefined || raw === null) { return 0; }
    var s = String(raw).trim().replace(/%$/, '').trim();
    if (s === '') { return 0; }
    var v = parseFloat(s);
    if (isNaN(v) || v === 0) { return 0; }
    return v;
  }

  function createAbilityGrid(opts) {
    var onChange = opts.onChange;
    var currentValues = {};
    for (var k in opts.values) { currentValues[k] = opts.values[k]; }
    var invalidFields = {};

    var container = createEl('div', { class: 'fc-ability-grid' });

    function createSection(title, fields) {
      var section = createEl('div', { class: 'fc-ability-section' });
      var sectionTitle = createEl('h4', { class: 'fc-ability-section-title' });
      sectionTitle.appendChild(iconImg(title.toLowerCase(), title));
      sectionTitle.appendChild(document.createTextNode(title));
      section.appendChild(sectionTitle);

      for (var i = 0; i < fields.length; i++) {
        (function (field) {
          var range = ABILITY_RANGES[field.key];
          var step = (range.min % 1 !== 0 || range.max % 1 !== 0) ? '0.1' : '1';
          var row = createEl('div', { class: 'fc-ability-row' });
          var label = createEl('label', { class: 'fc-ability-label', for: field.key }, [field.label]);
          var input = createEl('input', {
            type: 'text',
            class: 'fc-ability-input',
            id: field.key,
            value: currentValues[field.key] !== undefined ? currentValues[field.key] : '',
            step: step,
            placeholder: '0',
            title: field.label + ' (from runes). 0 = no ability.',
            inputmode: 'decimal'
          });

          function commit() {
            var trimmed = String(input.value).trim();
            invalidFields[field.key] = (trimmed !== '' && isNaN(Number(trimmed)))
              ? (title + ' ' + field.label)
              : null;
            currentValues[field.key] = clampAbilityValue(input.value);
            input.value = currentValues[field.key];
            var out = {};
            for (var k2 in currentValues) { out[k2] = currentValues[k2]; }
            onChange(out);
          }
          var handleChange = debounce(commit, 150);
          input.addEventListener('input', handleChange);
          input.addEventListener('change', commit);
          input.addEventListener('blur', commit);

          var fieldWrapper = createEl('div', { class: 'fc-ability-field' });
          fieldWrapper.appendChild(input);
          row.append(label, fieldWrapper);
          section.appendChild(row);
        })(fields[i]);
      }

      return section;
    }

    var fireSection = createSection('Fire', [
      { key: 'fireDmg', label: 'Damage' },
      { key: 'fireChance', label: 'Chance' },
      { key: 'fireTime', label: 'Duration' }
    ]);

    var poisonSection = createSection('Poison', [
      { key: 'poisonDmg', label: 'Damage' },
      { key: 'poisonChance', label: 'Chance' },
      { key: 'poisonTime', label: 'Duration' }
    ]);

    var lightningSection = createSection('Lightning', [
      { key: 'lightningDmg', label: 'Damage' },
      { key: 'lightningChance', label: 'Chance' },
      { key: 'lightningCooldown', label: 'Cooldown' }
    ]);

    var blastSection = createSection('Blast', [
      { key: 'blastDmg', label: 'Damage' },
      { key: 'blastChance', label: 'Chance' }
    ]);

    fireSection.classList.add('fc-ability-section--fire');
    poisonSection.classList.add('fc-ability-section--poison');
    lightningSection.classList.add('fc-ability-section--lightning');
    blastSection.classList.add('fc-ability-section--blast');

    container.append(fireSection, blastSection, poisonSection, lightningSection);

    container.setValues = function (values) {
      for (var key in values) { currentValues[key] = values[key]; }
      invalidFields = {};
      var sections = [fireSection, poisonSection, lightningSection, blastSection];
      for (var i = 0; i < sections.length; i++) {
        var inputs = sections[i].querySelectorAll('.fc-ability-input');
        for (var j = 0; j < inputs.length; j++) {
          var inp = inputs[j];
          if (currentValues[inp.id] !== undefined) {
            inp.value = currentValues[inp.id] !== undefined ? currentValues[inp.id] : '';
          }
        }
      }
    };

    container.getValues = function () {
      var out = {};
      for (var k3 in currentValues) { out[k3] = currentValues[k3]; }
      return out;
    };

    container.getInvalidAbilityWarnings = function () {
      var out = [];
      for (var k4 in invalidFields) {
        if (invalidFields[k4]) { out.push(invalidFields[k4] + ' ability only takes numerical values.'); }
      }
      return out;
    };

    return container;
  }

  var GOLEMITE_SLOT_COUNT = 4;

  var GOLEMITE_STAT_LABELS = [
    { key: 'lethality', label: 'Lethality', kind: 'pct' },
    { key: 'crit_chance', label: 'Crit Chance', kind: 'pct' },
    { key: 'crit_dmg', label: 'Crit DMG', kind: 'pct' },
    { key: 'atk_speed', label: 'Atk Speed', kind: 'pct' },
    { key: 'fire_dmg', label: 'Fire DMG', kind: 'pct' },
    { key: 'fire_chance', label: 'Fire Chance', kind: 'pct' },
    { key: 'fire_time', label: 'Fire Duration', kind: 'sec' },
    { key: 'poison_dmg', label: 'Poison DMG', kind: 'pct' },
    { key: 'poison_chance', label: 'Poison Chance', kind: 'pct' },
    { key: 'poison_time', label: 'Poison Duration', kind: 'sec' },
    { key: 'lightning_dmg', label: 'Lightning DMG', kind: 'pct' },
    { key: 'lightning_chance', label: 'Lightning Chance', kind: 'pct' },
    { key: 'lightning_cooldown', label: 'Lightning Cooldown', kind: 'sec' },
    { key: 'blast_dmg', label: 'Blast DMG', kind: 'pct' },
    { key: 'blast_chance', label: 'Blast Chance', kind: 'pct' },
    { key: 'smite_dmg', label: 'Smite DMG', kind: 'pct' },
    { key: 'smite_chance', label: 'Smite Chance', kind: 'pct' },
    { key: 'blackhole_dmg', label: 'Black Hole DMG', kind: 'pct' },
    { key: 'blackhole_chance', label: 'Black Hole Chance', kind: 'pct' },
    { key: 'resonance_dmg', label: 'Resonance', kind: 'pct' },
    { key: 'moon', label: 'Moon Boost', kind: 'pct' }
  ];

  function emptyGolemiteSlots() {
    var slots = [];
    for (var i = 0; i < GOLEMITE_SLOT_COUNT; i++) { slots.push({ name: NONE_LABEL, amount: 0 }); }
    return slots;
  }

  function emptyGolemite() {
    return { level: 0, slots: emptyGolemiteSlots() };
  }

  function golemiteBuildValues(list) {
    return [0, 1].map(function (i) {
      var src = (list && list[i]) || {};
      var level = Math.min(GOLEMITE_MAX_LEVEL, Math.max(0, Math.floor(Number(src.level) || 0)));
      var slots = emptyGolemiteSlots().map(function (empty, j) {
        var s = (src.slots && src.slots[j]) || empty;
        return { name: s.name || NONE_LABEL, amount: Math.max(0, Number(s.amount) || 0) };
      });
      return { level: level, slots: slots };
    });
  }

  function golemiteEngineValues(golemite, game) {
    var out = { level: golemite.level };
    var derived = game ? deriveGolemiteStats(golemite.slots, game).stats : null;
    GOLEMITE_FIELDS.forEach(function (f) {
      if (f !== 'level') { out[f] = derived ? derived[f] : 0.0; }
    });
    return out;
  }

  function formatGolemiteStat(value, kind) {
    if (kind === 'sec') { return String(parseFloat(value.toFixed(2))) + 's'; }
    return String(parseFloat((value * 100).toFixed(2))) + '%';
  }

  function createGolemiteInputs(opts) {
    var onChange = opts.onChange;
    var describe = opts.describe || function () { return null; };
    var values = golemiteBuildValues(opts.values);
    var active = 0;
    var levelInputs = [];
    var slotWidgets = [[], []];
    var summaries = [];

    var container = createEl('div', { class: 'fc-golemite' });
    var tabs = createEl('div', { class: 'fc-golemite-tabs', role: 'tablist' });
    var panes = [];
    var tabButtons = [];

    function copyValues() {
      return values.map(function (g) {
        return { level: g.level, slots: g.slots.map(function (s) { return { name: s.name, amount: s.amount }; }) };
      });
    }

    function tabText(i) {
      var level = values[i].level;
      var info = describe(values[i]);
      return 'Golemite ' + (i + 1) + (level ? ' · Lv ' + level : '') + (info && info.rarity ? ' · ' + info.rarity : '');
    }

    function renderSummary(i) {
      var box = summaries[i];
      empty(box);
      var info = describe(values[i]);
      if (!info || !info.rarity) {
        box.appendChild(createEl('p', { class: 'fc-golemite-summary-empty' }, ['Add the ores you forged this Golemite with to see its stats.']));
        return;
      }
      box.appendChild(createEl('div', { class: 'fc-golemite-summary-head' }, [
        createEl('span', { class: 'fc-golemite-rarity fc-golemite-rarity--' + info.rarity.toLowerCase() }, [info.rarity]),
        createEl('span', { class: 'fc-golemite-scaling' }, ['Ore traits ×' + info.scaling.toFixed(2)])
      ]));
      var list = createEl('div', { class: 'fc-golemite-stats' });
      var shown = 0;
      GOLEMITE_STAT_LABELS.forEach(function (entry) {
        var v = info.stats[entry.key];
        if (!v) { return; }
        shown++;
        list.appendChild(createEl('div', { class: 'fc-golemite-stat' }, [
          createEl('span', { class: 'fc-golemite-stat-label' }, [entry.label]),
          createEl('span', { class: 'fc-golemite-stat-value' }, [formatGolemiteStat(v, entry.kind)])
        ]));
      });
      if (!shown) {
        list.appendChild(createEl('p', { class: 'fc-golemite-summary-empty' }, ['These ores give no weapon traits.']));
      }
      box.appendChild(list);
    }

    function refresh(i) {
      tabButtons[i].textContent = tabText(i);
      renderSummary(i);
    }

    function emit(i) {
      refresh(i);
      onChange(copyValues());
    }

    function selectTab(i) {
      active = i;
      for (var j = 0; j < 2; j++) {
        tabButtons[j].classList.toggle('fc-golemite-tab--active', j === i);
        tabButtons[j].setAttribute('aria-selected', j === i ? 'true' : 'false');
        panes[j].classList.toggle('fc-hidden', j !== i);
      }
    }

    for (var i = 0; i < 2; i++) {
      (function (index) {
        var tab = createEl('button', {
          type: 'button',
          class: 'fc-golemite-tab',
          role: 'tab',
          id: 'fc-golemite-tab-' + (index + 1)
        }, ['']);
        tab.addEventListener('click', function (e) { e.preventDefault(); selectTab(index); });
        tabButtons.push(tab);
        tabs.appendChild(tab);

        var pane = createEl('div', { class: 'fc-golemite-pane', role: 'tabpanel' });
        var levelId = 'fc-golemite-' + (index + 1) + '-level';
        var levelRow = createEl('div', { class: 'fc-golemite-level' });
        var levelInput = createEl('input', {
          type: 'number',
          class: 'fc-ability-input fc-golemite-level-input',
          id: levelId,
          value: values[index].level || 0,
          min: '0',
          max: String(GOLEMITE_MAX_LEVEL),
          step: '1',
          placeholder: '0',
          title: 'Golemite ' + (index + 1) + ' level (13 or higher adds Golemite DPS). 0 = none.',
          inputmode: 'numeric'
        });
        function commitLevel() {
          var v = Math.min(GOLEMITE_MAX_LEVEL, Math.max(0, Math.floor(parseFloat(levelInput.value) || 0)));
          levelInput.value = v;
          values[index].level = v;
          emit(index);
        }
        levelInput.addEventListener('input', debounce(commitLevel, 150));
        levelInput.addEventListener('change', commitLevel);
        levelInputs.push(levelInput);
        levelRow.append(
          createEl('label', { class: 'fc-golemite-level-label', for: levelId }, ['Level']),
          levelInput,
          createEl('span', { class: 'fc-golemite-level-hint' }, ['Golemite DPS starts at level 13 (max 25).'])
        );
        pane.appendChild(levelRow);

        var grid = createEl('div', { class: 'fc-ore-grid fc-golemite-ores' });
        for (var j = 0; j < GOLEMITE_SLOT_COUNT; j++) {
          (function (slotIndex) {
            var slot = createOreSlot({
              index: slotIndex,
              idPrefix: 'fc-golemite-' + (index + 1) + '-slot-',
              oreNames: opts.oreNames || [],
              noneLabel: opts.noneLabel || NONE_LABEL,
              selectOreLabel: opts.selectOreLabel || SELECT_ORE,
              prompt: opts.prompt,
              oreMultipliers: opts.oreMultipliers || {},
              value: values[index].slots[slotIndex].name,
              amount: values[index].slots[slotIndex].amount,
              onChange: function (name, amount) {
                values[index].slots[slotIndex] = { name: name, amount: amount };
                emit(index);
              }
            });
            slotWidgets[index].push(slot);
            grid.appendChild(slot);
          })(j);
        }
        pane.appendChild(grid);

        var summary = createEl('div', { class: 'fc-golemite-summary', id: 'fc-golemite-' + (index + 1) + '-summary' });
        summaries.push(summary);
        pane.appendChild(summary);
        panes.push(pane);
      })(i);
    }

    container.appendChild(tabs);
    panes.forEach(function (pane) { container.appendChild(pane); });
    refresh(0);
    refresh(1);
    selectTab(0);

    container.setValues = function (list) {
      values = golemiteBuildValues(list);
      for (var k = 0; k < 2; k++) {
        levelInputs[k].value = values[k].level || 0;
        for (var m = 0; m < GOLEMITE_SLOT_COUNT; m++) {
          slotWidgets[k][m].setValue(values[k].slots[m].name, values[k].slots[m].amount);
        }
        refresh(k);
      }
      selectTab(active);
    };

    container.getValues = function () { return copyValues(); };

    return container;
  }

  function createRuneSelector(opts) {
    var runes = opts.runes;
    var noneLabel = opts.noneLabel;
    var prompt = opts.prompt || noneLabel;
    var onChange = opts.onChange;

    var initial = opts.values || [];
    var current = [];
    for (var ci = 0; ci < 9; ci++) {
      current.push(initial[ci] !== undefined ? initial[ci] : noneLabel);
    }


    function toUI(val) { return (val === noneLabel || val === undefined) ? prompt : val; }
    function fromUI(val) { return val === prompt ? noneLabel : val; }

    var container = createEl('div', { class: 'fc-rune-selector' });
    var runeNames = runes.map(function (r) { return r.name; });
    var options = [prompt].concat(runeNames);

    var dropdowns = [];
    for (var line = 0; line < 3; line++) {
      var lineEl = createEl('div', { class: 'fc-rune-line' });
      var lineLabel = createEl('span', { class: 'fc-rune-line-label' }, ['Rune ' + (line + 1)]);
      lineEl.appendChild(lineLabel);
      for (var col = 0; col < 3; col++) {
        (function (idx) {
          var dropdown = createSearchableDropdown({
            options: options,
            value: toUI(current[idx]),
            placeholder: prompt,
            id: 'rune-slot-' + idx,
            onChange: function (name) {
              current[idx] = fromUI(name);
              onChange(current.slice());
            }
          });
          dropdowns.push(dropdown);
          var slotEl = createEl('div', { class: 'fc-rune-slot' });
          slotEl.appendChild(dropdown);
          lineEl.appendChild(slotEl);
        })(line * 3 + col);
      }
      container.appendChild(lineEl);
    }

    container.setValues = function (vals) {
      vals = vals || [];
      current = [];
      for (var i = 0; i < 9; i++) {
        current.push(vals[i] !== undefined ? vals[i] : noneLabel);
      }
      for (var d = 0; d < 9; d++) {
        dropdowns[d].setValue(toUI(current[d]));
      }
    };
    container.getValues = function () { return current.slice(); };

    return container;
  }

  function createResultsCard(opts) {
    var card = createEl('div', { class: 'fc-card' });
    var head = createEl('div', { class: 'fc-card-head' });
    if (!opts.hideIcon) {
      var iconEl = createEl('span', { class: 'fc-card-icon' }, ['◆']);
      head.appendChild(iconEl);
    }
    var titleEl = createEl('span', { class: 'fc-card-title' }, [opts.title]);
    head.append(titleEl);

    var body = createEl('div', { class: 'fc-card-body' });
    var rowsContainer = createEl('div', { class: 'fc-stat-rows' });
    rowsContainer.append(opts.content);
    body.appendChild(rowsContainer);

    card.append(head, body);
    return card;
  }

  function updateResultsCard(card, content) {
    var rowsContainer = card.querySelector('.fc-stat-rows');
    if (rowsContainer) {
      empty(rowsContainer);
      rowsContainer.append(content);
    }
  }

  function createStatRow(opts) {
    var row = createEl('div', { class: 'fc-stat-row' });
    var labelEl = createEl('span', { class: ('fc-stat-label ' + (opts.labelClass || '')).trim() }, [opts.label]);
    var valueClass = ('fc-stat-val ' + (opts.valueClass || '')).trim();
    var valueEl = createEl('span', { class: valueClass }, [opts.value !== undefined ? opts.value : '']);
    if (opts.isCap) { valueEl.classList.add(CAP_CLASS); }


    valueEl.classList.add('fc-copyable');
    valueEl.setAttribute('title', 'Click to copy');
    valueEl.addEventListener('click', function () {
      var t = valueEl.textContent.trim();
      if (!t || t === '—' || t === '∞') { return; }
      writeClipboard(t, 'Copied: ' + t);
    });

    row.append(labelEl, valueEl);
    return row;
  }

  function updateStatRow(row, value, isCap) {
    var valueEl = row.querySelector('.fc-stat-val');
    if (valueEl) {
      valueEl.textContent = value;
      valueEl.classList.toggle(CAP_CLASS, !!isCap);
    }
  }

  function createStatRows(rows) {
    var fragment = document.createDocumentFragment();
    for (var i = 0; i < rows.length; i++) {
      fragment.appendChild(createStatRow(rows[i]));
    }
    return fragment;
  }

  function fmt2(n) {
    if (n === null || n === undefined || !isFinite(n)) { return '∞'; }
    return n.toFixed(2);
  }

  function pctFmt(n) {
    if (n === null || n === undefined || !isFinite(n)) { return '—'; }
    return (n * 100).toFixed(1) + '%';
  }

  function fmtDps(n) {
    if (n === null || n === undefined || !isFinite(n)) { return '—'; }
    if (n >= 10000) { return n.toLocaleString(undefined, { maximumFractionDigits: 0 }); }
    return fmt2(n);
  }

  function fmtTime(n) {
    if (n === null || n === undefined || !isFinite(n)) { return '∞'; }
    if (n < 60) { return fmt2(n) + 's'; }
    var mins = Math.floor(n / 60);
    var secs = Math.round(n % 60);
    return mins + 'm ' + secs + 's';
  }












  var SECTION_ICON_FILES = {
    weapon:      'ForgeCalculator-weapon.png',
    ore:         'ForgeCalculator-ore.png',
    race:        'ForgeCalculator-race.png',
    berserk:     'ForgeCalculator-berserk.png',
    achievement: 'ForgeCalculator-achievement.png',
    rune:        'ForgeCalculator-rune.png',
    armor:       'ForgeCalculator-armor.png',
    ability:     'ForgeCalculator-ability.png',
    fire:        'ForgeCalculator-fire.png',
    blast:       'ForgeCalculator-blast.png',
    poison:      'ForgeCalculator-poison.png',
    reset:       'ForgeCalculator-reset.png',
    calc:        'ForgeCalculator-calc.png'
  };


  var ICON_PLACEHOLDERS = [];

  function iconImg(name, alt) {
    var wrap = createEl('span', { class: 'fc-section-icon fc-section-icon--' + name });
    var file = SECTION_ICON_FILES[name] || SECTION_ICON_FILES.ability;
    ICON_PLACEHOLDERS.push({ wrap: wrap, file: file, alt: alt || name });
    return wrap;
  }




  function splitIconHtml(html) {
    var blocks = String(html || '').match(/<p>[\s\S]*?<\/p>/g);
    if (!blocks) { return []; }
    return blocks.map(function (b) {
      return b.replace(/^<p>/, '').replace(/<\/p>\s*$/, '');
    });
  }

  function loadSectionIcons() {
    var pending = ICON_PLACEHOLDERS.slice();
    if (!pending.length) { return; }
    if (!mw.loader || typeof mw.loader.using !== 'function') { return; }
    mw.loader.using('mediawiki.api').then(function () {
      if (!mw.Api) { return; }
      var api = new mw.Api();
      if (!api || typeof api.parse !== 'function') { return; }
      var text = pending.map(function (p) {
        return '[[File:' + p.file + '|frameless|link=File:' + p.file + '|alt=' + p.alt + '|24px]]';
      }).join('\n\n');
      api.parse(text).then(function (html) {
        var blocks = splitIconHtml(html);
        for (var i = 0; i < pending.length && i < blocks.length; i++) {
          pending[i].wrap.innerHTML = blocks[i];
        }
      }, function () {

      });
    });
  }


  function sectionHeader(title) {
    var wrap = createEl('div', { class: 'fc-section' });
    wrap.append(
      createEl('span', { class: 'fc-section-dot' }),
      createEl('h2', { class: 'fc-section-title' }, [title]),
      createEl('span', { class: 'fc-section-line' })
    );
    return wrap;
  }

  function createTabber(id, tabs) {
    var container = createEl('div', { class: 'fc-tabber' });
    var bar = createEl('div', { class: 'fc-tabs', role: 'tablist' });
    var buttons = [];
    var panels = [];
    function select(index) {
      for (var j = 0; j < tabs.length; j++) {
        buttons[j].classList.toggle('fc-tab--active', j === index);
        buttons[j].setAttribute('aria-selected', j === index ? 'true' : 'false');
        panels[j].classList.toggle('fc-hidden', j !== index);
      }
    }
    tabs.forEach(function (tab, index) {
      var button = createEl('button', {
        type: 'button', class: 'fc-tab', role: 'tab', id: id + '-tab-' + (index + 1)
      }, [tab.title]);
      button.addEventListener('click', function (e) { e.preventDefault(); select(index); });
      var panel = createEl('div', { class: 'fc-tab-panel', role: 'tabpanel' });
      tab.content.forEach(function (node) { panel.appendChild(node); });
      buttons.push(button);
      panels.push(panel);
      bar.appendChild(button);
    });
    container.appendChild(bar);
    panels.forEach(function (panel) { container.appendChild(panel); });
    select(0);
    container.select = select;
    return container;
  }

  var HERO_ART_FILE = 'Gradient Weapons.webp';

  function createHero() {
    var hero = createEl('div', { class: 'fc-hero' });
    var art = createEl('div', { class: 'fc-hero-art' });
    var left = createEl('div', { class: 'fc-hero-left' });
    var stats = createEl('div', { class: 'fc-hero-stats' });
    var values = {};
    [
      { key: 'total', sub: 'Total DPS' },
      { key: 'golem', sub: 'Golem (25,000 HP)' },
      { key: 'asura', sub: 'Asura (75,000 HP)' }
    ].forEach(function (item) {
      var value = createEl('div', { class: 'fc-hero-stat-label' }, ['—']);
      values[item.key] = value;
      stats.appendChild(createEl('div', { class: 'fc-hero-stat' }, [
        value,
        createEl('div', { class: 'fc-hero-stat-sub' }, [item.sub])
      ]));
    });
    left.append(
      createEl('span', { class: 'fc-hero-badge' }, ['DPS Calculator']),
      createEl('div', { class: 'fc-hero-title' }, ['Forge Calculator']),
      createEl('div', { class: 'fc-hero-desc' }, [
        'Pick your ores, weapon, race, runes and Golemites, then press Calculate DPS to see your damage, ' +
        'every proc and how long a boss takes to fall. Percentages are whole numbers (15 = 15%).'
      ]),
      stats
    );
    hero.append(art, createEl('div', { class: 'fc-hero-gradient' }), left);
    hero.update = function (result) {
      values.total.textContent = fmtDps(result.total_dps);
      values.golem.textContent = fmtTime(result.ttk_25k);
      values.asura.textContent = fmtTime(result.ttk_75k);
    };
    loadHeroArt(art);
    return hero;
  }

  function loadHeroArt(wrap) {
    if (!mw.loader || typeof mw.loader.using !== 'function') { return; }
    mw.loader.using('mediawiki.api').then(function () {
      if (!mw.Api) { return; }
      var api = new mw.Api();
      if (!api || typeof api.parse !== 'function') { return; }
      api.parse('[[File:' + HERO_ART_FILE + '|frameless|900px|link=|alt=]]').then(function (html) {
        var img = /<img[^>]*>/.exec(String(html || ''));
        if (img) { wrap.innerHTML = img[0]; }
      }, function () {});
    });
  }

  function createActionBar(handlers) {
    var bar = createEl('div', { class: 'fc-toolbar' });
    var resetBtn = createEl('button', { class: 'fc-btn fc-btn--reset', type: 'button' },
      [iconImg('reset', 'Reset'), 'Reset']);
    var calcBtn = createEl('button', { class: 'fc-btn fc-btn--calc', type: 'button' },
      [iconImg('calc', 'Calculate DPS'), 'Calculate DPS']);
    resetBtn.addEventListener('click', function (e) { e.preventDefault(); handlers.onReset(); });
    calcBtn.addEventListener('click', function (e) { e.preventDefault(); handlers.onCalculate(); });
    bar.append(resetBtn, calcBtn);
    return bar;
  }

  function sectionTitle(title, iconName) {
    var h3 = createEl('h3', { class: 'fc-input-section-title' });
    h3.appendChild(iconImg(iconName, title));
    h3.appendChild(document.createTextNode(title));
    return h3;
  }



  function createResultsPanel(handlers) {
    var container = createEl('div', { class: 'fc-results-panel' });

    var cardsContainer = createEl('div', { class: 'fc-results-cards' });
    container.append(sectionHeader('Results'), cardsContainer);

    var coreDpsCard = createResultsCard({
      title: 'Core DPS',
      content: createStatRows([
        { label: 'Base Damage', value: '0', valueClass: 'fc-sv-dmg' },
        { label: 'Average Multiplier', value: '0.00x', valueClass: 'fc-sv-mult' },
        { label: 'Weapon Damage', value: '0', valueClass: 'fc-sv-dmg' },
        { label: 'Attack Rate', value: '0.00', valueClass: 'fc-sv-rate' },
        { label: 'Weapon DPS', value: '0', valueClass: 'fc-sv-dmg' }
      ])
    });

    var statsCard = createResultsCard({
      title: 'Stats (Capped)',
      content: createStatRows([
        { label: 'Lethality', value: '0.00%', valueClass: 'fc-sv-pct' },
        { label: 'Crit Chance', value: '0.00%', valueClass: 'fc-sv-pct' },
        { label: 'Crit Damage', value: '0.00%', valueClass: 'fc-sv-pct' },
        { label: 'Attack Speed', value: '0.00%', valueClass: 'fc-sv-pct' },
        { label: 'Berserk', value: '0.00%', valueClass: 'fc-sv-pct' }
      ])
    });

    var dpsCard = createResultsCard({
      title: 'DPS Breakdown',
      content: createStatRows([
        { label: 'Weapon DPS', value: '0', valueClass: 'fc-sv-dmg', labelClass: 'fc-sv-dmg' },
        { label: 'Explosion DPS', value: '0', valueClass: 'fc-sv-blast', labelClass: 'fc-sv-blast' },
        { label: 'Fire DPS', value: '0', valueClass: 'fc-sv-fire', labelClass: 'fc-sv-fire' },
        { label: 'Poison DPS', value: '0', valueClass: 'fc-sv-poison', labelClass: 'fc-sv-poison' },
        { label: 'Smite DPS', value: '0', valueClass: 'fc-sv-smite', labelClass: 'fc-sv-smite' },
        { label: 'Black Hole DPS', value: '0', valueClass: 'fc-sv-blackhole', labelClass: 'fc-sv-blackhole' },
        { label: 'Lightning DPS', value: '0', valueClass: 'fc-sv-lightning', labelClass: 'fc-sv-lightning' },
        { label: 'Smash DPS', value: '0', valueClass: 'fc-sv-smash', labelClass: 'fc-sv-smash' },
        { label: 'Fox Claws DPS', value: '0', valueClass: 'fc-sv-foxclaws', labelClass: 'fc-sv-foxclaws' },
        { label: 'Foxfire DPS', value: '0', valueClass: 'fc-sv-foxfire', labelClass: 'fc-sv-foxfire' },
        { label: 'Archangel Smite DPS', value: '0', valueClass: 'fc-sv-smite', labelClass: 'fc-sv-smite' },
        { label: 'Cursed Aura DPS', value: '0', valueClass: 'fc-sv-aura', labelClass: 'fc-sv-aura' },
        { label: 'Golemite DPS', value: '0', valueClass: 'fc-sv-golemite', labelClass: 'fc-sv-golemite' },
        { label: 'Total DPS', value: '0', valueClass: 'fc-sv-dmg fc-bold', labelClass: 'fc-sv-dmg' },
        { label: 'Total Berserk DPS', value: '—', valueClass: 'fc-sv-berserk', labelClass: 'fc-sv-berserk' },
        { label: 'Total Moonstone DPS', value: '—', valueClass: 'fc-sv-moonstone', labelClass: 'fc-sv-moonstone' }
      ])
    });

    var ttkCard = createResultsCard({
      title: 'Time to Kill',
      content: createStatRows([
        { label: 'Time taken to defeat Golem', value: '0.00s', valueClass: 'fc-sv-time' },
        { label: 'Time taken to defeat Asura', value: '0.00s', valueClass: 'fc-sv-time' }
      ])
    });

    var traitsCard = createResultsCard({
      title: 'Active Traits',
      content: createStatRows([
        { label: 'No active traits', value: '' }
      ])
    });

    var totalDpsCard = createResultsCard({
      title: 'Total DPS',
      hideIcon: true,
      content: createStatRows([
        { label: '', value: '0' }
      ])
    });


    totalDpsCard.classList.add('fc-card--total');
    coreDpsCard.classList.add('fc-card--core');
    statsCard.classList.add('fc-card--stats');
    dpsCard.classList.add('fc-card--dps');
    ttkCard.classList.add('fc-card--ttk');
    traitsCard.classList.add('fc-card--traits');

    cardsContainer.append(totalDpsCard, dpsCard, statsCard, traitsCard, coreDpsCard, ttkCard);

    container.updateResults = function (result) {
      if (!result) { return; }

      var totalRows = totalDpsCard.querySelectorAll('.fc-stat-row');
      if (totalRows.length >= 1) {
        updateStatRow(totalRows[0], fmtDps(result.total_dps), false);
      }

      var coreRows = coreDpsCard.querySelectorAll('.fc-stat-row');
      if (coreRows.length >= 5) {
        updateStatRow(coreRows[0], fmtDps(result.unforged_damage), false);
        updateStatRow(coreRows[1], fmt2(result.avg_power) + 'x', false);
        updateStatRow(coreRows[2], fmtDps(result.forged_damage), false);
        updateStatRow(coreRows[3], fmt2(result.attack_rate), false);
        updateStatRow(coreRows[4], fmtDps(result.weapon_dps), false);
      }

      var statRows = statsCard.querySelectorAll('.fc-stat-row');
      if (statRows.length >= 5) {
        updateStatRow(statRows[0], pctFmt(result.lethality), result.lethality >= CAPS.lethality);
        updateStatRow(statRows[1], pctFmt(result.crit_chance), result.crit_chance >= CAPS.crit_chance);
        updateStatRow(statRows[2], pctFmt(result.crit_dmg), result.crit_dmg >= CAPS.crit_dmg);
        updateStatRow(statRows[3], pctFmt(result.atk_speed), result.atk_speed >= CAPS.atk_speed);
        updateStatRow(statRows[4], pctFmt(result.berserk_level), result.berserk_level >= CAPS.berserk);
      }

      var dpsRows = dpsCard.querySelectorAll('.fc-stat-row');
      if (dpsRows.length >= 16) {
        updateStatRow(dpsRows[0], fmtDps(result.weapon_dps), false);
        updateStatRow(dpsRows[1], fmtDps(result.explosion_dps), false);
        updateStatRow(dpsRows[2], fmtDps(result.fire_dps), false);
        updateStatRow(dpsRows[3], fmtDps(result.poison_dps), false);
        updateStatRow(dpsRows[4], fmtDps(result.smite_dps), false);
        updateStatRow(dpsRows[5], fmtDps(result.blackhole_dps), false);
        updateStatRow(dpsRows[6], fmtDps(result.lightning_dps), false);
        updateStatRow(dpsRows[7], fmtDps(result.smash_dps), false);
        updateStatRow(dpsRows[8], fmtDps(result.fox_claws_dps), false);
        updateStatRow(dpsRows[9], fmtDps(result.foxfire_dps), false);
        updateStatRow(dpsRows[10], fmtDps(result.archangel_smite_dps), false);
        updateStatRow(dpsRows[11], fmtDps(result.cursed_aura_dps), false);
        updateStatRow(dpsRows[12], fmtDps(result.golemite_dps), false);
        updateStatRow(dpsRows[13], fmtDps(result.total_dps), false);
        updateStatRow(dpsRows[14], fmtDps(result.berserk), false);
        updateStatRow(dpsRows[15], fmtDps(result.moonstone), false);
      }

      var ttkRows = ttkCard.querySelectorAll('.fc-stat-row');
      if (ttkRows.length >= 2) {
        updateStatRow(ttkRows[0], fmtTime(result.ttk_25k), false);
        updateStatRow(ttkRows[1], fmtTime(result.ttk_75k), false);
      }

      if (result.active_traits) {


        var traitsBlock = createEl('div', { class: 'fc-traits-block' });
        var traitsValue = createEl('div', { class: 'fc-traits-value', style: { whiteSpace: 'pre-line' } }, [result.active_traits]);
        traitsValue.classList.add('fc-copyable');
        traitsValue.setAttribute('title', 'Click to copy');
        traitsValue.addEventListener('click', function () {
          var t = traitsValue.textContent.trim();
          if (t) { writeClipboard(t, 'Copied: ' + t); }
        });
        traitsBlock.append(
          createEl('div', { class: 'fc-traits-label' }, ['Active Traits']),
          traitsValue
        );
        updateResultsCard(traitsCard, traitsBlock);
      }
    };

    return container;
  }

  function createInputPanel(opts) {
    var data = opts.data;
    var getBuild = opts.getBuild;
    var onBuildChange = opts.onBuildChange;
    var onCalculate = opts.onCalculate;

    var noneLabel = data.constants.noneLabel;
    var selectOreLabel = data.constants.selectOreLabel;


    var ORE_PROMPT = 'Select Ores';
    var RACE_PROMPT = 'Select Race';
    var WEAPON_TYPE_PROMPT = 'Select Weapon Type';
    var WEAPON_PROMPT = 'Select Weapon';
    var ENHANCEMENT_PROMPT = 'Select Enhancement';
    var ACHIEVEMENT_PROMPT = 'Select Achievement';
    var RUNE_PROMPT = 'Select Rune';

    function toUI(val, prompt) { return (val === noneLabel || val === undefined) ? prompt : val; }
    function fromUI(val, prompt) { return val === prompt ? noneLabel : val; }

    var container = createEl('div', { class: 'fc-input-panel' });

    container.appendChild(sectionHeader('Build'));

    function patch(partial) {
      var merged = {};
      var base = getBuild();
      for (var k in base) { merged[k] = base[k]; }
      for (var p in partial) { merged[p] = partial[p]; }
      onBuildChange(merged);
    }

    var oreSection = createEl('div', { class: 'fc-input-section' });
    oreSection.appendChild(sectionTitle('Ore Slots', 'ore'));

    var oreNames = data.ores.map(function (o) { return o.name; });
    var oreMultipliers = {};
    for (var j = 0; j < data.ores.length; j++) {
      oreMultipliers[data.ores[j].name] = data.ores[j].multiplier;
    }
    var oreSlots = [];
    var oreGrid = createEl('div', { class: 'fc-ore-grid' });
    for (var i = 0; i < 4; i++) {
      (function (idx) {
        var slotBuild = getBuild().oreSlots[idx] || { name: noneLabel, amount: 0 };
        var slot = createOreSlot({
          index: idx,
          oreNames: oreNames,
          noneLabel: noneLabel,
          selectOreLabel: selectOreLabel,
          prompt: ORE_PROMPT,
          oreMultipliers: oreMultipliers,
          value: slotBuild.name,
          amount: slotBuild.amount || 0,
          onChange: function (name, amount) {
            var slots = getBuild().oreSlots.slice();
            slots[idx] = { name: name, amount: amount };
            patch({ oreSlots: slots });
            weaponSelector.setOreTotal(oreTotalOf(getBuild()));
          }
        });
        oreSlots.push(slot);
        oreGrid.appendChild(slot);
      })(i);
    }
    oreSection.appendChild(oreGrid);

    var weaponSection = createEl('div', { class: 'fc-input-section fc-input-section--flat' });
    weaponSection.appendChild(sectionTitle('Weapon', 'weapon'));

    function oreTotalOf(build) {
      var total = 0;
      for (var t = 0; t < build.oreSlots.length; t++) { total += Number(build.oreSlots[t].amount) || 0; }
      return total;
    }

    var weaponSelector = createWeaponSelector({
      typeMinOre: data.weapon_type_min_ore,
      notEnoughOre: data.not_enough_ore,
      oreTotal: oreTotalOf(getBuild()),
      weaponTypes: data.weapon_types,
      weapons: data.weapons,
      noneLabel: noneLabel,
      weaponTypePrompt: WEAPON_TYPE_PROMPT,
      weaponPrompt: WEAPON_PROMPT,
      enhancementPrompt: ENHANCEMENT_PROMPT,
      weaponType: getBuild().weaponType,
      weaponName: getBuild().weaponName,
      quality: getBuild().quality,
      enhancement: getBuild().enhancement,
      onChange: function (weaponType, weaponName, quality, enhancement) {
        patch({ weaponType: weaponType, weaponName: weaponName, quality: quality, enhancement: enhancement });
      }
    });
    weaponSection.appendChild(weaponSelector);




    var metaWrap = createEl('div', { class: 'fc-meta-wrap' });
    var raceSection = createEl('div', { class: 'fc-input-section' });
    raceSection.appendChild(sectionTitle('Race', 'race'));

    var raceWrapper = createEl('div', { class: 'fc-race-wrapper' });
    var raceLabel = createEl('label', { for: 'race-select' }, ['Race']);
    var raceOptions = [RACE_PROMPT].concat(data.races.map(function (r) { return r.name; }));
    var raceDropdown = createSearchableDropdown({
      options: raceOptions,
      value: toUI(getBuild().race, RACE_PROMPT),
      placeholder: RACE_PROMPT,
      id: 'race-select',
      onChange: function (race) {
        var picked = fromUI(race, RACE_PROMPT);
        patch({ race: picked });
        syncSituational(picked);
      }
    });
    raceWrapper.append(raceLabel, raceDropdown);

    raceSection.appendChild(raceWrapper);
    metaWrap.appendChild(raceSection);

    var berserkSection = createEl('div', { class: 'fc-input-section' });
    berserkSection.appendChild(sectionTitle('Berserk', 'berserk'));

    var berserkWrapper = createEl('div', { class: 'fc-berserk-wrapper' });
    var berserkLabel = createEl('label', { for: 'berserk' }, ['Berserk']);
    var berserkInput = createEl('input', {
      type: 'number',
      class: 'fc-stat-input-input',
      id: 'berserk',
      value: getBuild().berserk !== undefined ? getBuild().berserk : '',
      min: '0',
      max: '200',
      step: 1,
      placeholder: '0',
      inputmode: 'numeric'
    });
    function commitBerserk() {
      var v = Math.max(0, Math.min(parseFloat(berserkInput.value) || 0, 200));
      berserkInput.value = v;
      patch({ berserk: v });
    }
    var handleBerserkChange = debounce(commitBerserk, 150);
    berserkInput.addEventListener('input', handleBerserkChange);
    berserkInput.addEventListener('change', commitBerserk);
    berserkWrapper.append(berserkLabel, berserkInput);
    berserkSection.appendChild(berserkWrapper);
    metaWrap.appendChild(berserkSection);

    var situationalSection = createEl('div', { class: 'fc-input-section fc-situational-section' });
    situationalSection.appendChild(sectionTitle('Situational', 'race'));
    var situationalGrid = createEl('div', { class: 'fc-situational-grid' });
    situationalSection.appendChild(situationalGrid);

    function numberField(key, labelText, max, toNumber) {
      var wrapper = createEl('div', { class: 'fc-berserk-wrapper' });
      var label = createEl('label', { for: 'fc-' + key }, [labelText]);
      var attrs = {
        type: 'number', class: 'fc-stat-input-input', id: 'fc-' + key,
        value: getBuild()[key] !== undefined ? getBuild()[key] : 0,
        min: '0', step: 1, placeholder: '0', inputmode: 'numeric'
      };
      if (max !== null) { attrs.max = String(max); }
      var input = createEl('input', attrs);
      function commit() {
        var v = Math.max(0, toNumber(parseFloat(input.value) || 0));
        if (max !== null) { v = Math.min(v, max); }
        input.value = v;
        var change = {};
        change[key] = v;
        patch(change);
      }
      input.addEventListener('input', debounce(commit, 150));
      input.addEventListener('change', commit);
      wrapper.append(label, input);
      situationalGrid.appendChild(wrapper);
      return { wrapper: wrapper, input: input };
    }

    var orcHpField = numberField('orcLordHpMissing', 'HP missing %', 100, function (v) { return v; });
    var orcKillsField = numberField('orcLordKillStacks', 'Kill stacks', 5, Math.floor);
    var groveWrapper = createEl('div', { class: 'fc-berserk-wrapper' });
    var groveLabel = createEl('label', { for: 'fc-dryadInGrove' }, ['In grove']);
    var groveInput = createEl('button', { type: 'button', class: 'fc-check', id: 'fc-dryadInGrove', role: 'checkbox' });
    function setGrove(on) {
      groveInput.setAttribute('aria-checked', on ? 'true' : 'false');
      groveInput.classList.toggle('fc-check--on', on);
      groveInput.textContent = on ? '✓' : '';
    }
    setGrove(getBuild().dryadInGrove === true);
    groveInput.addEventListener('click', function () {
      var on = groveInput.getAttribute('aria-checked') !== 'true';
      setGrove(on);
      patch({ dryadInGrove: on });
    });
    groveWrapper.append(groveLabel, groveInput);
    situationalGrid.appendChild(groveWrapper);
    var dryadHpField = numberField('dryadMaxHp', 'Max HP', null, Math.floor);

    function syncSituational(race) {
      var isOrcLord = race === 'Orc Lord';
      var isDryad = race === 'Dryad';
      orcHpField.wrapper.style.display = isOrcLord ? '' : 'none';
      orcKillsField.wrapper.style.display = isOrcLord ? '' : 'none';
      groveWrapper.style.display = isDryad ? '' : 'none';
      dryadHpField.wrapper.style.display = isDryad ? '' : 'none';
      situationalSection.style.display = isOrcLord || isDryad ? '' : 'none';
    }
    syncSituational(getBuild().race);

    var statSection = createEl('div', { class: 'fc-input-section' });
    statSection.appendChild(sectionTitle('Armor Stats', 'armor'));

    var statInput = createStatInput({
      values: {
        armorLethality: getBuild().armorLethality,
        armorCritChance: getBuild().armorCritChance,
        armorCritDmg: getBuild().armorCritDmg
      },
      onChange: function (values) { patch(values); }
    });
    statSection.appendChild(statInput);

    var abilitySection = createEl('div', { class: 'fc-input-section' });
    abilitySection.appendChild(sectionTitle('Abilities (From Runes)', 'ability'));
    abilitySection.appendChild(createEl('p', { class: 'fc-input-section-subtext' }, [
      'Input abilities from Runes. Enter percentage as whole number.'
    ]));

    var abilityGrid = createAbilityGrid({
      values: {
        fireDmg: getBuild().fireDmg,
        fireChance: getBuild().fireChance,
        fireTime: getBuild().fireTime,
        poisonDmg: getBuild().poisonDmg,
        poisonChance: getBuild().poisonChance,
        poisonTime: getBuild().poisonTime,
        lightningDmg: getBuild().lightningDmg,
        lightningChance: getBuild().lightningChance,
        lightningCooldown: getBuild().lightningCooldown,
        blastDmg: getBuild().blastDmg,
        blastChance: getBuild().blastChance
      },
      onChange: function (values) { patch(values); }
    });
    abilitySection.appendChild(abilityGrid);

    var golemiteSection = createEl('div', { class: 'fc-input-section' });
    golemiteSection.appendChild(sectionTitle('Golemites', 'golemite'));
    golemiteSection.appendChild(createEl('p', { class: 'fc-input-section-subtext' }, [
      'Up to two Golemites. Pick the ores you forged each one with, like a weapon. Its rarity is the rarest ore used, and every ore trait is scaled by that rarity (Common ×0.06 up to Divine ×0.30).'
    ]));
    var golemiteInputs = createGolemiteInputs({
      values: getBuild().golemites,
      oreNames: oreNames,
      oreMultipliers: oreMultipliers,
      noneLabel: noneLabel,
      selectOreLabel: selectOreLabel,
      prompt: ORE_PROMPT,
      describe: function (g) { return deriveGolemiteStats(g.slots, data); },
      onChange: function (list) { patch({ golemites: list }); }
    });
    golemiteSection.appendChild(golemiteInputs);

    var runeSection = createEl('div', { class: 'fc-input-section' });
    runeSection.appendChild(sectionTitle('Runes', 'rune'));

    var runeSelector = createRuneSelector({
      runes: data.runes,
      values: getBuild().runes || [],
      noneLabel: noneLabel,
      prompt: RUNE_PROMPT,
      onChange: function (runes) { patch({ runes: runes }); }
    });
    runeSection.appendChild(runeSelector);

    var achievementSection = createEl('div', { class: 'fc-input-section' });
    achievementSection.appendChild(sectionTitle('Achievement', 'achievement'));

    var achievementWrapper = createEl('div', { class: 'fc-achievement-wrapper' });
    var achievementLabel = createEl('label', { for: 'achievement-select' }, ['Achievement']);
    var achievementNames = data.achievements
      .map(function (a) { return a.name; })
      .filter(function (n) { return n !== noneLabel && n !== 'None'; });
    var achievementOptions = [ACHIEVEMENT_PROMPT].concat(achievementNames);
    var achievementDropdown = createSearchableDropdown({
      options: achievementOptions,
      value: toUI(getBuild().achievement, ACHIEVEMENT_PROMPT),
      placeholder: ACHIEVEMENT_PROMPT,
      id: 'achievement-select',
      onChange: function (name) { patch({ achievement: fromUI(name, ACHIEVEMENT_PROMPT) }); }
    });
    achievementWrapper.append(achievementLabel, achievementDropdown);
    achievementSection.appendChild(achievementWrapper);
    metaWrap.appendChild(achievementSection);

    var metaRow = createEl('div', { class: 'fc-meta-row' });
    metaRow.append(metaWrap, situationalSection);

    container.appendChild(createTabber('fc-build', [
      { title: 'Weapon & Ores', content: [weaponSection, oreSection] },
      { title: 'Race & Bonuses', content: [metaRow] },
      { title: 'Runes & Armor', content: [runeSection, statSection] },
      { title: 'Abilities', content: [abilitySection] },
      { title: 'Golemites', content: [golemiteSection] }
    ]));

    var warningsBox = createEl('div', { class: 'fc-warnings fc-hidden' });
    container.appendChild(warningsBox);
    if (opts.actions) { container.appendChild(opts.actions); }


    container.refreshWarnings = function () {
      var list = computeWarnings(getBuild());
      if (abilityGrid.getInvalidAbilityWarnings) {
        list = list.concat(abilityGrid.getInvalidAbilityWarnings());
      }
      empty(warningsBox);
      if (list.length) {
        for (var i = 0; i < list.length; i++) {
          warningsBox.appendChild(createEl('div', { class: 'fc-warning' }, ['⚠ ' + list[i]]));
        }
        warningsBox.classList.remove('fc-hidden');
      } else {
        warningsBox.classList.add('fc-hidden');
      }
    };

    container.setBuild = function (newBuild) {
      for (var s = 0; s < 4; s++) {
        var slot = newBuild.oreSlots[s] || { name: noneLabel, amount: 0 };
        oreSlots[s].setValue(slot.name, slot.amount || 0);
      }
      weaponSelector.setOreTotal(oreTotalOf(newBuild));
      weaponSelector.setValues(
        newBuild.weaponType || noneLabel,
        newBuild.weaponName || noneLabel,
        newBuild.quality !== undefined ? newBuild.quality : 100,
        newBuild.enhancement !== undefined ? newBuild.enhancement : 0
      );
      raceDropdown.setValue(toUI(newBuild.race, RACE_PROMPT));
      if (berserkInput) {
        berserkInput.value = newBuild.berserk !== undefined ? newBuild.berserk : 0;
      }
      orcHpField.input.value = newBuild.orcLordHpMissing || 0;
      orcKillsField.input.value = newBuild.orcLordKillStacks || 0;
      setGrove(newBuild.dryadInGrove === true);
      dryadHpField.input.value = newBuild.dryadMaxHp || 0;
      syncSituational(newBuild.race);
      statInput.setValues({
        armorLethality: newBuild.armorLethality,
        armorCritChance: newBuild.armorCritChance,
        armorCritDmg: newBuild.armorCritDmg
      });
      abilityGrid.setValues({
        fireDmg: newBuild.fireDmg,
        fireChance: newBuild.fireChance,
        fireTime: newBuild.fireTime,
        poisonDmg: newBuild.poisonDmg,
        poisonChance: newBuild.poisonChance,
        poisonTime: newBuild.poisonTime,
        lightningDmg: newBuild.lightningDmg,
        lightningChance: newBuild.lightningChance,
        lightningCooldown: newBuild.lightningCooldown,
        blastDmg: newBuild.blastDmg,
        blastChance: newBuild.blastChance
      });
      runeSelector.setValues(newBuild.runes || []);
      achievementDropdown.setValue(toUI(newBuild.achievement, ACHIEVEMENT_PROMPT));
      golemiteInputs.setValues(newBuild.golemites);
    };



    loadSectionIcons();

    return container;
  }

  var DEFAULT_BUILD = {
    oreSlots: [
      { name: NONE_LABEL, amount: 0 },
      { name: NONE_LABEL, amount: 0 },
      { name: NONE_LABEL, amount: 0 },
      { name: NONE_LABEL, amount: 0 }
    ],
    weaponType: NONE_LABEL,
    weaponName: NONE_LABEL,
    quality: 100,
    enhancement: 0,
    race: NONE_LABEL,
    armorLethality: 0,
    armorCritChance: 0,
    armorCritDmg: 0,
    fireDmg: 0,
    fireChance: 0,
    fireTime: 0,
    poisonDmg: 0,
    poisonChance: 0,
    poisonTime: 0,
    lightningDmg: 0,
    lightningChance: 0,
    lightningCooldown: 0,
    blastDmg: 0,
    blastChance: 0,
    berserk: 0,
    orcLordHpMissing: 0,
    orcLordKillStacks: 0,
    dryadInGrove: false,
    dryadMaxHp: 0,
    runes: [NONE_LABEL, NONE_LABEL, NONE_LABEL, NONE_LABEL, NONE_LABEL, NONE_LABEL, NONE_LABEL, NONE_LABEL, NONE_LABEL],
    achievement: NONE_LABEL,
    golemites: [emptyGolemite(), emptyGolemite()]
  };

  var state = {
    gameData: null,
    build: DEFAULT_BUILD,
    inputPanel: null,
    resultsPanel: null
  };




  function deriveBonusType(build) {
    if (!state.gameData || !build.weaponName || build.weaponName === NONE_LABEL) { return ''; }
    var weapon = state.gameData._weapon_index.get(build.weaponName);
    return weapon ? weapon.type : '';
  }



  function computeWarnings(build) {
    var warnings = [];
    if (!build.weaponName || build.weaponName === NONE_LABEL) {
      warnings.push('No weapon selected — weapon damage and most DPS will be 0.');
    }
    var total = 0;
    for (var i = 0; i < build.oreSlots.length; i++) {
      total += Number(build.oreSlots[i].amount) || 0;
    }
    if (total === 0) {
      warnings.push('No ore amounts entered — Average Multiplier is 1.00x and no ore stats or traits apply.');
    }
    for (var j = 0; j < build.oreSlots.length; j++) {
      var slot = build.oreSlots[j];
      if (!slot.name || slot.name === NONE_LABEL) { continue; }
      var amt = Number(slot.amount) || 0;
      if (amt === 0) {
        warnings.push('Slot ' + (j + 1) + ': ' + slot.name + ' is selected but amount is 0.');
      } else if (total > 0 && amt / total < SHARE_GATE) {
        warnings.push('Slot ' + (j + 1) + ': ' + slot.name + ' is below 10% share — it contributes no stats.');
      }
    }
    var weapon = state.gameData && build.weaponName ? state.gameData._weapon_index.get(build.weaponName) : null;
    var minOre = weapon && state.gameData.weapon_type_min_ore ? state.gameData.weapon_type_min_ore[weapon.type] : undefined;
    if (minOre !== undefined && total < minOre) {
      warnings.push(weapon.type + ' weapons need at least ' + minOre + ' total ore (you have ' + total + ').');
    }
    if (!(Number(build.quality) > 0)) {
      warnings.push('Quality is 0% — damage is at base (1.0x), not the usual 2x from 100%.');
    }
    return warnings;
  }

  function transformBuildForEngine(build) {
    return {
      slots: build.oreSlots.map(function (s) { return { name: s.name, amount: Number(s.amount) || 0 }; }),
      weapon_name: build.weaponName,
      quality: Number(build.quality) || 0,
      forge_level: Number(build.enhancement) || 0,
      race: build.race,
      bonus_weapon_type: deriveBonusType(build),
      rune_cells: build.runes || [],
      base_crit_chance: 0,
      base_crit_dmg: 1.45,
      armor_crit_chance: (Number(build.armorCritChance) || 0) / 100,
      armor_crit_dmg: (Number(build.armorCritDmg) || 0) / 100,
      armor_lethality: (Number(build.armorLethality) || 0) / 100,
      base_lethality: 0,
      abilities: {


        fire_dmg: (Number(build.fireDmg) || 0) / 100,
        fire_chance: (Number(build.fireChance) || 0) / 100,
        fire_time: Number(build.fireTime) || 0,
        poison_dmg: (Number(build.poisonDmg) || 0) / 100,
        poison_chance: (Number(build.poisonChance) || 0) / 100,
        poison_time: Number(build.poisonTime) || 0,
        lightning_dmg: (Number(build.lightningDmg) || 0) / 100,
        lightning_chance: (Number(build.lightningChance) || 0) / 100,
        lightning_cooldown: Number(build.lightningCooldown) || 0,
        blast_dmg: (Number(build.blastDmg) || 0) / 100,
        blast_chance: (Number(build.blastChance) || 0) / 100
      },



      berserk: (Number(build.berserk) || 0) / 100,
      achievement: build.achievement || NONE_LABEL,
      dryad_in_grove: build.dryadInGrove === true,
      dryad_max_hp: Number(build.dryadMaxHp) || 0,
      orc_lord_hp_missing: (Number(build.orcLordHpMissing) || 0) / 100,
      orc_lord_kill_stacks: Number(build.orcLordKillStacks) || 0,
      golemites: golemiteBuildValues(build.golemites).map(function (g) {
        return golemiteEngineValues(g, state.gameData);
      })
    };
  }

  function recalculate() {
    if (!state.gameData) { return; }
    try {
      var result = calculate(transformBuildForEngine(state.build), state.gameData);
      state.resultsPanel.updateResults(result);
      if (state.hero) { state.hero.update(result); }
    } catch (err) {
      if (mw.log) { mw.log('Forge Calculator: calculation error', err); }
    }
  }

  function handleBuildChange(newBuild) {

    state.build = newBuild;
    if (state.inputPanel && state.inputPanel.refreshWarnings) { state.inputPanel.refreshWarnings(); }
  }

  function resetBuild() {
    state.build = DEFAULT_BUILD;
    if (state.inputPanel) { state.inputPanel.setBuild(DEFAULT_BUILD); }
    if (state.inputPanel && state.inputPanel.refreshWarnings) { state.inputPanel.refreshWarnings(); }
    recalculate();
    showToast('Calculator reset');
  }

  function writeClipboard(text, successMsg) {
    var done = function () { showToast(successMsg || 'Copied to clipboard'); };
    var failed = function () { showToast('Failed to copy', true); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, failed);
      return;
    }
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      done();
    } catch (e) {
      failed();
    }
    document.body.removeChild(ta);
  }

  function copyResults() {
    if (!state.gameData) { return; }
    try {
      var result = calculate(transformBuildForEngine(state.build), state.gameData);
      var text = formatResultsForClipboard(result, state.build);
      writeClipboard(text, 'Results copied to clipboard');
    } catch (err) {
      if (mw.log) { mw.log('Forge Calculator: copy failed', err); }
      showToast('Failed to copy', true);
    }
  }

  function formatResultsForClipboard(result, build) {
    var activeTraitsText = result.active_traits || 'None';
    var lines = [
      '=== Forge Calculator Results ===',
      '',
      'Weapon: ' + build.weaponName + ' (' + build.weaponType + ')',
      'Quality: ' + build.quality + '% | Enhancement: +' + build.enhancement,
      'Race: ' + build.race + ' | Weapon-Type Bonus: ' + (deriveBonusType(build) || 'None'),
      '',
      '--- Core DPS ---',
      'Base Damage: ' + result.unforged_damage.toFixed(2),
      'Average Multiplier: ' + result.avg_power.toFixed(2) + 'x',
      'Weapon Damage: ' + result.forged_damage.toFixed(2),
      'Attack Rate: ' + result.attack_rate.toFixed(2),
      'Weapon DPS: ' + result.weapon_dps.toFixed(2),
      '',
      '--- Stats (Capped) ---',
      'Lethality: ' + (result.lethality * 100).toFixed(2) + '%' + (result.lethality >= CAPS.lethality ? ' (CAPPED)' : ''),
      'Crit Chance: ' + (result.crit_chance * 100).toFixed(2) + '%' + (result.crit_chance >= CAPS.crit_chance ? ' (CAPPED)' : ''),
      'Crit Damage: ' + (result.crit_dmg * 100).toFixed(2) + '%' + (result.crit_dmg >= CAPS.crit_dmg ? ' (CAPPED)' : ''),
      'Attack Speed: ' + (result.atk_speed * 100).toFixed(2) + '%' + (result.atk_speed >= CAPS.atk_speed ? ' (CAPPED)' : ''),
      'Berserk: ' + (result.berserk_level * 100).toFixed(2) + '%' + (result.berserk_level >= CAPS.berserk ? ' (CAPPED)' : ''),
      '',
      '--- DPS Breakdown ---',
      'Weapon DPS: ' + result.weapon_dps.toFixed(2),
      'Explosion DPS: ' + result.explosion_dps.toFixed(2),
      'Fire DPS: ' + result.fire_dps.toFixed(2),
      'Poison DPS: ' + result.poison_dps.toFixed(2),
      'Smite DPS: ' + result.smite_dps.toFixed(2),
      'Black Hole DPS: ' + result.blackhole_dps.toFixed(2),
      'Lightning DPS: ' + result.lightning_dps.toFixed(2),
      'Smash DPS: ' + result.smash_dps.toFixed(2),
      'Fox Claws DPS: ' + result.fox_claws_dps.toFixed(2),
      'Foxfire DPS: ' + result.foxfire_dps.toFixed(2),
      'Archangel Smite DPS: ' + result.archangel_smite_dps.toFixed(2),
      'Cursed Aura DPS: ' + result.cursed_aura_dps.toFixed(2),
      'Golemite DPS: ' + result.golemite_dps.toFixed(2),
      'Total DPS: ' + result.total_dps.toFixed(2),
      '',
      '--- Time to Kill ---',
      'Golem: ' + result.ttk_25k.toFixed(2) + 's',
      'Asura: ' + result.ttk_75k.toFixed(2) + 's',
      '',
      '--- Active Traits ---',
      activeTraitsText,
      '',
      '--- Ore Slots ---',
      build.oreSlots.map(function (slot, i) { return 'Slot ' + (i + 1) + ': ' + slot.name + ' x' + slot.amount; }).join('\n'),
      '',
      '--- Runes ---',
      build.runes.filter(function (r) { return r && r !== NONE_LABEL; }).join(', ') || 'None',
      '',
      '--- Achievement ---',
      build.achievement || 'None'
    ];
    return lines.join('\n');
  }

  function showToast(message, isError) {
    var toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = 'position: fixed; bottom: 20px; right: 20px;' +
      'background: ' + (isError ? '#cc0000' : '#2e7d32') + '; color: white;' +
      'padding: 12px 20px; border-radius: 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.3);' +
      'z-index: 10001; opacity: 0; transition: opacity 0.2s ease;';
    document.body.appendChild(toast);
    window.requestAnimationFrame(function () { toast.style.opacity = '1'; });
    setTimeout(function () {
      toast.style.opacity = '0';
      setTimeout(function () { toast.remove(); }, 200);
    }, 2500);
  }

  function init(root) {
    var loading = root.querySelector('.fc-loading');
    if (loading) { loading.textContent = 'Loading game data…'; }
    loadGameData().then(function (gameData) {
      state.gameData = gameData;

      var body = createEl('div', { class: 'fc-body' });
      var left = createEl('div', { class: 'fc-left' });
      var right = createEl('div', { class: 'fc-right' });

      state.hero = createHero();

      state.inputPanel = createInputPanel({
        data: gameData,
        getBuild: function () { return state.build; },
        onBuildChange: handleBuildChange,
        onCalculate: recalculate,
        actions: createActionBar({ onReset: resetBuild, onCalculate: recalculate })
      });
      left.appendChild(state.inputPanel);

      state.resultsPanel = createResultsPanel({
        onCopy: copyResults,
        onReset: resetBuild,
        onCalculate: recalculate
      });
      right.appendChild(state.resultsPanel);



      loadSectionIcons();

      body.append(state.hero, left, right);

      root.textContent = '';
      root.appendChild(body);

      recalculate();
      if (state.inputPanel && state.inputPanel.refreshWarnings) { state.inputPanel.refreshWarnings(); }

      if (mw.hook) { mw.hook('forgeCalculator.ready').fire(); }
    }, function (err) {
      if (mw.log) { mw.log('Forge Calculator: failed to load data', err); }
      var msg = createEl('div', {
        class: 'fc-error',
        style: { padding: '1.5rem', color: '#cc0000' }
      }, ['Failed to load calculator data: ' + err.message +
         ' — check that Data:Ores.json, Data:Weapons.json, Data:Races.json, Data:Runes.json and Data:Achievements.json exist.']);
      root.textContent = '';
      root.appendChild(msg);
    });
  }

  function start() {

    if (document.body) {
      document.body.classList.add('fc-page');
    }

    var root = document.getElementById('fc-root');
    if (!root) { return; }
    init(root);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
}(window.mediaWiki));
