/**
 * Centralized Error Handling and Logging Service
 * Provides comprehensive error tracking, logging, and reporting
 */

import * as Sentry from 'sentry-expo';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum ErrorCategory {
  NETWORK = 'network',
  AUTH = 'auth',
  VALIDATION = 'validation',
  PERMISSION = 'permission',
  STORAGE = 'storage',
  NAVIGATION = 'navigation',
  PAYMENT = 'payment',
  GENERAL = 'general',
}

export interface ErrorContext {
  userId?: string;
  screen?: string;
  action?: string;
  metadata?: Record<string, any>;
}

export interface ErrorLog {
  id: string;
  timestamp: Date;
  message: string;
  stack?: string;
  severity: ErrorSeverity;
  category: ErrorCategory;
  context?: ErrorContext;
  platform: string;
  version: string;
}

class ErrorService {
  private errorLogs: ErrorLog[] = [];
  private maxLocalLogs = 100;
  private isInitialized = false;
  private userId: string | null = null;
  private currentScreen: string | null = null;

  /**
   * Initialize error service and Sentry
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Initialize Sentry
      const sentryDsn = Constants.expoConfig?.extra?.sentryDsn;
      if (sentryDsn) {
        Sentry.init({
          dsn: sentryDsn,
          enableInExpoDevelopment: false,
          debug: __DEV__,
          environment: __DEV__ ? 'development' : 'production',
          tracesSampleRate: __DEV__ ? 1.0 : 0.1,
          beforeSend: (event) => {
            // Sanitize sensitive data
            if (event.request?.cookies) {
              delete event.request.cookies;
            }
            if (event.request?.headers) {
              delete event.request.headers['authorization'];
            }
            return event;
          },
        });
      }

      // Load cached error logs
      await this.loadCachedLogs();

      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize error service:', error);
    }
  }

  /**
   * Set user context for error tracking
   */
  setUser(userId: string | null, email?: string): void {
    this.userId = userId;

    if (userId) {
      Sentry.Native.setUser({ id: userId, email });
    } else {
      Sentry.Native.setUser(null);
    }
  }

  /**
   * Set current screen for context
   */
  setCurrentScreen(screen: string): void {
    this.currentScreen = screen;
    Sentry.Native.addBreadcrumb({
      message: `Navigated to ${screen}`,
      category: 'navigation',
      level: 'info',
    });
  }

  /**
   * Log and handle errors
   */
  async logError(
    error: Error | unknown,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    category: ErrorCategory = ErrorCategory.GENERAL,
    context?: ErrorContext
  ): Promise<void> {
    try {
      const errorMessage = this.extractErrorMessage(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      // Create error log entry
      const errorLog: ErrorLog = {
        id: this.generateErrorId(),
        timestamp: new Date(),
        message: errorMessage,
        stack: errorStack,
        severity,
        category,
        context: {
          ...context,
          userId: context?.userId || this.userId || undefined,
          screen: context?.screen || this.currentScreen || undefined,
        },
        platform: Platform.OS,
        version: Constants.expoConfig?.version || 'unknown',
      };

      // Add to local logs
      this.errorLogs.unshift(errorLog);
      if (this.errorLogs.length > this.maxLocalLogs) {
        this.errorLogs = this.errorLogs.slice(0, this.maxLocalLogs);
      }

      // Save to local storage
      await this.saveCachedLogs();

      // Send to Sentry based on severity
      if (severity === ErrorSeverity.HIGH || severity === ErrorSeverity.CRITICAL) {
        this.sendToSentry(error, errorLog);
      }

      // Log to console in development
      if (__DEV__) {
        console.error(`[${severity.toUpperCase()}] ${category}:`, errorMessage, context);
        if (errorStack) {
          console.error('Stack trace:', errorStack);
        }
      }

      // Handle critical errors
      if (severity === ErrorSeverity.CRITICAL) {
        await this.handleCriticalError(errorLog);
      }
    } catch (loggingError) {
      console.error('Error in error logging:', loggingError);
    }
  }

  /**
   * Log warning
   */
  logWarning(message: string, context?: ErrorContext): void {
    if (__DEV__) {
      console.warn(message, context);
    }

    Sentry.Native.addBreadcrumb({
      message,
      category: 'warning',
      level: 'warning',
      data: context?.metadata,
    });
  }

  /**
   * Log info
   */
  logInfo(message: string, context?: ErrorContext): void {
    if (__DEV__) {
      console.log(message, context);
    }

    Sentry.Native.addBreadcrumb({
      message,
      category: 'info',
      level: 'info',
      data: context?.metadata,
    });
  }

  /**
   * Handle network errors
   */
  handleNetworkError(error: Error, endpoint?: string): string {
    this.logError(error, ErrorSeverity.MEDIUM, ErrorCategory.NETWORK, {
      metadata: { endpoint },
    });

    // Return user-friendly message
    if (error.message.includes('Network request failed')) {
      return 'No internet connection. Please check your network and try again.';
    }
    if (error.message.includes('timeout')) {
      return 'Request timed out. Please try again.';
    }
    return 'Network error occurred. Please try again later.';
  }

  /**
   * Handle authentication errors
   */
  handleAuthError(error: Error): string {
    this.logError(error, ErrorSeverity.HIGH, ErrorCategory.AUTH);

    // Return user-friendly message
    if (error.message.includes('password')) {
      return 'Invalid credentials. Please check your email and password.';
    }
    if (error.message.includes('token')) {
      return 'Your session has expired. Please sign in again.';
    }
    return 'Authentication failed. Please try again.';
  }

  /**
   * Handle validation errors
   */
  handleValidationError(field: string, message: string): string {
    this.logError(
      new Error(`Validation failed: ${field} - ${message}`),
      ErrorSeverity.LOW,
      ErrorCategory.VALIDATION,
      { metadata: { field } }
    );

    return message;
  }

  /**
   * Handle permission errors
   */
  handlePermissionError(permission: string): string {
    this.logError(
      new Error(`Permission denied: ${permission}`),
      ErrorSeverity.MEDIUM,
      ErrorCategory.PERMISSION,
      { metadata: { permission } }
    );

    return `Permission required: ${permission}. Please enable it in your settings.`;
  }

  /**
   * Get error logs
   */
  getErrorLogs(category?: ErrorCategory, limit: number = 50): ErrorLog[] {
    let logs = this.errorLogs;

    if (category) {
      logs = logs.filter(log => log.category === category);
    }

    return logs.slice(0, limit);
  }

  /**
   * Clear error logs
   */
  async clearErrorLogs(): Promise<void> {
    this.errorLogs = [];
    await AsyncStorage.removeItem('error_logs');
  }

  /**
   * Export error logs
   */
  exportErrorLogs(): string {
    return JSON.stringify(this.errorLogs, null, 2);
  }

  /**
   * Private helper methods
   */

  private extractErrorMessage(error: Error | unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'string') {
      return error;
    }
    if (error && typeof error === 'object' && 'message' in error) {
      return String(error.message);
    }
    return 'An unexpected error occurred';
  }

  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private sendToSentry(error: Error | unknown, errorLog: ErrorLog): void {
    if (!this.isInitialized) return;

    Sentry.Native.withScope((scope) => {
      scope.setLevel(this.mapSeverityToSentryLevel(errorLog.severity));
      scope.setTag('category', errorLog.category);
      scope.setContext('error_details', {
        errorId: errorLog.id,
        screen: errorLog.context?.screen,
        action: errorLog.context?.action,
        ...errorLog.context?.metadata,
      });

      if (error instanceof Error) {
        Sentry.Native.captureException(error);
      } else {
        Sentry.Native.captureMessage(errorLog.message);
      }
    });
  }

