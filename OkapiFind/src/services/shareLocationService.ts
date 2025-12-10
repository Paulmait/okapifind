/**
 * Share Location Service
 * Enables users to share their parked car location via SMS, WhatsApp, or link
 */

import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';
import { Platform, Alert, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase-client';

// Types
export interface ShareableLocation {
  id: string;
  latitude: number;
  longitude: number;
  address?: string;
  floorLevel?: number;
  parkingSpot?: string;
  notes?: string;
  photoUrls?: string[];
  createdAt: string;
  expiresAt: string;
  createdBy?: string;
}

export interface ShareOptions {
  method: 'link' | 'sms' | 'whatsapp' | 'email' | 'native';
  recipient?: string;
  customMessage?: string;
}

export interface ShareResult {
  success: boolean;
  shareUrl?: string;
  error?: string;
}

// Constants
const SHARE_LINK_BASE = 'https://okapifind.com/find';
const SHARE_EXPIRY_HOURS = 24;
const STORAGE_KEY = '@okapifind/shared_locations';

class ShareLocationService {
  private static instance: ShareLocationService;

  private constructor() {}

  static getInstance(): ShareLocationService {
    if (!ShareLocationService.instance) {
      ShareLocationService.instance = new ShareLocationService();
    }
    return ShareLocationService.instance;
  }

  /**
   * Create a shareable link for a parking location
   */
  async createShareableLink(location: {
    latitude: number;
    longitude: number;
    address?: string;
    floorLevel?: number;
    parkingSpot?: string;
    notes?: string;
    photoUrls?: string[];
  }): Promise<ShareResult> {
    try {
      const shareId = this.generateShareId();
      const expiresAt = new Date(Date.now() + SHARE_EXPIRY_HOURS * 60 * 60 * 1000).toISOString();

      const shareableLocation: ShareableLocation = {
        id: shareId,
        latitude: location.latitude,
        longitude: location.longitude,
        address: location.address,
        floorLevel: location.floorLevel,
        parkingSpot: location.parkingSpot,
        notes: location.notes,
        photoUrls: location.photoUrls,
        createdAt: new Date().toISOString(),
        expiresAt,
      };

      // Try to save to Supabase for web access
      const saved = await this.saveToSupabase(shareableLocation);

      // Also save locally as backup
      await this.saveLocally(shareableLocation);

      // Generate URL - if Supabase saved, use web link; otherwise use deep link
      const shareUrl = saved
        ? `${SHARE_LINK_BASE}/${shareId}`
        : this.generateDeepLink(location);

      return {
        success: true,
        shareUrl,
      };
    } catch (error) {
      console.error('Failed to create shareable link:', error);

      // Fallback to simple Google Maps link
      const mapsUrl = this.generateMapsLink(location.latitude, location.longitude);
      return {
        success: true,
        shareUrl: mapsUrl,
      };
    }
  }

  /**
   * Share location using native share sheet
   */
  async shareViaNative(
    location: { latitude: number; longitude: number; address?: string },
    customMessage?: string
  ): Promise<ShareResult> {
    try {
      const { shareUrl } = await this.createShareableLink(location);

      const message = customMessage || this.generateShareMessage(location.address, shareUrl!);

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(shareUrl!, {
          mimeType: 'text/plain',
          dialogTitle: 'Share Car Location',
        });
        return { success: true, shareUrl };
      } else {
        // Fallback: copy to clipboard
        await Clipboard.setStringAsync(message);
        Alert.alert('Link Copied', 'The share link has been copied to your clipboard.');
        return { success: true, shareUrl };
      }
    } catch (error) {
      console.error('Native share failed:', error);
      return { success: false, error: 'Failed to share location' };
    }
  }

  /**
   * Share via SMS
   */
  async shareViaSMS(
    location: { latitude: number; longitude: number; address?: string },
    phoneNumber?: string
  ): Promise<ShareResult> {
    try {
      const { shareUrl } = await this.createShareableLink(location);
      const message = this.generateShareMessage(location.address, shareUrl!);

      const smsUrl = Platform.select({
        ios: `sms:${phoneNumber || ''}&body=${encodeURIComponent(message)}`,
        android: `sms:${phoneNumber || ''}?body=${encodeURIComponent(message)}`,
        default: `sms:${phoneNumber || ''}?body=${encodeURIComponent(message)}`,
      });

      const canOpen = await Linking.canOpenURL(smsUrl);
      if (canOpen) {
        await Linking.openURL(smsUrl);
        return { success: true, shareUrl };
      } else {
        throw new Error('SMS not available');
      }
    } catch (error) {
      console.error('SMS share failed:', error);
      return { success: false, error: 'SMS not available on this device' };
    }
  }

  /**
   * Share via WhatsApp
   */
  async shareViaWhatsApp(
    location: { latitude: number; longitude: number; address?: string },
    phoneNumber?: string
  ): Promise<ShareResult> {
    try {
      const { shareUrl } = await this.createShareableLink(location);
      const message = this.generateShareMessage(location.address, shareUrl!);

      // WhatsApp URL scheme
      const whatsappUrl = phoneNumber
        ? `whatsapp://send?phone=${phoneNumber}&text=${encodeURIComponent(message)}`
        : `whatsapp://send?text=${encodeURIComponent(message)}`;

      const canOpen = await Linking.canOpenURL(whatsappUrl);
      if (canOpen) {
        await Linking.openURL(whatsappUrl);
        return { success: true, shareUrl };
      } else {
        // Try web WhatsApp as fallback
        const webWhatsApp = `https://wa.me/${phoneNumber || ''}?text=${encodeURIComponent(message)}`;
        await Linking.openURL(webWhatsApp);
        return { success: true, shareUrl };
      }
    } catch (error) {
      console.error('WhatsApp share failed:', error);
      return { success: false, error: 'WhatsApp not available' };
    }
  }

  /**
   * Share via Email
   */
  async shareViaEmail(
    location: { latitude: number; longitude: number; address?: string },
    recipient?: string
  ): Promise<ShareResult> {
    try {
      const { shareUrl } = await this.createShareableLink(location);
      const subject = 'My Parked Car Location - OkapiFind';
      const body = this.generateShareMessage(location.address, shareUrl!);

      const emailUrl = `mailto:${recipient || ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

      await Linking.openURL(emailUrl);
      return { success: true, shareUrl };
    } catch (error) {
      console.error('Email share failed:', error);
      return { success: false, error: 'Email not available' };
    }
  }

  /**
   * Copy link to clipboard
   */
  async copyToClipboard(
    location: { latitude: number; longitude: number; address?: string }
  ): Promise<ShareResult> {
    try {
      const { shareUrl } = await this.createShareableLink(location);
      await Clipboard.setStringAsync(shareUrl!);
      return { success: true, shareUrl };
    } catch (error) {
      console.error('Copy failed:', error);
      return { success: false, error: 'Failed to copy link' };
    }
  }

  /**
   * Get a shared location by ID
   */
  async getSharedLocation(shareId: string): Promise<ShareableLocation | null> {
    try {
      // Try Supabase first
      const { data, error } = await supabase
        .from('shared_locations')
        .select('*')
        .eq('id', shareId)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (data && !error) {
        return this.mapSupabaseToLocation(data);
      }

      // Fallback to local storage
      return await this.getFromLocal(shareId);
    } catch (error) {
      console.error('Failed to get shared location:', error);
      return null;
    }
  }

  // Private helper methods

  private generateShareId(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  private generateShareMessage(address: string | undefined, shareUrl: string): string {
    const locationText = address || 'my parked car';
    return `Here's where I parked: ${locationText}\n\nFind it here: ${shareUrl}\n\nSent via OkapiFind - Never lose your car again!`;
  }

  private generateMapsLink(latitude: number, longitude: number): string {
    // Universal link that works on both platforms
    return `https://maps.google.com/maps?q=${latitude},${longitude}`;
  }

  private generateDeepLink(location: { latitude: number; longitude: number }): string {
    return `okapifind://navigate?lat=${location.latitude}&lng=${location.longitude}`;
  }

  private async saveToSupabase(location: ShareableLocation): Promise<boolean> {
    try {
      const { error } = await supabase.from('shared_locations').insert({
        id: location.id,
        latitude: location.latitude,
        longitude: location.longitude,
        address: location.address,
        floor_level: location.floorLevel,
        parking_spot: location.parkingSpot,
        notes: location.notes,
        photo_urls: location.photoUrls,
        created_at: location.createdAt,
        expires_at: location.expiresAt,
      });

      return !error;
    } catch {
      return false;
    }
  }

  private async saveLocally(location: ShareableLocation): Promise<void> {
    try {
      const existing = await AsyncStorage.getItem(STORAGE_KEY);
      const locations: ShareableLocation[] = existing ? JSON.parse(existing) : [];

      // Add new location
      locations.push(location);

      // Keep only last 20 shared locations
      const trimmed = locations.slice(-20);

      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    } catch (error) {
      console.error('Failed to save locally:', error);
    }
  }

  private async getFromLocal(shareId: string): Promise<ShareableLocation | null> {
    try {
      const existing = await AsyncStorage.getItem(STORAGE_KEY);
      if (!existing) return null;

      const locations: ShareableLocation[] = JSON.parse(existing);
      const location = locations.find(l => l.id === shareId);

      if (location && new Date(location.expiresAt) > new Date()) {
        return location;
      }

      return null;
    } catch {
      return null;
    }
  }

  private mapSupabaseToLocation(data: Record<string, unknown>): ShareableLocation {
    return {
      id: data.id as string,
      latitude: data.latitude as number,
      longitude: data.longitude as number,
      address: data.address as string | undefined,
      floorLevel: data.floor_level as number | undefined,
      parkingSpot: data.parking_spot as string | undefined,
      notes: data.notes as string | undefined,
      photoUrls: data.photo_urls as string[] | undefined,
      createdAt: data.created_at as string,
      expiresAt: data.expires_at as string,
    };
  }
}

export const shareLocationService = ShareLocationService.getInstance();
export default shareLocationService;
