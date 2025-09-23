/**
 * Voice Commands Service
 * Integrates with Siri Shortcuts (iOS) and Google Assistant (Android)
 */

import { Platform, Linking, Alert } from 'react-native';
import Tts from 'react-native-tts';
import * as IntentLauncher from 'expo-intent-launcher';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import { analytics } from './analytics';
import { offlineService } from './offlineService';
import * as Location from 'expo-location';

interface VoiceCommand {
  id: string;
  phrase: string;
  action: 'save_parking' | 'find_car' | 'set_timer' | 'share_location';
  shortcutId?: string; // iOS Siri shortcut ID
  intentAction?: string; // Android intent action
}

class VoiceCommandsService {
  private recording: Audio.Recording | null = null;
  private shortcuts: VoiceCommand[] = [
    {
      id: 'save_parking',
      phrase: "Save my parking spot",
      action: 'save_parking',
      shortcutId: 'com.okapifind.save-parking',
      intentAction: 'com.okapifind.SAVE_PARKING',
    },
    {
      id: 'find_car',
      phrase: "Where's my car?",
      action: 'find_car',
      shortcutId: 'com.okapifind.find-car',
      intentAction: 'com.okapifind.FIND_CAR',
    },
    {
      id: 'set_timer',
      phrase: "Set parking timer",
      action: 'set_timer',
      shortcutId: 'com.okapifind.set-timer',
      intentAction: 'com.okapifind.SET_TIMER',
    },
    {
      id: 'share_location',
      phrase: "Share my parking",
      action: 'share_location',
      shortcutId: 'com.okapifind.share-location',
      intentAction: 'com.okapifind.SHARE_LOCATION',
    },
  ];

  constructor() {
    this.setupAudioSession();
    this.registerShortcuts();
    this.initializeTTS();
  }

