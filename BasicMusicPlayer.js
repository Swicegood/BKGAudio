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

useEffect(() => {
  if (songTitle) {
    Animated.loop(
      Animated.timing(scrollAnim, {
        toValue: -(screenWidth * 2), // Change toValue to -(screenWidth * 2)
        duration: 15000, // Increase the duration to 15000ms (15 seconds)
        useNativeDriver: true,
        delay: 500,
      })
    ).start();
  }
}, [songTitle]);





  
  const togglePlayback = async () => {
    if (isPlaying) {
      await sound.pauseAsync();
      setIsPlaying(false);
    } else {
      await sound.playAsync();
      setIsPlaying(true);
    }
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
      <Animated.Text
        style={[styles.songTitle, { transform: [{ translateX: scrollAnim }] }]}
      >
        {songTitle.replace(/_/g, " ")}
      </Animated.Text>
      <View style={styles.buttonsContainer}>
        <TouchableOpacity
          style={styles.prevButton}
          onPress={debouncedLoadPreviousFile.current}
          disabled={!sound}
        >
          <Text style={styles.buttonText}>Prev</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.seekBackwardButton}
          onPress={seekBackward}
          disabled={!sound}
        >
          <Text style={styles.buttonText}>-15s</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.button}
          onPress={togglePlayback}
          disabled={!sound}
        >
          <Text style={styles.buttonText}>{isPlaying ? "Pause" : "Play"}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.seekForwardButton}
          onPress={seekForward}
          disabled={!sound}
        >
          <Text style={styles.buttonText}>+30s</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.nextButton}
          onPress={debouncedLoadNextFile.current}
          disabled={!sound}
        >
          <Text style={styles.buttonText}>Next</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};


const styles = StyleSheet.create({
    musicContainer: {
      alignItems: "center",
      justifyContent: "center",
      marginTop: 50, // Add some margin to separate the title and the button
    },
    songTitle: {
      position: "absolute",
      fontSize: 24,
      fontWeight: "bold",
      width: screenWidth * 2, // Change paddingHorizontal to width and multiply by 2
      textAlign: "center",
      zIndex: 1,
      top: -70, // Adjust the position to be above the button
      left: 0,
    },
    button: {
      backgroundColor: "#C68446",
      justifyContent: "center",
      alignItems: "center",
      padding: 10,
      borderRadius: 50,
      width: 80,
      height: 80,
      position: "relative",
    },
    buttonText: {
      fontSize: 20,
      fontWeight: "bold",
      color: "#FFFFFF",
    },
    buttonsContainer: {
        flexDirection: "row",
        justifyContent: "space-around",
        alignItems: "center",
        width: screenWidth,
    },
    prevButton: {
        backgroundColor: "#C68446",
        justifyContent: "center",
        alignItems: "center",
        padding: 5,
        borderRadius: 50,
        width: 60,
        height: 60,
        position: "relative",
    },
    nextButton: {
        backgroundColor: "#C68446",
        justifyContent: "center",
        alignItems: "center",
        padding: 5,
        borderRadius: 50,
        width: 60,
        height: 60,
        position: "relative",
    },
    seekBackwardButton: {
      backgroundColor: "#C68446",
      justifyContent: "center",
      alignItems: "center",
      padding: 5,
      borderRadius: 50,
      width: 60,
      height: 60,
      position: "relative",
    },
    seekForwardButton: {
      backgroundColor: "#C68446",
      justifyContent: "center",
      alignItems: "center",
      padding: 5,
      borderRadius: 50,
      width: 60,
      height: 60,
      position: "relative",
    },
  
  });
  
export default BasicMusicPlayer;
