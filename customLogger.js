import StorageManager from './StorageManager';
import Constants from 'expo-constants';

const isDebug = Constants.expoConfig.extra.enableVerboseLogging;
const MAX_LOGS = 100;
const LOG_KEY = 'DEBUG_LOGS';

const saveLog = async (type, message) => {
  try {
    const existingLogs = await StorageManager.getItem(LOG_KEY);
    let logs = existingLogs ? JSON.parse(existingLogs) : [];
    
    logs.unshift({ type, message, timestamp: new Date().toISOString() });
    
    if (logs.length > MAX_LOGS) {
      logs = logs.slice(0, MAX_LOGS);
    }

    await StorageManager.setItem(LOG_KEY, JSON.stringify(logs));
  } catch (error) {
    console.error('Failed to save log:', error);
  }
};

export const customLog = (message, ...optionalParams) => {
  if (isDebug) {
    console.log(`[DEBUG] ${message}`, ...optionalParams);
    saveLog('INFO', message);
  }
};

export const customError = (message, ...optionalParams) => {
  console.error(`[ERROR] ${message}`, ...optionalParams);
  saveLog('ERROR', message);
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