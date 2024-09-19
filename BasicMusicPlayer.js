import React, { useState, useEffect, useRef } from "react";
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Dimensions,
  Text,
  AppState,
} from "react-native";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from "expo-av";
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { getAllFiles, getRandomFile, getPreviousFile, getNextFile } from './apiWrapper';
import { debounce } from 'lodash';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { customLog, customError } from './customLogger';

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

const BACKGROUND_FETCH_TASK = 'background-fetch';

TaskManager.defineTask(BACKGROUND_FETCH_TASK, async () => {
  try {
    customLog('Background fetch started');
    // Your background fetch logic here
    customLog('Background fetch completed');
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    customError('Background fetch failed', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});


const BasicMusicPlayer = ({ onSongLoaded }) => {
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

  const [titleWidth, setTitleWidth] = useState(0);

  const styles = StyleSheet.create({
    musicContainer: {
      alignItems: "center",
      justifyContent: "flex-end",
      height: screenHeight * 0.4,
      width: screenWidth,
    },
    songTitleContainer: {
      height: screenHeight * 0.1,
      justifyContent: "center",
      alignItems: "center",
      width: screenWidth,
      overflow: "hidden",
    },
    songTitle: {
      fontSize: 20,
      fontWeight: "bold",
      textAlign: "center",
    },
    titleGradient: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      width: 20,
    },
    buttonsContainer: {
      flexDirection: "row",
      justifyContent: "space-around",
      alignItems: "center",
      width: screenWidth,
      height: screenHeight * 0.15,
    },
    button: {
      backgroundColor: "#C68446",
      justifyContent: "center",
      alignItems: "center",
      padding: 10,
      borderRadius: 50,
      width: 70,
      height: 70,
    },
    smallButton: {
      backgroundColor: "#C68446",
      justifyContent: "center",
      alignItems: "center",
      padding: 5,
      borderRadius: 50,
      width: 50,
      height: 50,
    },
    progressContainer: {
      width: screenWidth * 0.9,
      height: 20,
      backgroundColor: '#e0e0e0',
      borderRadius: 10,
      overflow: 'hidden',
      marginBottom: 10,
    },
    progressBar: {
      height: '100%',
      backgroundColor: '#C68446',
    },
    timeText: {
      fontSize: 12,
      color: '#333',
      marginTop: 5,
    },
  });

  useEffect(() => {
    if (titleWidth > screenWidth) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(scrollAnim, {
            toValue: -(titleWidth - screenWidth),
            duration: 15000,
            useNativeDriver: true,
          }),
          Animated.timing(scrollAnim, {
            toValue: 0,
            duration: 15000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      scrollAnim.setValue(0);
    }
  }, [titleWidth, songTitle]);



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

  useEffect(() => {
    registerBackgroundFetch();

    return () => {
      unregisterBackgroundFetchAsync();
    };
  }, []);

  async function registerBackgroundFetch() {
    try {
      await BackgroundFetch.registerTaskAsync(BACKGROUND_FETCH_TASK, {
        minimumInterval: 60 * 15, // 15 minutes
        stopOnTerminate: false,
        startOnBoot: true,
      });
      customLog('Background fetch registered');
    } catch (err) {
      customError('Background fetch registration failed', err);
    }
  }

  const unregisterBackgroundFetchAsync = async () => {
    try {
      await BackgroundFetch.unregisterTaskAsync(BACKGROUND_FETCH_TASK);
    } catch (err) {
      console.log("Task Unregister failed:", err);
    }
  };

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

  const onTitleLayout = (event) => {
    setTitleWidth(event.nativeEvent.layout.width);
  };

  const formatTime = (milliseconds) => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
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

  if (isLoading) {
    return (
      <View style={styles.musicContainer}>
        <ActivityIndicator size="large" color="#C68446" />
      </View>
    );
  }

  return (
    <View style={styles.musicContainer}>
      <View style={styles.songTitleContainer}>
        <Animated.View style={{ transform: [{ translateX: scrollAnim }] }}>
          <Text style={styles.songTitle} onLayout={onTitleLayout}>
            {songTitle.replace(/_/g, " ")}
          </Text>
        </Animated.View>
        <LinearGradient
          colors={['rgba(237, 201, 146, 1)', 'rgba(237, 201, 146, 0)']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={[styles.titleGradient, { left: 0 }]}
        />
        <LinearGradient
          colors={['rgba(237, 201, 146, 0)', 'rgba(237, 201, 146, 1)']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={[styles.titleGradient, { right: 0 }]}
        />
      </View>
      <View style={styles.progressContainer}>
        <Animated.View
          style={[
            styles.progressBar,
            {
              width: progressAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: screenWidth * 0.9 }}>
        <Text style={styles.timeText}>{formatTime(position)}</Text>
        <Text style={styles.timeText}>{formatTime(duration)}</Text>
      </View>
      <View style={styles.buttonsContainer}>
        <TouchableOpacity
          style={styles.smallButton}
          onPress={debouncedLoadPreviousFile.current}
          disabled={!sound}
        >
          <Icon name="skip-previous" size={30} color="#FFFFFF" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.smallButton}
          onPress={seekBackward}
          disabled={!sound}
        >
          <Icon name="replay-10" size={30} color="#FFFFFF" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.button}
          onPress={togglePlayback}
          disabled={!sound}
        >
          <Icon name={isPlaying ? "pause" : "play-arrow"} size={40} color="#FFFFFF" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.smallButton}
          onPress={seekForward}
          disabled={!sound}
        >
          <Icon name="forward-30" size={30} color="#FFFFFF" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.smallButton}
          onPress={debouncedLoadNextFile.current}
          disabled={!sound}
        >
          <Icon name="skip-next" size={30} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default BasicMusicPlayer;