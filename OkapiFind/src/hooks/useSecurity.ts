import { useState, useCallback, useEffect } from 'react';
import { Alert } from 'react-native';
import { securityService, InputValidator } from '../services/security';

interface UseSecurityOptions {
  enableRateLimit?: boolean;
  endpoint?: string;
  identifier?: string;
}

interface ValidationRules {
  [field: string]: {
    required?: boolean;
    type?: 'text' | 'email' | 'phone' | 'url' | 'coordinates' | 'search';
    minLength?: number;
    maxLength?: number;
  };
}

export function useSecurity(options: UseSecurityOptions = {}) {
  const [isBlocked, setIsBlocked] = useState(false);
  const [remainingRequests, setRemainingRequests] = useState(-1);

  const checkRateLimit = useCallback(async (customEndpoint?: string, customIdentifier?: string): Promise<boolean> => {
    if (!options.enableRateLimit) return true;

    const endpoint = customEndpoint || options.endpoint || 'default';
    const identifier = customIdentifier || options.identifier || 'default';

    try {
      const allowed = await securityService.checkRateLimit(endpoint, identifier);

      if (!allowed) {
        setIsBlocked(true);
        Alert.alert(
          'Rate Limit Exceeded',
          'Too many requests. Please wait before trying again.',
          [{ text: 'OK' }]
        );
        return false;
      }

      setIsBlocked(false);
      const remaining = securityService.getRemainingRequests(endpoint, identifier);
      setRemainingRequests(remaining);

      return true;
    } catch (error) {
      console.error('Rate limit check failed:', error);
      return true; // Allow on error to prevent blocking legitimate users
    }
  }, [options.enableRateLimit, options.endpoint, options.identifier]);

  const validateInput = useCallback(async (data: any, rules: ValidationRules) => {
    try {
      const result = await securityService.validateAndSanitizeInput(data, rules);

      if (!result.isValid) {
        Alert.alert(
          'Invalid Input',
          result.errors.join('\n'),
          [{ text: 'OK' }]
        );
      }

      return result;
    } catch (error) {
      console.error('Input validation failed:', error);
      return {
        isValid: false,
        errors: ['Validation failed'],
        data: {},
      };
    }
  }, []);

  const sanitizeText = useCallback((text: string): string => {
    return InputValidator.sanitizeText(text);
  }, []);

  const sanitizeSearchQuery = useCallback((query: string): string => {
    return InputValidator.sanitizeSearchQuery(query);
  }, []);

  const validateEmail = useCallback((email: string): boolean => {
    return InputValidator.isValidEmail(email);
  }, []);

  const validatePhoneNumber = useCallback((phone: string): boolean => {
    return InputValidator.isValidPhoneNumber(phone);
  }, []);

  const validatePassword = useCallback((password: string) => {
    return InputValidator.validatePassword(password);
  }, []);

  const validateCoordinates = useCallback((lat: number, lng: number): boolean => {
    return InputValidator.isValidCoordinates(lat, lng);
  }, []);

  const validateUrl = useCallback((url: string): boolean => {
    return InputValidator.isValidUrl(url);
  }, []);

  // Update remaining requests on mount
  useEffect(() => {
    if (options.enableRateLimit && options.endpoint) {
      const remaining = securityService.getRemainingRequests(
        options.endpoint,
        options.identifier || 'default'
      );
      setRemainingRequests(remaining);
    }
  }, [options.enableRateLimit, options.endpoint, options.identifier]);

  return {
    // Rate limiting
    isBlocked,
    remainingRequests,
    checkRateLimit,

    // Input validation
    validateInput,
    sanitizeText,
    sanitizeSearchQuery,

    // Specific validators
    validateEmail,
    validatePhoneNumber,
    validatePassword,
    validateCoordinates,
    validateUrl,
  };
}

// Hook for form security
export function useFormSecurity(formRules: ValidationRules) {
  const security = useSecurity();
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [isValidating, setIsValidating] = useState(false);

  const validateForm = useCallback(async (formData: any) => {
    setIsValidating(true);
    setFormErrors([]);

    try {
      const result = await security.validateInput(formData, formRules);

      if (!result.isValid) {
        setFormErrors(result.errors);
      }

      setIsValidating(false);
      return result;
    } catch (error) {
      setIsValidating(false);
      setFormErrors(['Form validation failed']);
      return {
        isValid: false,
        errors: ['Form validation failed'],
        data: {},
      };
    }
  }, [security, formRules]);

  const clearErrors = useCallback(() => {
    setFormErrors([]);
  }, []);

  return {
    validateForm,
    formErrors,
    isValidating,
    clearErrors,
    ...security,
  };
}

// Hook for API security
export function useApiSecurity(endpoint: string) {
  const security = useSecurity({
    enableRateLimit: true,
    endpoint,
  });

  const secureApiCall = useCallback(async <T>(
    apiCall: () => Promise<T>,
    options: {
      requireAuth?: boolean;
      validateResponse?: boolean;
    } = {}
  ): Promise<T | null> => {
    // Check rate limit
    const allowed = await security.checkRateLimit();
    if (!allowed) {
      throw new Error('Rate limit exceeded');
    }

    try {
      // Make the API call
      const result = await apiCall();

      // Basic response validation
      if (options.validateResponse && result === null) {
        throw new Error('Invalid response received');
      }

      return result;
    } catch (error) {
      console.error(`Secure API call failed for ${endpoint}:`, error);

      // Log security event for failed API calls
      await securityService.detectSuspiciousActivity('unknown', `api_call_failed_${endpoint}`);

      throw error;
    }
  }, [security, endpoint]);

  return {
    secureApiCall,
    ...security,
  };
}