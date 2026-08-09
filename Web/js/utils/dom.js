/** DOM helper utilities
 * @module utils/dom
 */

/**
 * Create an element with attributes and children
 * @param {string} tag
 * @param {Object} [attrs={}]
 * @param {(string|Node)[]} [children=[]]
 * @returns {HTMLElement}
 */
export function createEl(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'class') {
      el.className = value;
    } else if (key === 'style' && typeof value === 'object') {
      Object.assign(el.style, value);
    } else if (key.startsWith('on') && typeof value === 'function') {
      el.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === 'dataset') {
      Object.assign(el.dataset, value);
    } else {
      el.setAttribute(key, value);
    }
  }
  for (const child of children) {
    if (typeof child === 'string') {
      el.appendChild(document.createTextNode(child));
    } else {
      el.appendChild(child);
    }
  }
  return el;
}

/**
 * Query selector shorthand
 * @param {string} selector
 * @param {Element} [root=document]
 * @returns {Element|null}
 */
export function $(selector, root = document) {
  return root.querySelector(selector);
}

/**
 * Query selector all shorthand
 * @param {string} selector
 * @param {Element} [root=document]
 * @returns {NodeList}
 */
export function $$(selector, root = document) {
  return root.querySelectorAll(selector);
}

/**
 * Add class(es)
 * @param {HTMLElement} el
 * @param {...string} classes
 */
export function addClass(el, ...classes) {
  el.classList.add(...classes);
}

/**
 * Remove class(es)
 * @param {HTMLElement} el
 * @param {...string} classes
 */
export function removeClass(el, ...classes) {
  el.classList.remove(...classes);
}

/**
 * Toggle class
 * @param {HTMLElement} el
 * @param {string} className
 * @param {boolean} [force]
 */
export function toggleClass(el, className, force) {
  el.classList.toggle(className, force);
}

/**
 * Set multiple attributes
 * @param {HTMLElement} el
 * @param {Object} attrs
 */
export function setAttrs(el, attrs) {
  for (const [key, value] of Object.entries(attrs)) {
    el.setAttribute(key, value);
  }
}

/**
 * Remove all children
 * @param {HTMLElement} el
 */
export function empty(el) {
  while (el.firstChild) {
    el.removeChild(el.firstChild);
  }
}

/**
 * Insert HTML string
 * @param {HTMLElement} el
 * @param {string} html
 * @param {'beforebegin'|'afterbegin'|'beforeend'|'afterend'} [position='beforeend']
 */
export function insertHtml(el, html, position = 'beforeend') {
  el.insertAdjacentHTML(position, html);
}

/**
 * Create a document fragment from HTML string
 * @param {string} html
 * @returns {DocumentFragment}
 */
export function fragmentFromHtml(html) {
  const template = document.createElement('template');
  template.innerHTML = html.trim();
  return template.content;
}