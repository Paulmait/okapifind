import React, { Suspense } from 'react';
import { View, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { performance } from '../services/performance';
import { Colors } from '../constants/colors';

// Default fallback component
const DefaultFallback: React.FC = () => (
  <View style={styles.fallbackContainer}>
    <ActivityIndicator size="large" color={Colors.primary} />
  </View>
);

// HOC for lazy loading with error boundary and performance monitoring
export function withLazyLoading<P extends object>(
  LazyComponent: React.LazyExoticComponent<React.ComponentType<P>>,
  fallback: React.ComponentType = DefaultFallback,
  componentName?: string
): React.ComponentType<P> {
  const displayName = componentName || LazyComponent.name || 'LazyComponent';

  const LazyWrapper: React.FC<P> = (props) => {
    React.useEffect(() => {
      performance.startTimer(`${displayName}_lazy_load`);

      return () => {
        performance.endTimer(`${displayName}_lazy_load`);
      };
    }, []);

    return (
      <Suspense fallback={<DefaultFallback />}>
        <LazyComponent {...props} />
      </Suspense>
    );
  };

  LazyWrapper.displayName = `withLazyLoading(${displayName})`;

  return LazyWrapper;
}

// Lazy component definitions - skip native-only components on web
export const LazyMapScreen = Platform.OS === 'web'
  ? React.lazy(() => import('../screens/WebMapScreen'))
  : React.lazy(() => import('../screens/MapScreen'));

export const LazyGuidanceScreen = Platform.OS === 'web'
  ? React.lazy(() => import('../screens/WebMapScreen')) // Use web map for guidance too
  : React.lazy(() => import('../screens/GuidanceScreen'));

export const LazySettingsScreen = React.lazy(() => import('../screens/SettingsScreen'));
export const LazyLegalScreen = React.lazy(() => import('../screens/LegalScreen'));
export const LazyPaywallScreen = React.lazy(() => import('../screens/PaywallScreen'));
export const LazyAuthScreen = React.lazy(() => import('../screens/AuthScreen'));
export const LazyOnboardingScreen = React.lazy(() => import('../screens/OnboardingScreen'));

export const LazyARNavigationScreen = Platform.OS === 'web'
  ? React.lazy(() => import('../screens/WebMapScreen')) // AR not supported on web
  : React.lazy(() => import('../screens/ARNavigationScreen'));

export const LazyLiveTrackingScreen = Platform.OS === 'web'
  ? React.lazy(() => import('../screens/WebMapScreen')) // Use web map for tracking
  : React.lazy(() => import('../screens/LiveTrackingScreen'));

// Wrapped lazy components with performance monitoring
export const MapScreen = withLazyLoading(LazyMapScreen, undefined, 'MapScreen');
export const GuidanceScreen = withLazyLoading(LazyGuidanceScreen, undefined, 'GuidanceScreen');
export const SettingsScreen = withLazyLoading(LazySettingsScreen, undefined, 'SettingsScreen');
export const LegalScreen = withLazyLoading(LazyLegalScreen, undefined, 'LegalScreen');
export const PaywallScreen = withLazyLoading(LazyPaywallScreen, undefined, 'PaywallScreen');
export const AuthScreen = withLazyLoading(LazyAuthScreen, undefined, 'AuthScreen');
export const OnboardingScreen = withLazyLoading(LazyOnboardingScreen, undefined, 'OnboardingScreen');
export const ARNavigationScreen = withLazyLoading(LazyARNavigationScreen, undefined, 'ARNavigationScreen');
export const LiveTrackingScreen = withLazyLoading(LazyLiveTrackingScreen, undefined, 'LiveTrackingScreen');

const styles = StyleSheet.create({
  fallbackContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
});