/**
 * Offline Indicator Component
 * Shows a banner when the device is offline
 */

import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

export function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const hasInitialized = useRef(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      // Only consider truly offline if isConnected is explicitly false
      // isInternetReachable can be null initially, so don't treat that as offline
      // Also require that we've received at least one network state update
      const offline = state.isConnected === false;

      // Skip the first state if it reports offline (likely stale)
      if (!hasInitialized.current) {
        hasInitialized.current = true;
        // Only show offline banner on first check if definitely offline
        if (!offline) {
          return;
        }
      }

      if (offline !== isOffline) {
        setIsOffline(offline);

        if (offline) {
          // Show banner
          setShouldRender(true);
          Animated.spring(slideAnim, {
            toValue: 0,
            useNativeDriver: true,
            tension: 50,
            friction: 7,
          }).start();
        } else {
          // Hide banner with animation, then stop rendering
          Animated.spring(slideAnim, {
            toValue: -100,
            useNativeDriver: true,
            tension: 50,
            friction: 7,
          }).start(() => {
            setShouldRender(false);
          });
        }
      }
    });

    return () => unsubscribe();
  }, [isOffline, slideAnim]);

  // Don't render anything if online - prevents any visual overlap
  if (!shouldRender) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.banner,
        {
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <View style={styles.content}>
        <Text style={styles.icon}>📶</Text>
        <View style={styles.textContainer}>
          <Text style={styles.title}>You're offline</Text>
          <Text style={styles.subtitle}>
            Some features may be limited. Changes will sync when you're back online.
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 44 : 0,
    left: 0,
    right: 0,
    backgroundColor: '#FF9500',
    paddingVertical: 12,
    paddingHorizontal: 16,
    zIndex: 9999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    fontSize: 20,
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 12,
    color: '#FFFFFF',
    opacity: 0.9,
  },
});