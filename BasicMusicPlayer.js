import React from "react";
import { View, ActivityIndicator, TouchableOpacity, Text } from "react-native";
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
    loadPreviousFile,
    loadNextFile,
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
      <TouchableOpacity 
        style={[styles.testModeButton, isTestMode && styles.testModeButtonActive]} 
        onPress={toggleTestMode}
      >
        <Text style={styles.testModeButtonText}>
          {isTestMode ? 'Test Mode: ON' : 'Test Mode: OFF'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

export default BasicMusicPlayer;