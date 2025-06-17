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
        <DebugScreen onClose={() => setShowDebugScreen(false)} />
      ) : (
        <>
          <View style={styles.content}>
            <TouchableOpacity onPress={() => setShowDebugScreen(true)}>
              <View style={styles.headerContainer}>
                <Text style={styles.header}>Bir Krishna Goswami Audio</Text>
              </View>
            </TouchableOpacity>
          </View>
          <SafeAreaView style={styles.buttonContainer}>
            <BasicMusicPlayer onSongLoaded={onSongLoaded} />
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
    backgroundColor: '#F5F5F5',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerContainer: {
    position: 'absolute',
    top: 60,
    alignItems: 'center',
    width: '100%',
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    fontFamily: 'Satoshi-Bold',
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#F5F5F5',
  },
});

export default App;