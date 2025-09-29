/**
 * Comprehensive Structured Logging Service
 * Enterprise-grade logging with multiple transports and structured data
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { supabase } from '../lib/supabase-client';
import { Platform } from 'react-native';
import * as Device from 'expo-device';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4,
}

export enum LogCategory {
  AUTHENTICATION = 'AUTH',
  DATABASE = 'DB',
  API = 'API',
  UI = 'UI',
  PERFORMANCE = 'PERF',
  SECURITY = 'SEC',
  PAYMENT = 'PAY',
  LOCATION = 'LOC',
  NOTIFICATION = 'NOTIF',
  GENERAL = 'GEN',
}

interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  category: LogCategory;
  message: string;
  metadata?: any;
  context?: LogContext;
  stackTrace?: string;
  sessionId: string;
  userId?: string;
  deviceInfo?: DeviceInfo;
}

interface LogContext {
  component?: string;
  action?: string;
  screen?: string;
  feature?: string;
  build?: string;
  version?: string;
}

interface DeviceInfo {
  platform: string;
  osVersion: string;
  deviceModel: string;
  deviceId: string;
  isEmulator: boolean;
  memoryUsage?: number;
  batteryLevel?: number;
  networkType?: string;
}

interface LogTransport {
  name: string;
  send(entry: LogEntry): Promise<void>;
  flush?(): Promise<void>;
}

interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableFile: boolean;
  enableRemote: boolean;
  enableCrashReporting: boolean;
  maxLocalLogs: number;
  uploadBatchSize: number;
  uploadInterval: number;
  redactSensitiveData: boolean;
  sensitiveKeys: string[];
}

class StructuredLogger {
  private static instance: StructuredLogger;
  private config: LoggerConfig;
  private transports: LogTransport[] = [];
  private buffer: LogEntry[] = [];
  private sessionId: string;
  private userId?: string;
  private deviceInfo: DeviceInfo;
  private uploadTimer?: NodeJS.Timeout;
  private isOnline: boolean = true;

  private constructor() {
    this.sessionId = this.generateSessionId();
    this.deviceInfo = this.getDeviceInfo();

    this.config = {
      level: LogLevel.INFO,
      enableConsole: __DEV__,
      enableFile: true,
      enableRemote: !__DEV__,
      enableCrashReporting: !__DEV__,
      maxLocalLogs: 1000,
      uploadBatchSize: 50,
      uploadInterval: 60000, // 1 minute
      redactSensitiveData: true,
      sensitiveKeys: [
        'password',
        'token',
        'secret',
        'key',
        'authorization',
        'creditCard',
        'ssn',
        'apiKey',
        'privateKey',
      ],
    };

    this.initializeTransports();
    this.startUploadTimer();
    this.initializeNetworkListener();
  }

  static getInstance(): StructuredLogger {
    if (!StructuredLogger.instance) {
      StructuredLogger.instance = new StructuredLogger();
    }
    return StructuredLogger.instance;
  }

  /**
   * Initialize logging transports
   */
  private initializeTransports(): void {
    // Console transport
    if (this.config.enableConsole) {
      this.transports.push(new ConsoleTransport());
    }

    // File transport
    if (this.config.enableFile) {
      this.transports.push(new FileTransport(this.config.maxLocalLogs));
    }

    // Remote transport
    if (this.config.enableRemote) {
      this.transports.push(new RemoteTransport());
    }

    // Crash reporting transport
    if (this.config.enableCrashReporting) {
      this.transports.push(new CrashReportingTransport());
    }
  }

  /**
   * Log debug message
   */
  debug(message: string, metadata?: any, context?: LogContext): void {
    this.log(LogLevel.DEBUG, LogCategory.GENERAL, message, metadata, context);
  }

  /**
   * Log info message
   */
  info(message: string, metadata?: any, context?: LogContext): void {
    this.log(LogLevel.INFO, LogCategory.GENERAL, message, metadata, context);
  }

  /**
   * Log warning message
   */
  warn(message: string, metadata?: any, context?: LogContext): void {
    this.log(LogLevel.WARN, LogCategory.GENERAL, message, metadata, context);
  }

  /**
   * Log error message
   */
  error(message: string, error?: Error, metadata?: any, context?: LogContext): void {
    const errorMetadata = {
      ...metadata,
      errorMessage: error?.message,
      errorStack: error?.stack,
    };
    this.log(LogLevel.ERROR, LogCategory.GENERAL, message, errorMetadata, context);
  }

  /**
   * Log fatal message
   */
  fatal(message: string, error?: Error, metadata?: any, context?: LogContext): void {
    const errorMetadata = {
      ...metadata,
      errorMessage: error?.message,
      errorStack: error?.stack,
    };
    this.log(LogLevel.FATAL, LogCategory.GENERAL, message, errorMetadata, context);

    // Immediately flush on fatal errors
    this.flush();
  }

  /**
   * Main logging method
   */
  log(
    level: LogLevel,
    category: LogCategory,
    message: string,
    metadata?: any,
    context?: LogContext
  ): void {
    // Check if should log based on level
    if (level < this.config.level) return;

    const entry: LogEntry = {
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      metadata: this.config.redactSensitiveData
        ? this.redactSensitive(metadata)
        : metadata,
      context,
      sessionId: this.sessionId,
      userId: this.userId,
      deviceInfo: this.deviceInfo,
    };

    // Add to buffer
    this.buffer.push(entry);

    // Send to transports
    this.sendToTransports(entry);

    // Check if buffer should be flushed
    if (this.buffer.length >= this.config.uploadBatchSize) {
      this.uploadLogs();
    }
  }

  /**
   * Log performance metric
   */
  logPerformance(
    operation: string,
    duration: number,
    metadata?: any
  ): void {
    this.log(LogLevel.INFO, LogCategory.PERFORMANCE, `Performance: ${operation}`, {
      ...metadata,
      duration,
      operation,
    });
  }

  /**
   * Log API call
   */
  logApiCall(
    method: string,
    endpoint: string,
    statusCode: number,
    duration: number,
    metadata?: any
  ): void {
    const level = statusCode >= 400 ? LogLevel.ERROR : LogLevel.INFO;
    this.log(level, LogCategory.API, `API ${method} ${endpoint}`, {
      ...metadata,
      method,
      endpoint,
      statusCode,
      duration,
    });
  }

  /**
   * Log security event
   */
  logSecurityEvent(
    event: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    metadata?: any
  ): void {
    const level = severity === 'critical' ? LogLevel.FATAL :
                  severity === 'high' ? LogLevel.ERROR :
                  severity === 'medium' ? LogLevel.WARN :
                  LogLevel.INFO;

    this.log(level, LogCategory.SECURITY, `Security: ${event}`, {
      ...metadata,
      securityEvent: event,
      severity,
    });
  }

  /**
   * Send log entry to all transports
   */
  private async sendToTransports(entry: LogEntry): Promise<void> {
    for (const transport of this.transports) {
      try {
        await transport.send(entry);
      } catch (error) {
        console.error(`Failed to send log to ${transport.name}:`, error);
      }
    }
  }

  /**
   * Redact sensitive data from metadata
   */
  private redactSensitive(data: any): any {
    if (!data) return data;

    if (typeof data === 'string') {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map(item => this.redactSensitive(item));
    }

    if (typeof data === 'object') {
      const cleaned: any = {};
      for (const [key, value] of Object.entries(data)) {
        const lowerKey = key.toLowerCase();
        const isSensitive = this.config.sensitiveKeys.some(
          sensitive => lowerKey.includes(sensitive.toLowerCase())
        );

        if (isSensitive) {
          cleaned[key] = '[REDACTED]';
        } else {
          cleaned[key] = this.redactSensitive(value);
        }
      }
      return cleaned;
    }

    return data;
  }

  /**
   * Upload buffered logs
   */
  private async uploadLogs(): Promise<void> {
    if (this.buffer.length === 0 || !this.isOnline) return;

    const logsToUpload = [...this.buffer];
    this.buffer = [];

    try {
      const { error } = await supabase
        .from('app_logs')
        .insert(logsToUpload);

      if (error) {
        // Re-add to buffer if upload fails
        this.buffer.unshift(...logsToUpload);
        console.error('Failed to upload logs:', error);
      }
    } catch (error) {
      // Re-add to buffer if upload fails
      this.buffer.unshift(...logsToUpload);
      console.error('Failed to upload logs:', error);
    }
  }

  /**
   * Start upload timer
   */
  private startUploadTimer(): void {
    this.uploadTimer = setInterval(() => {
      this.uploadLogs();
    }, this.config.uploadInterval);
  }

  /**
   * Initialize network listener
   */
  private initializeNetworkListener(): void {
    NetInfo.addEventListener(state => {
      this.isOnline = state.isConnected || false;
      if (this.isOnline) {
        // Upload buffered logs when coming online
        this.uploadLogs();
      }
    });
  }

  /**
   * Generate session ID
   */
  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get device info
   */
  private getDeviceInfo(): DeviceInfo {
    return {
      platform: Platform.OS,
      osVersion: Platform.Version.toString(),
      deviceModel: Device.modelName || 'Unknown',
      deviceId: Device.deviceName || 'Unknown',
      isEmulator: !Device.isDevice,
    };
  }

  /**
   * Set user ID
   */
  setUserId(userId: string): void {
    this.userId = userId;
  }

  /**
   * Clear user ID
   */
  clearUserId(): void {
    this.userId = undefined;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };

    // Reinitialize transports if needed
    if (config.enableConsole !== undefined ||
        config.enableFile !== undefined ||
        config.enableRemote !== undefined ||
        config.enableCrashReporting !== undefined) {
      this.transports = [];
      this.initializeTransports();
    }
  }

  /**
   * Flush all pending logs
   */
  async flush(): Promise<void> {
    await this.uploadLogs();

    for (const transport of this.transports) {
      if (transport.flush) {
        await transport.flush();
      }
    }
  }

  /**
   * Clear all logs
   */
  async clear(): Promise<void> {
    this.buffer = [];
    await AsyncStorage.removeItem('@OkapiFind:logs');
  }

  /**
   * Get log statistics
   */
  getStatistics(): any {
    return {
      bufferSize: this.buffer.length,
      sessionId: this.sessionId,
      userId: this.userId,
      isOnline: this.isOnline,
      transports: this.transports.map(t => t.name),
    };
  }
}

