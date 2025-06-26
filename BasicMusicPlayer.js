import React from "react";
import { View, ActivityIndicator } from "react-native";
import AudioControls from './AudioControls';
import ProgressBar from './ProgressBar';
import SongTitle from './SongTitle';
import styles from './styles';

const BasicMusicPlayer = ({ audioPlayerData, onSongLoaded }) => {
  const {
    isLoading,
    isPlaying,
    songTitle,
    duration,
    position,
    isTestMode,
    toggleTestMode,
    togglePlayback,
    seekBackward,
    seekForward,
    seekTo,
    loadPreviousFile,
    loadNextFile,
    // New history system data (still available for DebugScreen if needed)
    historyIndex,
    historyLength,
    migrationComplete,
    updateHistoryState,
  } = audioPlayerData;

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
      <ProgressBar duration={duration} position={position} onSeek={seekTo} />
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