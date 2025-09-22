import { Alert } from 'react-native';
import { securityService, SecurityHeaders, ApiVersioning, InputValidator } from './security';

interface ApiRequestConfig {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  endpoint: string;
  data?: any;
  headers?: Record<string, string>;
  timeout?: number;
  requireAuth?: boolean;
  validateInput?: boolean;
  retries?: number;
  version?: string;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode?: number;
  headers?: Record<string, string>;
}

class SecureApiService {
  private baseUrl: string;
  private defaultTimeout: number = 30000;
  private maxRetries: number = 3;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
  }

  public async makeRequest<T>(config: ApiRequestConfig): Promise<ApiResponse<T>> {
    try {
      // Check rate limit
      const allowed = await securityService.checkRateLimit('api', config.endpoint);
      if (!allowed) {
        return {
          success: false,
          error: 'Rate limit exceeded. Please try again later.',
          statusCode: 429,
        };
      }

      // Validate input data
      if (config.validateInput && config.data) {
        const validationResult = await this.validateRequestData(config.data);
        if (!validationResult.isValid) {
          return {
            success: false,
            error: `Input validation failed: ${validationResult.errors.join(', ')}`,
            statusCode: 400,
          };
        }
        config.data = validationResult.data;
      }

      // Build request
      const request = await this.buildRequest(config);

      // Execute request with retries
      return await this.executeRequestWithRetries(request, config.retries || 0);

    } catch (error) {
      console.error('API request failed:', error);

      // Log security event for API failures
      await securityService.detectSuspiciousActivity('system', `api_request_failed_${config.endpoint}`);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Request failed',
        statusCode: 500,
      };
    }
  }

  private async buildRequest(config: ApiRequestConfig): Promise<Request> {
    // Build URL with versioning
    const url = ApiVersioning.getVersionedUrl(
      this.baseUrl,
      config.endpoint,
      config.version
    );

    // Build headers
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'OkapiFind/1.0',
      ...SecurityHeaders.getSecureHeaders(),
      ...config.headers,
    };

    // Add auth header if required
    if (config.requireAuth) {
      const authToken = await this.getAuthToken();
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      } else {
        throw new Error('Authentication required but no token available');
      }
    }

    // Build request options
    const requestOptions: RequestInit = {
      method: config.method,
      headers,
      body: config.data ? JSON.stringify(config.data) : undefined,
    };

    return new Request(url, requestOptions);
  }

  private async executeRequestWithRetries<T>(
    request: Request,
    retries: number
  ): Promise<ApiResponse<T>> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.defaultTimeout);

        const response = await fetch(request.clone(), {
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        return await this.processResponse<T>(response);

      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');

        // Don't retry on client errors (4xx)
        if (error instanceof Error && error.message.includes('4')) {
          break;
        }

        // Wait before retry (exponential backoff)
        if (attempt < retries) {
          const delay = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    return {
      success: false,
      error: lastError?.message || 'Request failed after retries',
      statusCode: 500,
    };
  }

  private async processResponse<T>(response: Response): Promise<ApiResponse<T>> {
    try {
      // Check if response is ok
      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          error: errorText || `HTTP ${response.status}: ${response.statusText}`,
          statusCode: response.status,
        };
      }

      // Parse response
      const contentType = response.headers.get('content-type');
      let data: T;

      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = (await response.text()) as unknown as T;
      }

      // Validate response data
      if (!this.isValidResponseData(data)) {
        return {
          success: false,
          error: 'Invalid response data received',
          statusCode: response.status,
        };
      }

      return {
        success: true,
        data,
        statusCode: response.status,
        headers: this.extractHeaders(response),
      };

    } catch (error) {
      return {
        success: false,
        error: `Response processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        statusCode: response.status,
      };
    }
  }

  private async validateRequestData(data: any): Promise<{
    isValid: boolean;
    errors: string[];
    data: any;
  }> {
    // Basic input sanitization
    const sanitizedData = this.sanitizeObject(data);

    // Additional validation rules can be added here
    const errors: string[] = [];

    // Check for common security issues
    if (this.containsSuspiciousContent(sanitizedData)) {
      errors.push('Request contains suspicious content');
    }

    return {
      isValid: errors.length === 0,
      errors,
      data: sanitizedData,
    };
  }

  private sanitizeObject(obj: any): any {
    if (typeof obj === 'string') {
      return InputValidator.sanitizeText(obj);
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item));
    }

    if (obj && typeof obj === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = this.sanitizeObject(value);
      }
      return sanitized;
    }

    return obj;
  }

  private containsSuspiciousContent(data: any): boolean {
    const suspiciousPatterns = [
      /<script/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /eval\s*\(/i,
      /document\./i,
      /window\./i,
    ];

    const dataString = JSON.stringify(data);
    return suspiciousPatterns.some(pattern => pattern.test(dataString));
  }

  private isValidResponseData(data: any): boolean {
    // Basic response validation
    if (data === null || data === undefined) {
      return false;
    }

    // Check for potential XSS in response
    if (typeof data === 'string' && this.containsSuspiciousContent(data)) {
      return false;
    }

    return true;
  }

  private extractHeaders(response: Response): Record<string, string> {
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });
    return headers;
  }

  private async getAuthToken(): Promise<string | null> {
    try {
      // This would typically get the token from secure storage
      // For now, we'll return null and let the auth system handle it
      return null;
    } catch (error) {
      console.error('Failed to get auth token:', error);
      return null;
    }
  }

  // Convenience methods
  public async get<T>(endpoint: string, config: Partial<ApiRequestConfig> = {}): Promise<ApiResponse<T>> {
    return this.makeRequest<T>({
      method: 'GET',
      endpoint,
      ...config,
    });
  }

  public async post<T>(
    endpoint: string,
    data: any,
    config: Partial<ApiRequestConfig> = {}
  ): Promise<ApiResponse<T>> {
    return this.makeRequest<T>({
      method: 'POST',
      endpoint,
      data,
      validateInput: true,
      ...config,
    });
  }

  public async put<T>(
    endpoint: string,
    data: any,
    config: Partial<ApiRequestConfig> = {}
  ): Promise<ApiResponse<T>> {
    return this.makeRequest<T>({
      method: 'PUT',
      endpoint,
      data,
      validateInput: true,
      ...config,
    });
  }

  public async delete<T>(endpoint: string, config: Partial<ApiRequestConfig> = {}): Promise<ApiResponse<T>> {
    return this.makeRequest<T>({
      method: 'DELETE',
      endpoint,
      ...config,
    });
  }
}

// Export configured instance
export const secureApi = new SecureApiService(
  process.env.EXPO_PUBLIC_API_URL || 'https://api.okapifind.com'
);

// Export for testing with different base URLs
export { SecureApiService };