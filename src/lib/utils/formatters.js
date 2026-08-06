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

/**
 * @param {string|null|undefined} val
 * @returns {string}
 */
export function formatCppValue(val) {
    if (!val) return 'nullptr';
    if (/^-?\d+(\.\d+)?$/.test(val.trim())) return val.trim();
    return `"${val}"`;
}

/**
 * Formats a raw value for embedding in generated Java/C++ code, leaving it
 * as an empty string when there's no value (used by linked stack/queue,
 * where an empty literal reads more naturally than `null`/`nullptr`).
 * @param {string|null|undefined} val
 * @returns {string}
 */
export function formatLiteral(val) {
    if (!val) return '';
    if (/^-?\d+(\.\d+)?$/.test(val.trim())) return val.trim();
    return `"${val}"`;
}

/**
 * Python counterpart of {@link formatLiteral}.
 * @param {string|null|undefined} val
 * @returns {string}
 */
export function formatPythonLiteral(val) {
    return formatLiteral(val);
}