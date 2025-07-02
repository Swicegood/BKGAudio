import TrackPlayer, { Event, State } from 'react-native-track-player';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { customLog, customError } from './customLogger';
import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from 'expo-av';

// Global flag to prevent service interference during manual navigation
let isManualNavigation = false;

// Function to set manual navigation flag (will be called from main app)
global.setManualNavigation = (value) => {
  isManualNavigation = value;
  customLog('Manual navigation flag set to:', value);
};

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

  TrackPlayer.addEventListener(Event.RemoteNext, async () => {
    customLog('RemoteNext event received');
    try {
      const { getNextFile } = require('./apiWrapper');
      const nextFile = await getNextFile();
      customLog('Loading next file from lockscreen:', nextFile);
      
      await TrackPlayer.reset();
      await TrackPlayer.add({
        id: '1',
        url: nextFile,
        title: nextFile.split('/').pop().replace(/\.mp3$/, ''),
      });
      
      const focusGranted = await requestAudioFocus();
      if (focusGranted) {
        await playWithRetry();
      } else {
        customError('Failed to get audio focus for next track');
      }
    } catch (error) {
      customError('Error in RemoteNext event:', error);
    }
  });

  TrackPlayer.addEventListener(Event.RemotePrevious, async () => {
    customLog('RemotePrevious event received');
    try {
      // Log current state before making changes
      const currentTrack = await TrackPlayer.getActiveTrackIndex();
      if (currentTrack !== null && currentTrack !== undefined) {
        const trackObject = await TrackPlayer.getTrack(currentTrack);
        customLog('Current track before previous:', trackObject?.url);
      }
      
      const { getPreviousFile } = require('./apiWrapper');
      const previousFile = await getPreviousFile();
      
      if (previousFile !== null && previousFile !== 0) {
        customLog('Loading previous file from lockscreen:', previousFile);
        
        await TrackPlayer.reset();
        await TrackPlayer.add({
          id: '1',
          url: previousFile,
          title: previousFile.split('/').pop().replace(/\.mp3$/, ''),
        });
        
        customLog('Successfully added previous track to player:', previousFile);
        
        const focusGranted = await requestAudioFocus();
        if (focusGranted) {
          await playWithRetry();
          customLog('Started playing previous track from lockscreen');
        } else {
          customError('Failed to get audio focus for previous track');
        }
      } else {
        customLog('No previous file available from lockscreen');
      }
    } catch (error) {
      customError('Error in RemotePrevious event:', error);
    }
  });

  const playWithRetry = async (retries = 3) => {
    for (let i = 0; i < retries; i++) {
      try {
        await TrackPlayer.play();
        const state = await TrackPlayer.getState();
        customLog(`Attempt ${i + 1}: PlaybackState after play:`, state);
        if (state === State.Playing) {
          customLog('Successfully started playback');
          return;
        }
        await new Promise(resolve => setTimeout(resolve, 500));
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
      
      const queue = await TrackPlayer.getQueue();
      customLog('Current queue length:', queue.length);
      if (queue.length === 0) {
        customError('No tracks in queue');
        return;
      }
      
      // Minimize delay for background processing
      customLog('Requesting audio focus and starting playback immediately');
      const focusGranted = await requestAudioFocus();
      if (focusGranted) {
        await playWithRetry();
      } else {
        customError('Failed to get audio focus');
      }
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
        if (isManualNavigation) {
          customLog('Manual navigation in progress, skipping auto-continuation');
          return;
        }
        
        customLog('Queue is empty, fetching next file (natural track ending)');
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