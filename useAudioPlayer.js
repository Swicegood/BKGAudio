import { useState, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import { getAllFiles, getRandomFile, getPreviousFile, getNextFile } from './apiWrapper';
import { debounce } from 'lodash';
import { customLog, customError } from './customLogger';

const useAudioPlayer = (onSongLoaded) => {
  const [isLoading, setIsLoading] = useState(true);
  const [sound, setSound] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [url, setUrl] = useState(null);
  const [songTitle, setSongTitle] = useState(null);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const appState = useRef(AppState.currentState);

  const loadRandomFile = async () => {
    try {
      const randomFile = await getRandomFile();
      setUrl(randomFile);
      const songTitle = randomFile.split('/').pop().replace(/\.mp3$/, '');
      setSongTitle(songTitle);
      setIsLoading(false);
    } catch (error) {
      customError('Error in loadRandomFile:', error);
    }
  };

  const loadFile = async (fileUrl) => {
    setIsLoading(true);
    if (sound) {
      await sound.unloadAsync();
    }
    const songTitle = fileUrl.split('/').pop().replace(/\.mp3$/, '');
    setSongTitle(songTitle);
    setUrl(fileUrl);
  };

  const togglePlayback = async () => {
    if (sound) {
      if (isPlaying) {
        await sound.pauseAsync();
      } else {
        await sound.playAsync();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const seekBackward = async () => {
    if (sound) {
      const status = await sound.getStatusAsync();
      const newPosition = Math.max(status.positionMillis - 15000, 0);
      await sound.setPositionAsync(newPosition);
    }
  };

  const seekForward = async () => {
    if (sound) {
      const status = await sound.getStatusAsync();
      const newPosition = Math.min(status.positionMillis + 30000, status.durationMillis);
      await sound.setPositionAsync(newPosition);
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

  useEffect(() => {
    loadRandomFile();
  }, []);

  useEffect(() => {
    if (!url) return;

    const loadSound = async () => {
      try {
        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: url },
          { shouldPlay: true }
        );
        setSound(newSound);
        setIsPlaying(true);
        setIsLoading(false);
        onSongLoaded(true);

        newSound.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded) {
            setDuration(status.durationMillis);
            setPosition(status.positionMillis);
          }
          if (status.didJustFinish) {
            debouncedLoadNextFile();
          }
        });
      } catch (error) {
        customError('Error loading sound:', error);
        setIsLoading(false);
      }
    };

    loadSound();

    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [url, onSongLoaded]);

  return {
    isLoading,
    sound,
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