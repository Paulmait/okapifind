/**
 * Units of measurement for distance
 */
export enum DistanceUnit {
  METERS = 'meters',
  KILOMETERS = 'kilometers',
  FEET = 'feet',
  MILES = 'miles',
  NAUTICAL_MILES = 'nautical_miles',
}

/**
 * Earth radius constants in different units
 */
const EARTH_RADIUS = {
  METERS: 6371000,
  KILOMETERS: 6371,
  MILES: 3958.8,
  NAUTICAL_MILES: 3440.065,
  FEET: 20902231,
};

/**
 * Calculate the distance between two geographic coordinates using Haversine formula
 * @param lat1 - Latitude of the first point (in degrees)
 * @param lon1 - Longitude of the first point (in degrees)
 * @param lat2 - Latitude of the second point (in degrees)
 * @param lon2 - Longitude of the second point (in degrees)
 * @param unit - Unit of measurement for the result (default: meters)
 * @returns Distance between the two points in the specified unit
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
  unit: DistanceUnit = DistanceUnit.METERS
): number {
  // Convert degrees to radians
  const lat1Rad = toRadians(lat1);
  const lat2Rad = toRadians(lat2);
  const deltaLat = toRadians(lat2 - lat1);
  const deltaLon = toRadians(lon2 - lon1);

  // Haversine formula
  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1Rad) *
      Math.cos(lat2Rad) *
      Math.sin(deltaLon / 2) *
      Math.sin(deltaLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  // Get appropriate Earth radius based on unit
  let radius: number;
  switch (unit) {
    case DistanceUnit.KILOMETERS:
      radius = EARTH_RADIUS.KILOMETERS;
      break;
    case DistanceUnit.MILES:
      radius = EARTH_RADIUS.MILES;
      break;
    case DistanceUnit.NAUTICAL_MILES:
      radius = EARTH_RADIUS.NAUTICAL_MILES;
      break;
    case DistanceUnit.FEET:
      radius = EARTH_RADIUS.FEET;
      break;
    case DistanceUnit.METERS:
    default:
      radius = EARTH_RADIUS.METERS;
      break;
  }

  // Calculate distance
  const distance = radius * c;

  return distance;
}

/**
 * Convert distance from one unit to another
 * @param distance - Distance value to convert
 * @param fromUnit - Current unit of the distance
 * @param toUnit - Target unit for conversion
 * @returns Converted distance value
 */
export function convertDistance(
  distance: number,
  fromUnit: DistanceUnit,
  toUnit: DistanceUnit
): number {
  if (fromUnit === toUnit) {
    return distance;
  }

  // First convert to meters (base unit)
  let meters: number;
  switch (fromUnit) {
    case DistanceUnit.KILOMETERS:
      meters = distance * 1000;
      break;
    case DistanceUnit.MILES:
      meters = distance * 1609.344;
      break;
    case DistanceUnit.FEET:
      meters = distance * 0.3048;
      break;
    case DistanceUnit.NAUTICAL_MILES:
      meters = distance * 1852;
      break;
    case DistanceUnit.METERS:
    default:
      meters = distance;
      break;
  }

  // Then convert from meters to target unit
  switch (toUnit) {
    case DistanceUnit.KILOMETERS:
      return meters / 1000;
    case DistanceUnit.MILES:
      return meters / 1609.344;
    case DistanceUnit.FEET:
      return meters / 0.3048;
    case DistanceUnit.NAUTICAL_MILES:
      return meters / 1852;
    case DistanceUnit.METERS:
    default:
      return meters;
  }
}

/**
 * Format distance for display with appropriate unit
 * @param meters - Distance in meters
 * @param useImperial - Whether to use imperial units (default: false for metric)
 * @param precision - Number of decimal places (default: 0 for short distances, 2 for long)
 * @returns Formatted distance string with unit
 */
export function formatDistance(
  meters: number,
  useImperial: boolean = false,
  precision?: number
): string {
  if (useImperial) {
    const feet = meters * 3.28084;
    if (feet < 1000) {
      const p = precision ?? 0;
      return `${feet.toFixed(p)} ft`;
    } else {
      const miles = feet / 5280;
      const p = precision ?? 2;
      return `${miles.toFixed(p)} mi`;
    }
  } else {
    if (meters < 1000) {
      const p = precision ?? 0;
      return `${meters.toFixed(p)} m`;
    } else {
      const kilometers = meters / 1000;
      const p = precision ?? 2;
      return `${kilometers.toFixed(p)} km`;
    }
  }
}