  private mapSeverityToSentryLevel(severity: ErrorSeverity): Sentry.Native.SeverityLevel {
    switch (severity) {
      case ErrorSeverity.LOW:
        return 'info';
      case ErrorSeverity.MEDIUM:
        return 'warning';
      case ErrorSeverity.HIGH:
        return 'error';
      case ErrorSeverity.CRITICAL:
        return 'fatal';
      default:
        return 'error';
    }
  }

  private async handleCriticalError(errorLog: ErrorLog): Promise<void> {
    // Save critical error for crash reporting
    try {
      await AsyncStorage.setItem('last_critical_error', JSON.stringify(errorLog));
    } catch {
      // Ignore storage errors
    }

    // You might want to show an alert or restart the app
    if (__DEV__) {
      console.error('CRITICAL ERROR:', errorLog);
    }
  }

  private async loadCachedLogs(): Promise<void> {
    try {
      const cached = await AsyncStorage.getItem('error_logs');
      if (cached) {
        this.errorLogs = JSON.parse(cached);
      }
    } catch {
      // Ignore cache loading errors
    }
  }

  private async saveCachedLogs(): Promise<void> {
    try {
      await AsyncStorage.setItem('error_logs', JSON.stringify(this.errorLogs));
    } catch {
      // Ignore cache saving errors
    }
  }

  /**
   * Check for previous crash
   */
  async checkForPreviousCrash(): Promise<ErrorLog | null> {
    try {
      const lastError = await AsyncStorage.getItem('last_critical_error');
      if (lastError) {
        await AsyncStorage.removeItem('last_critical_error');
        return JSON.parse(lastError);
      }
    } catch {
      // Ignore errors
    }
    return null;
  }
}

export const errorService = new ErrorService();

/**
 * Error boundary component wrapper
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: React.ComponentType<{ error: Error; retry: () => void }>
) {
  return class ErrorBoundaryWrapper extends React.Component<P, { hasError: boolean; error?: Error }> {
    constructor(props: P) {
      super(props);
      this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: Error) {
      return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
      errorService.logError(error, ErrorSeverity.HIGH, ErrorCategory.GENERAL, {
        metadata: { errorInfo },
      });
    }

    retry = () => {
      this.setState({ hasError: false, error: undefined });
    };

    render() {
      if (this.state.hasError && this.state.error) {
        if (fallback) {
          const FallbackComponent = fallback;
          return <FallbackComponent error={this.state.error} retry={this.retry} />;
        }
        return null;
      }

      return <Component {...this.props} />;
    }
  };
}