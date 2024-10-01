import React, { useEffect, useRef, useState } from 'react';
import { View, SafeAreaView, StyleSheet, Text, AppState, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import TrackPlayer, { Capability, AppKilledPlaybackBehavior } from 'react-native-track-player';
import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from 'expo-av';
import SplashScreen from './SplashScreen';
import BasicMusicPlayer from './BasicMusicPlayer';
import ErrorBoundary from './ErrorBoundary';
import { customLog, customError } from './customLogger';

const setupPlayer = async () => {
  try {
    await TrackPlayer.setupPlayer({
      autoHandleInterruptions: true,
    });
    await TrackPlayer.updateOptions({
      android: {
        appKilledPlaybackBehavior: AppKilledPlaybackBehavior.ContinuePlayback
      },
      notificationCapabilities: [
        Capability.Play,
        Capability.Pause,
        Capability.SkipToNext,
        Capability.SkipToPrevious,
      ],
      capabilities: [
        Capability.Play,
        Capability.Pause,
        Capability.SkipToNext,
        Capability.SkipToPrevious,
      ],
      compactCapabilities: [
        Capability.Play,
        Capability.Pause,
      ],
      progressUpdateEventInterval: 2,
    });

    if (Platform.OS === 'android') {
      await TrackPlayer.setPlayWhenReady(true);
    }
  } catch (e) {
    console.log('Error setting up player:', e);
  }
};

const App: React.FC = () => {
  const [isVisible, setIsVisible] = useState(true);
  const [isSongLoaded, setIsSongLoaded] = useState(false);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        customLog('Initializing app');
        await setupPlayer();

        if (Platform.OS === 'ios') {
          await Audio.setAudioModeAsync({
            staysActiveInBackground: true,
            interruptionModeIOS: InterruptionModeIOS.DuckOthers,
            playsInSilentModeIOS: true,
          });
        } else {
          await Audio.setAudioModeAsync({
            staysActiveInBackground: true,
            shouldDuckAndroid: true,
            playThroughEarpieceAndroid: false,
            interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
          });
        }

        customLog('App initialization complete');
      } catch (error) {
        customError('Error during app initialization:', error);
      }
    };

    initializeApp();

    const timer = setTimeout(() => {
      setIsVisible(false);
    }, 3000);

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      clearTimeout(timer);
      subscription.remove();
    };
  }, []);

  const handleAppStateChange = async (nextAppState: string) => {
    if (appState.current.match(/active/) && nextAppState === 'background') {
      // App is moving to the background
      await TrackPlayer.updateOptions( {android: {
        appKilledPlaybackBehavior: AppKilledPlaybackBehavior.StopPlaybackAndRemoveNotification
      }});
    } else if (appState.current === 'background' && nextAppState === 'active') {
      // App is coming to the foreground
      await TrackPlayer.updateOptions( {android: {
        appKilledPlaybackBehavior: AppKilledPlaybackBehavior.ContinuePlayback
      }});
    }
    appState.current = nextAppState;
  };

  const handleSongLoaded = (loaded: boolean) => {
    setIsSongLoaded(loaded);
  };

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
                {!isSongLoaded && (
                  <Text style={styles.text}>
                    Your audio will start playing automatically!
                  </Text>
                )}
              </View>
            </View>
            <SafeAreaView style={styles.buttonContainer}>
              <BasicMusicPlayer onSongLoaded={handleSongLoaded} />
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
    textAlign: 'center',
  },
  text: {
    fontSize: 24,
    fontWeight: 'bold',
  },
});

export default App;