import React, { useEffect, useState } from 'react';
import { View, SafeAreaView, StyleSheet, Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import SplashScreen from './SplashScreen';
import BasicMusicPlayer from './BasicMusicPlayer';



const App = () => {
  const [isVisible, setIsVisible] = useState(true);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      {isVisible ? (
        <SplashScreen />
      ) : (
        <>
          <View style={styles.content}>
            <View style={styles.headerContainer}>
              <Text style={styles.header}>Bir Krishna Goswami Audio</Text>
            </View>
            <View style={styles.textContainer}>
              <Text style={styles.text}>
                Your audio will start playing automtically!
              </Text>
            </View>
          </View>
          <SafeAreaView style={styles.buttonContainer}>
                <BasicMusicPlayer />
          </SafeAreaView>
        </>
      )}
      <StatusBar style="auto" />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'stretch',
    width: '100%',
    backgroundColor: '#EDC992',
    justifyContent: 'space-between',
    paddingTop: 50,
  },
  content: {
    flex: 1,
  },
  textContainer: {
    backgroundColor: '#EDC992',
    alignItems: 'center',
  },
  headerContainer: {
    backgroundColor: '#C68446',
    width: '100%',
    height: 40,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  buttonContainer: {
    marginBottom: 100,
    alignItems: 'center',
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    backgroundColor: '#C68446',
    width: '100%',
    height: 40,
    textAlign: 'center', // Add this to horizontally center the text
  },
  text: {
    fontSize: 24,
    fontWeight: 'bold',
  },
});

export default App;
