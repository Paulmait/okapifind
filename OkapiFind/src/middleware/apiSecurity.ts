// @ts-nocheck
/**
 * API Security Middleware for OkapiFind
 * Provides comprehensive request validation, sanitization, and protection
 */

import { securityService, InputValidator } from '../services/security';
import { errorService, ErrorSeverity, ErrorCategory } from '../services/errorService';
import * as Crypto from 'expo-crypto';

interface ApiRequest {
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: any;
}

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

class ApiSecurityMiddleware {
  private static instance: ApiSecurityMiddleware;
  private csrfToken: string | null = null;
  private sessionToken: string | null = null;
  private requestQueue: Map<string, Promise<any>> = new Map();

  private constructor() {}

  static getInstance(): ApiSecurityMiddleware {
    if (!ApiSecurityMiddleware.instance) {
      ApiSecurityMiddleware.instance = new ApiSecurityMiddleware();
    }
    return ApiSecurityMiddleware.instance;
  }

  /**
   * Initialize middleware with security tokens
   */
  async initialize(sessionToken?: string): Promise<void> {
    this.sessionToken = sessionToken || null;
    this.csrfToken = await this.generateCSRFToken();
  }

  /**
   * Secure API request wrapper
   */
  async secureRequest<T = any>(request: ApiRequest): Promise<ApiResponse<T>> {
    try {
      // 1. Validate request URL
      if (!this.isValidUrl(request.url)) {
        throw new Error('Invalid request URL');
      }

      // 2. Check rate limiting
      const endpoint = this.extractEndpoint(request.url);
      const rateLimitOk = await securityService.checkRateLimit(endpoint);

      if (!rateLimitOk) {
        return {
          success: false,
          error: 'Rate limit exceeded. Please try again later.',
          code: 'RATE_LIMIT_EXCEEDED',
        };
      }

      // 3. Sanitize request body
      const sanitizedBody = await this.sanitizeRequestBody(request.body);

      // 4. Add security headers
      const secureHeaders = this.getSecureHeaders(request.headers);

      // 5. Deduplicate identical requests
      const requestKey = this.getRequestKey(request);
      if (this.requestQueue.has(requestKey)) {
        return await this.requestQueue.get(requestKey);
      }

      // 6. Make the request with timeout
      const requestPromise = this.executeRequest<T>({
        ...request,
        headers: secureHeaders,
        body: sanitizedBody,
      });

      this.requestQueue.set(requestKey, requestPromise);

      try {
        const response = await requestPromise;
        return response;
      } finally {
        this.requestQueue.delete(requestKey);
      }
    } catch (error) {
      errorService.logError(error, ErrorSeverity.HIGH, ErrorCategory.NETWORK, {
        action: 'secure_request',
        url: request.url,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Request failed',
        code: 'REQUEST_FAILED',
      };
    }
  }

  /**
   * Execute the actual network request
   */
  private async executeRequest<T>(request: ApiRequest): Promise<ApiResponse<T>> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    try {
      const response = await fetch(request.url, {
        method: request.method,
        headers: request.headers,
        body: request.body ? JSON.stringify(request.body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      // Check response status
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        // Handle specific error codes
        if (response.status === 401) {
          await this.handleUnauthorized();
        } else if (response.status === 429) {
          await this.handleRateLimit(response.headers);
        }

        return {
          success: false,
          error: errorData.message || `Request failed with status ${response.status}`,
          code: errorData.code || `HTTP_${response.status}`,
        };
      }

      const data = await response.json();

      // Validate response data
      if (!this.isValidResponse(data)) {
        throw new Error('Invalid response format');
      }

      return {
        success: true,
        data: data as T,
      };
    } catch (error: any) {
      clearTimeout(timeout);

      if (error.name === 'AbortError') {
        return {
          success: false,
          error: 'Request timeout',
          code: 'TIMEOUT',
        };
      }

      throw error;
    }
  }

  /**
   * Sanitize request body
   */
  private async sanitizeRequestBody(body: any): Promise<any> {
    if (!body) return undefined;

    if (typeof body === 'string') {
      return InputValidator.sanitizeText(body);
    }

    if (typeof body === 'object') {
      const sanitized: any = {};

      for (const [key, value] of Object.entries(body)) {
        // Skip prototype pollution attempts
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
          continue;
        }

        if (typeof value === 'string') {
          sanitized[key] = InputValidator.sanitizeText(value);
        } else if (typeof value === 'object' && value !== null) {
          sanitized[key] = await this.sanitizeRequestBody(value);
        } else if (typeof value === 'number' || typeof value === 'boolean') {
          sanitized[key] = value;
        }
      }

      return sanitized;
    }

    return body;
  }

  /**
   * Generate secure headers
   */
  private getSecureHeaders(customHeaders?: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      'X-Client-Version': '1.0.0',
      ...customHeaders,
    };

    // Add CSRF token if available
    if (this.csrfToken) {
      headers['X-CSRF-Token'] = this.csrfToken;
    }

    // Add session token if available
    if (this.sessionToken) {
      headers['Authorization'] = `Bearer ${this.sessionToken}`;
    }

    return headers;
  }

