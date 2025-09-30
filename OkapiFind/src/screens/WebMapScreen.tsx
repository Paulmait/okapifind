import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MapView } from '../components/web/MapView';
import { Colors } from '../constants/colors';

/**
 * Web-compatible Map Screen
 * Uses Mapbox for web platform instead of react-native-maps
 */
const WebMapScreen: React.FC = () => {
  return (
    <View style={styles.container}>
      <MapView />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
});

export default WebMapScreen;
