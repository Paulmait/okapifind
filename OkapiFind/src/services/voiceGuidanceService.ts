/**
 * Voice Guidance Service
 * Enhanced TTS using expo-speech for turn-by-turn navigation
 * with deduplication, queue management, and headphone detection.
 */

import * as Speech from 'expo-speech';
import { Platform } from 'react-native';
import { audioOutputService } from './audioOutputService';
import i18n from '../i18n';

// Configuration
const CONFIG = {
  DEFAULT_RATE: 0.9, // Slightly slower for clarity
  DEFAULT_PITCH: 1.0,
  DEDUPE_WINDOW_MS: 10000, // Don't repeat same instruction within 10 seconds
  QUEUE_PRIORITY: {
    URGENT: 1, // Immediate turn
    HIGH: 2, // Upcoming maneuver
    NORMAL: 3, // General info
    LOW: 4, // Non-critical
  },
};

// Maneuver types for spoken instructions
export type ManeuverType =
  | 'turn-left'
  | 'turn-right'
  | 'turn-slight-left'
  | 'turn-slight-right'
  | 'turn-sharp-left'
  | 'turn-sharp-right'
  | 'uturn-left'
  | 'uturn-right'
  | 'continue'
  | 'merge'
  | 'ramp-left'
  | 'ramp-right'
  | 'fork-left'
  | 'fork-right'
  | 'roundabout'
  | 'arrive'
  | 'arrive-left'
  | 'arrive-right';

interface SpeechQueueItem {
  id: string;
  text: string;
  priority: number;
  timestamp: number;
}

interface SpokenEntry {
  text: string;
  timestamp: number;
}

class VoiceGuidanceService {
  private static instance: VoiceGuidanceService;

  private isEnabled: boolean = false;
  private autoEnableWithHeadphones: boolean = true;
  private isSpeaking: boolean = false;
  private speechQueue: SpeechQueueItem[] = [];
  private recentlySpoken: SpokenEntry[] = [];
  private currentLanguage: string = 'en';

  private constructor() {
    this.setupHeadphoneDetection();
  }

  public static getInstance(): VoiceGuidanceService {
    if (!VoiceGuidanceService.instance) {
      VoiceGuidanceService.instance = new VoiceGuidanceService();
    }
    return VoiceGuidanceService.instance;
  }

  /**
   * Setup headphone detection for auto-enable
   */
  private setupHeadphoneDetection(): void {
    try {
      audioOutputService.subscribe((audioState) => {
        if (this.autoEnableWithHeadphones) {
          const isExternalConnected = audioState.isBluetoothConnected || audioState.isHeadphonesConnected;
          if (isExternalConnected && !this.isEnabled) {
            console.log('[VoiceGuidance] Headphones detected, auto-enabling');
            this.setEnabled(true);
          }
        }
      });
    } catch (error) {
      console.warn('[VoiceGuidance] Could not setup headphone detection:', error);
    }
  }

  /**
   * Enable/disable voice guidance
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    if (!enabled) {
      this.stop();
      this.speechQueue = [];
    }
  }

  /**
   * Check if voice guidance is enabled
   */
  getEnabled(): boolean {
    return this.isEnabled;
  }

  /**
   * Set auto-enable with headphones
   */
  setAutoEnableWithHeadphones(enabled: boolean): void {
    this.autoEnableWithHeadphones = enabled;
  }

  /**
   * Set language for speech
   */
  setLanguage(language: string): void {
    this.currentLanguage = language;
  }

  /**
   * Speak a navigation maneuver
   */
  async speakManeuver(
    maneuver: ManeuverType,
    distanceMeters: number,
    streetName?: string,
    priority: number = CONFIG.QUEUE_PRIORITY.NORMAL
  ): Promise<void> {
    const instruction = this.buildManeuverInstruction(maneuver, distanceMeters, streetName);
    await this.speak(instruction, priority);
  }

