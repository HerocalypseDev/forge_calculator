/** Stat Input Component
 * Input fields for armor stats and base values
 * @module components/StatInput
 */

import { createEl, on } from '../utils/dom.js';
import { debounce } from '../utils/events.js';

const CLASS_CONTAINER = 'ep-stat-input';
const CLASS_ROW = 'ep-stat-input-row';
const CLASS_LABEL = 'ep-stat-input-label';
const CLASS_FIELD = 'ep-stat-input-field';
const CLASS_INPUT = 'ep-stat-input-input';

/**
 * Create a group of stat inputs
 * @param {Object} options
 * @param {Object} options.values - Current values {armorLethality, armorCritChance, armorCritDmg, baseCritChance}
 * @param {Function} options.onChange - Callback (values) => void
 * @returns {HTMLElement}
 */
export function createStatInput({ values, onChange }) {
  const currentValues = { ...values };

  const container = createEl('div', { class: CLASS_CONTAINER });

  const fields = [
    { key: 'armorLethality', label: 'Armor Lethality', placeholder: '0', min: 0, step: '0.01', tooltip: 'Armor lethality bonus (decimal, e.g., 0.15 = 15%)' },
    { key: 'armorCritChance', label: 'Armor Crit Chance', placeholder: '0', min: 0, step: '0.01', tooltip: 'Armor crit chance bonus (decimal, e.g., 0.10 = 10%)' },
    { key: 'armorCritDmg', label: 'Armor Crit Damage', placeholder: '0', min: 0, step: '0.01', tooltip: 'Armor crit damage bonus (decimal, e.g., 0.25 = 25%)' },
    { key: 'baseCritChance', label: 'Base Crit Chance', placeholder: '0', min: 0, step: '0.01', tooltip: 'Base crit chance from other sources (decimal)' },
  ];

  for (const field of fields) {
    const row = createEl('div', { class: CLASS_ROW });
    const label = createEl('label', { class: CLASS_LABEL, for: field.key }, [field.label]);
    const input = createEl('input', {
      type: 'number',
      class: CLASS_INPUT,
      id: field.key,
      value: currentValues[field.key] ?? '',
      min: field.min,
      step: field.step,
      placeholder: field.placeholder,
      inputmode: 'decimal',
      title: field.tooltip
    });

    const handleChange = debounce((e) => {
      currentValues[field.key] = parseFloat(e.target.value) || 0;
      input.value = currentValues[field.key];
      onChange({ ...currentValues });
    }, 150);

    on(input, 'input', handleChange);
    on(input, 'change', (e) => {
      currentValues[field.key] = parseFloat(e.target.value) || 0;
      input.value = currentValues[field.key];
      onChange({ ...currentValues });
    });

    const fieldWrapper = createEl('div', { class: CLASS_FIELD });
    fieldWrapper.appendChild(input);
    row.append(label, fieldWrapper);
    container.appendChild(row);
  }

  container.setValues = (values) => {
    Object.assign(currentValues, values);
    for (const field of fields) {
      const input = container.querySelector(`#${field.key}`);
      if (input) {
        input.value = currentValues[field.key] ?? '';
      }
    }
  };

  container.getValues = () => ({ ...currentValues });

  return container;
}