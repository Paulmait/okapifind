import { Alert, Platform } from 'react-native';
import * as StoreReview from 'expo-store-review';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface FeedbackData {
  type: 'bug' | 'feature' | 'general';
  subject: string;
  message: string;
  email?: string;
  includeDeviceInfo: boolean;
  rating?: number;
}

class FeedbackService {
  async submitFeedback(data: FeedbackData): Promise<boolean> {
    try {
      const deviceInfo = data.includeDeviceInfo ? this.getDeviceInfo() : {};

      const feedbackPayload = {
        ...data,
        deviceInfo,
        timestamp: new Date().toISOString(),
        version: '1.0.0',
      };

      // Store locally for now (in production, send to backend)
      const existingFeedback = await AsyncStorage.getItem('user_feedback') || '[]';
      const feedbackList = JSON.parse(existingFeedback);
      feedbackList.push(feedbackPayload);
      await AsyncStorage.setItem('user_feedback', JSON.stringify(feedbackList));

      return true;
    } catch (error) {
      console.error('Failed to submit feedback:', error);
      return false;
    }
  }

  async requestAppRating() {
    try {
      const isAvailable = await StoreReview.isAvailableAsync();
      if (isAvailable) {
        await StoreReview.requestReview();
      } else {
        // Fallback to store URL
        Alert.alert('Rate App', 'Please rate us on the App Store!');
      }
    } catch (error) {
      console.error('Failed to request app rating:', error);
    }
  }

  private getDeviceInfo() {
    return {
      platform: Platform.OS,
      version: Platform.Version,
      model: Platform.select({
        ios: 'iOS Device',
        android: 'Android Device',
        default: 'Unknown',
      }),
    };
  }
}

export const feedbackService = new FeedbackService();