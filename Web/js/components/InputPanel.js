
import { createEl } from '../utils/dom.js';
import { createOreSlot } from './OreSlot.js';
import { createWeaponSelector } from './WeaponSelector.js';
import { createStatInput } from './StatInput.js';
import { createAbilityGrid } from './AbilityGrid.js';
import { createRuneSelector } from './RuneSelector.js';
import { createSearchableDropdown } from './SearchableDropdown.js';

const CLASS_PANEL = 'ep-input-panel';
const CLASS_SECTION = 'ep-input-section';
const CLASS_SECTION_TITLE = 'ep-input-section-title';
const CLASS_RACE_WRAPPER = 'ep-race-wrapper';

export function createInputPanel({ data, build, onBuildChange, onCalculate }) {
  const container = createEl('div', { class: CLASS_PANEL });

  const oreSection = createEl('div', { class: CLASS_SECTION });
  const oreTitle = createEl('h3', { class: CLASS_SECTION_TITLE }, ['Ore Slots']);
  oreSection.appendChild(oreTitle);

  const oreNames = data.ores.map(o => o.name);
  const selectOreLabel = data.constants.selectOreLabel;
  const noneLabel = data.constants.noneLabel;

  const ORE_PROMPT = 'Select Ores';
  const RACE_PROMPT = 'Select Race';
  const WEAPON_TYPE_PROMPT = 'Select Weapon Type';
  const WEAPON_PROMPT = 'Select Weapon';
  const ENHANCEMENT_PROMPT = 'Select Enhancement';
  const ACHIEVEMENT_PROMPT = 'Select Achievement';
  const RUNE_PROMPT = 'Select Rune';

  const toUI = (val, prompt) => (val === noneLabel || val === undefined ? prompt : val);
  const fromUI = (val, prompt) => (val === prompt ? noneLabel : val);

  const oreMultipliers = {};
  for (const o of data.ores) oreMultipliers[o.name] = o.multiplier;

  const oreSlots = [];
  for (let i = 0; i < 4; i++) {
    const slot = createOreSlot({
      index: i,
      oreNames,
      noneLabel,
      selectOreLabel,
      prompt: ORE_PROMPT,
      oreMultipliers,
      value: build.oreSlots[i]?.name || noneLabel,
      amount: build.oreSlots[i]?.amount || 0,
      onChange: (name, amount) => {
        const newOreSlots = [...build.oreSlots];
        newOreSlots[i] = { name, amount };
        onBuildChange({ ...build, oreSlots: newOreSlots });
      }
    });
    oreSlots.push(slot);
    oreSection.appendChild(slot);
  }

  const weaponSection = createEl('div', { class: CLASS_SECTION });
  const weaponTitle = createEl('h3', { class: CLASS_SECTION_TITLE }, ['Weapon']);
  weaponSection.appendChild(weaponTitle);

  const weaponSelector = createWeaponSelector({
    weaponTypes: data.weapon_types,
    weapons: data.weapons,
    noneLabel,
    weaponTypePrompt: WEAPON_TYPE_PROMPT,
    weaponPrompt: WEAPON_PROMPT,
    enhancementPrompt: ENHANCEMENT_PROMPT,
    weaponType: build.weaponType,
    weaponName: build.weaponName,
    quality: build.quality,
    enhancement: build.enhancement,
    onChange: (weaponType, weaponName, quality, enhancement) => {
      onBuildChange({ ...build, weaponType, weaponName, quality, enhancement });
    }
  });
  weaponSection.appendChild(weaponSelector);

  const raceSection = createEl('div', { class: CLASS_SECTION });
  const raceTitle = createEl('h3', { class: CLASS_SECTION_TITLE }, ['Race']);
  raceSection.appendChild(raceTitle);

  const raceWrapper = createEl('div', { class: CLASS_RACE_WRAPPER });
  const raceLabel = createEl('label', { for: 'race-select' }, ['Race']);
  const raceOptions = [RACE_PROMPT, ...data.races.map(r => r.name)];
  const raceDropdown = createSearchableDropdown({
    options: raceOptions,
    value: toUI(build.race, RACE_PROMPT),
    placeholder: RACE_PROMPT,
    id: 'race-select',
    onChange: (race) => {
      onBuildChange({ ...build, race: fromUI(race, RACE_PROMPT) });
    }
  });
  raceWrapper.append(raceLabel, raceDropdown);

  raceSection.appendChild(raceWrapper);

  const statSection = createEl('div', { class: CLASS_SECTION });
  const statTitle = createEl('h3', { class: CLASS_SECTION_TITLE }, ['Armor Stats']);
  statSection.appendChild(statTitle);

  const statInput = createStatInput({
    values: {
      armorLethality: build.armorLethality,
      armorCritChance: build.armorCritChance,
      armorCritDmg: build.armorCritDmg
    },
    onChange: (values) => {
      onBuildChange({ ...build, ...values });
    }
  });
  statSection.appendChild(statInput);

  const abilitySection = createEl('div', { class: CLASS_SECTION });
  const abilityTitle = createEl('h3', { class: CLASS_SECTION_TITLE }, ['Abilities']);
  abilitySection.appendChild(abilityTitle);

  const abilityGrid = createAbilityGrid({
    values: {
      fireDmg: build.fireDmg,
      fireChance: build.fireChance,
      fireTime: build.fireTime,
      poisonDmg: build.poisonDmg,
      poisonChance: build.poisonChance,
      poisonTime: build.poisonTime,
      blastDmg: build.blastDmg,
      blastChance: build.blastChance
    },
    onChange: (values) => {
      onBuildChange({ ...build, ...values });
    }
  });
  abilitySection.appendChild(abilityGrid);

  const runeSection = createEl('div', { class: CLASS_SECTION });
  const runeTitle = createEl('h3', { class: CLASS_SECTION_TITLE }, ['Runes']);
  runeSection.appendChild(runeTitle);

  const runeSelector = createRuneSelector({
    runes: data.runes,
    values: build.runes || [],
    noneLabel,
    prompt: RUNE_PROMPT,
    onChange: (runes) => {
      onBuildChange({ ...build, runes });
    }
  });
  runeSection.appendChild(runeSelector);

  const achievementSection = createEl('div', { class: CLASS_SECTION });
  const achievementTitle = createEl('h3', { class: CLASS_SECTION_TITLE }, ['Achievements']);
  achievementSection.appendChild(achievementTitle);

  const achievementsContainer = createEl('div', { class: 'ep-achievements-grid' });
  for (const achievement of data.achievements) {
    const checkboxWrapper = createEl('label', { class: 'ep-achievement-checkbox' });
    const checkbox = createEl('input', {
      type: 'checkbox',
      class: 'ep-achievement-input',
      id: `ach-${achievement.id}`,
      checked: build.achievements?.includes(achievement.id) || false
    });
    checkbox.addEventListener('change', () => {
      const newAchievements = build.achievements ? [...build.achievements] : [];
      if (checkbox.checked) {
        newAchievements.push(achievement.id);
      } else {
        const idx = newAchievements.indexOf(achievement.id);
        if (idx >= 0) newAchievements.splice(idx, 1);
      }
      onBuildChange({ ...build, achievements: newAchievements });
    });
    const labelText = createEl('span', {}, [achievement.name]);
    checkboxWrapper.append(checkbox, labelText);
    achievementsContainer.appendChild(checkboxWrapper);
  }
  achievementSection.appendChild(achievementsContainer);

  const calcBtn = createEl('button', {
    type: 'button',
    class: 'ep-btn ep-btn--primary ep-calc-btn'
  }, ['Calculate DPS']);
  calcBtn.addEventListener('click', (e) => {
    e.preventDefault();
    if (onCalculate) { onCalculate(); }
  });

  container.append(
    oreSection,
    weaponSection,
    raceSection,
    statSection,
    abilitySection,
    runeSection,
    achievementSection,
    calcBtn
  );

  container.updateFromBuild = (newBuild) => {
    for (let i = 0; i < 4; i++) {
      oreSlots[i].setValue(newBuild.oreSlots[i]?.name || noneLabel, newBuild.oreSlots[i]?.amount || 0);
    }
    weaponSelector.setValues(
      newBuild.weaponType || noneLabel,
      newBuild.weaponName || noneLabel,
      newBuild.quality ?? 100,
      newBuild.enhancement ?? 0
    );
    raceDropdown.setValue(toUI(newBuild.race, RACE_PROMPT));
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
    const newAchievements = newBuild.achievements || [];
    const checkboxes = achievementsContainer.querySelectorAll('.ep-achievement-input');
    checkboxes.forEach(cb => {
      const achId = cb.id.replace('ach-', '');
      cb.checked = newAchievements.includes(achId);
    });
  };

  return container;
}