/**
 * Event Sourcing Service
 * Provides complete audit trail and event-driven architecture
 * All state changes are captured as immutable events
 */

import EventEmitter from 'eventemitter3';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from './loggerService';
import { cacheService } from './cacheService';
import { supabase } from '../config/supabase';

// Event Types
export enum EventType {
  // User Events
  USER_CREATED = 'USER_CREATED',
  USER_UPDATED = 'USER_UPDATED',
  USER_DELETED = 'USER_DELETED',
  USER_LOGIN = 'USER_LOGIN',
  USER_LOGOUT = 'USER_LOGOUT',
  USER_PASSWORD_CHANGED = 'USER_PASSWORD_CHANGED',
  USER_PREFERENCES_UPDATED = 'USER_PREFERENCES_UPDATED',
  USER_SUBSCRIPTION_CHANGED = 'USER_SUBSCRIPTION_CHANGED',

  // Parking Events
  PARKING_STARTED = 'PARKING_STARTED',
  PARKING_ENDED = 'PARKING_ENDED',
  PARKING_LOCATION_SAVED = 'PARKING_LOCATION_SAVED',
  PARKING_PHOTO_ADDED = 'PARKING_PHOTO_ADDED',
  PARKING_NOTE_ADDED = 'PARKING_NOTE_ADDED',
  PARKING_REMINDER_SET = 'PARKING_REMINDER_SET',
  PARKING_REMINDER_TRIGGERED = 'PARKING_REMINDER_TRIGGERED',
  PARKING_PAYMENT_PROCESSED = 'PARKING_PAYMENT_PROCESSED',

  // Navigation Events
  NAVIGATION_STARTED = 'NAVIGATION_STARTED',
  NAVIGATION_ROUTE_CALCULATED = 'NAVIGATION_ROUTE_CALCULATED',
  NAVIGATION_WAYPOINT_REACHED = 'NAVIGATION_WAYPOINT_REACHED',
  NAVIGATION_COMPLETED = 'NAVIGATION_COMPLETED',
  NAVIGATION_CANCELLED = 'NAVIGATION_CANCELLED',
  NAVIGATION_ERROR = 'NAVIGATION_ERROR',

  // Location Events
  LOCATION_TRACKED = 'LOCATION_TRACKED',
  LOCATION_SAVED = 'LOCATION_SAVED',
  LOCATION_SHARED = 'LOCATION_SHARED',
  LOCATION_DELETED = 'LOCATION_DELETED',
  GEOFENCE_ENTERED = 'GEOFENCE_ENTERED',
  GEOFENCE_EXITED = 'GEOFENCE_EXITED',

  // Safety Events
  PANIC_TRIGGERED = 'PANIC_TRIGGERED',
  PANIC_RESOLVED = 'PANIC_RESOLVED',
  SAFETY_CHECK_IN = 'SAFETY_CHECK_IN',
  EMERGENCY_CONTACT_NOTIFIED = 'EMERGENCY_CONTACT_NOTIFIED',
  LOCATION_SHARE_STARTED = 'LOCATION_SHARE_STARTED',
  LOCATION_SHARE_ENDED = 'LOCATION_SHARE_ENDED',

  // Payment Events
  PAYMENT_INITIATED = 'PAYMENT_INITIATED',
  PAYMENT_COMPLETED = 'PAYMENT_COMPLETED',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  REFUND_PROCESSED = 'REFUND_PROCESSED',
  SUBSCRIPTION_PURCHASED = 'SUBSCRIPTION_PURCHASED',
  SUBSCRIPTION_CANCELLED = 'SUBSCRIPTION_CANCELLED',
  SUBSCRIPTION_RENEWED = 'SUBSCRIPTION_RENEWED',

  // System Events
  APP_OPENED = 'APP_OPENED',
  APP_CLOSED = 'APP_CLOSED',
  APP_CRASHED = 'APP_CRASHED',
  APP_UPDATED = 'APP_UPDATED',
  PERMISSION_GRANTED = 'PERMISSION_GRANTED',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  NETWORK_STATUS_CHANGED = 'NETWORK_STATUS_CHANGED',
  BATTERY_LOW = 'BATTERY_LOW',

