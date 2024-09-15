import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Dimensions,
} from "react-native";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio, InterruptionModeIOS } from "expo-av";
import { getAllFiles, getRandomFile, getPreviousFile, getNextFile } from './apiWrapper';
import { debounce } from 'lodash';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

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
          start={{x: 0, y: 0.5}}
          end={{x: 1, y: 0.5}}
          style={[styles.titleGradient, { left: 0 }]}
        />
        <LinearGradient
          colors={['rgba(237, 201, 146, 0)', 'rgba(237, 201, 146, 1)']}
          start={{x: 0, y: 0.5}}
          end={{x: 1, y: 0.5}}
          style={[styles.titleGradient, { right: 0 }]}
        />
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