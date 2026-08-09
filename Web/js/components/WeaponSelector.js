/** Weapon Selector Component
 * Weapon type filter + weapon dropdown
 * @module components/WeaponSelector
 */

import { createEl, on } from '../utils/dom.js';
import { createSearchableDropdown } from './SearchableDropdown.js';
import { debounce } from '../utils/events.js';

const CLASS_WEAPON = 'ep-weapon-selector';
const CLASS_TYPE_WRAPPER = 'ep-weapon-type-wrapper';
const CLASS_WEAPON_WRAPPER = 'ep-weapon-wrapper';
const CLASS_QUALITY = 'ep-quality-input';
const CLASS_ENHANCEMENT = 'ep-enhancement-input';

/**
 * Create weapon selector component
 * @param {Object} options
 * @param {string[]} options.weaponTypes - Available weapon types
 * @param {Weapon[]} options.weapons - All weapons
 * @param {string} options.noneLabel - "None" label
 * @param {string} options.weaponType - Current weapon type
 * @param {string} options.weaponName - Current weapon name
 * @param {number} options.quality - Current quality (default 100)
 * @param {number} options.enhancement - Current enhancement level (0-9)
 * @param {Function} options.onChange - Callback (weaponType, weaponName, quality, enhancement) => void
 * @returns {HTMLElement}
 */
export function createWeaponSelector({ weaponTypes, weapons, noneLabel, weaponType, weaponName, quality, enhancement, onChange }) {
  let currentType = weaponType || noneLabel;
  let currentWeapon = weaponName || noneLabel;
  let currentQuality = quality ?? 100;
  let currentEnhancement = enhancement ?? 0;

  const container = createEl('div', { class: CLASS_WEAPON });

  // Weapon Type dropdown
  const typeWrapper = createEl('div', { class: CLASS_TYPE_WRAPPER });
  const typeLabel = createEl('label', { for: 'weapon-type' }, ['Weapon Type']);
  const typeOptions = [noneLabel, 'All Types', ...weaponTypes];
  const typeDropdown = createSearchableDropdown({
    options: typeOptions,
    value: currentType,
    placeholder: noneLabel,
    id: 'weapon-type',
    onChange: (newType) => {
      currentType = newType;
      // Filter weapons based on type
      let filteredWeapons;
      if (newType === noneLabel || newType === 'All Types') {
        filteredWeapons = weapons;
      } else {
        filteredWeapons = weapons.filter(w => w.type === newType);
      }
      const weaponNames = filteredWeapons.map(w => w.name);
      weaponDropdown.updateOptions([noneLabel, ...weaponNames]);
      // Reset weapon selection if current weapon not in filtered list
      if (!weaponNames.includes(currentWeapon)) {
        currentWeapon = noneLabel;
        weaponDropdown.setValue(noneLabel);
      }
      onChange(currentType, currentWeapon, currentQuality, currentEnhancement);
    }
  });
  typeWrapper.append(typeLabel, typeDropdown);

  // Weapon dropdown
  const weaponWrapper = createEl('div', { class: CLASS_WEAPON_WRAPPER });
  const weaponLabel = createEl('label', { for: 'weapon-name' }, ['Weapon']);
  // Initial weapon list based on current type
  let initialWeapons;
  if (currentType === noneLabel || currentType === 'All Types') {
    initialWeapons = weapons;
  } else {
    initialWeapons = weapons.filter(w => w.type === currentType);
  }
  const weaponNames = [noneLabel, ...initialWeapons.map(w => w.name)];
  const weaponDropdown = createSearchableDropdown({
    options: weaponNames,
    value: currentWeapon,
    placeholder: noneLabel,
    id: 'weapon-name',
    onChange: (newWeapon) => {
      currentWeapon = newWeapon;
      onChange(currentType, currentWeapon, currentQuality, currentEnhancement);
    }
  });
  weaponWrapper.append(weaponLabel, weaponDropdown);

  // Quality input
  const qualityWrapper = createEl('div', { class: 'ep-quality-wrapper' });
  const qualityLabel = createEl('label', { for: 'quality' }, ['Quality']);
  const qualityInput = createEl('input', {
    type: 'number',
    class: CLASS_QUALITY,
    id: 'quality',
    value: currentQuality,
    min: '0',
    max: '500',
    step: '5',
    inputmode: 'decimal'
  });
  const handleQualityChange = debounce((e) => {
    currentQuality = parseFloat(e.target.value) || 0;
    qualityInput.value = currentQuality;
    onChange(currentType, currentWeapon, currentQuality, currentEnhancement);
  }, 150);
  on(qualityInput, 'input', handleQualityChange);
  on(qualityInput, 'change', (e) => {
    currentQuality = parseFloat(e.target.value) || 0;
    qualityInput.value = currentQuality;
    onChange(currentType, currentWeapon, currentQuality, currentEnhancement);
  });
  qualityWrapper.append(qualityLabel, qualityInput);

  // Enhancement dropdown (replaces "Forge Level")
  const enhancementWrapper = createEl('div', { class: 'ep-enhancement-wrapper' });
  const enhancementLabel = createEl('label', { for: 'enhancement' }, ['Enhancement']);
  const enhancementOptions = [noneLabel, ...Array.from({ length: 10 }, (_, i) => String(i))];
  const enhancementDropdown = createSearchableDropdown({
    options: enhancementOptions,
    value: String(currentEnhancement),
    placeholder: noneLabel,
    id: 'enhancement',
    onChange: (newEnhancement) => {
      currentEnhancement = newEnhancement === noneLabel ? 0 : parseInt(newEnhancement, 10);
      onChange(currentType, currentWeapon, currentQuality, currentEnhancement);
    }
  });
  enhancementWrapper.append(enhancementLabel, enhancementDropdown);

  container.append(typeWrapper, weaponWrapper, qualityWrapper, enhancementWrapper);

  // Expose methods
  container.setValues = (type, name, qual, enh) => {
    currentType = type;
    currentWeapon = name;
    currentQuality = qual;
    currentEnhancement = enh;
    typeDropdown.setValue(type);
    weaponDropdown.setValue(name);
    qualityInput.value = qual;
    enhancementDropdown.setValue(String(enh));
  };

  return container;
}