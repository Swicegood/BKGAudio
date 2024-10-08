import React from 'react';
import { View, Text, Animated } from 'react-native';
import styles from './styles';

const ProgressBar = ({ duration, position }) => {

  const formatTime = (totalSeconds) => {
    wholeSeconds = Math.floor(totalSeconds);
    const minutes = Math.floor(wholeSeconds / 60);
    const seconds = wholeSeconds % 60;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const progress = position / duration;

  return (
    <>
      <View style={styles.progressContainer}>
        <Animated.View 
          style={[
            styles.progressBar,
            { width: `${progress * 100}%` },
          ]}
        />
      </View>
      <View style={styles.timeContainer}>
        <Text style={styles.timeText}>{formatTime(position)}</Text>
        <Text style={styles.timeText}>{formatTime(duration)}</Text>
      </View>
    </>
  );
};

export default ProgressBar;