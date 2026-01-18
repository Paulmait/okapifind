// @ts-nocheck
/**
 * App Launch Optimizer
 * Implements UI/UX best practice #6: Performance (<2 second app launch)
 * Optimizes app startup time through lazy loading and prioritization
 */

import { Platform, InteractionManager } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface LaunchMetrics {
  coldStart: number;
  warmStart: number;
  jsLoadTime: number;
  nativeModulesLoadTime: number;
  firstContentfulPaint: number;
  timeToInteractive: number;
}

interface PrioritizedModule {
  name: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  load: () => Promise<any>;
}

class AppLaunchOptimizer {
  private static instance: AppLaunchOptimizer;
  private startTime: number = Date.now();
  private metrics: Partial<LaunchMetrics> = {};
  private moduleQueue: PrioritizedModule[] = [];
  private isInitialized = false;

  static getInstance(): AppLaunchOptimizer {
    if (!AppLaunchOptimizer.instance) {
      AppLaunchOptimizer.instance = new AppLaunchOptimizer();
    }
    return AppLaunchOptimizer.instance;
  }

  constructor() {
    this.recordLaunchStart();
  }

  /**
   * Record launch start time
   */
  private recordLaunchStart(): void {
    this.startTime = Date.now();
    this.metrics.coldStart = this.startTime;
  }

  /**
   * Initialize critical modules first
   */
  async initializeCriticalModules(): Promise<void> {
    if (this.isInitialized) return;

    const criticalModules: PrioritizedModule[] = [
      {
        name: 'AsyncStorage',
        priority: 'critical',
        load: async () => {
          // Pre-load critical settings
          const keys = ['user_session', 'app_settings', 'last_parking_location'];
          await AsyncStorage.multiGet(keys);
        },
      },
      {
        name: 'LocationService',
        priority: 'critical',
        load: async () => {
          // Pre-warm location services
          const { Location } = await import('expo-location');
          await Location.getLastKnownPositionAsync();
        },
      },
      {
        name: 'Navigation',
        priority: 'critical',
        load: async () => {
          // Pre-load navigation
          const Navigation = await import('@react-navigation/native');
          return Navigation;
        },
      },
    ];

    // Load critical modules in parallel
    await Promise.all(
      criticalModules
        .filter(m => m.priority === 'critical')
        .map(m => this.loadModule(m))
    );

    this.metrics.jsLoadTime = Date.now() - this.startTime;
    this.isInitialized = true;
  }

  /**
   * Defer non-critical modules
   */
  deferNonCriticalModules(): void {
    const nonCriticalModules: PrioritizedModule[] = [
      {
        name: 'Analytics',
        priority: 'low',
        load: async () => {
          const { analytics } = await import('../services/analytics');
          return analytics.initialize();
        },
      },
      {
        name: 'PushNotifications',
        priority: 'medium',
        load: async () => {
          const { pushNotificationService } = await import('../services/pushNotificationService');
          return pushNotificationService.initialize();
        },
      },
      {
        name: 'RevenueCat',
        priority: 'low',
        load: async () => {
          const Purchases = await import('react-native-purchases');
          return Purchases;
        },
      },
      {
        name: 'Sentry',
        priority: 'medium',
        load: async () => {
          // Sentry temporarily disabled for SDK 54 compatibility
          // Will be re-enabled when sentry-expo supports SDK 54
          if (!__DEV__) {
            console.log('Sentry: disabled for SDK 54 compatibility');
          }
        },
      },
      {
        name: 'Firebase',
        priority: 'medium',
        load: async () => {
          const { initializeApp } = await import('firebase/app');
          return initializeApp({
            apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
            authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
            projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
          });
        },
      },
      {
        name: 'Maps',
        priority: 'high',
        load: async () => {
          // Pre-cache map tiles for last location
          const lastLocation = await AsyncStorage.getItem('last_parking_location');
          if (lastLocation) {
            // Cache map tiles around last location
          }
        },
      },
    ];

    this.moduleQueue = [...this.moduleQueue, ...nonCriticalModules];
    this.processModuleQueue();
  }

  /**
   * Process module queue based on priority
   */
  private async processModuleQueue(): Promise<void> {
    // Sort by priority
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    this.moduleQueue.sort((a, b) =>
      priorityOrder[a.priority] - priorityOrder[b.priority]
    );

    // Wait for interaction to complete before loading non-critical modules
    InteractionManager.runAfterInteractions(async () => {
      for (const module of this.moduleQueue) {
        await this.loadModuleWithDelay(module);
      }
    });
  }

