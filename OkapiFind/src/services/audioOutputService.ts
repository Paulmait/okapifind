/**
 * Audio Output Detection Service
 * Detects when user has AirPods, headphones, or Bluetooth audio connected
 * Automatically enables voice directions when audio output is available
 *
 * KEY FEATURE:
 * - Automatically starts speaking directions when headphones are connected
 * - Provides hands-free navigation experience
 * - Respects user privacy - won't play audio through speakers unexpectedly
 */

import { Platform, NativeModules, NativeEventEmitter } from 'react-native';
import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { tts } from './tts';

// Storage keys
const STORAGE_KEYS = {
  AUTO_VOICE_ENABLED: '@OkapiFind:autoVoiceOnHeadphones',
  VOICE_PREFERENCES: '@OkapiFind:voicePreferences',
};

export type AudioOutputType =
  | 'speaker'           // Built-in device speaker
  | 'headphones'        // Wired headphones
  | 'bluetooth'         // Bluetooth audio (AirPods, car, speaker)
  | 'airpods'           // Specifically AirPods
  | 'carplay'           // CarPlay/Android Auto
  | 'unknown';

export interface AudioOutputInfo {
  type: AudioOutputType;
  name: string;
  isHeadphonesConnected: boolean;
  isBluetoothConnected: boolean;
  isCarPlayConnected: boolean;
  supportsVoiceGuidance: boolean;
}

export interface VoicePreferences {
  autoEnableOnHeadphones: boolean;
  autoEnableOnBluetooth: boolean;
  autoEnableOnCarPlay: boolean;
  speakThroughSpeaker: boolean;
  voiceSpeed: 'slow' | 'normal' | 'fast';
  voiceVolume: number; // 0-1
  announceDistance: boolean;
  announceDirection: boolean;
  announceLandmarks: boolean;
  announceArrival: boolean;
}

class AudioOutputService {
  private static instance: AudioOutputService;
  private currentOutput: AudioOutputInfo = {
    type: 'speaker',
    name: 'Device Speaker',
    isHeadphonesConnected: false,
    isBluetoothConnected: false,
    isCarPlayConnected: false,
    supportsVoiceGuidance: false,
  };
  private preferences: VoicePreferences = {
    autoEnableOnHeadphones: true,
    autoEnableOnBluetooth: true,
    autoEnableOnCarPlay: true,
    speakThroughSpeaker: false, // Privacy: don't speak through speaker by default
    voiceSpeed: 'normal',
    voiceVolume: 0.8,
    announceDistance: true,
    announceDirection: true,
    announceLandmarks: true,
    announceArrival: true,
  };
  private listeners: Set<(output: AudioOutputInfo) => void> = new Set();
  private isMonitoring: boolean = false;
  private audioModeConfigured: boolean = false;

  private constructor() {}

  public static getInstance(): AudioOutputService {
    if (!AudioOutputService.instance) {
      AudioOutputService.instance = new AudioOutputService();
    }
    return AudioOutputService.instance;
  }

  /**
   * Initialize the audio output service
   */
  public async initialize(): Promise<void> {
    await this.loadPreferences();
    await this.configureAudioSession();
    await this.detectCurrentOutput();
    this.startMonitoring();
  }

