import { createCodeLog } from './codeLog.js';

export const { log: queueLog, logOp: logOpQueue, clearLog: clearLogQueue } = createCodeLog();