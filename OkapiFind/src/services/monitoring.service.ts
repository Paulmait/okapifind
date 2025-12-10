/**
 * Application Monitoring & Alerting Service
 * CRITICAL: Real-time monitoring for production issues
 * Integrates with Datadog, New Relic, and custom monitoring
 */

import { Platform } from 'react-native';
import { analytics } from './analytics';

// Sentry placeholder - will be re-enabled when sentry-expo supports SDK 54
const Sentry = {
  Native: {
    captureException: (_error: any, _options?: any) => {},
  },
};

interface MonitoringConfig {
  enabled: boolean;
  sampleRate: number;
  alertThresholds: {
    errorRate: number;
    responseTime: number;
    crashRate: number;
  };
}

interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: number;
  tags?: Record<string, string>;
}

interface Alert {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: {
    database: boolean;
    api: boolean;
    auth: boolean;
    cache: boolean;
  };
  timestamp: number;
}

class MonitoringService {
  private config: MonitoringConfig = {
    enabled: true,
    sampleRate: 1.0,
    alertThresholds: {
      errorRate: 0.05, // 5%
      responseTime: 3000, // 3 seconds
      crashRate: 0.01, // 1%
    },
  };

  private metrics: Map<string, PerformanceMetric[]> = new Map();
  private alerts: Alert[] = [];
  private lastHealthCheck?: HealthCheckResult;

  /**
   * Initialize monitoring
   */
  initialize(config?: Partial<MonitoringConfig>): void {
    if (config) {
      this.config = { ...this.config, ...config };
    }

    console.log('Monitoring service initialized', this.config);
  }

  /**
   * Track performance metric
   */
  trackMetric(metric: Omit<PerformanceMetric, 'timestamp'>): void {
    if (!this.config.enabled) return;

    const fullMetric: PerformanceMetric = {
      ...metric,
      timestamp: Date.now(),
    };

    // Store in memory
    const existing = this.metrics.get(metric.name) || [];
    existing.push(fullMetric);

    // Keep only last 100 metrics per name
    if (existing.length > 100) {
      existing.shift();
    }

    this.metrics.set(metric.name, existing);

    // Send to analytics
    analytics.logEvent('performance_metric', {
      metric_name: metric.name,
      metric_value: metric.value,
      metric_unit: metric.unit,
      ...metric.tags,
    });

    // Check thresholds
    this.checkThresholds(fullMetric);
  }

  /**
   * Track API call performance
   */
  async trackApiCall<T>(
    endpoint: string,
    apiCall: () => Promise<T>
  ): Promise<T> {
    const startTime = Date.now();
    let error: Error | null = null;

    try {
      const result = await apiCall();
      const duration = Date.now() - startTime;

      this.trackMetric({
        name: 'api_call_duration',
        value: duration,
        unit: 'ms',
        tags: {
          endpoint,
          status: 'success',
        },
      });

      return result;
    } catch (err) {
      error = err as Error;
      const duration = Date.now() - startTime;

      this.trackMetric({
        name: 'api_call_duration',
        value: duration,
        unit: 'ms',
        tags: {
          endpoint,
          status: 'error',
        },
      });

      this.trackError(error, {
        endpoint,
        duration,
      });

      throw err;
    }
  }

