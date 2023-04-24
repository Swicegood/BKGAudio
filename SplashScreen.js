import React, { useEffect, useState } from 'react';
import { View, Image, StyleSheet, Text } from 'react-native';

const SplashScreen = () => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <Text style={styles.header}>Bir Krishna Goswami Audio</Text>
      </View>
      {isVisible && (
        <View style={styles.imageContainer}>
        <Image
          source={require('./assets/gurudeva-1.png')}
          style={styles.image}
        />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EDC992',
    justifyContent: 'flex-start',
    alignItems: 'center',
    width: '100%',
  },
  imageContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: '50%',
  },
  headerContainer: {
    backgroundColor: '#C68446',
    width: '100%',
    height: 40,
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  image: {
    width: 240,
    height: 400,
  },
});

export default SplashScreen;