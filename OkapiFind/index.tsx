import { registerRootComponent } from 'expo';
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

// Import all the modules that passed
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

// Test stages
type TestStage =
  | 'initial'
  | 'safearea'
  | 'navigation'
  | 'errorBoundary'
  | 'firebaseGuard'
  | 'fullApp';

const RenderTest: React.FC = () => {
  const [stage, setStage] = useState<TestStage>('initial');
  const [error, setError] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<{stage: string; status: string}[]>([]);

  const addResult = (stageName: string, status: string) => {
    setTestResults(prev => [...prev, { stage: stageName, status }]);
  };

  const runTest = async (testStage: TestStage) => {
    try {
      setStage(testStage);
      addResult(testStage, '✅ Rendered');
    } catch (e: any) {
      setError(`Stage "${testStage}" failed: ${e.message}`);
      addResult(testStage, `❌ ${e.message}`);
    }
  };

  // Initial test content
  if (stage === 'initial') {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.title}>Render Test</Text>
          <Text style={styles.subtitle}>Testing component rendering stages</Text>

          <TouchableOpacity style={styles.button} onPress={() => runTest('safearea')}>
            <Text style={styles.buttonText}>Test 1: SafeAreaProvider</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.button} onPress={() => runTest('navigation')}>
            <Text style={styles.buttonText}>Test 2: NavigationContainer</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.button} onPress={() => runTest('errorBoundary')}>
            <Text style={styles.buttonText}>Test 3: ErrorBoundary</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.button} onPress={() => runTest('firebaseGuard')}>
            <Text style={styles.buttonText}>Test 4: FirebaseConfigGuard</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.button, styles.primaryButton]} onPress={() => runTest('fullApp')}>
            <Text style={styles.buttonText}>Test 5: Full App (MapScreen)</Text>
          </TouchableOpacity>

          {testResults.map((result, i) => (
            <View key={i} style={styles.resultRow}>
              <Text style={styles.resultText}>{result.stage}: {result.status}</Text>
            </View>
          ))}

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
        </ScrollView>
      </View>
    );
  }

  // Test SafeAreaProvider
  if (stage === 'safearea') {
    return (
      <SafeAreaProvider>
        <View style={styles.container}>
          <Text style={styles.success}>✅ SafeAreaProvider works!</Text>
          <TouchableOpacity style={styles.button} onPress={() => setStage('initial')}>
            <Text style={styles.buttonText}>Back to Tests</Text>
          </TouchableOpacity>
        </View>
        <StatusBar style="auto" />
      </SafeAreaProvider>
    );
  }

  // Test NavigationContainer
  if (stage === 'navigation') {
    return (
      <SafeAreaProvider>
        <NavigationContainer>
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Test">
              {() => (
                <View style={styles.container}>
                  <Text style={styles.success}>✅ NavigationContainer works!</Text>
                  <TouchableOpacity style={styles.button} onPress={() => setStage('initial')}>
                    <Text style={styles.buttonText}>Back to Tests</Text>
                  </TouchableOpacity>
                </View>
              )}
            </Stack.Screen>
          </Stack.Navigator>
        </NavigationContainer>
        <StatusBar style="auto" />
      </SafeAreaProvider>
    );
  }

  // Test ErrorBoundary
  if (stage === 'errorBoundary') {
    return (
      <ErrorBoundary screenName="Test">
        <SafeAreaProvider>
          <View style={styles.container}>
            <Text style={styles.success}>✅ ErrorBoundary works!</Text>
            <TouchableOpacity style={styles.button} onPress={() => setStage('initial')}>
              <Text style={styles.buttonText}>Back to Tests</Text>
            </TouchableOpacity>
          </View>
          <StatusBar style="auto" />
        </SafeAreaProvider>
      </ErrorBoundary>
    );
  }

  // Test FirebaseConfigGuard
  if (stage === 'firebaseGuard') {
    return (
      <SafeAreaProvider>
        <FirebaseConfigGuard>
          <View style={styles.container}>
            <Text style={styles.success}>✅ FirebaseConfigGuard works!</Text>
            <TouchableOpacity style={styles.button} onPress={() => setStage('initial')}>
              <Text style={styles.buttonText}>Back to Tests</Text>
            </TouchableOpacity>
          </View>
        </FirebaseConfigGuard>
        <StatusBar style="auto" />
      </SafeAreaProvider>
    );
  }

  // Test Full App with MapScreen
  if (stage === 'fullApp') {
    return (
      <ErrorBoundary screenName="App">
        <SafeAreaProvider>
          <OfflineIndicator />
          <NavigationContainer>
            <Stack.Navigator
              initialRouteName="Map"
              screenOptions={{
                headerStyle: { backgroundColor: Colors.background },
                headerTintColor: Colors.primary,
              }}
            >
              <Stack.Screen
                name="Map"
                component={MapScreen}
                options={{
                  title: 'OkapiFind',
                  headerTitleAlign: 'center',
                  headerRight: () => (
                    <TouchableOpacity style={{ marginRight: 16 }}>
                      <Text style={{ color: Colors.primary, fontSize: 28 }}>⚙</Text>
                    </TouchableOpacity>
                  ),
                }}
              />
              <Stack.Screen name="Guidance" component={GuidanceScreen} />
              <Stack.Screen name="Settings" component={SettingsScreen} />
              <Stack.Screen name="Legal" component={LegalScreen} />
              <Stack.Screen name="Paywall" component={PaywallScreen} />
            </Stack.Navigator>
          </NavigationContainer>
          <StatusBar style="auto" />
        </SafeAreaProvider>
      </ErrorBoundary>
    );
  }

  return null;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F1B2A',
    paddingTop: 60,
  },
  scroll: {
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFD700',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 30,
  },
  button: {
    backgroundColor: '#2a3a4a',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  primaryButton: {
    backgroundColor: '#FFD700',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    textAlign: 'center',
    fontWeight: '600',
  },
  success: {
    fontSize: 24,
    color: '#00FF00',
    textAlign: 'center',
    marginBottom: 20,
  },
  resultRow: {
    backgroundColor: '#1a2a3a',
    padding: 10,
    borderRadius: 6,
    marginTop: 8,
  },
  resultText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  errorBox: {
    backgroundColor: '#3a1a1a',
    padding: 15,
    borderRadius: 8,
    marginTop: 20,
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 14,
  },
});

registerRootComponent(RenderTest);
