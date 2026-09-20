import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import styles from './styles';

const AudioControls = ({
  isPlaying,
  onTogglePlayback,
  onSeekBackward,
  onSeekForward,
  onPrevious,
  onNext,
  disabled
}) => {
  return (
    <View style={styles.buttonsContainer}>
      <TouchableOpacity style={styles.smallButton} onPress={onPrevious} disabled={disabled}>
        <MaterialIcons name="skip-previous" size={30} color="#FFFFFF" />
      </TouchableOpacity>
      <TouchableOpacity style={styles.smallButton} onPress={onSeekBackward} disabled={disabled}>
        <MaterialIcons name="replay-10" size={30} color="#FFFFFF" />
      </TouchableOpacity>
      <TouchableOpacity style={styles.button} onPress={onTogglePlayback} disabled={disabled}>
        <MaterialIcons name={isPlaying ? "pause" : "play-arrow"} size={40} color="#FFFFFF" />
      </TouchableOpacity>
      <TouchableOpacity style={styles.smallButton} onPress={onSeekForward} disabled={disabled}>
        <MaterialIcons name="forward-30" size={30} color="#FFFFFF" />
      </TouchableOpacity>
      <TouchableOpacity style={styles.smallButton} onPress={onNext} disabled={disabled}>
        <MaterialIcons name="skip-next" size={30} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
};

export default AudioControls;