  /**
   * Speak arrival announcement
   */
  async speakArrival(destinationName?: string): Promise<void> {
    const text = destinationName
      ? i18n.t('navigation.arrivedAt', { destination: destinationName })
      : i18n.t('navigation.arrived', 'You have arrived at your destination');

    await this.speak(text, CONFIG.QUEUE_PRIORITY.URGENT);
  }

  /**
   * Speak "returning to hotel" announcement
   */
  async speakReturningToHotel(hotelName?: string): Promise<void> {
    const text = hotelName
      ? i18n.t('navigation.returningToHotel', { hotel: hotelName })
      : i18n.t('navigation.returningToHotelGeneric', 'Navigating back to your hotel');

    await this.speak(text, CONFIG.QUEUE_PRIORITY.HIGH);
  }

  /**
   * Speak custom text
   */
  async speak(text: string, priority: number = CONFIG.QUEUE_PRIORITY.NORMAL): Promise<void> {
    if (!this.isEnabled) {
      console.log('[VoiceGuidance] Disabled, skipping:', text);
      return;
    }

    if (!text) {
      console.log('[VoiceGuidance] Empty text, skipping');
      return;
    }

    // Check for duplicates
    if (this.isDuplicate(text)) {
      console.log('[VoiceGuidance] Duplicate, skipping:', text);
      return;
    }

    // Add to queue
    const item: SpeechQueueItem = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      text,
      priority,
      timestamp: Date.now(),
    };

    this.speechQueue.push(item);
    this.sortQueue();

