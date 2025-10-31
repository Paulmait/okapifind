/**
 * Parking Spot Number Detection Service
 * OCR on spot number signs - "A123" or "456"
 * Premium feature - revenue driver
 */

import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase-client';
import { analytics } from './analytics';
import { offlineQueue } from './offlineQueue';

export interface SpotNumberResult {
  spot_number: string;
  confidence: number; // 0-1
  raw_text?: string;
  formatted?: string; // e.g., "A-123" formatted from "A123"
}

class SpotNumberDetectionService {
  /**
   * Capture and detect spot number
   */
  async captureSpotNumber(sessionId: string): Promise<SpotNumberResult | null> {
    try {
      // Check camera permission
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('Camera permission denied');
      }

      // Launch camera
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 1.0, // High quality for OCR
        exif: false,
      });

      if (result.canceled) {
        return null;
      }

      const imageUri = result.assets[0].uri;

      // Perform OCR
      const ocrResult = await this.performOCR(imageUri);

      if (ocrResult) {
        // Save to database
        await this.saveSpotNumber(sessionId, ocrResult, imageUri);

        analytics.logEvent('spot_number_detected', {
          session_id: sessionId,
          spot_number: ocrResult.spot_number,
          confidence: ocrResult.confidence,
        });
      }

      return ocrResult;
    } catch (error) {
      console.error('[SpotNumberDetection] Capture error:', error);
      analytics.logEvent('spot_number_detection_failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Perform OCR on image
   * Uses Google Cloud Vision API or similar
   */
  private async performOCR(imageUri: string): Promise<SpotNumberResult | null> {
    try {
      // Upload image to Supabase storage for processing
      const blob = await fetch(imageUri).then((r) => r.blob());
      const fileName = `spot-numbers/${Date.now()}.jpg`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('parking-images')
        .upload(fileName, blob, {
          contentType: 'image/jpeg',
        });

      if (uploadError) {
        throw uploadError;
      }

      // Call Edge Function for OCR processing
      const { data, error } = await supabase.functions.invoke('detect-spot-number', {
        body: {
          image_path: uploadData.path,
        },
      });

      if (error) {
        // Fallback: Basic regex-based detection
        console.warn('[SpotNumberDetection] OCR service error, using fallback:', error);
        return this.fallbackDetection(imageUri);
      }

      if (!data || !data.spot_number) {
        return null;
      }

      return {
        spot_number: data.spot_number,
        confidence: data.confidence || 0.5,
        raw_text: data.raw_text,
        formatted: this.formatSpotNumber(data.spot_number),
      };
    } catch (error) {
      console.error('[SpotNumberDetection] OCR error:', error);
      // Use fallback detection
      return this.fallbackDetection(imageUri);
    }
  }

  /**
   * Fallback detection using basic pattern matching
   * For when OCR service is unavailable
   */
  private fallbackDetection(_imageUri: string): SpotNumberResult | null {
    // TODO: In production, could use on-device ML model
    // For now, return null - OCR service required
    return null;
  }

  /**
   * Format spot number for display
   * e.g., "A123" -> "A-123", "456" -> "#456"
   */
  private formatSpotNumber(spotNumber: string): string {
    // Remove any whitespace
    const cleaned = spotNumber.trim().toUpperCase();

    // Pattern: Letter(s) followed by number(s)
    const match = cleaned.match(/^([A-Z]+)(\d+)$/);
    if (match) {
      return `${match[1]}-${match[2]}`;
    }

    // Pattern: Just numbers
    if (/^\d+$/.test(cleaned)) {
      return `#${cleaned}`;
    }

    // Return as-is
    return cleaned;
  }

  /**
   * Save spot number to database
   */
  private async saveSpotNumber(
    sessionId: string,
    result: SpotNumberResult,
    imageUri: string
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('parking_sessions')
        .update({
          spot_number: result.spot_number,
          spot_number_confidence: result.confidence,
        })
        .eq('id', sessionId);

      if (error) {
        throw error;
      }

      // Also save the image for reference
      await this.uploadSpotImage(sessionId, imageUri);
    } catch (error) {
      console.error('[SpotNumberDetection] Save error:', error);

      // Queue for offline sync
      await offlineQueue.addToQueue({
        type: 'update_parking',
        data: {
          session_id: sessionId,
          spot_number: result.spot_number,
          spot_number_confidence: result.confidence,
        },
        timestamp: Date.now(),
      });

      throw error;
    }
  }

  /**
   * Upload spot image to storage
   */
  private async uploadSpotImage(sessionId: string, imageUri: string): Promise<void> {
    try {
      const blob = await fetch(imageUri).then((r) => r.blob());
      const fileName = `spots/${sessionId}/spot-number.jpg`;

      await supabase.storage.from('parking-images').upload(fileName, blob, {
        contentType: 'image/jpeg',
        upsert: true,
      });
    } catch (error) {
      console.error('[SpotNumberDetection] Image upload error:', error);
      // Non-critical, don't throw
    }
  }

  /**
   * Get spot number from session
   */
  async getSpotNumber(sessionId: string): Promise<SpotNumberResult | null> {
    try {
      const { data, error } = await supabase
        .from('parking_sessions')
        .select('spot_number, spot_number_confidence')
        .eq('id', sessionId)
        .single();

      if (error || !data || !data.spot_number) {
        return null;
      }

      return {
        spot_number: data.spot_number,
        confidence: data.spot_number_confidence || 0,
        formatted: this.formatSpotNumber(data.spot_number),
      };
    } catch (error) {
      console.error('[SpotNumberDetection] Get error:', error);
      return null;
    }
  }

  /**
   * Update spot number manually
   */
  async updateSpotNumber(sessionId: string, spotNumber: string): Promise<void> {
    try {
      const formatted = this.formatSpotNumber(spotNumber);

      const { error } = await supabase
        .from('parking_sessions')
        .update({
          spot_number: spotNumber,
          spot_number_confidence: 1.0, // Manual entry is 100% confidence
        })
        .eq('id', sessionId);

      if (error) {
        throw error;
      }

      analytics.logEvent('spot_number_manual_entry', {
        session_id: sessionId,
        spot_number: spotNumber,
        formatted,
      });
    } catch (error) {
      console.error('[SpotNumberDetection] Update error:', error);

      // Queue for offline sync
      await offlineQueue.addToQueue({
        type: 'update_parking',
        data: {
          session_id: sessionId,
          spot_number: spotNumber,
          spot_number_confidence: 1.0,
        },
        timestamp: Date.now(),
      });

      throw error;
    }
  }
}

// Export singleton
export const spotNumberDetection = new SpotNumberDetectionService();
export default spotNumberDetection;
