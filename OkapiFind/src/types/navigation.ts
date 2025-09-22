import type { StackNavigationProp } from '@react-navigation/stack';
import type { RouteProp } from '@react-navigation/native';

export type RootStackParamList = {
  Auth: undefined;
  Map: undefined;
  Guidance: {
    userLocation: {
      latitude: number;
      longitude: number;
    };
    carLocation: {
      latitude: number;
      longitude: number;
    };
  };
  Settings: undefined;
  Legal: {
    document: 'privacy' | 'terms';
  };
  Paywall: undefined;
  SignIn: undefined;
  ARNavigation: {
    carLocation: {
      latitude: number;
      longitude: number;
    };
  };
  LiveTracking: undefined;
  Onboarding: undefined;
};

export type PremiumFeature =
  | 'unlimited_saves'
  | 'voice_guidance'
  | 'ar_navigation'
  | 'offline_mode'
  | 'advanced_analytics'
  | 'safety_mode'
  | 'photo_notes'
  | 'shake_to_save';

export type NavigationProp<T extends keyof RootStackParamList> = StackNavigationProp<RootStackParamList, T>;
export type RoutePropType<T extends keyof RootStackParamList> = RouteProp<RootStackParamList, T>;