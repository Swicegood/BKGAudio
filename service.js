import TrackPlayer, { Event, PlaybackState } from '@rntp/player';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { customLog, customError } from './customLogger';
import { loadUrl, playWithRetry } from './player';

let isManualNavigation = false;
let listenersRegistered = false;
let isHandlingEnded = false;

global.setManualNavigation = (value) => {
  isManualNavigation = value;
  customLog('Manual navigation flag set to:', value);
};

const loadAndPlayUrl = async (url) => {
  if (!url) {
    customError('No URL provided to loadAndPlayUrl');
    return;
  }
  loadUrl(url);
  await playWithRetry();
};

const handleRemoteNext = async () => {
  customLog('RemoteNext event received');
  isManualNavigation = true;
  try {
    const { getNextFile } = require('./apiWrapper');
    const nextFile = await getNextFile();
    customLog('Loading next file from lockscreen:', nextFile);
    await loadAndPlayUrl(nextFile);
  } catch (error) {
    customError('Error in RemoteNext event:', error);
  } finally {
    setTimeout(() => {
      isManualNavigation = false;
      customLog('Manual navigation flag cleared after RemoteNext');
    }, 3000);
  }
};

const handleRemotePrevious = async () => {
  customLog('RemotePrevious event received');
  isManualNavigation = true;
  try {
    const current = TrackPlayer.getActiveMediaItem();
    customLog('Current track before previous:', current?.url);

    const { getPreviousFile } = require('./apiWrapper');
    const previousFile = await getPreviousFile();

    if (previousFile !== null && previousFile !== 0) {
      customLog('Loading previous file from lockscreen:', previousFile);
      await loadAndPlayUrl(previousFile);
    } else {
      customLog('No previous file available from lockscreen');
    }
  } catch (error) {
    customError('Error in RemotePrevious event:', error);
  } finally {
    setTimeout(() => {
      isManualNavigation = false;
      customLog('Manual navigation flag cleared after RemotePrevious');
    }, 3000);
  }
};

const handleRemoteStop = async () => {
  customLog('RemoteStop event received');
  try {
    const progress = TrackPlayer.getProgress();
    const track = TrackPlayer.getActiveMediaItem();
    if (track?.url) {
      await AsyncStorage.setItem('lastSongUrl', track.url);
      await AsyncStorage.setItem('lastSongPosition', String(progress.position));
      customLog('Saved last song state:', { url: track.url, position: progress.position });
    }
    TrackPlayer.stop();
  } catch (error) {
    customError('Error in RemoteStop event:', error);
  }
};

const handlePlaybackEnded = async () => {
  if (isManualNavigation || isHandlingEnded) {
    customLog('Skipping auto-continuation', { isManualNavigation, isHandlingEnded });
    return;
  }

  isHandlingEnded = true;
  try {
    customLog('Playback ended, fetching next file');
    const { getNextFile } = require('./apiWrapper');
    const nextFile = await getNextFile();
    customLog('Next File to play:', nextFile);
    await loadAndPlayUrl(nextFile);
  } catch (error) {
    customError('Error after playback ended:', error);
  } finally {
    setTimeout(() => {
      isHandlingEnded = false;
    }, 2000);
  }
};

export async function handleBackgroundEvent(event) {
  switch (event.type) {
    case Event.RemotePlay:
      TrackPlayer.play();
      break;
    case Event.RemotePause:
      TrackPlayer.pause();
      break;
    case Event.RemoteStop:
      await handleRemoteStop();
      break;
    case Event.RemoteNext:
      await handleRemoteNext();
      break;
    case Event.RemotePrevious:
      await handleRemotePrevious();
      break;
    case Event.PlaybackStateChanged:
      if (event.state === PlaybackState.Ended) {
        await handlePlaybackEnded();
      }
      break;
    case Event.PlaybackError:
      customError('PlaybackError occurred:', event);
      break;
    default:
      break;
  }
}

export function registerPlayerEventListeners() {
  if (listenersRegistered) {
    return;
  }
  listenersRegistered = true;

  TrackPlayer.addEventListener(Event.RemotePlay, () => {
    customLog('RemotePlay event received');
    TrackPlayer.play();
  });
  TrackPlayer.addEventListener(Event.RemotePause, () => {
    customLog('RemotePause event received');
    TrackPlayer.pause();
  });
  TrackPlayer.addEventListener(Event.RemoteStop, handleRemoteStop);
  TrackPlayer.addEventListener(Event.RemoteNext, handleRemoteNext);
  TrackPlayer.addEventListener(Event.RemotePrevious, handleRemotePrevious);
  TrackPlayer.addEventListener(Event.PlaybackStateChanged, (event) => {
    customLog('PlaybackState changed:', event.state);
    if (event.state === PlaybackState.Ready) {
      const progress = TrackPlayer.getProgress();
      const item = TrackPlayer.getActiveMediaItem();
      customLog('Player is ready, current position:', progress.position);
      customLog('Current track url:', item?.url);
    } else if (event.state === PlaybackState.Ended) {
      handlePlaybackEnded();
    }
  });
  TrackPlayer.addEventListener(Event.PlaybackError, (error) => {
    customError('PlaybackError occurred:', error);
  });
  TrackPlayer.addEventListener(Event.MediaItemTransition, (event) => {
    customLog('MediaItemTransition:', event.item?.url, 'index:', event.index);
  });

  customLog('All event listeners registered');
}
