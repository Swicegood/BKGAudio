import TrackPlayer, { Event } from 'react-native-track-player';
import AsyncStorage from '@react-native-async-storage/async-storage';

module.exports = async function() {
  TrackPlayer.addEventListener(Event.RemotePlay, () => TrackPlayer.play());
  TrackPlayer.addEventListener(Event.RemotePause, () => TrackPlayer.pause());
  TrackPlayer.addEventListener(Event.RemoteStop, async () => {
    // App is being terminated
    const position = await TrackPlayer.getPosition();
    const currentTrack = await TrackPlayer.getCurrentTrack();
    if (currentTrack) {
      const trackObject = await TrackPlayer.getTrack(currentTrack);
      await AsyncStorage.setItem('lastSongUrl', trackObject.url);
      await AsyncStorage.setItem('lastSongPosition', position.toString());
    }
    await TrackPlayer.destroy();
  });
  TrackPlayer.addEventListener(Event.RemoteNext, () => TrackPlayer.skipToNext());
  TrackPlayer.addEventListener(Event.RemotePrevious, () => TrackPlayer.skipToPrevious());

  // Add this event listener to handle playback completion
  TrackPlayer.addEventListener(Event.PlaybackQueueEnded, async (event) => {
    if (event.track) {
      const { getNextFile } = require('./apiWrapper');  // Import dynamically to avoid circular dependency
      const nextFile = await getNextFile();
      await TrackPlayer.reset();
      await TrackPlayer.add({
        id: '1',
        url: nextFile,
        title: nextFile.split('/').pop().replace(/\.mp3$/, ''),
      });
      await TrackPlayer.play();
    }
  });
};