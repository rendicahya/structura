import { createCodeLog } from './codeLog.js';

export const { log: undoRedoLog, logOp: logOpUR, clearLog: clearLogUR } = createCodeLog();
