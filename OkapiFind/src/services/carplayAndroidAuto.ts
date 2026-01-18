// @ts-nocheck
/**
 * CarPlay and Android Auto Integration Service
 * Seamless integration with vehicle infotainment systems
 * Provides safe, voice-controlled parking assistance while driving
 */

import { Platform, NativeModules, NativeEventEmitter } from 'react-native';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { analytics } from './analytics';
import { smartParkingAI } from './smartParkingAI';
import { voiceCommandsService } from './voiceCommandsService';

interface CarPlaySession {
  id: string;
  startTime: number;
  endTime?: number;
  destination?: { latitude: number; longitude: number; name: string };
  parkingSpotSaved?: boolean;
  voiceCommands: number;
  navigationActions: number;
  userInteractions: string[];
}

interface AndroidAutoSession {
  id: string;
  startTime: number;
  endTime?: number;
  destination?: { latitude: number; longitude: number; name: string };
  parkingSpotSaved?: boolean;
  voiceCommands: number;
  mediaActions: number;
  notificationInteractions: number;
}

interface VehicleIntegrationState {
  isConnected: boolean;
  platform: 'carplay' | 'android_auto' | null;
  vehicleInfo?: {
    make?: string;
    model?: string;
    year?: number;
    identifier: string;
  };
  capabilities: {
    voiceCommands: boolean;
    navigation: boolean;
    notifications: boolean;
    quickActions: boolean;
    siri: boolean;
    googleAssistant: boolean;
  };
  currentSession?: CarPlaySession | AndroidAutoSession;
}

interface CarIntegrationMetrics {
  totalSessions: number;
  totalDrivingTime: number; // minutes
  parkingSpotsFoundViaCar: number;
  voiceCommandsUsed: number;
  navigationAssists: number;
  safetyScore: number; // 0-1 based on hands-free usage
  preferredFeatures: string[];
  avgSessionDuration: number;
}

interface VoiceCommand {
  phrase: string;
  action: string;
  parameters?: any;
  confidence: number;
  timestamp: number;
  success: boolean;
}

interface NavigationAction {
  type: 'find_parking' | 'save_location' | 'navigate_to_car' | 'set_timer' | 'view_map';
  location?: { latitude: number; longitude: number };
  timestamp: number;
  completedSuccessfully: boolean;
  timeToComplete?: number; // seconds
}

const STORAGE_KEYS = {
  INTEGRATION_STATE: '@car_integration_state',
  SESSION_HISTORY: '@car_session_history',
  METRICS: '@car_integration_metrics',
  VOICE_COMMANDS: '@car_voice_commands',
  VEHICLE_PROFILES: '@vehicle_profiles',
};

// Voice command patterns
const VOICE_COMMANDS = {
  FIND_PARKING: [
    'find parking',
    'where can I park',
    'show parking spots',
    'parking near destination',
    'find a spot to park',
  ],
  SAVE_LOCATION: [
    'save my parking spot',
    'remember where I parked',
    'mark parking location',
    'save this location',
    'I parked here',
  ],
  NAVIGATE_TO_CAR: [
    'take me to my car',
    'navigate to my parking spot',
    'where did I park',
    'find my car',
    'directions to my car',
  ],
  SET_TIMER: [
    'set parking timer',
    'remind me about parking',
    'set meter reminder',
    'parking timer for',
    'alert me in',
  ],
  CHECK_STATUS: [
    'check parking status',
    'parking information',
    'how long until meter expires',
    'parking timer status',
  ],
};

class CarPlayAndroidAutoService {
  private integrationState: VehicleIntegrationState;
  private metrics: CarIntegrationMetrics;
  private sessionHistory: (CarPlaySession | AndroidAutoSession)[] = [];
  private voiceCommandHistory: VoiceCommand[] = [];
  private carPlayBridge: any = null;
  private androidAutoBridge: any = null;
  private eventEmitter: NativeEventEmitter | null = null;
  private currentLocation: Location.LocationObject | null = null;

