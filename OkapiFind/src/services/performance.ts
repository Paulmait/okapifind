import React, { useEffect, useRef } from 'react';
import { Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface PerformanceMetric {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  metadata?: Record<string, any>;
}

class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetric> = new Map();
  private isEnabled: boolean = __DEV__;

  constructor() {
    this.init();
  }

  private async init() {
    try {
      const enabled = await AsyncStorage.getItem('performance_monitoring');
      this.isEnabled = enabled === 'true' || __DEV__;
    } catch (error) {
      console.warn('Failed to initialize performance monitoring:', error);
    }
  }

  public async setEnabled(enabled: boolean) {
    this.isEnabled = enabled;
    try {
      await AsyncStorage.setItem('performance_monitoring', enabled.toString());
    } catch (error) {
      console.warn('Failed to save performance monitoring setting:', error);
    }
  }

  public startTimer(name: string, metadata?: Record<string, any>): void {
    if (!this.isEnabled) return;

    const metric: PerformanceMetric = {
      name,
      startTime: Date.now(),
      metadata,
    };

    this.metrics.set(name, metric);
  }

  public mark(name: string, metadata?: Record<string, any>): void {
    // Simple mark for tracking interaction timestamps
    this.startTimer(name, metadata);
  }

  public endTimer(name: string): PerformanceMetric | null {
    if (!this.isEnabled) return null;

    const metric = this.metrics.get(name);
    if (!metric) {
      console.warn(`Performance metric "${name}" not found`);
      return null;
    }

    metric.endTime = Date.now();
    metric.duration = metric.endTime - metric.startTime;

    // Log slow operations
    if (metric.duration > 1000) {
      console.warn(`Slow operation detected: ${name} took ${metric.duration}ms`);
    }

    // Store completed metric
    this.storeMetric(metric);
    this.metrics.delete(name);

    return metric;
  }

  public measureAsync<T>(name: string, asyncFn: () => Promise<T>, metadata?: Record<string, any>): Promise<T> {
    if (!this.isEnabled) return asyncFn();

    this.startTimer(name, metadata);

    return asyncFn()
      .then((result) => {
        this.endTimer(name);
        return result;
      })
      .catch((error) => {
        const metric = this.endTimer(name);
        if (metric) {
          metric.metadata = { ...metric.metadata, error: error.message };
        }
        throw error;
      });
  }

  public measureSync<T>(name: string, syncFn: () => T, metadata?: Record<string, any>): T {
    if (!this.isEnabled) return syncFn();

    this.startTimer(name, metadata);

    try {
      const result = syncFn();
      this.endTimer(name);
      return result;
    } catch (error) {
      const metric = this.endTimer(name);
      if (metric) {
        metric.metadata = { ...metric.metadata, error: (error as Error).message };
      }
      throw error;
    }
  }

  private async storeMetric(metric: PerformanceMetric) {
    try {
      const key = `perf_${Date.now()}_${metric.name}`;
      await AsyncStorage.setItem(key, JSON.stringify(metric));

      // Clean old metrics (keep only last 100)
      this.cleanOldMetrics();
    } catch (error) {
      console.warn('Failed to store performance metric:', error);
    }
  }

  private async cleanOldMetrics() {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const perfKeys = keys.filter(key => key.startsWith('perf_')).sort();

      if (perfKeys.length > 100) {
        const keysToDelete = perfKeys.slice(0, perfKeys.length - 100);
        await AsyncStorage.multiRemove(keysToDelete);
      }
    } catch (error) {
      console.warn('Failed to clean old performance metrics:', error);
    }
  }

  public async getMetrics(): Promise<PerformanceMetric[]> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const perfKeys = keys.filter(key => key.startsWith('perf_'));
      const metrics = await AsyncStorage.multiGet(perfKeys);

      return metrics
        .map(([key, value]) => {
          try {
            return JSON.parse(value || '{}');
          } catch {
            return null;
          }
        })
        .filter(Boolean)
        .sort((a, b) => b.startTime - a.startTime);
    } catch (error) {
      console.warn('Failed to get performance metrics:', error);
      return [];
    }
  }

  public async clearMetrics(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const perfKeys = keys.filter(key => key.startsWith('perf_'));
      await AsyncStorage.multiRemove(perfKeys);
    } catch (error) {
      console.warn('Failed to clear performance metrics:', error);
    }
  }

  // Memory monitoring
  public logMemoryUsage(label?: string): void {
    if (!this.isEnabled || !__DEV__) return;

    if (Platform.OS === 'ios' && (global as any).performance) {
      const memory = (global as any).performance.memory;
      if (memory) {
        console.log(`Memory Usage${label ? ` (${label})` : ''}:`, {
          used: `${Math.round(memory.usedJSHeapSize / 1024 / 1024)}MB`,
          total: `${Math.round(memory.totalJSHeapSize / 1024 / 1024)}MB`,
          limit: `${Math.round(memory.jsHeapSizeLimit / 1024 / 1024)}MB`,
        });
      }
    }
  }

  // Frame rate monitoring
  public startFPSMonitoring(): void {
    if (!this.isEnabled || !__DEV__) return;

    let lastTime = Date.now();
    let frameCount = 0;

    const calculateFPS = () => {
      frameCount++;
      const currentTime = Date.now();
      const deltaTime = currentTime - lastTime;

      if (deltaTime >= 1000) {
        const fps = Math.round((frameCount * 1000) / deltaTime);
        if (fps < 50) {
          console.warn(`Low FPS detected: ${fps} fps`);
        }
        frameCount = 0;
        lastTime = currentTime;
      }

      requestAnimationFrame(calculateFPS);
    };

    requestAnimationFrame(calculateFPS);
  }

  // Bundle size monitoring
  public logBundleInfo(): void {
    if (!this.isEnabled || !__DEV__) return;

    console.log('Performance Monitor initialized', {
      platform: Platform.OS,
      version: Platform.Version,
      isHermes: !!(global as any).HermesInternal,
      bundleId: __DEV__ ? 'development' : 'production',
    });
  }
}

export const performance = new PerformanceMonitor();

// Export HOC for component performance monitoring
export function withPerformanceMonitoring<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  componentName?: string
): React.ComponentType<P> {
  const displayName = componentName || WrappedComponent.displayName || WrappedComponent.name || 'Component';

  const PerformanceWrappedComponent: React.FC<P> = (props) => {
    const renderStartTime = useRef<number>(Date.now());

    useEffect(() => {
      const renderTime = Date.now() - renderStartTime.current;
      if (renderTime > 100) {
        console.warn(`Slow render detected: ${displayName} took ${renderTime}ms to mount`);
      }

      performance.logMemoryUsage(displayName);
    }, []);

    return React.createElement(WrappedComponent, props);
  };

  PerformanceWrappedComponent.displayName = `withPerformanceMonitoring(${displayName})`;

  return PerformanceWrappedComponent;
}