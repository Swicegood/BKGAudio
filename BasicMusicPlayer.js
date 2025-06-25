import React, { useState } from "react";
import { View, ActivityIndicator, TouchableOpacity, Text } from "react-native";
import AudioControls from './AudioControls';
import ProgressBar from './ProgressBar';
import SongTitle from './SongTitle';
import HistoryDebugPanel from './HistoryDebugPanel';
import styles from './styles';

const BasicMusicPlayer = ({ audioPlayerData, onSongLoaded }) => {
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  
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
    // New history system data
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
      
      {/* Debug Panel Toggle Button */}
      <TouchableOpacity 
        style={styles.debugToggle} 
        onPress={() => setShowDebugPanel(!showDebugPanel)}
      >
        <Text style={styles.debugToggleText}>
          {showDebugPanel ? '🔧 Hide Debug' : '🔧 Show Debug'}
        </Text>
      </TouchableOpacity>
      
      {/* History Debug Panel */}
      <HistoryDebugPanel
        historyIndex={historyIndex}
        historyLength={historyLength}
        migrationComplete={migrationComplete}
        updateHistoryState={updateHistoryState}
        isVisible={showDebugPanel}
      />
    </View>
  );
};

export default BasicMusicPlayer;