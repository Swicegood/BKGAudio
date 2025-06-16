import { useState, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import StorageManager from './StorageManager';
import TrackPlayer, { State, Event, useTrackPlayerEvents, useProgress } from 'react-native-track-player';
import { getAllFiles, getRandomFile, getPreviousFile, getNextFile } from './apiWrapper';
import { customLog, customError } from './customLogger';

const useAudioPlayer = (onSongLoaded) => {
  const [isFirstLoad, setIsFirstLoad] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [songTitle, setSongTitle] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const appState = useRef(AppState.currentState);
  const [appStateVisible, setAppStateVisible] = useState(appState.current);
  const isLoadingNewFile = useRef(false);

  const { position, duration } = useProgress();

  // Simplified event handling - let service.js handle queue management
  useTrackPlayerEvents([Event.PlaybackState, Event.PlaybackError], async (event) => {
    if (event.type === Event.PlaybackError) {
      customError('Playback error:', event.error);
    } else if (event.type === Event.PlaybackState) {
      setIsPlaying(event.state === State.Playing);
    }
  });

  const loadRandomFile = async () => {
    try {
      customLog('Starting to load random file');
      const randomFile = await getRandomFile();
      if (randomFile) {
        customLog('Random file obtained:', randomFile);
        await TrackPlayer.reset();
        await TrackPlayer.add({
          id: Date.now().toString(), // Use timestamp for unique IDs
          url: randomFile,
          title: randomFile.split('/').pop().replace(/\.mp3$/, ''),
        });
        setSongTitle(randomFile.split('/').pop().replace(/\.mp3$/, ''));
        setIsLoading(false);
        customLog('isLoading set to false');
        onSongLoaded(true);
        customLog('onSongLoaded(true) called');
        await TrackPlayer.play();
        customLog('TrackPlayer.play() called');
      }
    } catch (error) {
      customError('Error in loadRandomFile:', error);
      setIsLoading(false);
      customLog('isLoading set to false due to error');
    }
  };

  const loadFile = async (fileUrl) => {
    if (isLoadingNewFile.current) return;
    isLoadingNewFile.current = true;
    setIsLoading(true);

    try {
      await TrackPlayer.reset();
      await TrackPlayer.add({
        id: Date.now().toString(),
        url: fileUrl,
        title: fileUrl.split('/').pop().replace(/\.mp3$/, ''),
      });
      setSongTitle(fileUrl.split('/').pop().replace(/\.mp3$/, ''));
      await TrackPlayer.play();
    } catch (error) {
      customError('Error in loadFile:', error);
    } finally {
      setIsLoading(false);
      isLoadingNewFile.current = false;
    }
  };

  // Remove debouncing for immediate response
  const loadPreviousFile = async () => {
    try {
      const previousFile = await getPreviousFile();
      if (previousFile && previousFile !== 0) {
        await loadFile(previousFile);
      }
    } catch (error) {
      customError('Error in loadPreviousFile:', error);
    }
  };

  const loadNextFile = async () => {
    try {
      const nextFile = await getNextFile();
      if (nextFile) {
        await loadFile(nextFile);
      }
    } catch (error) {
      customError('Error in loadNextFile:', error);
    }
  };

  const togglePlayback = async () => {
    const currentState = await TrackPlayer.getState();
    if (currentState === State.Playing) {
      await TrackPlayer.pause();
    } else {
      await TrackPlayer.play();
    }
  };

  const seekBackward = async () => {
    await TrackPlayer.seekBy(-15);
  };

  const seekForward = async () => {
    await TrackPlayer.seekBy(30);
  };

  const saveCurrentState = async () => {
    try {
      const currentProgress = await TrackPlayer.getProgress();
      await StorageManager.setItem('lastSongPosition', currentProgress.position.toString());
      const currentTrack = await TrackPlayer.getActiveTrackIndex();
      if (currentTrack !== null && currentTrack !== undefined) {
        const trackObject = await TrackPlayer.getTrack(currentTrack);
        if (trackObject) {
          await StorageManager.setItem('lastSongUrl', trackObject.url);
          customLog('Saved current state', trackObject.url );
          customLog('Saved current position', currentProgress.position );
        }
      }
    } catch (error) {
      customError('Error saving current state:', error);
    }
  };

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (appState.current.match(/active/) && nextAppState === 'background') {
        // App is moving to the background, save state
        saveCurrentState();
      }
      appState.current = nextAppState;
      setAppStateVisible(appState.current);
    });

    return () => {
      subscription.remove();
      saveCurrentState(); // Save state when component unmounts
    };
  }, []);

  useEffect(() => {
    const loadLastSong = async () => {
      try {
        customLog('Starting to load last song');
        const lastSongUrl = await StorageManager.getItem('lastSongUrl');
        const lastSongPosition = await StorageManager.getItem('lastSongPosition');
  
        if (lastSongUrl) {
          customLog('Last song URL found:', lastSongUrl);
          await loadFile(lastSongUrl);
          if (lastSongPosition) {
            const savedPosition = Number(lastSongPosition);
            await TrackPlayer.seekTo(savedPosition);
            customLog('Seeked to saved position:', savedPosition);
          }
        } else {
          customLog('No last song URL found, loading random file');
          await loadRandomFile();
        }
        setIsFirstLoad(false);
        customLog('Initial load completed');
      } catch (error) {
        customError('Failed to load the last song and position:', error);
        await loadRandomFile();
      }
    };
  
    loadLastSong();
  }, []);

  // Remove duplicate app state listener
  useEffect(() => {
    const saveProgress = async () => {
      try {
        const currentProgress = await TrackPlayer.getProgress();
        await StorageManager.setItem('lastSongPosition', currentProgress.position.toString());
        const currentTrack = await TrackPlayer.getActiveTrackIndex();
        if (currentTrack !== null && currentTrack !== undefined) {
          const trackObject = await TrackPlayer.getTrack(currentTrack);
          if (trackObject) {
            await StorageManager.setItem('lastSongUrl', trackObject.url);
          }
        }
      } catch (error) {
        customError('Error saving progress:', error);
      }
    };
  
    const intervalId = setInterval(saveProgress, 5000);
  
    // Initial save
    saveProgress();
  
    return () => {
      clearInterval(intervalId);
    };
  }, []); 

  return {
    isLoading,
    isPlaying,
    songTitle,
    duration,
    position,
    togglePlayback,
    seekBackward,
    seekForward,
    loadPreviousFile,
    loadNextFile,
    saveCurrentState
  };
};

export default useAudioPlayer;