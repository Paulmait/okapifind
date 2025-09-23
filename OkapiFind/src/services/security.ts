import AsyncStorage from '@react-native-async-storage/async-storage';
// import { Alert } from 'react-native';

// Rate limiting
interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  blockDurationMs: number;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
  isBlocked: boolean;
  blockUntil?: number;
}

class RateLimiter {
  private limits: Map<string, RateLimitEntry> = new Map();
  private configs: Map<string, RateLimitConfig> = new Map();

  constructor() {
    // Default configurations
    this.setConfig('api', { maxRequests: 100, windowMs: 60000, blockDurationMs: 300000 }); // 100 req/min
    this.setConfig('auth', { maxRequests: 5, windowMs: 300000, blockDurationMs: 900000 }); // 5 req/5min
    this.setConfig('location', { maxRequests: 30, windowMs: 60000, blockDurationMs: 60000 }); // 30 req/min
  }

  public setConfig(endpoint: string, config: RateLimitConfig): void {
    this.configs.set(endpoint, config);
  }

  public async checkLimit(endpoint: string, identifier: string = 'default'): Promise<boolean> {
    const key = `${endpoint}:${identifier}`;
    const config = this.configs.get(endpoint);

    if (!config) {
      console.warn(`No rate limit config found for endpoint: ${endpoint}`);
      return true;
    }

    const now = Date.now();
    const entry = this.limits.get(key) || { count: 0, resetTime: now + config.windowMs, isBlocked: false };

    // Check if still blocked
    if (entry.isBlocked && entry.blockUntil && now < entry.blockUntil) {
      return false;
    }

    // Reset window if expired
    if (now > entry.resetTime) {
      entry.count = 0;
      entry.resetTime = now + config.windowMs;
      entry.isBlocked = false;
      delete entry.blockUntil;
    }

    // Increment count
    entry.count++;

    // Check if limit exceeded
    if (entry.count > config.maxRequests) {
      entry.isBlocked = true;
      entry.blockUntil = now + config.blockDurationMs;
      this.limits.set(key, entry);

      // Log security event
      console.warn(`Rate limit exceeded for ${endpoint} by ${identifier}`);
      await this.logSecurityEvent('rate_limit_exceeded', {
        endpoint,
        identifier,
        count: entry.count,
        maxRequests: config.maxRequests,
      });

      return false;
    }

    this.limits.set(key, entry);
    return true;
  }

  public getRemainingRequests(endpoint: string, identifier: string = 'default'): number {
    const key = `${endpoint}:${identifier}`;
    const config = this.configs.get(endpoint);
    const entry = this.limits.get(key);

    if (!config || !entry) return -1;

    return Math.max(0, config.maxRequests - entry.count);
  }

  private async logSecurityEvent(type: string, data: any): Promise<void> {
    try {
      const event = {
        type,
        timestamp: new Date().toISOString(),
        data,
      };

      const events = await this.getSecurityEvents();
      events.push(event);

      // Keep only last 100 events
      if (events.length > 100) {
        events.splice(0, events.length - 100);
      }

      await AsyncStorage.setItem('security_events', JSON.stringify(events));
    } catch (error) {
      console.error('Failed to log security event:', error);
    }
  }

  private async getSecurityEvents(): Promise<any[]> {
    try {
      const events = await AsyncStorage.getItem('security_events');
      return events ? JSON.parse(events) : [];
    } catch (error) {
      console.error('Failed to get security events:', error);
      return [];
    }
  }
}

// Input validation and sanitization
export class InputValidator {
  // Email validation
  public static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  }

  // Phone number validation
  public static isValidPhoneNumber(phone: string): boolean {
    const phoneRegex = /^\+?[\d\s\-\(\)]+$/;
    return phoneRegex.test(phone.trim()) && phone.replace(/\D/g, '').length >= 10;
  }

  // Password strength validation
  public static validatePassword(password: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  // Sanitize text input
  public static sanitizeText(input: string): string {
    return input
      .trim()
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
      .replace(/javascript:/gi, '') // Remove javascript: URLs
      .replace(/on\w+\s*=/gi, '') // Remove event handlers
      .substring(0, 1000); // Limit length
  }

  // Sanitize search query
  public static sanitizeSearchQuery(query: string): string {
    return query
      .trim()
      .replace(/[<>\"'&]/g, '') // Remove HTML special chars
      .replace(/\s+/g, ' ') // Normalize whitespace
      .substring(0, 100); // Limit length
  }

  // Validate coordinates
  public static isValidCoordinates(lat: number, lng: number): boolean {
    return (
      typeof lat === 'number' &&
      typeof lng === 'number' &&
      lat >= -90 &&
      lat <= 90 &&
      lng >= -180 &&
      lng <= 180 &&
      !isNaN(lat) &&
      !isNaN(lng)
    );
  }

  // Validate URL
  public static isValidUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      return ['http:', 'https:'].includes(urlObj.protocol);
    } catch {
      return false;
    }
  }
}

