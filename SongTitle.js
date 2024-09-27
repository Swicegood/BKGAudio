import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import styles from './styles';

const SongTitle = ({ title }) => {
  const [titleWidth, setTitleWidth] = useState(0);
  const scrollAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (titleWidth > styles.songTitleContainer.width) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(scrollAnim, {
            toValue: -(titleWidth - styles.songTitleContainer.width),
            duration: 15000,
            useNativeDriver: true,
          }),
          Animated.timing(scrollAnim, {
            toValue: 0,
            duration: 15000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      scrollAnim.setValue(0);
    }
  }, [titleWidth, title]);

  const onTitleLayout = (event) => {
    setTitleWidth(event.nativeEvent.layout.width);
  };

  return (
    <View style={styles.songTitleContainer}>
      <Animated.View style={{ transform: [{ translateX: scrollAnim }] }}>
        <Text style={styles.songTitle} onLayout={onTitleLayout}>
          {title.replace(/_/g, " ")}
        </Text>
      </Animated.View>
      <LinearGradient
        colors={['rgba(237, 201, 146, 1)', 'rgba(237, 201, 146, 0)']}
        start={{x: 0, y: 0.5}}
        end={{x: 1, y: 0.5}}
        style={[styles.titleGradient, { left: 0 }]}
      />
      <LinearGradient
        colors={['rgba(237, 201, 146, 0)', 'rgba(237, 201, 146, 1)']}
        start={{x: 0, y: 0.5}}
        end={{x: 1, y: 0.5}}
        style={[styles.titleGradient, { right: 0 }]}
      />
    </View>
  );
};

export default SongTitle;