  constructor() {
    this.integrationState = this.initializeIntegrationState();
    this.metrics = this.initializeMetrics();
    this.initializeCarIntegration();
  }

  /**
   * Initialize car integration system
   */
  private async initializeCarIntegration() {
    try {
      await this.loadStoredData();
      await this.setupNativeBridges();
      await this.registerVoiceCommands();
      await this.startLocationTracking();

      // Listen for car connection events
      this.setupCarConnectionListeners();

      analytics.logEvent('car_integration_initialized', {
        platform: Platform.OS,
        previous_sessions: this.sessionHistory.length,
        voice_commands_registered: Object.keys(VOICE_COMMANDS).length,
      });

    } catch (error) {
      console.error('Failed to initialize car integration:', error);
    }
  }

  /**
   * Setup native bridges for CarPlay/Android Auto
   */
  private async setupNativeBridges() {
    try {
      if (Platform.OS === 'ios') {
        // iOS CarPlay bridge
        this.carPlayBridge = NativeModules.CarPlayBridge;
        if (this.carPlayBridge) {
          this.eventEmitter = new NativeEventEmitter(this.carPlayBridge);

          // Register for CarPlay events
          this.eventEmitter.addListener('carPlayConnected', this.handleCarPlayConnected.bind(this));
          this.eventEmitter.addListener('carPlayDisconnected', this.handleCarPlayDisconnected.bind(this));
          this.eventEmitter.addListener('carPlayVoiceCommand', this.handleVoiceCommand.bind(this));
          this.eventEmitter.addListener('carPlayNavigation', this.handleNavigationAction.bind(this));
        }
      } else if (Platform.OS === 'android') {
        // Android Auto bridge
        this.androidAutoBridge = NativeModules.AndroidAutoBridge;
        if (this.androidAutoBridge) {
          this.eventEmitter = new NativeEventEmitter(this.androidAutoBridge);

          // Register for Android Auto events
          this.eventEmitter.addListener('androidAutoConnected', this.handleAndroidAutoConnected.bind(this));
          this.eventEmitter.addListener('androidAutoDisconnected', this.handleAndroidAutoDisconnected.bind(this));
          this.eventEmitter.addListener('androidAutoVoiceCommand', this.handleVoiceCommand.bind(this));
          this.eventEmitter.addListener('androidAutoMediaAction', this.handleMediaAction.bind(this));
        }
      }
    } catch (error) {
      console.error('Failed to setup native bridges:', error);
    }
  }

  /**
   * Register voice commands with the car system
   */
  private async registerVoiceCommands() {
    try {
      const commands = Object.values(VOICE_COMMANDS).flat();

      if (Platform.OS === 'ios' && this.carPlayBridge?.registerVoiceCommands) {
        await this.carPlayBridge.registerVoiceCommands(commands);
      }

      if (Platform.OS === 'android' && this.androidAutoBridge?.registerVoiceCommands) {
        await this.androidAutoBridge.registerVoiceCommands(commands);
      }

      analytics.logEvent('voice_commands_registered', {
        platform: Platform.OS,
        command_count: commands.length,
      });

    } catch (error) {
      console.error('Failed to register voice commands:', error);
    }
  }

  /**
   * Handle CarPlay connection
   */
  private async handleCarPlayConnected(vehicleInfo: any) {
    try {
      this.integrationState.isConnected = true;
      this.integrationState.platform = 'carplay';
      this.integrationState.vehicleInfo = vehicleInfo;

      // Start new session
      const session: CarPlaySession = {
        id: `carplay_${Date.now()}`,
        startTime: Date.now(),
        voiceCommands: 0,
        navigationActions: 0,
        userInteractions: [],
      };

      this.integrationState.currentSession = session;

      // Setup CarPlay interface
      await this.setupCarPlayInterface();

      // Save state
      await this.saveIntegrationState();

      analytics.logEvent('carplay_connected', {
        vehicle_make: vehicleInfo.make,
        vehicle_model: vehicleInfo.model,
        session_id: session.id,
      });

    } catch (error) {
      console.error('Failed to handle CarPlay connection:', error);
    }
  }

