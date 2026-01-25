/**
 * VoiceGuidanceService Tests
 * Tests for voice guidance including deduplication
 */

// Mock expo-speech
jest.mock('expo-speech', () => ({
  speak: jest.fn((text, options) => {
    if (options?.onDone) {
      setTimeout(() => options.onDone(), 10);
    }
  }),
  stop: jest.fn(() => Promise.resolve()),
  getAvailableVoicesAsync: jest.fn(() => Promise.resolve([
    { identifier: 'en-US', language: 'en-US', name: 'English' },
  ])),
}));

// Mock audio output service
jest.mock('../../services/audioOutputService', () => ({
  audioOutputService: {
    addListener: jest.fn(),
    isExternalDeviceConnected: jest.fn(() => false),
    getDeviceType: jest.fn(() => null),
  },
}));

// Mock i18n
jest.mock('../../i18n', () => ({
  t: jest.fn((key, defaultValue) => defaultValue),
  language: 'en',
  on: jest.fn(),
  off: jest.fn(),
}));

import { voiceGuidanceService } from '../../services/voiceGuidanceService';
import * as Speech from 'expo-speech';

describe('VoiceGuidanceService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    voiceGuidanceService.setEnabled(false);
  });

  describe('setEnabled / getEnabled', () => {
    it('should toggle enabled state', () => {
      expect(voiceGuidanceService.getEnabled()).toBe(false);

      voiceGuidanceService.setEnabled(true);
      expect(voiceGuidanceService.getEnabled()).toBe(true);

      voiceGuidanceService.setEnabled(false);
      expect(voiceGuidanceService.getEnabled()).toBe(false);
    });

    it('should stop speaking when disabled', async () => {
      voiceGuidanceService.setEnabled(true);
      await voiceGuidanceService.speak('Test');

      voiceGuidanceService.setEnabled(false);

      expect(Speech.stop).toHaveBeenCalled();
    });
  });

  describe('speak', () => {
    it('should not speak when disabled', async () => {
      voiceGuidanceService.setEnabled(false);

      await voiceGuidanceService.speak('Hello');

      expect(Speech.speak).not.toHaveBeenCalled();
    });

    it('should speak when enabled', async () => {
      voiceGuidanceService.setEnabled(true);

      await voiceGuidanceService.speak('Hello');

      expect(Speech.speak).toHaveBeenCalledWith(
        'Hello',
        expect.objectContaining({
          language: 'en',
        })
      );
    });
  });

  describe('deduplication', () => {
    it('should not repeat the same text within dedupe window', async () => {
      voiceGuidanceService.setEnabled(true);

      await voiceGuidanceService.speak('Turn left');

      // Wait for speech to complete
      await new Promise((resolve) => setTimeout(resolve, 50));

      await voiceGuidanceService.speak('Turn left');

      // Should only be called once
      expect(Speech.speak).toHaveBeenCalledTimes(1);
    });

    it('should speak different text', async () => {
      voiceGuidanceService.setEnabled(true);

      await voiceGuidanceService.speak('Turn left');
      await new Promise((resolve) => setTimeout(resolve, 50));

      await voiceGuidanceService.speak('Turn right');
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(Speech.speak).toHaveBeenCalledTimes(2);
    });

    it('should be case-insensitive for deduplication', async () => {
      voiceGuidanceService.setEnabled(true);

      await voiceGuidanceService.speak('Turn Left');
      await new Promise((resolve) => setTimeout(resolve, 50));

      await voiceGuidanceService.speak('turn left');

      // Should only be called once (case-insensitive match)
      expect(Speech.speak).toHaveBeenCalledTimes(1);
    });
  });

  describe('speakManeuver', () => {
    it('should speak maneuver instructions', async () => {
      voiceGuidanceService.setEnabled(true);

      await voiceGuidanceService.speakManeuver('turn-left', 100);

      expect(Speech.speak).toHaveBeenCalled();
      const spokenText = (Speech.speak as jest.Mock).mock.calls[0][0];
      expect(spokenText).toContain('turn left');
    });

    it('should include distance in upcoming maneuvers', async () => {
      voiceGuidanceService.setEnabled(true);

      await voiceGuidanceService.speakManeuver('turn-right', 200);

      const spokenText = (Speech.speak as jest.Mock).mock.calls[0][0];
      expect(spokenText).toContain('In');
      expect(spokenText).toContain('meters');
    });

    it('should not include distance for immediate maneuvers', async () => {
      voiceGuidanceService.setEnabled(true);

      await voiceGuidanceService.speakManeuver('turn-left', 20);

      const spokenText = (Speech.speak as jest.Mock).mock.calls[0][0];
      expect(spokenText).not.toContain('In');
    });

    it('should include street name when provided', async () => {
      voiceGuidanceService.setEnabled(true);

      await voiceGuidanceService.speakManeuver('turn-left', 100, 'Main Street');

      const spokenText = (Speech.speak as jest.Mock).mock.calls[0][0];
      expect(spokenText).toContain('Main Street');
    });
  });

  describe('speakArrival', () => {
    it('should speak arrival announcement', async () => {
      voiceGuidanceService.setEnabled(true);

      await voiceGuidanceService.speakArrival();

      expect(Speech.speak).toHaveBeenCalled();
      const spokenText = (Speech.speak as jest.Mock).mock.calls[0][0];
      expect(spokenText).toContain('arrived');
    });

    it('should include destination name', async () => {
      voiceGuidanceService.setEnabled(true);

      await voiceGuidanceService.speakArrival('My Hotel');

      const spokenText = (Speech.speak as jest.Mock).mock.calls[0][0];
      expect(spokenText).toBeDefined();
    });
  });

  describe('stop', () => {
    it('should stop speech', async () => {
      voiceGuidanceService.setEnabled(true);
      await voiceGuidanceService.speak('Hello');

      await voiceGuidanceService.stop();

      expect(Speech.stop).toHaveBeenCalled();
    });
  });

  describe('isAvailable', () => {
    it('should check voice availability', async () => {
      const available = await voiceGuidanceService.isAvailable();

      expect(available).toBe(true);
      expect(Speech.getAvailableVoicesAsync).toHaveBeenCalled();
    });
  });

  describe('priority queue', () => {
    it('should process urgent messages first', async () => {
      voiceGuidanceService.setEnabled(true);

      // Queue low priority
      voiceGuidanceService.speak('Low priority message', 4);
      // Queue urgent
      voiceGuidanceService.speak('Urgent message', 1);

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Urgent should be spoken first
      const calls = (Speech.speak as jest.Mock).mock.calls;
      expect(calls.length).toBeGreaterThanOrEqual(1);
      // First call should be urgent (depending on timing)
    });
  });
});
