import { useState, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import StorageManager from './StorageManager';
import TrackPlayer, { State, Event, useTrackPlayerEvents, useProgress } from 'react-native-track-player';
import { getAllFiles, getRandomFile, getPreviousFile, getNextFile } from './apiWrapper';
import { debounce } from 'lodash';
import { customLog, customError } from './customLogger';
import { InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';

const useAudioPlayer = (onSongLoaded) => {
  const [isFirstLoad, setIsFirstLoad] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [songTitle, setSongTitle] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTestMode, setIsTestMode] = useState(false);
  const [isTrackEnded, setIsTrackEnded] = useState(false);
  const appState = useRef(AppState.currentState);
  const [appStateVisible, setAppStateVisible] = useState(appState.current);
  const isLoadingNewFile = useRef(false);
  const watchdogIntervalRef = useRef(null);
  const nextTrackUrl = useRef(null);
  const { position, duration } = useProgress();

  const ensureAudioSessionActive = async () => {
    try {
      await Audio.setAudioModeAsync({
        staysActiveInBackground: true,
        interruptionModeIOS: InterruptionModeIOS.DuckOthers,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
        playThroughEarpieceAndroid: false,
      });
      console.log('Audio session reactivated');
    } catch (error) {
      console.error('Error reactivating audio session:', error);
    }
  };

  useEffect(() => {
    const setupAudioAndWatchdog = async () => {
      await ensureAudioSessionActive();
      
      // Start the watchdog
      watchdogIntervalRef.current = startPlaybackWatchdog();
    };

    setupAudioAndWatchdog();

    // Clean up function
    return () => {
      if (watchdogIntervalRef.current) {
        clearInterval(watchdogIntervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        // App has come to the foreground
        console.log('App moved to foreground, restarting watchdog');
        if (watchdogIntervalRef.current) {
          clearInterval(watchdogIntervalRef.current);
        }
        watchdogIntervalRef.current = startPlaybackWatchdog();
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, []);

  useTrackPlayerEvents([Event.PlaybackTrackChanged, Event.PlaybackState, Event.PlaybackError], async (event) => {
    if (event.type === Event.PlaybackError) {
      customError('Playback error:', event.error);
      nextTrackUrl.current = null; // Reset next track URL on error
      await debouncedLoadNextFile();
    } else if (event.type === Event.PlaybackTrackChanged && event.nextTrack !== null) {
      const track = await TrackPlayer.getTrack(event.nextTrack);
      if (track) {
        setSongTitle(track.title);
        onSongLoaded(true);
        setIsTrackEnded(false);
        nextTrackUrl.current = null; // Reset next track URL as it's now the current track
        
        // Apply test mode to new track
        if (isTestMode) {
          customLog('New track loaded in test mode, seeking to last 15 seconds');
          try {
            await new Promise(resolve => setTimeout(resolve, 500));
            const trackDuration = await TrackPlayer.getDuration();
            if (trackDuration > 15) {
              const seekPosition = trackDuration - 15;
              customLog('Seeking to position:', seekPosition);
              await TrackPlayer.seekTo(seekPosition);
            }
          } catch (error) {
            customError('Error seeking in test mode:', error);
          }
        }
      }
    } else if (event.type === Event.PlaybackState) {
      setIsPlaying(event.state === State.Playing);
      if (event.state === State.Stopped && isTrackEnded) {
        customLog('Track ended, transitioning to next track');
        await TrackPlayer.skipToNext();
        await TrackPlayer.play();
        setIsTrackEnded(false);
      }
    }
  });

  // Progress monitoring with preloading logic
  useEffect(() => {
    const checkProgress = async () => {
      if (isPlaying) {
        try {
          const currentPosition = await TrackPlayer.getPosition();
          const currentDuration = await TrackPlayer.getDuration();
          
          // Preload next track when we're 30 seconds from the end
          if (currentDuration > 30 && currentDuration - currentPosition <= 30) {
            await preloadNextTrack();
          }
          
          // If we're within 0.5 seconds of the end, transition to next track
          if (currentDuration > 0 && currentDuration - currentPosition <= 0.5) {
            customLog('Track near end, transitioning to next track');
            setIsTrackEnded(true);
            await TrackPlayer.skipToNext();
            await TrackPlayer.play();
          }
        } catch (error) {
          customError('Error checking progress:', error);
        }
      }
    };

    const progressInterval = setInterval(checkProgress, 100);
    return () => clearInterval(progressInterval);
  }, [isPlaying]);

  const loadRandomFile = async () => {
    try {
      customLog('Starting to load random file');
      const randomFile = await getRandomFile();
      if (randomFile) {
        customLog('Random file obtained:', randomFile);
        await TrackPlayer.reset();
        await TrackPlayer.add({
          id: '1',
          url: randomFile,
          title: randomFile.split('/').pop().replace(/\.mp3$/, ''),
        });
        setSongTitle(randomFile.split('/').pop().replace(/\.mp3$/, ''));
        setIsLoading(false);
        customLog('isLoading set to false');
        onSongLoaded(true);
        customLog('onSongLoaded(true) called');
        await TrackPlayer.play();
        customLog('TrackPlayer.play() called');
      }
    } catch (error) {
      customError('Error in loadRandomFile:', error);
      setIsLoading(false);
      customLog('isLoading set to false due to error');
    }
  };

  const loadFile = async (fileUrl) => {
    if (isLoadingNewFile.current) return;
    isLoadingNewFile.current = true;
    setIsLoading(true);

    try {
      customLog('Loading file:', fileUrl);
      customLog('Test mode status:', isTestMode);
      
      await TrackPlayer.reset();
      await TrackPlayer.add({
        id: 'current',
        url: fileUrl,
        title: fileUrl.split('/').pop().replace(/\.mp3$/, ''),
      });
      setSongTitle(fileUrl.split('/').pop().replace(/\.mp3$/, ''));
      
      // Preload next track immediately after loading current track
      nextTrackUrl.current = null;
      await preloadNextTrack();
      
      if (isTestMode) {
        customLog('Test mode enabled, seeking to last 15 seconds');
        try {
          await new Promise(resolve => setTimeout(resolve, 500));
          const trackDuration = await TrackPlayer.getDuration();
          if (trackDuration > 15) {
            const seekPosition = trackDuration - 15;
            customLog('Seeking to position:', seekPosition);
            await TrackPlayer.seekTo(seekPosition);
          }
        } catch (error) {
          customError('Error seeking in test mode:', error);
        }
      }
      
      await TrackPlayer.play();
    } catch (error) {
      customError('Error in loadFile:', error);
    } finally {
      setIsLoading(false);
      isLoadingNewFile.current = false;
    }
  };

  const debouncedLoadPreviousFile = useRef(debounce(async () => {
    const previousFile = await getPreviousFile();
    if (previousFile !== 0) {
      await loadFile(previousFile);
    }
  }, 1000)).current;

  const debouncedLoadNextFile = useRef(debounce(async () => {
    const nextFile = await getNextFile();
    await loadFile(nextFile);
  }, 1000)).current;

  const togglePlayback = async () => {
    const currentState = await TrackPlayer.getState();
    if (currentState === State.Playing) {
      await TrackPlayer.pause();
    } else {
      await TrackPlayer.play();
    }
  };

  const seekBackward = async () => {
    await TrackPlayer.seekBy(-15);
  };

  const seekForward = async () => {
    await TrackPlayer.seekBy(30);
  };

  const saveCurrentState = async () => {
    try {
      const currentProgress = await TrackPlayer.getProgress();
      const currentTrack = await TrackPlayer.getActiveTrackIndex();
      if (currentTrack !== null && currentTrack !== undefined) {
        const trackObject = await TrackPlayer.getTrack(currentTrack);
        await StorageManager.setItem('lastSongUrl', trackObject.url);
        customLog('Saved current state', trackObject.url );
        if (currentProgress.position) {
          await StorageManager.setItem('lastSongPosition', currentProgress.position.toString());
          customLog('Saved current position', currentProgress.position );
        }
      }
    } catch (error) {
      customError('Error saving current state:', error);
    }
  };

  const startPlaybackWatchdog = () => {
  setInterval(async () => {
    const playerState = await TrackPlayer.getState();
    if (playerState === State.Ready) {
      customLog('Player ready but not playing, attempting to resume');
      await ensureAudioSessionActive();
      await TrackPlayer.play();
    }
  }, 5000); // Check every 5 seconds
};

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (appState.current.match(/active/) && nextAppState === 'background') {
        // App is moving to the background, save state
        saveCurrentState();
      }
      appState.current = nextAppState;
      setAppStateVisible(appState.current);
    });

    return () => {
      subscription.remove();
      saveCurrentState(); // Save state when component unmounts
    };
  }, []);

  useEffect(() => {
    const loadLastSong = async () => {
      try {
        customLog('Starting to load last song');
        const lastSongUrl = await StorageManager.getItem('lastSongUrl');
        customLog('Starting to load last song position');
        const lastSongPosition = await StorageManager.getItem('lastSongPosition');
        customLog('Last song position found: ', lastSongPosition);
  
        if (lastSongUrl) {
          customLog('Last song URL found:', lastSongUrl);
          await loadFile(lastSongUrl);
          if (lastSongPosition) {
            const savedPosition = Number(lastSongPosition);
            await TrackPlayer.seekBy(savedPosition);
            customLog('Seeked to saved position:', savedPosition);
          }
        } else {
          customLog('No last song URL found, loading random file');
          await loadRandomFile();
        }
        setIsFirstLoad(false);
        customLog('Initial load completed');
      } catch (error) {
        customError('Failed to load the last song and position:', error);
        await loadRandomFile();
      }
    };
  
    loadLastSong();
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        TrackPlayer.play();
      }

      appState.current = nextAppState;
      setAppStateVisible(appState.current);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    
    const saveProgress = async () => {
      try {
        const currentProgress = await TrackPlayer.getProgress();
        const currentTrack = await TrackPlayer.getActiveTrackIndex();
        if (currentTrack !== null && currentTrack !== undefined) {
          const trackObject = await TrackPlayer.getTrack(currentTrack);
          await StorageManager.setItem('lastSongUrl', trackObject.url);
          if (currentProgress.position) {
            await StorageManager.setItem('lastSongPosition', currentProgress.position.toString());
            customLog('Saved current position', currentProgress.position);
          }
        }
      } catch (error) {
        customError('Error saving progress:', error);
      }
    };
  
    const intervalId = setInterval(saveProgress, 5000);
  
    // Initial save
    saveProgress();
  
    return () => {
      clearInterval(intervalId);
    };
  }, []); 

  // Add a useEffect to handle test mode changes
  useEffect(() => {
    const handleTestModeChange = async () => {
      if (isTestMode) {
        customLog('Test mode enabled, seeking current track to last 15 seconds');
        try {
          const trackDuration = await TrackPlayer.getDuration();
          if (trackDuration > 15) {
            const seekPosition = trackDuration - 15;
            customLog('Seeking to position:', seekPosition);
            await TrackPlayer.seekTo(seekPosition);
          }
        } catch (error) {
          customError('Error seeking in test mode:', error);
        }
      }
    };

    handleTestModeChange();
  }, [isTestMode]);

  // Function to preload the next track
  const preloadNextTrack = async () => {
    try {
      if (!nextTrackUrl.current) {
        const nextFile = await getNextFile();
        customLog('Preloading next track:', nextFile);
        nextTrackUrl.current = nextFile;
        
        // Add to queue but don't start playing
        await TrackPlayer.add({
          id: 'next',
          url: nextFile,
          title: nextFile.split('/').pop().replace(/\.mp3$/, ''),
        });
        customLog('Next track preloaded successfully');
      }
    } catch (error) {
      customError('Error preloading next track:', error);
    }
  };

  return {
    isLoading,
    isPlaying,
    songTitle,
    duration,
    position,
    isTestMode,
    toggleTestMode: () => setIsTestMode(!isTestMode),
    togglePlayback,
    seekBackward,
    seekForward,
    loadPreviousFile: debouncedLoadPreviousFile,
    loadNextFile: debouncedLoadNextFile,
    saveCurrentState
  };
};

export default useAudioPlayer;