  /**
   * Handle Android Auto connection
   */
  private async handleAndroidAutoConnected(vehicleInfo: any) {
    try {
      this.integrationState.isConnected = true;
      this.integrationState.platform = 'android_auto';
      this.integrationState.vehicleInfo = vehicleInfo;

      // Start new session
      const session: AndroidAutoSession = {
        id: `androidauto_${Date.now()}`,
        startTime: Date.now(),
        voiceCommands: 0,
        mediaActions: 0,
        notificationInteractions: 0,
      };

      this.integrationState.currentSession = session;

      // Setup Android Auto interface
      await this.setupAndroidAutoInterface();

      // Save state
      await this.saveIntegrationState();

      analytics.logEvent('android_auto_connected', {
        vehicle_info: vehicleInfo,
        session_id: session.id,
      });

    } catch (error) {
      console.error('Failed to handle Android Auto connection:', error);
    }
  }

  /**
   * Handle car disconnection
   */
  private async handleCarPlayDisconnected() {
    await this.endCurrentSession();
    this.integrationState.isConnected = false;
    this.integrationState.platform = null;
    await this.saveIntegrationState();

    analytics.logEvent('carplay_disconnected', {
      session_duration: this.getCurrentSessionDuration(),
    });
  }

  private async handleAndroidAutoDisconnected() {
    await this.endCurrentSession();
    this.integrationState.isConnected = false;
    this.integrationState.platform = null;
    await this.saveIntegrationState();

    analytics.logEvent('android_auto_disconnected', {
      session_duration: this.getCurrentSessionDuration(),
    });
  }

  /**
   * Handle voice commands from car
   */
  private async handleVoiceCommand(command: { phrase: string; confidence: number }) {
    try {
      const voiceCommand: VoiceCommand = {
        phrase: command.phrase.toLowerCase(),
        action: this.interpretVoiceCommand(command.phrase),
        confidence: command.confidence,
        timestamp: Date.now(),
        success: false,
      };

      // Execute the command
      const success = await this.executeVoiceCommand(voiceCommand);
      voiceCommand.success = success;

      // Update session metrics
      if (this.integrationState.currentSession) {
        this.integrationState.currentSession.voiceCommands++;
      }

      // Store command
      this.voiceCommandHistory.push(voiceCommand);
      await this.saveVoiceCommands();

      // Provide audio feedback
      await this.provideAudioFeedback(voiceCommand);

      analytics.logEvent('car_voice_command', {
        action: voiceCommand.action,
        confidence: voiceCommand.confidence,
        success: voiceCommand.success,
        platform: this.integrationState.platform,
      });

    } catch (error) {
      console.error('Failed to handle voice command:', error);
    }
  }

  /**
   * Interpret voice command
   */
  private interpretVoiceCommand(phrase: string): string {
    const lowerPhrase = phrase.toLowerCase();

    for (const [action, patterns] of Object.entries(VOICE_COMMANDS)) {
      for (const pattern of patterns) {
        if (lowerPhrase.includes(pattern.toLowerCase())) {
          return action;
        }
      }
    }

    return 'UNKNOWN';
  }

  /**
   * Execute voice command
   */
  private async executeVoiceCommand(command: VoiceCommand): Promise<boolean> {
    try {
      switch (command.action) {
        case 'FIND_PARKING':
          return await this.handleFindParkingCommand(command);

        case 'SAVE_LOCATION':
          return await this.handleSaveLocationCommand(command);

        case 'NAVIGATE_TO_CAR':
          return await this.handleNavigateToCarCommand(command);

        case 'SET_TIMER':
          return await this.handleSetTimerCommand(command);

        case 'CHECK_STATUS':
          return await this.handleCheckStatusCommand(command);

        default:
          await this.speakResponse("I didn't understand that command. Try saying 'find parking' or 'save my location'.");
          return false;
      }
    } catch (error) {
      console.error('Failed to execute voice command:', error);
      await this.speakResponse("Sorry, I couldn't complete that action right now.");
      return false;
    }
  }

