import { registerRootComponent } from 'expo';
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Platform, TouchableOpacity } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { Colors } from './src/constants/colors';
import { analytics } from './src/services/analytics';
import { ErrorBoundary } from './src/services/errorBoundary';
import { OfflineIndicator } from './src/components/OfflineIndicator';
import { FirebaseConfigGuard } from './src/components/FirebaseConfigGuard';
import {
  MapScreen,
  GuidanceScreen,
  SettingsScreen,
  LegalScreen,
  PaywallScreen,
} from './src/utils/lazyComponents';
import './src/i18n';

const Stack = createStackNavigator();

// Loading screen component
const LoadingScreen: React.FC = () => (
  <View style={styles.loadingContainer}>
    <ActivityIndicator size="large" color={Colors.primary} />
    <Text style={styles.loadingText}>Loading OkapiFind...</Text>
  </View>
);

// App component with safe initialization
const App: React.FC = () => {
  const [isReady, setIsReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Initialize analytics (non-blocking)
        try {
          await analytics.initialize();
          analytics.trackEvent('app_launched', {
            platform: Platform.OS,
            timestamp: new Date().toISOString(),
          });
        } catch (analyticsError) {
          console.warn('Analytics initialization failed:', analyticsError);
          // Don't block app startup for analytics
        }

        setIsReady(true);
      } catch (error) {
        console.error('App initialization error:', error);
        setInitError(error instanceof Error ? error.message : 'Unknown error');
        // Still mark as ready to show error UI
        setIsReady(true);
      }
    };

    initializeApp();
  }, []);

  // Show loading screen while initializing
  if (!isReady) {
    return (
      <SafeAreaProvider>
        <LoadingScreen />
        <StatusBar style="auto" />
      </SafeAreaProvider>
    );
  }

  // Show error screen if initialization failed critically
  if (initError) {
    return (
      <SafeAreaProvider>
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.errorMessage}>{initError}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              setInitError(null);
              setIsReady(false);
            }}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
        <StatusBar style="auto" />
      </SafeAreaProvider>
    );
  }

  // Main app with full navigation
  return (
    <ErrorBoundary screenName="App">
      <FirebaseConfigGuard>
        <SafeAreaProvider>
          <OfflineIndicator />
          <NavigationContainer>
            <Stack.Navigator
              initialRouteName="Map"
              screenOptions={{
                headerStyle: { backgroundColor: Colors.background },
                headerTintColor: Colors.primary,
                headerTitleStyle: { fontWeight: '600' },
              }}
            >
              <Stack.Screen
                name="Map"
                component={MapScreen}
                options={({ navigation }) => ({
                  title: 'OkapiFind',
                  headerTitleAlign: 'center',
                  headerRight: () => (
                    <TouchableOpacity
                      style={styles.headerButton}
                      onPress={() => navigation.navigate('Settings')}
                      accessibilityLabel="Settings"
                      accessibilityRole="button"
                    >
                      <Text style={styles.headerButtonText}>Settings</Text>
                    </TouchableOpacity>
                  ),
                })}
              />
              <Stack.Screen
                name="Guidance"
                component={GuidanceScreen}
                options={{
                  title: 'Navigate to Car',
                  headerBackTitle: 'Back',
                }}
              />
              <Stack.Screen
                name="Settings"
                component={SettingsScreen}
                options={{
                  title: 'Settings',
                  headerBackTitle: 'Back',
                }}
              />
              <Stack.Screen
                name="Legal"
                component={LegalScreen}
                options={{
                  title: 'Legal',
                  headerBackTitle: 'Back',
                }}
              />
              <Stack.Screen
                name="Paywall"
                component={PaywallScreen}
                options={{
                  title: 'Upgrade to Premium',
                  headerBackTitle: 'Back',
                }}
              />
            </Stack.Navigator>
          </NavigationContainer>
          <StatusBar style="auto" />
        </SafeAreaProvider>
      </FirebaseConfigGuard>
    </ErrorBoundary>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: Colors.primary,
    fontSize: 18,
    marginTop: 16,
    fontWeight: '500',
  },
  errorContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorTitle: {
    color: '#FF6B6B',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  errorMessage: {
    color: '#FFFFFF',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: Colors.background,
    fontSize: 16,
    fontWeight: '600',
  },
  headerButton: {
    marginRight: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  headerButtonText: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: '500',
  },
});

registerRootComponent(App);