/**
 * Console Transport
 */
class ConsoleTransport implements LogTransport {
  name = 'console';

  async send(entry: LogEntry): Promise<void> {
    const levelColors = {
      [LogLevel.DEBUG]: '\x1b[36m', // Cyan
      [LogLevel.INFO]: '\x1b[32m',  // Green
      [LogLevel.WARN]: '\x1b[33m',  // Yellow
      [LogLevel.ERROR]: '\x1b[31m', // Red
      [LogLevel.FATAL]: '\x1b[35m', // Magenta
    };

    const reset = '\x1b[0m';
    const color = levelColors[entry.level];
    const levelName = LogLevel[entry.level];

    console.log(
      `${color}[${levelName}]${reset} [${entry.category}] ${entry.message}`,
      entry.metadata || ''
    );
  }
}

/**
 * File Transport
 */
class FileTransport implements LogTransport {
  name = 'file';
  private maxLogs: number;

  constructor(maxLogs: number) {
    this.maxLogs = maxLogs;
  }

  async send(entry: LogEntry): Promise<void> {
    try {
      // Get existing logs
      const existingLogs = await this.getLogs();

      // Add new log
      existingLogs.push(entry);

      // Trim if exceeded max
      if (existingLogs.length > this.maxLogs) {
        existingLogs.splice(0, existingLogs.length - this.maxLogs);
      }

      // Save logs
      await AsyncStorage.setItem(
        '@OkapiFind:logs',
        JSON.stringify(existingLogs)
      );
    } catch (error) {
      console.error('Failed to save log to file:', error);
    }
  }

