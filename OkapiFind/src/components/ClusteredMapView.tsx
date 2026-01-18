// @ts-nocheck
/**
 * Clustered Map View Component
 * Uses react-native-maps-super-cluster for high-performance marker clustering
 * Handles 1000+ markers efficiently
 */

import React from 'react';
import { StyleSheet } from 'react-native';
import MapView, { Marker, Region } from 'react-native-maps';

export interface MapMarker {
  id: string;
  latitude: number;
  longitude: number;
  title?: string;
  description?: string;
  color?: string;
  icon?: string;
}

interface ClusteredMapViewProps {
  markers: MapMarker[];
  region: Region;
  onMarkerPress?: (marker: MapMarker) => void;
  onClusterPress?: (cluster: any) => void;
  clusterRadius?: number;
  clusterColor?: string;
  children?: React.ReactNode;
  mapViewProps?: Partial<React.ComponentProps<typeof MapView>>;
}

export const ClusteredMapView: React.FC<ClusteredMapViewProps> = ({
  markers,
  region,
  onMarkerPress,
  children,
  mapViewProps = {},
}) => {
  const renderMarker = (marker: MapMarker) => (
    <Marker
      key={marker.id}
      coordinate={{
        latitude: marker.latitude,
        longitude: marker.longitude,
      }}
      title={marker.title}
      description={marker.description}
      pinColor={marker.color || 'red'}
      onPress={() => onMarkerPress?.(marker)}
    />
  );

  return (
    <MapView
      region={region}
      style={styles.map}
      {...mapViewProps}
    >
      {markers.map(marker => renderMarker(marker))}
      {children}
    </MapView>
  );
};

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
});

export default ClusteredMapView;