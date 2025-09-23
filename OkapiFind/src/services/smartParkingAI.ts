/**
 * Smart Parking AI Service
 * Advanced ML-based parking pattern learning that predicts where users park
 * Uses behavioral analysis, location clustering, and time-based predictions
 */

import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { analytics } from './analytics';
import GeminiAI from './geminiAI';

interface ParkingPattern {
  id: string;
  dayOfWeek: number; // 0-6 (Sunday-Saturday)
  timeOfDay: number; // minutes from midnight
  location: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  };
  venue?: string;
  frequency: number; // How often this pattern occurs
  confidence: number; // 0-1 confidence score
  lastUsed: number; // timestamp
  contextTags: string[]; // ['work', 'shopping', 'home', 'recurring']
}

interface ParkingPrediction {
  location: {
    latitude: number;
    longitude: number;
    radius: number; // prediction radius in meters
  };
  confidence: number;
  reasons: string[];
  alternativeSpots: Array<{
    location: { latitude: number; longitude: number };
    confidence: number;
    distance: number;
  }>;
  estimatedWalkTime: number; // minutes
  suggestions: string[];
}

interface LocationCluster {
  id: string;
  centroid: { latitude: number; longitude: number };
  radius: number;
  sessions: number;
  lastVisit: number;
  avgParkingDuration: number;
  successRate: number; // how often parking was successful here
  timePatterns: { hour: number; frequency: number }[];
  dayPatterns: { day: number; frequency: number }[];
}

interface BehavioralMetrics {
  avgSearchTime: number; // minutes spent looking for parking
  preferredWalkDistance: number; // meters user typically walks
  timePreferences: { early: number; peak: number; late: number };
  venueTypes: Record<string, number>; // frequency by venue type
  parkingSuccessRate: number;
  adaptabilityScore: number; // how flexible user is with spots
}

const STORAGE_KEYS = {
  PATTERNS: '@parking_patterns',
  CLUSTERS: '@location_clusters',
  METRICS: '@behavioral_metrics',
  PREDICTIONS: '@ai_predictions',
  LEARNING_DATA: '@learning_data',
};

class SmartParkingAI {
  private patterns: ParkingPattern[] = [];
  private clusters: LocationCluster[] = [];
  private metrics: BehavioralMetrics | null = null;
  private isLearning: boolean = false;
  private predictionCache: Map<string, ParkingPrediction> = new Map();

  constructor() {
    this.initializeAI();
  }

  /**
   * Initialize AI system and load existing data
   */
  private async initializeAI() {
    try {
      await this.loadParkingData();
      await this.loadClusters();
      await this.loadBehavioralMetrics();

      // Start background learning
      this.startBackgroundLearning();

      analytics.logEvent('smart_parking_ai_initialized', {
        patterns_count: this.patterns.length,
        clusters_count: this.clusters.length,
      });
    } catch (error) {
      console.error('Failed to initialize Smart Parking AI:', error);
    }
  }

