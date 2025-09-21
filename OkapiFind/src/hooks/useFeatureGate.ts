import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { usePremium } from './usePremium';
import { RootStackParamList } from '../types/navigation';
import { analytics } from '../services/analytics';

type NavigationProp = StackNavigationProp<RootStackParamList>;

export enum PremiumFeature {
  OCR_TIMER = 'ocr_timer',
  SAFETY_MODE = 'safety_mode',
  UNLIMITED_SAVES = 'unlimited_saves',
  PHOTO_DOCUMENTATION = 'photo_documentation',
  OFFLINE_MAPS = 'offline_maps',
  FAMILY_SHARING = 'family_sharing',
  PARKING_HISTORY = 'parking_history',
  EXPORT_DATA = 'export_data',
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
    // List of features that require premium
    const premiumFeatures = [
      PremiumFeature.OCR_TIMER,
      PremiumFeature.SAFETY_MODE,
      PremiumFeature.UNLIMITED_SAVES,
      PremiumFeature.PHOTO_DOCUMENTATION,
      PremiumFeature.OFFLINE_MAPS,
      PremiumFeature.FAMILY_SHARING,
      PremiumFeature.PARKING_HISTORY,
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