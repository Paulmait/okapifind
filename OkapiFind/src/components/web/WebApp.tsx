/**
 * Main Web App Component
 * Responsive design for all screen sizes
 * Cross-browser compatible
 */

import React, { useState, useEffect, lazy, Suspense } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  Dimensions,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { BrandConfig } from '../../config/brand';
import { useAuth } from '../../hooks/useAuth';
import { useLocation } from '../../hooks/useLocation';
import { useParkingLocation } from '../../hooks/useParkingLocation';

// Lazy load heavy components for performance
const Map = lazy(() => import('../Map/ParkingMap'));
const NavigationPanel = lazy(() => import('../Navigation/NavigationPanel'));

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Responsive breakpoints
const getDeviceType = (width: number) => {
  if (width < 640) return 'mobile';
  if (width < 1024) return 'tablet';
  return 'desktop';
};

export const WebApp: React.FC = () => {
  const [deviceType, setDeviceType] = useState(getDeviceType(screenWidth));
  const [isSidebarOpen, setIsSidebarOpen] = useState(deviceType === 'desktop');
  const [activeView, setActiveView] = useState<'map' | 'history' | 'profile'>('map');

  const { user, isAuthenticated } = useAuth();
  const { currentLocation } = useLocation();
  const { parkingLocation, saveParkingLocation, isParked } = useParkingLocation();

  // Handle responsive layout
  useEffect(() => {
    if (Platform.OS === 'web') {
      const handleResize = () => {
        const newWidth = window.innerWidth;
        const newDeviceType = getDeviceType(newWidth);
        setDeviceType(newDeviceType);
        setIsSidebarOpen(newDeviceType === 'desktop');
      };

      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, []);

  // Main parking save action
  const handleSaveParking = async () => {
    try {
      await saveParkingLocation({
        latitude: currentLocation?.latitude,
        longitude: currentLocation?.longitude,
        timestamp: Date.now(),
        source: 'web_manual',
      });
    } catch (error) {
      console.error('Failed to save parking:', error);
    }
  };

  return (
    <View style={styles.container}>
      {/* Top Navigation Bar */}
      <View style={[styles.navbar, { backgroundColor: BrandConfig.colors.primary }]}>
        <View style={styles.navbarContent}>
          {/* Menu Toggle (Mobile/Tablet) */}
          {deviceType !== 'desktop' && (
            <TouchableOpacity
              onPress={() => setIsSidebarOpen(!isSidebarOpen)}
              style={styles.menuButton}
              accessible={true}
              accessibilityLabel="Toggle menu"
              accessibilityRole="button"
            >
              <Text style={styles.menuIcon}>☰</Text>
            </TouchableOpacity>
          )}

          {/* Logo and Brand */}
          <View style={styles.brand}>
            <Text style={styles.brandName}>{BrandConfig.name}</Text>
            <Text style={styles.brandTagline}>{BrandConfig.tagline}</Text>
          </View>

          {/* User Profile */}
          {isAuthenticated ? (
            <TouchableOpacity
              style={styles.profileButton}
              onPress={() => setActiveView('profile')}
              accessible={true}
              accessibilityLabel="User profile"
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {user?.name?.charAt(0).toUpperCase() || 'U'}
                </Text>
              </View>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.loginButton}
              onPress={() => {/* Navigate to login */}}
              accessible={true}
              accessibilityLabel="Sign in"
            >
              <Text style={styles.loginText}>Sign In</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Main Content Area */}
      <View style={styles.mainContent}>
        {/* Sidebar (Desktop) or Drawer (Mobile/Tablet) */}
        {isSidebarOpen && (
          <View
            style={[
              styles.sidebar,
              deviceType === 'mobile' && styles.sidebarMobile,
              deviceType === 'tablet' && styles.sidebarTablet,
            ]}
          >
            <ScrollView style={styles.sidebarScroll}>
              {/* Quick Actions */}
              <View style={styles.sidebarSection}>
                <Text style={styles.sectionTitle}>Quick Actions</Text>

                {/* Save Parking Button - Primary CTA */}
                <TouchableOpacity
                  style={[
                    styles.primaryButton,
                    isParked && styles.primaryButtonDisabled,
                  ]}
                  onPress={handleSaveParking}
                  disabled={isParked}
                  accessible={true}
                  accessibilityLabel={isParked ? "Already parked" : "Save parking location"}
                  accessibilityRole="button"
                >
                  <Text style={styles.primaryButtonText}>
                    {isParked ? '✓ Parked' : 'Save Parking'}
                  </Text>
                </TouchableOpacity>

                {/* Find My Car */}
                {isParked && (
                  <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={() => {/* Navigate */}}
                    accessible={true}
                    accessibilityLabel="Navigate to car"
                  >
                    <Text style={styles.secondaryButtonText}>Find My Car</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Navigation Menu */}
              <View style={styles.sidebarSection}>
                <Text style={styles.sectionTitle}>Menu</Text>

                <TouchableOpacity
                  style={[
                    styles.menuItem,
                    activeView === 'map' && styles.menuItemActive,
                  ]}
                  onPress={() => setActiveView('map')}
                >
                  <Text style={styles.menuItemText}>🗺️ Map</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.menuItem,
                    activeView === 'history' && styles.menuItemActive,
                  ]}
                  onPress={() => setActiveView('history')}
                >
                  <Text style={styles.menuItemText}>📍 History</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.menuItem,
                    activeView === 'profile' && styles.menuItemActive,
                  ]}
                  onPress={() => setActiveView('profile')}
                >
                  <Text style={styles.menuItemText}>👤 Profile</Text>
                </TouchableOpacity>
              </View>

              {/* Stats */}
              <View style={styles.sidebarSection}>
                <Text style={styles.sectionTitle}>Your Stats</Text>
                <View style={styles.stats}>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>42</Text>
                    <Text style={styles.statLabel}>Parkings</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>5m</Text>
                    <Text style={styles.statLabel}>Avg Time</Text>
                  </View>
                </View>
              </View>
            </ScrollView>
          </View>
        )}

        {/* Main View Area */}
        <View style={styles.mainView}>
          <Suspense fallback={<LoadingView />}>
            {activeView === 'map' && (
              <View style={styles.mapContainer}>
                <Map
                  currentLocation={currentLocation}
                  parkingLocation={parkingLocation}
                  style={styles.map}
                />

                {/* Floating Action Button (Mobile) */}
                {deviceType === 'mobile' && !isParked && (
                  <TouchableOpacity
                    style={styles.fab}
                    onPress={handleSaveParking}
                    accessible={true}
                    accessibilityLabel="Save parking location"
                  >
                    <Text style={styles.fabIcon}>P</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {activeView === 'history' && <HistoryView />}
            {activeView === 'profile' && <ProfileView user={user} />}
          </Suspense>
        </View>
      </View>

      {/* Bottom Navigation (Mobile Only) */}
      {deviceType === 'mobile' && (
        <View style={styles.bottomNav}>
          <TouchableOpacity
            style={styles.bottomNavItem}
            onPress={() => setActiveView('map')}
          >
            <Text style={styles.bottomNavIcon}>🗺️</Text>
            <Text style={styles.bottomNavLabel}>Map</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.bottomNavItem, styles.bottomNavCenter]}
            onPress={handleSaveParking}
            disabled={isParked}
          >
            <View style={styles.bottomNavCenterButton}>
              <Text style={styles.bottomNavCenterIcon}>P</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.bottomNavItem}
            onPress={() => setActiveView('profile')}
          >
            <Text style={styles.bottomNavIcon}>👤</Text>
            <Text style={styles.bottomNavLabel}>Profile</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

// Loading Component
const LoadingView = () => (
  <View style={styles.loadingContainer}>
    <ActivityIndicator size="large" color={BrandConfig.colors.primary} />
    <Text style={styles.loadingText}>Loading...</Text>
  </View>
);

// History View Component
const HistoryView = () => (
  <ScrollView style={styles.historyContainer}>
    <Text style={styles.pageTitle}>Parking History</Text>
    {/* History items would go here */}
  </ScrollView>
);

// Profile View Component
const ProfileView = ({ user }: any) => (
  <ScrollView style={styles.profileContainer}>
    <Text style={styles.pageTitle}>Profile</Text>
    <View style={styles.profileCard}>
      <Text style={styles.profileName}>{user?.name || 'Guest User'}</Text>
      <Text style={styles.profileEmail}>{user?.email || 'Not signed in'}</Text>
    </View>
  </ScrollView>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BrandConfig.colors.background.primary,
  },
  navbar: {
    height: 64,
    ...Platform.select({
      web: {
        boxShadow: BrandConfig.shadows.md.web,
      },
      default: BrandConfig.shadows.md.ios,
    }),
  },
  navbarContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: BrandConfig.spacing.md,
  },
  menuButton: {
    padding: BrandConfig.spacing.sm,
  },
  menuIcon: {
    fontSize: 24,
    color: BrandConfig.colors.white,
  },
  brand: {
    flex: 1,
    marginLeft: BrandConfig.spacing.md,
  },
  brandName: {
    fontSize: BrandConfig.fonts.sizes['2xl'].mobile,
    fontWeight: '700',
    color: BrandConfig.colors.white,
  },
  brandTagline: {
    fontSize: BrandConfig.fonts.sizes.xs.mobile,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  profileButton: {
    padding: BrandConfig.spacing.sm,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: BrandConfig.colors.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: BrandConfig.colors.primary,
    fontWeight: '600',
  },
  loginButton: {
    paddingHorizontal: BrandConfig.spacing.md,
    paddingVertical: BrandConfig.spacing.sm,
    backgroundColor: BrandConfig.colors.white,
    borderRadius: BrandConfig.borderRadius.md,
  },
  loginText: {
    color: BrandConfig.colors.primary,
    fontWeight: '600',
  },
  mainContent: {
    flex: 1,
    flexDirection: 'row',
  },
  sidebar: {
    width: 280,
    backgroundColor: BrandConfig.colors.background.secondary,
    borderRightWidth: 1,
    borderRightColor: BrandConfig.colors.gray[200],
  },
  sidebarMobile: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    zIndex: 100,
    width: '80%',
    maxWidth: 320,
    ...Platform.select({
      web: {
        boxShadow: BrandConfig.shadows.xl.web,
      },
      default: BrandConfig.shadows.xl.ios,
    }),
  },
  sidebarTablet: {
    width: 320,
  },
  sidebarScroll: {
    flex: 1,
  },
  sidebarSection: {
    padding: BrandConfig.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: BrandConfig.colors.gray[200],
  },
  sectionTitle: {
    fontSize: BrandConfig.fonts.sizes.sm.mobile,
    fontWeight: '600',
    color: BrandConfig.colors.text.secondary,
    marginBottom: BrandConfig.spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  primaryButton: {
    backgroundColor: BrandConfig.colors.primary,
    paddingVertical: BrandConfig.spacing.md,
    borderRadius: BrandConfig.borderRadius.lg,
    alignItems: 'center',
    marginBottom: BrandConfig.spacing.sm,
  },
  primaryButtonDisabled: {
    backgroundColor: BrandConfig.colors.success,
  },
  primaryButtonText: {
    color: BrandConfig.colors.white,
    fontSize: BrandConfig.fonts.sizes.lg.mobile,
    fontWeight: '600',
  },
  secondaryButton: {
    borderWidth: 2,
    borderColor: BrandConfig.colors.primary,
    paddingVertical: BrandConfig.spacing.md,
    borderRadius: BrandConfig.borderRadius.lg,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: BrandConfig.colors.primary,
    fontSize: BrandConfig.fonts.sizes.lg.mobile,
    fontWeight: '600',
  },
  menuItem: {
    paddingVertical: BrandConfig.spacing.sm,
    paddingHorizontal: BrandConfig.spacing.md,
    borderRadius: BrandConfig.borderRadius.md,
    marginBottom: BrandConfig.spacing.xs,
  },
  menuItemActive: {
    backgroundColor: BrandConfig.colors.primaryAlpha,
  },
  menuItemText: {
    fontSize: BrandConfig.fonts.sizes.base.mobile,
    color: BrandConfig.colors.text.primary,
  },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: BrandConfig.fonts.sizes['2xl'].mobile,
    fontWeight: '700',
    color: BrandConfig.colors.primary,
  },
  statLabel: {
    fontSize: BrandConfig.fonts.sizes.sm.mobile,
    color: BrandConfig.colors.text.secondary,
  },
  mainView: {
    flex: 1,
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  fab: {
    position: 'absolute',
    bottom: 80,
    right: 20,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: BrandConfig.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      web: {
        boxShadow: BrandConfig.shadows.xl.web,
      },
      default: BrandConfig.shadows.xl.ios,
    }),
  },
  fabIcon: {
    fontSize: 28,
    color: BrandConfig.colors.white,
    fontWeight: '700',
  },
  bottomNav: {
    height: 64,
    flexDirection: 'row',
    backgroundColor: BrandConfig.colors.white,
    borderTopWidth: 1,
    borderTopColor: BrandConfig.colors.gray[200],
  },
  bottomNavItem: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomNavCenter: {
    position: 'relative',
  },
  bottomNavCenterButton: {
    position: 'absolute',
    top: -20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: BrandConfig.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      web: {
        boxShadow: BrandConfig.shadows.lg.web,
      },
      default: BrandConfig.shadows.lg.ios,
    }),
  },
  bottomNavCenterIcon: {
    fontSize: 24,
    color: BrandConfig.colors.white,
    fontWeight: '700',
  },
  bottomNavIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  bottomNavLabel: {
    fontSize: BrandConfig.fonts.sizes.xs.mobile,
    color: BrandConfig.colors.text.secondary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: BrandConfig.spacing.sm,
    color: BrandConfig.colors.text.secondary,
  },
  historyContainer: {
    flex: 1,
    padding: BrandConfig.spacing.md,
  },
  profileContainer: {
    flex: 1,
    padding: BrandConfig.spacing.md,
  },
  pageTitle: {
    fontSize: BrandConfig.fonts.sizes['3xl'].mobile,
    fontWeight: '700',
    marginBottom: BrandConfig.spacing.lg,
    color: BrandConfig.colors.text.primary,
  },
  profileCard: {
    backgroundColor: BrandConfig.colors.white,
    padding: BrandConfig.spacing.lg,
    borderRadius: BrandConfig.borderRadius.lg,
    ...Platform.select({
      web: {
        boxShadow: BrandConfig.shadows.md.web,
      },
      default: BrandConfig.shadows.md.ios,
    }),
  },
  profileName: {
    fontSize: BrandConfig.fonts.sizes.xl.mobile,
    fontWeight: '600',
    marginBottom: BrandConfig.spacing.xs,
  },
  profileEmail: {
    fontSize: BrandConfig.fonts.sizes.base.mobile,
    color: BrandConfig.colors.text.secondary,
  },
});

export default WebApp;