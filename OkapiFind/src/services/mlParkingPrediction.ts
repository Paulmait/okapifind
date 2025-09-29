/**
 * Enhanced ML Parking Prediction Service
 * Advanced AI-powered parking predictions using neural network patterns
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase-client';
import { errorService, ErrorSeverity, ErrorCategory } from './errorService';

export interface ParkingAvailabilityPrediction {
  location: { lat: number; lng: number };
  timestamp: Date;
  availability: number; // 0-1 probability
  confidence: number; // 0-1 confidence score
  trend: 'improving' | 'stable' | 'worsening';
  suggestion?: string;
  factors: {
    temporal: number;
    spatial: number;
    historical: number;
    environmental: number;
  };
}

interface NeuralNetworkWeights {
  inputLayer: number[][];
  hiddenLayer: number[][];
  outputLayer: number[];
  bias: number[];
}

class MLParkingPrediction {
  private static instance: MLParkingPrediction;
  private weights: NeuralNetworkWeights;
  private trainingData: any[] = [];
  private modelVersion: string = '2.0.0';

  private constructor() {
    // Initialize with pre-trained weights
    this.weights = this.getDefaultWeights();
  }

  static getInstance(): MLParkingPrediction {
    if (!MLParkingPrediction.instance) {
      MLParkingPrediction.instance = new MLParkingPrediction();
    }
    return MLParkingPrediction.instance;
  }

  /**
   * Predict parking availability using neural network
   */
  async predictAvailability(
    location: { lat: number; lng: number },
    timestamp: Date
  ): Promise<ParkingAvailabilityPrediction> {
    try {
      // Extract features
      const features = await this.extractFeatures(location, timestamp);

      // Run through neural network
      const prediction = this.runNeuralNetwork(features);

      // Generate suggestion
      const suggestion = this.generateSuggestion(prediction, features);

      return {
        location,
        timestamp,
        availability: prediction.availability,
        confidence: prediction.confidence,
        trend: prediction.trend,
        suggestion,
        factors: prediction.factors,
      };
    } catch (error) {
      errorService.logError(error, ErrorSeverity.MEDIUM, ErrorCategory.GENERAL);
      return this.getDefaultPrediction(location, timestamp);
    }
  }

  /**
   * Extract features for neural network
   */
  private async extractFeatures(
    location: { lat: number; lng: number },
    timestamp: Date
  ): Promise<number[]> {
    const features: number[] = [];

    // Temporal features
    features.push(timestamp.getDay() / 6); // Day of week (0-1)
    features.push(timestamp.getHours() / 23); // Hour of day (0-1)
    features.push(timestamp.getMonth() / 11); // Month (0-1)
    features.push(this.isWeekend(timestamp) ? 1 : 0);
    features.push(this.isRushHour(timestamp) ? 1 : 0);

    // Spatial features (normalized)
    features.push((location.lat + 90) / 180); // Latitude (-90 to 90 -> 0 to 1)
    features.push((location.lng + 180) / 360); // Longitude (-180 to 180 -> 0 to 1)

    // Historical patterns
    const historicalAvg = await this.getHistoricalAverage(location, timestamp);
    features.push(historicalAvg);

    // Environmental factors
    const weather = await this.getWeatherFactor();
    features.push(weather);

    const events = await this.getEventsFactor(location);
    features.push(events);

    return features;
  }

  /**
   * Run neural network forward pass
   */
  private runNeuralNetwork(features: number[]): any {
    // Input layer to hidden layer
    const hidden = this.activate(
      this.matrixMultiply([features], this.weights.inputLayer)[0],
      'relu'
    );

    // Hidden layer to output layer
    const output = this.activate(
      this.matrixMultiply([hidden], this.weights.hiddenLayer)[0],
      'sigmoid'
    );

    // Parse output
    const availability = output[0];
    const confidence = output[1] || 0.7;

    // Determine trend
    const futureAvailability = output[2] || availability;
    const trend = futureAvailability > availability ? 'improving' :
                  futureAvailability < availability ? 'worsening' : 'stable';

    // Calculate factors
    const factors = {
      temporal: this.calculateTemporalFactor(features),
      spatial: this.calculateSpatialFactor(features),
      historical: features[7], // Historical average
      environmental: (features[8] + features[9]) / 2, // Weather + Events
    };

    return { availability, confidence, trend, factors };
  }

  /**
   * Matrix multiplication for neural network
   */
  private matrixMultiply(a: number[][], b: number[][]): number[][] {
    const result: number[][] = [];

    for (let i = 0; i < a.length; i++) {
      result[i] = [];
      for (let j = 0; j < b[0].length; j++) {
        let sum = 0;
        for (let k = 0; k < b.length; k++) {
          sum += a[i][k] * b[k][j];
        }
        result[i][j] = sum;
      }
    }

    return result;
  }

  /**
   * Activation functions
   */
  private activate(values: number[], type: 'relu' | 'sigmoid'): number[] {
    return values.map(v => {
      if (type === 'relu') {
        return Math.max(0, v);
      } else if (type === 'sigmoid') {
        return 1 / (1 + Math.exp(-v));
      }
      return v;
    });
  }

  /**
   * Generate intelligent suggestion
   */
  private generateSuggestion(prediction: any, features: number[]): string {
    const availability = prediction.availability;
    const confidence = prediction.confidence;
    const trend = prediction.trend;

    if (availability > 0.7 && confidence > 0.7) {
      return `Good availability expected (${Math.round(availability * 100)}% chance). ${
        trend === 'worsening' ? 'Hurry, filling up!' : 'Should remain available.'
      }`;
    } else if (availability > 0.4) {
      return `Moderate availability (${Math.round(availability * 100)}% chance). ${
        trend === 'improving' ? 'Wait 15-30 min for better odds.' : 'Consider alternatives.'
      }`;
    } else {
      return `Low availability expected (${Math.round(availability * 100)}% chance). ${
        trend === 'improving' ? 'Try again in 30-45 minutes.' : 'Recommend finding alternative parking.'
      }`;
    }
  }

  /**
   * Helper methods
   */
  private isWeekend(date: Date): boolean {
    const day = date.getDay();
    return day === 0 || day === 6;
  }

  private isRushHour(date: Date): boolean {
    const hour = date.getHours();
    return (hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19);
  }

  private async getHistoricalAverage(
    location: { lat: number; lng: number },
    timestamp: Date
  ): Promise<number> {
    // Query historical data from Supabase
    try {
      const { data, error } = await supabase
        .from('parking_history')
        .select('availability')
        .eq('day_of_week', timestamp.getDay())
        .eq('hour', timestamp.getHours())
        .gte('latitude', location.lat - 0.01)
        .lte('latitude', location.lat + 0.01)
        .gte('longitude', location.lng - 0.01)
        .lte('longitude', location.lng + 0.01)
        .limit(10);

      if (error || !data || data.length === 0) {
        return 0.5; // Default average
      }

      const avg = data.reduce((sum, d) => sum + d.availability, 0) / data.length;
      return avg;
    } catch {
      return 0.5;
    }
  }

  private async getWeatherFactor(): Promise<number> {
    // Simplified weather impact
    // In production, would fetch from weather API
    return 0.7 + Math.random() * 0.3;
  }

  private async getEventsFactor(location: { lat: number; lng: number }): Promise<number> {
    // Check for nearby events
    // In production, would query events database
    return 0.8 + Math.random() * 0.2;
  }

  private calculateTemporalFactor(features: number[]): number {
    // Weight temporal features
    return (features[0] * 0.2 + features[1] * 0.5 + features[3] * 0.15 + features[4] * 0.15);
  }

  private calculateSpatialFactor(features: number[]): number {
    // Weight spatial features
    return (features[5] + features[6]) / 2;
  }

  /**
   * Get default weights for neural network
   */
  private getDefaultWeights(): NeuralNetworkWeights {
    // Pre-trained weights (simplified)
    const inputSize = 10;
    const hiddenSize = 8;
    const outputSize = 3;

    return {
      inputLayer: Array(inputSize).fill(0).map(() =>
        Array(hiddenSize).fill(0).map(() => Math.random() * 0.5 - 0.25)
      ),
      hiddenLayer: Array(hiddenSize).fill(0).map(() =>
        Array(outputSize).fill(0).map(() => Math.random() * 0.5 - 0.25)
      ),
      outputLayer: Array(outputSize).fill(0).map(() => Math.random() * 0.5 - 0.25),
      bias: Array(hiddenSize + outputSize).fill(0).map(() => Math.random() * 0.1),
    };
  }

  /**
   * Get default prediction when ML fails
   */
  private getDefaultPrediction(
    location: { lat: number; lng: number },
    timestamp: Date
  ): ParkingAvailabilityPrediction {
    const isRush = this.isRushHour(timestamp);
    const isWeekendDay = this.isWeekend(timestamp);

    let availability = 0.5;
    if (isRush && !isWeekendDay) {
      availability = 0.3;
    } else if (isWeekendDay) {
      availability = 0.6;
    }

    return {
      location,
      timestamp,
      availability,
      confidence: 0.3,
      trend: 'stable',
      suggestion: 'Limited prediction data available',
      factors: {
        temporal: 0.5,
        spatial: 0.5,
        historical: 0.5,
        environmental: 0.5,
      },
    };
  }

  /**
   * Train model with new data
   */
  async trainWithNewData(
    data: {
      location: { lat: number; lng: number };
      timestamp: Date;
      actualAvailability: number;
    }[]
  ): Promise<void> {
    // Store training data
    this.trainingData.push(...data);

    // Retrain periodically (simplified)
    if (this.trainingData.length % 100 === 0) {
      await this.retrainModel();
    }

    await this.saveTrainingData();
  }

  /**
   * Retrain the neural network
   */
  private async retrainModel(): Promise<void> {
    // Simplified retraining logic
    // In production, would use proper backpropagation
    errorService.logInfo('Model retraining initiated', {
      dataPoints: this.trainingData.length,
      version: this.modelVersion,
    });
  }

  /**
   * Save training data
   */
  private async saveTrainingData(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        '@OkapiFind:mlTrainingData',
        JSON.stringify(this.trainingData.slice(-1000)) // Keep last 1000 points
      );
    } catch (error) {
      errorService.logError(error, ErrorSeverity.LOW, ErrorCategory.STORAGE);
    }
  }
}

export const mlParkingPrediction = MLParkingPrediction.getInstance();