  // Analytics Events
  FEATURE_USED = 'FEATURE_USED',
  BUTTON_CLICKED = 'BUTTON_CLICKED',
  SCREEN_VIEWED = 'SCREEN_VIEWED',
  ERROR_OCCURRED = 'ERROR_OCCURRED',
  PERFORMANCE_METRIC = 'PERFORMANCE_METRIC',
}

// Event Interface
export interface Event {
  id: string;
  type: EventType;
  aggregateId: string;
  aggregateType: string;
  userId?: string;
  timestamp: string;
  version: number;
  data: any;
  metadata?: {
    deviceId?: string;
    platform?: string;
    appVersion?: string;
    location?: {
      latitude: number;
      longitude: number;
    };
    ipAddress?: string;
    userAgent?: string;
    correlationId?: string;
    causationId?: string;
  };
}

// Snapshot Interface
export interface Snapshot {
  aggregateId: string;
  aggregateType: string;
  version: number;
  data: any;
  timestamp: string;
}

// Event Store Configuration
interface EventStoreConfig {
  batchSize: number;
  snapshotFrequency: number;
  retentionDays: number;
  enableCompression: boolean;
  enableEncryption: boolean;
}

class EventSourcingService extends EventEmitter {
  private eventStore: Event[] = [];
  private snapshots: Map<string, Snapshot> = new Map();
  private eventHandlers: Map<EventType, Array<(event: Event) => void>> = new Map();
  private projections: Map<string, any> = new Map();
  private isInitialized = false;
  private syncQueue: Event[] = [];
  private isSyncing = false;

  private config: EventStoreConfig = {
    batchSize: 100,
    snapshotFrequency: 10,
    retentionDays: 90,
    enableCompression: true,
    enableEncryption: true,
  };

  /**
   * Initialize the event store
   */
  async initialize(): Promise<void> {
    try {
      // Load events from local storage
      await this.loadEventsFromStorage();

      // Load snapshots
      await this.loadSnapshots();

      // Start background sync
      this.startBackgroundSync();

      // Register default event handlers
      this.registerDefaultHandlers();

      this.isInitialized = true;
      logger.info('Event Sourcing Service initialized');
    } catch (error) {
      logger.error('Failed to initialize Event Sourcing Service:', error);
      throw error;
    }
  }

  /**
   * Append event to the event store
   */
  async appendEvent(
    type: EventType,
    aggregateId: string,
    aggregateType: string,
    data: any,
    metadata?: any
  ): Promise<Event> {
    const event: Event = {
      id: this.generateEventId(),
      type,
      aggregateId,
      aggregateType,
      userId: metadata?.userId,
      timestamp: new Date().toISOString(),
      version: await this.getNextVersion(aggregateId),
      data,
      metadata: {
        ...metadata,
        deviceId: await this.getDeviceId(),
        platform: 'mobile',
        appVersion: '1.0.0',
      },
    };

    // Store event locally
    this.eventStore.push(event);
    await this.saveEventToStorage(event);

    // Add to sync queue
    this.syncQueue.push(event);

    // Process event handlers
    await this.processEvent(event);

    // Update projections
    await this.updateProjections(event);

    // Check if snapshot is needed
    if (event.version % this.config.snapshotFrequency === 0) {
      await this.createSnapshot(aggregateId, aggregateType);
    }

    // Emit event for real-time updates
    this.emit(event.type, event);
    this.emit('event', event);

    // Log audit trail
    logger.info(`Event appended: ${event.type}`, {
      aggregateId,
      version: event.version,
    });

    return event;
  }

  /**
   * Get events for an aggregate
   */
  async getEvents(
    aggregateId: string,
    fromVersion?: number,
    toVersion?: number
  ): Promise<Event[]> {
    // Try cache first
    const cacheKey = `events:${aggregateId}:${fromVersion || 0}:${toVersion || 'latest'}`;
    const cached = await cacheService.get<Event[]>(cacheKey);
    if (cached) return cached;

    // Get from store
    let events = this.eventStore.filter(e => e.aggregateId === aggregateId);

    if (fromVersion !== undefined) {
      events = events.filter(e => e.version >= fromVersion);
    }

    if (toVersion !== undefined) {
      events = events.filter(e => e.version <= toVersion);
    }

    // Cache result
    await cacheService.set(cacheKey, events, { ttl: 300 });

    return events.sort((a, b) => a.version - b.version);
  }

