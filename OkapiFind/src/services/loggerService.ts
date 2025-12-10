/**
 * Logger Service
 * Centralized logging with multiple transports and structured logging
 * Note: Sentry integration temporarily disabled for SDK 54 compatibility
 */

// Sentry placeholder - will be re-enabled when sentry-expo supports SDK 54
const Sentry = {
  addBreadcrumb: (_breadcrumb: any) => {},
  captureMessage: (_message: any, _level?: any) => {},
  captureException: (_error: any, _options?: any) => {},
};

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4,
}

interface LogContext {
  userId?: string;
  sessionId?: string;
  action?: string;
  metadata?: Record<string, any>;
  error?: Error;
  stack?: string;
}

class Logger {
  private level: LogLevel = LogLevel.INFO;
  private isDevelopment = __DEV__;

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.level;
  }

  private formatMessage(level: string, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` | ${JSON.stringify(context)}` : '';
    return `[${timestamp}] [${level}] ${message}${contextStr}`;
  }

  debug(message: string, context?: LogContext): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      if (this.isDevelopment) {
        console.log(this.formatMessage('DEBUG', message, context));
      }
    }
  }

  info(message: string, context?: LogContext): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.log(this.formatMessage('INFO', message, context));

      if (!this.isDevelopment && context?.action) {
        Sentry.addBreadcrumb({
          message,
          level: 'info',
          category: context.action,
          data: context.metadata,
        });
      }
    }
  }

  warn(message: string, context?: LogContext): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(this.formatMessage('WARN', message, context));

      if (!this.isDevelopment) {
        Sentry.captureMessage(message, 'warning');
      }
    }
  }

  error(message: string, error?: Error | any, context?: LogContext): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      console.error(this.formatMessage('ERROR', message, context), error);

      if (!this.isDevelopment && error) {
        Sentry.captureException(error, {
          contexts: {
            custom: context,
          },
        });
      }
    }
  }

  fatal(message: string, error?: Error, context?: LogContext): void {
    if (this.shouldLog(LogLevel.FATAL)) {
      console.error(this.formatMessage('FATAL', message, context), error);

      if (!this.isDevelopment && error) {
        Sentry.captureException(error, {
          level: 'fatal',
          contexts: {
            custom: context,
          },
        });
      }
    }
  }
}

export const logger = new Logger();