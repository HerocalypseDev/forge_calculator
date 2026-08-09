/** Ability Grid Component
 * Fire, Poison, Blast ability inputs (cross-wired per workbook)
 * @module components/AbilityGrid
 */

import { createEl, on } from '../utils/dom.js';
import { debounce } from '../utils/events.js';

const CLASS_CONTAINER = 'ep-ability-grid';
const CLASS_SECTION = 'ep-ability-section';
const CLASS_SECTION_TITLE = 'ep-ability-section-title';
const CLASS_ROW = 'ep-ability-row';
const CLASS_LABEL = 'ep-ability-label';
const CLASS_FIELD = 'ep-ability-field';
const CLASS_INPUT = 'ep-ability-input';
const CLASS_NOTE = 'ep-ability-note';

/**
 * Create ability grid for Fire, Poison, Blast
 * @param {Object} options
 * @param {Object} options.values - Current values {fireDmg, fireChance, fireTime, poisonDmg, poisonChance, poisonTime, blastDmg, blastChance}
 * @param {Function} options.onChange - Callback (values) => void
 * @returns {HTMLElement}
 */
export function createAbilityGrid({ values, onChange }) {
  const currentValues = { ...values };

  const container = createEl('div', { class: CLASS_CONTAINER });

  // Fire section
  const fireSection = createSection('Fire', [
    { key: 'fireDmg', label: 'Fire DMG', placeholder: '0', min: 0, step: '0.01', tooltip: 'Fire damage multiplier (decimal)' },
    { key: 'fireChance', label: 'Fire Chance', placeholder: '0', min: 0, step: '0.01', max: 1, tooltip: 'Fire proc chance (decimal, e.g., 0.25 = 25%)' },
    { key: 'fireTime', label: 'Fire Time (s)', placeholder: '0', min: 0, step: '1', tooltip: 'Fire duration in seconds (-1=instant, -2=infinite per workbook quirk)' },
  ]);

  // Poison section
  const poisonSection = createSection('Poison', [
    { key: 'poisonDmg', label: 'Poison DMG', placeholder: '0', min: 0, step: '0.01', tooltip: 'Poison damage multiplier (decimal)' },
    { key: 'poisonChance', label: 'Poison Chance', placeholder: '0', min: 0, step: '0.01', max: 1, tooltip: 'Poison proc chance (decimal)' },
    { key: 'poisonTime', label: 'Poison Time (s)', placeholder: '0', min: 0, step: '1', tooltip: 'Poison duration in seconds (-1=instant, -2=infinite)' },
  ]);

  // Blast section (no time)
  const blastSection = createSection('Blast', [
    { key: 'blastDmg', label: 'Blast DMG', placeholder: '0', min: 0, step: '0.01', tooltip: 'Blast damage multiplier (decimal)' },
    { key: 'blastChance', label: 'Blast Chance', placeholder: '0', min: 0, step: '0.01', max: 1, tooltip: 'Blast proc chance (decimal)' },
  ], 'Note: Blast has no duration field (workbook quirk)');

  container.append(fireSection, poisonSection, blastSection);

  function createSection(title, fields, note = '') {
    const section = createEl('div', { class: CLASS_SECTION });
    const sectionTitle = createEl('h4', { class: CLASS_SECTION_TITLE }, [title]);
    section.appendChild(sectionTitle);

    for (const field of fields) {
      const row = createEl('div', { class: CLASS_ROW });
      const label = createEl('label', { class: CLASS_LABEL, for: field.key }, [field.label]);
      const input = createEl('input', {
        type: 'number',
        class: CLASS_INPUT,
        id: field.key,
        value: currentValues[field.key] ?? '',
        min: field.min ?? 0,
        max: field.max,
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
      section.appendChild(row);
    }

    if (note) {
      const noteEl = createEl('p', { class: CLASS_NOTE }, [note]);
      section.appendChild(noteEl);
    }

    return section;
  }

  container.setValues = (values) => {
    Object.assign(currentValues, values);
    for (const section of [fireSection, poisonSection, blastSection]) {
      const inputs = section.querySelectorAll(`.${CLASS_INPUT}`);
      inputs.forEach(input => {
        const key = input.id;
        if (key in currentValues) {
          input.value = currentValues[key] ?? '';
        }
      });
    }
  };

  container.getValues = () => ({ ...currentValues });

  return container;
}