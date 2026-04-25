import { createCodeLog } from '../shared/codeLog.js';

const { log: codeLogDLL, logOp: logOpDLL, clearLog: clearLogDLL } = createCodeLog();

/** @type {import('svelte/store').Writable<any[]>} */
export { codeLogDLL, logOpDLL, clearLogDLL };