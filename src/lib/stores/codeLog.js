import { writable } from 'svelte/store';

export const codeLog = writable([]); // [{ id, lines: string[], fresh: bool }]

let opCounter = 0;

export function logOp(lines) {
  const id = `op_${++opCounter}`;
  // Mark all previous as not fresh
  codeLog.update(log => [
    ...log.map(e => ({ ...e, fresh: false })),
    { id, lines: Array.isArray(lines) ? lines : [lines], fresh: true }
  ]);
}

export function clearLog() {
  codeLog.set([]);
}