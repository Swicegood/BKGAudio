import React, { useEffect, useRef, useState } from 'react';
import { View, SafeAreaView, StyleSheet, Text, AppState, Platform, TouchableOpacity, AppStateStatus } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import TrackPlayer, { Capability, AppKilledPlaybackBehavior } from 'react-native-track-player';
import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from 'expo-av';
import * as Font from 'expo-font';
import useAudioPlayer from './useAudioPlayer';
import BasicMusicPlayer from './BasicMusicPlayer';
import DebugScreen from './DebugScreen';
import SplashScreen from './SplashScreen';
import { registerBackgroundFetch, unregisterBackgroundFetch } from './backgroundFetch';
import { customLog, customError } from './customLogger';

const loadFonts = async () => {
  try {
    await Font.loadAsync({
      'Satoshi-Bold': require('./assets/fonts/Satoshi-Bold.otf'),
      'Satoshi-Regular': require('./assets/fonts/Satoshi-Regular.otf'),
    });
  } catch (error) {
    customError('Error loading fonts:', error);
  }
};

const setupPlayer = async () => {
  try {
    await TrackPlayer.setupPlayer({});
    await TrackPlayer.updateOptions({
      android: {
        appKilledPlaybackBehavior: AppKilledPlaybackBehavior.ContinuePlayback,
      },
      capabilities: [
        Capability.Play,
        Capability.Pause,
        Capability.SkipToNext,
        Capability.SkipToPrevious,
        Capability.SeekTo,
      ],
      compactCapabilities: [Capability.Play, Capability.Pause, Capability.SkipToNext, Capability.SkipToPrevious],
      progressUpdateEventInterval: 1,
    });

    if (Platform.OS === 'android') {
      await TrackPlayer.setPlayWhenReady(true);
    }
  } catch (e) {
    customError('Error setting up player:', e);
  }
};

const App: React.FC = () => {
  const [isSongLoaded, setIsSongLoaded] = useState(false);
  const [isFontLoaded, setIsFontLoaded] = useState(false);
  const appState = useRef(AppState.currentState);
  const [showDebugScreen, setShowDebugScreen] = useState(false);

  useEffect(() => {
    loadFonts().then(() => setIsFontLoaded(true));
    setupPlayer();
    registerBackgroundFetch();

    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      appState.current = nextAppState;
    });

    // Timer to show debug screen, can be removed if not needed
    const timer = setTimeout(() => {
      // This is a simple way to trigger it, you might want a better method
      // setShowDebugScreen(true); 
    }, 5000);

    return () => {
      clearTimeout(timer);
      subscription.remove();
      unregisterBackgroundFetch();
    };
  }, []);

  const onSongLoaded = (isLoaded: boolean) => {
    setIsSongLoaded(isLoaded);
  };

  const audioPlayerData = useAudioPlayer(onSongLoaded);

  if (!isFontLoaded) {
    return <SplashScreen />;
  }

  return (
    <View style={styles.container}>
      {showDebugScreen ? (
        <DebugScreen 
          onClose={() => setShowDebugScreen(false)} 
          isTestMode={audioPlayerData.isTestMode}
          toggleTestMode={audioPlayerData.toggleTestMode}
          audioPlayerData={audioPlayerData}
        />
      ) : (
        <>
          <View style={styles.content}>
            <TouchableOpacity onPress={() => setShowDebugScreen(true)} style={styles.headerContainer}>
              <Text style={styles.header}>Bir Krishna Goswami Audio</Text>
            </TouchableOpacity>
            <View style={styles.textContainer}>
              {!isSongLoaded && (
                <Text style={styles.text}>
                  Your audio will start playing automatically!
                </Text>
              )}
            </View>
          </View>
          <SafeAreaView style={styles.buttonContainer}>
            <BasicMusicPlayer audioPlayerData={audioPlayerData} onSongLoaded={onSongLoaded} />
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
    justifyContent: 'center',
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    backgroundColor: '#C68446',
    width: '100%',
    textAlign: 'center',
    fontFamily: 'Satoshi-Bold',
    textAlignVertical: 'center',
  },
  text: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  buttonContainer: {
    marginBottom: 100,
    alignItems: 'center',
  },
});

export default App;