  /**
   * Replay events to rebuild state
   */
  async replayEvents(
    aggregateId: string,
    handler: (event: Event) => void,
    fromVersion?: number
  ): Promise<void> {
    // Check for snapshot
    const snapshot = this.snapshots.get(aggregateId);
    let startVersion = fromVersion || 0;
    let state = {};

    if (snapshot && (!fromVersion || snapshot.version <= fromVersion)) {
      state = snapshot.data;
      startVersion = snapshot.version + 1;
    }

    // Get events after snapshot
    const events = await this.getEvents(aggregateId, startVersion);

    // Replay events
    for (const event of events) {
      handler(event);
    }
  }

  /**
   * Create projection from events
   */
  async createProjection<T>(
    name: string,
    aggregateType: string,
    projector: (state: T, event: Event) => T,
    initialState: T
  ): Promise<T> {
    // Check cache
    const cached = this.projections.get(name);
    if (cached) return cached;

    // Build projection
    const events = this.eventStore
      .filter(e => e.aggregateType === aggregateType)
      .sort((a, b) => a.version - b.version);

    let state = initialState;
    for (const event of events) {
      state = projector(state, event);
    }

    // Cache projection
    this.projections.set(name, state);

    return state;
  }

  /**
   * Query events with filters
   */
  async queryEvents(filters: {
    type?: EventType | EventType[];
    aggregateType?: string;
    userId?: string;
    from?: Date;
    to?: Date;
    limit?: number;
  }): Promise<Event[]> {
    let events = [...this.eventStore];

    // Apply filters
    if (filters.type) {
      const types = Array.isArray(filters.type) ? filters.type : [filters.type];
      events = events.filter(e => types.includes(e.type));
    }

    if (filters.aggregateType) {
      events = events.filter(e => e.aggregateType === filters.aggregateType);
    }

    if (filters.userId) {
      events = events.filter(e => e.userId === filters.userId);
    }

    if (filters.from) {
      events = events.filter(e => new Date(e.timestamp) >= filters.from!);
    }

    if (filters.to) {
      events = events.filter(e => new Date(e.timestamp) <= filters.to!);
    }

    // Sort by timestamp
    events.sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // Apply limit
    if (filters.limit) {
      events = events.slice(0, filters.limit);
    }

    return events;
  }

  /**
   * Register event handler
   */
  registerHandler(type: EventType, handler: (event: Event) => void): void {
    if (!this.eventHandlers.has(type)) {
      this.eventHandlers.set(type, []);
    }
    this.eventHandlers.get(type)!.push(handler);
  }

  /**
   * Process event through handlers
   */
  private async processEvent(event: Event): Promise<void> {
    const handlers = this.eventHandlers.get(event.type) || [];

    for (const handler of handlers) {
      try {
        await handler(event);
      } catch (error) {
        logger.error(`Event handler error for ${event.type}:`, error);
      }
    }
  }

  /**
   * Update projections based on new event
   */
  private async updateProjections(event: Event): Promise<void> {
    // Invalidate affected projections
    for (const [name, projection] of this.projections) {
      if (this.isProjectionAffected(name, event)) {
        this.projections.delete(name);
      }
    }
  }

  /**
   * Check if projection is affected by event
   */
  private isProjectionAffected(projectionName: string, event: Event): boolean {
    // Define projection dependencies
    const dependencies: Record<string, EventType[]> = {
      'userStats': [
        EventType.USER_LOGIN,
        EventType.PARKING_STARTED,
        EventType.PARKING_ENDED,
      ],
      'parkingHistory': [
        EventType.PARKING_STARTED,
        EventType.PARKING_ENDED,
        EventType.PARKING_LOCATION_SAVED,
      ],
      'paymentSummary': [
        EventType.PAYMENT_COMPLETED,
        EventType.REFUND_PROCESSED,
        EventType.SUBSCRIPTION_PURCHASED,
      ],
    };

    return dependencies[projectionName]?.includes(event.type) || false;
  }

