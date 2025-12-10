/**
 * Floor Detection Service
 * Uses barometric pressure sensor to detect parking garage floor level
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Types
export interface FloorReading {
  floor: number;
  confidence: 'high' | 'medium' | 'low';
  pressure: number;
  altitude: number;
  timestamp: string;
}

export interface CalibrationPoint {
  floor: number;
  pressure: number;
  altitude: number;
  location: {
    latitude: number;
    longitude: number;
  };
  timestamp: string;
}

// Constants
const STORAGE_KEY = '@okapifind/floor_calibration';
const PRESSURE_PER_FLOOR = 0.36; // hPa per floor (approx 3m)
const ALTITUDE_PER_FLOOR = 3; // meters per floor
const SEA_LEVEL_PRESSURE = 1013.25; // hPa

class FloorDetectionService {
  private static instance: FloorDetectionService;
  private calibrationPoints: CalibrationPoint[] = [];
  private groundLevelPressure: number | null = null;
  private isAvailable = false;
  private currentPressure: number | null = null;

  private constructor() {
    this.initialize();
  }

  static getInstance(): FloorDetectionService {
    if (!FloorDetectionService.instance) {
      FloorDetectionService.instance = new FloorDetectionService();
    }
    return FloorDetectionService.instance;
  }

  /**
   * Initialize the service
   */
  private async initialize(): Promise<void> {
    await this.loadCalibration();
    await this.checkAvailability();
  }

  /**
   * Check if barometer is available
   */
  private async checkAvailability(): Promise<void> {
    try {
      // Check if Barometer API is available
      // Note: This requires expo-sensors which is already in the project
      const { Barometer } = await import('expo-sensors');

      const isAvailable = await Barometer.isAvailableAsync();
      this.isAvailable = isAvailable;

      if (isAvailable) {
        // Subscribe to pressure updates
        Barometer.addListener(({ pressure }) => {
          this.currentPressure = pressure;
        });
      }
    } catch {
      this.isAvailable = false;
    }
  }

  /**
   * Check if floor detection is available on this device
   */
  isFloorDetectionAvailable(): boolean {
    return this.isAvailable;
  }

  /**
   * Calibrate ground level at current location
   */
  async calibrateGroundLevel(
    latitude: number,
    longitude: number
  ): Promise<boolean> {
    if (!this.isAvailable || !this.currentPressure) {
      return false;
    }

    try {
      const pressure = this.currentPressure;
      const altitude = this.pressureToAltitude(pressure);

      const calibrationPoint: CalibrationPoint = {
        floor: 0,
        pressure,
        altitude,
        location: { latitude, longitude },
        timestamp: new Date().toISOString(),
      };

      // Store as ground level reference
      this.groundLevelPressure = pressure;

      // Add to calibration points
      this.calibrationPoints = this.calibrationPoints.filter(
        (p) => !this.isNearby(p.location, { latitude, longitude })
      );
      this.calibrationPoints.push(calibrationPoint);

      await this.saveCalibration();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Calibrate a specific floor at current location
   */
  async calibrateFloor(
    floor: number,
    latitude: number,
    longitude: number
  ): Promise<boolean> {
    if (!this.isAvailable || !this.currentPressure) {
      return false;
    }

    try {
      const pressure = this.currentPressure;
      const altitude = this.pressureToAltitude(pressure);

      const calibrationPoint: CalibrationPoint = {
        floor,
        pressure,
        altitude,
        location: { latitude, longitude },
        timestamp: new Date().toISOString(),
      };

      // Update or add calibration point
      const existingIndex = this.calibrationPoints.findIndex(
        (p) => this.isNearby(p.location, { latitude, longitude }) && p.floor === floor
      );

      if (existingIndex >= 0) {
        this.calibrationPoints[existingIndex] = calibrationPoint;
      } else {
        this.calibrationPoints.push(calibrationPoint);
      }

      await this.saveCalibration();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Detect current floor level
   */
  async detectFloor(
    latitude?: number,
    longitude?: number
  ): Promise<FloorReading | null> {
    if (!this.isAvailable || !this.currentPressure) {
      return null;
    }

    try {
      const pressure = this.currentPressure;
      const altitude = this.pressureToAltitude(pressure);

      // Try to find nearby calibration point
      let referencePoint: CalibrationPoint | null = null;
      if (latitude !== undefined && longitude !== undefined) {
        referencePoint = this.findNearestCalibration(latitude, longitude);
      }

      let floor: number;
      let confidence: 'high' | 'medium' | 'low';

      if (referencePoint) {
        // Use calibration point for accurate calculation
        const pressureDiff = referencePoint.pressure - pressure;
        const floorDiff = pressureDiff / PRESSURE_PER_FLOOR;
        floor = Math.round(referencePoint.floor + floorDiff);
        confidence = 'high';
      } else if (this.groundLevelPressure) {
        // Use ground level reference
        const pressureDiff = this.groundLevelPressure - pressure;
        floor = Math.round(pressureDiff / PRESSURE_PER_FLOOR);
        confidence = 'medium';
      } else {
        // Estimate based on altitude (least accurate)
        // Assume typical parking at ground level
        floor = Math.round(altitude / ALTITUDE_PER_FLOOR);
        confidence = 'low';
      }

      // Handle underground floors (negative)
      // Pressure increases when going underground
      if (referencePoint && pressure > referencePoint.pressure) {
        const underground = Math.round(
          (pressure - referencePoint.pressure) / PRESSURE_PER_FLOOR
        );
        floor = -underground;
      }

      return {
        floor,
        confidence,
        pressure,
        altitude,
        timestamp: new Date().toISOString(),
      };
    } catch {
      return null;
    }
  }

  /**
   * Get floor label (handles underground floors)
   */
  getFloorLabel(floor: number): string {
    if (floor === 0) return 'Ground';
    if (floor < 0) return `B${Math.abs(floor)}`; // Basement
    return `${floor}`;
  }

  /**
   * Get human-readable floor description
   */
  getFloorDescription(floor: number): string {
    if (floor === 0) return 'Ground Floor';
    if (floor < 0) return `Basement Level ${Math.abs(floor)}`;
    return `Floor ${floor}`;
  }

  /**
   * Start continuous floor monitoring
   */
  async startMonitoring(
    callback: (reading: FloorReading) => void,
    intervalMs: number = 2000
  ): Promise<() => void> {
    if (!this.isAvailable) {
      return () => {};
    }

    const interval = setInterval(async () => {
      const reading = await this.detectFloor();
      if (reading) {
        callback(reading);
      }
    }, intervalMs);

    return () => clearInterval(interval);
  }

  /**
   * Get calibration status for a location
   */
  getCalibrationStatus(
    latitude: number,
    longitude: number
  ): { isCalibrated: boolean; lastCalibration?: string } {
    const nearest = this.findNearestCalibration(latitude, longitude);

    if (nearest && this.isNearby(nearest.location, { latitude, longitude })) {
      return {
        isCalibrated: true,
        lastCalibration: nearest.timestamp,
      };
    }

    return { isCalibrated: false };
  }

  // Private helper methods

  private pressureToAltitude(pressure: number): number {
    // Barometric formula
    return 44330 * (1 - Math.pow(pressure / SEA_LEVEL_PRESSURE, 0.1903));
  }

  private findNearestCalibration(
    latitude: number,
    longitude: number
  ): CalibrationPoint | null {
    if (this.calibrationPoints.length === 0) return null;

    let nearest: CalibrationPoint | null = null;
    let minDistance = Infinity;

    for (const point of this.calibrationPoints) {
      const distance = this.calculateDistance(
        latitude,
        longitude,
        point.location.latitude,
        point.location.longitude
      );

      if (distance < minDistance) {
        minDistance = distance;
        nearest = point;
      }
    }

    // Only return if within 500m
    return minDistance < 0.5 ? nearest : null;
  }

  private isNearby(
    loc1: { latitude: number; longitude: number },
    loc2: { latitude: number; longitude: number }
  ): boolean {
    const distance = this.calculateDistance(
      loc1.latitude,
      loc1.longitude,
      loc2.latitude,
      loc2.longitude
    );
    return distance < 0.1; // 100m
  }

  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371;
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  private async loadCalibration(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        this.calibrationPoints = data.calibrationPoints || [];
        this.groundLevelPressure = data.groundLevelPressure || null;
      }
    } catch {
      this.calibrationPoints = [];
    }
  }

  private async saveCalibration(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          calibrationPoints: this.calibrationPoints,
          groundLevelPressure: this.groundLevelPressure,
        })
      );
    } catch {
      // Silently fail
    }
  }
}

export const floorDetectionService = FloorDetectionService.getInstance();
export default floorDetectionService;
