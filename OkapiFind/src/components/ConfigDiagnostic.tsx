/**
 * Configuration Diagnostic Screen
 * Shows which environment variables are configured
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native';
import { Colors } from '../constants/colors';

export function ConfigDiagnostic() {
  const checks = [
    { name: 'Platform', value: Platform.OS, required: true },
    { name: 'EXPO_PUBLIC_FIREBASE_API_KEY', value: process.env.EXPO_PUBLIC_FIREBASE_API_KEY, required: true },
    { name: 'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN', value: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN, required: true },
    { name: 'EXPO_PUBLIC_FIREBASE_PROJECT_ID', value: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID, required: true },
    { name: 'EXPO_PUBLIC_FIREBASE_APP_ID', value: process.env.EXPO_PUBLIC_FIREBASE_APP_ID, required: true },
    { name: 'EXPO_PUBLIC_SUPABASE_URL', value: process.env.EXPO_PUBLIC_SUPABASE_URL, required: true },
    { name: 'EXPO_PUBLIC_SUPABASE_ANON_KEY', value: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY, required: true },
    { name: 'EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN', value: process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN, required: true },
    { name: 'EXPO_PUBLIC_GOOGLE_MAPS_API_KEY', value: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY, required: false },
    { name: 'EXPO_PUBLIC_GOOGLE_CLIENT_ID', value: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID, required: false },
    { name: 'EXPO_PUBLIC_GEMINI_API_KEY', value: process.env.EXPO_PUBLIC_GEMINI_API_KEY, required: false },
  ];

  const missingRequired = checks.filter(c => c.required && !c.value);
  const hasAllRequired = missingRequired.length === 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>🔧 OkapiFind Configuration</Text>
        <Text style={[styles.status, hasAllRequired ? styles.statusOk : styles.statusError]}>
          {hasAllRequired ? '✅ Configuration Complete' : '❌ Missing Required Variables'}
        </Text>
      </View>

      {!hasAllRequired && (
        <View style={styles.warning}>
          <Text style={styles.warningTitle}>⚠️ Configuration Required</Text>
          <Text style={styles.warningText}>
            The app cannot function without required environment variables.
          </Text>
          <Text style={styles.warningText}>
            Please add the missing variables to your Vercel dashboard with the EXPO_PUBLIC_ prefix.
          </Text>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Environment Variables</Text>
        {checks.map((check, index) => {
          const isConfigured = !!check.value;
          const truncatedValue = check.value
            ? `${check.value.substring(0, 20)}${check.value.length > 20 ? '...' : ''}`
            : 'NOT SET';

          return (
            <View key={index} style={styles.checkRow}>
              <Text style={styles.checkIcon}>
                {isConfigured ? '✅' : check.required ? '❌' : '⚠️'}
              </Text>
              <View style={styles.checkInfo}>
                <Text style={styles.checkName}>{check.name}</Text>
                <Text style={[
                  styles.checkValue,
                  !isConfigured && check.required && styles.checkValueError
                ]}>
                  {truncatedValue}
                </Text>
              </View>
              {check.required && <Text style={styles.badge}>REQUIRED</Text>}
            </View>
          );
        })}
      </View>

      {missingRequired.length > 0 && (
        <View style={styles.instructions}>
          <Text style={styles.instructionsTitle}>📋 Missing Required Variables:</Text>
          {missingRequired.map((check, index) => (
            <Text key={index} style={styles.instructionItem}>
              • {check.name}
            </Text>
          ))}

          <Text style={styles.instructionsTitle}>🔧 How to Fix:</Text>
          <Text style={styles.instructionItem}>
            1. Go to Vercel Dashboard → Settings → Environment Variables
          </Text>
          <Text style={styles.instructionItem}>
            2. Add each missing variable with EXPO_PUBLIC_ prefix
          </Text>
          <Text style={styles.instructionItem}>
            3. Set Environment: Production, Preview, Development
          </Text>
          <Text style={styles.instructionItem}>
            4. Click "Redeploy" after adding all variables
          </Text>
        </View>
      )}

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          This diagnostic screen will automatically disappear once all required variables are configured.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    padding: 20,
  },
  header: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 8,
  },
  status: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
  },
  statusOk: {
    color: '#22c55e',
  },
  statusError: {
    color: '#ef4444',
  },
  warning: {
    backgroundColor: '#fef3c7',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
  },
  warningTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#78350f',
    marginBottom: 8,
  },
  warningText: {
    fontSize: 14,
    color: '#78350f',
    marginBottom: 4,
    lineHeight: 20,
  },
  section: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 16,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  checkIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  checkInfo: {
    flex: 1,
  },
  checkName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  checkValue: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  checkValueError: {
    color: '#ef4444',
    fontWeight: '600',
  },
  badge: {
    fontSize: 10,
    fontWeight: '600',
    color: '#ef4444',
    backgroundColor: '#fee2e2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  instructions: {
    backgroundColor: '#dbeafe',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
  },
  instructionsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e40af',
    marginTop: 12,
    marginBottom: 8,
  },
  instructionItem: {
    fontSize: 14,
    color: '#1e40af',
    marginBottom: 4,
    lineHeight: 20,
  },
  footer: {
    padding: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  footerText: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
});
