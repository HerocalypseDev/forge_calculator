/** Object Utilities
 * @module utils/object
 */

/**
 * Deep clone an object
 * @param {*} obj
 * @returns {*}
 */
export function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Deep merge objects
 * @param {Object} target
 * @param {Object} source
 * @returns {Object}
 */
export function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

/**
 * Check if two values are deeply equal
 * @param {*} a
 * @param {*} b
 * @returns {boolean}
 */
export function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}