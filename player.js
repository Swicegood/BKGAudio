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
  TrackPlayer.setMediaItem(mediaItemFromUrl(url, mediaId));
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

export function setupAppPlayer() {
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
    customLog('Player already set up:', error?.message || error);
  }

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
}
