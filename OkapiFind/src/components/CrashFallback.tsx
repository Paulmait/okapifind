import React, { Component, ReactNode } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Share,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { writeAsStringAsync, documentDirectory } from 'expo-file-system/legacy';
import * as Application from 'expo-application';
import Constants from 'expo-constants';

interface CrashFallbackState {
  hasError: boolean;
  error: Error | null;
  errorInfo: any;
  crashId: string;
  isReporting: boolean;
  reportSent: boolean;
  showDetails: boolean;
}

interface CrashFallbackProps {
  children: ReactNode;
  onError?: (error: Error, errorInfo: any) => void;
  enableCrashReporting?: boolean;
  showErrorDetails?: boolean;
  customHeader?: string;
  customMessage?: string;
}

interface CrashReport {
  crashId: string;
  timestamp: number;
  appVersion: string;
  platform: string;
  error: {
    name: string;
    message: string;
    stack?: string;
  };
  deviceInfo: {
    platform: string;
    platformVersion: string;
    deviceModel?: string;
    appVersion: string;
    buildNumber: string;
  };
  userActions: string[];
  memoryUsage?: any;
  networkStatus?: string;
}

class CrashFallback extends Component<CrashFallbackProps, CrashFallbackState> {
  private readonly STORAGE_KEYS = {
    CRASH_REPORTS: '@Crash:reports',
    USER_ACTIONS: '@Crash:userActions',
    CRASH_COUNT: '@Crash:count',
  };

