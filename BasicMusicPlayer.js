import React from "react";
import { View, ActivityIndicator } from "react-native";
import AudioControls from './AudioControls';
import ProgressBar from './ProgressBar';
import SongTitle from './SongTitle';
import useAudioPlayer from './useAudioPlayer';
import styles from './styles';

const BasicMusicPlayer = ({ onSongLoaded }) => {
  const {
    isLoading,
    isPlaying,
    songTitle,
    duration,
    position,
    togglePlayback,
    seekBackward,
    seekForward,
    loadPreviousFile,
    loadNextFile,
  } = useAudioPlayer(onSongLoaded);

  if (isLoading) {
    return (
      <View style={styles.musicContainer}>
        <ActivityIndicator size="large" color="#C68446" />
      </View>
    );
  }

  return (
    <View style={styles.musicContainer}>
      <SongTitle title={songTitle || 'Loading...'} />
      <ProgressBar duration={duration} position={position} />
      <AudioControls
        isPlaying={isPlaying}
        onTogglePlayback={togglePlayback}
        onSeekBackward={seekBackward}
        onSeekForward={seekForward}
        onPrevious={loadPreviousFile}
        onNext={loadNextFile}
        disabled={isLoading}
      />
    </View>
  );
};

export default BasicMusicPlayer;