/**
 * Clustered Map View Component
 * Uses react-native-maps-super-cluster for high-performance marker clustering
 * Handles 1000+ markers efficiently
 */

import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Region } from 'react-native-maps';
import ClusterMap from 'react-native-map-clustering';

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
  onClusterPress,
  clusterRadius = 50,
  clusterColor = '#007AFF',
  children,
  mapViewProps = {},
}) => {
  // Convert markers to cluster-compatible format
  const clusterMarkers = useMemo(() => {
    return markers.map(marker => ({
      ...marker,
      location: {
        latitude: marker.latitude,
        longitude: marker.longitude,
      },
    }));
  }, [markers]);

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

  const renderCluster = (cluster: any, onPress: () => void) => {
    const { pointCount, coordinate } = cluster;

    return (
      <Marker
        key={`cluster-${coordinate.latitude}-${coordinate.longitude}`}
        coordinate={coordinate}
        onPress={onPress}
      >
        <View style={[styles.clusterContainer, { backgroundColor: clusterColor }]}>
          <Text style={styles.clusterText}>{pointCount}</Text>
        </View>
      </Marker>
    );
  };

  return (
    <ClusterMap
      region={region}
      radius={clusterRadius}
      extent={512}
      minZoom={1}
      maxZoom={20}
      minPoints={2}
      style={styles.map}
      renderMarker={renderMarker}
      renderCluster={renderCluster}
      onClusterPress={onClusterPress}
      {...mapViewProps}
    >
      {children}
    </ClusterMap>
  );
};

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
  clusterContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  clusterText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
});

export default ClusteredMapView;