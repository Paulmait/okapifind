/**
 * AR Navigation View Component
 * Displays 3D arrow pointing to car with floor indicators
 * Premium feature
 */

import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { arNavigation, ARNavigationState } from '../services/arNavigation';
import { LinearGradient } from 'expo-linear-gradient';

interface ARNavigationViewProps {
  userLocation: {
    latitude: number;
    longitude: number;
    altitude?: number;
    heading?: number;
  };
  carLocation: {
    latitude: number;
    longitude: number;
    floor?: string;
    altitude?: number;
  };
  onArrived?: () => void;
}
const ARROW_SIZE = 120;

export const ARNavigationView: React.FC<ARNavigationViewProps> = ({
  userLocation,
  carLocation,
  onArrived,
}) => {
  const [navState, setNavState] = useState<ARNavigationState | null>(null);
  const [hasArrived, setHasArrived] = useState(false);

  // Animations
  const arrowRotation = useRef(new Animated.Value(0)).current;
  const arrowPulse = useRef(new Animated.Value(1)).current;
  const arrowOpacity = useRef(new Animated.Value(1)).current;
  const celebrationScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Calculate navigation state
    const state = arNavigation.calculateNavigationState(userLocation, carLocation);
    setNavState(state);

    // Check if arrived
    if (state.distance < 3 && !hasArrived) {
      setHasArrived(true);
      triggerArrivalAnimation();
      onArrived?.();
    }

    // Animate arrow rotation
    if (userLocation.heading !== undefined) {
      const rotation = arNavigation.getArrowRotation(state, userLocation.heading);
      Animated.spring(arrowRotation, {
        toValue: rotation.yaw,
        useNativeDriver: true,
        tension: 50,
        friction: 7,
      }).start();
    }

    // Pulse animation based on distance
    const pulseDuration = state.distance < 10 ? 500 : 1000;
    Animated.loop(
      Animated.sequence([
        Animated.timing(arrowPulse, {
          toValue: 1.2,
          duration: pulseDuration / 2,
          useNativeDriver: true,
        }),
        Animated.timing(arrowPulse, {
          toValue: 1.0,
          duration: pulseDuration / 2,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [userLocation, carLocation]);

  const triggerArrivalAnimation = () => {
    // Celebration animation
    Animated.sequence([
      Animated.timing(celebrationScale, {
        toValue: 1.5,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(celebrationScale, {
        toValue: 1,
        tension: 50,
        friction: 3,
        useNativeDriver: true,
      }),
    ]).start();

    // Fade out arrow
    Animated.timing(arrowOpacity, {
      toValue: 0,
      duration: 500,
      useNativeDriver: true,
    }).start();
  };

  if (!navState) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Initializing AR...</Text>
      </View>
    );
  }

  const arrowColor = arNavigation.getArrowColor(navState.distance);
  const arrowScale = arNavigation.getArrowScale(navState.distance);

  return (
    <View style={styles.container}>
      {/* AR Camera View (placeholder - would be replaced with actual camera) */}
      <View style={styles.cameraView}>
        <LinearGradient
          colors={['#1a1a2e', '#16213e', '#0f3460']}
          style={StyleSheet.absoluteFill}
        />

        {/* 3D Arrow pointing to car */}
        {!hasArrived && (
          <Animated.View
            style={[
              styles.arrowContainer,
              {
                transform: [
                  { rotate: `${arrowRotation}deg` },
                  { scale: Animated.multiply(arrowPulse, arrowScale) },
                ],
                opacity: arrowOpacity,
              },
            ]}
          >
            <Ionicons
              name="arrow-up"
              size={ARROW_SIZE}
              color={arrowColor}
              style={styles.arrow}
            />
          </Animated.View>
        )}

        {/* Arrival celebration */}
        {hasArrived && (
          <Animated.View
            style={[
              styles.celebrationContainer,
              { transform: [{ scale: celebrationScale }] },
            ]}
          >
            <Ionicons name="checkmark-circle" size={150} color="#4CAF50" />
            <Text style={styles.celebrationText}>You've arrived!</Text>
          </Animated.View>
        )}

        {/* Floor indicator */}
        {navState.floor_difference > 0 && !hasArrived && (
          <View style={styles.floorIndicator}>
            <Ionicons
              name={navState.direction === 'up' ? 'arrow-up-circle' : 'arrow-down-circle'}
              size={32}
              color="#FFFFFF"
            />
            <Text style={styles.floorText}>
              {navState.floor_difference} floor{navState.floor_difference > 1 ? 's' : ''}{' '}
              {navState.direction}
            </Text>
          </View>
        )}

        {/* Distance display */}
        <View style={styles.distanceContainer}>
          <Text style={styles.distanceText}>
            {navState.distance < 1
              ? `${Math.round(navState.distance * 100)}cm`
              : `${Math.round(navState.distance)}m`}
          </Text>
          <Text style={styles.distanceLabel}>to your car</Text>
        </View>

        {/* Accuracy indicator */}
        <View style={[styles.accuracyBadge, styles[`accuracy_${navState.accuracy}`]]}>
          <View style={[styles.accuracyDot, styles[`dot_${navState.accuracy}`]]} />
          <Text style={styles.accuracyText}>{navState.accuracy.toUpperCase()}</Text>
        </View>
      </View>

      {/* Instructions panel */}
      <View style={styles.instructionsPanel}>
        {navState.instructions.map((instruction, index) => (
          <View key={index} style={styles.instructionRow}>
            <Ionicons
              name={index === 0 ? 'navigate-circle' : 'chevron-forward'}
              size={20}
              color="#4A90E2"
            />
            <Text style={styles.instructionText}>{instruction}</Text>
          </View>
        ))}
      </View>

      {/* Compass indicator */}
      {userLocation.heading !== undefined && (
        <View style={styles.compassContainer}>
          <Ionicons name="compass-outline" size={24} color="#FFFFFF" />
          <Text style={styles.compassText}>{Math.round(userLocation.heading)}°</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  cameraView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  arrowContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  arrow: {
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },
  celebrationContainer: {
    alignItems: 'center',
    gap: 16,
  },
  celebrationText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },
  floorIndicator: {
    position: 'absolute',
    top: 100,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    gap: 8,
  },
  floorText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  distanceContainer: {
    position: 'absolute',
    bottom: 200,
    alignItems: 'center',
  },
  distanceText: {
    color: '#FFFFFF',
    fontSize: 48,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },
  distanceLabel: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 16,
    marginTop: 4,
  },
  accuracyBadge: {
    position: 'absolute',
    top: 60,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  accuracy_high: {
    backgroundColor: 'rgba(76, 175, 80, 0.3)',
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  accuracy_medium: {
    backgroundColor: 'rgba(255, 193, 7, 0.3)',
    borderWidth: 1,
    borderColor: '#FFC107',
  },
  accuracy_low: {
    backgroundColor: 'rgba(244, 67, 54, 0.3)',
    borderWidth: 1,
    borderColor: '#F44336',
  },
  accuracyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dot_high: {
    backgroundColor: '#4CAF50',
  },
  dot_medium: {
    backgroundColor: '#FFC107',
  },
  dot_low: {
    backgroundColor: '#F44336',
  },
  accuracyText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  instructionsPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    paddingHorizontal: 20,
    paddingVertical: 24,
    paddingBottom: 40,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    gap: 12,
  },
  instructionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  instructionText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
  },
  compassContainer: {
    position: 'absolute',
    top: 60,
    left: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  compassText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default ARNavigationView;