    // Process queue
    await this.processQueue();
  }

  /**
   * Stop speaking and clear queue
   */
  async stop(): Promise<void> {
    try {
      await Speech.stop();
      this.isSpeaking = false;
      this.speechQueue = [];
    } catch (error) {
      console.warn('[VoiceGuidance] Stop error:', error);
    }
  }

  /**
   * Check if currently speaking
   */
  isSpeakingNow(): boolean {
    return this.isSpeaking;
  }

  /**
   * Check if TTS is available
   */
  async isAvailable(): Promise<boolean> {
    if (Platform.OS === 'web') return false;

    try {
      const voices = await Speech.getAvailableVoicesAsync();
      return voices.length > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get available voices for current language
   */
  async getVoices(): Promise<Speech.Voice[]> {
    try {
      const voices = await Speech.getAvailableVoicesAsync();
      return voices.filter((v) => v.language.startsWith(this.currentLanguage));
    } catch (error) {
      console.warn('[VoiceGuidance] getVoices error:', error);
      return [];
    }
  }

  /**
   * Build maneuver instruction text
   */
  private buildManeuverInstruction(
    maneuver: ManeuverType,
    distanceMeters: number,
    streetName?: string
  ): string {
    const distanceText = this.formatDistance(distanceMeters);
    const maneuverText = this.getManeuverText(maneuver);

    if (distanceMeters < 30) {
      // Immediate turn
      return streetName
        ? `${maneuverText} onto ${streetName}`
        : maneuverText;
    }

    // Upcoming turn
    return streetName
      ? `In ${distanceText}, ${maneuverText} onto ${streetName}`
      : `In ${distanceText}, ${maneuverText}`;
  }

  /**
   * Get spoken text for maneuver type
   */
  private getManeuverText(maneuver: ManeuverType): string {
    const maneuverTexts: Record<ManeuverType, string> = {
      'turn-left': i18n.t('navigation.turnLeft', 'turn left'),
      'turn-right': i18n.t('navigation.turnRight', 'turn right'),
      'turn-slight-left': i18n.t('navigation.turnSlightLeft', 'turn slightly left'),
      'turn-slight-right': i18n.t('navigation.turnSlightRight', 'turn slightly right'),
      'turn-sharp-left': i18n.t('navigation.turnSharpLeft', 'turn sharp left'),
      'turn-sharp-right': i18n.t('navigation.turnSharpRight', 'turn sharp right'),
      'uturn-left': i18n.t('navigation.uTurnLeft', 'make a U-turn'),
      'uturn-right': i18n.t('navigation.uTurnRight', 'make a U-turn'),
      'continue': i18n.t('navigation.continue', 'continue straight'),
      'merge': i18n.t('navigation.merge', 'merge'),
      'ramp-left': i18n.t('navigation.takeRampLeft', 'take the left ramp'),
      'ramp-right': i18n.t('navigation.takeRampRight', 'take the right ramp'),
      'fork-left': i18n.t('navigation.keepLeft', 'keep left at the fork'),
      'fork-right': i18n.t('navigation.keepRight', 'keep right at the fork'),
      'roundabout': i18n.t('navigation.enterRoundabout', 'enter the roundabout'),
      'arrive': i18n.t('navigation.arriveDestination', 'arrive at your destination'),
      'arrive-left': i18n.t('navigation.arriveLeft', 'arrive at your destination on the left'),
      'arrive-right': i18n.t('navigation.arriveRight', 'arrive at your destination on the right'),
    };

    return maneuverTexts[maneuver] || maneuver;
  }

  /**
   * Format distance for speech
   */
  private formatDistance(meters: number): string {
    // TODO: Use user's preferred unit system
    const useImperial = false; // Could get from settings

    if (useImperial) {
      const feet = meters * 3.28084;
      if (feet < 500) {
        return `${Math.round(feet / 50) * 50} feet`;
      }
      const miles = meters / 1609.34;
      if (miles < 0.1) {
        return `${Math.round(feet / 100) * 100} feet`;
      }
      return `${miles.toFixed(1)} miles`;
    }

    if (meters < 100) {
      return `${Math.round(meters / 10) * 10} meters`;
    }
    if (meters < 1000) {
      return `${Math.round(meters / 50) * 50} meters`;
    }
    const km = meters / 1000;
    return `${km.toFixed(1)} kilometers`;
  }

  /**
   * Check if text was recently spoken (deduplication)
   */
  private isDuplicate(text: string): boolean {
    if (!text) return false;

    const now = Date.now();

    // Clean up old entries
    this.recentlySpoken = this.recentlySpoken.filter(
      (entry) => now - entry.timestamp < CONFIG.DEDUPE_WINDOW_MS
    );

    // Check for match (case-insensitive, trim whitespace)
    const normalizedText = text.toLowerCase().trim();
    return this.recentlySpoken.some(
      (entry) => entry.text?.toLowerCase().trim() === normalizedText
    );
  }

  /**
   * Record that text was spoken
   */
  private recordSpoken(text: string): void {
    this.recentlySpoken.push({
      text,
      timestamp: Date.now(),
    });
  }

  /**
   * Sort queue by priority
   */
  private sortQueue(): void {
    this.speechQueue.sort((a, b) => {
      // Priority first (lower number = higher priority)
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      // Then by timestamp (older first)
      return a.timestamp - b.timestamp;
    });
  }

  /**
   * Process the speech queue
   */
  private async processQueue(): Promise<void> {
    if (this.isSpeaking || this.speechQueue.length === 0) {
      return;
    }

    const item = this.speechQueue.shift();
    if (!item) return;

    this.isSpeaking = true;

    try {
      await this.speakText(item.text);
      this.recordSpoken(item.text);
    } catch (error) {
      console.warn('[VoiceGuidance] Speech error:', error);
    } finally {
      this.isSpeaking = false;
      // Process next item if any
      if (this.speechQueue.length > 0) {
        await this.processQueue();
      }
    }
  }

  /**
   * Actually speak the text using expo-speech
   */
  private speakText(text: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (Platform.OS === 'web') {
        console.log('[VoiceGuidance Mock]:', text);
        resolve();
        return;
      }

      Speech.speak(text, {
        language: this.currentLanguage,
        rate: CONFIG.DEFAULT_RATE,
        pitch: CONFIG.DEFAULT_PITCH,
        onDone: () => resolve(),
        onError: (error) => reject(error),
        onStopped: () => resolve(),
      });
    });
  }
}

// Export singleton
export const voiceGuidanceService = VoiceGuidanceService.getInstance();
export default voiceGuidanceService;
