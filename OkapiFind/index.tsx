import { registerRootComponent } from 'expo';
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';

// Test imports one by one - uncomment to test
const importTests: { name: string; status: string }[] = [];

// Test 1: Navigation
try {
  require('@react-navigation/native');
  require('@react-navigation/stack');
  importTests.push({ name: 'Navigation', status: '✅' });
} catch (e: any) {
  importTests.push({ name: 'Navigation', status: `❌ ${e.message}` });
}

// Test 2: SafeAreaProvider
try {
  require('react-native-safe-area-context');
  importTests.push({ name: 'SafeAreaContext', status: '✅' });
} catch (e: any) {
  importTests.push({ name: 'SafeAreaContext', status: `❌ ${e.message}` });
}

// Test 3: Colors
try {
  require('./src/constants/colors');
  importTests.push({ name: 'Colors', status: '✅' });
} catch (e: any) {
  importTests.push({ name: 'Colors', status: `❌ ${e.message}` });
}

// Test 4: Firebase config
try {
  require('./src/config/firebase');
  importTests.push({ name: 'Firebase', status: '✅' });
} catch (e: any) {
  importTests.push({ name: 'Firebase', status: `❌ ${e.message}` });
}

// Test 5: Analytics
try {
  require('./src/services/analytics');
  importTests.push({ name: 'Analytics', status: '✅' });
} catch (e: any) {
  importTests.push({ name: 'Analytics', status: `❌ ${e.message}` });
}

// Test 6: Performance
try {
  require('./src/services/performance');
  importTests.push({ name: 'Performance', status: '✅' });
} catch (e: any) {
  importTests.push({ name: 'Performance', status: `❌ ${e.message}` });
}

// Test 7: Feature Flags
try {
  require('./src/services/featureFlags');
  importTests.push({ name: 'FeatureFlags', status: '✅' });
} catch (e: any) {
  importTests.push({ name: 'FeatureFlags', status: `❌ ${e.message}` });
}

// Test 8: Offline Mode
try {
  require('./src/services/offlineMode');
  importTests.push({ name: 'OfflineMode', status: '✅' });
} catch (e: any) {
  importTests.push({ name: 'OfflineMode', status: `❌ ${e.message}` });
}

// Test 9: i18n
try {
  require('./src/i18n');
  importTests.push({ name: 'i18n', status: '✅' });
} catch (e: any) {
  importTests.push({ name: 'i18n', status: `❌ ${e.message}` });
}

// Test 10: Auth hook
try {
  require('./src/hooks/useAuth');
  importTests.push({ name: 'useAuth', status: '✅' });
} catch (e: any) {
  importTests.push({ name: 'useAuth', status: `❌ ${e.message}` });
}

// Test 11: RevenueCat
try {
  require('./src/hooks/useRevenueCat');
  importTests.push({ name: 'RevenueCat', status: '✅' });
} catch (e: any) {
  importTests.push({ name: 'RevenueCat', status: `❌ ${e.message}` });
}

// Test 12: Error Boundary
try {
  require('./src/services/errorBoundary');
  importTests.push({ name: 'ErrorBoundary', status: '✅' });
} catch (e: any) {
  importTests.push({ name: 'ErrorBoundary', status: `❌ ${e.message}` });
}

// Test 13: Cross Platform Sync
try {
  require('./src/services/crossPlatformSync');
  importTests.push({ name: 'CrossPlatformSync', status: '✅' });
} catch (e: any) {
  importTests.push({ name: 'CrossPlatformSync', status: `❌ ${e.message}` });
}

// Test 14: Lazy Components
try {
  require('./src/utils/lazyComponents');
  importTests.push({ name: 'LazyComponents', status: '✅' });
} catch (e: any) {
  importTests.push({ name: 'LazyComponents', status: `❌ ${e.message}` });
}

// Test 15: Supabase
try {
  require('./src/lib/supabase-client');
  importTests.push({ name: 'Supabase', status: '✅' });
} catch (e: any) {
  importTests.push({ name: 'Supabase', status: `❌ ${e.message}` });
}

// Test 16: Components
try {
  require('./src/components/FirebaseConfigGuard');
  require('./src/components/OfflineIndicator');
  importTests.push({ name: 'Components', status: '✅' });
} catch (e: any) {
  importTests.push({ name: 'Components', status: `❌ ${e.message}` });
}

const DiagnosticApp: React.FC = () => {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  const failedTests = importTests.filter(t => t.status.startsWith('❌'));
  const passedTests = importTests.filter(t => t.status === '✅');

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>OkapiFind Diagnostic</Text>
        <Text style={styles.subtitle}>Import Test Results</Text>

        <Text style={styles.summary}>
          ✅ Passed: {passedTests.length} | ❌ Failed: {failedTests.length}
        </Text>

        {importTests.map((test, index) => (
          <View key={index} style={styles.testRow}>
            <Text style={[
              styles.testName,
              test.status.startsWith('❌') && styles.failed
            ]}>
              {test.status.startsWith('✅') ? '✅' : '❌'} {test.name}
            </Text>
            {test.status.startsWith('❌') && (
              <Text style={styles.errorText}>{test.status.slice(2)}</Text>
            )}
          </View>
        ))}

        {failedTests.length === 0 && (
          <Text style={styles.success}>
            All imports passed! The issue may be in component rendering.
          </Text>
        )}
      </ScrollView>
    </View>
  );
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
    marginBottom: 20,
  },
  summary: {
    fontSize: 14,
    color: '#AAAAAA',
    textAlign: 'center',
    marginBottom: 20,
    padding: 10,
    backgroundColor: '#1a2a3a',
    borderRadius: 8,
  },
  testRow: {
    marginBottom: 12,
    padding: 10,
    backgroundColor: '#1a2a3a',
    borderRadius: 8,
  },
  testName: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  failed: {
    color: '#FF6B6B',
  },
  errorText: {
    fontSize: 11,
    color: '#FF6B6B',
    marginTop: 4,
    fontFamily: 'monospace',
  },
  success: {
    fontSize: 16,
    color: '#00FF00',
    textAlign: 'center',
    marginTop: 20,
    padding: 15,
    backgroundColor: '#1a3a1a',
    borderRadius: 8,
  },
});

registerRootComponent(DiagnosticApp);
