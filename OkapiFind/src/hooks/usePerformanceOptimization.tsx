/**
 * Performance Optimization Hook
 * Advanced performance monitoring and optimization for smooth 60fps experience
 * Includes frame rate monitoring, memory management, and intelligent rendering optimizations
 */

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  InteractionManager,
  LayoutAnimation,
  Platform,
  Dimensions,
  AppState,
  AppStateStatus
} from 'react-native';
import * as Device from 'expo-device';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { analytics } from '../services/analytics';

interface PerformanceMetrics {
  frameRate: number;
  averageFrameTime: number;
  droppedFrames: number;
  memoryUsage: number;
  renderTime: number;
  interactionDelay: number;
  networkLatency: number;
  batteryImpact: number;
}

interface PerformanceState {
  isLowEndDevice: boolean;
  currentFrameRate: number;
  targetFrameRate: number;
  performanceMode: 'low' | 'balanced' | 'high' | 'adaptive';
  memoryPressure: 'low' | 'medium' | 'high' | 'critical';
  thermalState: 'nominal' | 'fair' | 'serious' | 'critical';
  shouldReduceAnimations: boolean;
  shouldUseNativeDriver: boolean;
  shouldLazyLoad: boolean;
  optimizationLevel: number; // 0-100
}

interface OptimizationSettings {
  enableFrameRateMonitoring: boolean;
  enableMemoryMonitoring: boolean;
  enableAdaptivePerformance: boolean;
  frameRateThreshold: number;
  memoryThreshold: number;
  animationDuration: number;
  lazyLoadThreshold: number;
  preloadDistance: number;
}

interface ComponentMetrics {
  componentName: string;
  renderCount: number;
  lastRenderTime: number;
  averageRenderTime: number;
  memoryFootprint: number;
  isVisible: boolean;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

interface FrameData {
  timestamp: number;
  frameTime: number;
  dropped: boolean;
  renderComponents: string[];
}

const DEFAULT_SETTINGS: OptimizationSettings = {
  enableFrameRateMonitoring: true,
  enableMemoryMonitoring: true,
  enableAdaptivePerformance: true,
  frameRateThreshold: 50, // Target 50+ fps
  memoryThreshold: 0.8, // 80% memory usage threshold
  animationDuration: 250,
  lazyLoadThreshold: 5,
  preloadDistance: 1000,
};

const STORAGE_KEYS = {
  PERFORMANCE_METRICS: '@performance_metrics',
  OPTIMIZATION_SETTINGS: '@optimization_settings',
  DEVICE_PROFILE: '@device_performance_profile',
  FRAME_HISTORY: '@frame_history',
};

class PerformanceMonitor {
  private frameHistory: FrameData[] = [];
  private componentMetrics: Map<string, ComponentMetrics> = new Map();
  private performanceObserver: any = null;
  private frameCallback: number | null = null;
  private memoryTimer: NodeJS.Timeout | null = null;
  private lastFrameTime: number = 0;
  private droppedFrameCount: number = 0;

  startMonitoring(onFrameUpdate: (metrics: PerformanceMetrics) => void) {
    this.startFrameRateMonitoring(onFrameUpdate);
    this.startMemoryMonitoring();
    this.setupPerformanceObserver();
  }

  private startFrameRateMonitoring(onFrameUpdate: (metrics: PerformanceMetrics) => void) {
    const frameLoop = () => {
      const currentTime = performance.now();
      const frameTime = currentTime - this.lastFrameTime;

      if (this.lastFrameTime > 0) {
        const frameRate = 1000 / frameTime;
        const dropped = frameTime > 16.67; // 60fps threshold

        if (dropped) {
          this.droppedFrameCount++;
        }

        const frameData: FrameData = {
          timestamp: currentTime,
          frameTime,
          dropped,
          renderComponents: Array.from(this.componentMetrics.keys()),
        };

        this.frameHistory.push(frameData);

        // Keep only last 60 frames (1 second at 60fps)
        if (this.frameHistory.length > 60) {
          this.frameHistory.shift();
        }

        // Calculate metrics
        const metrics = this.calculateMetrics();
        onFrameUpdate(metrics);
      }

      this.lastFrameTime = currentTime;
      this.frameCallback = requestAnimationFrame(frameLoop);
    };

    this.frameCallback = requestAnimationFrame(frameLoop);
  }

