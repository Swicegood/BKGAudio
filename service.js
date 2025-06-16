import TrackPlayer, { Event, State } from 'react-native-track-player';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { customLog, customError } from './customLogger';

// Audio focus management for Android
const requestAudioFocus = async () => {
  try {
    // In a real app, you'd use react-native-audio-focus or similar
    // For now, we'll assume we have focus
    return true;
  } catch (error) {
    customError('Error requesting audio focus:', error);
    return false;
  }
};

// Track auto-advance to prevent duplicate loading
let isAutoAdvancing = false;

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
      const position = await TrackPlayer.getProgress();
      const currentTrack = await TrackPlayer.getActiveTrackIndex();
      if (currentTrack !== null && currentTrack !== undefined) {
        const trackObject = await TrackPlayer.getTrack(currentTrack);
        if (trackObject) {
          await AsyncStorage.setItem('lastSongUrl', trackObject.url);
          await AsyncStorage.setItem('lastSongPosition', position.position.toString());
          customLog('Saved last song state:', { url: trackObject.url, position: position.position });
        }
      }
    } catch (error) {
      customError('Error saving state in RemoteStop:', error);
    }
  });

  TrackPlayer.addEventListener(Event.RemoteNext, async () => {
    customLog('RemoteNext event received');
    await loadNextTrack();
  });

  TrackPlayer.addEventListener(Event.RemotePrevious, async () => {
    customLog('RemotePrevious event received');
    await loadPreviousTrack();
  });

  const loadNextTrack = async () => {
    if (isAutoAdvancing) {
      customLog('Already auto-advancing, skipping duplicate request');
      return;
    }
    
    isAutoAdvancing = true;
    try {
      customLog('Loading next track');
      const { getNextFile } = require('./apiWrapper');
      const nextFile = await getNextFile();
      
      if (nextFile) {
        customLog('Next File to play:', nextFile);
        await TrackPlayer.reset();
        await TrackPlayer.add({
          id: Date.now().toString(),
          url: nextFile,
          title: nextFile.split('/').pop().replace(/\.mp3$/, ''),
          artist: 'Bir Krishna Goswami',
        });
        
        // Wait a moment for the track to be added
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const queue = await TrackPlayer.getQueue();
        customLog('Queue after adding track:', queue.length);
        
        if (queue.length > 0) {
          await TrackPlayer.play();
          customLog('Started playing next track');
        } else {
          customError('No tracks in queue after adding');
        }
      } else {
        customError('No next file available');
      }
    } catch (error) {
      customError('Error in loadNextTrack:', error);
    } finally {
      isAutoAdvancing = false;
    }
  };

  const loadPreviousTrack = async () => {
    try {
      customLog('Loading previous track');
      const { getPreviousFile } = require('./apiWrapper');
      const previousFile = await getPreviousFile();
      
      if (previousFile && previousFile !== 0) {
        customLog('Previous File to play:', previousFile);
        await TrackPlayer.reset();
        await TrackPlayer.add({
          id: Date.now().toString(),
          url: previousFile,
          title: previousFile.split('/').pop().replace(/\.mp3$/, ''),
          artist: 'Bir Krishna Goswami',
        });
        
        await new Promise(resolve => setTimeout(resolve, 100));
        await TrackPlayer.play();
        customLog('Started playing previous track');
      } else {
        customLog('No previous file available');
      }
    } catch (error) {
      customError('Error in loadPreviousTrack:', error);
    }
  };

  // Handle track changes and auto-advance
  TrackPlayer.addEventListener(Event.PlaybackTrackChanged, async (event) => {
    customLog('PlaybackTrackChanged:', event);
    
    if (event.nextTrack !== null && event.nextTrack !== undefined) {
      try {
        const track = await TrackPlayer.getTrack(event.nextTrack);
        if (track) {
          customLog('Now playing:', track.title);
        }
      } catch (error) {
        customError('Error getting track info:', error);
      }
    }
  });

  // Handle playback state changes
  TrackPlayer.addEventListener(Event.PlaybackState, async (event) => {
    customLog('PlaybackState changed:', event.state);
    
    if (event.state === State.Ready) {
      try {
        const position = await TrackPlayer.getProgress();
        const currentTrack = await TrackPlayer.getActiveTrackIndex();
        customLog('Player is ready, position:', position.position, 'track:', currentTrack);
      } catch (error) {
        customError('Error getting player info in Ready state:', error);
      }
    }
  });

  // Handle queue ending - this is the key for continuous playback
  TrackPlayer.addEventListener(Event.PlaybackQueueEnded, async (event) => {
    customLog('PlaybackQueueEnded event received', event);
    
    // Auto-advance to next track
    await loadNextTrack();
  });

  // Handle playback errors
  TrackPlayer.addEventListener(Event.PlaybackError, async (error) => {
    customError('PlaybackError occurred:', error);
    
    // Try to recover by loading the next track
    try {
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
      await loadNextTrack();
    } catch (recoveryError) {
      customError('Failed to recover from playback error:', recoveryError);
    }
  });

  // Handle audio interruptions (calls, notifications, etc.)
  TrackPlayer.addEventListener('remote-duck', async (event) => {
    customLog('Audio ducking event:', event);
    
    if (event.permanent) {
      // Permanent interruption (like a phone call)
      await TrackPlayer.pause();
    } else {
      // Temporary interruption (like a notification)
      if (event.paused) {
        await TrackPlayer.pause();
      } else {
        // Resume after interruption
        const focusGranted = await requestAudioFocus();
        if (focusGranted) {
          await TrackPlayer.play();
        }
      }
    }
  });

  customLog('All event listeners registered');
};