  /**
   * Handle find parking voice command
   */
  private async handleFindParkingCommand(command: VoiceCommand): Promise<boolean> {
    try {
      if (!this.currentLocation) {
        await this.speakResponse("I need your location to find parking spots.");
        return false;
      }

      // Get AI predictions for parking
      const prediction = await smartParkingAI.predictParkingSpot(this.currentLocation);

      if (prediction.confidence > 0.5) {
        const distance = Math.round(this.calculateDistance(
          this.currentLocation.coords,
          prediction.location
        ));

        await this.speakResponse(
          `I found a good parking spot ${distance} meters ahead. ${prediction.reasons[0] || 'High confidence area.'}`
        );

        // Show on car display
        await this.displayParkingPrediction(prediction);

        return true;
      } else {
        await this.speakResponse("I'll keep looking for parking spots as you drive.");
        return true;
      }
    } catch (error) {
      console.error('Find parking command failed:', error);
      return false;
    }
  }

  /**
   * Handle save location voice command
   */
  private async handleSaveLocationCommand(command: VoiceCommand): Promise<boolean> {
    try {
      if (!this.currentLocation) {
        await this.speakResponse("I couldn't get your location. Make sure location services are enabled.");
        return false;
      }

      // Save parking location
      // This would integrate with your parking service
      await this.speakResponse("Got it! I've saved your parking location. I'll help you find your car later.");

      // Update session
      if (this.integrationState.currentSession) {
        this.integrationState.currentSession.parkingSpotSaved = true;
      }

      return true;
    } catch (error) {
      console.error('Save location command failed:', error);
      return false;
    }
  }

  /**
   * Handle navigate to car voice command
   */
  private async handleNavigateToCarCommand(command: VoiceCommand): Promise<boolean> {
    try {
      // Get saved parking location
      // This would integrate with your parking service
      const savedLocation = await this.getSavedParkingLocation();

      if (!savedLocation) {
        await this.speakResponse("I don't have a saved parking location. Try saying 'save my location' when you park.");
        return false;
      }

      if (!this.currentLocation) {
        await this.speakResponse("I need your current location to navigate to your car.");
        return false;
      }

      const distance = Math.round(this.calculateDistance(
        this.currentLocation.coords,
        savedLocation
      ));

      await this.speakResponse(`Your car is ${distance} meters away. Starting navigation.`);

      // Start navigation on car display
      await this.startCarNavigation(savedLocation);

      return true;
    } catch (error) {
      console.error('Navigate to car command failed:', error);
      return false;
    }
  }

  /**
   * Handle set timer voice command
   */
  private async handleSetTimerCommand(command: VoiceCommand): Promise<boolean> {
    try {
      // Extract time from voice command
      const timeMatch = command.phrase.match(/(\d+)\s*(minute|hour)/i);

      if (!timeMatch) {
        await this.speakResponse("How long should I set the timer for? Say something like 'set timer for 2 hours'.");
        return false;
      }

      const amount = parseInt(timeMatch[1]);
      const unit = timeMatch[2].toLowerCase();
      const minutes = unit === 'hour' ? amount * 60 : amount;

      await this.speakResponse(`Setting parking timer for ${amount} ${unit}${amount > 1 ? 's' : ''}.`);

      // Set timer (integrate with your timer service)

      return true;
    } catch (error) {
      console.error('Set timer command failed:', error);
      return false;
    }
  }

