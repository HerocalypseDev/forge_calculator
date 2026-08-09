/** Rune Selector Component
 * Multi-select for runes with search
 * @module components/RuneSelector
 */

import { createEl, on } from '../utils/dom.js';
import { createSearchableDropdown } from './SearchableDropdown.js';
import { debounce } from '../utils/events.js';

const CLASS_CONTAINER = 'ep-rune-selector';
const CLASS_DROPDOWN = 'ep-rune-dropdown';
const CLASS_TAGS = 'ep-rune-tags';
const CLASS_TAG = 'ep-rune-tag';
const CLASS_TAG_REMOVE = 'ep-rune-tag-remove';

/**
 * Create rune selector with multi-select via tags
 * @param {Object} options
 * @param {Rune[]} options.runes - All runes
 * @param {string[]} options.selectedRunes - Currently selected rune names
 * @param {string} options.noneLabel - "None" label
 * @param {Function} options.onChange - Callback (selectedRuneNames[]) => void
 * @returns {HTMLElement}
 */
export function createRuneSelector({ runes, selectedRunes, noneLabel, onChange }) {
  let currentRunes = [...selectedRunes];

  const container = createEl('div', { class: CLASS_CONTAINER });

  // Selected runes tags display
  const tagsContainer = createEl('div', { class: CLASS_TAGS });
  renderTags();

  // Searchable dropdown for adding runes
  const dropdownWrapper = createEl('div', { class: CLASS_DROPDOWN });
  const runeNames = runes.map(r => r.name);
  const dropdown = createSearchableDropdown({
    options: [noneLabel, ...runeNames],
    value: noneLabel,
    placeholder: noneLabel,
    id: 'rune-selector',
    onChange: (selected) => {
      if (selected === noneLabel) return;
      if (!currentRunes.includes(selected)) {
        currentRunes.push(selected);
        renderTags();
        onChange([...currentRunes]);
      }
      dropdown.setValue(noneLabel);
    }
  });
  dropdownWrapper.appendChild(dropdown);

  container.append(tagsContainer, dropdownWrapper);

  function renderTags() {
    tagsContainer.innerHTML = '';
    for (const runeName of currentRunes) {
      const tag = createEl('span', { class: CLASS_TAG });
      const nameSpan = createEl('span', {}, [runeName]);
      const removeBtn = createEl('button', {
        class: CLASS_TAG_REMOVE,
        type: 'button',
        'aria-label': `Remove ${runeName}`
      }, ['×']);

      removeBtn.addEventListener('click', () => {
        currentRunes = currentRunes.filter(r => r !== runeName);
        renderTags();
        onChange([...currentRunes]);
      });

      tag.append(nameSpan, removeBtn);
      tagsContainer.appendChild(tag);
    }
  }

  container.setValues = (runeNames) => {
    currentRunes = [...runeNames];
    renderTags();
  };

  container.getValues = () => [...currentRunes];

  return container;
}