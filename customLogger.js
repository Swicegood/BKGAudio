import StorageManager from './StorageManager';
import Constants from 'expo-constants';

const isDebug = Constants.expoConfig.extra.enableVerboseLogging;
const MAX_LOGS = 100;
const LOG_KEY = 'DEBUG_LOGS';
const LOG_QUEUE = [];
let isSaving = false;

const processLogQueue = async () => {
  if (isSaving || LOG_QUEUE.length === 0) return;
  
  isSaving = true;
  try {
    const existingLogs = await StorageManager.getItem(LOG_KEY);
    let logs = existingLogs ? JSON.parse(existingLogs) : [];
    
    while (LOG_QUEUE.length > 0) {
      logs.unshift(LOG_QUEUE.pop());
    }
    
    if (logs.length > MAX_LOGS) {
      logs = logs.slice(0, MAX_LOGS);
    }

    await StorageManager.setItem(LOG_KEY, JSON.stringify(logs));
  } catch (error) {
    console.error('Failed to save logs:', error);
  } finally {
    isSaving = false;
    if (LOG_QUEUE.length > 0) {
      processLogQueue();
    }
  }
};

const queueLog = (type, message) => {
  const logEntry = { 
    type, 
    message: typeof message === 'object' ? JSON.stringify(message) : message.toString(),
    timestamp: new Date().toISOString() 
  };
  LOG_QUEUE.push(logEntry);
  processLogQueue();
};

export const customLog = (message, ...optionalParams) => {
  if (!isDebug) return;
  const fullMessage = [message, ...optionalParams].join(' ');
  console.log(`[DEBUG] ${fullMessage}`);
  queueLog('INFO', fullMessage);
};

export const customError = (message, ...optionalParams) => {
  const fullMessage = [message, ...optionalParams].join(' ');
  console.error(`[ERROR] ${fullMessage}`);
  queueLog('ERROR', fullMessage);
};

export const getLogs = async () => {
  try {
    const logs = await StorageManager.getItem(LOG_KEY);
    return logs ? JSON.parse(logs) : [];
  } catch (error) {
    console.error('Failed to retrieve logs:', error);
    return [];
  }
};

export const clearLogs = async () => {
  try {
    await StorageManager.removeItem(LOG_KEY);
  } catch (error) {
    console.error('Failed to clear logs:', error);
  }
};