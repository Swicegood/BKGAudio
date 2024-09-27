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

  useTrackPlayerEvents([Event.PlaybackTrackChanged, Event.PlaybackState], async (event) => {
    if (event.type === Event.PlaybackTrackChanged && event.nextTrack !== null) {
      const track = await TrackPlayer.getTrack(event.nextTrack);
      if (track) {
        setSongTitle(track.title);
        setDuration(track.duration);
        onSongLoaded(true);
      }
    } else if (event.type === Event.PlaybackState) {
      setIsPlaying(event.state === State.Playing);
    }
  });

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
    } else {
      await TrackPlayer.play();
    }
  };

  const seekBackward = async () => {
    const position = await TrackPlayer.getPosition();
    await TrackPlayer.seekTo(Math.max(position - 15, 0));
  };

  const seekForward = async () => {
    const position = await TrackPlayer.getPosition();
    const duration = await TrackPlayer.getDuration();
    await TrackPlayer.seekTo(Math.min(position + 30, duration));
  };

  useEffect(() => {
    const loadLastSong = async () => {
      try {
        const lastSongUrl = await AsyncStorage.getItem('lastSongUrl');
        const lastSongPosition = await AsyncStorage.getItem('lastSongPosition');

        if (lastSongUrl) {
          await loadFile(lastSongUrl);
          if (lastSongPosition) {
            await TrackPlayer.seekTo(Number(lastSongPosition));
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
    const updateProgress = setInterval(async () => {
      try {
        const position = await TrackPlayer.getPosition();
        const duration = await TrackPlayer.getDuration();
        setPosition(position);
        setDuration(duration);

        await AsyncStorage.setItem('lastSongPosition', position.toString());
        const currentTrack = await TrackPlayer.getCurrentTrack();
        if (currentTrack) {
          const trackObject = await TrackPlayer.getTrack(currentTrack);
          await AsyncStorage.setItem('lastSongUrl', trackObject.url);
        }
      } catch (error) {
        customError('Error updating progress:', error);
      }
    }, 1000);

    return () => clearInterval(updateProgress);
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
    loadPreviousFile: debouncedLoadPreviousFile,
    loadNextFile: debouncedLoadNextFile,
  };
};

export default useAudioPlayer;