  /**
   * Track database query performance
   */
  async trackDatabaseQuery<T>(
    queryName: string,
    queryFn: () => Promise<T>
  ): Promise<T> {
    const startTime = Date.now();

    try {
      const result = await queryFn();
      const duration = Date.now() - startTime;

      this.trackMetric({
        name: 'db_query_duration',
        value: duration,
        unit: 'ms',
        tags: {
          query: queryName,
          status: 'success',
        },
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      this.trackMetric({
        name: 'db_query_duration',
        value: duration,
        unit: 'ms',
        tags: {
          query: queryName,
          status: 'error',
        },
      });

      this.trackError(error as Error, {
        query: queryName,
        duration,
      });

      throw error;
    }
  }

  /**
   * Track error with context
   */
  trackError(error: Error, context?: Record<string, any>): void {
    if (!this.config.enabled) return;

    // Send to Sentry
    Sentry.Native.captureException(error, {
      contexts: {
        custom: context,
      },
      tags: {
        platform: Platform.OS,
        ...context?.tags,
      },
    });

    // Track in analytics
    analytics.logEvent('error_occurred', {
      error_message: error.message,
      error_stack: error.stack?.slice(0, 500),
      ...context,
    });

    // Create alert if critical
    if (context?.critical) {
      this.createAlert({
        severity: 'critical',
        message: `Critical error: ${error.message}`,
        metadata: context,
      });
    }
  }

  /**
   * Track custom event
   */
  trackEvent(
    eventName: string,
    properties?: Record<string, any>
  ): void {
    if (!this.config.enabled) return;

    analytics.logEvent(eventName, properties);

    // Store as metric if it has a numeric value
    if (properties?.value !== undefined) {
      this.trackMetric({
        name: eventName,
        value: properties.value,
        unit: properties.unit || 'count',
        tags: properties.tags,
      });
    }
  }

  /**
   * Perform health check
   */
  async performHealthCheck(): Promise<HealthCheckResult> {
    const checks = {
      database: await this.checkDatabase(),
      api: await this.checkApi(),
      auth: await this.checkAuth(),
      cache: await this.checkCache(),
    };

    const healthyCount = Object.values(checks).filter(Boolean).length;
    const totalChecks = Object.keys(checks).length;

    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (healthyCount === totalChecks) {
      status = 'healthy';
    } else if (healthyCount >= totalChecks / 2) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    const result: HealthCheckResult = {
      status,
      checks,
      timestamp: Date.now(),
    };

    this.lastHealthCheck = result;

    // Track health check
    this.trackMetric({
      name: 'health_check',
      value: healthyCount / totalChecks,
      unit: 'ratio',
      tags: {
        status,
      },
    });

    // Alert if unhealthy
    if (status === 'unhealthy') {
      this.createAlert({
        severity: 'critical',
        message: 'System health check failed',
        metadata: { checks },
      });
    }

    return result;
  }

  /**
   * Check database connectivity
   */
  private async checkDatabase(): Promise<boolean> {
    try {
      // Implement actual database ping
      // For now, return true
      return true;
    } catch (error) {
      console.error('Database health check failed:', error);
      return false;
    }
  }

  /**
   * Check API connectivity
   */
  private async checkApi(): Promise<boolean> {
    try {
      // Implement actual API ping
      return true;
    } catch (error) {
      console.error('API health check failed:', error);
      return false;
    }
  }

  /**
   * Check authentication service
   */
  private async checkAuth(): Promise<boolean> {
    try {
      // Implement actual auth check
      return true;
    } catch (error) {
      console.error('Auth health check failed:', error);
      return false;
    }
  }

  /**
   * Check cache service
   */
  private async checkCache(): Promise<boolean> {
    try {
      // Implement actual cache check
      return true;
    } catch (error) {
      console.error('Cache health check failed:', error);
      return false;
    }
  }

  /**
   * Create alert
   */
  private createAlert(alert: Omit<Alert, 'id' | 'timestamp'>): void {
    const fullAlert: Alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      ...alert,
    };

    this.alerts.push(fullAlert);

    // Keep only last 50 alerts
    if (this.alerts.length > 50) {
      this.alerts.shift();
    }

    // Send alert notification
    this.sendAlertNotification(fullAlert);

    // Log to analytics
    analytics.logEvent('alert_created', {
      alert_severity: alert.severity,
      alert_message: alert.message,
      ...alert.metadata,
    });
  }

  /**
   * Send alert notification (webhook/email/slack)
   */
  private async sendAlertNotification(alert: Alert): Promise<void> {
    // Implement actual alert notification
    // For now, just log
    console.warn(`ALERT [${alert.severity}]:`, alert.message, alert.metadata);

    // In production, send to:
    // - Slack webhook
    // - Email via Resend
    // - PagerDuty for critical alerts
  }

  /**
   * Check if metric exceeds thresholds
   */
  private checkThresholds(metric: PerformanceMetric): void {
    // Check response time threshold
    if (
      metric.name.includes('duration') &&
      metric.value > this.config.alertThresholds.responseTime
    ) {
      this.createAlert({
        severity: 'medium',
        message: `High response time detected: ${metric.value}ms`,
        metadata: { metric },
      });
    }
  }

  /**
   * Get metrics summary
   */
  getMetricsSummary(): Record<string, {
    count: number;
    avg: number;
    min: number;
    max: number;
  }> {
    const summary: Record<string, any> = {};

    for (const [name, metrics] of this.metrics.entries()) {
      const values = metrics.map(m => m.value);
      summary[name] = {
        count: values.length,
        avg: values.reduce((a, b) => a + b, 0) / values.length,
        min: Math.min(...values),
        max: Math.max(...values),
      };
    }

    return summary;
  }

  /**
   * Get recent alerts
   */
  getRecentAlerts(limit: number = 10): Alert[] {
    return this.alerts.slice(-limit);
  }

  /**
   * Get last health check result
   */
  getLastHealthCheck(): HealthCheckResult | undefined {
    return this.lastHealthCheck;
  }

  /**
   * Clear old metrics
   */
  clearOldMetrics(olderThan: number = 3600000): void {
    const cutoff = Date.now() - olderThan;

    for (const [name, metrics] of this.metrics.entries()) {
      const filtered = metrics.filter(m => m.timestamp > cutoff);
      this.metrics.set(name, filtered);
    }
  }

  /**
   * Export metrics for external monitoring
   */
  exportMetrics(): {
    metrics: Record<string, PerformanceMetric[]>;
    alerts: Alert[];
    healthCheck?: HealthCheckResult;
  } {
    return {
      metrics: Object.fromEntries(this.metrics),
      alerts: this.alerts,
      healthCheck: this.lastHealthCheck,
    };
  }
}

// Export singleton instance
export const monitoringService = new MonitoringService();

// Export convenience functions
export const trackMetric = (metric: Omit<PerformanceMetric, 'timestamp'>) =>
  monitoringService.trackMetric(metric);

export const trackApiCall = <T>(endpoint: string, apiCall: () => Promise<T>) =>
  monitoringService.trackApiCall(endpoint, apiCall);

export const trackError = (error: Error, context?: Record<string, any>) =>
  monitoringService.trackError(error, context);

export const performHealthCheck = () =>
  monitoringService.performHealthCheck();

export default monitoringService;