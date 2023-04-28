import React, { useEffect, useState } from 'react';
import { View, SafeAreaView, StyleSheet, Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import SplashScreen from './SplashScreen';
import PlayButton from './PlayButton';
import BasicMusicPlayer from './BasicMusicPlayer';


const App = () => {
  const [isVisible, setIsVisible] = useState(true);
  const url = 'https://audio.iskcondesiretree.com/02_-_ISKCON_Swamis/ISKCON_Swamis_-_A_to_C/His_Holiness_Bir_Krishna_Goswami/Festivals/BKG_Festivals_-_Disappearance_Day_of_Srila_Lokanath_Goswami_-_2017-07-16_New_Goloka.mp3';


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
                Press the Play button to start downloading your audio!
              </Text>
            </View>
          </View>
          <SafeAreaView style={styles.buttonContainer}>
                <BasicMusicPlayer url={url} />
            </SafeAreaView>
          {/* <View style={styles.buttonContainer}>
            <PlayButton />
          </View> */}
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
