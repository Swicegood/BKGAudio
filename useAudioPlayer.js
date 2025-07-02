import { useState, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import StorageManager from './StorageManager';
import TrackPlayer, { State, Event, useTrackPlayerEvents, useProgress } from 'react-native-track-player';
import { getAllFiles, getRandomFile, getPreviousFile, getNextFile, getPlayedHistory, getCurrentHistoryIndex, migrateToNewSystem } from './apiWrapper';
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
  // New history system state
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [historyLength, setHistoryLength] = useState(0);
  const [migrationComplete, setMigrationComplete] = useState(false);
  const hasAutoPlayedOnce = useRef(false);
  const appState = useRef(AppState.currentState);
  const [appStateVisible, setAppStateVisible] = useState(appState.current);
  const isLoadingNewFile = useRef(false);
  const watchdogIntervalRef = useRef(null);

  const nextTrackUrl = useRef(null);
  const isPreloading = useRef(false);
  const lastPreloadCheck = useRef(0);
  const lastTestModeSeek = useRef({});
  const isTransitioning = useRef(false);
  const { position, duration } = useProgress();

  // Function to update history state for UI debugging
  const updateHistoryState = async () => {
    try {
      const currentIndex = await getCurrentHistoryIndex();
      const history = await getPlayedHistory();
      setHistoryIndex(currentIndex);
      setHistoryLength(history.length);
      
      customLog('History state updated - Index:', currentIndex, 'Length:', history.length);
      
      // Debug info for development
      if (history.length > 0 && currentIndex >= 0) {
        const currentTrack = history[currentIndex];
        const isAtLeadingEdge = currentIndex === history.length - 1;
        customLog('Current track in history:', currentTrack?.split('/').pop());
        customLog('At leading edge:', isAtLeadingEdge);
        customLog('Can go previous:', currentIndex > 0);
        customLog('Can go next (in history):', currentIndex < history.length - 1);
        
        // Check for duplicate entries in recent history
        if (currentIndex > 0) {
          const previousTrack = history[currentIndex - 1];
          if (previousTrack === currentTrack) {
            customLog('⚠️ WARNING: Current track is same as previous track - possible duplicate in history');
          }
        }
        
        // Log currently playing track from TrackPlayer for comparison
        try {
          const activeTrackIndex = await TrackPlayer.getActiveTrackIndex();
          if (activeTrackIndex !== null && activeTrackIndex !== undefined) {
            const activeTrack = await TrackPlayer.getTrack(activeTrackIndex);
            customLog('TrackPlayer active track:', activeTrack?.url?.split('/').pop());
            
            // Check if history and TrackPlayer are in sync
            if (activeTrack?.url !== currentTrack) {
              customLog('⚠️ WARNING: History and TrackPlayer are out of sync');
              customLog('  History says:', currentTrack?.split('/').pop());
              customLog('  TrackPlayer says:', activeTrack?.url?.split('/').pop());
            }
          }
        } catch (trackError) {
          customError('Error checking active track:', trackError);
        }
      }
    } catch (error) {
      customError('Error updating history state:', error);
    }
  };

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
        
        // Update history state to sync with any changes made by the service
        await updateHistoryState();
        customLog('History state synced after track change from service');
      }
    } else if (event.type === Event.PlaybackState) {
      setIsPlaying(event.state === State.Playing);
      
      // Apply test mode when track is ready
      if (event.state === State.Ready && isTestMode) {
        customLog('Track ready in test mode, seeking to last 31 seconds');
        try {
          // Wait a short moment for duration to be available
          await new Promise(resolve => setTimeout(resolve, 500));
          const trackDuration = await TrackPlayer.getDuration();
          if (trackDuration > 31) {
            // Get current track info to prevent duplicate seeks
            const currentTrack = await TrackPlayer.getActiveTrackIndex();
            const trackObject = await TrackPlayer.getTrack(currentTrack);
            const trackUrl = trackObject?.url;
            
            // Only seek if we haven't already seeked this track recently
            const now = Date.now();
            if (!trackUrl || !lastTestModeSeek.current[trackUrl] || now - lastTestModeSeek.current[trackUrl] > 2000) {
              const seekPosition = trackDuration - 31;
              customLog('Seeking to position:', seekPosition, 'for track:', trackUrl);
              await TrackPlayer.seekTo(seekPosition);
              
              if (trackUrl) {
                lastTestModeSeek.current[trackUrl] = now;
              }
            } else {
              customLog('Skipping seek - already seeked this track recently');
            }
          }
        } catch (error) {
          customError('Error seeking in test mode:', error);
        }
      }
      
      if (event.state === State.Stopped && isTrackEnded) {
        customLog('Track ended, transitioning to next track');
        await TrackPlayer.skipToNext();
        await TrackPlayer.play();
        setIsTrackEnded(false);
      }
    }
  });

  // Progress monitoring with preloading logic - simplified approach
  useEffect(() => {
    let interval = null;
    const intervalId = Math.random();
    
    if (isPlaying) {
      customLog('Starting progress monitoring interval with ID:', intervalId);
      
      interval = setInterval(async () => {
        try {
          const currentPosition = await TrackPlayer.getPosition();
          const currentDuration = await TrackPlayer.getDuration();
          
          // Preload next track when we're 30 seconds from the end (with debouncing)
          const timeToEnd = currentDuration - currentPosition;
          if (currentDuration > 30 && timeToEnd <= 30) {
            const now = Date.now();
            // Only check for preload once every 500ms to prevent rapid-fire calls while staying fast
            if (now - lastPreloadCheck.current > 500) {
              lastPreloadCheck.current = now;
              customLog('Progress monitor triggering preload (interval ID:', intervalId + ')');
              await preloadNextTrack();
            }
          }
          
          // If we're within 1 second of the end, transition to next track (increased from 0.5 for faster transition)
          if (currentDuration > 0 && timeToEnd <= 1.0) {
            // Prevent duplicate transitions
            if (isTransitioning.current) {
              customLog('Track transition already in progress, skipping (interval ID:', intervalId + ')');
              return;
            }
            
            isTransitioning.current = true;
            customLog('Track near end, transitioning to next track (interval ID:', intervalId + ')');
            setIsTrackEnded(true);
            
            // Ensure immediate transition with no gaps
            try {
              await TrackPlayer.skipToNext();
              await TrackPlayer.play();
              customLog('Track transition completed');
            } catch (error) {
              customError('Error in track transition:', error);
            } finally {
              // Reset transition flag after a short delay to allow the transition to complete
              setTimeout(() => {
                isTransitioning.current = false;
              }, 1000);
            }
          }
        } catch (error) {
          customError('Error checking progress:', error);
        }
      }, 100);
         } else {
       customLog('Not playing, no progress monitoring needed for interval ID:', intervalId);
     }
     
     return () => {
       customLog('Cleaning up progress monitoring interval with ID:', intervalId);
       if (interval) {
         clearInterval(interval);
       }
     };
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
        
        // Update history state after loading random file
        await updateHistoryState();
        
        // Only auto-play on the very first load
        if (!hasAutoPlayedOnce.current) {
          await TrackPlayer.play();
          hasAutoPlayedOnce.current = true;
          customLog('TrackPlayer.play() called - first time auto-play');
        } else {
          customLog('Skipping auto-play - not first load');
        }
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
      
      if (isTestMode) {
        customLog('Test mode enabled, seeking to last 31 seconds');
        try {
          await new Promise(resolve => setTimeout(resolve, 500));
          const trackDuration = await TrackPlayer.getDuration();
          if (trackDuration > 31) {
            const seekPosition = trackDuration - 31;
            customLog('Seeking to position:', seekPosition);
            await TrackPlayer.seekTo(seekPosition);
          }
        } catch (error) {
          customError('Error seeking in test mode:', error);
        }
      }
      
      // Only auto-play on the very first load
      if (!hasAutoPlayedOnce.current) {
        await TrackPlayer.play();
        hasAutoPlayedOnce.current = true;
        customLog('TrackPlayer.play() called - first time auto-play');
      } else {
        customLog('Skipping auto-play - not first load');
      }
    } catch (error) {
      customError('Error in loadFile:', error);
    } finally {
      setIsLoading(false);
      isLoadingNewFile.current = false;
    }
  };

  const debouncedLoadPreviousFile = useRef(debounce(async () => {
    customLog('Loading previous file...');
    
    // Set manual navigation flag to prevent service interference
    if (global.setManualNavigation) {
      global.setManualNavigation(true);
    }
    
    try {
      // Debug: Check current state before calling getPreviousFile
      const currentIndex = await getCurrentHistoryIndex();
      const history = await getPlayedHistory();
      customLog('DEBUG: Before getPreviousFile - Current index:', currentIndex, 'History length:', history.length);
      
      const previousFile = await getPreviousFile();
      customLog('DEBUG: getPreviousFile returned:', previousFile);
      
      if (previousFile !== null && previousFile !== 0) {
        customLog('Loading previous file:', previousFile);
        await loadFile(previousFile);
        await updateHistoryState();
        
        // Auto-play the previous track after loading
        customLog('Auto-playing previous track from in-app navigation');
        await TrackPlayer.play();
      } else {
        customLog('No previous file available - previousFile was:', previousFile);
        // Debug: Check state after failed getPreviousFile
        const newIndex = await getCurrentHistoryIndex();
        const newHistory = await getPlayedHistory();
        customLog('DEBUG: After failed getPreviousFile - Current index:', newIndex, 'History length:', newHistory.length);
      }
    } finally {
      // Clear manual navigation flag after a delay
      setTimeout(() => {
        if (global.setManualNavigation) {
          global.setManualNavigation(false);
        }
      }, 2000);
    }
  }, 1000)).current;

  const debouncedLoadNextFile = useRef(debounce(async () => {
    customLog('Loading next file...');
    
    // Set manual navigation flag to prevent service interference
    if (global.setManualNavigation) {
      global.setManualNavigation(true);
    }
    
    try {
      const nextFile = await getNextFile();
      await loadFile(nextFile);
      await updateHistoryState();
      
      // Auto-play the next track after loading
      customLog('Auto-playing next track from in-app navigation');
      await TrackPlayer.play();
    } finally {
      // Clear manual navigation flag after a delay
      setTimeout(() => {
        if (global.setManualNavigation) {
          global.setManualNavigation(false);
        }
      }, 2000);
    }
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

  const seekTo = async (positionInSeconds) => {
    try {
      customLog('useAudioPlayer: seekTo called with position:', positionInSeconds);
      const currentPosition = await TrackPlayer.getProgress();
      customLog('useAudioPlayer: Current position before seek:', currentPosition.position);
      
      await TrackPlayer.seekTo(positionInSeconds);
      customLog('useAudioPlayer: Seek operation completed successfully');
      
      // Verify the seek worked by checking position after a brief delay
      setTimeout(async () => {
        try {
          const newPosition = await TrackPlayer.getProgress();
          customLog('useAudioPlayer: Position after seek:', newPosition.position, 'Target was:', positionInSeconds);
        } catch (error) {
          customError('useAudioPlayer: Error checking position after seek:', error);
        }
      }, 100);
      
    } catch (error) {
      customError('useAudioPlayer: Error seeking to position:', positionInSeconds, error);
    }
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
    // Clean up any existing watchdog first
    if (watchdogIntervalRef.current) {
      clearInterval(watchdogIntervalRef.current);
    }
    
    watchdogIntervalRef.current = setInterval(async () => {
      const playerState = await TrackPlayer.getState();
      if (playerState === State.Ready && !hasAutoPlayedOnce.current) {
        customLog('Player ready but not playing, attempting to resume (first load only)');
        await ensureAudioSessionActive();
        await TrackPlayer.play();
        hasAutoPlayedOnce.current = true;
      } else if (playerState === State.Ready) {
        customLog('Player ready but not auto-resuming (not first load)');
      }
    }, 5000); // Check every 5 seconds
    
    return watchdogIntervalRef.current;
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
        customLog('Starting initial load with migration...');
        
        // First, ensure migration is complete
        await migrateToNewSystem();
        setMigrationComplete(true);
        customLog('Migration completed');
        
        // Update history state
        await updateHistoryState();
        
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
        
        // Update history state after loading
        await updateHistoryState();
        setIsFirstLoad(false);
        customLog('Initial load completed');
      } catch (error) {
        customError('Failed to load the last song and position:', error);
        try {
          await loadRandomFile();
          await updateHistoryState();
        } catch (fallbackError) {
          customError('Fallback load also failed:', fallbackError);
        }
        setIsFirstLoad(false);
      }
    };
  
    loadLastSong();
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      // Removed auto-play on app focus - only track app state changes
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
        customLog('Test mode enabled, seeking current track to last 31 seconds');
        try {
          // Reset any track ended state that might be corrupted
          setIsTrackEnded(false);
          
          const trackDuration = await TrackPlayer.getDuration();
          if (trackDuration > 31) {
            // Get current track info to prevent duplicate seeks
            const currentTrack = await TrackPlayer.getActiveTrackIndex();
            const trackObject = await TrackPlayer.getTrack(currentTrack);
            const trackUrl = trackObject?.url;
            
            // Only seek if we haven't already seeked this track recently
            const now = Date.now();
            if (!trackUrl || !lastTestModeSeek.current[trackUrl] || now - lastTestModeSeek.current[trackUrl] > 2000) {
              const seekPosition = trackDuration - 31;
              customLog('Seeking to position:', seekPosition, 'for track:', trackUrl);
              await TrackPlayer.seekTo(seekPosition);
              
              if (trackUrl) {
                lastTestModeSeek.current[trackUrl] = now;
              }
            } else {
              customLog('Skipping seek - already seeked this track recently');
            }
          }
        } catch (error) {
          customError('Error seeking in test mode:', error);
        }
      } else {
        // When exiting test mode, reset any corrupted state
        customLog('Test mode disabled, resetting track state');
        setIsTrackEnded(false);
        nextTrackUrl.current = null; // Clear preloaded track URL to force fresh preload
        isPreloading.current = false; // Reset preload lock to boolean false
        isTransitioning.current = false; // Reset transition lock
        lastPreloadCheck.current = 0; // Reset preload debounce timer
        lastTestModeSeek.current = {}; // Clear test mode seek history
      }
    };

    handleTestModeChange();
  }, [isTestMode]);

  // Function to preload the next track
  const preloadNextTrack = async () => {
    // Use a more robust mutex pattern - check and set atomically using a temporary variable
    if (isPreloading.current) {
      customLog('Preload already in progress, skipping');
      return;
    }
    
    // Atomic check-and-set using a promise to ensure only one operation proceeds
    const preloadId = Date.now() + Math.random(); // Unique ID for this preload attempt
    
    // Double-check pattern with unique ID logging
    if (isPreloading.current) {
      customLog('Preload already in progress after double-check, skipping');
      return;
    }
    
    isPreloading.current = preloadId; // Set to unique ID instead of boolean
    
    // Verify we actually got the lock
    if (isPreloading.current !== preloadId) {
      customLog('Failed to acquire preload lock, another operation took it');
      return;
    }

    try {
      if (!nextTrackUrl.current) {
        customLog('Starting preload operation with ID:', preloadId);
        
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
      } else {
        customLog('Next track already preloaded, skipping');
      }
    } catch (error) {
      customError('Error preloading next track:', error);
    } finally {
      // Only clear the lock if we still own it
      if (isPreloading.current === preloadId) {
        isPreloading.current = false;
      }
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
    seekTo,
    loadPreviousFile: debouncedLoadPreviousFile,
    loadNextFile: debouncedLoadNextFile,
    saveCurrentState,
    // New history system data for debugging
    historyIndex,
    historyLength,
    migrationComplete,
    updateHistoryState
  };
};

export default useAudioPlayer;