import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
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
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const userMarker = useRef<mapboxgl.Marker | null>(null);
  const savedMarker = useRef<mapboxgl.Marker | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [distance, setDistance] = useState<string>('');

  useEffect(() => {
    if (!mapContainer.current) return;

    mapboxgl.accessToken = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || '';

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [-74.5, 40],
      zoom: 9,
      attributionControl: false,
    });

    map.current.addControl(
      new mapboxgl.AttributionControl({
        customAttribution: 'OkapiFind',
      }),
      'bottom-right'
    );

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    map.current.on('load', () => {
      getCurrentLocation();
    });

    return () => {
      map.current?.remove();
    };
  }, []);

  useEffect(() => {
    if (savedLocation && map.current) {
      if (savedMarker.current) {
        savedMarker.current.remove();
      }

      const el = document.createElement('div');
      el.className = 'saved-marker';
      el.style.width = '40px';
      el.style.height = '40px';
      el.style.backgroundImage = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23${BrandConfig.colors.primary.replace('#', '')}'%3E%3Cpath d='M5 20l7-7 7 7V4H5v16z'/%3E%3C/svg%3E")`;
      el.style.backgroundSize = 'contain';

      savedMarker.current = new mapboxgl.Marker(el)
        .setLngLat([savedLocation.lng, savedLocation.lat])
        .addTo(map.current);

      if (navigationMode) {
        fitBounds();
        calculateDistance();
      }
    }
  }, [savedLocation, navigationMode]);

  const getCurrentLocation = () => {
    if ('geolocation' in navigator) {
      setIsTracking(true);
      navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          const newLocation = { lat: latitude, lng: longitude };
          setUserLocation(newLocation);

          if (map.current) {
            if (!userMarker.current) {
              const el = document.createElement('div');
              el.className = 'user-marker';
              el.style.width = '20px';
              el.style.height = '20px';
              el.style.backgroundColor = BrandConfig.colors.primary;
              el.style.borderRadius = '50%';
              el.style.border = '3px solid white';
              el.style.boxShadow = '0 2px 6px rgba(0,0,0,0.3)';

              userMarker.current = new mapboxgl.Marker(el)
                .setLngLat([longitude, latitude])
                .addTo(map.current);

              map.current.flyTo({
                center: [longitude, latitude],
                zoom: 16,
              });
            } else {
              userMarker.current.setLngLat([longitude, latitude]);
            }

            if (navigationMode && savedLocation) {
              calculateDistance();
            }
          }
        },
        (error) => {
          console.error('Error getting location:', error);
          setIsTracking(false);
        },
        {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 5000,
        }
      );
    }
  };

  const fitBounds = () => {
    if (map.current && userLocation && savedLocation) {
      const bounds = new mapboxgl.LngLatBounds();
      bounds.extend([userLocation.lng, userLocation.lat]);
      bounds.extend([savedLocation.lng, savedLocation.lat]);

      map.current.fitBounds(bounds, {
        padding: { top: 100, bottom: 100, left: 50, right: 50 },
      });
    }
  };

  const calculateDistance = () => {
    if (userLocation && savedLocation) {
      const R = 6371e3;
      const φ1 = (userLocation.lat * Math.PI) / 180;
      const φ2 = (savedLocation.lat * Math.PI) / 180;
      const Δφ = ((savedLocation.lat - userLocation.lat) * Math.PI) / 180;
      const Δλ = ((savedLocation.lng - userLocation.lng) * Math.PI) / 180;

      const a =
        Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const d = R * c;

      if (d < 1000) {
        setDistance(`${Math.round(d)} m`);
      } else {
        setDistance(`${(d / 1000).toFixed(1)} km`);
      }
    }
  };

  const handleSaveLocation = () => {
    if (userLocation && onLocationSave) {
      fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${userLocation.lng},${userLocation.lat}.json?access_token=${process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN}`
      )
        .then((res) => res.json())
        .then((data) => {
          const address = data.features?.[0]?.place_name || 'Unknown location';
          onLocationSave({
            ...userLocation,
            address,
          });
        })
        .catch(() => {
          onLocationSave(userLocation);
        });
    }
  };

  const styles = {
    container: {
      position: 'relative' as const,
      width: '100%',
      height: '100%',
      borderRadius: BrandConfig.borderRadius.lg,
      overflow: 'hidden',
    },
    map: {
      width: '100%',
      height: '100%',
    },
    controls: {
      position: 'absolute' as const,
      bottom: BrandConfig.spacing.lg,
      left: '50%',
      transform: 'translateX(-50%)',
      display: 'flex',
      flexDirection: 'column' as const,
      gap: BrandConfig.spacing.md,
      alignItems: 'center',
      zIndex: 10,
    },
    saveButton: {
      backgroundColor: BrandConfig.colors.primary,
      color: BrandConfig.colors.white,
      border: 'none',
      borderRadius: BrandConfig.borderRadius.full,
      padding: `${BrandConfig.spacing.md}px ${BrandConfig.spacing.xl}px`,
      fontSize: BrandConfig.fonts.sizes.lg.web,
      fontWeight: BrandConfig.fonts.weights.semibold,
      cursor: 'pointer',
      boxShadow: BrandConfig.shadows.lg.web,
      transition: 'transform 0.2s, box-shadow 0.2s',
    },
    distanceBadge: {
      backgroundColor: BrandConfig.colors.white,
      color: BrandConfig.colors.text.primary,
      padding: `${BrandConfig.spacing.sm}px ${BrandConfig.spacing.md}px`,
      borderRadius: BrandConfig.borderRadius.full,
      fontSize: BrandConfig.fonts.sizes.sm.web,
      fontWeight: BrandConfig.fonts.weights.medium,
      boxShadow: BrandConfig.shadows.md.web,
    },
    trackingIndicator: {
      position: 'absolute' as const,
      top: BrandConfig.spacing.md,
      left: BrandConfig.spacing.md,
      backgroundColor: isTracking ? BrandConfig.colors.success : BrandConfig.colors.error,
      color: BrandConfig.colors.white,
      padding: `${BrandConfig.spacing.xs}px ${BrandConfig.spacing.sm}px`,
      borderRadius: BrandConfig.borderRadius.full,
      fontSize: BrandConfig.fonts.sizes.xs.web,
      fontWeight: BrandConfig.fonts.weights.medium,
    },
  };

  return (
    <div style={styles.container}>
      <div ref={mapContainer} style={styles.map} />

      {isTracking && (
        <div style={styles.trackingIndicator}>
          GPS Active
        </div>
      )}

      <div style={styles.controls}>
        {navigationMode && distance && (
          <div style={styles.distanceBadge}>
            Distance: {distance}
          </div>
        )}

        {!navigationMode && userLocation && (
          <button
            style={styles.saveButton}
            onClick={handleSaveLocation}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            Save Parking Location
          </button>
        )}
      </div>
    </div>
  );
};