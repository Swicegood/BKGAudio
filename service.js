import TrackPlayer, { Event } from 'react-native-track-player';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { customLog, customError } from './customLogger';

module.exports = async function() {
  customLog('Service function started');

  TrackPlayer.addEventListener(Event.RemotePlay, () => {
    customLog('RemotePlay event received');
    TrackPlayer.play();
  });

  TrackPlayer.addEventListener(Event.RemotePause, () => {
    customLog('RemotePause event received');
    TrackPlayer.pause();
  });

  TrackPlayer.addEventListener(Event.RemoteStop, async () => {
    customLog('RemoteStop event received');
    try {
      const position = await TrackPlayer.getPosition();
      const currentTrack = await TrackPlayer.getCurrentTrack();
      if (currentTrack) {
        const trackObject = await TrackPlayer.getTrack(currentTrack);
        await AsyncStorage.setItem('lastSongUrl', trackObject.url);
        await AsyncStorage.setItem('lastSongPosition', position.toString());
        customLog('Saved last song state:', { url: trackObject.url, position });
      }
      await TrackPlayer.destroy();
      customLog('TrackPlayer destroyed');
    } catch (error) {
      customError('Error in RemoteStop event:', error);
    }
  });

  TrackPlayer.addEventListener(Event.RemoteNext, () => {
    customLog('RemoteNext event received');
    TrackPlayer.skipToNext();
  });

  TrackPlayer.addEventListener(Event.RemotePrevious, () => {
    customLog('RemotePrevious event received');
    TrackPlayer.skipToPrevious();
  });

  TrackPlayer.addEventListener(Event.PlaybackQueueEnded, async (event) => {
    customLog('PlaybackQueueEnded event received', event);
    try {
      customLog('Queue ended, fetching next file');
      const { getNextFile } = require('./apiWrapper');
      const nextFile = await getNextFile();
      customLog('Next file to play:', nextFile);
      await TrackPlayer.reset();
      await TrackPlayer.add({
        id: '1',
        url: nextFile,
        title: nextFile.split('/').pop().replace(/\.mp3$/, ''),
      });
      await TrackPlayer.play();
      customLog('Started playing next file');
    } catch (error) {
      customError('Error in PlaybackQueueEnded event:', error);
    }
  });

  TrackPlayer.addEventListener(Event.PlaybackState, async (event) => {
    customLog('PlaybackState changed:', event.state);
    if (event.state === TrackPlayer.State.Stopped) {
      customLog('Playback stopped, checking if queue is empty');
      const queue = await TrackPlayer.getQueue();
      if (queue.length === 0) {
        customLog('Queue is empty, fetching next file');
        const { getNextFile } = require('./apiWrapper');
        const nextFile = await getNextFile();
        customLog('Next file to play:', nextFile);
        await TrackPlayer.add({
          id: '1',
          url: nextFile,
          title: nextFile.split('/').pop().replace(/\.mp3$/, ''),
        });
        await TrackPlayer.play();
        customLog('Started playing next file');
      }
    }
  });

  TrackPlayer.addEventListener(Event.PlaybackError, (error) => {
    customError('PlaybackError occurred:', error);
  });

  TrackPlayer.addEventListener(Event.PlaybackTrackChanged, (event) => {
    customLog('PlaybackTrackChanged:', event);
  });

  customLog('All event listeners registered');
};