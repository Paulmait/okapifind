/**
 * Mapbox Configuration
 * CRITICAL: Offline maps for parking garages with no signal
 * Enables map functionality in underground parking locations
 */

export const MAPBOX_CONFIG = {
  // Access token - Configure via EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN env var
  // Get token from: https://account.mapbox.com/access-tokens/
  accessToken: process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || '',

  // Style URLs for different map themes
  styles: {
    streets: 'mapbox://styles/mapbox/streets-v12',
    outdoors: 'mapbox://styles/mapbox/outdoors-v12',
    light: 'mapbox://styles/mapbox/light-v11',
    dark: 'mapbox://styles/mapbox/dark-v11',
    satellite: 'mapbox://styles/mapbox/satellite-v9',
    satelliteStreets: 'mapbox://styles/mapbox/satellite-streets-v12',
    navigation: 'mapbox://styles/mapbox/navigation-day-v1',
    navigationNight: 'mapbox://styles/mapbox/navigation-night-v1',
  },

  // Default style for app
  defaultStyle: 'mapbox://styles/mapbox/streets-v12',

  // Offline map settings
  offline: {
    // Maximum size per offline pack (MB)
    maxPackSize: 150,

    // Maximum total storage for offline maps (MB)
    maxTotalStorage: 500,

    // Minimum zoom level for offline packs
    minZoom: 10,

    // Maximum zoom level for offline packs
    maxZoom: 18,

    // Include glyphs (text/labels) in offline packs
    includeGlyphs: true,

    // Include terrain data
    includeTerrain: false,

    // Default download regions (common cities)
    defaultRegions: [
      {
        name: 'Washington DC',
        bounds: [
          [-77.1198, 38.7916], // Southwest
          [-76.9094, 38.9958], // Northeast
        ],
      },
      {
        name: 'New York City',
        bounds: [
          [-74.2591, 40.4774], // Southwest
          [-73.7004, 40.9176], // Northeast
        ],
      },
      {
        name: 'Los Angeles',
        bounds: [
          [-118.6682, 33.7037], // Southwest
          [-118.1553, 34.3373], // Northeast
        ],
      },
      {
        name: 'San Francisco',
        bounds: [
          [-122.5179, 37.7074], // Southwest
          [-122.3549, 37.8324], // Northeast
        ],
      },
    ],
  },

  // Map settings
  map: {
    // Default camera settings
    defaultCamera: {
      centerCoordinate: [-77.0369, 38.9072], // Washington DC
      zoomLevel: 12,
      pitch: 0,
      heading: 0,
    },

    // Maximum zoom level
    maxZoom: 20,

    // Minimum zoom level
    minZoom: 2,

    // Enable compass
    compassEnabled: true,

    // Enable logo
    logoEnabled: true,

    // Enable attribution
    attributionEnabled: true,

    // Enable zoom controls
    zoomEnabled: true,

    // Enable scroll
    scrollEnabled: true,

    // Enable pitch (3D tilt)
    pitchEnabled: true,

    // Enable rotation
    rotateEnabled: true,
  },

  // Performance settings
  performance: {
    // Use high-quality rendering
    highQuality: true,

    // Enable texture mode for better performance
    textureMode: true,

    // Local tile server port (for offline)
    localTileServerPort: 8080,
  },

  // Clustering configuration
  clustering: {
    enabled: true,
    clusterRadius: 50,
    maxClusterZoom: 16,
    clusterMaxZoom: 16,
  },

  // Navigation settings
  navigation: {
    // Route line color
    routeColor: '#4A90E2',

    // Route line width
    routeWidth: 6,

    // Alternative route color
    alternativeRouteColor: '#B0BEC5',

    // Alternative route width
    alternativeRouteWidth: 4,

    // Show traffic on route
    showTraffic: true,

    // Rerouting threshold (meters)
    reroutingThreshold: 50,
  },
};

// Environment-specific overrides
if (__DEV__) {
  // Development settings
  MAPBOX_CONFIG.offline.maxPackSize = 50; // Smaller packs for testing
  MAPBOX_CONFIG.offline.maxTotalStorage = 200;
}

export default MAPBOX_CONFIG;