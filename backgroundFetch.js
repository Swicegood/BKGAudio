import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import TrackPlayer, { State } from 'react-native-track-player';
import { customLog, customError } from './customLogger';
import StorageManager from './StorageManager';

const BACKGROUND_FETCH_TASK = 'background-fetch';

TaskManager.defineTask(BACKGROUND_FETCH_TASK, async () => {
  try {
    customLog('Background fetch started');
    
    // Only resume playback if user was actually playing when they left the app
    const wasPlayingWhenLeft = await StorageManager.getItem('wasPlayingWhenLeft');
    
    if (wasPlayingWhenLeft === 'true') {
      const currentState = await TrackPlayer.getState();
      customLog('Current TrackPlayer state:', currentState);
      
      // Only resume if the player is paused or ready, not if it's already playing
      if (currentState === State.Paused || currentState === State.Ready) {
        customLog('Resuming playback from background fetch');
        await TrackPlayer.play();
      } else {
        customLog('TrackPlayer already in playing state, no action needed');
      }
    } else {
      customLog('User was not playing when they left the app, not resuming playback');
    }
    
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