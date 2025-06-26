import React, { useState } from 'react';
import { View, Text, Animated, TouchableWithoutFeedback } from 'react-native';
import styles from './styles';

const ProgressBar = ({ duration, position, onSeek }) => {
  const [containerWidth, setContainerWidth] = useState(0);

  const formatTime = (totalSeconds) => {
    wholeSeconds = Math.floor(totalSeconds);
    const minutes = Math.floor(wholeSeconds / 60);
    const seconds = wholeSeconds % 60;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const progress = position / duration;

  const handleProgressBarPress = (event) => {
    console.log('ProgressBar: Touch detected on progress bar');
    
    if (!onSeek) {
      console.log('ProgressBar: No onSeek function provided');
      return;
    }
    
    if (!duration) {
      console.log('ProgressBar: No duration available, duration:', duration);
      return;
    }
    
    if (!containerWidth) {
      console.log('ProgressBar: Container width not set, width:', containerWidth);
      return;
    }
    
    const { locationX } = event.nativeEvent;
    console.log('ProgressBar: Touch locationX:', locationX, 'containerWidth:', containerWidth);
    
    const progressRatio = locationX / containerWidth;
    console.log('ProgressBar: Progress ratio:', progressRatio);
    
    const seekPosition = progressRatio * duration;
    console.log('ProgressBar: Calculated seek position:', seekPosition, 'duration:', duration);
    
    // Ensure seekPosition is within bounds
    const boundedSeekPosition = Math.max(0, Math.min(duration, seekPosition));
    console.log('ProgressBar: Bounded seek position:', boundedSeekPosition);
    
    console.log('ProgressBar: Calling onSeek with position:', boundedSeekPosition);
    onSeek(boundedSeekPosition);
  };

  const handleLayout = (event) => {
    const { width } = event.nativeEvent.layout;
    console.log('ProgressBar: Container layout measured, width:', width);
    setContainerWidth(width);
  };

  return (
    <>
      <TouchableWithoutFeedback onPress={handleProgressBarPress}>
        <View style={styles.progressContainer} onLayout={handleLayout}>
          <Animated.View 
            style={[
              styles.progressBar,
              { width: `${progress * 100}%` },
            ]}
          />
        </View>
      </TouchableWithoutFeedback>
      <View style={styles.timeContainer}>
        <Text style={styles.timeText}>{formatTime(position)}</Text>
        <Text style={styles.timeText}>{formatTime(duration)}</Text>
      </View>
    </>
  );
};

export default ProgressBar;