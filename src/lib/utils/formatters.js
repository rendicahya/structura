/**
 * @param {string|null|undefined} val
 * @returns {string}
 */
export function formatValue(val) {
  if (!val) return 'null';
  if (/^-?\d+(\.\d+)?$/.test(val.trim())) return val.trim();
  return `"${val}"`;
}

/**
 * @param {string|null|undefined} val
 * @returns {string}
 */
export function formatPythonValue(val) {
  if (!val) return 'None';
  if (/^-?\d+(\.\d+)?$/.test(val.trim())) return val.trim();
  return `"${val}"`;
}