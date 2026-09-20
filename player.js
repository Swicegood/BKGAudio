import TrackPlayer, { PlayerCommand } from '@rntp/player';
import { customError, customLog } from './customLogger';

export function mediaItemFromUrl(url, mediaId) {
  const filename = (url || '').split('/').pop() || 'audio';
  return {
    mediaId: mediaId || url,
    url,
    title: filename.replace(/\.mp3$/i, ''),
    artist: 'Bir Krishna Goswami',
  };
}

export function loadUrl(url, mediaId) {
  try {
    TrackPlayer.setMediaItem(mediaItemFromUrl(url, mediaId));
  } catch (error) {
    customError('Failed to load media item:', error);
  }
}

export async function playWithRetry(retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      TrackPlayer.play();
      await new Promise((resolve) => setTimeout(resolve, 400));
      if (TrackPlayer.isPlaying()) {
        customLog('Successfully started playback');
        return true;
      }
      customLog(`Attempt ${i + 1}: still not playing`);
    } catch (error) {
      customError(`Attempt ${i + 1} failed:`, error);
    }
  }
  customError('Failed to start playback after', retries, 'attempts');
  return false;
}

let didSetup = false;

export function setupAppPlayer() {
  if (didSetup) {
    return;
  }

  try {
    TrackPlayer.setupPlayer({
      contentType: 'music',
      handleAudioBecomingNoisy: true,
      audioMixing: 'exclusive',
      android: {
        wakeMode: 'network',
        taskRemovedBehavior: 'continue',
      },
    });
  } catch (error) {
    const message = String(error?.message || error);
    if (!message.includes('already set up')) {
      customError('Failed to set up player:', error);
      return;
    }
  }

  try {
    TrackPlayer.setCommands({
      capabilities: [
        PlayerCommand.PlayPause,
        PlayerCommand.Next,
        PlayerCommand.Previous,
        PlayerCommand.Seek,
        PlayerCommand.SkipForward,
        PlayerCommand.SkipBackward,
        PlayerCommand.Stop,
      ],
      handling: 'hybrid',
      perCommandHandling: {
        [PlayerCommand.PlayPause]: 'native',
        [PlayerCommand.Seek]: 'native',
        [PlayerCommand.SkipForward]: 'native',
        [PlayerCommand.SkipBackward]: 'native',
        [PlayerCommand.Next]: 'js',
        [PlayerCommand.Previous]: 'js',
        [PlayerCommand.Stop]: 'js',
      },
      forwardInterval: 30,
      backwardInterval: 15,
    });
    didSetup = true;
  } catch (error) {
    customError('Failed to set player commands:', error);
  }
}
