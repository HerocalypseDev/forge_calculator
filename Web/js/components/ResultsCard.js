/** Results Card Component
 * ep-card wrapper for stat rows
 * @module components/ResultsCard
 */

import { createEl } from '../utils/dom.js';

const CLASS_CARD = 'ep-card';
const CLASS_HEAD = 'ep-card-head';
const CLASS_ICON = 'ep-card-icon';
const CLASS_TITLE = 'ep-card-title';
const CLASS_BODY = 'ep-card-body';
const CLASS_ROWS = 'ep-stat-rows';

/**
 * Create a results card
 * @param {Object} options
 * @param {string} options.title - Card title
 * @param {HTMLElement|DocumentFragment} options.content - Stat rows content
 * @param {string} [options.icon] - Custom icon (default: diamond)
 * @returns {HTMLElement}
 */
export function createResultsCard({ title, content, icon }) {
  const card = createEl('div', { class: CLASS_CARD });

  const head = createEl('div', { class: CLASS_HEAD });
  const iconEl = createEl('span', { class: CLASS_ICON });
  const titleEl = createEl('span', { class: CLASS_TITLE }, [title]);
  head.append(iconEl, titleEl);

  const body = createEl('div', { class: CLASS_BODY });
  const rowsContainer = createEl('div', { class: CLASS_ROWS });
  rowsContainer.append(content);
  body.appendChild(rowsContainer);

  card.append(head, body);
  return card;
}

/**
 * Update card content
 * @param {HTMLElement} card
 * @param {HTMLElement|DocumentFragment} content
 */
export function updateResultsCard(card, content) {
  const rowsContainer = card.querySelector(`.${CLASS_ROWS}`);
  if (rowsContainer) {
    rowsContainer.innerHTML = '';
    rowsContainer.append(content);
  }
}

/**
 * Create a full-width card for active traits
 * @param {string} text
 * @returns {HTMLElement}
 */
export function createTraitsCard(text) {
  const card = createEl('div', { class: CLASS_CARD });
  const head = createEl('div', { class: CLASS_HEAD });
  const iconEl = createEl('span', { class: CLASS_ICON });
  const titleEl = createEl('span', { class: CLASS_TITLE }, ['Active Traits']);
  head.append(iconEl, titleEl);

  const body = createEl('div', { class: CLASS_BODY, style: 'padding-left: 0;' });
  body.textContent = text;
  card.append(head, body);
  return card;
}