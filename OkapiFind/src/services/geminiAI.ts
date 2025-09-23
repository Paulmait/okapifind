/**
 * Google Gemini AI Integration for Smart Parking
 * Optimized for parking-specific use cases
 */

import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { Platform } from 'react-native';

// Models we'll use
const MODELS = {
  FLASH: 'gemini-1.5-flash', // Fast, cheap, perfect for real-time
  PRO: 'gemini-1.5-pro', // Advanced reasoning for complex queries
  NANO: 'gemini-nano', // On-device (Android 14+)
};

interface ParkingContext {
  location: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  time: Date;
  weather?: string;
  userHistory?: string[];
  nearbyEvents?: string[];
}

interface ParkingPrediction {
  confidence: number;
  suggestion: string;
  alternatives: string[];
  estimatedTime: number;
  difficulty: 'easy' | 'moderate' | 'hard';
}

class GeminiAIService {
  private static instance: GeminiAIService;
  private genAI: GoogleGenerativeAI | null = null;
  private apiKey: string = '';
  private isInitialized = false;

  static getInstance(): GeminiAIService {
    if (!GeminiAIService.instance) {
      GeminiAIService.instance = new GeminiAIService();
    }
    return GeminiAIService.instance;
  }

  /**
   * Initialize Gemini AI with API key
   */
  async initialize(): Promise<void> {
    try {
      // Get API key from secure storage
      this.apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';

      if (!this.apiKey) {
        console.error('Gemini API key not found');
        return;
      }

      this.genAI = new GoogleGenerativeAI(this.apiKey);
      this.isInitialized = true;

      // Pre-load model for faster first response
      await this.warmupModel();
    } catch (error) {
      console.error('Failed to initialize Gemini AI:', error);
    }
  }

