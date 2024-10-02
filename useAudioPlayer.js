import { useState, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import StorageManager from './StorageManager';
import TrackPlayer, { State, Event, useTrackPlayerEvents, useProgress } from 'react-native-track-player';
import { getAllFiles, getRandomFile, getPreviousFile, getNextFile } from './apiWrapper';
import { debounce } from 'lodash';
import { customLog, customError } from './customLogger';

const useAudioPlayer = (onSongLoaded) => {
  const [isFirstLoad, setIsFirstLoad] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [songTitle, setSongTitle] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const appState = useRef(AppState.currentState);
  const [appStateVisible, setAppStateVisible] = useState(appState.current);
  const isLoadingNewFile = useRef(false);

  const { position, duration } = useProgress();

 
  useTrackPlayerEvents([Event.PlaybackTrackChanged, Event.PlaybackState], async (event) => {
    if (event.type === Event.PlaybackTrackChanged && event.nextTrack !== null) {
      const track = await TrackPlayer.getTrack(event.nextTrack);
      if (track) {
        setSongTitle(track.title);
        onSongLoaded(true);
      }
    } else if (event.type === Event.PlaybackState) {
      setIsPlaying(event.state === State.Playing);
    }
  });


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
      await TrackPlayer.reset();
      await TrackPlayer.add({
        id: '1',
        url: fileUrl,
        title: fileUrl.split('/').pop().replace(/\.mp3$/, ''),
      });
      setSongTitle(fileUrl.split('/').pop().replace(/\.mp3$/, ''));
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
      await StorageManager.setItem('lastSongPosition', currentProgress.position.toString());
      const currentTrack = await TrackPlayer.getActiveTrackIndex();
      if (currentTrack !== null && currentTrack !== undefined) {
        const trackObject = await TrackPlayer.getTrack(currentTrack);
        await StorageManager.setItem('lastSongUrl', trackObject.url);
        customLog('Saved current state', trackObject.url );
        customLog('Saved current position', currentProgress.position );
      }
    } catch (error) {
      customError('Error saving current state:', error);
    }
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
        const lastSongPosition = await StorageManager.getItem('lastSongPosition');
  
        if (lastSongUrl) {
          customLog('Last song URL found:', lastSongUrl);
          await loadFile(lastSongUrl);
          if (lastSongPosition) {
            const savedPosition = Number(lastSongPosition);
            await TrackPlayer.seekTo(savedPosition);
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
    customLog('Setting up save progress interval');
    
    const saveProgress = async () => {
      customLog('saveProgress called');
      try {
        const currentProgress = await TrackPlayer.getProgress();
        await StorageManager.setItem('lastSongPosition', currentProgress.position.toString());
        const currentTrack = await TrackPlayer.getActiveTrackIndex();
        if (currentTrack !== null && currentTrack !== undefined) {
          const trackObject = await TrackPlayer.getTrack(currentTrack);
          await StorageManager.setItem('lastSongUrl', trackObject.url);
          customLog('Saved progress:', { url: trackObject.url, position: currentProgress.position });
        }
      } catch (error) {
        customError('Error saving progress:', error);
      }
    };
  
    const intervalId = setInterval(saveProgress, 5000);
  
    // Initial save
    saveProgress();
  
    return () => {
      console.log('Clearing save progress interval');
      clearInterval(intervalId);
    };
  }, []); 

  return {
    isLoading,
    isPlaying,
    songTitle,
    duration,
    position,
    togglePlayback,
    seekBackward,
    seekForward,
    loadPreviousFile: debouncedLoadPreviousFile,
    loadNextFile: debouncedLoadNextFile,
    saveCurrentState
  };
};

export default useAudioPlayer;