  /**
   * Create snapshot of current state
   */
  private async createSnapshot(
    aggregateId: string,
    aggregateType: string
  ): Promise<void> {
    const events = await this.getEvents(aggregateId);
    const lastEvent = events[events.length - 1];

    if (!lastEvent) return;

    // Build current state from events
    const state = await this.buildStateFromEvents(events, aggregateType);

    const snapshot: Snapshot = {
      aggregateId,
      aggregateType,
      version: lastEvent.version,
      data: state,
      timestamp: new Date().toISOString(),
    };

    this.snapshots.set(aggregateId, snapshot);
    await this.saveSnapshotToStorage(snapshot);

    logger.info(`Snapshot created for ${aggregateId} at version ${snapshot.version}`);
  }

  /**
   * Build state from events
   */
  private async buildStateFromEvents(
    events: Event[],
    aggregateType: string
  ): Promise<any> {
    let state: any = {};

    for (const event of events) {
      state = this.applyEvent(state, event, aggregateType);
    }

    return state;
  }

  /**
   * Apply event to state (Event Sourcing pattern)
   */
  private applyEvent(state: any, event: Event, aggregateType: string): any {
    // Define state transitions based on aggregate type
    switch (aggregateType) {
      case 'User':
        return this.applyUserEvent(state, event);
      case 'ParkingSession':
        return this.applyParkingEvent(state, event);
      case 'Payment':
        return this.applyPaymentEvent(state, event);
      default:
        return { ...state, ...event.data };
    }
  }

  /**
   * Apply user events to state
   */
  private applyUserEvent(state: any, event: Event): any {
    switch (event.type) {
      case EventType.USER_CREATED:
        return { ...event.data };
      case EventType.USER_UPDATED:
        return { ...state, ...event.data };
      case EventType.USER_PREFERENCES_UPDATED:
        return { ...state, preferences: { ...state.preferences, ...event.data } };
      default:
        return state;
    }
  }

  /**
   * Apply parking events to state
   */
  private applyParkingEvent(state: any, event: Event): any {
    switch (event.type) {
      case EventType.PARKING_STARTED:
        return {
          ...state,
          status: 'active',
          startTime: event.data.startTime,
          location: event.data.location,
        };
      case EventType.PARKING_ENDED:
        return {
          ...state,
          status: 'completed',
          endTime: event.data.endTime,
          duration: event.data.duration,
        };
      case EventType.PARKING_PHOTO_ADDED:
        return {
          ...state,
          photos: [...(state.photos || []), event.data.photo],
        };
      default:
        return state;
    }
  }

  /**
   * Apply payment events to state
   */
  private applyPaymentEvent(state: any, event: Event): any {
    switch (event.type) {
      case EventType.PAYMENT_INITIATED:
        return {
          ...state,
          status: 'pending',
          amount: event.data.amount,
        };
      case EventType.PAYMENT_COMPLETED:
        return {
          ...state,
          status: 'completed',
          transactionId: event.data.transactionId,
        };
      case EventType.PAYMENT_FAILED:
        return {
          ...state,
          status: 'failed',
          error: event.data.error,
        };
      default:
        return state;
    }
  }

  /**
   * Storage methods
   */
  private async saveEventToStorage(event: Event): Promise<void> {
    try {
      const key = `@event:${event.id}`;
      await AsyncStorage.setItem(key, JSON.stringify(event));

      // Update index
      const indexKey = `@eventIndex:${event.aggregateId}`;
      const index = await AsyncStorage.getItem(indexKey);
      const eventIds = index ? JSON.parse(index) : [];
      eventIds.push(event.id);
      await AsyncStorage.setItem(indexKey, JSON.stringify(eventIds));
    } catch (error) {
      logger.error('Failed to save event to storage:', error);
    }
  }