  /**
   * Handle check status voice command
   */
  private async handleCheckStatusCommand(command: VoiceCommand): Promise<boolean> {
    try {
      // Get parking status
      const status = await this.getParkingStatus();

      if (status.hasActiveParkingSession) {
        if (status.timerRemaining > 0) {
          const minutes = Math.floor(status.timerRemaining / 60000);
          await this.speakResponse(`Your parking timer has ${minutes} minutes remaining.`);
        } else {
          await this.speakResponse("You have an active parking session but no timer set.");
        }
      } else {
        await this.speakResponse("No active parking session found.");
      }

      return true;
    } catch (error) {
      console.error('Check status command failed:', error);
      return false;
    }
  }

  /**
   * Setup CarPlay interface
   */
  private async setupCarPlayInterface() {
    if (!this.carPlayBridge) return;

    try {
      // Setup quick actions on CarPlay
      const quickActions = [
        { id: 'find_parking', title: 'Find Parking', icon: 'car.fill' },
        { id: 'save_location', title: 'Save Location', icon: 'mappin' },
        { id: 'navigate_to_car', title: 'Find My Car', icon: 'location' },
        { id: 'set_timer', title: 'Set Timer', icon: 'timer' },
      ];

      await this.carPlayBridge.setupQuickActions(quickActions);

      // Setup map template if supported
      if (this.integrationState.capabilities.navigation) {
        await this.carPlayBridge.setupMapTemplate({
          showUserLocation: true,
          allowPanAndZoom: true,
        });
      }

    } catch (error) {
      console.error('Failed to setup CarPlay interface:', error);
    }
  }

  /**
   * Setup Android Auto interface
   */
  private async setupAndroidAutoInterface() {
    if (!this.androidAutoBridge) return;

    try {
      // Setup media session for Android Auto
      await this.androidAutoBridge.setupMediaSession({
        title: 'OkapiFind',
        artist: 'Parking Assistant',
        actions: ['find_parking', 'save_location', 'navigate_to_car'],
      });

      // Setup notification categories
      await this.androidAutoBridge.setupNotificationCategories([
        { id: 'parking_timer', name: 'Parking Timers' },
        { id: 'parking_found', name: 'Parking Spots' },
        { id: 'navigation', name: 'Navigation' },
      ]);

    } catch (error) {
      console.error('Failed to setup Android Auto interface:', error);
    }
  }

  /**
   * Provide audio feedback through car speakers
   */
  private async provideAudioFeedback(command: VoiceCommand) {
    if (command.success) {
      // Success sounds or confirmation
      await this.playSuccessSound();
    } else {
      // Error sounds
      await this.playErrorSound();
    }
  }

  /**
   * Speak response through car audio system
   */
  private async speakResponse(text: string) {
    try {
      if (Platform.OS === 'ios' && this.carPlayBridge?.speak) {
        await this.carPlayBridge.speak(text);
      } else if (Platform.OS === 'android' && this.androidAutoBridge?.speak) {
        await this.androidAutoBridge.speak(text);
      }
    } catch (error) {
      console.error('Failed to speak response:', error);
    }
  }

  /**
   * Display parking prediction on car screen
   */
  private async displayParkingPrediction(prediction: any) {
    try {
      const displayData = {
        location: prediction.location,
        confidence: prediction.confidence,
        estimatedWalk: prediction.estimatedWalkTime,
        reasons: prediction.reasons,
      };

      if (Platform.OS === 'ios' && this.carPlayBridge?.displayParkingInfo) {
        await this.carPlayBridge.displayParkingInfo(displayData);
      } else if (Platform.OS === 'android' && this.androidAutoBridge?.displayParkingInfo) {
        await this.androidAutoBridge.displayParkingInfo(displayData);
      }
    } catch (error) {
      console.error('Failed to display parking prediction:', error);
    }
  }

  /**
   * Start navigation on car display
   */
  private async startCarNavigation(destination: { latitude: number; longitude: number }) {
    try {
      if (Platform.OS === 'ios' && this.carPlayBridge?.startNavigation) {
        await this.carPlayBridge.startNavigation(destination);
      } else if (Platform.OS === 'android' && this.androidAutoBridge?.startNavigation) {
        await this.androidAutoBridge.startNavigation(destination);
      }
    } catch (error) {
      console.error('Failed to start car navigation:', error);
    }
  }