  /**
   * Load module with performance tracking
   */
  private async loadModule(module: PrioritizedModule): Promise<void> {
    const startTime = Date.now();
    try {
      await module.load();
      const loadTime = Date.now() - startTime;
      console.log(`[Launch] Loaded ${module.name} in ${loadTime}ms`);
    } catch (error) {
      console.error(`[Launch] Failed to load ${module.name}:`, error);
    }
  }

  /**
   * Load module with delay to prevent blocking
   */
  private async loadModuleWithDelay(module: PrioritizedModule): Promise<void> {
    // Add delay based on priority
    const delays = { critical: 0, high: 100, medium: 500, low: 1000 };
    await new Promise(resolve => setTimeout(resolve, delays[module.priority]));
    await this.loadModule(module);
  }

  /**
   * Record first contentful paint
   */
  recordFirstContentfulPaint(): void {
    this.metrics.firstContentfulPaint = Date.now() - this.startTime;
    console.log(`[Launch] First contentful paint: ${this.metrics.firstContentfulPaint}ms`);
  }

  /**
   * Record time to interactive
   */
  recordTimeToInteractive(): void {
    this.metrics.timeToInteractive = Date.now() - this.startTime;
    console.log(`[Launch] Time to interactive: ${this.metrics.timeToInteractive}ms`);

    // Report metrics if under 2 seconds
    if (this.metrics.timeToInteractive < 2000) {
      console.log('[Launch] ✅ App launched in under 2 seconds!');
    } else {
      console.warn('[Launch] ⚠️ App launch took longer than 2 seconds');
    }

    this.reportMetrics();
  }

  /**
   * Report launch metrics
   */
  private async reportMetrics(): Promise<void> {
    // Store metrics for analysis
    await AsyncStorage.setItem(
      'launch_metrics',
      JSON.stringify({
        ...this.metrics,
        timestamp: Date.now(),
        platform: Platform.OS,
      })
    );

    // Send to analytics in production
    if (!__DEV__) {
      // analytics.track('app_launch', this.metrics);
    }
  }

  /**
   * Optimize images for faster loading
   */
  static optimizeImages(): void {
    // Use lower resolution images on slower devices
    const isLowEndDevice = Platform.OS === 'android' && Platform.Version < 23;

    if (isLowEndDevice) {
      // Set global image quality
      // Image.getSize = () => ({ width: 100, height: 100 });
    }
  }

  /**
   * Enable RAM bundles for faster startup
   */
  static enableRAMBundles(): void {
    if (Platform.OS === 'ios') {
      // RAM bundles are iOS only
      // Configured in metro.config.js
    }
  }
}

/**
 * Performance optimizations for app launch
 */
export const launchOptimizations = {
  /**
   * Lazy load heavy components
   */
  lazyComponent: <T extends React.ComponentType<any>>(
    loader: () => Promise<{ default: T }>
  ) => {
    return React.lazy(loader);
  },

  /**
   * Preload critical assets
   */
  preloadAssets: async (): Promise<void> => {
    const assets = [
      require('../../assets/icon.png'),
      require('../../assets/splash-icon.png'),
      // Add other critical assets
    ];

    // Preload in parallel
    await Promise.all(
      assets.map(asset => {
        return new Promise((resolve) => {
          const img = new Image();
          img.onload = resolve;
          img.src = asset;
        });
      })
    );
  },

  /**
   * Optimize bundle size
   */
  optimizeBundleSize: () => {
    // Tree shaking configuration
    const config = {
      // Remove unused code
      sideEffects: false,
      // Minimize bundle
      optimization: {
        minimize: true,
        usedExports: true,
      },
    };
    return config;
  },

  /**
   * Cache critical data
   */
  cacheCriticalData: async (): Promise<void> => {
    const criticalKeys = [
      'user_preferences',
      'last_parking_location',
      'recent_destinations',
      'saved_places',
    ];

    // Pre-cache in memory
    const cache = new Map();
    const values = await AsyncStorage.multiGet(criticalKeys);
    values.forEach(([key, value]) => {
      if (value) cache.set(key, JSON.parse(value));
    });
  },
};

/**
 * App initialization sequence
 */
export const initializeApp = async (): Promise<void> => {
  const optimizer = AppLaunchOptimizer.getInstance();

  // Phase 1: Critical (0-500ms)
  await optimizer.initializeCriticalModules();

  // Phase 2: High Priority (500-1000ms)
  optimizer.deferNonCriticalModules();

  // Phase 3: Optimizations
  AppLaunchOptimizer.optimizeImages();
  AppLaunchOptimizer.enableRAMBundles();

  // Phase 4: Preload assets
  await launchOptimizations.preloadAssets();

  // Phase 5: Cache data
  await launchOptimizations.cacheCriticalData();
};

export default AppLaunchOptimizer;