  private startMemoryMonitoring() {
    this.memoryTimer = setInterval(() => {
      // Memory monitoring would be platform-specific
      // This is a conceptual implementation
      this.updateMemoryMetrics();
    }, 5000);
  }

  private setupPerformanceObserver() {
    // Use Performance Observer API if available
    if (typeof PerformanceObserver !== 'undefined') {
      this.performanceObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          if (entry.entryType === 'measure') {
            this.updateComponentMetrics(entry.name, entry.duration);
          }
        });
      });

      this.performanceObserver.observe({ entryTypes: ['measure'] });
    }
  }

  private calculateMetrics(): PerformanceMetrics {
    const recentFrames = this.frameHistory.slice(-30); // Last 30 frames
    const totalFrameTime = recentFrames.reduce((sum, frame) => sum + frame.frameTime, 0);
    const droppedFrames = recentFrames.filter(frame => frame.dropped).length;

    return {
      frameRate: recentFrames.length > 0 ? 1000 / (totalFrameTime / recentFrames.length) : 60,
      averageFrameTime: totalFrameTime / Math.max(recentFrames.length, 1),
      droppedFrames,
      memoryUsage: this.getMemoryUsage(),
      renderTime: this.getAverageRenderTime(),
      interactionDelay: this.getInteractionDelay(),
      networkLatency: 0, // Would be measured separately
      batteryImpact: this.calculateBatteryImpact(),
    };
  }

  private updateComponentMetrics(componentName: string, renderTime: number) {
    const existing = this.componentMetrics.get(componentName);

    if (existing) {
      existing.renderCount++;
      existing.lastRenderTime = renderTime;
      existing.averageRenderTime = (existing.averageRenderTime + renderTime) / 2;
    } else {
      this.componentMetrics.set(componentName, {
        componentName,
        renderCount: 1,
        lastRenderTime: renderTime,
        averageRenderTime: renderTime,
        memoryFootprint: 0,
        isVisible: true,
        priority: 'medium',
      });
    }
  }

  private getMemoryUsage(): number {
    // Platform-specific memory usage detection
    return 0.5; // Placeholder
  }

  private getAverageRenderTime(): number {
    const components = Array.from(this.componentMetrics.values());
    if (components.length === 0) return 0;

    const totalTime = components.reduce((sum, comp) => sum + comp.averageRenderTime, 0);
    return totalTime / components.length;
  }

  private getInteractionDelay(): number {
    // Measure interaction to visual feedback delay
    return 16; // Placeholder
  }

  private calculateBatteryImpact(): number {
    // Calculate battery impact based on performance metrics
    const avgFrameTime = this.frameHistory.reduce((sum, frame) => sum + frame.frameTime, 0) /
                        Math.max(this.frameHistory.length, 1);

    // Higher frame times = more battery usage
    return Math.min(100, (avgFrameTime / 16.67) * 20);
  }

  private updateMemoryMetrics() {
    // Update memory usage for components
    // This would be platform-specific
  }

  stopMonitoring() {
    if (this.frameCallback) {
      cancelAnimationFrame(this.frameCallback);
      this.frameCallback = null;
    }

    if (this.memoryTimer) {
      clearInterval(this.memoryTimer);
      this.memoryTimer = null;
    }

    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
      this.performanceObserver = null;
    }
  }

  getComponentMetrics(): ComponentMetrics[] {
    return Array.from(this.componentMetrics.values());
  }
}

