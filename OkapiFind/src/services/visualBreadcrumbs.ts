/**
 * Visual Breadcrumbs Service
 * Quick landmark photos to help users remember parking location
 * "Red pillar near elevator" - Critical for massive garages
 */

import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase-client';
import { analytics } from './analytics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { offlineQueue } from './offlineQueue';

export interface VisualBreadcrumb {
  id: string;
  session_id: string;
  image_uri: string; // Local URI
  image_path?: string; // Supabase storage path
  thumbnail_uri?: string;
  description?: string; // Auto-generated or user-entered
  landmark_type?: 'pillar' | 'sign' | 'elevator' | 'stairs' | 'car' | 'other';
  color_detected?: string; // e.g., "red", "blue", "yellow"
  created_at: string;
  uploaded: boolean;
}

export interface BreadcrumbOptions {
  autoDetectLandmark?: boolean; // Use image recognition
  compressImage?: boolean; // Compress before upload
  generateThumbnail?: boolean; // Create thumbnail for quick display
  description?: string; // User-provided description
}

const BREADCRUMB_STORAGE_KEY = '@okapifind:breadcrumbs';
const MAX_BREADCRUMBS_PER_SESSION = 5;
const IMAGE_QUALITY = 0.7; // Compression quality

class VisualBreadcrumbsService {
  private breadcrumbs: Map<string, VisualBreadcrumb[]> = new Map();
  private isInitialized = false;

  constructor() {
    this.initialize();
  }

  /**
   * Initialize service - load saved breadcrumbs from storage
   */
  private async initialize() {
    if (this.isInitialized) return;

    try {
      const stored = await AsyncStorage.getItem(BREADCRUMB_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.breadcrumbs = new Map(Object.entries(parsed));
      }
      this.isInitialized = true;
    } catch (error) {
      console.error('[VisualBreadcrumbs] Init error:', error);
      this.isInitialized = true;
    }
  }

