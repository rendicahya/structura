/**
 * Local-storage autosave for the structure the user is currently building.
 *
 * Every structure already produces a `getSnapshot()` blob and every mutation
 * is bracketed by `pushHistory()`, so the history layer (see
 * stores/shared/history.js) calls {@link persistProject} on every change,
 * undo and redo. The snapshot is written under a per-structure key so each
 * page reloads with its own work intact; App.svelte restores them all on
 * mount via `APPLY_SNAPSHOT_BY_TYPE`.
 *
 * Writes are debounced (a mutation fires `pushHistory` twice) and also
 * flushed synchronously when the page is hidden or unloaded, so closing the
 * tab right after an edit doesn't drop it. Every localStorage access is
 * guarded — it throws in private-mode Safari and when the quota is hit.
 */

const PREFIX = 'structura:project:';
const DEBOUNCE_MS = 400;

/** @type {string|null} the `_type` of the structure on the active page */
let activeType = null;

/** @type {Map<string, ReturnType<typeof setTimeout>>} pending write per type */
const timers = new Map();
/** @type {Map<string, any>} latest snapshot awaiting a debounced write */
const pending = new Map();

/**
 * A snapshot with no own keys is the placeholder the history layer reports
 * before any toolbar has registered a real `getSnapshot` — never persist it
 * over restored work.
 * @param {any} snap
 */
function isMeaningful(snap) {
    return !!snap && typeof snap === 'object' && Object.keys(snap).length > 0;
}

/**
 * Tell the autosave layer which structure is on screen. Passing `null`
 * (a non-structure route) suspends persistence.
 * @param {string|null} type
 */
export function setActiveType(type) {
    activeType = type ?? null;
}

/** @param {string} type @param {any} snap */
function writeNow(type, snap) {
    try {
        localStorage.setItem(
            PREFIX + type,
            JSON.stringify({ ...snap, _type: type, _savedAt: Date.now() }),
        );
    } catch {
        // private mode / quota exceeded — nothing we can do, drop it
    }
}

/**
 * Queue a debounced write of the active structure's snapshot.
 * @param {any} snap  result of the active structure's `getSnapshot()`
 */
export function persistProject(snap) {
    if (!activeType || !isMeaningful(snap)) return;
    const type = activeType;
    pending.set(type, snap);
    clearTimeout(timers.get(type));
    timers.set(
        type,
        setTimeout(() => {
            timers.delete(type);
            const latest = pending.get(type);
            pending.delete(type);
            if (latest !== undefined) writeNow(type, latest);
        }, DEBOUNCE_MS),
    );
}

/** Write any debounced snapshots immediately (page hide / unload). */
export function flushProjects() {
    for (const [type, timer] of timers) {
        clearTimeout(timer);
        const latest = pending.get(type);
        if (latest !== undefined) writeNow(type, latest);
    }
    timers.clear();
    pending.clear();
}

/**
 * The saved snapshot for a structure type, or `null` if there is none.
 * @param {string} type
 * @returns {any|null}
 */
export function loadProject(type) {
    try {
        const raw = localStorage.getItem(PREFIX + type);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

/** @param {string} type */
export function clearProject(type) {
    try {
        localStorage.removeItem(PREFIX + type);
    } catch {
        // ignore
    }
}

/**
 * Every structure type that currently has a saved project.
 * @returns {string[]}
 */
export function listSavedProjectTypes() {
    const out = [];
    try {
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(PREFIX)) out.push(key.slice(PREFIX.length));
        }
    } catch {
        // ignore
    }
    return out;
}

if (typeof window !== 'undefined') {
    // `pagehide` fires on tab close / navigation; `visibilitychange` covers
    // mobile app-switch where `pagehide` may not run.
    window.addEventListener('pagehide', flushProjects);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') flushProjects();
    });
}