  /**
   * Warm up the model for faster responses
   */
  private async warmupModel(): Promise<void> {
    try {
      const model = this.genAI!.getGenerativeModel({
        model: MODELS.FLASH,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 100,
        },
      });

      await model.generateContent('Hello');
    } catch (error) {
      console.error('Model warmup failed:', error);
    }
  }

  /**
   * Get smart parking suggestions using Gemini
   */
  async getParkingSuggestion(context: ParkingContext): Promise<ParkingPrediction> {
    if (!this.isInitialized || !this.genAI) {
      throw new Error('Gemini AI not initialized');
    }

    try {
      const model = this.genAI.getGenerativeModel({
        model: MODELS.FLASH,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 200,
          topK: 10,
          topP: 0.8,
        },
        safetySettings: [
          {
            category: HarmCategory.HARM_CATEGORY_HARASSMENT,
            threshold: HarmBlockThreshold.BLOCK_NONE,
          },
        ],
      });

      const prompt = this.buildParkingPrompt(context);
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      return this.parseParkingResponse(text);
    } catch (error) {
      console.error('Gemini suggestion failed:', error);
      return this.getFallbackSuggestion(context);
    }
  }

  /**
   * Analyze parking sign image using Gemini Vision
   */
  async analyzeParkingSign(imageBase64: string): Promise<{
    restrictions: string[];
    allowedHours: string;
    rate: string | null;
    warnings: string[];
  }> {
    if (!this.isInitialized || !this.genAI) {
      throw new Error('Gemini AI not initialized');
    }

    try {
      const model = this.genAI.getGenerativeModel({
        model: MODELS.PRO // Use Pro for better image understanding
      });

      const prompt = `Analyze this parking sign image and extract:
        1. Parking restrictions (e.g., "No parking 8am-6pm Mon-Fri")
        2. Allowed parking hours
        3. Parking rate if visible
        4. Any warnings or special conditions

        Format as JSON with keys: restrictions, allowedHours, rate, warnings`;

      const image = {
        inlineData: {
          data: imageBase64,
          mimeType: 'image/jpeg',
        },
      };

      const result = await model.generateContent([prompt, image]);
      const response = await result.response;
      const text = response.text();

      // Parse JSON response
      try {
        return JSON.parse(text);
      } catch {
        // Fallback parsing if not valid JSON
        return {
          restrictions: [text],
          allowedHours: 'Check sign',
          rate: null,
          warnings: [],
        };
      }
    } catch (error) {
      console.error('Sign analysis failed:', error);
      return {
        restrictions: ['Unable to analyze sign'],
        allowedHours: 'Unknown',
        rate: null,
        warnings: ['Please verify sign manually'],
      };
    }
  }

  /**
   * Get natural language parking assistant response
   */
  async askParkingAssistant(question: string, context?: ParkingContext): Promise<string> {
    if (!this.isInitialized || !this.genAI) {
      throw new Error('Gemini AI not initialized');
    }

    try {
      const model = this.genAI.getGenerativeModel({
        model: MODELS.FLASH,
        generationConfig: {
          temperature: 0.8,
          maxOutputTokens: 300,
        },
      });

      const contextInfo = context ? `
        Current location: ${context.location.address || `${context.location.latitude}, ${context.location.longitude}`}
        Time: ${context.time.toLocaleString()}
        Weather: ${context.weather || 'Unknown'}
      ` : '';

      const prompt = `You are OkapiFind, a helpful parking assistant. Answer this question concisely and helpfully:

        ${contextInfo}

        User question: ${question}

        Keep response under 3 sentences and be specific about parking.`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error('Assistant query failed:', error);
      return "I'm having trouble processing that right now. Please try again.";
    }
  }

  /**
   * Predict parking availability using Gemini
   */
  async predictAvailability(
    location: { latitude: number; longitude: number },
    targetTime: Date
  ): Promise<{
    availability: 'high' | 'medium' | 'low';
    confidence: number;
    bestTime: string;
    tips: string[];
  }> {
    if (!this.isInitialized || !this.genAI) {
      return this.getFallbackAvailability();
    }

    try {
      const model = this.genAI.getGenerativeModel({
        model: MODELS.FLASH,
        generationConfig: {
          temperature: 0.6,
          maxOutputTokens: 150,
        },
      });

      const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][targetTime.getDay()];
      const hour = targetTime.getHours();

      const prompt = `Predict parking availability for:
        Location: ${location.latitude}, ${location.longitude}
        Day: ${dayOfWeek}
        Time: ${hour}:00

        Consider typical patterns for this time and day.
        Respond with JSON: {availability: "high/medium/low", confidence: 0-1, bestTime: "suggestion", tips: ["tip1", "tip2"]}`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      try {
        return JSON.parse(text);
      } catch {
        return this.getFallbackAvailability();
      }
    } catch (error) {
      console.error('Availability prediction failed:', error);
      return this.getFallbackAvailability();
    }
  }

  /**
   * Use on-device Gemini Nano for offline predictions (Android 14+)
   */
  async getOfflinePrediction(context: ParkingContext): Promise<ParkingPrediction | null> {
    if (Platform.OS !== 'android' || Platform.Version < 34) {
      return null; // Gemini Nano requires Android 14+
    }

    try {
      // This would use the on-device Gemini Nano API when available
      // For now, return cached predictions
      const cachedPredictions = await AsyncStorage.getItem('offline_predictions');
      if (cachedPredictions) {
        const predictions = JSON.parse(cachedPredictions);
        // Find best matching cached prediction based on location/time
        return this.findBestCachedPrediction(predictions, context);
      }
      return null;
    } catch (error) {
      console.error('Offline prediction failed:', error);
      return null;
    }
  }

  // Helper methods

  private buildParkingPrompt(context: ParkingContext): string {
    const timeStr = context.time.toLocaleTimeString();
    const dayStr = context.time.toLocaleDateString();

    return `As a parking assistant, suggest the best parking strategy for:
      Location: ${context.location.address || `${context.location.latitude}, ${context.location.longitude}`}
      Time: ${timeStr} on ${dayStr}
      Weather: ${context.weather || 'Clear'}
      ${context.nearbyEvents?.length ? `Events nearby: ${context.nearbyEvents.join(', ')}` : ''}
      ${context.userHistory?.length ? `User typically parks at: ${context.userHistory.slice(0, 3).join(', ')}` : ''}

      Provide a JSON response with:
      - confidence: 0-1 score
      - suggestion: main recommendation
      - alternatives: 2-3 backup options
      - estimatedTime: minutes to find parking
      - difficulty: easy/moderate/hard`;
  }

  private parseParkingResponse(text: string): ParkingPrediction {
    try {
      // Try to parse as JSON first
      const cleaned = text.replace(/```json\n?|\n?```/g, '').trim();
      return JSON.parse(cleaned);
    } catch {
      // Fallback to text parsing
      return {
        confidence: 0.7,
        suggestion: text.split('\n')[0] || 'Check nearby streets',
        alternatives: ['Look for garage parking', 'Try side streets'],
        estimatedTime: 5,
        difficulty: 'moderate',
      };
    }
  }

  private getFallbackSuggestion(context: ParkingContext): ParkingPrediction {
    const hour = context.time.getHours();
    const isWeekend = context.time.getDay() === 0 || context.time.getDay() === 6;

    let difficulty: 'easy' | 'moderate' | 'hard' = 'moderate';
    let estimatedTime = 5;

    if (hour >= 9 && hour <= 17 && !isWeekend) {
      difficulty = 'hard';
      estimatedTime = 10;
    } else if (hour >= 22 || hour <= 6) {
      difficulty = 'easy';
      estimatedTime = 2;
    }

    return {
      confidence: 0.6,
      suggestion: 'Check nearby street parking',
      alternatives: [
        'Look for parking garages',
        'Try residential side streets',
        'Consider park & ride options',
      ],
      estimatedTime,
      difficulty,
    };
  }

  private getFallbackAvailability() {
    return {
      availability: 'medium' as const,
      confidence: 0.5,
      bestTime: 'Try early morning or after 7pm',
      tips: [
        'Check for street cleaning schedules',
        'Look for parking garages as backup',
        'Consider public transit if available',
      ],
    };
  }

  private findBestCachedPrediction(
    predictions: any[],
    context: ParkingContext
  ): ParkingPrediction | null {
    // Simple distance-based matching for cached predictions
    const maxDistance = 0.5; // km

    const nearby = predictions.filter(p => {
      const distance = this.calculateDistance(
        context.location.latitude,
        context.location.longitude,
        p.location.latitude,
        p.location.longitude
      );
      return distance <= maxDistance;
    });

    return nearby[0] || null;
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }
}

export default GeminiAIService.getInstance();