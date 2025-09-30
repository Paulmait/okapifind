/**
 * Parking Rules & Pricing Service
 * CRITICAL: Street parking restrictions, time limits, and pricing data
 * Prevents parking tickets and helps users find legal parking
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { analytics } from './analytics';

export type ParkingType = 'street' | 'garage' | 'lot' | 'metered' | 'permit' | 'free';

export interface ParkingRestriction {
  id: string;
  location: {
    latitude: number;
    longitude: number;
  };
  type: ParkingType;
  rules: ParkingRule[];
  signDescription?: string;
  enforcementHours?: string;
  lastUpdated: string;
}

export interface ParkingRule {
  id: string;
  type: 'time_limit' | 'permit_required' | 'no_parking' | 'street_cleaning' | 'rush_hour' | 'resident_only';
  description: string;
  daysOfWeek: number[]; // 0-6, Sunday = 0
  startTime?: string; // "09:00"
  endTime?: string; // "17:00"
  duration?: number; // minutes
  severity: 'warning' | 'ticket' | 'tow';
  fineAmount?: number;
  permitType?: string;
}

export interface ParkingPricing {
  id: string;
  location: {
    latitude: number;
    longitude: number;
  };
  type: ParkingType;
  name?: string;
  rates: ParkingRate[];
  acceptedPayment: string[]; // ['credit_card', 'cash', 'app']
  maxStay?: number; // minutes
  availability?: {
    total: number;
    available: number;
    lastUpdated: string;
  };
  features: string[]; // ['covered', 'ev_charging', 'security', 'handicap']
  operatingHours?: {
    open: string;
    close: string;
    is24Hour: boolean;
  };
}

export interface ParkingRate {
  id: string;
  description: string;
  amount: number;
  currency: string;
  duration: number; // minutes
  type: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'flat';
  daysOfWeek?: number[];
  startTime?: string;
  endTime?: string;
}

export interface ParkingViolation {
  id: string;
  location: {
    latitude: number;
    longitude: number;
  };
  type: string;
  description: string;
  date: string;
  fineAmount: number;
  status: 'unpaid' | 'paid' | 'appealed' | 'dismissed';
  dueDate?: string;
  citationNumber?: string;
}

export interface ParkingAlert {
  id: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  type: 'expiring_meter' | 'street_cleaning' | 'time_limit' | 'permit_required';
  expiresAt: string;
  dismissed: boolean;
}

class ParkingRulesService {
  private readonly ALERTS_KEY = 'parking_alerts';
  private readonly VIOLATIONS_KEY = 'parking_violations';

  private alerts: ParkingAlert[] = [];
  private violations: ParkingViolation[] = [];
  private alertTimers: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Initialize service
   */
  async initialize(): Promise<void> {
    try {
      await this.loadAlerts();
      await this.loadViolations();
      console.log('Parking rules service initialized');
    } catch (error) {
      console.error('Error initializing parking rules service:', error);
    }
  }

  /**
   * Get parking restrictions for location
   */
  async getParkingRestrictions(
    latitude: number,
    longitude: number,
    radius: number = 100
  ): Promise<ParkingRestriction[]> {
    try {
      // In production, integrate with:
      // - ParkingAPI.com
      // - SpotHero API
      // - ParkWhiz API
      // - City parking data APIs (OpenData)
      // - HERE Parking API

      // Simulate restrictions based on time/location
      const restrictions = this.simulateRestrictions(latitude, longitude);

      analytics.logEvent('parking_restrictions_fetched', {
        location: `${latitude},${longitude}`,
        restriction_count: restrictions.length,
      });

      return restrictions;
    } catch (error) {
      console.error('Error fetching parking restrictions:', error);
      return [];
    }
  }

  /**
   * Get parking pricing for location
   */
  async getParkingPricing(
    latitude: number,
    longitude: number,
    radius: number = 500
  ): Promise<ParkingPricing[]> {
    try {
      // In production, integrate with parking pricing APIs
      const pricing = this.simulatePricing(latitude, longitude);

      analytics.logEvent('parking_pricing_fetched', {
        location: `${latitude},${longitude}`,
        option_count: pricing.length,
      });

      return pricing;
    } catch (error) {
      console.error('Error fetching parking pricing:', error);
      return [];
    }
  }

  /**
   * Check if parking is allowed at current time
   */
  isParkingAllowed(
    restrictions: ParkingRestriction[],
    checkTime: Date = new Date()
  ): {
    allowed: boolean;
    reason?: string;
    severity?: 'warning' | 'ticket' | 'tow';
    fineAmount?: number;
  } {
    const now = checkTime;
    const dayOfWeek = now.getDay();
    const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    for (const restriction of restrictions) {
      for (const rule of restriction.rules) {
        // Check if rule applies today
        if (!rule.daysOfWeek.includes(dayOfWeek)) {
          continue;
        }

        // Check if rule applies at this time
        if (rule.startTime && rule.endTime) {
          if (timeString >= rule.startTime && timeString <= rule.endTime) {
            if (rule.type === 'no_parking' || rule.type === 'rush_hour' || rule.type === 'street_cleaning') {
              return {
                allowed: false,
                reason: rule.description,
                severity: rule.severity,
                fineAmount: rule.fineAmount,
              };
            }
          }
        }

        // Check permit requirements
        if (rule.type === 'permit_required' || rule.type === 'resident_only') {
          return {
            allowed: false,
            reason: rule.description,
            severity: 'ticket',
            fineAmount: rule.fineAmount,
          };
        }
      }
    }

    return { allowed: true };
  }

  /**
   * Calculate parking cost
   */
  calculateParkingCost(
    pricing: ParkingPricing,
    durationMinutes: number,
    startTime: Date = new Date()
  ): {
    totalCost: number;
    currency: string;
    breakdown: Array<{ description: string; amount: number }>;
  } {
    let totalCost = 0;
    const breakdown: Array<{ description: string; amount: number }> = [];

    // Find applicable rates
    const applicableRates = pricing.rates.filter(rate => {
      if (rate.daysOfWeek) {
        if (!rate.daysOfWeek.includes(startTime.getDay())) {
          return false;
        }
      }

      if (rate.startTime && rate.endTime) {
        const timeString = `${startTime.getHours().toString().padStart(2, '0')}:${startTime.getMinutes().toString().padStart(2, '0')}`;
        if (timeString < rate.startTime || timeString > rate.endTime) {
          return false;
        }
      }

      return true;
    });

    if (applicableRates.length === 0) {
      return {
        totalCost: 0,
        currency: 'USD',
        breakdown: [],
      };
    }

    // Use the rate with the best match
    const rate = applicableRates[0];

    switch (rate.type) {
      case 'flat':
        totalCost = rate.amount;
        breakdown.push({ description: rate.description, amount: rate.amount });
        break;

      case 'hourly':
        const hours = Math.ceil(durationMinutes / 60);
        totalCost = hours * rate.amount;
        breakdown.push({ description: `${hours} hours @ $${rate.amount}/hr`, amount: totalCost });
        break;

      case 'daily':
        const days = Math.ceil(durationMinutes / (24 * 60));
        totalCost = days * rate.amount;
        breakdown.push({ description: `${days} days @ $${rate.amount}/day`, amount: totalCost });
        break;

      case 'weekly':
        const weeks = Math.ceil(durationMinutes / (7 * 24 * 60));
        totalCost = weeks * rate.amount;
        breakdown.push({ description: `${weeks} weeks @ $${rate.amount}/week`, amount: totalCost });
        break;

      case 'monthly':
        totalCost = rate.amount;
        breakdown.push({ description: 'Monthly parking', amount: rate.amount });
        break;
    }

    analytics.logEvent('parking_cost_calculated', {
      pricing_id: pricing.id,
      duration_minutes: durationMinutes,
      total_cost: totalCost,
    });

    return {
      totalCost,
      currency: rate.currency,
      breakdown,
    };
  }

  /**
   * Set parking alert (e.g., meter expiration)
   */
  async setParkingAlert(
    type: ParkingAlert['type'],
    message: string,
    expiresAt: Date,
    severity: 'info' | 'warning' | 'critical' = 'warning'
  ): Promise<ParkingAlert> {
    const alert: ParkingAlert = {
      id: `alert_${Date.now()}`,
      message,
      severity,
      type,
      expiresAt: expiresAt.toISOString(),
      dismissed: false,
    };

    this.alerts.push(alert);
    await this.saveAlerts();

    // Set timer for notification
    const timeUntilExpiry = expiresAt.getTime() - Date.now();
    if (timeUntilExpiry > 0) {
      const timer = setTimeout(() => {
        this.triggerAlert(alert);
      }, Math.max(0, timeUntilExpiry - 5 * 60 * 1000)); // 5 min before expiry

      this.alertTimers.set(alert.id, timer);
    }

    analytics.logEvent('parking_alert_set', {
      type,
      expires_in_minutes: Math.round(timeUntilExpiry / 60000),
    });

    return alert;
  }

  /**
   * Get active parking alerts
   */
  async getActiveAlerts(): Promise<ParkingAlert[]> {
    await this.loadAlerts();

    const now = new Date();
    return this.alerts.filter(
      alert => !alert.dismissed && new Date(alert.expiresAt) > now
    );
  }

  /**
   * Dismiss alert
   */
  async dismissAlert(alertId: string): Promise<void> {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.dismissed = true;
      await this.saveAlerts();

      // Clear timer
      const timer = this.alertTimers.get(alertId);
      if (timer) {
        clearTimeout(timer);
        this.alertTimers.delete(alertId);
      }

      analytics.logEvent('parking_alert_dismissed', {
        alert_id: alertId,
      });
    }
  }

  /**
   * Add parking violation
   */
  async addViolation(violation: Omit<ParkingViolation, 'id'>): Promise<void> {
    const newViolation: ParkingViolation = {
      id: `violation_${Date.now()}`,
      ...violation,
    };

    this.violations.push(newViolation);
    await this.saveViolations();

    analytics.logEvent('parking_violation_added', {
      type: violation.type,
      fine_amount: violation.fineAmount,
    });
  }

  /**
   * Get parking violations
   */
  async getViolations(
    status?: ParkingViolation['status']
  ): Promise<ParkingViolation[]> {
    await this.loadViolations();

    if (status) {
      return this.violations.filter(v => v.status === status);
    }

    return this.violations;
  }

  /**
   * Update violation status
   */
  async updateViolationStatus(
    violationId: string,
    status: ParkingViolation['status']
  ): Promise<void> {
    const violation = this.violations.find(v => v.id === violationId);
    if (violation) {
      violation.status = status;
      await this.saveViolations();

      analytics.logEvent('violation_status_updated', {
        violation_id: violationId,
        new_status: status,
      });
    }
  }

  /**
   * Get parking recommendations
   */
  async getParkingRecommendations(
    latitude: number,
    longitude: number,
    durationMinutes: number
  ): Promise<Array<{
    location: { latitude: number; longitude: number };
    type: ParkingType;
    name: string;
    cost: number;
    walkTimeMinutes: number;
    restrictions: string[];
    score: number; // 0-100
    recommendation: string;
  }>> {
    try {
      const restrictions = await this.getParkingRestrictions(latitude, longitude, 200);
      const pricing = await this.getParkingPricing(latitude, longitude, 500);

      const recommendations = pricing.map(p => {
        const cost = this.calculateParkingCost(p, durationMinutes);
        const nearbyRestrictions = restrictions.filter(r =>
          this.calculateDistance(r.location, p.location) < 100
        );

        // Calculate score
        let score = 100;
        score -= cost.totalCost * 2; // Penalize expensive parking
        score -= nearbyRestrictions.length * 10; // Penalize restricted areas

        if (p.availability && p.availability.available < 5) {
          score -= 20; // Penalize low availability
        }

        if (p.features.includes('covered')) score += 5;
        if (p.features.includes('security')) score += 5;
        if (p.features.includes('ev_charging')) score += 3;

        score = Math.max(0, Math.min(100, score));

        let recommendation = '';
        if (score >= 80) recommendation = 'Highly recommended';
        else if (score >= 60) recommendation = 'Good option';
        else if (score >= 40) recommendation = 'Consider alternatives';
        else recommendation = 'Not recommended';

        return {
          location: p.location,
          type: p.type,
          name: p.name || 'Parking',
          cost: cost.totalCost,
          walkTimeMinutes: 5, // Estimate
          restrictions: nearbyRestrictions.map(r => r.signDescription || 'Restrictions apply'),
          score,
          recommendation,
        };
      });

      // Sort by score
      recommendations.sort((a, b) => b.score - a.score);

      return recommendations;
    } catch (error) {
      console.error('Error getting parking recommendations:', error);
      return [];
    }
  }

  /**
   * Trigger alert notification
   */
  private triggerAlert(alert: ParkingAlert): void {
    // This would trigger a push notification
    analytics.logEvent('parking_alert_triggered', {
      alert_id: alert.id,
      type: alert.type,
    });

    // TODO: Integrate with expo-notifications
    console.log('Parking alert:', alert.message);
  }

  /**
   * Calculate distance between two points
   */
  private calculateDistance(
    point1: { latitude: number; longitude: number },
    point2: { latitude: number; longitude: number }
  ): number {
    const R = 6371000; // Earth's radius in meters
    const dLat = this.toRad(point2.latitude - point1.latitude);
    const dLon = this.toRad(point2.longitude - point1.longitude);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(point1.latitude)) *
        Math.cos(this.toRad(point2.latitude)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(degrees: number): number {
    return (degrees * Math.PI) / 180;
  }

  /**
   * Simulate restrictions (for development)
   */
  private simulateRestrictions(latitude: number, longitude: number): ParkingRestriction[] {
    return [
      {
        id: 'rest_1',
        location: { latitude, longitude },
        type: 'street',
        rules: [
          {
            id: 'rule_1',
            type: 'time_limit',
            description: '2 hour parking limit, 9 AM - 6 PM',
            daysOfWeek: [1, 2, 3, 4, 5], // Mon-Fri
            startTime: '09:00',
            endTime: '18:00',
            duration: 120,
            severity: 'ticket',
            fineAmount: 45,
          },
          {
            id: 'rule_2',
            type: 'street_cleaning',
            description: 'No parking - Street cleaning',
            daysOfWeek: [2], // Tuesday
            startTime: '08:00',
            endTime: '12:00',
            severity: 'tow',
            fineAmount: 150,
          },
        ],
        signDescription: '2 HR PARKING 9AM-6PM MON-FRI',
        enforcementHours: '9 AM - 6 PM',
        lastUpdated: new Date().toISOString(),
      },
    ];
  }

  /**
   * Simulate pricing (for development)
   */
  private simulatePricing(latitude: number, longitude: number): ParkingPricing[] {
    return [
      {
        id: 'pricing_1',
        location: { latitude: latitude + 0.001, longitude: longitude + 0.001 },
        type: 'garage',
        name: 'Downtown Parking Garage',
        rates: [
          {
            id: 'rate_1',
            description: 'Hourly rate',
            amount: 5,
            currency: 'USD',
            duration: 60,
            type: 'hourly',
          },
          {
            id: 'rate_2',
            description: 'Daily maximum',
            amount: 25,
            currency: 'USD',
            duration: 1440,
            type: 'daily',
          },
        ],
        acceptedPayment: ['credit_card', 'app'],
        maxStay: 1440, // 24 hours
        availability: {
          total: 200,
          available: 45,
          lastUpdated: new Date().toISOString(),
        },
        features: ['covered', 'security', 'handicap'],
        operatingHours: {
          open: '00:00',
          close: '23:59',
          is24Hour: true,
        },
      },
      {
        id: 'pricing_2',
        location: { latitude: latitude - 0.002, longitude: longitude - 0.001 },
        type: 'metered',
        name: 'Street Meter',
        rates: [
          {
            id: 'rate_3',
            description: 'Metered parking',
            amount: 2.5,
            currency: 'USD',
            duration: 60,
            type: 'hourly',
            daysOfWeek: [1, 2, 3, 4, 5],
            startTime: '09:00',
            endTime: '18:00',
          },
        ],
        acceptedPayment: ['credit_card', 'cash', 'app'],
        maxStay: 120, // 2 hours
        features: [],
        operatingHours: {
          open: '09:00',
          close: '18:00',
          is24Hour: false,
        },
      },
    ];
  }

  /**
   * Load alerts from storage
   */
  private async loadAlerts(): Promise<void> {
    try {
      const data = await AsyncStorage.getItem(this.ALERTS_KEY);
      if (data) {
        this.alerts = JSON.parse(data);
      }
    } catch (error) {
      console.error('Error loading alerts:', error);
      this.alerts = [];
    }
  }

  /**
   * Save alerts to storage
   */
  private async saveAlerts(): Promise<void> {
    try {
      await AsyncStorage.setItem(this.ALERTS_KEY, JSON.stringify(this.alerts));
    } catch (error) {
      console.error('Error saving alerts:', error);
    }
  }

  /**
   * Load violations from storage
   */
  private async loadViolations(): Promise<void> {
    try {
      const data = await AsyncStorage.getItem(this.VIOLATIONS_KEY);
      if (data) {
        this.violations = JSON.parse(data);
      }
    } catch (error) {
      console.error('Error loading violations:', error);
      this.violations = [];
    }
  }

  /**
   * Save violations to storage
   */
  private async saveViolations(): Promise<void> {
    try {
      await AsyncStorage.setItem(this.VIOLATIONS_KEY, JSON.stringify(this.violations));
    } catch (error) {
      console.error('Error saving violations:', error);
    }
  }

  /**
   * Cleanup
   */
  cleanup(): void {
    this.alertTimers.forEach(timer => clearTimeout(timer));
    this.alertTimers.clear();
  }
}

// Export singleton instance
export const parkingRulesService = new ParkingRulesService();

export default parkingRulesService;