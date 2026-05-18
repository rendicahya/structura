import { writable } from 'svelte/store';

/** @type {import('svelte/store').Writable<any[]>} */
const past = writable([]);

/** @type {import('svelte/store').Writable<any[]>} */
const future = writable([]);

/** @type {any[]} */
let _past = [];

/** @type {any[]} */
let _future = [];

past.subscribe(v => _past = v);
future.subscribe(v => _future = v);

/** @type {() => any} */
let _getSnapshot = () => ({});
/** @type {(snap: any) => void} */
let _applySnapshot = () => {};

/**
 * Register functions to handle snapshots for the current data structure.
 * @param {() => any} getSnap 
 * @param {(snap: any) => void} applySnap 
 */
export function registerHistoryHandlers(getSnap, applySnap) {
    _getSnapshot = getSnap;
    _applySnapshot = applySnap;
}

export function pushHistory() {
    const snap = _getSnapshot();
    past.update(p => [...p, snap]);
    future.set([]);
}

export function undo() {
    if (_past.length < 2) return;
    const current = _past[_past.length - 1];
    const prev = _past[_past.length - 2];
    future.update(f => [current, ...f]);
    past.update(p => p.slice(0, -1));
    _applySnapshot(prev);
}

export function redo() {
    if (_future.length === 0) return;
    const next = _future[0];
    past.update(p => [...p, next]);
    future.update(f => f.slice(1));
    _applySnapshot(next);
}

export const canUndo = { subscribe: (fn) => past.subscribe(p => fn(p.length >= 2)) };
export const canRedo = { subscribe: (fn) => future.subscribe(f => fn(f.length > 0)) };

export function initHistory() {
    const snap = _getSnapshot();
    past.set([snap]);
    future.set([]);
}