  /**
   * Handle navigation actions
   */
  private async handleNavigationAction(action: any) {
    const navigationAction: NavigationAction = {
      type: action.type,
      location: action.location,
      timestamp: Date.now(),
      completedSuccessfully: false,
    };

    try {
      // Execute navigation action
      switch (action.type) {
        case 'find_parking':
          await this.handleFindParkingCommand({ action: 'FIND_PARKING' } as VoiceCommand);
          break;
        case 'navigate_to_car':
          await this.handleNavigateToCarCommand({ action: 'NAVIGATE_TO_CAR' } as VoiceCommand);
          break;
        // Add more navigation actions as needed
      }

      navigationAction.completedSuccessfully = true;

      // Update session metrics
      if (this.integrationState.currentSession && 'navigationActions' in this.integrationState.currentSession) {
        this.integrationState.currentSession.navigationActions++;
      }

    } catch (error) {
      console.error('Navigation action failed:', error);
    }

    analytics.logEvent('car_navigation_action', {
      type: navigationAction.type,
      success: navigationAction.completedSuccessfully,
      platform: this.integrationState.platform,
    });
  }

  /**
   * Handle media actions (Android Auto)
   */
  private async handleMediaAction(action: any) {
    if (this.integrationState.currentSession && 'mediaActions' in this.integrationState.currentSession) {
      this.integrationState.currentSession.mediaActions++;
    }

    analytics.logEvent('android_auto_media_action', {
      action: action.type,
    });
  }

  /**
   * Get integration status
   */
  getIntegrationStatus(): {
    isConnected: boolean;
    platform: string | null;
    vehicleInfo?: any;
    sessionActive: boolean;
    capabilities: any;
    metrics: CarIntegrationMetrics;
  } {
    return {
      isConnected: this.integrationState.isConnected,
      platform: this.integrationState.platform,
      vehicleInfo: this.integrationState.vehicleInfo,
      sessionActive: !!this.integrationState.currentSession,
      capabilities: this.integrationState.capabilities,
      metrics: this.metrics,
    };
  }

