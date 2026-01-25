import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TouchableOpacity, Text, Platform, View, ActivityIndicator, StyleSheet, Linking } from 'react-native';
import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
import { supabaseAuthService } from './src/services/supabaseAuth.service';

import {
  MapScreen,
  GuidanceScreen,
  SettingsScreen,
  LegalScreen,
  PaywallScreen,
  AuthScreen,
  SignInScreen,
  SavedPlacesScreen,
  SetHotelScreen,
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
import { initializeRevenueCat } from './src/hooks/useRevenueCat';
import './src/i18n'; // Initialize i18n

// Initialize Sentry early for crash reporting
const sentryDsn = Constants.expoConfig?.extra?.sentryDsn ||
                  process.env.EXPO_PUBLIC_SENTRY_DSN;

if (sentryDsn && !__DEV__) {
  Sentry.init({
    dsn: sentryDsn,
    debug: false,
    environment: 'production',
    tracesSampleRate: 0.1,
    sampleRate: 1.0,
    enableAutoSessionTracking: true,
    attachStacktrace: true,
  });
}

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
      <Stack.Screen
        name="SavedPlaces"
        component={SavedPlacesScreen}
        options={{
          title: 'Saved Places',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="SetHotel"
        component={SetHotelScreen}
        options={{
          title: 'Set Hotel',
          headerShown: false,
          presentation: Platform.OS === 'ios' ? 'modal' : 'card',
        }}
      />
      <Stack.Screen
        name="SignIn"
        component={SignInScreen}
        options={{
          title: 'Sign In',
          headerShown: false,
          presentation: 'modal',
        }}
      />
    </Stack.Navigator>
  );
}

// AuthNavigator - exported for use when authentication flow is enabled
export function AuthNavigator() {
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

function App() {
  const [initError, setInitError] = useState<Error | null>(null);

  // Wrap useAuth in try-catch via error state
  let authState = { isLoading: true, isAuthenticated: false, isReady: false, currentUser: null as any };
  try {
    authState = useAuth();
  } catch (error) {
    console.error('Auth initialization failed:', error);
    if (!initError) setInitError(error as Error);
  }

  const { isLoading, isAuthenticated, isReady, currentUser } = authState;

  // Check if Firebase is configured - show diagnostic if not
  let firebaseConfigured = false;
  try {
    firebaseConfigured = isFirebaseConfigured();
  } catch (error) {
    console.warn('Firebase config check failed:', error);
  }

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

  // Handle deep links for magic link authentication
  useEffect(() => {
    const handleDeepLink = async (event: { url: string }) => {
      const url = event.url;
      console.log('Deep link received:', url);

      // Check if this is a magic link auth callback
      if (url && (url.includes('auth/callback') || url.includes('access_token'))) {
        try {
          const success = await supabaseAuthService.handleMagicLinkCallback(url);
          if (success) {
            console.log('Magic link authentication successful');
          }
        } catch (error) {
          console.error('Error handling magic link:', error);
        }
      }
    };

    // Handle initial URL (app opened via deep link)
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink({ url });
      }
    });

    // Listen for deep links while app is running
    const subscription = Linking.addEventListener('url', handleDeepLink);

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    // Initialize all services on app start with error handling
    try {
      analytics.initialize();
    } catch (e) {
      console.warn('Analytics initialization failed:', e);
    }

    // Initialize RevenueCat for in-app purchases (iOS/Android only)
    try {
      initializeRevenueCat();
    } catch (e) {
      console.warn('RevenueCat initialization failed:', e);
    }

    // Initialize performance monitoring
    try {
      performance.logBundleInfo();
      performance.startFPSMonitoring();
      performance.startTimer('App_initialization');
    } catch (e) {
      console.warn('Performance monitoring failed:', e);
    }

    // Initialize feature flags
    try {
      featureFlagService.fetchRemoteConfig();
    } catch (e) {
      console.warn('Feature flags initialization failed:', e);
    }

    // Initialize offline mode
    try {
      offlineModeService.getNetworkState();
    } catch (e) {
      console.warn('Offline mode initialization failed:', e);
    }

    // Initialize cross-platform sync when user is authenticated
    if (isAuthenticated && currentUser?.uid) {
      crossPlatformSync.initialize(currentUser.uid).catch((error) => {
        console.warn('Failed to initialize cross-platform sync:', error);
      });
    }

    return () => {
      try {
        performance.endTimer('App_initialization');
        crossPlatformSync.stopAutoSync();
      } catch (e) {
        console.warn('Cleanup failed:', e);
      }
    };
  }, [isAuthenticated, currentUser]);

  // Show error screen if initialization failed
  if (initError) {
    return (
      <SafeAreaProvider>
        <View style={styles.loadingContainer}>
          <Text style={styles.logoIcon}>⚠️</Text>
          <Text style={[styles.loadingText, { color: '#FF6B6B', fontWeight: 'bold' }]}>
            App initialization failed
          </Text>
          <Text style={[styles.loadingText, { fontSize: 12, marginTop: 8 }]}>
            {initError.message}
          </Text>
        </View>
        <StatusBar style="auto" />
      </SafeAreaProvider>
    );
  }

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
      onError={(error, _errorInfo) => {
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

// Wrap App with Sentry for enhanced error tracking
export default Sentry.wrap(App);