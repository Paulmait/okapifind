import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TouchableOpacity, Text, Platform, View, ActivityIndicator, StyleSheet } from 'react-native';

import {
  MapScreen,
  GuidanceScreen,
  SettingsScreen,
  LegalScreen,
  PaywallScreen,
  AuthScreen,
} from './src/utils/lazyComponents';
import { RootStackParamList } from './src/types/navigation';
import { Colors } from './src/constants/colors';
import { analytics } from './src/services/analytics';
import { useAuth } from './src/hooks/useAuth';
import { performance } from './src/services/performance';
import { ErrorBoundary } from './src/services/errorBoundary';
import { featureFlagService } from './src/services/featureFlags';
import { offlineModeService } from './src/services/offlineMode';
import { FirebaseConfigGuard } from './src/components/FirebaseConfigGuard';
import { OfflineIndicator } from './src/components/OfflineIndicator';
import { ConfigDiagnostic } from './src/components/ConfigDiagnostic';
import { MobileAppPromotion } from './src/components/MobileAppPromotion';
import { isFirebaseConfigured } from './src/config/firebase';
import { crossPlatformSync } from './src/services/crossPlatformSync';
import './src/i18n'; // Initialize i18n

const Stack = createStackNavigator<RootStackParamList>();

function LoadingScreen() {
  return (
    <View style={styles.loadingContainer}>
      <Text style={styles.logoIcon}>🚗</Text>
      <Text style={styles.logoArrow}>↑</Text>
      <ActivityIndicator size="large" color={Colors.primary} style={styles.loader} />
      <Text style={styles.loadingText}>Loading OkapiFind...</Text>
    </View>
  );
}

function MainNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Map"
      screenOptions={{
        headerStyle: {
          backgroundColor: Colors.background,
        },
        headerTintColor: Colors.primary,
        headerTitleStyle: {
          fontWeight: 'bold',
        },
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
              onPress={() => navigation.navigate('Settings')}
              style={{ marginRight: 16 }}
            >
              <Text style={{ color: Colors.primary, fontSize: 28 }}>⚙</Text>
            </TouchableOpacity>
          ),
        })}
      />
      <Stack.Screen
        name="Guidance"
        component={GuidanceScreen}
        options={{
          title: 'Guidance',
          headerTitleAlign: 'center',
          headerLeft: () => null,
        }}
      />
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: 'Settings',
          headerTitleAlign: 'center',
        }}
      />
      <Stack.Screen
        name="Legal"
        component={LegalScreen}
        options={{
          title: 'Legal',
          headerTitleAlign: 'center',
          presentation: Platform.OS === 'ios' ? 'modal' : 'card',
        }}
      />
      <Stack.Screen
        name="Paywall"
        component={PaywallScreen}
        options={{
          title: '',
          headerShown: false,
          presentation: 'modal',
        }}
      />
    </Stack.Navigator>
  );
}

function AuthNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen
        name="Auth"
        component={AuthScreen}
        options={{
          title: '',
          headerShown: false,
        }}
      />
    </Stack.Navigator>
  );
}

export default function App() {
  const { isLoading, isAuthenticated, isReady, currentUser } = useAuth();

  // Check if Firebase is configured - show diagnostic if not
  const firebaseConfigured = isFirebaseConfigured();

  // Debug logging for web
  useEffect(() => {
    if (Platform.OS === 'web') {
      console.log('🔍 Auth Debug:', {
        isLoading,
        isAuthenticated,
        isReady,
        hasUser: !!currentUser,
        userEmail: currentUser?.email,
      });
    }
  }, [isLoading, isAuthenticated, isReady, currentUser]);

  useEffect(() => {
    // Initialize all services on app start
    analytics.initialize();

    // Initialize performance monitoring
    performance.logBundleInfo();
    performance.startFPSMonitoring();
    performance.startTimer('App_initialization');

    // Initialize feature flags
    featureFlagService.fetchRemoteConfig();

    // Initialize offline mode
    offlineModeService.getNetworkState();

    // Initialize cross-platform sync when user is authenticated
    if (isAuthenticated && currentUser?.uid) {
      crossPlatformSync.initialize(currentUser.uid).catch((error) => {
        console.error('Failed to initialize cross-platform sync:', error);
      });
    }

    return () => {
      performance.endTimer('App_initialization');
      crossPlatformSync.stopAutoSync();
    };
  }, [isAuthenticated, currentUser]);

  // Show diagnostic screen if Firebase not configured (especially important for web)
  if (!firebaseConfigured && Platform.OS === 'web') {
    return (
      <SafeAreaProvider>
        <ConfigDiagnostic />
        <StatusBar style="auto" />
      </SafeAreaProvider>
    );
  }

  // Show loading screen while auth is initializing
  if (isLoading || !isReady) {
    return (
      <SafeAreaProvider>
        <LoadingScreen />
        <StatusBar style="auto" />
      </SafeAreaProvider>
    );
  }

  return (
    <ErrorBoundary
      userId={currentUser?.uid}
      screenName="App"
      onError={(error, errorInfo) => {
        console.error('Critical app error:', error);
        // Additional error handling logic can go here
      }}
    >
      <SafeAreaProvider>
        <OfflineIndicator />
        {/* Show mobile app promotion banner on web */}
        {Platform.OS === 'web' && <MobileAppPromotion />}
        <NavigationContainer>
          <StatusBar style="auto" />
          <FirebaseConfigGuard>
            {/* Always show MainNavigator - authentication is optional */}
            <MainNavigator />
          </FirebaseConfigGuard>
        </NavigationContainer>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  logoIcon: {
    fontSize: 80,
    color: Colors.primary,
    marginBottom: 20,
  },
  logoArrow: {
    fontSize: 40,
    color: Colors.primary,
    position: 'absolute',
    top: '42%',
    transform: [{ translateY: -60 }],
  },
  loader: {
    marginTop: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.textSecondary,
  },
});