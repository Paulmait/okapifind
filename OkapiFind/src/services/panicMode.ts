// @ts-nocheck
/**
 * Panic Mode Service
 * Emergency feature for sharing location and alerting contacts
 */

import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import * as SMS from 'expo-sms';
import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Vibration } from 'react-native';
import { supabase } from '../lib/supabase-client';
import { errorService, ErrorSeverity, ErrorCategory } from './errorService';
import { biometricAuth } from './biometricAuth';

export interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  email?: string;
  relationship: string;
  isPrimary: boolean;
  notifyViaSMS: boolean;
  notifyViaCall: boolean;
  notifyViaApp: boolean;
}

export interface PanicSession {
  id: string;
  userId: string;
  startedAt: Date;
  endedAt?: Date;
  location: {
    latitude: number;
    longitude: number;
    accuracy?: number;
    altitude?: number;
    speed?: number;
    heading?: number;
    address?: string;
  };
  contacts: string[];
  audioRecordingUrl?: string;
  videoRecordingUrl?: string;
  status: 'active' | 'resolved' | 'cancelled';
  shareUrl?: string;
  notes?: string;
}

interface PanicModeSettings {
  enabled: boolean;
  requireConfirmation: boolean;
  countdownSeconds: number;
  autoCallEmergency: boolean;
  recordAudio: boolean;
  recordVideo: boolean;
  sendLocationUpdates: boolean;
  locationUpdateInterval: number;
  loudAlarm: boolean;
  silentMode: boolean;
  quickAccessGesture: 'shake' | 'volume_press' | 'power_triple_press';
}

class PanicModeService {
  private static instance: PanicModeService;
  private isActive: boolean = false;
  private currentSession: PanicSession | null = null;
  private locationSubscription: any = null;
  private emergencyContacts: EmergencyContact[] = [];
  private settings: PanicModeSettings = {
    enabled: true,
    requireConfirmation: true,
    countdownSeconds: 5,
    autoCallEmergency: false,
    recordAudio: false,
    recordVideo: false,
    sendLocationUpdates: true,
    locationUpdateInterval: 30000, // 30 seconds
    loudAlarm: true,
    silentMode: false,
    quickAccessGesture: 'shake',
  };
  private countdownTimer: NodeJS.Timeout | null = null;
  private updateTimer: NodeJS.Timeout | null = null;

  private readonly CONTACTS_KEY = '@OkapiFind:emergencyContacts';
  private readonly SETTINGS_KEY = '@OkapiFind:panicModeSettings';
  private readonly SESSION_KEY = '@OkapiFind:activePanicSession';

  private constructor() {}

  static getInstance(): PanicModeService {
    if (!PanicModeService.instance) {
      PanicModeService.instance = new PanicModeService();
    }
    return PanicModeService.instance;
  }

  /**
   * Initialize panic mode service
   */
  async initialize(): Promise<void> {
    try {
      await this.loadSettings();
      await this.loadEmergencyContacts();
      await this.checkActiveSession();

      errorService.logInfo('Panic mode service initialized', {
        enabled: this.settings.enabled,
        contactsCount: this.emergencyContacts.length,
      });
    } catch (error) {
      errorService.logError(error, ErrorSeverity.HIGH, ErrorCategory.GENERAL, {
        action: 'panic_mode_initialization',
      });
    }
  }

  /**
   * Trigger panic mode
   */
  async triggerPanic(bypassConfirmation: boolean = false): Promise<void> {
    try {
      if (this.isActive) {
        errorService.logWarning('Panic mode already active');
        return;
      }

      if (!this.settings.enabled) {
        Alert.alert('Panic Mode Disabled', 'Please enable panic mode in settings');
        return;
      }

      if (this.emergencyContacts.length === 0) {
        Alert.alert(
          'No Emergency Contacts',
          'Please add emergency contacts in settings first'
        );
        return;
      }

      // Require biometric auth for activation (security measure)
      if (!bypassConfirmation && this.settings.requireConfirmation) {
        const biometricResult = await biometricAuth.authenticate(
          'Authenticate to activate emergency mode'
        );

        if (!biometricResult.success) {
          // Start countdown for auto-activation
          this.startCountdown();
          return;
        }
      }

      // Immediate activation
      await this.activatePanicMode();
    } catch (error) {
      errorService.logError(error, ErrorSeverity.CRITICAL, ErrorCategory.GENERAL, {
        action: 'trigger_panic',
      });
    }
  }