  private async loadEventsFromStorage(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const eventKeys = keys.filter(k => k.startsWith('@event:'));

      const events = await AsyncStorage.multiGet(eventKeys);
      this.eventStore = events
        .map(([_, value]) => value ? JSON.parse(value) : null)
        .filter(Boolean)
        .sort((a, b) => a.version - b.version);

      logger.info(`Loaded ${this.eventStore.length} events from storage`);
    } catch (error) {
      logger.error('Failed to load events from storage:', error);
    }
  }

  private async saveSnapshotToStorage(snapshot: Snapshot): Promise<void> {
    try {
      const key = `@snapshot:${snapshot.aggregateId}`;
      await AsyncStorage.setItem(key, JSON.stringify(snapshot));
    } catch (error) {
      logger.error('Failed to save snapshot:', error);
    }
  }

  private async loadSnapshots(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const snapshotKeys = keys.filter(k => k.startsWith('@snapshot:'));

      const snapshots = await AsyncStorage.multiGet(snapshotKeys);
      snapshots.forEach(([key, value]) => {
        if (value) {
          const snapshot = JSON.parse(value);
          this.snapshots.set(snapshot.aggregateId, snapshot);
        }
      });

      logger.info(`Loaded ${this.snapshots.size} snapshots`);
    } catch (error) {
      logger.error('Failed to load snapshots:', error);
    }
  }

  /**
   * Background sync to server
   */
  private async startBackgroundSync(): Promise<void> {
    setInterval(async () => {
      if (this.isSyncing || this.syncQueue.length === 0) return;

      this.isSyncing = true;
      const batch = this.syncQueue.splice(0, this.config.batchSize);

      try {
        await this.syncEventsToServer(batch);
      } catch (error) {
        // Re-add to queue on failure
        this.syncQueue.unshift(...batch);
        logger.error('Event sync failed:', error);
      } finally {
        this.isSyncing = false;
      }
    }, 30000); // Sync every 30 seconds
  }

  private async syncEventsToServer(events: Event[]): Promise<void> {
    if (events.length === 0) return;

    const { error } = await supabase
      .from('events')
      .insert(events);

    if (error) {
      throw error;
    }

    logger.info(`Synced ${events.length} events to server`);
  }

  /**
   * Register default event handlers
   */
  private registerDefaultHandlers(): void {
    // Audit critical events
    this.registerHandler(EventType.USER_DELETED, async (event) => {
      logger.warn('User deleted', { userId: event.userId });
    });

    this.registerHandler(EventType.PANIC_TRIGGERED, async (event) => {
      logger.error('Panic triggered', event);
    });

    this.registerHandler(EventType.PAYMENT_FAILED, async (event) => {
      logger.error('Payment failed', event);
    });
  }

  /**
   * Utility methods
   */
  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async getNextVersion(aggregateId: string): Promise<number> {
    const events = await this.getEvents(aggregateId);
    return events.length > 0 ? events[events.length - 1].version + 1 : 1;
  }

  private async getDeviceId(): Promise<string> {
    let deviceId = await AsyncStorage.getItem('@deviceId');
    if (!deviceId) {
      deviceId = `dev_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await AsyncStorage.setItem('@deviceId', deviceId);
    }
    return deviceId;
  }

  /**
   * Export audit trail
   */
  async exportAuditTrail(
    userId: string,
    from?: Date,
    to?: Date
  ): Promise<string> {
    const events = await this.queryEvents({
      userId,
      from,
      to,
    });

    return JSON.stringify(events, null, 2);
  }

  /**
   * Get statistics
   */
  async getStatistics(): Promise<{
    totalEvents: number;
    eventsByType: Record<string, number>;
    eventsPerDay: number;
    snapshotCount: number;
    queueSize: number;
  }> {
    const eventsByType: Record<string, number> = {};

    this.eventStore.forEach(event => {
      eventsByType[event.type] = (eventsByType[event.type] || 0) + 1;
    });

    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const recentEvents = this.eventStore.filter(
      e => new Date(e.timestamp) > dayAgo
    );

    return {
      totalEvents: this.eventStore.length,
      eventsByType,
      eventsPerDay: recentEvents.length,
      snapshotCount: this.snapshots.size,
      queueSize: this.syncQueue.length,
    };
  }
}

export const eventSourcingService = new EventSourcingService();

// Helper function to track events
export async function trackEvent(
  type: EventType,
  data: any,
  metadata?: any
): Promise<void> {
  const aggregateId = metadata?.aggregateId || 'system';
  const aggregateType = metadata?.aggregateType || 'System';

  await eventSourcingService.appendEvent(
    type,
    aggregateId,
    aggregateType,
    data,
    metadata
  );
}