  /**
   * Capture a quick landmark photo
   * One-tap photo capture with auto-processing
   */
  async captureQuickPhoto(
    sessionId: string,
    options: BreadcrumbOptions = {}
  ): Promise<VisualBreadcrumb | null> {
    try {
      await this.initialize();

      // Check permissions
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('Camera permission denied');
      }

      // Check breadcrumb limit
      const existing = this.getBreadcrumbs(sessionId);
      if (existing.length >= MAX_BREADCRUMBS_PER_SESSION) {
        throw new Error(`Maximum ${MAX_BREADCRUMBS_PER_SESSION} breadcrumbs per parking session`);
      }

      // Launch camera
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false, // Quick capture, no editing
        quality: IMAGE_QUALITY,
        exif: false, // Don't need EXIF data
      });

      if (result.canceled) {
        return null;
      }

      const imageUri = result.assets[0].uri;

      // Create breadcrumb
      const breadcrumb: VisualBreadcrumb = {
        id: `breadcrumb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        session_id: sessionId,
        image_uri: imageUri,
        created_at: new Date().toISOString(),
        uploaded: false,
      };

      // Auto-detect landmark if enabled
      if (options.autoDetectLandmark) {
        const detection = await this.detectLandmark(imageUri);
        breadcrumb.landmark_type = detection.type;
        breadcrumb.color_detected = detection.color;
        breadcrumb.description = detection.description;
      }

      // Generate thumbnail if enabled
      if (options.generateThumbnail) {
        breadcrumb.thumbnail_uri = await this.generateThumbnail(imageUri);
      }

      // Add user description if provided
      if (options.description) {
        breadcrumb.description = options.description;
      }

      // Save locally
      await this.saveBreadcrumb(sessionId, breadcrumb);

      // Upload to Supabase (async, don't wait)
      this.uploadBreadcrumb(breadcrumb).catch((error) => {
        console.error('[VisualBreadcrumbs] Upload error:', error);
        // Will be retried via offline queue
      });

      // Analytics
      analytics.logEvent('breadcrumb_captured', {
        session_id: sessionId,
        has_detection: !!breadcrumb.landmark_type,
        landmark_type: breadcrumb.landmark_type,
        color_detected: breadcrumb.color_detected,
        total_breadcrumbs: existing.length + 1,
      });

      return breadcrumb;
    } catch (error) {
      console.error('[VisualBreadcrumbs] Capture error:', error);
      analytics.logEvent('breadcrumb_capture_failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Capture from photo library (alternative to camera)
   */
  async selectFromLibrary(
    sessionId: string,
    options: BreadcrumbOptions = {}
  ): Promise<VisualBreadcrumb | null> {
    try {
      await this.initialize();

      // Check permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('Photo library permission denied');
      }

      // Check breadcrumb limit
      const existing = this.getBreadcrumbs(sessionId);
      if (existing.length >= MAX_BREADCRUMBS_PER_SESSION) {
        throw new Error(`Maximum ${MAX_BREADCRUMBS_PER_SESSION} breadcrumbs per parking session`);
      }

      // Launch photo picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: IMAGE_QUALITY,
      });

      if (result.canceled) {
        return null;
      }

      const imageUri = result.assets[0].uri;

      // Create breadcrumb
      const breadcrumb: VisualBreadcrumb = {
        id: `breadcrumb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        session_id: sessionId,
        image_uri: imageUri,
        description: options.description,
        created_at: new Date().toISOString(),
        uploaded: false,
      };

      // Auto-detect if enabled
      if (options.autoDetectLandmark) {
        const detection = await this.detectLandmark(imageUri);
        breadcrumb.landmark_type = detection.type;
        breadcrumb.color_detected = detection.color;
        breadcrumb.description = breadcrumb.description || detection.description;
      }

      // Generate thumbnail
      if (options.generateThumbnail) {
        breadcrumb.thumbnail_uri = await this.generateThumbnail(imageUri);
      }

      // Save locally
      await this.saveBreadcrumb(sessionId, breadcrumb);

      // Upload (async)
      this.uploadBreadcrumb(breadcrumb).catch((error) => {
        console.error('[VisualBreadcrumbs] Upload error:', error);
      });

      analytics.logEvent('breadcrumb_selected_from_library', {
        session_id: sessionId,
        has_detection: !!breadcrumb.landmark_type,
      });

      return breadcrumb;
    } catch (error) {
      console.error('[VisualBreadcrumbs] Library selection error:', error);
      throw error;
    }
  }

  /**
   * Get all breadcrumbs for a parking session
   */
  getBreadcrumbs(sessionId: string): VisualBreadcrumb[] {
    return this.breadcrumbs.get(sessionId) || [];
  }

  /**
   * Delete a breadcrumb
   */
  async deleteBreadcrumb(sessionId: string, breadcrumbId: string): Promise<void> {
    try {
      const existing = this.getBreadcrumbs(sessionId);
      const updated = existing.filter((b) => b.id !== breadcrumbId);

      this.breadcrumbs.set(sessionId, updated);
      await this.persistBreadcrumbs();

      // Delete from Supabase if uploaded
      const breadcrumb = existing.find((b) => b.id === breadcrumbId);
      if (breadcrumb?.uploaded && breadcrumb.image_path) {
        await supabase.storage
          .from('parking-breadcrumbs')
          .remove([breadcrumb.image_path]);
      }

      analytics.logEvent('breadcrumb_deleted', {
        session_id: sessionId,
        breadcrumb_id: breadcrumbId,
      });
    } catch (error) {
      console.error('[VisualBreadcrumbs] Delete error:', error);
      throw error;
    }
  }

  /**
   * Clear all breadcrumbs for a session
   */
  async clearSessionBreadcrumbs(sessionId: string): Promise<void> {
    try {
      const breadcrumbs = this.getBreadcrumbs(sessionId);

      // Delete uploaded images from storage
      const uploadedPaths = breadcrumbs
        .filter((b) => b.uploaded && b.image_path)
        .map((b) => b.image_path!);

      if (uploadedPaths.length > 0) {
        await supabase.storage
          .from('parking-breadcrumbs')
          .remove(uploadedPaths);
      }

      this.breadcrumbs.delete(sessionId);
      await this.persistBreadcrumbs();

      analytics.logEvent('breadcrumbs_cleared', {
        session_id: sessionId,
        count: breadcrumbs.length,
      });
    } catch (error) {
      console.error('[VisualBreadcrumbs] Clear error:', error);
      throw error;
    }
  }

  /**
   * Save breadcrumb locally
   */
  private async saveBreadcrumb(
    sessionId: string,
    breadcrumb: VisualBreadcrumb
  ): Promise<void> {
    const existing = this.getBreadcrumbs(sessionId);
    existing.push(breadcrumb);
    this.breadcrumbs.set(sessionId, existing);
    await this.persistBreadcrumbs();
  }

  /**
   * Persist breadcrumbs to AsyncStorage
   */
  private async persistBreadcrumbs(): Promise<void> {
    try {
      const obj = Object.fromEntries(this.breadcrumbs);
      await AsyncStorage.setItem(BREADCRUMB_STORAGE_KEY, JSON.stringify(obj));
    } catch (error) {
      console.error('[VisualBreadcrumbs] Persist error:', error);
    }
  }

  /**
   * Upload breadcrumb to Supabase storage
   */
  private async uploadBreadcrumb(breadcrumb: VisualBreadcrumb): Promise<void> {
    try {
      // Get file extension
      const ext = breadcrumb.image_uri.split('.').pop() || 'jpg';
      const fileName = `${breadcrumb.session_id}/${breadcrumb.id}.${ext}`;

      // Upload image
      const blob = await fetch(breadcrumb.image_uri).then((r) => r.blob());

      const { data, error } = await supabase.storage
        .from('parking-breadcrumbs')
        .upload(fileName, blob, {
          contentType: `image/${ext}`,
          upsert: false,
        });

      if (error) {
        throw error;
      }

      // Update breadcrumb with storage path
      breadcrumb.image_path = data.path;
      breadcrumb.uploaded = true;

      // Save updated breadcrumb
      const existing = this.getBreadcrumbs(breadcrumb.session_id);
      const index = existing.findIndex((b) => b.id === breadcrumb.id);
      if (index !== -1) {
        existing[index] = breadcrumb;
        this.breadcrumbs.set(breadcrumb.session_id, existing);
        await this.persistBreadcrumbs();
      }

      analytics.logEvent('breadcrumb_uploaded', {
        session_id: breadcrumb.session_id,
        breadcrumb_id: breadcrumb.id,
      });
    } catch (error) {
      // If upload fails, queue for later
      await offlineQueue.addToQueue({
        type: 'save_photo',
        data: {
          session_id: breadcrumb.session_id,
          image_uri: breadcrumb.image_uri,
          breadcrumb_id: breadcrumb.id,
        },
        timestamp: Date.now(),
      });

      throw error;
    }
  }

  /**
   * Auto-detect landmark type and color from image
   * Uses simple heuristics - can be enhanced with ML
   */
  private async detectLandmark(
    _imageUri: string
  ): Promise<{ type?: VisualBreadcrumb['landmark_type']; color?: string; description?: string }> {
    // TODO: Implement actual image recognition
    // For now, return placeholder
    // In production, could use:
    // 1. TensorFlow Lite for on-device detection
    // 2. Google Cloud Vision API
    // 3. AWS Rekognition
    // 4. Custom ML model

    // Placeholder: Suggest common landmark types
    return {
      type: undefined,
      color: undefined,
      description: 'Parking landmark',
    };
  }

  /**
   * Generate thumbnail for quick display
   */
  private async generateThumbnail(_imageUri: string): Promise<string> {
    // TODO: Implement thumbnail generation
    // For now, use original image
    // In production, could use:
    // 1. expo-image-manipulator for resizing
    // 2. react-native-image-resizer
    return _imageUri;
  }

  /**
   * Get breadcrumb summary for display
   */
  getSummary(sessionId: string): string {
    const breadcrumbs = this.getBreadcrumbs(sessionId);

    if (breadcrumbs.length === 0) {
      return 'No landmarks saved';
    }

    const descriptions = breadcrumbs
      .map((b) => b.description || b.landmark_type || 'Landmark')
      .slice(0, 2);

    if (breadcrumbs.length === 1) {
      return descriptions[0];
    }

    if (breadcrumbs.length === 2) {
      return descriptions.join(' • ');
    }

    return `${descriptions.join(' • ')} +${breadcrumbs.length - 2} more`;
  }
}

// Export singleton
export const visualBreadcrumbs = new VisualBreadcrumbsService();
export default visualBreadcrumbs;
