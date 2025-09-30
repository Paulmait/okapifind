/**
 * Offline Indicator Component
 * Shows a banner when the device is offline
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated, Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { Colors } from '../constants/colors';

export function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(false);
  const [slideAnim] = useState(new Animated.Value(-100));

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const offline = !state.isConnected || !state.isInternetReachable;

      if (offline !== isOffline) {
        setIsOffline(offline);

        // Animate banner in/out
        Animated.spring(slideAnim, {
          toValue: offline ? 0 : -100,
          useNativeDriver: true,
          tension: 50,
          friction: 7,
        }).start();
      }
    });

    return () => unsubscribe();
  }, [isOffline, slideAnim]);

  return (
    <Animated.View
      style={[
        styles.banner,
        {
          transform: [{ translateY: slideAnim }],
        },
      ]}
      pointerEvents={isOffline ? 'auto' : 'none'}
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