  /**
   * Validate URL
   */
  private isValidUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);

      // Only allow HTTPS in production
      if (!__DEV__ && urlObj.protocol !== 'https:') {
        return false;
      }

      // Whitelist allowed domains
      const allowedDomains = [
        'okapifind.com',
        'api.okapifind.com',
        'supabase.co',
        'googleapis.com',
        'firebaseapp.com',
        'firebaseio.com',
      ];

      const isAllowed = allowedDomains.some(domain =>
        urlObj.hostname.includes(domain) ||
        urlObj.hostname === 'localhost'
      );

      return isAllowed;
    } catch {
      return false;
    }
  }

  /**
   * Validate response format
   */
  private isValidResponse(data: any): boolean {
    if (!data || typeof data !== 'object') {
      return false;
    }

    // Check for suspicious patterns
    const suspiciousKeys = ['__proto__', 'constructor', 'prototype'];
    const hasSuspiciousKeys = suspiciousKeys.some(key => key in data);

    return !hasSuspiciousKeys;
  }

  /**
   * Extract endpoint from URL
   */
  private extractEndpoint(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.pathname;
    } catch {
      return 'unknown';
    }
  }

  /**
   * Generate request key for deduplication
   */
  private getRequestKey(request: ApiRequest): string {
    const key = `${request.method}:${request.url}:${JSON.stringify(request.body || {})}`;
    return key;
  }

  /**
   * Generate CSRF token
   */
  private async generateCSRFToken(): Promise<string> {
    const bytes = await Crypto.getRandomBytesAsync(32);
    return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Handle unauthorized responses
   */
  private async handleUnauthorized(): Promise<void> {
    this.sessionToken = null;
    this.csrfToken = await this.generateCSRFToken();

    errorService.logError(
      new Error('Unauthorized access'),
      ErrorSeverity.HIGH,
      ErrorCategory.AUTH,
      { action: 'handle_unauthorized' }
    );
  }

  /**
   * Handle rate limit responses
   */
  private async handleRateLimit(headers: Headers): Promise<void> {
    const retryAfter = headers.get('Retry-After');
    const rateLimitRemaining = headers.get('X-RateLimit-Remaining');
    const rateLimitReset = headers.get('X-RateLimit-Reset');

    errorService.logWarning('Rate limit hit', {
      retryAfter,
      rateLimitRemaining,
      rateLimitReset,
    });
  }

  /**
   * Update session token
   */
  updateSessionToken(token: string): void {
    this.sessionToken = token;
  }

  /**
   * Clear security tokens
   */
  clearTokens(): void {
    this.sessionToken = null;
    this.csrfToken = null;
  }
}

export const apiSecurity = ApiSecurityMiddleware.getInstance();

/**
 * Secure fetch wrapper
 */
export async function secureFetch<T = any>(
  url: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const request: ApiRequest = {
    url,
    method: options.method || 'GET',
    headers: options.headers as Record<string, string>,
    body: options.body ? JSON.parse(options.body as string) : undefined,
  };

  return apiSecurity.secureRequest<T>(request);
}

/**
 * Secure API endpoints
 */
export const secureApi = {
  async get<T>(url: string, headers?: Record<string, string>): Promise<ApiResponse<T>> {
    return apiSecurity.secureRequest<T>({ url, method: 'GET', headers });
  },

  async post<T>(url: string, body: any, headers?: Record<string, string>): Promise<ApiResponse<T>> {
    return apiSecurity.secureRequest<T>({ url, method: 'POST', body, headers });
  },

  async put<T>(url: string, body: any, headers?: Record<string, string>): Promise<ApiResponse<T>> {
    return apiSecurity.secureRequest<T>({ url, method: 'PUT', body, headers });
  },

  async delete<T>(url: string, headers?: Record<string, string>): Promise<ApiResponse<T>> {
    return apiSecurity.secureRequest<T>({ url, method: 'DELETE', headers });
  },

  async patch<T>(url: string, body: any, headers?: Record<string, string>): Promise<ApiResponse<T>> {
    return apiSecurity.secureRequest<T>({ url, method: 'PATCH', body, headers });
  },
};