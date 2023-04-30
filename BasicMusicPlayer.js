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
import { Audio } from "expo-av";
import { getAllFiles, getRandomFile, getPreviousFile, getNextFile } from './apiWrapper';

const { width: screenWidth } = Dimensions.get("window");

const BasicMusicPlayer = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [sound, setSound] = useState(null);
  const [url, setUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(true);  
  const [songTitle, setSongTitle] = useState(null);
  const scrollAnim = useRef(new Animated.Value(0)).current;

  const loadRandomFile = async () => {
    const files = await getAllFiles();
    console.log('All files:', files);
    const randomFile = await getRandomFile();
    setUrl(randomFile);
    console.log('Random file:', randomFile);

    // Extract the song title from the URL
    const songTitle = randomFile.split('/').pop().replace(/\.mp3$/, '');
    setSongTitle(songTitle);
    setIsLoading(false);
  };

  const loadFile = async (fileUrl) => {
    if (sound) {
      await sound.unloadAsync();
    }
    setUrl(fileUrl);
    const songTitle = fileUrl.split('/').pop().replace(/\.mp3$/, '');
    setSongTitle(songTitle);
  };

  const resetAnimation = () => {
    scrollAnim.setValue(0);
  };

  const loadPreviousFile = async () => {
    resetAnimation();
    const previousFile = await getPreviousFile();
    loadFile(previousFile);
  };

  const loadNextFile = async () => {
    resetAnimation();
    const nextFile = await getNextFile();
    loadFile(nextFile);
  };

useEffect(() => {
  loadRandomFile();
}, []);

  useEffect(() => {
    // ... Other useEffect hooks ...

    const loadSound = async () => {
      if (url) {
        if (sound) {
          await sound.unloadAsync();
        }
        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: url },
          { shouldPlay: true } // Add this line to start playing automatically
        );
        setSound(newSound);
        setIsPlaying(true); // Add this line to update the isPlaying state
      }
    };

    loadSound();

    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [url]);


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
        {songTitle}
      </Animated.Text>
      <View style={styles.buttonsContainer}>
        <TouchableOpacity
          style={styles.prevButton}
          onPress={loadPreviousFile}
          disabled={!sound}
        >
          <Text style={styles.buttonText}>Prev</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.button}
          onPress={togglePlayback}
          disabled={!sound}
        >
          <Text style={styles.buttonText}>{isPlaying ? "Pause" : "Play"}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.nextButton}
          onPress={loadNextFile}
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
  });
  
export default BasicMusicPlayer;
