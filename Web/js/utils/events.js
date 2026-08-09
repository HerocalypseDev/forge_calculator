/** Event utilities
 * @module utils/events
 */

/**
 * Debounce function
 * @param {Function} fn
 * @param {number} delay
 * @returns {Function}
 */
export function debounce(fn, delay) {
  let timeoutId = null;
  return function (...args) {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), delay);
  };
}

/**
 * Throttle function
 * @param {Function} fn
 * @param {number} limit
 * @returns {Function}
 */
export function throttle(fn, limit) {
  let inThrottle = false;
  return function (...args) {
    if (!inThrottle) {
      fn.apply(this, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Event delegation helper
 * @param {Element} parent
 * @param {string} selector
 * @param {string} event
 * @param {Function} handler
 */
export function delegate(parent, selector, event, handler) {
  parent.addEventListener(event, e => {
    const target = e.target.closest(selector);
    if (target && parent.contains(target)) {
      handler.call(target, e);
    }
  });
}

/**
 * Add event listener with automatic cleanup
 * @param {Element} el
 * @param {string} event
 * @param {Function} handler
 * @param {Object} [options]
 * @returns {Function} cleanup function
 */
export function on(el, event, handler, options) {
  el.addEventListener(event, handler, options);
  return () => el.removeEventListener(event, handler, options);
}

/**
 * Add one-time event listener
 * @param {Element} el
 * @param {string} event
 * @param {Function} handler
 * @param {Object} [options]
 */
export function once(el, event, handler, options) {
  const wrapped = e => {
    el.removeEventListener(event, wrapped, options);
    handler(e);
  };
  el.addEventListener(event, wrapped, options);
}

/**
 * Trigger custom event
 * @param {Element} el
 * @param {string} name
 * @param {*} [detail]
 */
export function trigger(el, name, detail) {
  el.dispatchEvent(new CustomEvent(name, { detail, bubbles: true }));
}