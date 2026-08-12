// Forge Calculator for MediaWiki — see Web/mediawiki/DEPLOY.md for setup
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

  // Share scaling gate and ramp
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
    'Dragonborn': 0.12
  };

  var CLASS_LETHALITY = {
    'Felynx,Gauntlet': 0.20,
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
    'Felynx,Gauntlets': 0.20
  };

  var RACE_FIRE_DMG = { 'Dragonborn': 0.30 };
  var RACE_FIRE_CHANCE = { 'Dragonborn': 0.40 };
  var RACE_FIRE_TIME = { 'Dragonborn': 3 };

  var RACE_SMITE_DMG = { 'Angel': 0.30, 'Archangel': 1.50 };
  var RACE_SMITE_CHANCE = { 'Angel': 0.50, 'Archangel': 0.33 };

  var RACE_BERSERK = { 'Minotaur': 0.30 };

  var CAPS = {
    lethality: 1.5,
    crit_chance: 1.0,
    crit_dmg: 1.0,
    atk_speed: 1.5
  };

  var TRAIT_POWER_SLOPE = 4.5;
  var TRAIT_POWER_FLOOR = 0.1;

  var CORE_STATS = ['lethality', 'crit_chance', 'crit_dmg', 'atk_speed'];

  var EXPECTED_COUNTS = {
    ores: 140,
    weapons: 79,
    races: 16,
    runes: 47,
    achievements: 16
  };

  function shareScaling(base, max, share, divisor) {
    if (divisor === undefined) { divisor = 100; }
    if (share < SHARE_GATE) { return 0.0; }
    var value = base + (max - base) * Math.min((share - SHARE_GATE) / RAMP_SPAN, 1.0);
    return value / divisor;
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

  function avgOrePower(slots, game) {
    var powers = slots.map(function (s) { return slotPower(s, game); });
    var total = 0;
    for (var i = 0; i < slots.length; i++) { total += slots[i].amount; }
    if (total !== 0) {
      var weighted = 0;
      for (var j = 0; j < slots.length; j++) { weighted += slots[j].amount * powers[j]; }
      return weighted / total;
    }
    if (powers.length) {
      var sum = 0;
      for (var k = 0; k < powers.length; k++) { sum += powers[k]; }
      return sum / powers.length;
    }
    return 0.0;
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

  function oreStatSum(slots, shares, game, stat) {
    var total = 0.0;
    for (var i = 0; i < slots.length; i++) {
      var slot = slots[i];
      var share = shares[i];
      if (share < SHARE_GATE || slot.name === game.select_ore) { continue; }
      var ore = game._ore_index.get(slot.name);
      if (!ore) { continue; }
      var rng = ore.stats[stat];
      if (!rng) { continue; }
      total += shareScaling(rng.base, rng.max, share, rng.divisor);
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

  function statTotals(build, game, oreContribs) {
    var runes = runeTotals(build.rune_cells);
    var ach = parseTrait(build.achievement);
    var achStat = ach ? ach.stat : null;
    var achValue = ach ? ach.value : 0.0;

    var lethality = oreContribs.lethality
      + build.armor_lethality
      + runes.lethality
      + build.base_lethality
      + (RACE_LETHALITY[build.race] !== undefined ? RACE_LETHALITY[build.race] : 0.0)
      + (CLASS_LETHALITY[build.race + ',' + build.bonus_weapon_type] !== undefined ? CLASS_LETHALITY[build.race + ',' + build.bonus_weapon_type] : 0.0)
      + (achStat === 'lethality' ? achValue : 0.0);

    var crit_chance = oreContribs.crit_chance
      + build.armor_crit_chance
      + runes.crit_chance
      + (achStat === 'crit_chance' ? achValue : 0.0);

    var crit_dmg = oreContribs.crit_dmg
      + build.armor_crit_dmg
      + runes.crit_dmg;

    var atk_speed = oreContribs.atk_speed
      + runes.atk_speed
      + (RACE_ATK_SPEED[build.race] !== undefined ? RACE_ATK_SPEED[build.race] : 0.0)
      + (CLASS_ATK_SPEED[build.race + ',' + build.bonus_weapon_type] !== undefined ? CLASS_ATK_SPEED[build.race + ',' + build.bonus_weapon_type] : 0.0)
      + (achStat === 'atk_speed' ? achValue : 0.0);

    return {
      lethality: Math.min(lethality, CAPS.lethality),
      crit_chance: Math.min(crit_chance, CAPS.crit_chance),
      crit_dmg: Math.min(crit_dmg, CAPS.crit_dmg),
      atk_speed: Math.min(atk_speed, CAPS.atk_speed)
    };
  }

  function calcOreContributions(slots, shares, game) {
    var contribs = {};
    for (var i = 0; i < CORE_STATS.length; i++) {
      contribs[CORE_STATS[i]] = oreStatSum(slots, shares, game, CORE_STATS[i]);
    }
    return contribs;
  }

  function duration(oreTerms, raceTime, abilityTime, minus) {
    var top = 0;
    for (var i = 0; i < oreTerms.length; i++) { if (oreTerms[i] > top) { top = oreTerms[i]; } }
    if (raceTime > top) { top = raceTime; }
    if (abilityTime > top) { top = abilityTime; }
    return Math.max(top - minus, 0.0);
  }

  function blackholeChance(slots, game) {
    var galaxite = 0;
    var nonblank = 0;
    for (var i = 0; i < slots.length; i++) {
      if (slots[i].name === 'Galaxite') { galaxite++; }
      if (slots[i].name) { nonblank++; }
    }
    if (nonblank === 0) { return 0.0; }
    return galaxite / nonblank >= 0.1 ? 0.3 : 0.0;
  }

  function slotVals(slots, shares, game, stat) {
    var vals = [];
    for (var i = 0; i < slots.length; i++) {
      var slot = slots[i];
      var share = shares[i];
      if (share < SHARE_GATE || slot.name === game.select_ore) { continue; }
      var ore = game._ore_index.get(slot.name);
      if (!ore) { continue; }
      var rng = ore.stats[stat];
      if (!rng) { continue; }
      vals.push(shareScaling(rng.base, rng.max, share, rng.divisor));
    }
    return vals;
  }

  function slotMax(slots, shares, game, stat) {
    var vals = slotVals(slots, shares, game, stat);
    if (!vals.length) { return 0.0; }
    var m = vals[0];
    for (var i = 1; i < vals.length; i++) { if (vals[i] > m) { m = vals[i]; } }
    return m;
  }

  function slotSum(slots, shares, game, stat) {
    var vals = slotVals(slots, shares, game, stat);
    var total = 0.0;
    for (var i = 0; i < vals.length; i++) { total += vals[i]; }
    return total;
  }

  function firstSlotVal(slots, shares, game, name, stat) {
    for (var i = 0; i < slots.length; i++) {
      if (slots[i].name !== name) { continue; }
      var ore = game._ore_index.get(name);
      var rng = ore ? ore.stats[stat] : null;
      if (!rng) { return 0.0; }
      return shareScaling(rng.base, rng.max, shares[i], rng.divisor);
    }
    return 0.0;
  }

  function procComponents(build, shares, game) {
    var fireTerms = slotVals(build.slots, shares, game, 'fire_duration');

    return {
      moon: slotSum(build.slots, shares, game, 'moon'),
      explosion_dmg: slotSum(build.slots, shares, game, 'explosion_dmg') + build.abilities.blast_dmg,
      explosion_chance: Math.max(slotMax(build.slots, shares, game, 'explosion_chance'), build.abilities.blast_chance),
      fire_dmg: slotSum(build.slots, shares, game, 'fire_dmg')
        + (RACE_FIRE_DMG[build.race] !== undefined ? RACE_FIRE_DMG[build.race] : 0.0)
        + build.abilities.fire_dmg,
      fire_chance: Math.max(slotMax(build.slots, shares, game, 'fire_chance'), build.abilities.fire_chance)
        + (RACE_FIRE_CHANCE[build.race] !== undefined ? RACE_FIRE_CHANCE[build.race] : 0.0),
      fire_duration: duration(fireTerms, RACE_FIRE_TIME[build.race] !== undefined ? RACE_FIRE_TIME[build.race] : 0, build.abilities.fire_time, 1),
      poison_dmg: slotSum(build.slots, shares, game, 'poison_dmg') + build.abilities.poison_dmg,
      poison_chance: Math.max(slotMax(build.slots, shares, game, 'poison_chance'), build.abilities.poison_chance),
      poison_duration: duration([firstSlotVal(build.slots, shares, game, 'Malachite', 'poison_duration')], 0, build.abilities.poison_time, 2),
      smite_dmg: slotSum(build.slots, shares, game, 'smite_dmg') + (RACE_SMITE_DMG[build.race] !== undefined ? RACE_SMITE_DMG[build.race] : 0.0),
      smite_chance: Math.max(slotMax(build.slots, shares, game, 'smite_chance'), RACE_SMITE_CHANCE[build.race] !== undefined ? RACE_SMITE_CHANCE[build.race] : 0.0),
      blackhole_dmg: slotSum(build.slots, shares, game, 'blackhole_dmg'),
      blackhole_chance: blackholeChance(build.slots, game)
    };
  }

  function activeTraits(build, shares, game) {
    var parts = [];
    for (var i = 0; i < build.slots.length; i++) {
      var slot = build.slots[i];
      var share = shares[i];
      if (slot.name === game.select_ore || share < SHARE_GATE) { continue; }
      var ore = game._ore_index.get(slot.name);
      if (!ore || !ore.is_weapon) { continue; }

      var power = Math.min(
        Math.max((share - SHARE_GATE) * TRAIT_POWER_SLOPE + TRAIT_POWER_FLOOR, TRAIT_POWER_FLOOR),
        1.0
      );

      var text = '';
      if (share >= 0.3) {
        text = ore.trait30 || '';
      } else {
        var trait10 = ore.trait10 || '';
        if (trait10) {
          text = '[' + (power * 100).toFixed(1) + '% power] ' + trait10;
        }
      }
      if (text) { parts.push(text); }
    }
    return parts.length ? parts.join(' | ') : 'No active weapon traits';
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
        poison_time: num(b.abilities && b.abilities.poison_time)
      },
      berserk: num(b.berserk),
      achievement: typeof b.achievement === 'string' ? b.achievement : ''
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

    var weapon_dps = forged * (1 + totals.lethality) * blend * atkRate;
    var explosion_dps = unforged * procs.explosion_dmg * procs.explosion_chance * atkRate;
    var fire_dps = atkRate
      ? unforged * procs.fire_dmg * Math.min(1, procs.fire_chance * atkRate * Math.min(procs.fire_duration, 5))
      : 0.0;
    var poison_dps = atkRate
      ? unforged * procs.poison_dmg * Math.min(1, procs.poison_chance * atkRate * Math.min(procs.poison_duration, 5))
      : 0.0;
    var smite_dps = unforged * atkRate * procs.smite_dmg * Math.min(procs.smite_chance, 1);
    var blackhole_dps = unforged * procs.blackhole_dmg * procs.blackhole_chance * atkRate;
    var total_dps = weapon_dps + explosion_dps + fire_dps + poison_dps + smite_dps + blackhole_dps;

    var berserkLevel = build.berserk + (RACE_BERSERK[build.race] !== undefined ? RACE_BERSERK[build.race] : 0.0);
    var berserk = null;
    if (berserkLevel !== 0) {
      var lethBoosted = Math.min(totals.lethality + berserkLevel, CAPS.lethality);
      berserk = explosion_dps + fire_dps + poison_dps + smite_dps + blackhole_dps
        + forged * (1 + lethBoosted) * blend * atkRate;
    }

    var moonstone = procs.moon !== 0 ? weapon_dps * (1 + procs.moon) : null;

    var min_dps = forged * (1 + totals.lethality) * atkRate;
    var max_dps = forged * (1 + totals.lethality) * (build.base_crit_dmg + totals.crit_dmg) * atkRate
      + forged * procs.explosion_dmg * atkRate
      + forged * procs.fire_dmg
      + forged * procs.poison_dmg
      + procs.smite_dmg * forged
      + procs.blackhole_dmg * forged;

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
      weapon_dps: weapon_dps,
      explosion_dps: explosion_dps,
      fire_dps: fire_dps,
      poison_dps: poison_dps,
      smite_dps: smite_dps,
      blackhole_dps: blackhole_dps,
      total_dps: total_dps,
      berserk: berserk,
      moonstone: moonstone,
      min_dps: min_dps,
      max_dps: max_dps,
      ttk_25k: ttk_25k,
      ttk_75k: ttk_75k,
      active_traits: activeTraits(build, shares, game)
    };
  }

  var DATA_TITLES = {
    ores: 'Data:Ores.json',
    weapons: 'Data:Weapons.json',
    races: 'Data:Races.json',
    runes: 'Data:Runes.json',
    achievements: 'Data:Achievements.json'
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
        // Preserved quirk: "eapon" substring check
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
      select_ore: rawOres.select_ore || SELECT_ORE,
      none_label: rawRunes.none || NONE_LABEL,
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

    // Check for duplicate ore names (fatal)
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
      loadJSONPage(DATA_TITLES.achievements)
    ]).then(function (all) {
      return buildGameData({
        ores: all[0],
        weapons: all[1],
        races: all[2],
        runes: all[3],
        achievements: all[4]
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

    var slotId = 'ore-slot-' + index;
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
          // Ore changed or removed — reset the amount to 0.
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

    // Prompt ↔ "None" sentinel translation
    function toUI(val, sentinel, prompt) {
      return (val === sentinel || val === undefined) ? prompt : val;
    }
    function fromUI(val, sentinel, prompt) {
      return val === prompt ? sentinel : val;
    }

    var QUALITY_MAX = 100;

    var currentType = opts.weaponType || noneLabel;
    var currentWeapon = opts.weaponName || noneLabel;
    var currentQuality = (opts.quality !== undefined && opts.quality !== null) ? opts.quality : 100;
    var currentEnhancement = (opts.enhancement !== undefined && opts.enhancement !== null) ? opts.enhancement : 0;

    var container = createEl('div', { class: 'fc-weapon-selector' });

    var typeWrapper = createEl('div', { class: 'fc-weapon-type-wrapper' });
    var typeLabel = createEl('label', { for: 'weapon-type' }, ['Weapon Type']);
    var typeOptions = [weaponTypePrompt, 'All Types'].concat(weaponTypes);
    var typeDropdown = createSearchableDropdown({
      options: typeOptions,
      value: toUI(currentType, noneLabel, weaponTypePrompt),
      placeholder: weaponTypePrompt,
      id: 'weapon-type',
      onChange: function (newType) {
        currentType = fromUI(newType, noneLabel, weaponTypePrompt);
        var filteredWeapons;
        if (currentType === noneLabel || currentType === 'All Types') {
          filteredWeapons = weapons;
        } else {
          filteredWeapons = weapons.filter(function (w) { return w.type === currentType; });
        }
        var weaponNames = filteredWeapons.map(function (w) { return w.name; });
        weaponDropdown.updateOptions([weaponPrompt].concat(weaponNames));
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
    var initialWeapons;
    if (currentType === noneLabel || currentType === 'All Types') {
      initialWeapons = weapons;
    } else {
      initialWeapons = weapons.filter(function (w) { return w.type === currentType; });
    }
    var weaponNames = [weaponPrompt].concat(initialWeapons.map(function (w) { return w.name; }));
    var weaponDropdown = createSearchableDropdown({
      options: weaponNames,
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

    return container;
  }


  function createStatInput(opts) {
    var onChange = opts.onChange;
    var currentValues = {};
    for (var k in opts.values) { currentValues[k] = opts.values[k]; }

    var container = createEl('div', { class: 'fc-stat-input' });

    // Whole-percent entry (15 = 15%); max = the stat's cap (lethality 150%,
    // crit chance/crit dmg 100%). The build stores percents and
    // transformBuildForEngine divides by 100.
    var fields = [
      { key: 'armorLethality', label: 'Armor Lethality', placeholder: '0', min: 0, max: 150, step: 1 },
      { key: 'armorCritChance', label: 'Armor Crit Chance', placeholder: '0', min: 0, max: 100, step: 1 },
      { key: 'armorCritDmg', label: 'Armor Crit Damage', placeholder: '0', min: 0, max: 100, step: 1 }
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

  // Ability (rune) input ranges. `unit` is 'pct' (entered as whole percents,
  // converted to a decimal fraction for the engine) or 'sec' (plain seconds).
  var ABILITY_RANGES = {
    fireDmg: { min: 1, max: 22, unit: 'pct' },
    fireChance: { min: 1, max: 50, unit: 'pct' },
    fireTime: { min: 1, max: 3, unit: 'sec' },
    poisonDmg: { min: 1, max: 7, unit: 'pct' },
    poisonChance: { min: 1, max: 35, unit: 'pct' },
    poisonTime: { min: 1, max: 6, unit: 'sec' },
    blastDmg: { min: 1, max: 40, unit: 'pct' },
    blastChance: { min: 1, max: 20, unit: 'pct' }
  };

  // Clamp an ability input into [min, max]. Empty, non-numeric and 0 all mean
  // "no ability" (the default/reset state); any other value snaps to the range.
  function clampAbilityValue(raw, min, max) {
    if (raw === '' || raw === undefined || raw === null) { return 0; }
    var v = parseFloat(raw);
    if (isNaN(v)) { return 0; }
    if (v === 0) { return 0; }
    if (v < min) { return min; }
    if (v > max) { return max; }
    return v;
  }

  function createAbilityGrid(opts) {
    var onChange = opts.onChange;
    var currentValues = {};
    for (var k in opts.values) { currentValues[k] = opts.values[k]; }

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
          var min = range.min;
          var max = range.max;
          var rangeHint = (range.unit === 'sec') ? (min + '-' + max + 's') : (min + '-' + max + '%');
          var row = createEl('div', { class: 'fc-ability-row' });
          var label = createEl('label', { class: 'fc-ability-label', for: field.key }, [field.label]);
          var input = createEl('input', {
            type: 'number',
            class: 'fc-ability-input',
            id: field.key,
            value: currentValues[field.key] !== undefined ? currentValues[field.key] : '',
            min: String(min),
            max: String(max),
            step: '1',
            placeholder: rangeHint,
            title: field.label + ' (from runes). Range: ' + rangeHint + '. 0 = no ability.',
            inputmode: 'decimal'
          });

          function commit() {
            currentValues[field.key] = clampAbilityValue(input.value, min, max);
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
      { key: 'fireDmg', label: 'Fire DMG' },
      { key: 'fireChance', label: 'Fire Chance' },
      { key: 'fireTime', label: 'Fire Time (s)' }
    ]);

    var poisonSection = createSection('Poison', [
      { key: 'poisonDmg', label: 'Poison DMG' },
      { key: 'poisonChance', label: 'Poison Chance' },
      { key: 'poisonTime', label: 'Poison Time (s)' }
    ]);

    var blastSection = createSection('Blast', [
      { key: 'blastDmg', label: 'Blast DMG' },
      { key: 'blastChance', label: 'Blast Chance' }
    ]);

    fireSection.classList.add('fc-ability-section--fire');
    poisonSection.classList.add('fc-ability-section--poison');
    blastSection.classList.add('fc-ability-section--blast');

    container.append(fireSection, poisonSection, blastSection);

    container.setValues = function (values) {
      for (var key in values) { currentValues[key] = values[key]; }
      var sections = [fireSection, poisonSection, blastSection];
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

    return container;
  }

  function createRuneSelector(opts) {
    var runes = opts.runes;
    var noneLabel = opts.noneLabel;
    var prompt = opts.prompt || noneLabel;
    var onChange = opts.onChange;

    var initial = opts.values || [];
    var current = [];
    for (var ci = 0; ci < 6; ci++) {
      current.push(initial[ci] !== undefined ? initial[ci] : noneLabel);
    }

    // Prompt ↔ "None" sentinel translation
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
      for (var col = 0; col < 2; col++) {
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
        })(line * 2 + col);
      }
      container.appendChild(lineEl);
    }

    container.setValues = function (vals) {
      vals = vals || [];
      current = [];
      for (var i = 0; i < 6; i++) {
        current.push(vals[i] !== undefined ? vals[i] : noneLabel);
      }
      for (var d = 0; d < 6; d++) {
        dropdowns[d].setValue(toUI(current[d]));
      }
    };
    container.getValues = function () { return current.slice(); };

    return container;
  }

  function createResultsCard(opts) {
    var card = createEl('div', { class: 'fc-card' });
    var head = createEl('div', { class: 'fc-card-head' });
    var iconEl = createEl('span', { class: 'fc-card-icon' }, ['◆']);
    var titleEl = createEl('span', { class: 'fc-card-title' }, [opts.title]);
    head.append(iconEl, titleEl);

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
    var labelEl = createEl('span', { class: 'fc-stat-label' }, [opts.label]);
    var valueClass = ('fc-stat-val ' + (opts.valueClass || '')).trim();
    var valueEl = createEl('span', { class: valueClass }, [opts.value !== undefined ? opts.value : '']);
    if (opts.isCap) { valueEl.style.color = '#ff5555'; }

    // Click a value to copy it to the clipboard.
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
      valueEl.style.color = isCap ? '#ff5555' : '';
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

  /* ---------- Section icon helpers ---------- */

  // Section icons are the wiki's own uploaded PNGs, referenced as standard
  // [[File:...]] wikitext — the same image-link convention the wiki's templates
  // use (e.g. [[File:{{{image}}}|frameless|link=File:{{{image}}}|alt={{{name}}}]]).
  // The JS can't paste wikitext into the page, so it collects placeholder spans
  // while the input panel renders, then resolves them in one batched
  // mw.Api().parse() call: the server parses each [[File:...]] into the exact
  // <a><img></a> markup it produces anywhere on the wiki (Special:FilePath src,
  // alt text, link to the file page). No raw <img src> is hand-built.
  // Upload all 11 PNGs with these exact names (or edit the map to match).
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
    poison:      'ForgeCalculator-poison.png'
  };

  var ICON_PLACEHOLDERS = [];

  function iconImg(name, alt) {
    var wrap = createEl('span', { class: 'fc-section-icon' });
    var file = SECTION_ICON_FILES[name] || SECTION_ICON_FILES.ability;
    ICON_PLACEHOLDERS.push({ wrap: wrap, file: file, alt: alt || name });
    return wrap;
  }

  // Split the batched parse output (one <p> per [[File:...]] line) back into
  // individual <a><img></a> fragments. Each image is self-contained in its
  // paragraph, so extracting the paragraph bodies is safe.
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
        // Icons are decorative — an empty placeholder is fine.
      });
    });
  }

  function sectionTitle(title, iconName) {
    var h3 = createEl('h3', { class: 'fc-input-section-title' });
    h3.appendChild(iconImg(iconName, title));
    h3.appendChild(document.createTextNode(title));
    return h3;
  }

  /* ---------- Results panel ---------- */

  function createResultsPanel(handlers) {
    var container = createEl('div', { class: 'fc-results-panel' });

    var head = createEl('div', { class: 'fc-results-head' });
    var title = createEl('h2', { class: 'fc-results-title' }, ['Results']);
    var toolbar = createEl('div', { class: 'fc-toolbar' });
    var copyBtn = createEl('button', { class: 'fc-btn fc-btn--primary', type: 'button' }, ['Copy Results']);
    var resetBtn = createEl('button', { class: 'fc-btn', type: 'button' }, ['Reset']);
    copyBtn.addEventListener('click', function (e) { e.preventDefault(); handlers.onCopy(); });
    resetBtn.addEventListener('click', function (e) { e.preventDefault(); handlers.onReset(); });
    toolbar.append(copyBtn, resetBtn);
    head.append(title, toolbar);

    var cardsContainer = createEl('div', { class: 'fc-results-cards' });
    container.append(head, cardsContainer);

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
        { label: 'Attack Speed', value: '0.00%', valueClass: 'fc-sv-pct' }
      ])
    });

    var dpsCard = createResultsCard({
      title: 'DPS Breakdown',
      content: createStatRows([
        { label: 'Weapon DPS', value: '0', valueClass: 'fc-sv-dmg' },
        { label: 'Explosion DPS', value: '0', valueClass: 'fc-sv-dmg' },
        { label: 'Fire DPS', value: '0', valueClass: 'fc-sv-dmg' },
        { label: 'Poison DPS', value: '0', valueClass: 'fc-sv-dmg' },
        { label: 'Smite DPS', value: '0', valueClass: 'fc-sv-dmg' },
        { label: 'Black Hole DPS', value: '0', valueClass: 'fc-sv-dmg' },
        { label: 'Total DPS', value: '0', valueClass: 'fc-sv-dmg fc-bold' },
        { label: 'Total Berserk DPS', value: '—', valueClass: 'fc-sv-dmg' },
        { label: 'Total Moonstone DPS', value: '—', valueClass: 'fc-sv-dmg' }
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
      content: createStatRows([
        { label: '', value: '0', valueClass: 'fc-sv-dps-hero' }
      ])
    });

    // Modifier classes drive the results grid placement + hero styling.
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
      if (statRows.length >= 4) {
        updateStatRow(statRows[0], pctFmt(result.lethality), result.lethality >= 1.5);
        updateStatRow(statRows[1], pctFmt(result.crit_chance), result.crit_chance >= 1.0);
        updateStatRow(statRows[2], pctFmt(result.crit_dmg), result.crit_dmg >= 1.0);
        updateStatRow(statRows[3], pctFmt(result.atk_speed), result.atk_speed >= 1.5);
      }

      var dpsRows = dpsCard.querySelectorAll('.fc-stat-row');
      if (dpsRows.length >= 9) {
        updateStatRow(dpsRows[0], fmtDps(result.weapon_dps), false);
        updateStatRow(dpsRows[1], fmtDps(result.explosion_dps), false);
        updateStatRow(dpsRows[2], fmtDps(result.fire_dps), false);
        updateStatRow(dpsRows[3], fmtDps(result.poison_dps), false);
        updateStatRow(dpsRows[4], fmtDps(result.smite_dps), false);
        updateStatRow(dpsRows[5], fmtDps(result.blackhole_dps), false);
        updateStatRow(dpsRows[6], fmtDps(result.total_dps), false);
        updateStatRow(dpsRows[7], fmtDps(result.berserk), false);
        updateStatRow(dpsRows[8], fmtDps(result.moonstone), false);
      }

      var ttkRows = ttkCard.querySelectorAll('.fc-stat-row');
      if (ttkRows.length >= 2) {
        updateStatRow(ttkRows[0], fmtTime(result.ttk_25k), false);
        updateStatRow(ttkRows[1], fmtTime(result.ttk_75k), false);
      }

      if (result.active_traits) {
        // Full-width wrapping block so long trait text is never clipped by the
        // stat-row layout (`.fc-stat-val` is flex-shrink:0, cards clip overflow).
        var traitsBlock = createEl('div', { class: 'fc-traits-block' });
        var traitsValue = createEl('div', { class: 'fc-traits-value' }, [result.active_traits]);
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

    // "Select X" prompts — build state keeps "None" sentinel
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

    var panelHeader = createEl('div', { class: 'fc-panel-header' });
    panelHeader.appendChild(createEl('h2', { class: 'fc-panel-title' }, ['Build Inputs']));
    panelHeader.appendChild(createEl('p', { class: 'fc-panel-subtext' }, [
      'Percent inputs are whole numbers (15 = 15%).'
    ]));
    container.appendChild(panelHeader);

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
          }
        });
        oreSlots.push(slot);
        oreGrid.appendChild(slot);
      })(i);
    }
    oreSection.appendChild(oreGrid);

    var weaponSection = createEl('div', { class: 'fc-input-section fc-input-section--flat' });
    weaponSection.appendChild(sectionTitle('Weapon', 'weapon'));

    var weaponSelector = createWeaponSelector({
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

    // The race/class weapon-type bonus is auto-detected from the selected
    // weapon's type (workbook E44/E47 key off C23 = bonus type, which now
    // always equals the equipped weapon's type), so there is no separate input.
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
      onChange: function (race) { patch({ race: fromUI(race, RACE_PROMPT) }); }
    });
    raceWrapper.append(raceLabel, raceDropdown);

    raceSection.appendChild(raceWrapper);
    metaWrap.appendChild(raceSection);

    var berserkSection = createEl('div', { class: 'fc-input-section' });
    berserkSection.appendChild(sectionTitle('Berserk', 'berserk'));
    berserkSection.appendChild(createEl('p', { class: 'fc-input-section-subtext' }, [
      'Enter percentage as whole number.'
    ]));

    // Whole-percent entry (30 = 30%); max = the lethality cap (150%), since any
    // more is capped away by the engine. The build stores percents and
    // transformBuildForEngine divides by 100.
    var berserkRow = createEl('div', { class: 'fc-stat-input-row' });
    var berserkLabel = createEl('label', { class: 'fc-stat-input-label', for: 'berserk' }, ['Berserk']);
    var berserkInput = createEl('input', {
      type: 'number',
      class: 'fc-stat-input-input',
      id: 'berserk',
      value: getBuild().berserk !== undefined ? getBuild().berserk : '',
      min: '0',
      max: '150',
      step: 1,
      placeholder: '0',
      inputmode: 'numeric'
    });
    function commitBerserk() {
      var v = Math.max(0, Math.min(parseFloat(berserkInput.value) || 0, 150));
      berserkInput.value = v;
      patch({ berserk: v });
    }
    var handleBerserkChange = debounce(commitBerserk, 150);
    berserkInput.addEventListener('input', handleBerserkChange);
    berserkInput.addEventListener('change', commitBerserk);
    var berserkField = createEl('div', { class: 'fc-stat-input-field' });
    berserkField.appendChild(berserkInput);
    berserkRow.append(berserkLabel, berserkField);
    berserkSection.appendChild(berserkRow);
    metaWrap.appendChild(berserkSection);

    var statSection = createEl('div', { class: 'fc-input-section' });
    statSection.appendChild(sectionTitle('Armor Stats', 'armor'));
    statSection.appendChild(createEl('p', { class: 'fc-input-section-subtext' }, [
      'Enter percentage as whole number.'
    ]));

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
        blastDmg: getBuild().blastDmg,
        blastChance: getBuild().blastChance
      },
      onChange: function (values) { patch(values); }
    });
    abilitySection.appendChild(abilityGrid);

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

    container.append(
      weaponSection,
      oreSection,
      metaWrap,
      runeSection,
      statSection,
      abilitySection
    );

    var warningsBox = createEl('div', { class: 'fc-warnings fc-hidden' });
    container.appendChild(warningsBox);

    var calcBtn = createEl('button', {
      class: 'fc-btn fc-btn--primary fc-calc-btn',
      type: 'button'
    }, ['Calculate DPS']);
    calcBtn.addEventListener('click', function (e) {
      e.preventDefault();
      if (onCalculate) { onCalculate(); }
    });
    container.appendChild(calcBtn);

    // Live advisory warnings (computed from build state only — no engine call).
    container.refreshWarnings = function () {
      var list = computeWarnings(getBuild());
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
        blastDmg: newBuild.blastDmg,
        blastChance: newBuild.blastChance
      });
      runeSelector.setValues(newBuild.runes || []);
      achievementDropdown.setValue(toUI(newBuild.achievement, ACHIEVEMENT_PROMPT));
    };

    // All section-icon placeholders are now registered — resolve them through
    // the wiki's [[File:...]] pipeline (one batched API parse).
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
    blastDmg: 0,
    blastChance: 0,
    berserk: 0,
    runes: [NONE_LABEL, NONE_LABEL, NONE_LABEL, NONE_LABEL, NONE_LABEL, NONE_LABEL],
    achievement: NONE_LABEL
  };

  var state = {
    gameData: null,
    build: DEFAULT_BUILD,
    inputPanel: null,
    resultsPanel: null
  };

  // Auto-detect the race/class weapon-type bonus from the selected weapon's
  // type (workbook E44/E47 check C23 = bonus type, and it now always equals
  // the equipped weapon's type). Empty when no weapon is selected.
  function deriveBonusType(build) {
    if (!state.gameData || !build.weaponName || build.weaponName === NONE_LABEL) { return ''; }
    var weapon = state.gameData._weapon_index.get(build.weaponName);
    return weapon ? weapon.type : '';
  }

  // Advisory warnings shown above the Calculate button. Computed purely from
  // the UI build (no engine call) so they update live as inputs change.
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
      base_crit_dmg: 1.45, // workbook C21 base crit damage (145% crits before bonuses)
      armor_crit_chance: (Number(build.armorCritChance) || 0) / 100,
      armor_crit_dmg: (Number(build.armorCritDmg) || 0) / 100,
      armor_lethality: (Number(build.armorLethality) || 0) / 100,
      base_lethality: 0,
      abilities: {
        // UI stores ability percents as whole numbers (15 = 15%); engine wants
        // decimal fractions. Times are plain seconds already.
        fire_dmg: (Number(build.fireDmg) || 0) / 100,
        fire_chance: (Number(build.fireChance) || 0) / 100,
        fire_time: Number(build.fireTime) || 0,
        poison_dmg: (Number(build.poisonDmg) || 0) / 100,
        poison_chance: (Number(build.poisonChance) || 0) / 100,
        poison_time: Number(build.poisonTime) || 0,
        blast_dmg: (Number(build.blastDmg) || 0) / 100,
        blast_chance: (Number(build.blastChance) || 0) / 100
      },
      // Berserk is entered as whole percents (30 = 30%) and adds to lethality
      // for the berserk burst (workbook C53/E53); Minotaur's +30% is added in
      // the engine. Divide by 100 like the other percent fields.
      berserk: (Number(build.berserk) || 0) / 100,
      achievement: build.achievement || NONE_LABEL
    };
  }

  function recalculate() {
    if (!state.gameData) { return; }
    try {
      var result = calculate(transformBuildForEngine(state.build), state.gameData);
      state.resultsPanel.updateResults(result);
    } catch (err) {
      if (mw.log) { mw.log('Forge Calculator: calculation error', err); }
    }
  }

  function handleBuildChange(newBuild) {
    // Only update state here; results compute on "Calculate DPS" press
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
      'Lethality: ' + (result.lethality * 100).toFixed(2) + '%' + (result.lethality >= 1.5 ? ' (CAPPED)' : ''),
      'Crit Chance: ' + (result.crit_chance * 100).toFixed(2) + '%' + (result.crit_chance >= 1.0 ? ' (CAPPED)' : ''),
      'Crit Damage: ' + (result.crit_dmg * 100).toFixed(2) + '%' + (result.crit_dmg >= 1.0 ? ' (CAPPED)' : ''),
      'Attack Speed: ' + (result.atk_speed * 100).toFixed(2) + '%' + (result.atk_speed >= 1.5 ? ' (CAPPED)' : ''),
      '',
      '--- DPS Breakdown ---',
      'Weapon DPS: ' + result.weapon_dps.toFixed(2),
      'Explosion DPS: ' + result.explosion_dps.toFixed(2),
      'Fire DPS: ' + result.fire_dps.toFixed(2),
      'Poison DPS: ' + result.poison_dps.toFixed(2),
      'Smite DPS: ' + result.smite_dps.toFixed(2),
      'Black Hole DPS: ' + result.blackhole_dps.toFixed(2),
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

      state.inputPanel = createInputPanel({
        data: gameData,
        getBuild: function () { return state.build; },
        onBuildChange: handleBuildChange,
        onCalculate: recalculate
      });
      left.appendChild(state.inputPanel);

      state.resultsPanel = createResultsPanel({
        onCopy: copyResults,
        onReset: resetBuild
      });
      right.appendChild(state.resultsPanel);

      body.append(left, right);

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
    // Tag body so MediaWiki:Common.css can constrain page width on calculator pages
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
