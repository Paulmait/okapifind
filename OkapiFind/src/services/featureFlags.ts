import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export interface FeatureFlag {
  key: string;
  enabled: boolean;
  rolloutPercentage: number;
  conditions?: {
    platform?: 'ios' | 'android' | 'web';
    version?: string;
    userSegment?: string[];
  };
  variant?: string;
  experimentId?: string;
}

export interface ABTestVariant {
  id: string;
  name: string;
  weight: number;
  config: Record<string, any>;
}

export interface ABTest {
  id: string;
  name: string;
  enabled: boolean;
  variants: ABTestVariant[];
  trafficAllocation: number;
  conditions?: {
    platform?: 'ios' | 'android' | 'web';
    version?: string;
    userSegment?: string[];
  };
}

class FeatureFlagService {
  private flags: Map<string, FeatureFlag> = new Map();
  private abTests: Map<string, ABTest> = new Map();
  private userKey: string = '';
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.initializeDefaults();
    this.loadFromStorage();
    this.generateUserKey();
  }

  private initializeDefaults() {
    // Default feature flags
    const defaultFlags: FeatureFlag[] = [
      {
        key: 'new_onboarding',
        enabled: true,
        rolloutPercentage: 100,
      },
      {
        key: 'ar_navigation',
        enabled: true,
        rolloutPercentage: 50,
        conditions: {
          platform: Platform.OS as 'ios' | 'android',
        },
      },
      {
        key: 'voice_guidance',
        enabled: true,
        rolloutPercentage: 80,
      },
      {
        key: 'parking_analytics',
        enabled: false,
        rolloutPercentage: 25,
      },
      {
        key: 'premium_features',
        enabled: true,
        rolloutPercentage: 100,
      },
      {
        key: 'social_sharing',
        enabled: false,
        rolloutPercentage: 0,
      },
    ];

    defaultFlags.forEach(flag => {
      this.flags.set(flag.key, flag);
    });

    // Default A/B tests
    const defaultTests: ABTest[] = [
      {
        id: 'button_color_test',
        name: 'Button Color A/B Test',
        enabled: true,
        trafficAllocation: 50,
        variants: [
          { id: 'control', name: 'Blue Button', weight: 50, config: { buttonColor: '#007AFF' } },
          { id: 'variant_a', name: 'Green Button', weight: 50, config: { buttonColor: '#34C759' } },
        ],
      },
      {
        id: 'onboarding_flow_test',
        name: 'Onboarding Flow Test',
        enabled: true,
        trafficAllocation: 100,
        variants: [
          { id: 'control', name: 'Standard Flow', weight: 50, config: { skipPermissions: false } },
          { id: 'variant_a', name: 'Simplified Flow', weight: 50, config: { skipPermissions: true } },
        ],
      },
    ];

    defaultTests.forEach(test => {
      this.abTests.set(test.id, test);
    });
  }

  private async loadFromStorage() {
    try {
      const flagsData = await AsyncStorage.getItem('feature_flags');
      if (flagsData) {
        const parsedFlags = JSON.parse(flagsData);
        Object.entries(parsedFlags).forEach(([key, flag]) => {
          this.flags.set(key, flag as FeatureFlag);
        });
      }

      const testsData = await AsyncStorage.getItem('ab_tests');
      if (testsData) {
        const parsedTests = JSON.parse(testsData);
        Object.entries(parsedTests).forEach(([key, test]) => {
          this.abTests.set(key, test as ABTest);
        });
      }
    } catch (error) {
      console.error('Failed to load feature flags from storage:', error);
    }
  }

  private async saveToStorage() {
    try {
      const flagsObj = Object.fromEntries(this.flags);
      await AsyncStorage.setItem('feature_flags', JSON.stringify(flagsObj));

      const testsObj = Object.fromEntries(this.abTests);
      await AsyncStorage.setItem('ab_tests', JSON.stringify(testsObj));
    } catch (error) {
      console.error('Failed to save feature flags to storage:', error);
    }
  }

  private generateUserKey() {
    const userId = Math.random().toString(36).substring(2, 15);
    this.userKey = userId;
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  private isUserInRollout(key: string, percentage: number): boolean {
    const hashInput = `${this.userKey}_${key}`;
    const hash = this.hashString(hashInput);
    return (hash % 100) < percentage;
  }

  private checkConditions(conditions?: FeatureFlag['conditions']): boolean {
    if (!conditions) return true;

    if (conditions.platform && conditions.platform !== Platform.OS) {
      return false;
    }

    // Add more condition checks here (version, user segment, etc.)
    return true;
  }

  public isEnabled(flagKey: string): boolean {
    const flag = this.flags.get(flagKey);
    if (!flag) return false;

    if (!flag.enabled) return false;
    if (!this.checkConditions(flag.conditions)) return false;
    if (!this.isUserInRollout(flagKey, flag.rolloutPercentage)) return false;

    return true;
  }

  public getVariant(testId: string): ABTestVariant | null {
    const test = this.abTests.get(testId);
    if (!test || !test.enabled) return null;

    if (!this.checkConditions(test.conditions)) return null;
    if (!this.isUserInRollout(testId, test.trafficAllocation)) return null;

    // Use consistent hashing to assign user to variant
    const hashInput = `${this.userKey}_${testId}`;
    const hash = this.hashString(hashInput);
    const bucket = hash % 100;

    let cumulativeWeight = 0;
    for (const variant of test.variants) {
      cumulativeWeight += variant.weight;
      if (bucket < cumulativeWeight) {
        return variant;
      }
    }

    return test.variants[0]; // Fallback to first variant
  }

  public getConfig<T = any>(testId: string, key: string, defaultValue: T): T {
    const variant = this.getVariant(testId);
    if (!variant || !variant.config.hasOwnProperty(key)) {
      return defaultValue;
    }
    return variant.config[key] as T;
  }

  public updateFlag(flagKey: string, updates: Partial<FeatureFlag>) {
    const existing = this.flags.get(flagKey);
    if (existing) {
      const updated = { ...existing, ...updates };
      this.flags.set(flagKey, updated);
      this.saveToStorage();
      this.notifyListeners();
    }
  }

  public updateTest(testId: string, updates: Partial<ABTest>) {
    const existing = this.abTests.get(testId);
    if (existing) {
      const updated = { ...existing, ...updates };
      this.abTests.set(testId, updated);
      this.saveToStorage();
      this.notifyListeners();
    }
  }

  public getAllFlags(): FeatureFlag[] {
    return Array.from(this.flags.values());
  }

  public getAllTests(): ABTest[] {
    return Array.from(this.abTests.values());
  }

  public addListener(callback: () => void) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notifyListeners() {
    this.listeners.forEach(callback => callback());
  }

  public trackExperiment(testId: string, event: string, properties?: Record<string, any>) {
    const variant = this.getVariant(testId);
    if (variant) {
      // Track to analytics service
      console.log('Experiment tracked:', {
        testId,
        variantId: variant.id,
        event,
        properties,
        userKey: this.userKey,
      });
    }
  }

  public async fetchRemoteConfig() {
    try {
      // In a real app, this would fetch from a remote service
      // For now, we'll simulate remote config
      const remoteFlags = {
        'ar_navigation': { enabled: true, rolloutPercentage: 75 },
        'voice_guidance': { enabled: true, rolloutPercentage: 90 },
      };

      Object.entries(remoteFlags).forEach(([key, config]) => {
        this.updateFlag(key, config);
      });

      console.log('Remote config updated');
    } catch (error) {
      console.error('Failed to fetch remote config:', error);
    }
  }
}

export const featureFlagService = new FeatureFlagService();