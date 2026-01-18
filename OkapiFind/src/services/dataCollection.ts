// @ts-nocheck
/**
 * Comprehensive Data Collection Service
 * Collects user interactions, device info, location data for analytics
 */

import { v4 as uuidv4 } from 'uuid';

export interface UserData {
  userId: string;
  deviceId: string;
  sessionId: string;
  email?: string;
  name?: string;
  phone?: string;
  registrationDate: Date;
  lastActiveDate: Date;
  totalSessions: number;
  preferences: UserPreferences;
}

export interface DeviceData {
  deviceId: string;
  platform: string;
  osVersion: string;
  browser: string;
  browserVersion: string;
  screenResolution: string;
  deviceType: 'mobile' | 'tablet' | 'desktop';
  manufacturer?: string;
  model?: string;
  language: string;
  timezone: string;
  networkType?: string;
  carrier?: string;
  batteryLevel?: number;
  isCharging?: boolean;
  orientation: string;
  pixelRatio: number;
  touchPoints: number;
  hardwareConcurrency: number;
  memory?: number;
  storage?: StorageEstimate;
}

export interface LocationData {
  userId: string;
  deviceId: string;
  timestamp: Date;
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude?: number;
  altitudeAccuracy?: number;
  heading?: number;
  speed?: number;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  locationType: 'parking' | 'navigation' | 'background' | 'manual';
  parkingDuration?: number;
  searchRadius?: number;
  weatherConditions?: string;
  trafficConditions?: string;
}

export interface InteractionData {
  userId: string;
  deviceId: string;
  sessionId: string;
  timestamp: Date;
  eventType: string;
  eventCategory: string;
  eventAction: string;
  eventLabel?: string;
  eventValue?: number;
  pageUrl: string;
  pageTit
le: string;
  referrer?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  clickCoordinates?: { x: number; y: number };
  scrollDepth?: number;
  timeOnPage?: number;
  elementId?: string;
  elementClass?: string;
}

export interface SessionData {
  sessionId: string;
  userId: string;
  deviceId: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  pageViews: number;
  interactions: number;
  bounced: boolean;
  entryPage: string;
  exitPage?: string;
  locationChanges: number;
  parkingSaved: number;
  navigationStarted: number;
  errors: number;
  crashData?: any;
}

export interface UserPreferences {
  notifications: boolean;
  locationTracking: boolean;
  darkMode: boolean;
  language: string;
  units: 'metric' | 'imperial';
  autoSaveParking: boolean;
  reminderTime?: number;
  shareLocation: boolean;
  analyticsOptIn: boolean;
}

export interface AnalyticsEvent {
  name: string;
  properties: Record<string, any>;
  timestamp: Date;
  userId: string;
  deviceId: string;
  sessionId: string;
}

class DataCollectionService {
  private userId: string;
  private deviceId: string;
  private sessionId: string;
  private sessionStartTime: Date;
  private interactionQueue: InteractionData[] = [];
  private locationHistory: LocationData[] = [];
  private analyticsEndpoint = '/api/analytics';
  private batchSize = 50;
  private flushInterval = 30000; // 30 seconds
  private flushTimer?: NodeJS.Timeout;
  private pageLoadTime: number;
  private lastActivity: number;

  constructor() {
    this.userId = this.getOrCreateUserId();
    this.deviceId = this.getOrCreateDeviceId();
    this.sessionId = this.createSessionId();
    this.sessionStartTime = new Date();
    this.pageLoadTime = Date.now();
    this.lastActivity = Date.now();

    this.initialize();
  }

  private initialize() {
    // Collect device information
    this.collectDeviceData();

    // Set up event listeners
    this.setupEventListeners();

    // Start periodic flush
    this.startPeriodicFlush();

    // Track page visibility
    this.trackPageVisibility();

    // Track errors
    this.trackErrors();

    // Monitor network changes
    this.monitorNetwork();

    // Track performance metrics
    this.trackPerformance();

    // Set up geolocation tracking
    this.setupGeolocationTracking();
  }

  private getOrCreateUserId(): string {
    let userId = localStorage.getItem('userId');
    if (!userId) {
      userId = uuidv4();
      localStorage.setItem('userId', userId);
    }
    return userId;
  }

