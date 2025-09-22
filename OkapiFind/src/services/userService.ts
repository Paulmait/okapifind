/**
 * User Service
 * Handles all user-related business logic
 */

import { auth, db } from '../config/firebase.config';
import { collection, doc, getDoc, setDoc, updateDoc, deleteDoc, query, where, limit, offset, getDocs } from 'firebase/firestore';
import { User, UserPreferences, UserStats } from '../graphql/types/User';
import { supabase } from '../lib/supabase-client';

class UserService {
  private usersCollection = 'users';

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<User | null> {
    try {
      const userDoc = await getDoc(doc(db, this.usersCollection, userId));

      if (!userDoc.exists()) {
        return null;
      }

      const userData = userDoc.data();

      // Get stats from Supabase
      const stats = await this.getUserStats(userId);

      return {
        id: userId,
        email: userData.email,
        name: userData.name,
        photoURL: userData.photoURL,
        stats,
        preferences: userData.preferences || this.getDefaultPreferences(),
        createdAt: userData.createdAt?.toDate() || new Date(),
        updatedAt: userData.updatedAt?.toDate() || new Date(),
        lastActive: userData.lastActive?.toDate(),
        isPremium: userData.isPremium || false,
        subscriptionExpiresAt: userData.subscriptionExpiresAt?.toDate(),
      };
    } catch (error) {
      console.error('Error getting user:', error);
      throw error;
    }
  }

  /**
   * Get multiple users (admin only)
   */
  async getUsers({ limit: limitNum = 10, offset: offsetNum = 0 }): Promise<User[]> {
    try {
      const usersQuery = query(
        collection(db, this.usersCollection),
        // Note: Firestore doesn't have direct offset, using startAfter instead
      );

      const snapshot = await getDocs(usersQuery);
      const users: User[] = [];

      for (const doc of snapshot.docs) {
        const userData = doc.data();
        const stats = await this.getUserStats(doc.id);

        users.push({
          id: doc.id,
          email: userData.email,
          name: userData.name,
          photoURL: userData.photoURL,
          stats,
          preferences: userData.preferences || this.getDefaultPreferences(),
          createdAt: userData.createdAt?.toDate() || new Date(),
          updatedAt: userData.updatedAt?.toDate() || new Date(),
          lastActive: userData.lastActive?.toDate(),
          isPremium: userData.isPremium || false,
          subscriptionExpiresAt: userData.subscriptionExpiresAt?.toDate(),
        });
      }

      return users.slice(offsetNum, offsetNum + limitNum);
    } catch (error) {
      console.error('Error getting users:', error);
      throw error;
    }
  }

  /**
   * Update user profile
   */
  async updateProfile(userId: string, updates: { name?: string; photoURL?: string }): Promise<User> {
    try {
      const updateData: any = {
        ...updates,
        updatedAt: new Date(),
      };

      await updateDoc(doc(db, this.usersCollection, userId), updateData);

      const user = await this.getUserById(userId);
      if (!user) throw new Error('User not found after update');

      return user;
    } catch (error) {
      console.error('Error updating profile:', error);
      throw error;
    }
  }

  /**
   * Update user preferences
   */
  async updatePreferences(userId: string, preferences: UserPreferences): Promise<User> {
    try {
      await updateDoc(doc(db, this.usersCollection, userId), {
        preferences,
        updatedAt: new Date(),
      });

      const user = await this.getUserById(userId);
      if (!user) throw new Error('User not found after update');

      return user;
    } catch (error) {
      console.error('Error updating preferences:', error);
      throw error;
    }
  }

  /**
   * Delete user account
   */
  async deleteUser(userId: string): Promise<void> {
    try {
      // Delete from Firestore
      await deleteDoc(doc(db, this.usersCollection, userId));

      // Delete related data from Supabase
      await supabase
        .from('parking_sessions')
        .delete()
        .eq('user_id', userId);

      await supabase
        .from('meter_photos')
        .delete()
        .eq('user_id', userId);

      // Delete auth user
      const currentUser = auth.currentUser;
      if (currentUser && currentUser.uid === userId) {
        await currentUser.delete();
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      throw error;
    }
  }

  /**
   * Get user statistics
   */
  private async getUserStats(userId: string): Promise<UserStats> {
    try {
      // Get sessions data
      const { data: sessions } = await supabase
        .from('parking_sessions')
        .select('*')
        .eq('user_id', userId);

      const totalSessions = sessions?.length || 0;

      // Get photos count
      const { count: photosCount } = await supabase
        .from('meter_photos')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      // Get timer count
      const { count: timerCount } = await supabase
        .from('parking_timers')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      // Calculate average session duration
      let avgDuration = 0;
      let longestSession = 0;

      if (sessions && sessions.length > 0) {
        const durations = sessions
          .filter(s => s.end_time)
          .map(s => {
            const start = new Date(s.start_time).getTime();
            const end = new Date(s.end_time).getTime();
            return (end - start) / 1000 / 60; // minutes
          });

        if (durations.length > 0) {
          avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
          longestSession = Math.max(...durations);
        }
      }

      return {
        totalSessions,
        totalPhotos: photosCount || 0,
        totalTimers: timerCount || 0,
        averageSessionDuration: Math.round(avgDuration),
        longestParkingSession: Math.round(longestSession),
      };
    } catch (error) {
      console.error('Error getting user stats:', error);
      return {
        totalSessions: 0,
        totalPhotos: 0,
        totalTimers: 0,
        averageSessionDuration: 0,
        longestParkingSession: 0,
      };
    }
  }

  /**
   * Get default user preferences
   */
  private getDefaultPreferences(): UserPreferences {
    return {
      notificationsEnabled: true,
      soundEnabled: true,
      vibrationEnabled: true,
      defaultTimerMinutes: 120,
      theme: 'light',
      language: 'en',
      distanceUnit: 'meters',
      autoStartTimer: false,
    };
  }

  /**
   * Create or update user
   */
  async createOrUpdateUser(userId: string, userData: any): Promise<User> {
    try {
      const userRef = doc(db, this.usersCollection, userId);
      const userDoc = await getDoc(userRef);

      if (userDoc.exists()) {
        // Update existing user
        await updateDoc(userRef, {
          ...userData,
          updatedAt: new Date(),
          lastActive: new Date(),
        });
      } else {
        // Create new user
        await setDoc(userRef, {
          ...userData,
          preferences: this.getDefaultPreferences(),
          createdAt: new Date(),
          updatedAt: new Date(),
          lastActive: new Date(),
          isPremium: false,
        });
      }

      const user = await this.getUserById(userId);
      if (!user) throw new Error('User not found after create/update');

      return user;
    } catch (error) {
      console.error('Error creating/updating user:', error);
      throw error;
    }
  }
}

export const userService = new UserService();