  /**
   * Learn from a parking session
   */
  async learnFromSession(session: {
    startLocation: Location.LocationObject;
    parkingLocation: Location.LocationObject;
    searchDuration: number; // minutes
    walkDistance?: number; // meters
    venue?: string;
    wasSuccessful: boolean;
    userSatisfaction?: number; // 1-5 rating
    context?: string[]; // tags like 'work', 'shopping', etc.
  }) {
    try {
      const now = new Date();
      const pattern: ParkingPattern = {
        id: `pattern_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        dayOfWeek: now.getDay(),
        timeOfDay: now.getHours() * 60 + now.getMinutes(),
        location: {
          latitude: session.parkingLocation.coords.latitude,
          longitude: session.parkingLocation.coords.longitude,
          accuracy: session.parkingLocation.coords.accuracy,
        },
        venue: session.venue,
        frequency: 1,
        confidence: this.calculateInitialConfidence(session),
        lastUsed: Date.now(),
        contextTags: session.context || [],
      };

      // Update or create pattern
      await this.updateParkingPattern(pattern);

      // Update location clusters
      await this.updateLocationClusters(session.parkingLocation);

      // Update behavioral metrics
      await this.updateBehavioralMetrics(session);

      // Clear prediction cache as patterns have changed
      this.predictionCache.clear();

      analytics.logEvent('parking_ai_learned', {
        was_successful: session.wasSuccessful,
        search_duration: session.searchDuration,
        has_venue: !!session.venue,
        confidence: pattern.confidence,
      });

    } catch (error) {
      console.error('Failed to learn from parking session:', error);
    }
  }

  /**
   * Predict optimal parking locations
   */
  async predictParkingSpot(
    currentLocation: Location.LocationObject,
    destination?: { latitude: number; longitude: number },
    context?: string[]
  ): Promise<ParkingPrediction> {
    try {
      const cacheKey = this.generatePredictionCacheKey(currentLocation, destination, context);

      // Check cache first
      if (this.predictionCache.has(cacheKey)) {
        const cached = this.predictionCache.get(cacheKey)!;
        analytics.logEvent('parking_prediction_cache_hit');
        return cached;
      }

      const now = new Date();
      const dayOfWeek = now.getDay();
      const timeOfDay = now.getHours() * 60 + now.getMinutes();

      // Find relevant patterns
      const relevantPatterns = this.findRelevantPatterns(
        currentLocation,
        destination,
        dayOfWeek,
        timeOfDay,
        context
      );

      // Find nearby clusters
      const nearbyClusters = this.findNearbyClusters(
        destination || currentLocation,
        2000 // 2km radius
      );

      // Generate prediction
      const prediction = this.generatePrediction(
        relevantPatterns,
        nearbyClusters,
        currentLocation,
        destination,
        context
      );

      // Cache prediction for 5 minutes
      this.predictionCache.set(cacheKey, prediction);
      setTimeout(() => this.predictionCache.delete(cacheKey), 5 * 60 * 1000);

      analytics.logEvent('parking_prediction_generated', {
        confidence: prediction.confidence,
        has_destination: !!destination,
        patterns_used: relevantPatterns.length,
        clusters_used: nearbyClusters.length,
      });

      return prediction;

    } catch (error) {
      console.error('Failed to predict parking spot:', error);
      return this.getDefaultPrediction(currentLocation);
    }
  }

  /**
   * Get personalized parking recommendations with Gemini AI enhancement
   */
  async getParkingRecommendations(
    location: { latitude: number; longitude: number },
    radius: number = 1000
  ): Promise<Array<{
    location: { latitude: number; longitude: number };
    score: number;
    reasons: string[];
    walkTime: number;
    confidence: number;
  }>> {
    try {
      // Get traditional ML recommendations
      const clusters = this.findNearbyClusters(location, radius);
      const patterns = this.patterns.filter(p =>
        this.calculateDistance(p.location, location) <= radius
      );

      const recommendations = clusters.map(cluster => {
        const relatedPatterns = patterns.filter(p =>
          this.calculateDistance(p.location, cluster.centroid) <= cluster.radius
        );

        const score = this.calculateRecommendationScore(cluster, relatedPatterns);
        const reasons = this.generateRecommendationReasons(cluster, relatedPatterns);
        const walkTime = this.estimateWalkTime(cluster.centroid, location);

        return {
          location: cluster.centroid,
          score,
          reasons,
          walkTime,
          confidence: cluster.successRate,
        };
      });

      // Enhance with Gemini AI predictions
      try {
        await GeminiAI.initialize();
        const geminiPrediction = await GeminiAI.getParkingSuggestion({
          location,
          time: new Date(),
          userHistory: this.patterns.slice(0, 5).map(p =>
            `${p.venue || 'Unknown'} at ${p.location.latitude},${p.location.longitude}`
          ),
        });

        // Merge AI suggestions with ML recommendations
        if (geminiPrediction.confidence > 0.7) {
          geminiPrediction.alternativeSpots.forEach((spot, idx) => {
            if (idx < 3) { // Add top 3 AI suggestions
              recommendations.push({
                location: spot.location,
                score: spot.confidence * 100,
                reasons: [`AI predicted ${(spot.confidence * 100).toFixed(0)}% success rate`],
                walkTime: this.estimateWalkTime(spot.location, location),
                confidence: spot.confidence,
              });
            }
          });
        }
      } catch (aiError) {
        console.log('Gemini AI enhancement unavailable, using ML only:', aiError);
      }

      // Sort by score descending
      recommendations.sort((a, b) => b.score - a.score);

      return recommendations.slice(0, 5); // Top 5 recommendations

    } catch (error) {
      console.error('Failed to get parking recommendations:', error);
      return [];
    }
  }

  /**
   * Analyze parking behavior and provide insights
   */
  async getInsights(): Promise<{
    parkingEfficiency: number;
    mostUsedSpots: Array<{ location: { latitude: number; longitude: number }; usage: number }>;
    timePatterns: Array<{ time: string; frequency: number }>;
    suggestions: string[];
    weeklyReport: {
      totalSessions: number;
      avgSearchTime: number;
      favoriteSpots: number;
      efficiency: string;
    };
  }> {
    try {
      const insights = {
        parkingEfficiency: this.calculateParkingEfficiency(),
        mostUsedSpots: this.getMostUsedSpots(5),
        timePatterns: this.getTimePatterns(),
        suggestions: await this.generatePersonalizedSuggestions(),
        weeklyReport: {
          totalSessions: this.patterns.length,
          avgSearchTime: this.metrics?.avgSearchTime || 0,
          favoriteSpots: this.clusters.length,
          efficiency: this.getEfficiencyRating(),
        },
      };

      analytics.logEvent('parking_insights_generated', {
        efficiency: insights.parkingEfficiency,
        total_patterns: this.patterns.length,
        total_clusters: this.clusters.length,
      });

      return insights;

    } catch (error) {
      console.error('Failed to generate insights:', error);
      throw error;
    }
  }

  /**
   * Find relevant patterns based on current context
   */
  private findRelevantPatterns(
    currentLocation: Location.LocationObject,
    destination?: { latitude: number; longitude: number },
    dayOfWeek?: number,
    timeOfDay?: number,
    context?: string[]
  ): ParkingPattern[] {
    const searchLocation = destination || currentLocation;

    return this.patterns
      .filter(pattern => {
        // Distance filter (within 2km)
        const distance = this.calculateDistance(pattern.location, searchLocation);
        if (distance > 2000) return false;

        // Time filters
        if (dayOfWeek !== undefined) {
          const dayDiff = Math.abs(pattern.dayOfWeek - dayOfWeek);
          if (dayDiff > 1 && dayDiff < 6) return false; // Allow adjacent days
        }

        if (timeOfDay !== undefined) {
          const timeDiff = Math.abs(pattern.timeOfDay - timeOfDay);
          if (timeDiff > 120) return false; // Within 2 hours
        }

        // Context filter
        if (context && context.length > 0) {
          const hasMatchingContext = context.some(c =>
            pattern.contextTags.includes(c)
          );
          if (!hasMatchingContext && pattern.contextTags.length > 0) return false;
        }

        return true;
      })
      .sort((a, b) => {
        // Sort by relevance score
        const scoreA = this.calculatePatternRelevance(a, searchLocation, dayOfWeek, timeOfDay, context);
        const scoreB = this.calculatePatternRelevance(b, searchLocation, dayOfWeek, timeOfDay, context);
        return scoreB - scoreA;
      })
      .slice(0, 10); // Top 10 relevant patterns
  }

  /**
   * Calculate pattern relevance score
   */
  private calculatePatternRelevance(
    pattern: ParkingPattern,
    location: { latitude: number; longitude: number },
    dayOfWeek?: number,
    timeOfDay?: number,
    context?: string[]
  ): number {
    let score = pattern.confidence * pattern.frequency;

    // Distance penalty
    const distance = this.calculateDistance(pattern.location, location);
    score *= Math.exp(-distance / 1000); // Exponential decay with distance

    // Time similarity bonus
    if (dayOfWeek !== undefined) {
      const dayDiff = Math.abs(pattern.dayOfWeek - dayOfWeek);
      score *= Math.max(0.5, 1 - dayDiff / 7);
    }

    if (timeOfDay !== undefined) {
      const timeDiff = Math.abs(pattern.timeOfDay - timeOfDay);
      score *= Math.max(0.3, 1 - timeDiff / (12 * 60)); // 12 hour decay
    }

    // Context bonus
    if (context && pattern.contextTags.length > 0) {
      const contextMatch = context.filter(c => pattern.contextTags.includes(c)).length;
      score *= 1 + (contextMatch / Math.max(context.length, pattern.contextTags.length));
    }

    // Recency bonus
    const daysSinceLastUse = (Date.now() - pattern.lastUsed) / (24 * 60 * 60 * 1000);
    score *= Math.exp(-daysSinceLastUse / 30); // Decay over 30 days

    return score;
  }

  /**
   * Update existing pattern or create new one
   */
  private async updateParkingPattern(newPattern: ParkingPattern) {
    const threshold = 100; // 100 meters

    // Find existing similar pattern
    const existingIndex = this.patterns.findIndex(p => {
      const distance = this.calculateDistance(p.location, newPattern.location);
      const timeDiff = Math.abs(p.timeOfDay - newPattern.timeOfDay);
      const dayMatch = p.dayOfWeek === newPattern.dayOfWeek;

      return distance <= threshold && timeDiff <= 60 && dayMatch;
    });

    if (existingIndex >= 0) {
      // Update existing pattern
      const existing = this.patterns[existingIndex];
      existing.frequency += 1;
      existing.confidence = Math.min(1.0, existing.confidence + 0.1);
      existing.lastUsed = Date.now();

      // Merge context tags
      newPattern.contextTags.forEach(tag => {
        if (!existing.contextTags.includes(tag)) {
          existing.contextTags.push(tag);
        }
      });
    } else {
      // Add new pattern
      this.patterns.push(newPattern);
    }

    await this.saveParkingData();
  }

  /**
   * Update location clusters using DBSCAN-like algorithm
   */
  private async updateLocationClusters(location: Location.LocationObject) {
    const point = {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    };

    // Find nearby cluster (within 200m)
    let nearbyCluster = this.clusters.find(cluster => {
      const distance = this.calculateDistance(cluster.centroid, point);
      return distance <= 200;
    });

    if (nearbyCluster) {
      // Update existing cluster
      nearbyCluster.sessions += 1;
      nearbyCluster.lastVisit = Date.now();

      // Recalculate centroid with weighted average
      const weight = 1 / nearbyCluster.sessions;
      nearbyCluster.centroid.latitude =
        nearbyCluster.centroid.latitude * (1 - weight) + point.latitude * weight;
      nearbyCluster.centroid.longitude =
        nearbyCluster.centroid.longitude * (1 - weight) + point.longitude * weight;
    } else {
      // Create new cluster
      const newCluster: LocationCluster = {
        id: `cluster_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        centroid: point,
        radius: 100,
        sessions: 1,
        lastVisit: Date.now(),
        avgParkingDuration: 0,
        successRate: 1.0,
        timePatterns: [],
        dayPatterns: [],
      };

      this.clusters.push(newCluster);
    }

    await this.saveClusters();
  }

