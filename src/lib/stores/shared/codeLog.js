import { writable } from 'svelte/store';

export function createCodeLog() {
  /** @type {import('svelte/store').Writable<any[]>} */
  const log = writable([]);
  let opCounter = 0;

  /**
   * @param {string|string[]} java
   * @param {string|string[]} [python]
   */
  function logOp(java, python) {
    const id = `op_${++opCounter}`;
    const javaLines = Array.isArray(java) ? java : [java];
    const pythonLines = Array.isArray(python) ? python : [python ?? java];
    log.update(entries => [
      ...entries.map(e => ({ ...e, fresh: false })),
      { id, java: javaLines, python: pythonLines, fresh: true }
    ]);
  }

  function clearLog() {
    log.set([]);
  }

  return { log, logOp, clearLog };
}