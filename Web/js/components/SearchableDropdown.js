
import { createEl, empty } from '../utils/dom.js';
import { debounce, on } from '../utils/events.js';

const CLASS_DROPDOWN = 'ep-searchable-dropdown';
const CLASS_INPUT = 'ep-searchable-input';
const CLASS_ARROW = 'ep-searchable-arrow';
const CLASS_LIST = 'ep-searchable-list';
const CLASS_ITEM = 'ep-searchable-item';
const CLASS_ITEM_HIGHLIGHTED = 'ep-searchable-item--highlighted';
const CLASS_HIDDEN = 'ep-hidden';

export function createSearchableDropdown({ options, value, onChange, placeholder = '', id = '' }) {
  const dropdownId = id || `dropdown-${Math.random().toString(36).slice(2)}`;
  let isOpen = false;
  let highlightedIndex = -1;
  let filteredOptions = options;
  let currentValue = value;

  const container = createEl('div', { class: CLASS_DROPDOWN });

  const input = createEl('input', {
    type: 'text',
    class: CLASS_INPUT,
    placeholder,
    value: currentValue,
    'aria-autocomplete': 'list',
    'aria-controls': `${dropdownId}-list`,
    'aria-expanded': 'false',
    'aria-haspopup': 'listbox',
    id: `${dropdownId}-input`,
    autocomplete: 'off',
    spellcheck: 'false'
  });

  const arrow = createEl('button', {
    type: 'button',
    class: CLASS_ARROW,
    'aria-label': 'Toggle dropdown',
    tabindex: -1
  }, ['▾']);

  const listContainer = createEl('div', {
    class: `${CLASS_LIST} ${CLASS_HIDDEN}`,
    id: `${dropdownId}-list`,
    role: 'listbox',
    'aria-label': placeholder || 'Options'
  });

  const filterOptions = (searchTerm) => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return options;
    return options.filter(opt => opt.toLowerCase().includes(term));
  };

  const renderList = () => {
    empty(listContainer);
    highlightedIndex = -1;

    if (filteredOptions.length === 0) {
      const noResults = createEl('div', { class: `${CLASS_ITEM} ep-searchable-no-results` }, ['No results']);
      listContainer.appendChild(noResults);
      return;
    }

    for (let i = 0; i < filteredOptions.length; i++) {
      const opt = filteredOptions[i];
      const item = createEl('div', {
        class: CLASS_ITEM,
        role: 'option',
        'aria-selected': 'false',
        'data-index': i,
        'data-value': opt
      }, [opt]);
      listContainer.appendChild(item);
    }
  };

  const highlightIndex = (index) => {
    const items = listContainer.querySelectorAll(`.${CLASS_ITEM}[data-index]`);
    items.forEach((item, i) => {
      const isHighlighted = i === index;
      item.classList.toggle(CLASS_ITEM_HIGHLIGHTED, isHighlighted);
      item.setAttribute('aria-selected', isHighlighted);
    });
    highlightedIndex = index;
  };

  const selectHighlighted = () => {
    if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
      const newValue = filteredOptions[highlightedIndex];
      currentValue = newValue;
      input.value = newValue;
      onChange(newValue);
      close();
    }
  };

  const open = (showAll) => {
    if (isOpen) return;
    isOpen = true;
    listContainer.classList.remove(CLASS_HIDDEN);
    input.setAttribute('aria-expanded', 'true');
    arrow.textContent = '▴';
    filteredOptions = filterOptions(showAll ? '' : (input.value === currentValue ? '' : input.value));
    renderList();
    input.focus();
  };

  const close = () => {
    if (!isOpen) return;
    isOpen = false;
    listContainer.classList.add(CLASS_HIDDEN);
    input.setAttribute('aria-expanded', 'false');
    arrow.textContent = '▾';
    highlightedIndex = -1;
  };

  const toggle = (showAll) => {
    if (isOpen) close();
    else open(showAll);
  };

  const handleInput = debounce((e) => {
    const term = e.target.value;
    filteredOptions = filterOptions(term);
    renderList();
    if (!isOpen && filteredOptions.length > 0) {
      open();
    }
  }, 100);

  const handleKeydown = (e) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        open();
      }
      return;
    }

    const items = listContainer.querySelectorAll(`.${CLASS_ITEM}[data-index]`);
    const maxIndex = items.length - 1;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (highlightedIndex < maxIndex) {
          highlightIndex(highlightedIndex + 1);
          items[highlightedIndex]?.scrollIntoView({ block: 'nearest' });
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (highlightedIndex > 0) {
          highlightIndex(highlightedIndex - 1);
          items[highlightedIndex]?.scrollIntoView({ block: 'nearest' });
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
  };

  const handleItemClick = (e) => {
    const item = e.target.closest(`.${CLASS_ITEM}[data-value]`);
    if (item) {
      const value = item.dataset.value;
      currentValue = value;
      input.value = value;
      onChange(value);
      close();
    }
  };

  const handleClickOutside = (e) => {
    if (!container.contains(e.target)) {
      close();
    }
  };

  const handleArrowClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggle(true);
  };

  on(input, 'input', handleInput);
  on(input, 'keydown', handleKeydown);
  on(input, 'focus', () => {
    input.select();
    if (!isOpen && options.length > 0) {
      open();
    }
  });
  on(arrow, 'click', handleArrowClick);
  on(listContainer, 'click', handleItemClick);
  on(document, 'click', handleClickOutside);

  const destroy = () => {
  };

  container.destroy = destroy;
  container.setValue = (val) => {
    currentValue = val;
    input.value = val;
  };
  container.getValue = () => currentValue;
  container.open = open;
  container.close = close;

  container.updateOptions = (newOptions) => {
    options = newOptions;
    filteredOptions = filterOptions(input.value === currentValue ? '' : input.value);
    renderList();
    if (!isOpen && filteredOptions.length > 0) {
      open();
    }
  };

  container.append(input, arrow, listContainer);
  return container;
}