  private getOrCreateDeviceId(): string {
    let deviceId = localStorage.getItem('deviceId');
    if (!deviceId) {
      deviceId = this.generateDeviceFingerprint();
      localStorage.setItem('deviceId', deviceId);
    }
    return deviceId;
  }

  private createSessionId(): string {
    return `${this.deviceId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateDeviceFingerprint(): string {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillText('OkapiFind', 2, 2);
    }

    const fingerprint = {
      userAgent: navigator.userAgent,
      language: navigator.language,
      platform: navigator.platform,
      screenResolution: `${screen.width}x${screen.height}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      canvas: canvas.toDataURL(),
      plugins: Array.from(navigator.plugins).map(p => p.name).join(','),
      hardwareConcurrency: navigator.hardwareConcurrency,
      deviceMemory: (navigator as any).deviceMemory,
    };

    // Create hash from fingerprint
    const str = JSON.stringify(fingerprint);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }

    return `device_${Math.abs(hash).toString(36)}_${Date.now().toString(36)}`;
  }

  private async collectDeviceData(): Promise<DeviceData> {
    const ua = navigator.userAgent;
    const deviceData: DeviceData = {
      deviceId: this.deviceId,
      platform: navigator.platform,
      osVersion: this.getOSVersion(ua),
      browser: this.getBrowserName(ua),
      browserVersion: this.getBrowserVersion(ua),
      screenResolution: `${screen.width}x${screen.height}`,
      deviceType: this.getDeviceType(),
      language: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      orientation: screen.orientation?.type || 'unknown',
      pixelRatio: window.devicePixelRatio,
      touchPoints: navigator.maxTouchPoints,
      hardwareConcurrency: navigator.hardwareConcurrency,
      memory: (navigator as any).deviceMemory,
    };

    // Get battery info if available
    if ('getBattery' in navigator) {
      try {
        const battery = await (navigator as any).getBattery();
        deviceData.batteryLevel = battery.level * 100;
        deviceData.isCharging = battery.charging;
      } catch (e) {
        console.log('Battery API not available');
      }
    }

    // Get network info
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      deviceData.networkType = connection.effectiveType;
    }

    // Get storage estimate
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      try {
        deviceData.storage = await navigator.storage.estimate();
      } catch (e) {
        console.log('Storage estimate not available');
      }
    }

    this.sendData('device', deviceData);
    return deviceData;
  }

  private getOSVersion(ua: string): string {
    const osRegexes = [
      { name: 'Windows 11', regex: /Windows NT 10.0.*Win64/ },
      { name: 'Windows 10', regex: /Windows NT 10.0/ },
      { name: 'macOS', regex: /Mac OS X ([\d_.]+)/ },
      { name: 'iOS', regex: /OS ([\d_.]+) like Mac OS X/ },
      { name: 'Android', regex: /Android ([\d.]+)/ },
      { name: 'Linux', regex: /Linux/ },
    ];

    for (const os of osRegexes) {
      const match = ua.match(os.regex);
      if (match) {
        return match[1] ? `${os.name} ${match[1].replace(/_/g, '.')}` : os.name;
      }
    }

    return 'Unknown';
  }

  private getBrowserName(ua: string): string {
    if (ua.indexOf('Firefox') > -1) return 'Firefox';
    if (ua.indexOf('Edg/') > -1) return 'Edge';
    if (ua.indexOf('Chrome') > -1) return 'Chrome';
    if (ua.indexOf('Safari') > -1 && ua.indexOf('Chrome') === -1) return 'Safari';
    if (ua.indexOf('Opera') > -1 || ua.indexOf('OPR') > -1) return 'Opera';
    return 'Unknown';
  }

  private getBrowserVersion(ua: string): string {
    const browser = this.getBrowserName(ua);
    const versionRegexes: Record<string, RegExp> = {
      Firefox: /Firefox\/([\d.]+)/,
      Edge: /Edg\/([\d.]+)/,
      Chrome: /Chrome\/([\d.]+)/,
      Safari: /Version\/([\d.]+)/,
      Opera: /(?:Opera|OPR)\/([\d.]+)/,
    };

    const regex = versionRegexes[browser];
    if (regex) {
      const match = ua.match(regex);
      if (match) return match[1];
    }

    return 'Unknown';
  }

  private getDeviceType(): 'mobile' | 'tablet' | 'desktop' {
    const ua = navigator.userAgent.toLowerCase();
    if (/mobile|android|iphone|ipod/.test(ua)) return 'mobile';
    if (/tablet|ipad/.test(ua)) return 'tablet';
    return 'desktop';
  }

  private setupEventListeners() {
    // Track clicks
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      this.trackInteraction({
        eventType: 'click',
        eventCategory: 'user_interaction',
        eventAction: 'click',
        eventLabel: target.tagName,
        elementId: target.id,
        elementClass: target.className,
        clickCoordinates: { x: e.clientX, y: e.clientY },
      });
    });

    // Track form submissions
    document.addEventListener('submit', (e) => {
      const form = e.target as HTMLFormElement;
      this.trackInteraction({
        eventType: 'form_submit',
        eventCategory: 'user_interaction',
        eventAction: 'submit',
        eventLabel: form.id || form.name,
      });
    });

    // Track scroll depth
    let maxScrollDepth = 0;
    window.addEventListener('scroll', () => {
      const scrollDepth = Math.round((window.scrollY + window.innerHeight) / document.documentElement.scrollHeight * 100);
      if (scrollDepth > maxScrollDepth) {
        maxScrollDepth = scrollDepth;
        this.trackInteraction({
          eventType: 'scroll',
          eventCategory: 'user_interaction',
          eventAction: 'scroll',
          eventValue: scrollDepth,
          scrollDepth: scrollDepth,
        });
      }
    });

    // Track page unload
    window.addEventListener('beforeunload', () => {
      this.endSession();
      this.flush(true); // Force sync flush
    });
  }

  private trackPageVisibility() {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.trackInteraction({
          eventType: 'page_hidden',
          eventCategory: 'page_visibility',
          eventAction: 'hidden',
        });
        this.flush();
      } else {
        this.trackInteraction({
          eventType: 'page_visible',
          eventCategory: 'page_visibility',
          eventAction: 'visible',
        });
      }
    });
  }

  private trackErrors() {
    window.addEventListener('error', (e) => {
      this.trackInteraction({
        eventType: 'error',
        eventCategory: 'error',
        eventAction: 'javascript_error',
        eventLabel: e.message,
        eventValue: e.lineno,
      });
    });

    window.addEventListener('unhandledrejection', (e) => {
      this.trackInteraction({
        eventType: 'error',
        eventCategory: 'error',
        eventAction: 'promise_rejection',
        eventLabel: e.reason?.toString(),
      });
    });
  }

  private monitorNetwork() {
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      connection.addEventListener('change', () => {
        this.trackInteraction({
          eventType: 'network_change',
          eventCategory: 'network',
          eventAction: 'change',
          eventLabel: connection.effectiveType,
        });
      });
    }

    window.addEventListener('online', () => {
      this.trackInteraction({
        eventType: 'network_online',
        eventCategory: 'network',
        eventAction: 'online',
      });
    });

    window.addEventListener('offline', () => {
      this.trackInteraction({
        eventType: 'network_offline',
        eventCategory: 'network',
        eventAction: 'offline',
      });
    });
  }

  private trackPerformance() {
    if ('performance' in window) {
      window.addEventListener('load', () => {
        setTimeout(() => {
          const perfData = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
          if (perfData) {
            this.trackInteraction({
              eventType: 'performance',
              eventCategory: 'performance',
              eventAction: 'page_load',
              eventValue: Math.round(perfData.loadEventEnd - perfData.fetchStart),
            });
          }
        }, 1000);
      });
    }
  }

  private setupGeolocationTracking() {
    if ('geolocation' in navigator) {
      // Track location updates
      window.addEventListener('locationUpdate', (e: CustomEvent) => {
        const location = e.detail;
        this.trackLocation({
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy,
          timestamp: new Date(location.timestamp),
          locationType: 'background',
        });
      });
    }
  }

  public trackInteraction(data: Partial<InteractionData>) {
    const interaction: InteractionData = {
      userId: this.userId,
      deviceId: this.deviceId,
      sessionId: this.sessionId,
      timestamp: new Date(),
      pageUrl: window.location.href,
      pageTitle: document.title,
      referrer: document.referrer,
      eventType: data.eventType || 'unknown',
      eventCategory: data.eventCategory || 'unknown',
      eventAction: data.eventAction || 'unknown',
      ...data,
    };

    this.interactionQueue.push(interaction);
    this.lastActivity = Date.now();

    if (this.interactionQueue.length >= this.batchSize) {
      this.flush();
    }
  }

  public trackLocation(data: Partial<LocationData>) {
    const location: LocationData = {
      userId: this.userId,
      deviceId: this.deviceId,
      timestamp: new Date(),
      latitude: data.latitude || 0,
      longitude: data.longitude || 0,
      accuracy: data.accuracy || 0,
      locationType: data.locationType || 'manual',
      ...data,
    };

    this.locationHistory.push(location);
    this.sendData('location', location);

    // Keep only last 100 locations in memory
    if (this.locationHistory.length > 100) {
      this.locationHistory = this.locationHistory.slice(-100);
    }
  }

  public trackEvent(name: string, properties: Record<string, any> = {}) {
    const event: AnalyticsEvent = {
      name,
      properties,
      timestamp: new Date(),
      userId: this.userId,
      deviceId: this.deviceId,
      sessionId: this.sessionId,
    };

    this.sendData('event', event);
  }

  private startPeriodicFlush() {
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.flushInterval);
  }

  private async flush(sync = false) {
    if (this.interactionQueue.length === 0) return;

    const data = [...this.interactionQueue];
    this.interactionQueue = [];

    if (sync) {
      // Use sendBeacon for sync flush
      const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
      navigator.sendBeacon(this.analyticsEndpoint + '/batch', blob);
    } else {
      // Async flush
      this.sendData('interactions', data);
    }
  }

  private async sendData(type: string, data: any) {
    try {
      const response = await fetch(this.analyticsEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': this.userId,
          'X-Device-ID': this.deviceId,
          'X-Session-ID': this.sessionId,
        },
        body: JSON.stringify({
          type,
          data,
          timestamp: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        // Store failed data for retry
        this.storeFailedData(type, data);
      }
    } catch (error) {
      console.error('Failed to send analytics data:', error);
      this.storeFailedData(type, data);
    }
  }

  private storeFailedData(type: string, data: any) {
    try {
      const failedData = JSON.parse(localStorage.getItem('failedAnalytics') || '[]');
      failedData.push({ type, data, timestamp: Date.now() });

      // Keep only last 100 failed items
      if (failedData.length > 100) {
        failedData.shift();
      }

      localStorage.setItem('failedAnalytics', JSON.stringify(failedData));
    } catch (e) {
      console.error('Failed to store analytics data locally');
    }
  }

  private endSession() {
    const sessionData: SessionData = {
      sessionId: this.sessionId,
      userId: this.userId,
      deviceId: this.deviceId,
      startTime: this.sessionStartTime,
      endTime: new Date(),
      duration: Date.now() - this.sessionStartTime.getTime(),
      pageViews: 1, // Simplified, would track actual page views
      interactions: this.interactionQueue.length,
      bounced: Date.now() - this.pageLoadTime < 10000,
      entryPage: window.location.href,
      exitPage: window.location.href,
      locationChanges: this.locationHistory.length,
      parkingSaved: 0, // Would track actual parking saves
      navigationStarted: 0, // Would track actual navigations
      errors: 0, // Would track actual errors
    };

    this.sendData('session', sessionData);
  }

  public getUserId(): string {
    return this.userId;
  }

  public getDeviceId(): string {
    return this.deviceId;
  }

  public getSessionId(): string {
    return this.sessionId;
  }

  public getLocationHistory(): LocationData[] {
    return this.locationHistory;
  }

  public setUserInfo(info: Partial<UserData>) {
    const userData: UserData = {
      userId: this.userId,
      deviceId: this.deviceId,
      sessionId: this.sessionId,
      registrationDate: new Date(),
      lastActiveDate: new Date(),
      totalSessions: 1,
      preferences: {
        notifications: true,
        locationTracking: true,
        darkMode: false,
        language: navigator.language,
        units: 'metric',
        autoSaveParking: true,
        shareLocation: true,
        analyticsOptIn: true,
      },
      ...info,
    };

    this.sendData('user', userData);
    localStorage.setItem('userData', JSON.stringify(userData));
  }
}

// Export singleton instance
export const dataCollection = new DataCollectionService();