/**
 * Global type declarations for missing types and properties
 */

// Global __DEV__ variable for React Native
declare var __DEV__: boolean;

// Extended Error type with RevenueCat and Firebase specific properties
interface CustomError extends Error {
  userCancelled?: boolean;
  code?: string;
}

// RevenueCat method extensions
declare module 'react-native-purchases' {
  namespace Purchases {
    function logIn(userId: string): Promise<{ customerInfo: any }>;
    function logOut(): Promise<void>;
  }
}

// Firebase Firestore missing exports
declare module 'firebase/firestore' {
  export function offset(offset: number): any;
}

// Expo Notifications extensions for legacy methods
declare module 'expo-notifications' {
  export function presentNotificationAsync(content: any, trigger?: any): Promise<string>;
  export function removeNotificationSubscription(subscription: any): void;
}

// Notification trigger type extensions
declare module 'expo-notifications' {
  export interface TimeIntervalTriggerInput {
    type: 'timeInterval';
    seconds: number;
    repeats?: boolean;
  }

  export type NotificationTriggerInput = TimeIntervalTriggerInput | any;
}