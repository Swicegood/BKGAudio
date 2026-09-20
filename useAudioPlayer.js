import { useState, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import StorageManager from './StorageManager';
import TrackPlayer, { Event, PlaybackState, useIsPlaying, useProgress } from '@rntp/player';
import { getAllFiles, getRandomFile, getPreviousFile, getNextFile, getPlayedHistory, getCurrentHistoryIndex, migrateToNewSystem } from './apiWrapper';
import { debounce } from 'lodash';
import { customLog, customError } from './customLogger';
import { loadUrl, mediaItemFromUrl, setupAppPlayer } from './player';

const useAudioPlayer = (onSongLoaded) => {
  setupAppPlayer();
  const [isFirstLoad, setIsFirstLoad] = useState(true);
  const isPlaying = useIsPlaying();
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
          const activeTrack = TrackPlayer.getActiveMediaItem();
          if (activeTrack) {
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

  useEffect(() => {
    watchdogIntervalRef.current = startPlaybackWatchdog();

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

  useEffect(() => {
    const errorSub = TrackPlayer.addEventListener(Event.PlaybackError, async (event) => {
      customError('Playback error:', event);
      if (event?.code === 'network' || event?.code === 'unknown') {
        try {
          TrackPlayer.retry();
          TrackPlayer.play();
          return;
        } catch (retryError) {
          customError('Retry after playback error failed:', retryError);
        }
      }
      nextTrackUrl.current = null;
      await debouncedLoadNextFile();
    });

    const transitionSub = TrackPlayer.addEventListener(Event.MediaItemTransition, async (event) => {
      if (!event.item) {
        return;
      }
      setSongTitle(event.item.title);
      onSongLoaded(true);
      setIsTrackEnded(false);
      nextTrackUrl.current = null;
      await updateHistoryState();
      customLog('History state synced after track change');
    });

    const stateSub = TrackPlayer.addEventListener(Event.PlaybackStateChanged, async (event) => {
      if (event.state === PlaybackState.Ready && isTestMode) {
        customLog('Track ready in test mode, seeking to last 31 seconds');
        try {
          await new Promise(resolve => setTimeout(resolve, 500));
          const trackDuration = TrackPlayer.getProgress().duration;
          if (trackDuration > 31) {
            const trackUrl = TrackPlayer.getActiveMediaItem()?.url;
            const now = Date.now();
            if (!trackUrl || !lastTestModeSeek.current[trackUrl] || now - lastTestModeSeek.current[trackUrl] > 2000) {
              const seekPosition = trackDuration - 31;
              customLog('Seeking to position:', seekPosition, 'for track:', trackUrl);
              TrackPlayer.seekTo(seekPosition);
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
    });

    return () => {
      errorSub.remove();
      transitionSub.remove();
      stateSub.remove();
    };
  }, [isTestMode, onSongLoaded]);

  const loadRandomFile = async () => {
    try {
      customLog('Starting to load random file');
      const randomFile = await getRandomFile();
      if (randomFile) {
        customLog('Random file obtained:', randomFile);
        loadUrl(randomFile, '1');
        setSongTitle(randomFile.split('/').pop().replace(/\.mp3$/, ''));
        setIsLoading(false);
        customLog('isLoading set to false');
        onSongLoaded(true);
        customLog('onSongLoaded(true) called');
        
        await updateHistoryState();
        
        if (!hasAutoPlayedOnce.current) {
          TrackPlayer.play();
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
      
      loadUrl(fileUrl, 'current');
      setSongTitle(fileUrl.split('/').pop().replace(/\.mp3$/, ''));
      
      if (isTestMode) {
        customLog('Test mode enabled, seeking to last 31 seconds');
        try {
          await new Promise(resolve => setTimeout(resolve, 500));
          const trackDuration = TrackPlayer.getProgress().duration;
          if (trackDuration > 31) {
            const seekPosition = trackDuration - 31;
            customLog('Seeking to position:', seekPosition);
            TrackPlayer.seekTo(seekPosition);
          }
        } catch (error) {
          customError('Error seeking in test mode:', error);
        }
      }
      
      if (!hasAutoPlayedOnce.current) {
        TrackPlayer.play();
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
        TrackPlayer.play();
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
      TrackPlayer.play();
    } finally {
      // Clear manual navigation flag after a delay
      setTimeout(() => {
        if (global.setManualNavigation) {
          global.setManualNavigation(false);
        }
      }, 2000);
    }
  }, 1000)).current;

  const togglePlayback = () => {
    if (TrackPlayer.isPlaying()) {
      TrackPlayer.pause();
    } else {
      TrackPlayer.play();
    }
  };

  const seekBackward = () => {
    TrackPlayer.seekBy(-15);
  };

  const seekForward = () => {
    TrackPlayer.seekBy(30);
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
      const currentProgress = TrackPlayer.getProgress();
      const trackObject = TrackPlayer.getActiveMediaItem();
      if (trackObject?.url) {
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
      const playerState = TrackPlayer.getPlaybackState();
      if (playerState === PlaybackState.Ready && !TrackPlayer.isPlaying() && !hasAutoPlayedOnce.current) {
        customLog('Player ready but not playing, attempting to resume (first load only)');
        TrackPlayer.play();
        hasAutoPlayedOnce.current = true;
      } else if (playerState === PlaybackState.Ready && !TrackPlayer.isPlaying()) {
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
            TrackPlayer.seekTo(savedPosition);
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
        const currentProgress = TrackPlayer.getProgress();
        const trackObject = TrackPlayer.getActiveMediaItem();
        if (trackObject?.url) {
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
          
          const trackDuration = TrackPlayer.getProgress().duration;
          if (trackDuration > 31) {
            const trackUrl = TrackPlayer.getActiveMediaItem()?.url;
            
            // Only seek if we haven't already seeked this track recently
            const now = Date.now();
            if (!trackUrl || !lastTestModeSeek.current[trackUrl] || now - lastTestModeSeek.current[trackUrl] > 2000) {
              const seekPosition = trackDuration - 31;
              customLog('Seeking to position:', seekPosition, 'for track:', trackUrl);
              TrackPlayer.seekTo(seekPosition);
              
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
        TrackPlayer.addMediaItem(mediaItemFromUrl(nextFile, 'next'));
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