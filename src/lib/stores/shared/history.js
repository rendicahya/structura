import { writable } from 'svelte/store';
import { getSnapshot, applySnapshot } from '../sll/graph.js';

const past = writable([]);
const future = writable([]);

let _past = [];
let _future = [];
past.subscribe(v => _past = v);
future.subscribe(v => _future = v);

export function pushHistory() {
  const snap = getSnapshot();
  past.update(p => [...p, snap]);
  future.set([]);
}

export function undo() {
  if (_past.length < 2) return;
  const current = _past[_past.length - 1];
  const prev = _past[_past.length - 2];
  future.update(f => [current, ...f]);
  past.update(p => p.slice(0, -1));
  applySnapshot(prev);
}

export function redo() {
  if (_future.length === 0) return;
  const next = _future[0];
  past.update(p => [...p, next]);
  future.update(f => f.slice(1));
  applySnapshot(next);
}

export const canUndo = { subscribe: (fn) => past.subscribe(p => fn(p.length >= 2)) };
export const canRedo = { subscribe: (fn) => future.subscribe(f => fn(f.length > 0)) };

export function initHistory() {
  const snap = getSnapshot();
  past.set([snap]);
  future.set([]);
}