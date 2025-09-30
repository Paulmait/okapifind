/**
 * Performance Monitoring Hook
 * Tracks component render times and performance metrics
 */

import { useEffect, useRef, useState } from 'react';
import { performance } from '../services/performance';
import { logger, LogCategory } from '../services/logger';

export interface PerformanceMetrics {
  renderTime: number;
  mountTime: number;
  updateCount: number;
}

export function usePerformanceMonitor(
  componentName: string,
  options: {
    slowThreshold?: number;
    enableLogging?: boolean;
    trackUpdates?: boolean;
  } = {}
) {
  const {
    slowThreshold = 3000,
    enableLogging = __DEV__,
    trackUpdates = false,
  } = options;

  const mountTime = useRef(Date.now());
  const renderCount = useRef(0);
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    renderTime: 0,
    mountTime: 0,
    updateCount: 0,
  });

  // Track component mount
  useEffect(() => {
    const startTime = Date.now();
    performance.startTimer(`${componentName}_mount`);

    if (enableLogging) {
      logger.info(`${componentName} mounting`, { category: LogCategory.PERFORMANCE });
    }

    return () => {
      const totalMountTime = Date.now() - startTime;
      performance.endTimer(`${componentName}_mount`);

      const finalMetrics = {
        renderTime: totalMountTime,
        mountTime: Date.now() - mountTime.current,
        updateCount: renderCount.current,
      };

      setMetrics(finalMetrics);

      // Warn if component took too long
      if (totalMountTime > slowThreshold) {
        logger.warn(`⚠️ Slow component: ${componentName}`, {
          category: LogCategory.PERFORMANCE,
          renderTime: totalMountTime,
          threshold: slowThreshold,
          updates: renderCount.current,
        });
      }

      if (enableLogging) {
        logger.info(`${componentName} unmounting`, {
          category: LogCategory.PERFORMANCE,
          ...finalMetrics,
        });
      }
    };
  }, [componentName, slowThreshold, enableLogging]);

  // Track renders
  useEffect(() => {
    if (trackUpdates) {
      renderCount.current++;

      if (enableLogging && renderCount.current > 1) {
        logger.debug(`${componentName} re-rendered`, {
          category: LogCategory.PERFORMANCE,
          count: renderCount.current,
        });
      }
    }
  });

  return metrics;
}

/**
 * Hook to measure async operation performance
 */
export function useAsyncPerformance() {
  const measureAsync = async <T,>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> => {
    const startTime = Date.now();
    performance.startTimer(operationName);

    try {
      const result = await operation();
      const duration = Date.now() - startTime;

      performance.endTimer(operationName);

      if (duration > 2000) {
        logger.warn(`Slow async operation: ${operationName}`, {
          category: LogCategory.PERFORMANCE,
          duration,
        });
      }

      return result;
    } catch (error) {
      performance.endTimer(operationName);
      throw error;
    }
  };

  return { measureAsync };
}

/**
 * Hook to track user interactions
 */
export function useInteractionTracking(screenName: string) {
  const trackInteraction = (interactionName: string, metadata?: any) => {
    performance.mark(`${screenName}_${interactionName}`);

    if (__DEV__) {
      logger.debug(`Interaction: ${screenName} - ${interactionName}`, {
        category: LogCategory.PERFORMANCE,
        ...metadata,
      });
    }
  };

  return { trackInteraction };
}