  /**
   * Generate parking prediction
   */
  private generatePrediction(
    patterns: ParkingPattern[],
    clusters: LocationCluster[],
    currentLocation: Location.LocationObject,
    destination?: { latitude: number; longitude: number },
    context?: string[]
  ): ParkingPrediction {
    const targetLocation = destination || currentLocation;

    if (patterns.length === 0 && clusters.length === 0) {
      return this.getDefaultPrediction(currentLocation);
    }

    // Calculate weighted centroid of top patterns/clusters
    let totalWeight = 0;
    let weightedLat = 0;
    let weightedLng = 0;
    const reasons: string[] = [];
    const alternatives: Array<{
      location: { latitude: number; longitude: number };
      confidence: number;
      distance: number;
    }> = [];

    // Process patterns
    patterns.slice(0, 5).forEach(pattern => {
      const weight = pattern.confidence * pattern.frequency;
      totalWeight += weight;
      weightedLat += pattern.location.latitude * weight;
      weightedLng += pattern.location.longitude * weight;

      if (pattern.frequency > 3) {
        reasons.push(`You've parked here ${pattern.frequency} times before`);
      }
      if (pattern.venue) {
        reasons.push(`Near ${pattern.venue}`);
      }
    });

    // Process clusters
    clusters.slice(0, 3).forEach(cluster => {
      const weight = cluster.successRate * Math.log(cluster.sessions + 1);
      totalWeight += weight;
      weightedLat += cluster.centroid.latitude * weight;
      weightedLng += cluster.centroid.longitude * weight;

      alternatives.push({
        location: cluster.centroid,
        confidence: cluster.successRate,
        distance: this.calculateDistance(cluster.centroid, targetLocation),
      });

      if (cluster.sessions > 5) {
        reasons.push(`High success rate area (${Math.round(cluster.successRate * 100)}%)`);
      }
    });

    const predictedLocation = {
      latitude: weightedLat / totalWeight,
      longitude: weightedLng / totalWeight,
    };

    const confidence = Math.min(1.0, totalWeight / 10);
    const suggestions = this.generateSuggestions(patterns, clusters, context);

    return {
      location: {
        ...predictedLocation,
        radius: this.calculatePredictionRadius(patterns, clusters),
      },
      confidence,
      reasons: reasons.slice(0, 3),
      alternativeSpots: alternatives
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 3),
      estimatedWalkTime: this.estimateWalkTime(predictedLocation, targetLocation),
      suggestions,
    };
  }

  /**
   * Calculate prediction radius based on data spread
   */
  private calculatePredictionRadius(patterns: ParkingPattern[], clusters: LocationCluster[]): number {
    if (patterns.length === 0 && clusters.length === 0) {
      return 500; // Default 500m radius
    }

    const distances: number[] = [];

    // Calculate variance in pattern locations
    if (patterns.length > 1) {
      for (let i = 0; i < patterns.length - 1; i++) {
        for (let j = i + 1; j < patterns.length; j++) {
          distances.push(this.calculateDistance(patterns[i].location, patterns[j].location));
        }
      }
    }

    // Add cluster radii
    clusters.forEach(cluster => {
      distances.push(cluster.radius);
    });

    if (distances.length === 0) {
      return 200;
    }

    const avgDistance = distances.reduce((sum, d) => sum + d, 0) / distances.length;
    return Math.max(100, Math.min(800, avgDistance)); // Between 100m and 800m
  }

  /**
   * Generate contextual suggestions
   */
  private generateSuggestions(
    patterns: ParkingPattern[],
    clusters: LocationCluster[],
    context?: string[]
  ): string[] {
    const suggestions: string[] = [];

    // Time-based suggestions
    const now = new Date();
    const hour = now.getHours();

    if (hour >= 7 && hour <= 9) {
      suggestions.push("Consider arriving 10 minutes early during morning rush");
    } else if (hour >= 17 && hour <= 19) {
      suggestions.push("Evening peak - try alternative routes for better spots");
    }

    // Pattern-based suggestions
    const recentPatterns = patterns.filter(p =>
      Date.now() - p.lastUsed < 7 * 24 * 60 * 60 * 1000 // Last 7 days
    );

    if (recentPatterns.length > 0) {
      const avgConfidence = recentPatterns.reduce((sum, p) => sum + p.confidence, 0) / recentPatterns.length;
      if (avgConfidence > 0.8) {
        suggestions.push("You have a strong parking pattern in this area");
      }
    }

    // Context-based suggestions
    if (context?.includes('work')) {
      suggestions.push("Check for employee parking discounts");
    } else if (context?.includes('shopping')) {
      suggestions.push("Look for validation opportunities at stores");
    }

    return suggestions.slice(0, 3);
  }

  /**
   * Start background learning process
   */
  private startBackgroundLearning() {
    // Clean up old patterns every hour
    setInterval(() => {
      this.cleanupOldPatterns();
    }, 60 * 60 * 1000);

    // Optimize clusters every 6 hours
    setInterval(() => {
      this.optimizeClusters();
    }, 6 * 60 * 60 * 1000);
  }

  /**
   * Clean up old and unused patterns
   */
  private async cleanupOldPatterns() {
    const cutoffDate = Date.now() - (90 * 24 * 60 * 60 * 1000); // 90 days
    const initialCount = this.patterns.length;

    this.patterns = this.patterns.filter(pattern => {
      // Keep if used recently
      if (pattern.lastUsed > cutoffDate) return true;

      // Keep if high frequency and confidence
      if (pattern.frequency >= 5 && pattern.confidence > 0.7) return true;

      return false;
    });

    if (this.patterns.length < initialCount) {
      await this.saveParkingData();
      analytics.logEvent('parking_patterns_cleaned', {
        removed: initialCount - this.patterns.length,
        remaining: this.patterns.length,
      });
    }
  }

  /**
   * Optimize location clusters
   */
  private async optimizeClusters() {
    // Remove clusters with very low success rates
    const initialCount = this.clusters.length;

    this.clusters = this.clusters.filter(cluster => {
      return cluster.successRate > 0.3 && cluster.sessions >= 2;
    });

    // Merge nearby clusters
    const mergeThreshold = 150; // 150 meters
    const toMerge: number[] = [];

    for (let i = 0; i < this.clusters.length - 1; i++) {
      if (toMerge.includes(i)) continue;

      for (let j = i + 1; j < this.clusters.length; j++) {
        if (toMerge.includes(j)) continue;

        const distance = this.calculateDistance(
          this.clusters[i].centroid,
          this.clusters[j].centroid
        );

        if (distance <= mergeThreshold) {
          // Merge j into i
          const clusterA = this.clusters[i];
          const clusterB = this.clusters[j];

          const totalSessions = clusterA.sessions + clusterB.sessions;
          const weightA = clusterA.sessions / totalSessions;
          const weightB = clusterB.sessions / totalSessions;

          clusterA.centroid.latitude =
            clusterA.centroid.latitude * weightA + clusterB.centroid.latitude * weightB;
          clusterA.centroid.longitude =
            clusterA.centroid.longitude * weightA + clusterB.centroid.longitude * weightB;
          clusterA.sessions = totalSessions;
          clusterA.successRate = (clusterA.successRate * weightA + clusterB.successRate * weightB);
          clusterA.radius = Math.max(clusterA.radius, clusterB.radius);

          toMerge.push(j);
        }
      }
    }

    // Remove merged clusters
    this.clusters = this.clusters.filter((_, index) => !toMerge.includes(index));

    if (this.clusters.length !== initialCount) {
      await this.saveClusters();
      analytics.logEvent('parking_clusters_optimized', {
        initial_count: initialCount,
        final_count: this.clusters.length,
        merged: toMerge.length,
      });
    }
  }

  // Storage methods
  private async saveParkingData() {
    await AsyncStorage.setItem(STORAGE_KEYS.PATTERNS, JSON.stringify(this.patterns));
  }

  private async loadParkingData() {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.PATTERNS);
    this.patterns = data ? JSON.parse(data) : [];
  }

  private async saveClusters() {
    await AsyncStorage.setItem(STORAGE_KEYS.CLUSTERS, JSON.stringify(this.clusters));
  }

  private async loadClusters() {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.CLUSTERS);
    this.clusters = data ? JSON.parse(data) : [];
  }

  private async loadBehavioralMetrics() {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.METRICS);
    this.metrics = data ? JSON.parse(data) : null;
  }

  private async updateBehavioralMetrics(session: any) {
    if (!this.metrics) {
      this.metrics = {
        avgSearchTime: session.searchDuration,
        preferredWalkDistance: session.walkDistance || 200,
        timePreferences: { early: 0, peak: 0, late: 0 },
        venueTypes: {},
        parkingSuccessRate: session.wasSuccessful ? 1 : 0,
        adaptabilityScore: 0.5,
      };
    } else {
      // Update metrics with exponential moving average
      const alpha = 0.1;
      this.metrics.avgSearchTime =
        this.metrics.avgSearchTime * (1 - alpha) + session.searchDuration * alpha;

      if (session.walkDistance) {
        this.metrics.preferredWalkDistance =
          this.metrics.preferredWalkDistance * (1 - alpha) + session.walkDistance * alpha;
      }

      // Update success rate
      this.metrics.parkingSuccessRate =
        this.metrics.parkingSuccessRate * (1 - alpha) + (session.wasSuccessful ? 1 : 0) * alpha;
    }

    await AsyncStorage.setItem(STORAGE_KEYS.METRICS, JSON.stringify(this.metrics));
  }

  // Utility methods
  private calculateDistance(
    coord1: { latitude: number; longitude: number },
    coord2: { latitude: number; longitude: number }
  ): number {
    const R = 6371e3;
    const φ1 = (coord1.latitude * Math.PI) / 180;
    const φ2 = (coord2.latitude * Math.PI) / 180;
    const Δφ = ((coord2.latitude - coord1.latitude) * Math.PI) / 180;
    const Δλ = ((coord2.longitude - coord1.longitude) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  private findNearbyClusters(location: { latitude: number; longitude: number }, radius: number): LocationCluster[] {
    return this.clusters.filter(cluster => {
      const distance = this.calculateDistance(cluster.centroid, location);
      return distance <= radius;
    });
  }

  private calculateInitialConfidence(session: any): number {
    let confidence = 0.5; // Base confidence

    if (session.wasSuccessful) confidence += 0.3;
    if (session.userSatisfaction && session.userSatisfaction >= 4) confidence += 0.2;
    if (session.searchDuration < 5) confidence += 0.2; // Quick find
    if (session.venue) confidence += 0.1; // Has venue context

    return Math.min(1.0, confidence);
  }

  private estimateWalkTime(from: { latitude: number; longitude: number }, to: { latitude: number; longitude: number }): number {
    const distance = this.calculateDistance(from, to);
    return Math.ceil(distance / 80); // 80 meters per minute walking speed
  }

  private generatePredictionCacheKey(
    location: Location.LocationObject,
    destination?: { latitude: number; longitude: number },
    context?: string[]
  ): string {
    const roundLat = Math.round(location.coords.latitude * 1000) / 1000;
    const roundLng = Math.round(location.coords.longitude * 1000) / 1000;
    const destKey = destination ? `${Math.round(destination.latitude * 1000)},${Math.round(destination.longitude * 1000)}` : '';
    const contextKey = context ? context.sort().join(',') : '';
    return `${roundLat},${roundLng}-${destKey}-${contextKey}`;
  }

  private getDefaultPrediction(location: Location.LocationObject): ParkingPrediction {
    return {
      location: {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        radius: 500,
      },
      confidence: 0.3,
      reasons: ['Based on general parking patterns'],
      alternativeSpots: [],
      estimatedWalkTime: 5,
      suggestions: ['Try nearby side streets', 'Look for public parking structures'],
    };
  }

  private calculateParkingEfficiency(): number {
    if (!this.metrics) return 0.5;

    const searchScore = Math.max(0, 1 - this.metrics.avgSearchTime / 20); // 20 min max
    const successScore = this.metrics.parkingSuccessRate;

    return (searchScore + successScore) / 2;
  }

  private getMostUsedSpots(limit: number): Array<{ location: { latitude: number; longitude: number }; usage: number }> {
    return this.clusters
      .sort((a, b) => b.sessions - a.sessions)
      .slice(0, limit)
      .map(cluster => ({
        location: cluster.centroid,
        usage: cluster.sessions,
      }));
  }

  private getTimePatterns(): Array<{ time: string; frequency: number }> {
    const timeMap: Record<number, number> = {};

    this.patterns.forEach(pattern => {
      const hour = Math.floor(pattern.timeOfDay / 60);
      timeMap[hour] = (timeMap[hour] || 0) + pattern.frequency;
    });

    return Object.entries(timeMap)
      .map(([hour, frequency]) => ({
        time: `${hour}:00`,
        frequency,
      }))
      .sort((a, b) => b.frequency - a.frequency);
  }

  private async generatePersonalizedSuggestions(): Promise<string[]> {
    const suggestions: string[] = [];

    if (!this.metrics) return suggestions;

    if (this.metrics.avgSearchTime > 10) {
      suggestions.push('Consider using parking apps to pre-book spots');
    }

    if (this.metrics.parkingSuccessRate < 0.7) {
      suggestions.push('Try exploring alternative parking areas');
    }

    if (this.patterns.length > 20) {
      suggestions.push('You have strong parking patterns - trust the AI predictions');
    }

    return suggestions;
  }

  private getEfficiencyRating(): string {
    const efficiency = this.calculateParkingEfficiency();

    if (efficiency >= 0.8) return 'Excellent';
    if (efficiency >= 0.6) return 'Good';
    if (efficiency >= 0.4) return 'Average';
    return 'Needs Improvement';
  }

  private calculateRecommendationScore(cluster: LocationCluster, patterns: ParkingPattern[]): number {
    let score = cluster.successRate * Math.log(cluster.sessions + 1);

    // Bonus for recent patterns
    patterns.forEach(pattern => {
      const recency = Math.max(0, 1 - (Date.now() - pattern.lastUsed) / (30 * 24 * 60 * 60 * 1000));
      score += pattern.confidence * recency;
    });

    return score;
  }

  private generateRecommendationReasons(cluster: LocationCluster, patterns: ParkingPattern[]): string[] {
    const reasons: string[] = [];

    if (cluster.successRate > 0.8) {
      reasons.push(`High success rate (${Math.round(cluster.successRate * 100)}%)`);
    }

    if (cluster.sessions > 10) {
      reasons.push(`You've used this area ${cluster.sessions} times`);
    }

    const recentPatterns = patterns.filter(p =>
      Date.now() - p.lastUsed < 7 * 24 * 60 * 60 * 1000
    );

    if (recentPatterns.length > 0) {
      reasons.push('Recently used location');
    }

    return reasons;
  }
}

export const smartParkingAI = new SmartParkingAI();
export default smartParkingAI;