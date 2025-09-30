/**
 * Firebase Configuration Guard
 * Shows graceful error if Firebase is not configured
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { isFirebaseConfigured } from '../config/firebase';
import { Colors } from '../constants/colors';

interface FirebaseConfigGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function FirebaseConfigGuard({ children, fallback }: FirebaseConfigGuardProps) {
  const configured = isFirebaseConfigured();

  if (!configured) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.icon}>⚠️</Text>
          <Text style={styles.title}>Authentication Not Configured</Text>
          <Text style={styles.message}>
            Firebase authentication is not set up yet. Please add your Firebase credentials to continue.
          </Text>

          <View style={styles.steps}>
            <Text style={styles.stepTitle}>To fix this:</Text>
            <Text style={styles.step}>1. Create a Firebase project at console.firebase.google.com</Text>
            <Text style={styles.step}>2. Copy your Firebase configuration</Text>
            <Text style={styles.step}>3. Add credentials to your .env file</Text>
            <Text style={styles.step}>4. Restart the app</Text>
          </View>

          {__DEV__ && (
            <TouchableOpacity
              style={styles.button}
              onPress={() => Linking.openURL('https://console.firebase.google.com')}
            >
              <Text style={styles.buttonText}>Open Firebase Console</Text>
            </TouchableOpacity>
          )}

          <Text style={styles.hint}>
            {__DEV__ ? 'Running in development mode' : 'Please contact support'}
          </Text>
        </View>
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
    padding: 20,
  },
  card: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 16,
    padding: 24,
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  icon: {
    fontSize: 64,
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  steps: {
    alignSelf: 'stretch',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 8,
  },
  step: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 4,
    paddingLeft: 8,
  },
  button: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  buttonText: {
    color: Colors.background,
    fontSize: 16,
    fontWeight: '600',
  },
  hint: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
});