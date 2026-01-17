/**
 * Text-to-Speech Service
 * Wrapper for react-native-tts
 */

import { Platform } from 'react-native';

// TTS module - conditionally import to avoid web issues
let Tts: any = null;

if (Platform.OS !== 'web') {
  try {
    Tts = require('react-native-tts').default;
  } catch (error) {
    console.warn('TTS not available:', error);
  }
}

export const tts = {
  /**
   * Speak text
   */
  speak: async (text: string, options?: { rate?: number; pitch?: number; language?: string }): Promise<void> => {
    if (!Tts || Platform.OS === 'web') {
      console.log('[TTS Mock]:', text);
      return;
    }

    try {
      if (options?.language) {
        await Tts.setDefaultLanguage(options.language);
      }
      if (options?.rate !== undefined) {
        await Tts.setDefaultRate(options.rate);
      }
      if (options?.pitch !== undefined) {
        await Tts.setDefaultPitch(options.pitch);
      }

      await Tts.speak(text);
    } catch (error) {
      console.warn('TTS speak error:', error);
    }
  },

  /**
   * Stop speaking
   */
  stop: async (): Promise<void> => {
    if (!Tts || Platform.OS === 'web') return;

    try {
      await Tts.stop();
    } catch (error) {
      console.warn('TTS stop error:', error);
    }
  },

  /**
   * Check if TTS is available
   */
  isAvailable: (): boolean => {
    return Tts !== null && Platform.OS !== 'web';
  },

  /**
   * Get available voices
   */
  getVoices: async (): Promise<any[]> => {
    if (!Tts || Platform.OS === 'web') return [];

    try {
      return await Tts.voices();
    } catch (error) {
      console.warn('TTS getVoices error:', error);
      return [];
    }
  },

  /**
   * Set default language
   */
  setLanguage: async (language: string): Promise<void> => {
    if (!Tts || Platform.OS === 'web') return;

    try {
      await Tts.setDefaultLanguage(language);
    } catch (error) {
      console.warn('TTS setLanguage error:', error);
    }
  },
};

export default tts;