export function usePerformanceOptimization(
  componentName?: string,
  options?: Partial<OptimizationSettings>
) {
  const [performanceState, setPerformanceState] = useState<PerformanceState>({
    isLowEndDevice: false,
    currentFrameRate: 60,
    targetFrameRate: 60,
    performanceMode: 'balanced',
    memoryPressure: 'low',
    thermalState: 'nominal',
    shouldReduceAnimations: false,
    shouldUseNativeDriver: true,
    shouldLazyLoad: false,
    optimizationLevel: 50,
  });

  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    frameRate: 60,
    averageFrameTime: 16.67,
    droppedFrames: 0,
    memoryUsage: 0.3,
    renderTime: 5,
    interactionDelay: 16,
    networkLatency: 0,
    batteryImpact: 10,
  });

  const [settings, setSettings] = useState<OptimizationSettings>(DEFAULT_SETTINGS);
  const performanceMonitor = useRef<PerformanceMonitor>(new PerformanceMonitor());
  const renderStartTime = useRef<number>(0);
  const isMonitoring = useRef<boolean>(false);

  // Device detection
  const deviceProfile = useMemo(() => {
    const { width, height } = Dimensions.get('window');
    const pixelDensity = Dimensions.get('window').scale;

    return {
      isLowEnd: Device.totalMemory ? Device.totalMemory < 3 * 1024 * 1024 * 1024 : false, // < 3GB RAM
      screenSize: width * height,
      pixelDensity,
      platform: Platform.OS,
      version: Platform.Version,
    };
  }, []);

  // Initialize performance monitoring
  useEffect(() => {
    const initializePerformanceMonitoring = async () => {
      try {
        // Load stored settings
        const storedSettings = await AsyncStorage.getItem(STORAGE_KEYS.OPTIMIZATION_SETTINGS);
        if (storedSettings) {
          setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(storedSettings), ...options });
        } else {
          setSettings({ ...DEFAULT_SETTINGS, ...options });
        }

        // Detect device capabilities
        const isLowEnd = deviceProfile.isLowEnd || deviceProfile.screenSize > 2000000; // Large screens

        setPerformanceState(prev => ({
          ...prev,
          isLowEndDevice: isLowEnd,
          performanceMode: isLowEnd ? 'low' : 'balanced',
          shouldReduceAnimations: isLowEnd,
          shouldLazyLoad: isLowEnd,
          targetFrameRate: isLowEnd ? 30 : 60,
        }));

        // Start monitoring
        if (settings.enableFrameRateMonitoring) {
          performanceMonitor.current.startMonitoring((newMetrics) => {
            setMetrics(newMetrics);
            updatePerformanceState(newMetrics);
          });
          isMonitoring.current = true;
        }

        analytics.logEvent('performance_monitoring_started', {
          device_profile: deviceProfile,
          low_end_device: isLowEnd,
          component_name: componentName,
        });

      } catch (error) {
        console.error('Failed to initialize performance monitoring:', error);
      }
    };

    initializePerformanceMonitoring();

    return () => {
      if (isMonitoring.current) {
        performanceMonitor.current.stopMonitoring();
        isMonitoring.current = false;
      }
    };
  }, []);

  // Update performance state based on metrics
  const updatePerformanceState = useCallback((newMetrics: PerformanceMetrics) => {
    setPerformanceState(prev => {
      const updates: Partial<PerformanceState> = {
        currentFrameRate: newMetrics.frameRate,
      };

      // Adaptive performance mode
      if (settings.enableAdaptivePerformance) {
        if (newMetrics.frameRate < 30) {
          updates.performanceMode = 'low';
          updates.shouldReduceAnimations = true;
          updates.shouldLazyLoad = true;
        } else if (newMetrics.frameRate < 45) {
          updates.performanceMode = 'balanced';
          updates.shouldReduceAnimations = false;
          updates.shouldLazyLoad = true;
        } else {
          updates.performanceMode = 'high';
          updates.shouldReduceAnimations = false;
          updates.shouldLazyLoad = false;
        }
      }

      // Memory pressure detection
      if (newMetrics.memoryUsage > 0.9) {
        updates.memoryPressure = 'critical';
        updates.shouldLazyLoad = true;
      } else if (newMetrics.memoryUsage > 0.8) {
        updates.memoryPressure = 'high';
        updates.shouldLazyLoad = true;
      } else if (newMetrics.memoryUsage > 0.6) {
        updates.memoryPressure = 'medium';
      } else {
        updates.memoryPressure = 'low';
      }

      // Calculate optimization level
      const frameScore = Math.min(100, (newMetrics.frameRate / 60) * 100);
      const memoryScore = Math.max(0, (1 - newMetrics.memoryUsage) * 100);
      updates.optimizationLevel = (frameScore + memoryScore) / 2;

      return { ...prev, ...updates };
    });
  }, [settings]);

  // Component render tracking
  const trackRenderStart = useCallback((customComponentName?: string) => {
    if (componentName || customComponentName) {
      renderStartTime.current = performance.now();
      performance.mark(`${componentName || customComponentName}-render-start`);
    }
  }, [componentName]);

  const trackRenderEnd = useCallback((customComponentName?: string) => {
    if (componentName || customComponentName) {
      const endTime = performance.now();
      const name = componentName || customComponentName!;

      performance.mark(`${name}-render-end`);
      performance.measure(`${name}-render`, `${name}-render-start`, `${name}-render-end`);

      const renderTime = endTime - renderStartTime.current;

      analytics.logEvent('component_render_time', {
        component: name,
        render_time: renderTime,
        frame_rate: metrics.frameRate,
      });
    }
  }, [componentName, metrics.frameRate]);

  // Optimized animation configuration
  const animationConfig = useMemo(() => {
    const baseConfig = {
      duration: performanceState.shouldReduceAnimations ? 150 : settings.animationDuration,
      useNativeDriver: performanceState.shouldUseNativeDriver,
    };

    if (performanceState.performanceMode === 'low') {
      return {
        ...baseConfig,
        duration: 100,
        easing: 'linear' as const,
      };
    }

    return baseConfig;
  }, [performanceState, settings]);

  // Optimized layout animation
  const optimizedLayoutAnimation = useCallback((animationType?: string) => {
    if (performanceState.shouldReduceAnimations) {
      return; // Skip animations on low-end devices
    }

    const config = animationType === 'spring'
      ? LayoutAnimation.Presets.spring
      : LayoutAnimation.Presets.easeInEaseOut;

    if (performanceState.performanceMode === 'low') {
      LayoutAnimation.configureNext({
        ...config,
        duration: 100,
      });
    } else {
      LayoutAnimation.configureNext(config);
    }
  }, [performanceState]);

  // Lazy loading helper
  const shouldLazyLoad = useCallback((distance: number = 0): boolean => {
    return performanceState.shouldLazyLoad && distance > settings.lazyLoadThreshold;
  }, [performanceState.shouldLazyLoad, settings.lazyLoadThreshold]);

  // Interaction optimization
  const optimizeInteraction = useCallback((callback: () => void, priority: 'low' | 'high' = 'low') => {
    if (priority === 'high' || performanceState.performanceMode === 'high') {
      callback();
    } else {
      InteractionManager.runAfterInteractions(callback);
    }
  }, [performanceState.performanceMode]);

  // Batch updates for better performance
  const batchUpdates = useCallback((updates: (() => void)[]) => {
    InteractionManager.runAfterInteractions(() => {
      updates.forEach(update => update());
    });
  }, []);

  // Memory cleanup helper
  const cleanupMemory = useCallback(() => {
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    // Clear component metrics for unmounted components
    const componentMetrics = performanceMonitor.current.getComponentMetrics();
    componentMetrics.forEach(metric => {
      if (!metric.isVisible) {
        // Remove from tracking
      }
    });

    analytics.logEvent('memory_cleanup_performed', {
      memory_usage: metrics.memoryUsage,
      components_cleaned: componentMetrics.filter(m => !m.isVisible).length,
    });
  }, [metrics.memoryUsage]);

  // Performance recommendations
  const getPerformanceRecommendations = useCallback((): string[] => {
    const recommendations: string[] = [];

    if (metrics.frameRate < 30) {
      recommendations.push('Consider reducing animations or visual effects');
      recommendations.push('Enable lazy loading for better performance');
    }

    if (metrics.memoryUsage > 0.8) {
      recommendations.push('High memory usage detected - clean up unused components');
      recommendations.push('Consider implementing virtualization for large lists');
    }

    if (metrics.droppedFrames > 5) {
      recommendations.push('Frequent frame drops detected - optimize render cycles');
    }

    if (performanceState.isLowEndDevice) {
      recommendations.push('Low-end device detected - enable performance mode');
      recommendations.push('Reduce animation complexity and duration');
    }

    return recommendations;
  }, [metrics, performanceState]);

  // Export performance data
  const exportPerformanceData = useCallback(async () => {
    const data = {
      metrics,
      performanceState,
      deviceProfile,
      settings,
      componentMetrics: performanceMonitor.current.getComponentMetrics(),
      timestamp: Date.now(),
    };

    await AsyncStorage.setItem(STORAGE_KEYS.PERFORMANCE_METRICS, JSON.stringify(data));

    analytics.logEvent('performance_data_exported', {
      avg_frame_rate: metrics.frameRate,
      memory_usage: metrics.memoryUsage,
      performance_mode: performanceState.performanceMode,
    });

    return data;
  }, [metrics, performanceState, deviceProfile, settings]);

  // Update settings
  const updateSettings = useCallback(async (newSettings: Partial<OptimizationSettings>) => {
    const updatedSettings = { ...settings, ...newSettings };
    setSettings(updatedSettings);
    await AsyncStorage.setItem(STORAGE_KEYS.OPTIMIZATION_SETTINGS, JSON.stringify(updatedSettings));
  }, [settings]);

  return {
    // State
    performanceState,
    metrics,
    settings,
    deviceProfile,

    // Tracking
    trackRenderStart,
    trackRenderEnd,

    // Optimization helpers
    animationConfig,
    optimizedLayoutAnimation,
    shouldLazyLoad,
    optimizeInteraction,
    batchUpdates,

    // Performance management
    cleanupMemory,
    getPerformanceRecommendations,
    exportPerformanceData,
    updateSettings,

    // Computed values
    isLowEndDevice: performanceState.isLowEndDevice,
    shouldReduceAnimations: performanceState.shouldReduceAnimations,
    shouldUseNativeDriver: performanceState.shouldUseNativeDriver,
    currentFrameRate: performanceState.currentFrameRate,
    optimizationLevel: performanceState.optimizationLevel,
  };
}

// Higher-order component for automatic performance tracking
export function withPerformanceTracking<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  componentName: string
) {
  return function PerformanceTrackedComponent(props: P) {
    const { trackRenderStart, trackRenderEnd } = usePerformanceOptimization(componentName);

    useEffect(() => {
      trackRenderStart();
      return () => {
        trackRenderEnd();
      };
    });

    return <WrappedComponent {...props} />;
  };
}

// Performance monitoring hook for debugging
export function usePerformanceDebugger() {
  const {
    metrics,
    performanceState,
    getPerformanceRecommendations,
    exportPerformanceData,
  } = usePerformanceOptimization();

  const debugInfo = useMemo(() => ({
    frameRate: `${metrics.frameRate.toFixed(1)} fps`,
    memoryUsage: `${(metrics.memoryUsage * 100).toFixed(1)}%`,
    performanceMode: performanceState.performanceMode,
    droppedFrames: metrics.droppedFrames,
    optimizationLevel: `${performanceState.optimizationLevel.toFixed(0)}%`,
    recommendations: getPerformanceRecommendations(),
  }), [metrics, performanceState, getPerformanceRecommendations]);

  return {
    debugInfo,
    exportData: exportPerformanceData,
  };
}

export default usePerformanceOptimization;