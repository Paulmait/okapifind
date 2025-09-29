/**
 * User Profile Manager Service
 * Handles user account creation, profiles, and preferences
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { supabase } from '../lib/supabase-client';
import { logger } from './logger';
import { dataEncryption } from './dataEncryption';
import { privacyManager } from './privacyManager';
import { sessionManager } from './sessionManager';

export interface UserProfile {
  id: string;
  email: string;
  username?: string;
  fullName?: string;
  phoneNumber?: string;
  avatar?: string;
  bio?: string;
  createdAt: Date;
  updatedAt: Date;
  emailVerified: boolean;
  phoneVerified: boolean;
  twoFactorEnabled: boolean;
  preferences: UserPreferences;
  subscription: SubscriptionInfo;
  statistics: UserStatistics;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'auto';
  language: string;
  notifications: NotificationPreferences;
  privacy: PrivacyPreferences;
  accessibility: AccessibilityPreferences;
  parkingPreferences: ParkingPreferences;
}

interface NotificationPreferences {
  push: boolean;
  email: boolean;
  sms: boolean;
  parkingReminders: boolean;
  streetCleaning: boolean;
  securityAlerts: boolean;
  promotions: boolean;
}

interface PrivacyPreferences {
  shareLocation: boolean;
  shareWithContacts: boolean;
  publicProfile: boolean;
  dataCollection: boolean;
  analytics: boolean;
}

interface AccessibilityPreferences {
  fontSize: 'small' | 'medium' | 'large';
  highContrast: boolean;
  voiceGuidance: boolean;
  hapticFeedback: boolean;
}

interface ParkingPreferences {
  defaultDuration: number; // in hours
  reminderTime: number; // minutes before expiry
  autoDetection: boolean;
  favoriteSpots: FavoriteSpot[];
  vehicleInfo: VehicleInfo[];
}

interface FavoriteSpot {
  id: string;
  name: string;
  location: { lat: number; lng: number };
  notes?: string;
}

interface VehicleInfo {
  id: string;
  make: string;
  model: string;
  year: string;
  color: string;
  licensePlate: string;
  isDefault: boolean;
}

interface SubscriptionInfo {
  tier: 'free' | 'plus' | 'pro' | 'family';
  status: 'active' | 'cancelled' | 'expired' | 'trial';
  startDate?: Date;
  endDate?: Date;
  autoRenew: boolean;
}

interface UserStatistics {
  totalParkingSessions: number;
  totalParkingTime: number; // in minutes
  favoriteLocation?: { lat: number; lng: number };
  averageParkingDuration: number;
  ticketsAvoided: number;
  moneySaved: number;
}

class UserProfileManager {
  private static instance: UserProfileManager;
  private currentProfile: UserProfile | null = null;
  private isInitialized: boolean = false;

  private constructor() {}

  static getInstance(): UserProfileManager {
    if (!UserProfileManager.instance) {
      UserProfileManager.instance = new UserProfileManager();
    }
    return UserProfileManager.instance;
  }

  /**
   * Initialize user profile manager
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Check for existing session
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        await this.loadProfile(user.id);
      }

      this.isInitialized = true;
      logger.info('User profile manager initialized');
    } catch (error) {
      logger.error('Failed to initialize user profile manager', error as Error);
    }
  }

  /**
   * Create new user account
   */
  async createAccount(
    email: string,
    password: string,
    username?: string,
    fullName?: string
  ): Promise<UserProfile> {
    try {
      // Create auth account
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username,
            full_name: fullName,
          },
        },
      });

      if (error) throw error;
      if (!data.user) throw new Error('User creation failed');

      // Create profile
      const profile = await this.createProfile(data.user.id, email, username, fullName);

      // Initialize privacy settings
      await privacyManager.initializeForUser(data.user.id);

      // Start session
      await sessionManager.startSession(data.user.id);

      logger.info('Account created successfully', { userId: data.user.id });

      return profile;
    } catch (error) {
      logger.error('Account creation failed', error as Error);
      throw error;
    }
  }

  /**
   * Create user profile
   */
  private async createProfile(
    userId: string,
    email: string,
    username?: string,
    fullName?: string
  ): Promise<UserProfile> {
    const profile: UserProfile = {
      id: userId,
      email,
      username,
      fullName,
      createdAt: new Date(),
      updatedAt: new Date(),
      emailVerified: false,
      phoneVerified: false,
      twoFactorEnabled: false,
      preferences: this.getDefaultPreferences(),
      subscription: {
        tier: 'free',
        status: 'active',
        autoRenew: false,
      },
      statistics: {
        totalParkingSessions: 0,
        totalParkingTime: 0,
        averageParkingDuration: 0,
        ticketsAvoided: 0,
        moneySaved: 0,
      },
    };

    // Save to database
    const { error } = await supabase
      .from('user_profiles')
      .insert({
        id: userId,
        email,
        username,
        full_name: fullName,
        preferences: profile.preferences,
        subscription: profile.subscription,
        statistics: profile.statistics,
      });

    if (error) throw error;

    this.currentProfile = profile;
    await this.saveProfileLocally();

    return profile;
  }

  /**
   * Sign in user
   */
  async signIn(email: string, password: string): Promise<UserProfile> {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      if (!data.user) throw new Error('Sign in failed');

      // Load profile
      const profile = await this.loadProfile(data.user.id);

      // Start session
      await sessionManager.startSession(data.user.id);

      logger.info('User signed in', { userId: data.user.id });

      return profile;
    } catch (error) {
      logger.error('Sign in failed', error as Error);
      throw error;
    }
  }

  /**
   * Sign out user
   */
  async signOut(): Promise<void> {
    try {
      // End session (handles cleanup)
      await sessionManager.endSession();

      // Sign out from Supabase
      await supabase.auth.signOut();

      // Clear local data
      await this.clearLocalData();

      this.currentProfile = null;

      logger.info('User signed out');
    } catch (error) {
      logger.error('Sign out failed', error as Error);
      throw error;
    }
  }

  /**
   * Load user profile
   */
  async loadProfile(userId: string): Promise<UserProfile> {
    try {
      // Try to load from local storage first
      const localProfile = await this.loadProfileLocally();
      if (localProfile && localProfile.id === userId) {
        this.currentProfile = localProfile;
        return localProfile;
      }

      // Fetch from database
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      if (!data) throw new Error('Profile not found');

      const profile: UserProfile = {
        id: data.id,
        email: data.email,
        username: data.username,
        fullName: data.full_name,
        phoneNumber: data.phone_number,
        avatar: data.avatar,
        bio: data.bio,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at),
        emailVerified: data.email_verified,
        phoneVerified: data.phone_verified,
        twoFactorEnabled: data.two_factor_enabled,
        preferences: data.preferences || this.getDefaultPreferences(),
        subscription: data.subscription || {
          tier: 'free',
          status: 'active',
          autoRenew: false,
        },
        statistics: data.statistics || {
          totalParkingSessions: 0,
          totalParkingTime: 0,
          averageParkingDuration: 0,
          ticketsAvoided: 0,
          moneySaved: 0,
        },
      };

      this.currentProfile = profile;
      await this.saveProfileLocally();

      return profile;
    } catch (error) {
      logger.error('Failed to load profile', error as Error);
      throw error;
    }
  }

  /**
   * Update profile
   */
  async updateProfile(updates: Partial<UserProfile>): Promise<UserProfile> {
    if (!this.currentProfile) throw new Error('No profile loaded');

    try {
      // Update local profile
      this.currentProfile = {
        ...this.currentProfile,
        ...updates,
        updatedAt: new Date(),
      };

      // Update database
      const { error } = await supabase
        .from('user_profiles')
        .update({
          username: this.currentProfile.username,
          full_name: this.currentProfile.fullName,
          phone_number: this.currentProfile.phoneNumber,
          avatar: this.currentProfile.avatar,
          bio: this.currentProfile.bio,
          updated_at: new Date(),
        })
        .eq('id', this.currentProfile.id);

      if (error) throw error;

      await this.saveProfileLocally();

      logger.info('Profile updated', { userId: this.currentProfile.id });

      return this.currentProfile;
    } catch (error) {
      logger.error('Failed to update profile', error as Error);
      throw error;
    }
  }

  /**
   * Update preferences
   */
  async updatePreferences(preferences: Partial<UserPreferences>): Promise<void> {
    if (!this.currentProfile) throw new Error('No profile loaded');

    try {
      this.currentProfile.preferences = {
        ...this.currentProfile.preferences,
        ...preferences,
      };

      const { error } = await supabase
        .from('user_profiles')
        .update({
          preferences: this.currentProfile.preferences,
          updated_at: new Date(),
        })
        .eq('id', this.currentProfile.id);

      if (error) throw error;

      await this.saveProfileLocally();

      logger.info('Preferences updated', { userId: this.currentProfile.id });
    } catch (error) {
      logger.error('Failed to update preferences', error as Error);
      throw error;
    }
  }

  /**
   * Add vehicle
   */
  async addVehicle(vehicle: Omit<VehicleInfo, 'id'>): Promise<void> {
    if (!this.currentProfile) throw new Error('No profile loaded');

    const vehicleWithId: VehicleInfo = {
      ...vehicle,
      id: this.generateId(),
    };

    if (!this.currentProfile.preferences.parkingPreferences) {
      this.currentProfile.preferences.parkingPreferences = {
        defaultDuration: 2,
        reminderTime: 15,
        autoDetection: true,
        favoriteSpots: [],
        vehicleInfo: [],
      };
    }

    this.currentProfile.preferences.parkingPreferences.vehicleInfo.push(vehicleWithId);

    await this.updatePreferences(this.currentProfile.preferences);
  }

  /**
   * Remove vehicle
   */
  async removeVehicle(vehicleId: string): Promise<void> {
    if (!this.currentProfile) throw new Error('No profile loaded');

    const vehicles = this.currentProfile.preferences.parkingPreferences?.vehicleInfo || [];
    const updated = vehicles.filter(v => v.id !== vehicleId);

    this.currentProfile.preferences.parkingPreferences = {
      ...this.currentProfile.preferences.parkingPreferences,
      vehicleInfo: updated,
    };

    await this.updatePreferences(this.currentProfile.preferences);
  }

  /**
   * Add favorite parking spot
   */
  async addFavoriteSpot(spot: Omit<FavoriteSpot, 'id'>): Promise<void> {
    if (!this.currentProfile) throw new Error('No profile loaded');

    const spotWithId: FavoriteSpot = {
      ...spot,
      id: this.generateId(),
    };

    if (!this.currentProfile.preferences.parkingPreferences) {
      this.currentProfile.preferences.parkingPreferences = {
        defaultDuration: 2,
        reminderTime: 15,
        autoDetection: true,
        favoriteSpots: [],
        vehicleInfo: [],
      };
    }

    this.currentProfile.preferences.parkingPreferences.favoriteSpots.push(spotWithId);

    await this.updatePreferences(this.currentProfile.preferences);
  }

  /**
   * Update subscription
   */
  async updateSubscription(subscription: Partial<SubscriptionInfo>): Promise<void> {
    if (!this.currentProfile) throw new Error('No profile loaded');

    this.currentProfile.subscription = {
      ...this.currentProfile.subscription,
      ...subscription,
    };

    const { error } = await supabase
      .from('user_profiles')
      .update({
        subscription: this.currentProfile.subscription,
        updated_at: new Date(),
      })
      .eq('id', this.currentProfile.id);

    if (error) throw error;

    await this.saveProfileLocally();
  }

  /**
   * Update statistics
   */
  async updateStatistics(stats: Partial<UserStatistics>): Promise<void> {
    if (!this.currentProfile) throw new Error('No profile loaded');

    this.currentProfile.statistics = {
      ...this.currentProfile.statistics,
      ...stats,
    };

    const { error } = await supabase
      .from('user_profiles')
      .update({
        statistics: this.currentProfile.statistics,
        updated_at: new Date(),
      })
      .eq('id', this.currentProfile.id);

    if (error) throw error;

    await this.saveProfileLocally();
  }

  /**
   * Delete account
   */
  async deleteAccount(): Promise<void> {
    if (!this.currentProfile) throw new Error('No profile loaded');

    try {
      // Request data deletion through privacy manager
      await privacyManager.requestDataDeletion();

      // Delete profile from database
      const { error } = await supabase
        .from('user_profiles')
        .delete()
        .eq('id', this.currentProfile.id);

      if (error) throw error;

      // Delete auth account
      await supabase.auth.admin.deleteUser(this.currentProfile.id);

      // Clear local data
      await this.clearLocalData();

      logger.info('Account deleted', { userId: this.currentProfile.id });

      this.currentProfile = null;
    } catch (error) {
      logger.error('Failed to delete account', error as Error);
      throw error;
    }
  }

  /**
   * Get default preferences
   */
  private getDefaultPreferences(): UserPreferences {
    return {
      theme: 'auto',
      language: 'en',
      notifications: {
        push: true,
        email: true,
        sms: false,
        parkingReminders: true,
        streetCleaning: true,
        securityAlerts: true,
        promotions: false,
      },
      privacy: {
        shareLocation: false,
        shareWithContacts: false,
        publicProfile: false,
        dataCollection: true,
        analytics: true,
      },
      accessibility: {
        fontSize: 'medium',
        highContrast: false,
        voiceGuidance: false,
        hapticFeedback: true,
      },
      parkingPreferences: {
        defaultDuration: 2,
        reminderTime: 15,
        autoDetection: true,
        favoriteSpots: [],
        vehicleInfo: [],
      },
    };
  }

  /**
   * Save profile locally
   */
  private async saveProfileLocally(): Promise<void> {
    if (!this.currentProfile) return;

    try {
      // Encrypt sensitive data
      const encrypted = await dataEncryption.encrypt(
        JSON.stringify(this.currentProfile)
      );

      await SecureStore.setItemAsync(
        'user_profile',
        JSON.stringify(encrypted)
      );
    } catch (error) {
      logger.error('Failed to save profile locally', error as Error);
    }
  }

  /**
   * Load profile locally
   */
  private async loadProfileLocally(): Promise<UserProfile | null> {
    try {
      const encrypted = await SecureStore.getItemAsync('user_profile');
      if (!encrypted) return null;

      const decrypted = await dataEncryption.decrypt(JSON.parse(encrypted));
      return JSON.parse(decrypted);
    } catch (error) {
      logger.error('Failed to load profile locally', error as Error);
      return null;
    }
  }

  /**
   * Clear local data
   */
  private async clearLocalData(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync('user_profile');

      // Clear other user-specific data
      const keys = await AsyncStorage.getAllKeys();
      const userKeys = keys.filter(key => key.includes('user_'));
      await AsyncStorage.multiRemove(userKeys);
    } catch (error) {
      logger.error('Failed to clear local data', error as Error);
    }
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get current profile
   */
  getCurrentProfile(): UserProfile | null {
    return this.currentProfile;
  }

  /**
   * Check if user is signed in
   */
  isSignedIn(): boolean {
    return this.currentProfile !== null;
  }

  /**
   * Check if user has premium subscription
   */
  hasPremiumSubscription(): boolean {
    if (!this.currentProfile) return false;

    return (
      this.currentProfile.subscription.tier !== 'free' &&
      this.currentProfile.subscription.status === 'active'
    );
  }
}

export const userProfileManager = UserProfileManager.getInstance();