import TrackPlayer, { Event } from 'react-native-track-player';
import { getNextFile } from './apiWrapper';

module.exports = async function() {
  TrackPlayer.addEventListener(Event.RemotePlay, () => TrackPlayer.play());
  TrackPlayer.addEventListener(Event.RemotePause, () => TrackPlayer.pause());
  TrackPlayer.addEventListener(Event.RemoteStop, () => TrackPlayer.destroy());
  TrackPlayer.addEventListener(Event.RemoteNext, () => TrackPlayer.skipToNext());
  TrackPlayer.addEventListener(Event.RemotePrevious, () => TrackPlayer.skipToPrevious());

  TrackPlayer.addEventListener(Event.PlaybackQueueEnded, async () => {
    const nextFile = await getNextFile();
    await TrackPlayer.reset();
    await TrackPlayer.add({
      id: '1',
      url: nextFile,
      title: nextFile.split('/').pop().replace(/\.mp3$/, ''),
    });
    await TrackPlayer.play();
  });
};