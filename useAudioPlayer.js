import { useState, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import TrackPlayer, { State, Event, useTrackPlayerEvents } from 'react-native-track-player';
import { getAllFiles, getRandomFile, getPreviousFile, getNextFile } from './apiWrapper';
import { debounce } from 'lodash';
import { customLog, customError } from './customLogger';

const useAudioPlayer = (onSongLoaded) => {
  const [isFirstLoad, setIsFirstLoad] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [songTitle, setSongTitle] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const appState = useRef(AppState.currentState);
  const [appStateVisible, setAppStateVisible] = useState(appState.current);
  const isLoadingNewFile = useRef(false);
  const intervalRef = useRef(null);
  const lastPlayTime = useRef(0);

  useTrackPlayerEvents([Event.PlaybackTrackChanged, Event.PlaybackState], async (event) => {
    if (event.type === Event.PlaybackTrackChanged && event.nextTrack !== null) {
      const track = await TrackPlayer.getTrack(event.nextTrack);
      if (track) {
        setSongTitle(track.title);
        setDuration(track.duration * 1000); // Convert to milliseconds
        setPosition(0);
        lastPlayTime.current = Date.now();
        onSongLoaded(true);
      }
    } else if (event.type === Event.PlaybackState) {
      setIsPlaying(event.state === State.Playing);
      if (event.state === State.Playing) {
        lastPlayTime.current = Date.now() - position;
        startTimer();
      } else {
        stopTimer();
      }
    }
  });

  const startTimer = () => {
    stopTimer();
    intervalRef.current = setInterval(() => {
      setPosition((prevPosition) => {
        const newPosition = Date.now() - lastPlayTime.current;
        return newPosition > duration ? duration : newPosition;
      });
    }, 1000);
  };

  const stopTimer = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
  };

  const loadRandomFile = async () => {
    try {
      const randomFile = await getRandomFile();
      if (randomFile) {
        await TrackPlayer.reset();
        await TrackPlayer.add({
          id: '1',
          url: randomFile,
          title: randomFile.split('/').pop().replace(/\.mp3$/, ''),
        });
        setSongTitle(randomFile.split('/').pop().replace(/\.mp3$/, ''));
        setIsLoading(false);
        await TrackPlayer.play();
      }
    } catch (error) {
      customError('Error in loadRandomFile:', error);
    }
  };

  const loadFile = async (fileUrl) => {
    if (isLoadingNewFile.current) return;
    isLoadingNewFile.current = true;
    setIsLoading(true);

    try {
      await TrackPlayer.reset();
      await TrackPlayer.add({
        id: '1',
        url: fileUrl,
        title: fileUrl.split('/').pop().replace(/\.mp3$/, ''),
      });
      setSongTitle(fileUrl.split('/').pop().replace(/\.mp3$/, ''));
      setPosition(0);
      lastPlayTime.current = Date.now();
      await TrackPlayer.play();
    } catch (error) {
      customError('Error in loadFile:', error);
    } finally {
      setIsLoading(false);
      isLoadingNewFile.current = false;
    }
  };

  const debouncedLoadPreviousFile = useRef(debounce(async () => {
    const previousFile = await getPreviousFile();
    if (previousFile !== 0) {
      await loadFile(previousFile);
    }
  }, 1000)).current;

  const debouncedLoadNextFile = useRef(debounce(async () => {
    const nextFile = await getNextFile();
    await loadFile(nextFile);
  }, 1000)).current;

  const togglePlayback = async () => {
    const currentState = await TrackPlayer.getState();
    if (currentState === State.Playing) {
      await TrackPlayer.pause();
      stopTimer();
    } else {
      lastPlayTime.current = Date.now() - position;
      await TrackPlayer.play();
      startTimer();
    }
  };

  const seekBackward = async () => {
    const newPosition = Math.max(position - 15000, 0);
    setPosition(newPosition);
    lastPlayTime.current = Date.now() - newPosition;
    await TrackPlayer.seekTo(newPosition / 1000);
  };

  const seekForward = async () => {
    const newPosition = Math.min(position + 30000, duration);
    setPosition(newPosition);
    lastPlayTime.current = Date.now() - newPosition;
    await TrackPlayer.seekTo(newPosition / 1000);
  };

  const saveCurrentState = async () => {
    try {
      await AsyncStorage.setItem('lastSongPosition', position.toString());
      const currentTrack = await TrackPlayer.getCurrentTrack();
      if (currentTrack) {
        const trackObject = await TrackPlayer.getTrack(currentTrack);
        await AsyncStorage.setItem('lastSongUrl', trackObject.url);
      }
      customLog('Saved current state');
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
        const lastSongUrl = await AsyncStorage.getItem('lastSongUrl');
        const lastSongPosition = await AsyncStorage.getItem('lastSongPosition');

        if (lastSongUrl) {
          await loadFile(lastSongUrl);
          if (lastSongPosition) {
            const savedPosition = Number(lastSongPosition);
            setPosition(savedPosition);
            lastPlayTime.current = Date.now() - savedPosition;
            await TrackPlayer.seekTo(savedPosition / 1000);
          }
        } else {
          await loadRandomFile();
        }
        setIsFirstLoad(false);
      } catch (error) {
        customError('Failed to load the last song and position:', error);
        await loadRandomFile();
      }
    };

    loadLastSong();

    return () => {
      stopTimer();
    };
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        TrackPlayer.play();
      }

      appState.current = nextAppState;
      setAppStateVisible(appState.current);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    const saveProgress = async () => {
      try {
        await AsyncStorage.setItem('lastSongPosition', position.toString());
        const currentTrack = await TrackPlayer.getCurrentTrack();
        if (currentTrack) {
          const trackObject = await TrackPlayer.getTrack(currentTrack);
          await AsyncStorage.setItem('lastSongUrl', trackObject.url);
        }
      } catch (error) {
        customError('Error saving progress:', error);
      }
    };

    // Save progress every 5 seconds
    const saveInterval = setInterval(saveProgress, 5000);

    return () => clearInterval(saveInterval);
  }, [position]);

  return {
    isLoading,
    isPlaying,
    songTitle,
    duration,
    position,
    togglePlayback,
    seekBackward,
    seekForward,
    loadPreviousFile: debouncedLoadPreviousFile,
    loadNextFile: debouncedLoadNextFile,
    saveCurrentState
  };
};

export default useAudioPlayer;