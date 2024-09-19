import Constants from 'expo-constants';

const isDebug = Constants.expoConfig.extra.enableVerboseLogging;

export const customLog = (message, ...optionalParams) => {
  if (isDebug) {
    console.log(`[DEBUG] ${message}`, ...optionalParams);
  }
};

export const customError = (message, ...optionalParams) => {
  console.error(`[ERROR] ${message}`, ...optionalParams);
};