// Security headers and CORS configuration
export class SecurityHeaders {
  public static getSecureHeaders(): Record<string, string> {
    return {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';",
    };
  }

  public static getCorsConfig() {
    return {
      origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
        const allowedOrigins = [
          'https://api.okapifind.com',
          'https://maps.googleapis.com',
          'https://firebaseapp.com',
        ];

        if (!origin || allowedOrigins.some(allowed => origin.includes(allowed))) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
      optionsSuccessStatus: 200,
    };
  }
}

// API versioning
export class ApiVersioning {
  private static readonly CURRENT_VERSION = 'v1';
  private static readonly SUPPORTED_VERSIONS = ['v1'];

  public static validateApiVersion(version: string): boolean {
    return this.SUPPORTED_VERSIONS.includes(version);
  }

  public static getCurrentVersion(): string {
    return this.CURRENT_VERSION;
  }

  public static getSupportedVersions(): string[] {
    return [...this.SUPPORTED_VERSIONS];
  }

  public static getVersionedUrl(baseUrl: string, endpoint: string, version?: string): string {
    const apiVersion = version || this.CURRENT_VERSION;
    return `${baseUrl}/api/${apiVersion}${endpoint}`;
  }
}

// Main security service
export class SecurityService {
  private rateLimiter: RateLimiter;

  constructor() {
    this.rateLimiter = new RateLimiter();
  }

  public async checkRateLimit(endpoint: string, identifier?: string): Promise<boolean> {
    return this.rateLimiter.checkLimit(endpoint, identifier);
  }

  public getRemainingRequests(endpoint: string, identifier?: string): number {
    return this.rateLimiter.getRemainingRequests(endpoint, identifier);
  }

  public async validateAndSanitizeInput(data: any, rules: ValidationRules): Promise<ValidationResult> {
    const errors: string[] = [];
    const sanitizedData: any = {};

    for (const [field, rule] of Object.entries(rules)) {
      const value = data[field];

      // Check required fields
      if (rule.required && (value === undefined || value === null || value === '')) {
        errors.push(`${field} is required`);
        continue;
      }

      if (value === undefined || value === null) {
        continue;
      }

      // Type validation
      if (rule.type === 'email' && !InputValidator.isValidEmail(value)) {
        errors.push(`${field} must be a valid email address`);
        continue;
      }

      if (rule.type === 'phone' && !InputValidator.isValidPhoneNumber(value)) {
        errors.push(`${field} must be a valid phone number`);
        continue;
      }

      if (rule.type === 'url' && !InputValidator.isValidUrl(value)) {
        errors.push(`${field} must be a valid URL`);
        continue;
      }

      if (rule.type === 'coordinates') {
        if (!value.lat || !value.lng || !InputValidator.isValidCoordinates(value.lat, value.lng)) {
          errors.push(`${field} must contain valid coordinates`);
          continue;
        }
      }

      // Length validation
      if (rule.minLength && value.length < rule.minLength) {
        errors.push(`${field} must be at least ${rule.minLength} characters long`);
        continue;
      }

      if (rule.maxLength && value.length > rule.maxLength) {
        errors.push(`${field} must be no more than ${rule.maxLength} characters long`);
        continue;
      }

      // Sanitize based on type
      if (rule.type === 'text') {
        sanitizedData[field] = InputValidator.sanitizeText(value);
      } else if (rule.type === 'search') {
        sanitizedData[field] = InputValidator.sanitizeSearchQuery(value);
      } else {
        sanitizedData[field] = value;
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      data: sanitizedData,
    };
  }

  public async detectSuspiciousActivity(userId: string, activity: string): Promise<boolean> {
    // Implement suspicious activity detection
    const suspiciousPatterns = [
      'rapid_requests',
      'invalid_coordinates',
      'malformed_data',
      'unauthorized_access',
    ];

    // This would typically check against patterns in user behavior
    // For now, we'll implement basic detection

    if (suspiciousPatterns.some(pattern => activity.includes(pattern))) {
      await this.logSecurityEvent('suspicious_activity', {
        userId,
        activity,
        timestamp: new Date().toISOString(),
      });

      return true;
    }

    return false;
  }

  private async logSecurityEvent(type: string, data: any): Promise<void> {
    try {
      const event = {
        type,
        timestamp: new Date().toISOString(),
        data,
      };

      console.warn('Security Event:', event);

      // In production, this would be sent to a security monitoring service
    } catch (error) {
      console.error('Failed to log security event:', error);
    }
  }
}

// Types
interface ValidationRule {
  required?: boolean;
  type?: 'text' | 'email' | 'phone' | 'url' | 'coordinates' | 'search';
  minLength?: number;
  maxLength?: number;
}

interface ValidationRules {
  [field: string]: ValidationRule;
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  data: any;
}

// Export singleton instance
export const securityService = new SecurityService();
export const rateLimiter = new RateLimiter();