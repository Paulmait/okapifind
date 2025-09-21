/**
 * Calculate the bearing (direction) between two geographic coordinates
 * @param lat1 - Latitude of the starting point (in degrees)
 * @param lon1 - Longitude of the starting point (in degrees)
 * @param lat2 - Latitude of the destination point (in degrees)
 * @param lon2 - Longitude of the destination point (in degrees)
 * @returns Bearing in degrees (0-360, where 0/360 is North, 90 is East, 180 is South, 270 is West)
 */
export function calculateBearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  // Convert degrees to radians
  const lat1Rad = toRadians(lat1);
  const lat2Rad = toRadians(lat2);
  const deltaLonRad = toRadians(lon2 - lon1);

  // Calculate bearing using the forward azimuth formula
  const y = Math.sin(deltaLonRad) * Math.cos(lat2Rad);
  const x =
    Math.cos(lat1Rad) * Math.sin(lat2Rad) -
    Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(deltaLonRad);

  // Calculate bearing in radians
  const bearingRad = Math.atan2(y, x);

  // Convert to degrees and normalize to 0-360 range
  const bearingDeg = toDegrees(bearingRad);
  const normalizedBearing = (bearingDeg + 360) % 360;

  return normalizedBearing;
}

/**
 * Calculate the relative bearing from a current heading to a target bearing
 * @param currentHeading - Current compass heading in degrees (0-360)
 * @param targetBearing - Target bearing in degrees (0-360)
 * @returns Relative bearing in degrees (-180 to 180, negative is left, positive is right)
 */
export function calculateRelativeBearing(
  currentHeading: number,
  targetBearing: number
): number {
  let relativeBearing = targetBearing - currentHeading;

  // Normalize to -180 to 180 range
  if (relativeBearing > 180) {
    relativeBearing -= 360;
  } else if (relativeBearing < -180) {
    relativeBearing += 360;
  }

  return relativeBearing;
}

/**
 * Get compass direction from bearing
 * @param bearing - Bearing in degrees (0-360)
 * @returns Compass direction as string
 */
export function getCompassDirection(bearing: number): string {
  const normalized = ((bearing % 360) + 360) % 360;

  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(normalized / 22.5) % 16;

  return directions[index];
}

/**
 * Get human-readable direction text based on relative bearing
 * @param relativeBearing - Relative bearing in degrees (-180 to 180)
 * @returns Human-readable direction text
 */
export function getDirectionText(relativeBearing: number): string {
  const absAngle = Math.abs(relativeBearing);

  if (absAngle <= 10) {
    return 'straight ahead';
  } else if (absAngle <= 30) {
    return relativeBearing > 0 ? 'slightly to your right' : 'slightly to your left';
  } else if (absAngle <= 60) {
    return relativeBearing > 0 ? 'to your right' : 'to your left';
  } else if (absAngle <= 120) {
    return relativeBearing > 0 ? 'sharply to your right' : 'sharply to your left';
  } else if (absAngle <= 150) {
    return relativeBearing > 0 ? 'behind you to the right' : 'behind you to the left';
  } else {
    return 'behind you';
  }
}

/**
 * Calculate turn direction and angle for navigation
 * @param currentHeading - Current compass heading in degrees
 * @param targetBearing - Target bearing in degrees
 * @returns Object with turn direction and angle
 */
export function getTurnInstruction(
  currentHeading: number,
  targetBearing: number
): { direction: 'left' | 'right' | 'straight' | 'around'; angle: number } {
  const relativeBearing = calculateRelativeBearing(currentHeading, targetBearing);
  const absAngle = Math.abs(relativeBearing);

  if (absAngle <= 10) {
    return { direction: 'straight', angle: 0 };
  } else if (absAngle >= 170) {
    return { direction: 'around', angle: 180 };
  } else if (relativeBearing > 0) {
    return { direction: 'right', angle: absAngle };
  } else {
    return { direction: 'left', angle: absAngle };
  }
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

/**
 * Calculate the initial bearing for great circle navigation
 * This is useful for long-distance navigation
 * @param lat1 - Starting latitude in degrees
 * @param lon1 - Starting longitude in degrees
 * @param lat2 - Destination latitude in degrees
 * @param lon2 - Destination longitude in degrees
 * @returns Initial bearing in degrees
 */
export function calculateInitialBearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  return calculateBearing(lat1, lon1, lat2, lon2);
}

/**
 * Calculate the final bearing when arriving at destination
 * @param lat1 - Starting latitude in degrees
 * @param lon1 - Starting longitude in degrees
 * @param lat2 - Destination latitude in degrees
 * @param lon2 - Destination longitude in degrees
 * @returns Final bearing in degrees
 */
export function calculateFinalBearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  // Reverse the calculation to get final bearing
  const reverseBearing = calculateBearing(lat2, lon2, lat1, lon1);
  return (reverseBearing + 180) % 360;
}