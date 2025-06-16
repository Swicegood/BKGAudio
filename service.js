import TrackPlayer, { Event, State } from 'react-native-track-player';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { customLog, customError } from './customLogger';
import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from 'expo-av';

const requestAudioFocus = async () => {
    try {
      await Audio.setAudioModeAsync({
        staysActiveInBackground: true,
        interruptionModeIOS: InterruptionModeIOS.DuckOthers,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
        playThroughEarpieceAndroid: false,
      });
      return true;
    } catch (error) {
      customError('Failed to set audio mode:', error);
      return false;
    }
  };

module.exports = async function () {
  customLog('Service function started');

  TrackPlayer.addEventListener(Event.RemotePlay, () => {
    customLog('RemotePlay event received');
    TrackPlayer.play();
  });

  TrackPlayer.addEventListener(Event.RemotePause, () => {
    customLog('RemotePause event received');
    TrackPlayer.pause();
  });

  TrackPlayer.addEventListener(Event.RemoteStop, async () => {
    customLog('RemoteStop event received');
    try {
      const position = await TrackPlayer.getPosition();
      const currentTrack = await TrackPlayer.getCurrentTrack();
      if (currentTrack) {
        const trackObject = await TrackPlayer.getTrack(currentTrack);
        await AsyncStorage.setItem('lastSongUrl', trackObject.url);
        await AsyncStorage.setItem('lastSongPosition', position.toString());
        customLog('Saved last song state:', { url: trackObject.url, position });
      }
      await TrackPlayer.destroy();
      customLog('TrackPlayer destroyed');
    } catch (error) {
      customError('Error in RemoteStop event:', error);
    }
  });

  TrackPlayer.addEventListener(Event.RemoteNext, () => {
    customLog('RemoteNext event received');
    TrackPlayer.skipToNext();
  });

  TrackPlayer.addEventListener(Event.RemotePrevious, () => {
    customLog('RemotePrevious event received');
    TrackPlayer.skipToPrevious();
  });

  const playWithRetry = async (retries = 5) => {
    for (let i = 0; i < retries; i++) {
      try {
        await TrackPlayer.stop();
        await TrackPlayer.play();
        const state = await TrackPlayer.getState();
        customLog(`Attempt ${i + 1}: PlaybackState after play:`, state);
        if (state === State.Playing) {
          customLog('Successfully started playback');
          return;
        }
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 1 second before retry
      } catch (error) {
        customError(`Attempt ${i + 1} failed:`, error);
      }
    }
    customError('Failed to start playback after', retries, 'attempts');
  };

  TrackPlayer.addEventListener(Event.PlaybackQueueEnded, async (event) => {
    customLog('PlaybackQueueEnded event received', event);
    try {
      customLog('Queue ended, fetching next file');
      const { getNextFile } = require('./apiWrapper');
      const nextFile = await getNextFile();
      customLog('Next File to play:', nextFile);
      await TrackPlayer.reset();
      await TrackPlayer.add({
        id: '1',
        url: nextFile,
        title: nextFile.split('/').pop().replace(/\.mp3$/, ''),
      });
      const playerState = await TrackPlayer.getState();
      customLog('Player state before play:', playerState);
      const queue = await TrackPlayer.getQueue();
      console.log('Current queue:', queue);
      if (queue.length === 0) {
        customError('No tracks in queue');
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
      customLog('Trying to request audio focus');
      const focusGranted = await requestAudioFocus();
      if (focusGranted) {
        customLog('Trying to play next file');
        await playWithRetry();
      } else {
        customError('Failed to get audio focus');
      }
      customLog('Setting rate to 1.0');
      await TrackPlayer.setRate(1.0);
    } catch (error) {
      customError('Error in PlaybackQueueEnded event:', error);
    }
  });

  TrackPlayer.addEventListener(Event.PlaybackState, async (event) => {
    customLog('PlaybackState changed:', event.state);
    if (event.state === State.Ready) {
      customLog('Player is ready, current position:', await TrackPlayer.getPosition());
      customLog('Current track:', await TrackPlayer.getActiveTrackIndex());
      customLog('Current track url:', (await TrackPlayer.getTrack(await TrackPlayer.getActiveTrackIndex())).url);
    } else if (event.state === State.Stopped) {
      customLog('Playback stopped, checking if queue is empty');
      const queue = await TrackPlayer.getQueue();
      if (queue.length === 0) {
        customLog('Queue is empty, fetching next file');
        const { getNextFile } = require('./apiWrapper');
        const nextFile = await getNextFile();
        customLog('Next file to play:', nextFile);
        await TrackPlayer.add({
          id: '1',
          url: nextFile,
          title: nextFile.split('/').pop().replace(/\.mp3$/, ''),
        });
        await TrackPlayer.play();
        customLog('Started playing next file');
      }
    }
  });

  TrackPlayer.addEventListener(Event.PlaybackError, (error) => {
    customError('PlaybackError occurred:', error);
  });

  TrackPlayer.addEventListener(Event.PlaybackTrackChanged, (event) => {
    customLog('PlaybackTrackChanged:', event);
  });

  TrackPlayer.addEventListener('remote-duck', async (event) => {
    if (event.permanent) {
      await TrackPlayer.pause();
    } else {
      if (event.paused) {
        await TrackPlayer.pause();
      } else {
        await TrackPlayer.play();
      }
    }
  });

  customLog('All event listeners registered');
};