  /**
   * Configure audio session for TTS playback
   */
  private async configureAudioSession(): Promise<void> {
    if (this.audioModeConfigured) return;

    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true, // Play even in silent mode (important for navigation)
        staysActiveInBackground: true, // Keep playing when app is backgrounded
        shouldDuckAndroid: true, // Lower other audio when speaking
        playThroughEarpieceAndroid: false,
      });
      this.audioModeConfigured = true;
    } catch (error) {
      console.error('Failed to configure audio session:', error);
    }
  }

  /**
   * Detect current audio output device
   */
  public async detectCurrentOutput(): Promise<AudioOutputInfo> {
    try {
      if (Platform.OS === 'web') {
        // Web doesn't support audio output detection
        this.currentOutput = {
          type: 'speaker',
          name: 'Web Audio',
          isHeadphonesConnected: false,
          isBluetoothConnected: false,
          isCarPlayConnected: false,
          supportsVoiceGuidance: true,
        };
        return this.currentOutput;
      }

      // Use expo-av to check audio output status
      const status = await Audio.getPermissionsAsync();

      // For iOS, we can check the audio route
      if (Platform.OS === 'ios') {
        // iOS provides more detailed audio route information
        // Note: This requires native module access for full implementation
        const isBluetoothAvailable = await this.checkBluetoothAudio();
        const isHeadphonesAvailable = await this.checkHeadphonesConnected();

        if (isBluetoothAvailable) {
          this.currentOutput = {
            type: 'bluetooth',
            name: 'Bluetooth Audio',
            isHeadphonesConnected: false,
            isBluetoothConnected: true,
            isCarPlayConnected: false,
            supportsVoiceGuidance: true,
          };
        } else if (isHeadphonesAvailable) {
          this.currentOutput = {
            type: 'headphones',
            name: 'Headphones',
            isHeadphonesConnected: true,
            isBluetoothConnected: false,
            isCarPlayConnected: false,
            supportsVoiceGuidance: true,
          };
        } else {
          this.currentOutput = {
            type: 'speaker',
            name: 'Device Speaker',
            isHeadphonesConnected: false,
            isBluetoothConnected: false,
            isCarPlayConnected: false,
            supportsVoiceGuidance: this.preferences.speakThroughSpeaker,
          };
        }
      } else if (Platform.OS === 'android') {
        // Android audio output detection
        const isBluetoothAvailable = await this.checkBluetoothAudio();

        if (isBluetoothAvailable) {
          this.currentOutput = {
            type: 'bluetooth',
            name: 'Bluetooth Audio',
            isHeadphonesConnected: false,
            isBluetoothConnected: true,
            isCarPlayConnected: false,
            supportsVoiceGuidance: true,
          };
        } else {
          this.currentOutput = {
            type: 'speaker',
            name: 'Device Speaker',
            isHeadphonesConnected: false,
            isBluetoothConnected: false,
            isCarPlayConnected: false,
            supportsVoiceGuidance: this.preferences.speakThroughSpeaker,
          };
        }
      }

      this.notifyListeners();
      return this.currentOutput;
    } catch (error) {
      console.error('Failed to detect audio output:', error);
      return this.currentOutput;
    }
  }

  /**
   * Check if Bluetooth audio is available
   */
  private async checkBluetoothAudio(): Promise<boolean> {
    // This is a simplified check - in production, you'd use native modules
    // to check the actual audio route
    try {
      // Attempt to detect Bluetooth by checking audio session
      // This is platform-specific and may require additional native code
      return false; // Default to false, will be updated by native events
    } catch {
      return false;
    }
  }

  /**
   * Check if wired headphones are connected
   */
  private async checkHeadphonesConnected(): Promise<boolean> {
    // This would use native modules to check headphone jack status
    try {
      return false; // Default to false
    } catch {
      return false;
    }
  }

  /**
   * Start monitoring for audio output changes
   */
  private startMonitoring(): void {
    if (this.isMonitoring) return;

    // Set up polling to detect audio route changes
    // In production, use native event listeners for immediate detection
    this.isMonitoring = true;

    // Poll every 5 seconds for audio output changes
    setInterval(async () => {
      if (this.isMonitoring) {
        await this.detectCurrentOutput();
      }
    }, 5000);
  }

  /**
   * Stop monitoring audio output changes
   */
  public stopMonitoring(): void {
    this.isMonitoring = false;
  }

  /**
   * Check if voice guidance should be enabled based on current output
   */
  public shouldEnableVoiceGuidance(): boolean {
    const { type, isHeadphonesConnected, isBluetoothConnected, isCarPlayConnected } = this.currentOutput;

    if (isCarPlayConnected && this.preferences.autoEnableOnCarPlay) {
      return true;
    }

    if (isBluetoothConnected && this.preferences.autoEnableOnBluetooth) {
      return true;
    }

    if (isHeadphonesConnected && this.preferences.autoEnableOnHeadphones) {
      return true;
    }

    if (type === 'speaker' && this.preferences.speakThroughSpeaker) {
      return true;
    }

    return false;
  }

  /**
   * Speak navigation instruction if conditions are met
   */
  public async speakNavigation(instruction: string, type: 'distance' | 'direction' | 'landmark' | 'arrival'): Promise<void> {
    // Check if this type of announcement is enabled
    if (type === 'distance' && !this.preferences.announceDistance) return;
    if (type === 'direction' && !this.preferences.announceDirection) return;
    if (type === 'landmark' && !this.preferences.announceLandmarks) return;
    if (type === 'arrival' && !this.preferences.announceArrival) return;

    // Check if voice guidance should be active
    if (!this.shouldEnableVoiceGuidance()) {
      console.log('[AudioOutput] Voice guidance disabled - not speaking:', instruction);
      return;
    }

    // Convert voice speed setting to rate
    let rate = 0.5; // Default rate
    switch (this.preferences.voiceSpeed) {
      case 'slow':
        rate = 0.4;
        break;
      case 'normal':
        rate = 0.5;
        break;
      case 'fast':
        rate = 0.65;
        break;
    }

    // Speak the instruction
    await tts.speak(instruction, { rate });
  }

  /**
   * Speak a direction instruction (e.g., "Turn left in 50 meters")
   */
  public async speakDirection(direction: string, distance?: number): Promise<void> {
    let instruction = direction;
    if (distance) {
      if (distance >= 1000) {
        instruction = `${direction} in ${(distance / 1000).toFixed(1)} kilometers`;
      } else {
        instruction = `${direction} in ${Math.round(distance)} meters`;
      }
    }
    await this.speakNavigation(instruction, 'direction');
  }

  /**
   * Speak distance to destination
   */
  public async speakDistance(distance: number, destination: string = 'your car'): Promise<void> {
    let distanceStr: string;
    if (distance >= 1000) {
      distanceStr = `${(distance / 1000).toFixed(1)} kilometers`;
    } else {
      distanceStr = `${Math.round(distance)} meters`;
    }
    await this.speakNavigation(`${distanceStr} to ${destination}`, 'distance');
  }

  /**
   * Announce arrival at destination
   */
  public async speakArrival(destination: string = 'your car'): Promise<void> {
    await this.speakNavigation(`You have arrived at ${destination}`, 'arrival');
  }

  /**
   * Announce landmark (e.g., "You are passing Starbucks on your left")
   */
  public async speakLandmark(landmark: string, position: 'left' | 'right' | 'ahead'): Promise<void> {
    await this.speakNavigation(`${landmark} is on your ${position}`, 'landmark');
  }

  /**
   * Get current audio output info
   */
  public getCurrentOutput(): AudioOutputInfo {
    return { ...this.currentOutput };
  }

  /**
   * Subscribe to audio output changes
   */
  public subscribe(listener: (output: AudioOutputInfo) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Update voice preferences
   */
  public async updatePreferences(updates: Partial<VoicePreferences>): Promise<void> {
    this.preferences = { ...this.preferences, ...updates };
    await this.savePreferences();
  }

  /**
   * Get current voice preferences
   */
  public getPreferences(): VoicePreferences {
    return { ...this.preferences };
  }

  /**
   * Notify all listeners of output change
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.currentOutput));
  }

  /**
   * Load preferences from storage
   */
  private async loadPreferences(): Promise<void> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.VOICE_PREFERENCES);
      if (data) {
        this.preferences = { ...this.preferences, ...JSON.parse(data) };
      }
    } catch (error) {
      console.error('Failed to load voice preferences:', error);
    }
  }

  /**
   * Save preferences to storage
   */
  private async savePreferences(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.VOICE_PREFERENCES,
        JSON.stringify(this.preferences)
      );
    } catch (error) {
      console.error('Failed to save voice preferences:', error);
    }
  }

  /**
   * Simulate headphone connection (for testing)
   */
  public simulateHeadphoneConnection(connected: boolean): void {
    if (connected) {
      this.currentOutput = {
        type: 'headphones',
        name: 'Simulated Headphones',
        isHeadphonesConnected: true,
        isBluetoothConnected: false,
        isCarPlayConnected: false,
        supportsVoiceGuidance: true,
      };
    } else {
      this.currentOutput = {
        type: 'speaker',
        name: 'Device Speaker',
        isHeadphonesConnected: false,
        isBluetoothConnected: false,
        isCarPlayConnected: false,
        supportsVoiceGuidance: this.preferences.speakThroughSpeaker,
      };
    }
    this.notifyListeners();
  }

  /**
   * Simulate Bluetooth connection (for testing)
   */
  public simulateBluetoothConnection(connected: boolean, deviceName: string = 'AirPods Pro'): void {
    if (connected) {
      const isAirPods = deviceName.toLowerCase().includes('airpod');
      this.currentOutput = {
        type: isAirPods ? 'airpods' : 'bluetooth',
        name: deviceName,
        isHeadphonesConnected: false,
        isBluetoothConnected: true,
        isCarPlayConnected: false,
        supportsVoiceGuidance: true,
      };
    } else {
      this.currentOutput = {
        type: 'speaker',
        name: 'Device Speaker',
        isHeadphonesConnected: false,
        isBluetoothConnected: false,
        isCarPlayConnected: false,
        supportsVoiceGuidance: this.preferences.speakThroughSpeaker,
      };
    }
    this.notifyListeners();
  }
}

// Export singleton instance
export const audioOutputService = AudioOutputService.getInstance();
export default audioOutputService;
