import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TouchableOpacity, Text, Platform, View, ActivityIndicator, StyleSheet } from 'react-native';

import MapScreen from './src/screens/MapScreen';
import GuidanceScreen from './src/screens/GuidanceScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import LegalScreen from './src/screens/LegalScreen';
import PaywallScreen from './src/screens/PaywallScreen';
import AuthScreen from './src/screens/AuthScreen';
import { RootStackParamList } from './src/types/navigation';
import { Colors } from './src/constants/colors';
import { analytics } from './src/services/analytics';
import { useAuth } from './src/hooks/useAuth';

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
  const { isLoading, isAuthenticated, isReady } = useAuth();

  useEffect(() => {
    // Initialize analytics on app start
    analytics.initialize();
  }, []);

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
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar style="auto" />
        {isAuthenticated ? <MainNavigator /> : <AuthNavigator />}
      </NavigationContainer>
    </SafeAreaProvider>
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