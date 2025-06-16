import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { customLog, customError } from './customLogger';

const BACKGROUND_FETCH_TASK = 'background-fetch';

TaskManager.defineTask(BACKGROUND_FETCH_TASK, async () => {
  try {
    customLog('Background fetch started');
    // Your background fetch logic here
      // No track playing, try to start the next one
    await TrackPlayer.play();
    customLog('Background fetch completed');
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    customError('Background fetch failed', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export const registerBackgroundFetch = async () => {
  try {
    await BackgroundFetch.registerTaskAsync(BACKGROUND_FETCH_TASK, {
      minimumInterval: 60, // 1 minute
      stopOnTerminate: false,
      startOnBoot: true,
    });
    customLog('Background fetch registered');
  } catch (err) {
    customError('Background fetch registration failed', err);
  }
};

export const unregisterBackgroundFetch = async () => {
  try {
    await BackgroundFetch.unregisterTaskAsync(BACKGROUND_FETCH_TASK);
  } catch (err) {
    customError("Task Unregister failed:", err);
  }
};