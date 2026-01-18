import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { usePremium } from './usePremium';
import { RootStackParamList } from '../types/navigation';
import { analytics } from '../services/analytics';

type NavigationProp = StackNavigationProp<RootStackParamList>;

export enum PremiumFeature {
  // v1.0 MVP Features (Available Now)
  UNLIMITED_SAVES = 'unlimited_saves',
  PHOTO_NOTES = 'photo_notes',
  PARKING_HISTORY = 'parking_history',
  SAFETY_SHARING = 'safety_sharing',

  // v1.5 Features (Deferred)
  OCR_TIMER = 'ocr_timer',
  OFFLINE_MAPS = 'offline_maps',
  VOICE_NAVIGATION = 'voice_navigation',

  // v2.0 Features (Future)
  FAMILY_SHARING = 'family_sharing',
  AUTO_DETECTION = 'auto_detection',
  EXPORT_DATA = 'export_data',

  // Legacy - kept for backwards compatibility
  SAFETY_MODE = 'safety_mode', // renamed to SAFETY_SHARING
  PHOTO_DOCUMENTATION = 'photo_documentation', // renamed to PHOTO_NOTES
}

interface FeatureGateResult {
  canAccess: boolean;
  requiresPremium: boolean;
  checkFeature: (feature: PremiumFeature) => boolean;
  accessFeature: (feature: PremiumFeature, onSuccess: () => void) => void;
}

export const useFeatureGate = (): FeatureGateResult => {
  const navigation = useNavigation<NavigationProp>();
  const { isPremium } = usePremium();

  const checkFeature = (feature: PremiumFeature): boolean => {
    // v1.0 MVP Premium Features
    const premiumFeatures = [
      // Available now
      PremiumFeature.UNLIMITED_SAVES,
      PremiumFeature.PHOTO_NOTES,
      PremiumFeature.PARKING_HISTORY,
      PremiumFeature.SAFETY_SHARING,
      // Legacy aliases
      PremiumFeature.SAFETY_MODE,
      PremiumFeature.PHOTO_DOCUMENTATION,
      // Future features (still gated for when they're added)
      PremiumFeature.OCR_TIMER,
      PremiumFeature.OFFLINE_MAPS,
      PremiumFeature.VOICE_NAVIGATION,
      PremiumFeature.FAMILY_SHARING,
      PremiumFeature.AUTO_DETECTION,
      PremiumFeature.EXPORT_DATA,
    ];

    // Check if feature requires premium
    const requiresPremium = premiumFeatures.includes(feature);

    // If feature requires premium and user is not premium, return false
    if (requiresPremium && !isPremium) {
      return false;
    }

    return true;
  };

  const accessFeature = (feature: PremiumFeature, onSuccess: () => void) => {
    if (checkFeature(feature)) {
      // User has access, proceed with feature
      analytics.logPremiumFeatureAccessed(feature);
      onSuccess();
    } else {
      // Feature is gated, log event and navigate to PaywallScreen
      analytics.logFeatureGated(feature);
      navigation.navigate('Paywall');
    }
  };

  return {
    canAccess: isPremium,
    requiresPremium: !isPremium,
    checkFeature,
    accessFeature,
  };
};