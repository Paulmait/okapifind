import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { feedbackService } from './feedback';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  userId?: string;
  screenName?: string;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });

    console.error('Error caught by boundary:', error, errorInfo);

    // Build error context
    const context = {
      userId: this.props.userId || 'anonymous',
      screenName: this.props.screenName || 'unknown',
      timestamp: new Date().toISOString(),
      appVersion: '1.0.0',
      platform: Platform.OS,
      platformVersion: Platform.Version,
      errorBoundary: true,
      componentStack: errorInfo.componentStack,
    };

    // Auto-submit crash report with context
    feedbackService.submitFeedback({
      type: 'bug',
      subject: 'App Crash',
      message: `${error.message}\n\nStack: ${error.stack}\n\nContext: ${JSON.stringify(context, null, 2)}`,
      includeDeviceInfo: true,
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <View style={styles.container}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message}>
            The app encountered an error. We've been notified and will fix it soon.
          </Text>
          <TouchableOpacity
            style={styles.button}
            onPress={() => this.setState({ hasError: false })}
          >
            <Text style={styles.buttonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    color: '#666',
  },
  button: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});