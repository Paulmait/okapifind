import { registerRootComponent } from 'expo';
import React from 'react';
import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native';

// Wrap everything in a try-catch to display startup errors
let AppComponent: React.ComponentType<any>;
let startupError: Error | null = null;
let startupErrorStack: string = '';

try {
  // Import the actual app
  const AppModule = require('./App');
  AppComponent = AppModule.default;
} catch (error: any) {
  console.error('STARTUP ERROR:', error);
  startupError = error;
  startupErrorStack = error?.stack || 'No stack trace available';

  // Fallback component that displays the error
  AppComponent = () => null;
}

// Error display component
const StartupErrorScreen: React.FC = () => (
  <View style={styles.container}>
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <Text style={styles.title}>🚨 Startup Error</Text>
      <Text style={styles.subtitle}>The app failed to initialize</Text>
      <View style={styles.errorBox}>
        <Text style={styles.errorLabel}>Error Message:</Text>
        <Text style={styles.errorText}>{startupError?.message || 'Unknown error'}</Text>
      </View>
      <View style={styles.errorBox}>
        <Text style={styles.errorLabel}>Stack Trace:</Text>
        <Text style={styles.stackText}>{startupErrorStack}</Text>
      </View>
      <Text style={styles.platform}>Platform: {Platform.OS}</Text>
    </ScrollView>
  </View>
);

// Wrapper component
const AppWrapper: React.FC = () => {
  if (startupError) {
    return <StartupErrorScreen />;
  }
  return <AppComponent />;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    paddingTop: 60,
  },
  scrollContent: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ff6b6b',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#e0e0e0',
    marginBottom: 24,
    textAlign: 'center',
  },
  errorBox: {
    backgroundColor: '#2a2a4a',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  errorLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ffd93d',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#ff6b6b',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  stackText: {
    fontSize: 11,
    color: '#a0a0a0',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  platform: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 20,
  },
});

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(AppWrapper);