  private async getLogs(): Promise<LogEntry[]> {
    try {
      const logs = await AsyncStorage.getItem('@OkapiFind:logs');
      return logs ? JSON.parse(logs) : [];
    } catch {
      return [];
    }
  }

  async flush(): Promise<void> {
    // File transport doesn't need flushing
  }
}

/**
 * Remote Transport
 */
class RemoteTransport implements LogTransport {
  name = 'remote';
  private queue: LogEntry[] = [];

  async send(entry: LogEntry): Promise<void> {
    // Add to queue for batch upload
    this.queue.push(entry);
  }

  async flush(): Promise<void> {
    if (this.queue.length === 0) return;

    try {
      const { error } = await supabase
        .from('app_logs')
        .insert(this.queue);

      if (!error) {
        this.queue = [];
      }
    } catch (error) {
      console.error('Failed to send logs to remote:', error);
    }
  }
}

/**
 * Crash Reporting Transport
 */
class CrashReportingTransport implements LogTransport {
  name = 'crashReporting';

  async send(entry: LogEntry): Promise<void> {
    // Only send errors and fatals to crash reporting
    if (entry.level < LogLevel.ERROR) return;

    // In production, integrate with Sentry or similar service
    // For now, store critical errors locally
    try {
      const crashes = await this.getCrashes();
      crashes.push(entry);

      // Keep only last 50 crashes
      if (crashes.length > 50) {
        crashes.splice(0, crashes.length - 50);
      }

      await AsyncStorage.setItem(
        '@OkapiFind:crashes',
        JSON.stringify(crashes)
      );
    } catch (error) {
      console.error('Failed to save crash report:', error);
    }
  }

  private async getCrashes(): Promise<LogEntry[]> {
    try {
      const crashes = await AsyncStorage.getItem('@OkapiFind:crashes');
      return crashes ? JSON.parse(crashes) : [];
    } catch {
      return [];
    }
  }
}

export const logger = StructuredLogger.getInstance();