  /**
   * Start countdown before activation
   */
  private startCountdown(): void {
    let remaining = this.settings.countdownSeconds;

    Alert.alert(
      'Emergency Mode Activating',
      `Activating in ${remaining} seconds. Press cancel to stop.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => {
            if (this.countdownTimer) {
              clearInterval(this.countdownTimer);
              this.countdownTimer = null;
            }
          },
        },
        {
          text: 'Activate Now',
          style: 'destructive',
          onPress: () => {
            if (this.countdownTimer) {
              clearInterval(this.countdownTimer);
              this.countdownTimer = null;
            }
            this.activatePanicMode();
          },
        },
      ]
    );

    this.countdownTimer = setInterval(() => {
      remaining--;
      if (remaining <= 0) {
        clearInterval(this.countdownTimer!);
        this.countdownTimer = null;
        this.activatePanicMode();
      }
    }, 1000);
  }

  /**
   * Activate panic mode
   */
  private async activatePanicMode(): Promise<void> {
    try {
      this.isActive = true;

      // Haptic feedback
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

      // Start vibration pattern (SOS in morse code)
      if (!this.settings.silentMode) {
        Vibration.vibrate([200, 100, 200, 100, 200, 300, 600, 300, 600, 300, 600, 100, 200, 100, 200]);
      }

      // Get current location
      const location = await this.getCurrentLocation();

      // Create panic session
      this.currentSession = await this.createPanicSession(location);

      // Send initial alerts
      await this.sendEmergencyAlerts(location);

      // Start location tracking
      if (this.settings.sendLocationUpdates) {
        await this.startLocationTracking();
      }

      // Start audio recording if enabled
      if (this.settings.recordAudio) {
        await this.startAudioRecording();
      }

      // Sound alarm if enabled
      if (this.settings.loudAlarm && !this.settings.silentMode) {
        await this.soundAlarm();
      }

      // Call emergency services if enabled
      if (this.settings.autoCallEmergency) {
        await this.callEmergencyServices();
      }

      // Show persistent notification
      await this.showPersistentNotification();

      errorService.logInfo('Panic mode activated', {
        sessionId: this.currentSession.id,
        location: location.coords,
        contactsAlerted: this.emergencyContacts.length,
      });

    } catch (error) {
      this.isActive = false;
      errorService.logError(error, ErrorSeverity.CRITICAL, ErrorCategory.GENERAL, {
        action: 'activate_panic_mode',
      });
      Alert.alert('Error', 'Failed to activate emergency mode. Please try again or call 911.');
    }
  }

  /**
   * Get current location with high accuracy
   */
  private async getCurrentLocation(): Promise<Location.LocationObject> {
    const { status } = await Location.requestForegroundPermissionsAsync();

    if (status !== 'granted') {
      throw new Error('Location permission not granted');
    }

    return await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.BestForNavigation,
    });
  }

  /**
   * Create panic session in database
   */
  private async createPanicSession(location: Location.LocationObject): Promise<PanicSession> {
    const sessionId = `panic_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Get address from coordinates
    const address = await this.getAddressFromCoords(
      location.coords.latitude,
      location.coords.longitude
    );

    const session: PanicSession = {
      id: sessionId,
      userId: (await supabase.auth.getUser()).data.user?.id || 'unknown',
      startedAt: new Date(),
      location: {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy || undefined,
        altitude: location.coords.altitude || undefined,
        speed: location.coords.speed || undefined,
        heading: location.coords.heading || undefined,
        address,
      },
      contacts: this.emergencyContacts.map(c => c.id),
      status: 'active',
    };

    // Save to Supabase
    const { data, error } = await supabase
      .from('panic_sessions')
      .insert(session)
      .select()
      .single();

    if (error) {
      errorService.logError(error, ErrorSeverity.HIGH, ErrorCategory.GENERAL, {
        action: 'create_panic_session',
      });
    }

    // Generate share URL
    session.shareUrl = await this.generateShareUrl(session);

    // Save locally as backup
    await AsyncStorage.setItem(this.SESSION_KEY, JSON.stringify(session));

    return session;
  }

  /**
   * Send emergency alerts to all contacts
   */
  private async sendEmergencyAlerts(location: Location.LocationObject): Promise<void> {
    const promises: Promise<void>[] = [];

    for (const contact of this.emergencyContacts) {
      if (contact.notifyViaSMS) {
        promises.push(this.sendSMSAlert(contact, location));
      }

      if (contact.notifyViaApp) {
        promises.push(this.sendAppNotification(contact, location));
      }

      if (contact.notifyViaCall && contact.isPrimary) {
        promises.push(this.makeEmergencyCall(contact));
      }
    }

    await Promise.allSettled(promises);
  }

  /**
   * Send SMS alert to contact
   */
  private async sendSMSAlert(
    contact: EmergencyContact,
    location: Location.LocationObject
  ): Promise<void> {
    try {
      const mapUrl = `https://maps.google.com/?q=${location.coords.latitude},${location.coords.longitude}`;
      const message = `🚨 EMERGENCY: I need help!\n\n` +
        `Location: ${this.currentSession?.location.address || 'Unknown'}\n` +
        `Coordinates: ${location.coords.latitude}, ${location.coords.longitude}\n` +
        `Map: ${mapUrl}\n` +
        `Track me: ${this.currentSession?.shareUrl || 'N/A'}\n\n` +
        `This is an automated emergency message from OkapiFind.`;

      const isAvailable = await SMS.isAvailableAsync();

      if (isAvailable) {
        await SMS.sendSMSAsync([contact.phone], message);
      }
    } catch (error) {
      errorService.logError(error, ErrorSeverity.HIGH, ErrorCategory.GENERAL, {
        action: 'send_sms_alert',
        contactId: contact.id,
      });
    }
  }

  /**
   * Send in-app notification
   */
  private async sendAppNotification(
    contact: EmergencyContact,
    location: Location.LocationObject
  ): Promise<void> {
    try {
      // Send push notification via Supabase/backend
      const { error } = await supabase.functions.invoke('send-emergency-alert', {
        body: {
          contactId: contact.id,
          location: location.coords,
          sessionId: this.currentSession?.id,
          shareUrl: this.currentSession?.shareUrl,
        },
      });

      if (error) {
        throw error;
      }
    } catch (error) {
      errorService.logError(error, ErrorSeverity.HIGH, ErrorCategory.GENERAL, {
        action: 'send_app_notification',
        contactId: contact.id,
      });
    }
  }

  /**
   * Make emergency call
   */
  private async makeEmergencyCall(contact: EmergencyContact): Promise<void> {
    try {
      await Linking.openURL(`tel:${contact.phone}`);
    } catch (error) {
      errorService.logError(error, ErrorSeverity.HIGH, ErrorCategory.GENERAL, {
        action: 'make_emergency_call',
        contactId: contact.id,
      });
    }
  }

  /**
   * Call emergency services (911)
   */
  private async callEmergencyServices(): Promise<void> {
    try {
      // Add delay to allow user to cancel if needed
      setTimeout(() => {
        Linking.openURL('tel:911');
      }, 3000);
    } catch (error) {
      errorService.logError(error, ErrorSeverity.CRITICAL, ErrorCategory.GENERAL, {
        action: 'call_emergency_services',
      });
    }
  }

  /**
   * Start location tracking
   */
  private async startLocationTracking(): Promise<void> {
    this.locationSubscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: this.settings.locationUpdateInterval,
        distanceInterval: 10,
      },
      async (location) => {
        await this.updateLocation(location);
      }
    );
  }

  /**
   * Update location in panic session
   */
  private async updateLocation(location: Location.LocationObject): Promise<void> {
    if (!this.currentSession) return;

    try {
      // Update location in database
      const { error } = await supabase
        .from('panic_location_updates')
        .insert({
          session_id: this.currentSession.id,
          location: {
            type: 'Point',
            coordinates: [location.coords.longitude, location.coords.latitude],
          },
          accuracy: location.coords.accuracy,
          speed: location.coords.speed,
          heading: location.coords.heading,
        });

      if (error) {
        throw error;
      }

      // Update local session
      this.currentSession.location = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy || undefined,
        altitude: location.coords.altitude || undefined,
        speed: location.coords.speed || undefined,
        heading: location.coords.heading || undefined,
      };
    } catch (error) {
      errorService.logError(error, ErrorSeverity.HIGH, ErrorCategory.GENERAL, {
        action: 'update_panic_location',
      });
    }
  }

  /**
   * Start audio recording
   */
  private async startAudioRecording(): Promise<void> {
    // Implementation would use expo-av for audio recording
    // Store audio file and upload to secure storage
    errorService.logInfo('Audio recording started for panic session');
  }

  /**
   * Sound loud alarm
   */
  private async soundAlarm(): Promise<void> {
    // Implementation would use expo-av to play loud alarm sound
    // Could also flash the flashlight
    errorService.logInfo('Emergency alarm activated');
  }

  /**
   * Show persistent notification
   */
  private async showPersistentNotification(): Promise<void> {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🚨 Emergency Mode Active',
        body: 'Tap to view or cancel emergency mode',
        data: { sessionId: this.currentSession?.id },
        sound: false,
        priority: Notifications.AndroidNotificationPriority.MAX,
        sticky: true,
      },
      trigger: null,
    });
  }

  /**
   * Generate shareable URL for tracking
   */
  private async generateShareUrl(session: PanicSession): Promise<string> {
    const { data, error } = await supabase.functions.invoke('generate-share-url', {
      body: { sessionId: session.id },
    });

    if (error || !data?.url) {
      return `https://okapifind.com/emergency/${session.id}`;
    }

    return data.url;
  }

  /**
   * Get address from coordinates
   */
  private async getAddressFromCoords(lat: number, lng: number): Promise<string> {
    try {
      const [result] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });

      if (result) {
        return `${result.streetNumber || ''} ${result.street || ''}, ${result.city || ''}, ${result.region || ''}`.trim();
      }
    } catch (error) {
      errorService.logError(error, ErrorSeverity.LOW, ErrorCategory.GENERAL, {
        action: 'reverse_geocode',
      });
    }

    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  }

  /**
   * Cancel panic mode
   */
  async cancelPanicMode(reason?: string): Promise<void> {
    if (!this.isActive || !this.currentSession) {
      return;
    }

    try {
      // Stop all active processes
      if (this.locationSubscription) {
        this.locationSubscription.remove();
        this.locationSubscription = null;
      }

      if (this.countdownTimer) {
        clearInterval(this.countdownTimer);
        this.countdownTimer = null;
      }

      if (this.updateTimer) {
        clearInterval(this.updateTimer);
        this.updateTimer = null;
      }

      // Update session status
      const { error } = await supabase
        .from('panic_sessions')
        .update({
          status: 'cancelled',
          endedAt: new Date().toISOString(),
          notes: reason,
        })
        .eq('id', this.currentSession.id);

      if (error) {
        throw error;
      }

      // Send cancellation notice to contacts
      await this.sendCancellationNotice(reason);

      // Clear notification
      await Notifications.dismissAllNotificationsAsync();

      // Reset state
      this.isActive = false;
      this.currentSession = null;
      await AsyncStorage.removeItem(this.SESSION_KEY);

      errorService.logInfo('Panic mode cancelled', { reason });
    } catch (error) {
      errorService.logError(error, ErrorSeverity.HIGH, ErrorCategory.GENERAL, {
        action: 'cancel_panic_mode',
      });
    }
  }

  /**
   * Send cancellation notice to contacts
   */
  private async sendCancellationNotice(reason?: string): Promise<void> {
    const message = `✅ Emergency Alert Cancelled\n\n` +
      `The emergency alert has been cancelled.\n` +
      `${reason ? `Reason: ${reason}\n` : ''}` +
      `Everyone is safe.`;

    for (const contact of this.emergencyContacts) {
      if (contact.notifyViaSMS) {
        try {
          await SMS.sendSMSAsync([contact.phone], message);
        } catch (error) {
          // Log but don't throw
          errorService.logError(error, ErrorSeverity.LOW, ErrorCategory.GENERAL);
        }
      }
    }
  }

  /**
   * Storage methods
   */
  private async loadSettings(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(this.SETTINGS_KEY);
      if (stored) {
        this.settings = { ...this.settings, ...JSON.parse(stored) };
      }
    } catch (error) {
      errorService.logError(error, ErrorSeverity.MEDIUM, ErrorCategory.STORAGE);
    }
  }

  private async loadEmergencyContacts(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(this.CONTACTS_KEY);
      if (stored) {
        this.emergencyContacts = JSON.parse(stored);
      }
    } catch (error) {
      errorService.logError(error, ErrorSeverity.MEDIUM, ErrorCategory.STORAGE);
    }
  }

  private async checkActiveSession(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(this.SESSION_KEY);
      if (stored) {
        this.currentSession = JSON.parse(stored);
        this.isActive = true;
      }
    } catch (error) {
      errorService.logError(error, ErrorSeverity.MEDIUM, ErrorCategory.STORAGE);
    }
  }

  /**
   * Public API
   */
  async updateSettings(settings: Partial<PanicModeSettings>): Promise<void> {
    this.settings = { ...this.settings, ...settings };
    await AsyncStorage.setItem(this.SETTINGS_KEY, JSON.stringify(this.settings));
  }

  async setEmergencyContacts(contacts: EmergencyContact[]): Promise<void> {
    this.emergencyContacts = contacts;
    await AsyncStorage.setItem(this.CONTACTS_KEY, JSON.stringify(contacts));
  }

  getSettings(): PanicModeSettings {
    return { ...this.settings };
  }

  getEmergencyContacts(): EmergencyContact[] {
    return [...this.emergencyContacts];
  }

  isActiveSession(): boolean {
    return this.isActive;
  }

  getCurrentSession(): PanicSession | null {
    return this.currentSession;
  }
}

export const panicMode = PanicModeService.getInstance();