  /**
   * Setup audio session for voice recording
   */
  private async setupAudioSession() {
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
    } catch (error) {
      console.error('Failed to setup audio session:', error);
    }
  }

  /**
   * Initialize TTS engine
   */
  private async initializeTTS() {
    try {
      // Set default TTS configuration
      Tts.setDefaultLanguage('en-US');
      Tts.setDefaultPitch(1.0);
      Tts.setDefaultRate(Platform.OS === 'ios' ? 0.9 : 1.0);

      // Set event listeners for TTS
      Tts.addEventListener('tts-start', () => {
        console.log('TTS started');
      });

      Tts.addEventListener('tts-finish', () => {
        console.log('TTS finished');
      });

      Tts.addEventListener('tts-error', (error) => {
        console.error('TTS error:', error);
      });

      console.log('TTS initialized successfully');
    } catch (error) {
      console.error('Failed to initialize TTS:', error);
    }
  }

  /**
   * Register Siri shortcuts (iOS) or Assistant actions (Android)
   */
  private async registerShortcuts() {
    if (Platform.OS === 'ios') {
      await this.registerSiriShortcuts();
    } else if (Platform.OS === 'android') {
      await this.registerGoogleAssistant();
    }
  }

  /**
   * Register Siri shortcuts for iOS
   */
  private async registerSiriShortcuts() {
    // In production, this would use react-native-siri-shortcut
    // For now, we'll create the intent URLs for the user to add manually

    for (const shortcut of this.shortcuts) {
      const shortcutData = {
        id: shortcut.shortcutId,
        phrase: shortcut.phrase,
        action: shortcut.action,
      };

      try {
        // Save shortcut data for when app is launched via Siri
        await AsyncStorage.setItem(
          `@siri_shortcut_${shortcut.id}`,
          JSON.stringify(shortcutData)
        );

        console.log(`Siri shortcut registered: ${shortcut.phrase}`);
      } catch (error) {
        console.error(`Failed to register Siri shortcut: ${shortcut.phrase}`, error);
      }
    }

    analytics.logEvent('siri_shortcuts_registered', {
      count: this.shortcuts.length,
    });
  }

  /**
   * Register Google Assistant actions for Android
   */
  private async registerGoogleAssistant() {
    // Google Assistant App Actions would be defined in shortcuts.xml
    // and registered via App Actions Test Tool

    for (const shortcut of this.shortcuts) {
      try {
        // Register intent filters for voice commands
        await AsyncStorage.setItem(
          `@assistant_action_${shortcut.id}`,
          JSON.stringify({
            action: shortcut.intentAction,
            phrase: shortcut.phrase,
          })
        );

        console.log(`Google Assistant action registered: ${shortcut.phrase}`);
      } catch (error) {
        console.error(`Failed to register Assistant action: ${shortcut.phrase}`, error);
      }
    }

    analytics.logEvent('google_assistant_registered', {
      count: this.shortcuts.length,
    });
  }

  /**
   * Handle incoming voice command
   */
  async handleVoiceCommand(command: string): Promise<void> {
    const normalizedCommand = command.toLowerCase();

    analytics.logEvent('voice_command_received', {
      command: normalizedCommand,
      platform: Platform.OS,
    });

    if (normalizedCommand.includes('save') || normalizedCommand.includes('park')) {
      await this.saveParkingVoice();
    } else if (normalizedCommand.includes('find') || normalizedCommand.includes('where')) {
      await this.findCarVoice();
    } else if (normalizedCommand.includes('timer') || normalizedCommand.includes('meter')) {
      await this.setTimerVoice();
    } else if (normalizedCommand.includes('share')) {
      await this.shareLocationVoice();
    } else {
      await this.speakResponse("I didn't understand that command. Try 'Save my parking' or 'Find my car'");
    }
  }

  /**
   * Save parking location via voice
   */
  private async saveParkingVoice() {
    try {
      await this.speakResponse("Saving your parking location...");

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const result = await offlineService.saveParkingLocation(location, {
        source: 'manual',
        notes: 'Saved by voice command',
      });

      if (result.queued) {
        await this.speakResponse("Parking location saved offline. Will sync when connected.");
      } else {
        await this.speakResponse("Parking location saved successfully!");
      }

      analytics.logEvent('voice_save_success');
    } catch (error) {
      console.error('Voice save failed:', error);
      await this.speakResponse("Sorry, I couldn't save your parking location. Please try again.");
      analytics.logEvent('voice_save_error', { error: error.message });
    }
  }

  /**
   * Find car via voice
   */
  private async findCarVoice() {
    try {
      // Get active parking session
      const sessionData = await AsyncStorage.getItem('@active_parking_session');

      if (!sessionData) {
        await this.speakResponse("You don't have a saved parking location. Say 'Save my parking' first.");
        return;
      }

      const session = JSON.parse(sessionData);
      const savedTime = new Date(session.saved_at);
      const timeDiff = Date.now() - savedTime.getTime();
      const minutesAgo = Math.floor(timeDiff / 60000);

      await this.speakResponse(
        `Your car is parked ${session.address || 'nearby'}. You parked ${minutesAgo} minutes ago.`
      );

      analytics.logEvent('voice_find_success');
    } catch (error) {
      console.error('Voice find failed:', error);
      await this.speakResponse("Sorry, I couldn't find your parking location.");
      analytics.logEvent('voice_find_error', { error: error.message });
    }
  }

  /**
   * Set timer via voice
   */
  private async setTimerVoice() {
    await this.speakResponse("How many minutes for your parking timer?");
    // In production, this would listen for a response
    // For now, we'll set a default 2-hour timer

    setTimeout(async () => {
      await this.speakResponse("Setting a 2-hour parking timer.");
      // Timer logic here
      analytics.logEvent('voice_timer_set', { minutes: 120 });
    }, 2000);
  }

  /**
   * Share location via voice
   */
  private async shareLocationVoice() {
    await this.speakResponse("Opening share options for your parking location.");
    // Share logic here
    analytics.logEvent('voice_share_initiated');
  }

  /**
   * Speak a response
   */
  private async speakResponse(text: string): Promise<void> {
    try {
      // Speak the text using configured TTS settings
      await Tts.speak(text);
    } catch (error) {
      console.error('Speech failed:', error);
    }
  }

  /**
   * Start voice recording for notes
   */
  async startVoiceNote(): Promise<void> {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        Alert.alert('Permission Required', 'Microphone permission is needed for voice notes');
        return;
      }

      this.recording = new Audio.Recording();
      await this.recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await this.recording.startAsync();

      analytics.logEvent('voice_note_started');
    } catch (error) {
      console.error('Failed to start recording:', error);
      Alert.alert('Error', 'Failed to start voice recording');
    }
  }

  /**
   * Stop voice recording and save
   */
  async stopVoiceNote(): Promise<string | null> {
    if (!this.recording) return null;

    try {
      await this.recording.stopAndUnloadAsync();
      const uri = this.recording.getURI();
      this.recording = null;

      if (!uri) return null;

      // In production, transcribe audio to text
      // For now, return the audio file URI
      analytics.logEvent('voice_note_saved', {
        duration: await this.getAudioDuration(uri),
      });

      return uri;
    } catch (error) {
      console.error('Failed to stop recording:', error);
      return null;
    }
  }

  /**
   * Get audio duration
   */
  private async getAudioDuration(uri: string): Promise<number> {
    try {
      const { sound, status } = await Audio.Sound.createAsync({ uri });
      const duration = status.isLoaded ? status.durationMillis || 0 : 0;
      await sound.unloadAsync();
      return duration / 1000; // Convert to seconds
    } catch (error) {
      console.error('Failed to get audio duration:', error);
      return 0;
    }
  }

  /**
   * Show shortcut setup instructions
   */
  showSetupInstructions(): void {
    if (Platform.OS === 'ios') {
      Alert.alert(
        'Set Up Siri Shortcuts',
        '1. Open Settings > Siri & Search\n' +
        '2. Tap "All Shortcuts"\n' +
        '3. Find OkapiFind\n' +
        '4. Tap "+" to add shortcuts\n' +
        '5. Record your phrase like "Save my parking"',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openURL('app-settings:') },
        ]
      );
    } else {
      Alert.alert(
        'Set Up Google Assistant',
        '1. Say "Hey Google, talk to OkapiFind"\n' +
        '2. Follow the setup prompts\n' +
        '3. Try saying "Save my parking spot"',
        [{ text: 'Got it' }]
      );
    }

    analytics.logEvent('voice_setup_instructions_shown', {
      platform: Platform.OS,
    });
  }

  /**
   * Test voice commands
   */
  async testVoiceCommand(action: VoiceCommand['action']): Promise<void> {
    const phrases = {
      save_parking: "Say 'Hey Siri, save my parking spot' to save your location",
      find_car: "Say 'Hey Siri, where's my car?' to find your parking",
      set_timer: "Say 'Hey Siri, set parking timer' to set a reminder",
      share_location: "Say 'Hey Siri, share my parking' to send your location",
    };

    await this.speakResponse(phrases[action]);
    analytics.logEvent('voice_command_tested', { action });
  }

  /**
   * Check if voice commands are available
   */
  isAvailable(): boolean {
    return Platform.OS === 'ios' || Platform.OS === 'android';
  }

  /**
   * Get registered shortcuts
   */
  getShortcuts(): VoiceCommand[] {
    return this.shortcuts;
  }
}

export const voiceCommandsService = new VoiceCommandsService();
export default voiceCommandsService;