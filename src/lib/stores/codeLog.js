import { writable } from 'svelte/store';

export const codeLog = writable([]);

let opCounter = 0;

export function logOp(java, python) {
  const id = `op_${++opCounter}`;
  const javaLines   = Array.isArray(java)   ? java   : [java];
  const pythonLines = Array.isArray(python) ? python : [python ?? java];
  codeLog.update(log => [
    ...log.map(e => ({ ...e, fresh: false })),
    { id, java: javaLines, python: pythonLines, fresh: true }
  ]);
}

export function clearLog() {
  codeLog.set([]);
}