import { createCodeLog } from './codeLog.js';

export const { log: requestQueueLog, logOp: logOpRQ, clearLog: clearLogRQ } = createCodeLog();