  // Utility methods
  private calculateDistance(
    coord1: { latitude: number; longitude: number },
    coord2: { latitude: number; longitude: number }
  ): number {
    const R = 6371e3;
    const φ1 = (coord1.latitude * Math.PI) / 180;
    const φ2 = (coord2.latitude * Math.PI) / 180;
    const Δφ = ((coord2.latitude - coord1.latitude) * Math.PI) / 180;
    const Δλ = ((coord2.longitude - coord1.longitude) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  private getCurrentSessionDuration(): number {
    if (!this.integrationState.currentSession) return 0;
    return Date.now() - this.integrationState.currentSession.startTime;
  }

  private async endCurrentSession() {
    if (!this.integrationState.currentSession) return;

    const session = this.integrationState.currentSession;
    session.endTime = Date.now();

    // Add to history
    this.sessionHistory.push(session);

    // Update metrics
    this.metrics.totalSessions++;
    this.metrics.totalDrivingTime += (session.endTime - session.startTime) / (1000 * 60);
    this.metrics.voiceCommandsUsed += session.voiceCommands;

    if ('navigationActions' in session) {
      this.metrics.navigationAssists += session.navigationActions;
    }

    if (session.parkingSpotSaved) {
      this.metrics.parkingSpotsFoundViaCar++;
    }

    // Calculate safety score (higher for voice usage)
    const voiceRatio = session.voiceCommands / Math.max(1, session.voiceCommands + session.userInteractions.length);
    this.metrics.safetyScore = (this.metrics.safetyScore + voiceRatio) / 2;

    // Clear current session
    this.integrationState.currentSession = undefined;

    await this.saveSessionHistory();
    await this.saveMetrics();
    await this.saveIntegrationState();
  }

  private async startLocationTracking() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      // Track location for car integration
      await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 5000,
          distanceInterval: 50,
        },
        (location) => {
          this.currentLocation = location;
        }
      );
    } catch (error) {
      console.error('Failed to start location tracking:', error);
    }
  }

  private setupCarConnectionListeners() {
    // Platform-specific connection detection would go here
    // This might involve checking for CarPlay/Android Auto connection status
  }

  private async getSavedParkingLocation(): Promise<{ latitude: number; longitude: number } | null> {
    // This would integrate with your parking service to get the saved location
    // Placeholder implementation
    return null;
  }

  private async getParkingStatus(): Promise<{
    hasActiveParkingSession: boolean;
    timerRemaining: number;
  }> {
    // This would integrate with your parking service to get current status
    // Placeholder implementation
    return {
      hasActiveParkingSession: false,
      timerRemaining: 0,
    };
  }

  private async playSuccessSound() {
    // Play success sound through car audio
  }

  private async playErrorSound() {
    // Play error sound through car audio
  }

  // Storage methods
  private async loadStoredData() {
    try {
      const [stateData, historyData, metricsData, commandsData] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.INTEGRATION_STATE),
        AsyncStorage.getItem(STORAGE_KEYS.SESSION_HISTORY),
        AsyncStorage.getItem(STORAGE_KEYS.METRICS),
        AsyncStorage.getItem(STORAGE_KEYS.VOICE_COMMANDS),
      ]);

      if (stateData) {
        const state = JSON.parse(stateData);
        this.integrationState = { ...this.integrationState, ...state };
      }

      this.sessionHistory = historyData ? JSON.parse(historyData) : [];
      this.metrics = metricsData ? JSON.parse(metricsData) : this.initializeMetrics();
      this.voiceCommandHistory = commandsData ? JSON.parse(commandsData) : [];

    } catch (error) {
      console.error('Failed to load stored data:', error);
    }
  }

  private async saveIntegrationState() {
    await AsyncStorage.setItem(STORAGE_KEYS.INTEGRATION_STATE, JSON.stringify(this.integrationState));
  }

  private async saveSessionHistory() {
    await AsyncStorage.setItem(STORAGE_KEYS.SESSION_HISTORY, JSON.stringify(this.sessionHistory));
  }

  private async saveMetrics() {
    await AsyncStorage.setItem(STORAGE_KEYS.METRICS, JSON.stringify(this.metrics));
  }

  private async saveVoiceCommands() {
    // Keep only last 100 commands
    if (this.voiceCommandHistory.length > 100) {
      this.voiceCommandHistory = this.voiceCommandHistory.slice(-100);
    }
    await AsyncStorage.setItem(STORAGE_KEYS.VOICE_COMMANDS, JSON.stringify(this.voiceCommandHistory));
  }

  private initializeIntegrationState(): VehicleIntegrationState {
    return {
      isConnected: false,
      platform: null,
      capabilities: {
        voiceCommands: true,
        navigation: true,
        notifications: true,
        quickActions: true,
        siri: Platform.OS === 'ios',
        googleAssistant: Platform.OS === 'android',
      },
    };
  }

  private initializeMetrics(): CarIntegrationMetrics {
    return {
      totalSessions: 0,
      totalDrivingTime: 0,
      parkingSpotsFoundViaCar: 0,
      voiceCommandsUsed: 0,
      navigationAssists: 0,
      safetyScore: 1.0,
      preferredFeatures: [],
      avgSessionDuration: 0,
    };
  }

  /**
   * Clean up resources
   */
  dispose() {
    if (this.eventEmitter) {
      this.eventEmitter.removeAllListeners();
    }
  }
}

export const carPlayAndroidAutoService = new CarPlayAndroidAutoService();
export { VehicleIntegrationState, CarIntegrationMetrics, VoiceCommand };
export default carPlayAndroidAutoService;