  constructor(props: CrashFallbackProps) {
    super(props);

    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      crashId: '',
      isReporting: false,
      reportSent: false,
      showDetails: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<CrashFallbackState> {
    // Update state so the next render will show the fallback UI
    const crashId = `crash_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return {
      hasError: true,
      error,
      crashId,
    };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('Crash boundary caught an error:', error, errorInfo);

    this.setState({
      error,
      errorInfo,
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Auto-generate crash report
    this.generateCrashReport(error);
  }

  private generateCrashReport = async (error: Error): Promise<void> => {
    try {
      const userActions = await this.getUserActions();
      const deviceInfo = await this.getDeviceInfo();

      const crashReport: CrashReport = {
        crashId: this.state.crashId,
        timestamp: Date.now(),
        appVersion: Constants.expoConfig?.version || '1.0.0',
        platform: Platform.OS,
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
        deviceInfo,
        userActions: userActions.slice(-10), // Last 10 actions
        networkStatus: await this.getNetworkStatus(),
      };

      // Save crash report locally
      await this.saveCrashReport(crashReport);

      // Increment crash count
      await this.incrementCrashCount();

      console.log('Crash report generated:', crashReport.crashId);
    } catch (reportError) {
      console.error('Failed to generate crash report:', reportError);
    }
  };

  private getDeviceInfo = async (): Promise<CrashReport['deviceInfo']> => {
    try {
      return {
        platform: Platform.OS,
        platformVersion: Platform.Version.toString(),
        deviceModel: await this.getDeviceModel(),
        appVersion: Constants.expoConfig?.version || '1.0.0',
        buildNumber: Constants.expoConfig?.ios?.buildNumber ||
                     Constants.expoConfig?.android?.versionCode?.toString() || '1',
      };
    } catch (error) {
      console.error('Error getting device info:', error);
      return {
        platform: Platform.OS,
        platformVersion: 'unknown',
        appVersion: '1.0.0',
        buildNumber: '1',
      };
    }
  };

  private getDeviceModel = async (): Promise<string> => {
    try {
      if (Platform.OS === 'ios') {
        return await Application.getIosIdForVendorAsync() || 'Unknown iOS Device';
      } else {
        return 'Android Device';
      }
    } catch {
      return 'Unknown Device';
    }
  };

  private getUserActions = async (): Promise<string[]> => {
    try {
      const stored = await AsyncStorage.getItem(this.STORAGE_KEYS.USER_ACTIONS);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  };

  private getNetworkStatus = async (): Promise<string> => {
    try {
      // Simple connectivity test
      const response = await fetch('https://www.google.com', {
        method: 'HEAD',
        cache: 'no-cache',
      });
      return response.ok ? 'connected' : 'disconnected';
    } catch {
      return 'disconnected';
    }
  };

  private saveCrashReport = async (report: CrashReport): Promise<void> => {
    try {
      const stored = await AsyncStorage.getItem(this.STORAGE_KEYS.CRASH_REPORTS);
      const reports = stored ? JSON.parse(stored) : [];

      reports.push(report);

      // Keep only last 20 crash reports to prevent storage bloat
      const trimmedReports = reports.slice(-20);

      await AsyncStorage.setItem(this.STORAGE_KEYS.CRASH_REPORTS, JSON.stringify(trimmedReports));
    } catch (error) {
      console.error('Failed to save crash report:', error);
    }
  };

  private incrementCrashCount = async (): Promise<void> => {
    try {
      const stored = await AsyncStorage.getItem(this.STORAGE_KEYS.CRASH_COUNT);
      const count = stored ? parseInt(stored, 10) : 0;
      await AsyncStorage.setItem(this.STORAGE_KEYS.CRASH_COUNT, (count + 1).toString());
    } catch (error) {
      console.error('Failed to increment crash count:', error);
    }
  };

  private handleRestart = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      crashId: '',
      isReporting: false,
      reportSent: false,
      showDetails: false,
    });
  };

  private handleSendReport = async (): Promise<void> => {
    if (!this.props.enableCrashReporting) {
      Alert.alert('Reporting Disabled', 'Crash reporting is currently disabled.');
      return;
    }

    this.setState({ isReporting: true });

    try {
      const report = await this.getCurrentCrashReport();
      if (report) {
        await this.sendCrashReport(report);
        this.setState({ reportSent: true });
        Alert.alert('Report Sent', 'Thank you for helping us improve the app!');
      }
    } catch (error) {
      console.error('Failed to send crash report:', error);
      Alert.alert('Error', 'Failed to send crash report. Please try again later.');
    } finally {
      this.setState({ isReporting: false });
    }
  };

  private getCurrentCrashReport = async (): Promise<CrashReport | null> => {
    try {
      const stored = await AsyncStorage.getItem(this.STORAGE_KEYS.CRASH_REPORTS);
      if (!stored) return null;

      const reports: CrashReport[] = JSON.parse(stored);
      return reports.find(r => r.crashId === this.state.crashId) || null;
    } catch {
      return null;
    }
  };

  private sendCrashReport = async (report: CrashReport): Promise<void> => {
    try {
      // In a real app, you would send this to your crash reporting service
      // For example: Sentry, Crashlytics, Bugsnag, etc.

      // For demonstration, we'll just create a shareable report
      const reportText = this.formatReportForSharing(report);

      // Save to file and share
      const fileName = `crash_report_${report.crashId}.txt`;
      const filePath = `${documentDirectory}${fileName}`;

      await writeAsStringAsync(filePath, reportText);

      await Share.share({
        url: filePath,
        title: 'OkapiFind Crash Report',
        message: 'Crash report from OkapiFind app',
      });

      console.log('Crash report sent:', report.crashId);
    } catch (error) {
      console.error('Failed to send crash report:', error);
      throw error;
    }
  };

  private formatReportForSharing = (report: CrashReport): string => {
    return `
OkapiFind Crash Report
=====================

Crash ID: ${report.crashId}
Timestamp: ${new Date(report.timestamp).toISOString()}
App Version: ${report.appVersion}
Platform: ${report.platform}

Device Information:
- Platform: ${report.deviceInfo.platform}
- Platform Version: ${report.deviceInfo.platformVersion}
- Device Model: ${report.deviceInfo.deviceModel || 'Unknown'}
- Build Number: ${report.deviceInfo.buildNumber}

Error Details:
- Name: ${report.error.name}
- Message: ${report.error.message}
- Stack Trace:
${report.error.stack || 'No stack trace available'}

Recent User Actions:
${report.userActions.map((action, index) => `${index + 1}. ${action}`).join('\n')}

Network Status: ${report.networkStatus || 'Unknown'}

Generated by OkapiFind Error Boundary
    `.trim();
  };

  private toggleDetails = (): void => {
    this.setState(prevState => ({
      showDetails: !prevState.showDetails,
    }));
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const { error, showDetails, isReporting, reportSent } = this.state;
    const { customHeader, customMessage, showErrorDetails = __DEV__ } = this.props;

    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.content}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>
                {customHeader || 'Oops! Something went wrong'}
              </Text>
              <Text style={styles.subtitle}>
                {customMessage || 'The app encountered an unexpected error and needs to restart.'}
              </Text>
            </View>

            {/* Error Details (Development/Debug) */}
            {showErrorDetails && error && (
              <View style={styles.errorSection}>
                <TouchableOpacity
                  style={styles.detailsToggle}
                  onPress={this.toggleDetails}
                >
                  <Text style={styles.detailsToggleText}>
                    {showDetails ? 'Hide' : 'Show'} Error Details
                  </Text>
                </TouchableOpacity>

                {showDetails && (
                  <View style={styles.errorDetails}>
                    <Text style={styles.errorText}>
                      {error.name}: {error.message}
                    </Text>
                    {error.stack && (
                      <ScrollView
                        style={styles.stackTrace}
                        showsVerticalScrollIndicator={true}
                      >
                        <Text style={styles.stackText}>{error.stack}</Text>
                      </ScrollView>
                    )}
                  </View>
                )}
              </View>
            )}

            {/* Actions */}
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.button, styles.primaryButton]}
                onPress={this.handleRestart}
              >
                <Text style={styles.buttonTextPrimary}>Restart App</Text>
              </TouchableOpacity>

              {this.props.enableCrashReporting && (
                <TouchableOpacity
                  style={[
                    styles.button,
                    styles.secondaryButton,
                    reportSent && styles.disabledButton,
                  ]}
                  onPress={this.handleSendReport}
                  disabled={isReporting || reportSent}
                >
                  <Text style={styles.buttonTextSecondary}>
                    {isReporting
                      ? 'Sending Report...'
                      : reportSent
                      ? 'Report Sent ✓'
                      : 'Send Error Report'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Recovery Tips */}
            <View style={styles.tips}>
              <Text style={styles.tipsTitle}>What you can try:</Text>
              <Text style={styles.tipText}>• Restart the app by tapping the button above</Text>
              <Text style={styles.tipText}>• Check your internet connection</Text>
              <Text style={styles.tipText}>• Update the app if available</Text>
              <Text style={styles.tipText}>• Contact support if the problem persists</Text>
            </View>

            {/* Footer */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>
                Error ID: {this.state.crashId}
              </Text>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  content: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 22,
  },
  errorSection: {
    marginBottom: 24,
  },
  detailsToggle: {
    padding: 12,
    backgroundColor: '#f1f3f4',
    borderRadius: 8,
    alignItems: 'center',
  },
  detailsToggleText: {
    fontSize: 14,
    color: '#1976d2',
    fontWeight: '500',
  },
  errorDetails: {
    marginTop: 12,
    padding: 16,
    backgroundColor: '#fff3cd',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#ffb74d',
  },
  errorText: {
    fontSize: 14,
    color: '#d84315',
    fontWeight: '500',
    marginBottom: 8,
  },
  stackTrace: {
    maxHeight: 150,
    backgroundColor: '#f5f5f5',
    borderRadius: 4,
    padding: 8,
  },
  stackText: {
    fontSize: 12,
    color: '#333333',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    lineHeight: 16,
  },
  actions: {
    marginBottom: 24,
  },
  button: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButton: {
    backgroundColor: '#1976d2',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#1976d2',
  },
  disabledButton: {
    backgroundColor: '#e0e0e0',
    borderColor: '#e0e0e0',
  },
  buttonTextPrimary: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonTextSecondary: {
    color: '#1976d2',
    fontSize: 16,
    fontWeight: '600',
  },
  tips: {
    marginBottom: 24,
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  tipText: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
    marginBottom: 4,
  },
  footer: {
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  footerText: {
    fontSize: 12,
    color: '#999999',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
});

export default CrashFallback;