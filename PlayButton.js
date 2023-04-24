// PlayButton.js
import React, { useState } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { getAllFiles, getRandomFile } from './apiWrapper';


async function exampleUsage() {
  // Get the list of all mp3 files
  const files = await getAllFiles();
  console.log('All files:', files);

  // Get a random mp3 file
  const randomFile = await getRandomFile();
  console.log('Random file:', randomFile);
}

const PlayButton = () => {
  const [isLoading, setIsLoading] = useState(false);

  const handlePress = () => {
    setIsLoading(true);
    exampleUsage();
    setTimeout(() => {
      setIsLoading(false);
    }, 3000); // Simulate a 3-second loading time. Adjust this value as needed.
  };

  return (
    <View style={styles.playbuttonContainer}>
      {isLoading ? (
        <ActivityIndicator size="large" color="#0000ff" style={styles.loading} />
      ) : (
        <TouchableOpacity style={styles.button} onPress={handlePress}>
          <Text style={styles.buttonText}>Play</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  playbuttonContainer: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  button: {
    backgroundColor: '#C68446',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
    borderRadius: 50,
    width: 80,
    height: 80,
    position: 'relative',
  },
  buttonText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  loading: {
    position: 'absolute',
    alignSelf: 'center',
  },
});

export default PlayButton;
