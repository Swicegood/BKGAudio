import { useState, useEffect, useRef } from 'react';
import { AppState, Animated } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from 'expo-av';
import { getAllFiles, getRandomFile, getPreviousFile, getNextFile } from './apiWrapper';
import { debounce } from 'lodash';
import { customLog, customError } from './customLogger';
import { registerBackgroundFetch, unregisterBackgroundFetch } from './backgroundFetch';

const useAudioPlayer = (onSongLoaded) => {
  const [isFirstLoad, setIsFirstLoad] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [sound, setSound] = useState(null);
  const [url, setUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [songTitle, setSongTitle] = useState(null);
  const scrollAnim = useRef(new Animated.Value(0)).current;
  const isLoadingNewFile = useRef(false);
  const [playState, setPlayState] = useState('idle');
  const [playNext, setPlayNext] = useState(false);
  const [isSoundLoading, setIsSoundLoading] = useState(false);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const appState = useRef(AppState.currentState);
  const [appStateVisible, setAppStateVisible] = useState(appState.current);


  // ... (all functions from BasicMusicPlayer: loadRandomFile, loadFile, seekBackward, seekForward, etc.)
  const seekBackward = async () => {
    if (sound) {
      const playbackStatus = await sound.getStatusAsync();
      const newPosition = Math.max(playbackStatus.positionMillis - 15000, 0);
      await sound.setPositionAsync(newPosition);
    }
  };

  const seekForward = async () => {
    if (sound) {
      const playbackStatus = await sound.getStatusAsync();
      const newPosition = Math.min(
        playbackStatus.positionMillis + 30000,
        playbackStatus.durationMillis
      );
      await sound.setPositionAsync(newPosition);
    }
  };


  const loadRandomFile = async () => {
    try {
      const files = await getAllFiles();
      const randomFile = await getRandomFile();
      setUrl(randomFile);
      console.log('Random file:', randomFile);
      const songTitle = randomFile.split('/').pop().replace(/\.mp3$/, '');
      setSongTitle(songTitle);
      setIsLoading(false);
    } catch (error) {
      console.error('Error in loadRandomFile:', error);
      // Do something with the error, e.g., show an error message
    }
  };


  const loadFile = async (fileUrl) => {
    if (playState === 'loading' || isSoundLoading) return;

    setPlayState('loading');
    setIsSoundLoading(true);

    if (sound) {
      await sound.unloadAsync();
    }

    const songTitle = fileUrl.split('/').pop().replace(/\.mp3$/, '');
    setSongTitle(songTitle);
    setUrl(fileUrl); // Set the url to the new fileUrl
  };

  const resetAnimation = () => {
    scrollAnim.setValue(0);
  };

  const debouncedLoadPreviousFile = useRef(debounce(async () => {
    if (isLoadingNewFile.current) return;
    isLoadingNewFile.current = true;

    const previousFile = await getPreviousFile();
    if (previousFile !== 0) {
      resetAnimation();
      await loadFile(previousFile);
    }

    isLoadingNewFile.current = false;
  }, 1000));


  const debouncedLoadNextFile = useRef(debounce(async () => {
    if (isLoadingNewFile.current) return;
    isLoadingNewFile.current = true;

    resetAnimation();
    const nextFile = await getNextFile();
    console.log("nextfile", nextFile)
    await loadFile(nextFile);

    isLoadingNewFile.current = false;
  }, 1000));


  // ... (all useEffects from BasicMusicPlayer)
  // Initial song loading
  useEffect(() => {
    const loadLastSong = async () => {
      let songUrl = null;
      let lastPosition = 0;

      try {
        const lastSongUrl = await AsyncStorage.getItem('lastSongUrl');
        const lastSongPosition = await AsyncStorage.getItem('lastSongPosition');
        console.log('lastsong, lastsongposition :  ', lastSongUrl, lastSongPosition)

        if (lastSongUrl) {
          songUrl = lastSongUrl;
          const songTitle = songUrl.split('/').pop().replace(/\.mp3$/, '');
          setSongTitle(songTitle);
        }

        if (lastSongPosition) {
          lastPosition = Number(lastSongPosition);
        }
      } catch (error) {
        console.error('Failed to load the last song and position from AsyncStorage:', error);
      }

      if (songUrl) {
        setUrl(songUrl);
      } else {
        loadRandomFile();
      }
    };

    loadLastSong();
  }, []);


  useEffect(() => {
    const subscription = Audio.addInterruptionListener((interruption) => {
      if (interruption.type === 'begin') {
        // Audio interrupted, pause playback
        if (sound) {
          sound.pauseAsync();
        }
      } else if (interruption.type === 'end') {
        // Interruption ended, resume playback if it was playing before
        if (sound && isPlaying) {
          sound.playAsync();
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, [sound, isPlaying]);


  useEffect(() => {
    const activateAudioSession = async () => {
      try {
        await Audio.setAudioModeAsync({
          staysActiveInBackground: true,
          interruptionModeIOS: InterruptionModeIOS.DuckOthers,
          playsInSilentModeIOS: true,
          shouldDuckAndroid: true,
          interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
          playThroughEarpieceAndroid: false,
        });
      } catch (error) {
        console.error('Failed to activate audio session', error);
      }
    };

    activateAudioSession();
  }, []);


  useEffect(() => {
    const handleAppStateChange = (nextAppState) => {
      if (nextAppState === 'active' && sound && isPlaying) {
        // App has come to the foreground, ensure playback is still going
        sound.playAsync();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [sound, isPlaying]);

  const setupAudioMode = async () => {
    try {
      await Audio.setAudioModeAsync({
        staysActiveInBackground: true,
        interruptionModeIOS: InterruptionModeIOS.DuckOthers,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
        playThroughEarpieceAndroid: false,
      });
    } catch (error) {
      console.log('Error setting audio mode:', error);
    }
  };

  useEffect(() => {
    setupAudioMode();

    const subscription = AppState.addEventListener('change', nextAppState => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        console.log('App has come to the foreground!');
        // Optionally refresh the player state here
      }

      appState.current = nextAppState;
      setAppStateVisible(appState.current);
      console.log('AppState', appState.current);
    });

    return () => {
      subscription.remove();
    };
  }, []);

// Modify the existing useEffect for sound playback
useEffect(() => {
    if (sound) {
      sound.setOnPlaybackStatusUpdate(async (status) => {
        if (status.didJustFinish) {
          const nextFile = await getNextFile();
          await loadFile(nextFile);
        }
      });
    }
  }, [sound]);

  // Song changing
  useEffect(() => {
    if (!url) {
      return;
    }

    const loadSound = async () => {

      setIsSoundLoading(true);

      let songUrl = url;
      let lastPosition = 0;

      // Try to get the last song and position from AsyncStorage
      try {
        if (isFirstLoad) {
          const lastSongPosition = await AsyncStorage.getItem('lastSongPosition');
          if (lastSongPosition) {
            lastPosition = Number(lastSongPosition);
          } else {
            lastPosition = 0;
          }
          setIsFirstLoad(false);
        }

        if (sound) {
          await sound.unloadAsync();
        }

        await Audio.setAudioModeAsync({
          staysActiveInBackground: true,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
          allowsRecordingIOS: false,
          interruptionModeIOS: InterruptionModeIOS.DoNotMix,
          playsInSilentModeIOS: true,
        });

        const { sound: newSound, status } = await Audio.Sound.createAsync(
          { uri: songUrl },
          { shouldPlay: true, staysActiveInBackground: true, positionMillis: lastPosition }
        );

        setSound(newSound);
        setIsPlaying(true);
        setPlayState('playing');
        setIsLoading(false);

        newSound.setOnPlaybackStatusUpdate(async (playbackStatus) => {
          if (playbackStatus.didJustFinish) {
            setPlayNext(true);
          }

          try {
            await AsyncStorage.setItem('lastSongUrl', songUrl);
            await AsyncStorage.setItem('lastSongPosition', playbackStatus.positionMillis.toString());
          } catch (error) {
            console.error('Failed to save the current song and position to AsyncStorage:', error);
          }
        });

        // Move these calls inside the try block, after all async operations
        setIsSoundLoading(false);
        onSongLoaded(true);
      } catch (error) {
        console.error('Error loading sound:', error);
        setIsSoundLoading(false);
        // Consider setting some error state here
      }
    };

    loadSound();

  }, [url, onSongLoaded]);


  useEffect(() => {
    if (playNext) {
      debouncedLoadNextFile.current();
      setPlayNext(false);
    }
  }, [playNext]);

  const togglePlayback = async () => {
    if (isPlaying) {
      await sound.pauseAsync();
      setIsPlaying(false);
    } else {
      await sound.playAsync();
      setIsPlaying(true);
    }
  };

  useEffect(() => {
    if (sound) {
      const updateProgress = async () => {
        const status = await sound.getStatusAsync();
        if (status.isLoaded) {
          setDuration(status.durationMillis);
          setPosition(status.positionMillis);
          Animated.timing(progressAnim, {
            toValue: status.positionMillis / status.durationMillis,
            duration: 1000,
            useNativeDriver: false,
          }).start();
        }
      };

      const interval = setInterval(updateProgress, 1000);
      return () => clearInterval(interval);
    }
  }, [sound]);


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
    loadPreviousFile: debouncedLoadPreviousFile.current,
    loadNextFile: debouncedLoadNextFile.current,
    scrollAnim,
    progressAnim
  };
};

export default useAudioPlayer;