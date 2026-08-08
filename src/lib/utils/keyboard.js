/**
 * @param {KeyboardEvent} e
 */
export function isTypingTarget(e) {
    const target = /** @type {HTMLElement|null} */ (e.target);
    if (!target) return false;
    const tag = target.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}
