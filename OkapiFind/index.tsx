import { registerRootComponent } from 'expo';
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

// Absolute minimal app - just "Hello World"
const MinimalApp: React.FC = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>OkapiFind</Text>
      <Text style={styles.subtitle}>App is loading...</Text>
      <Text style={styles.debug}>If you see this, React Native works!</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F1B2A',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFD700',
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 18,
    color: '#FFFFFF',
    marginBottom: 8,
  },
  debug: {
    fontSize: 14,
    color: '#00FF00',
    marginTop: 20,
  },
});

registerRootComponent(MinimalApp);
