/**
 * Input Validation and Sanitization Utilities
 * Provides comprehensive validation for all user inputs
 */

export class ValidationError extends Error {
  constructor(public field: string, message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Sanitize text input to prevent injection attacks
 */
export function sanitizeText(input: string, maxLength: number = 1000): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  // Remove HTML tags and scripts
  let sanitized = input.replace(/<[^>]*>/g, '');

  // Remove potential SQL injection patterns
  sanitized = sanitized.replace(/(['";]|--|\*|\/\*|\*\/|xp_|sp_|exec|execute|select|insert|update|delete|drop|create|alter|union|from|where)/gi, '');

  // Trim whitespace and limit length
  sanitized = sanitized.trim().substring(0, maxLength);

  // Remove control characters except newlines and tabs
  sanitized = sanitized.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');

  return sanitized;
}

/**
 * Validate email address
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email);
}

/**
 * Validate phone number (international format)
 */
export function validatePhoneNumber(phone: string): boolean {
  const phoneRegex = /^\+?[1-9]\d{1,14}$/;
  return phoneRegex.test(phone.replace(/\s|-|\(|\)/g, ''));
}

/**
 * Validate coordinates
 */
export function validateCoordinates(lat: number, lng: number): boolean {
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

/**
 * Validate address input
 */
export function validateAddress(address: string): string {
  if (!address || typeof address !== 'string') {
    throw new ValidationError('address', 'Address is required');
  }

  const sanitized = sanitizeText(address, 500);

  if (sanitized.length < 3) {
    throw new ValidationError('address', 'Address must be at least 3 characters');
  }

  if (sanitized.length > 500) {
    throw new ValidationError('address', 'Address must be less than 500 characters');
  }

  return sanitized;
}

/**
 * Validate parking notes
 */
export function validateParkingNotes(notes: string): string {
  const sanitized = sanitizeText(notes, 1000);

  if (sanitized.length > 1000) {
    throw new ValidationError('notes', 'Notes must be less than 1000 characters');
  }

  return sanitized;
}

/**
 * Validate venue name
 */
export function validateVenueName(name: string): string {
  if (!name || typeof name !== 'string') {
    throw new ValidationError('venueName', 'Venue name is required');
  }

  const sanitized = sanitizeText(name, 200);

  if (sanitized.length < 2) {
    throw new ValidationError('venueName', 'Venue name must be at least 2 characters');
  }

  if (sanitized.length > 200) {
    throw new ValidationError('venueName', 'Venue name must be less than 200 characters');
  }

  // Check for suspicious patterns
  const suspiciousPatterns = /^(test|admin|root|null|undefined|<|>|\[|\]|\{|\})/i;
  if (suspiciousPatterns.test(sanitized)) {
    throw new ValidationError('venueName', 'Invalid venue name');
  }

  return sanitized;
}

/**
 * Validate URL
 */
export function validateUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return ['http:', 'https:'].includes(urlObj.protocol);
  } catch {
    return false;
  }
}

/**
 * Validate and sanitize file name
 */
export function sanitizeFileName(fileName: string): string {
  if (!fileName || typeof fileName !== 'string') {
    return 'file';
  }

  // Remove path traversal attempts
  let sanitized = fileName.replace(/\.\./g, '');

  // Remove special characters except dots, dashes, and underscores
  sanitized = sanitized.replace(/[^a-zA-Z0-9._-]/g, '_');

  // Limit length
  if (sanitized.length > 255) {
    const extension = sanitized.split('.').pop() || '';
    const baseName = sanitized.substring(0, 240);
    sanitized = extension ? `${baseName}.${extension}` : baseName;
  }

  return sanitized;
}

/**
 * Validate image MIME type
 */
export function validateImageType(mimeType: string): boolean {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  return allowedTypes.includes(mimeType.toLowerCase());
}

/**
 * Validate file size (in bytes)
 */
export function validateFileSize(sizeInBytes: number, maxSizeMB: number = 10): boolean {
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  return sizeInBytes > 0 && sizeInBytes <= maxSizeBytes;
}

/**
 * Validate date input
 */
export function validateDate(date: string | Date): boolean {
  const dateObj = date instanceof Date ? date : new Date(date);
  return !isNaN(dateObj.getTime());
}

/**
 * Validate time duration (in minutes)
 */
export function validateDuration(minutes: number): boolean {
  return (
    typeof minutes === 'number' &&
    minutes > 0 &&
    minutes <= 1440 && // Max 24 hours
    !isNaN(minutes)
  );
}

/**
 * Validate license plate
 */
export function validateLicensePlate(plate: string): string {
  const sanitized = sanitizeText(plate, 20);

  // Remove spaces and convert to uppercase
  const normalized = sanitized.replace(/\s/g, '').toUpperCase();

  // Basic validation (alphanumeric only)
  if (!/^[A-Z0-9]+$/.test(normalized)) {
    throw new ValidationError('licensePlate', 'Invalid license plate format');
  }

  if (normalized.length < 2 || normalized.length > 20) {
    throw new ValidationError('licensePlate', 'License plate must be between 2 and 20 characters');
  }

  return normalized;
}

/**
 * Validate payment amount
 */
export function validateAmount(amount: number): boolean {
  return (
    typeof amount === 'number' &&
    amount > 0 &&
    amount <= 999999 &&
    !isNaN(amount) &&
    Number.isFinite(amount)
  );
}

/**
 * Sanitize search query
 */
export function sanitizeSearchQuery(query: string): string {
  if (!query || typeof query !== 'string') {
    return '';
  }

  // Remove special characters that could be used for injection
  let sanitized = query.replace(/[<>'"%;()&+\\]/g, '');

  // Trim and limit length
  sanitized = sanitized.trim().substring(0, 100);

  return sanitized;
}

/**
 * Validate array of strings
 */
export function validateStringArray(arr: unknown[], maxLength: number = 100): string[] {
  if (!Array.isArray(arr)) {
    return [];
  }

  return arr
    .filter(item => typeof item === 'string')
    .map(item => sanitizeText(item as string, 200))
    .slice(0, maxLength);
}

/**
 * Validate JSON structure
 */
export function validateJSON(jsonString: string): unknown | null {
  try {
    const parsed = JSON.parse(jsonString);

    // Prevent prototype pollution
    if (parsed && typeof parsed === 'object') {
      if ('__proto__' in parsed || 'constructor' in parsed || 'prototype' in parsed) {
        return null;
      }
    }

    return parsed;
  } catch {
    return null;
  }
}

/**
 * Rate limiting validator
 */
export class RateLimiter {
  private attempts: Map<string, number[]> = new Map();

  constructor(
    private maxAttempts: number = 10,
    private windowMs: number = 60000 // 1 minute
  ) {}

  isAllowed(key: string): boolean {
    const now = Date.now();
    const attempts = this.attempts.get(key) || [];

    // Remove old attempts outside the window
    const validAttempts = attempts.filter(time => now - time < this.windowMs);

    if (validAttempts.length >= this.maxAttempts) {
      return false;
    }

    validAttempts.push(now);
    this.attempts.set(key, validAttempts);

    // Clean up old entries
    if (this.attempts.size > 1000) {
      this.cleanup();
    }

    return true;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, attempts] of this.attempts.entries()) {
      const validAttempts = attempts.filter(time => now - time < this.windowMs);
      if (validAttempts.length === 0) {
        this.attempts.delete(key);
      } else {
        this.attempts.set(key, validAttempts);
      }
    }
  }

  reset(key: string): void {
    this.attempts.delete(key);
  }
}