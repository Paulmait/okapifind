/**
 * Web MapView Component
 * Note: Mapbox integration temporarily disabled for SDK 54 compatibility
 * This component is only used on web, not iOS/Android
 */

import React from 'react';
import { BrandConfig } from '../../config/brand';

interface MapViewProps {
  onLocationSave?: (location: { lat: number; lng: number; address?: string }) => void;
  savedLocation?: { lat: number; lng: number };
  navigationMode?: boolean;
}

export const MapView: React.FC<MapViewProps> = ({
  onLocationSave,
  savedLocation,
  navigationMode = false,
}) => {
  // Mapbox temporarily disabled for SDK 54 compatibility
  // Use Google Maps via react-native-maps instead

  const styles = {
    container: {
      position: 'relative' as const,
      width: '100%',
      height: '100%',
      borderRadius: BrandConfig.borderRadius.lg,
      overflow: 'hidden',
      backgroundColor: '#f0f0f0',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    message: {
      textAlign: 'center' as const,
      color: BrandConfig.colors.text.secondary,
      padding: BrandConfig.spacing.lg,
    },
  };

  return (
    <div style={styles.container}>
      <div style={styles.message}>
        <p>Web map view temporarily unavailable.</p>
        <p>Please use the mobile app for full map functionality.</p>
      </div>
    </div>
  );
};