/**
 * Get human-readable distance description
 * @param meters - Distance in meters
 * @returns Human-readable description
 */
export function getDistanceDescription(meters: number): string {
  if (meters < 5) {
    return 'You have arrived';
  } else if (meters < 20) {
    return 'Very close';
  } else if (meters < 50) {
    return 'Nearby';
  } else if (meters < 200) {
    return 'A short walk away';
  } else if (meters < 1000) {
    return 'Within walking distance';
  } else if (meters < 5000) {
    return 'A few minutes away';
  } else if (meters < 10000) {
    return 'Several minutes away';
  } else {
    const km = meters / 1000;
    return `About ${Math.round(km)} km away`;
  }
}

/**
 * Calculate walking time estimate based on distance
 * @param meters - Distance in meters
 * @param walkingSpeedKmh - Walking speed in km/h (default: 5 km/h)
 * @returns Estimated walking time in minutes
 */
export function estimateWalkingTime(
  meters: number,
  walkingSpeedKmh: number = 5
): number {
  const kilometers = meters / 1000;
  const hours = kilometers / walkingSpeedKmh;
  return Math.ceil(hours * 60);
}

/**
 * Calculate driving time estimate based on distance
 * @param meters - Distance in meters
 * @param drivingSpeedKmh - Driving speed in km/h (default: 50 km/h for city)
 * @returns Estimated driving time in minutes
 */
export function estimateDrivingTime(
  meters: number,
  drivingSpeedKmh: number = 50
): number {
  const kilometers = meters / 1000;
  const hours = kilometers / drivingSpeedKmh;
  return Math.ceil(hours * 60);
}

/**
 * Format time duration for display
 * @param minutes - Time in minutes
 * @returns Formatted time string
 */
export function formatDuration(minutes: number): string {
  if (minutes < 1) {
    return 'Less than a minute';
  } else if (minutes === 1) {
    return '1 minute';
  } else if (minutes < 60) {
    return `${minutes} minutes`;
  } else {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (remainingMinutes === 0) {
      return hours === 1 ? '1 hour' : `${hours} hours`;
    }
    const hourText = hours === 1 ? '1 hour' : `${hours} hours`;
    const minuteText = remainingMinutes === 1 ? '1 minute' : `${remainingMinutes} minutes`;
    return `${hourText} ${minuteText}`;
  }
}

/**
 * Check if a point is within a certain radius of another point
 * @param lat1 - Latitude of the center point
 * @param lon1 - Longitude of the center point
 * @param lat2 - Latitude of the point to check
 * @param lon2 - Longitude of the point to check
 * @param radiusMeters - Radius in meters
 * @returns True if the point is within the radius
 */
export function isWithinRadius(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
  radiusMeters: number
): boolean {
  const distance = calculateDistance(lat1, lon1, lat2, lon2, DistanceUnit.METERS);
  return distance <= radiusMeters;
}

/**
 * Calculate the midpoint between two coordinates
 * @param lat1 - Latitude of the first point
 * @param lon1 - Longitude of the first point
 * @param lat2 - Latitude of the second point
 * @param lon2 - Longitude of the second point
 * @returns Object with latitude and longitude of the midpoint
 */
export function calculateMidpoint(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): { latitude: number; longitude: number } {
  const lat1Rad = toRadians(lat1);
  const lat2Rad = toRadians(lat2);
  const lon1Rad = toRadians(lon1);
  const deltaLon = toRadians(lon2 - lon1);

  const Bx = Math.cos(lat2Rad) * Math.cos(deltaLon);
  const By = Math.cos(lat2Rad) * Math.sin(deltaLon);

  const lat3Rad = Math.atan2(
    Math.sin(lat1Rad) + Math.sin(lat2Rad),
    Math.sqrt((Math.cos(lat1Rad) + Bx) * (Math.cos(lat1Rad) + Bx) + By * By)
  );

  const lon3Rad = lon1Rad + Math.atan2(By, Math.cos(lat1Rad) + Bx);

  return {
    latitude: toDegrees(lat3Rad),
    longitude: toDegrees(lon3Rad),
  };
}

/**
 * Convert degrees to radians
 * @param degrees - Angle in degrees
 * @returns Angle in radians
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Convert radians to degrees
 * @param radians - Angle in radians
 * @returns Angle in degrees
 */
function toDegrees(radians: number): number {
  return radians * (180 / Math.PI);
}