
import { createEl } from '../utils/dom.js';
import { createSearchableDropdown } from './SearchableDropdown.js';
import { debounce, on } from '../utils/events.js';

const CLASS_WEAPON = 'ep-weapon-selector';
const CLASS_TYPE_WRAPPER = 'ep-weapon-type-wrapper';
const CLASS_WEAPON_WRAPPER = 'ep-weapon-wrapper';
const CLASS_QUALITY = 'ep-quality-input';
const CLASS_ENHANCEMENT = 'ep-enhancement-input';

const QUALITY_MAX = 100;

const toUI = (val, sentinel, prompt) => (val === sentinel || val === undefined ? prompt : val);
const fromUI = (val, sentinel, prompt) => (val === prompt ? sentinel : val);

export function createWeaponSelector({
  weaponTypes, weapons, noneLabel,
  weaponTypePrompt = noneLabel, weaponPrompt = noneLabel, enhancementPrompt = noneLabel,
  weaponType, weaponName, quality, enhancement, onChange
}) {
  let currentType = weaponType || noneLabel;
  let currentWeapon = weaponName || noneLabel;
  let currentQuality = quality ?? 100;
  let currentEnhancement = enhancement ?? 0;

  const container = createEl('div', { class: CLASS_WEAPON });

  const typeWrapper = createEl('div', { class: CLASS_TYPE_WRAPPER });
  const typeLabel = createEl('label', { for: 'weapon-type' }, ['Weapon Type']);
  const typeOptions = [weaponTypePrompt, 'All Types', ...weaponTypes];
  const typeDropdown = createSearchableDropdown({
    options: typeOptions,
    value: toUI(currentType, noneLabel, weaponTypePrompt),
    placeholder: weaponTypePrompt,
    id: 'weapon-type',
    onChange: (newType) => {
      currentType = fromUI(newType, noneLabel, weaponTypePrompt);
      let filteredWeapons;
      if (currentType === noneLabel || currentType === 'All Types') {
        filteredWeapons = weapons;
      } else {
        filteredWeapons = weapons.filter(w => w.type === currentType);
      }
      const weaponNames = filteredWeapons.map(w => w.name);
      weaponDropdown.updateOptions([weaponPrompt, ...weaponNames]);
      if (!weaponNames.includes(currentWeapon)) {
        currentWeapon = noneLabel;
        weaponDropdown.setValue(weaponPrompt);
      }
      onChange(currentType, currentWeapon, currentQuality, currentEnhancement);
    }
  });
  typeWrapper.append(typeLabel, typeDropdown);

  const weaponWrapper = createEl('div', { class: CLASS_WEAPON_WRAPPER });
  const weaponLabel = createEl('label', { for: 'weapon-name' }, ['Weapon']);
  let initialWeapons;
  if (currentType === noneLabel || currentType === 'All Types') {
    initialWeapons = weapons;
  } else {
    initialWeapons = weapons.filter(w => w.type === currentType);
  }
  const weaponNames = [weaponPrompt, ...initialWeapons.map(w => w.name)];
  const weaponDropdown = createSearchableDropdown({
    options: weaponNames,
    value: toUI(currentWeapon, noneLabel, weaponPrompt),
    placeholder: weaponPrompt,
    id: 'weapon-name',
    onChange: (newWeapon) => {
      currentWeapon = fromUI(newWeapon, noneLabel, weaponPrompt);
      onChange(currentType, currentWeapon, currentQuality, currentEnhancement);
    }
  });
  weaponWrapper.append(weaponLabel, weaponDropdown);

  const qualityWrapper = createEl('div', { class: 'ep-quality-wrapper' });
  const qualityLabel = createEl('label', { for: 'quality' }, ['Quality']);
  const qualityInput = createEl('input', {
    type: 'number',
    class: CLASS_QUALITY,
    id: 'quality',
    value: currentQuality,
    min: '0',
    max: String(QUALITY_MAX),
    step: '5',
    inputmode: 'decimal'
  });
  const clampQuality = (v) => Math.min(parseFloat(v) || 0, QUALITY_MAX);
  const commitQuality = (e) => {
    currentQuality = clampQuality(e.target.value);
    qualityInput.value = currentQuality;
    onChange(currentType, currentWeapon, currentQuality, currentEnhancement);
  };
  const handleQualityChange = debounce(commitQuality, 150);
  on(qualityInput, 'input', handleQualityChange);
  on(qualityInput, 'change', commitQuality);
  qualityWrapper.append(qualityLabel, qualityInput);

  const enhancementWrapper = createEl('div', { class: 'ep-enhancement-wrapper' });
  const enhancementLabel = createEl('label', { for: 'enhancement' }, ['Enhancement']);
  const enhancementOptions = [enhancementPrompt, ...Array.from({ length: 10 }, (_, i) => String(i))];
  const enhancementDropdown = createSearchableDropdown({
    options: enhancementOptions,
    value: String(currentEnhancement),
    placeholder: enhancementPrompt,
    id: 'enhancement',
    onChange: (newEnhancement) => {
      currentEnhancement = newEnhancement === enhancementPrompt ? 0 : parseInt(newEnhancement, 10);
      onChange(currentType, currentWeapon, currentQuality, currentEnhancement);
    }
  });
  enhancementWrapper.append(enhancementLabel, enhancementDropdown);

  container.append(typeWrapper, weaponWrapper, qualityWrapper, enhancementWrapper);

  container.setValues = (type, name, qual, enh) => {
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