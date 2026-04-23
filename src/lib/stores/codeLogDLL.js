import { writable } from 'svelte/store';

export const codeLogDLL = writable([]);

let opCounter = 0;

export function logOpDLL(java, python) {
  const id = `op_${++opCounter}`;
  const javaLines   = Array.isArray(java)   ? java   : [java];
  const pythonLines = Array.isArray(python) ? python : [python ?? java];
  codeLogDLL.update(log => [
    ...log.map(e => ({ ...e, fresh: false })),
    { id, java: javaLines, python: pythonLines, fresh: true }
  ]);
}

export function clearLogDLL() {
  codeLogDLL.set([]);
}