import {
  sanitizeText,
  validateEmail,
  validatePhoneNumber,
  validateCoordinates,
  validateAddress,
  validateParkingNotes,
  validateVenueName,
  validateUrl,
  sanitizeFileName,
  validateImageType,
  validateFileSize,
  validateLicensePlate,
  validateAmount,
  RateLimiter,
  ValidationError,
} from '../validation';

describe('Validation Utilities', () => {
  describe('sanitizeText', () => {
    it('should remove HTML tags', () => {
      const input = '<script>alert("xss")</script>Hello World';
      expect(sanitizeText(input)).toBe('Hello World');
    });

    it('should remove SQL injection patterns', () => {
      const input = "'; DROP TABLE users; --";
      expect(sanitizeText(input)).toBe('  TABLE users ');
    });

    it('should trim and limit length', () => {
      const input = '  ' + 'a'.repeat(2000) + '  ';
      expect(sanitizeText(input, 100).length).toBe(100);
    });

    it('should handle empty input', () => {
      expect(sanitizeText('')).toBe('');
      expect(sanitizeText(null as any)).toBe('');
      expect(sanitizeText(undefined as any)).toBe('');
    });
  });

  describe('validateEmail', () => {
    it('should validate correct emails', () => {
      expect(validateEmail('test@example.com')).toBe(true);
      expect(validateEmail('user.name+tag@domain.co.uk')).toBe(true);
    });

    it('should reject invalid emails', () => {
      expect(validateEmail('invalid')).toBe(false);
      expect(validateEmail('@example.com')).toBe(false);
      expect(validateEmail('test@')).toBe(false);
      expect(validateEmail('test@.com')).toBe(false);
    });
  });

  describe('validatePhoneNumber', () => {
    it('should validate correct phone numbers', () => {
      expect(validatePhoneNumber('+12345678901')).toBe(true);
      expect(validatePhoneNumber('12345678901')).toBe(true);
      expect(validatePhoneNumber('+1 234 567 8901')).toBe(true);
    });

    it('should reject invalid phone numbers', () => {
      expect(validatePhoneNumber('123')).toBe(false);
      expect(validatePhoneNumber('abc123')).toBe(false);
      expect(validatePhoneNumber('')).toBe(false);
    });
  });

  describe('validateCoordinates', () => {
    it('should validate correct coordinates', () => {
      expect(validateCoordinates(0, 0)).toBe(true);
      expect(validateCoordinates(45.5, -122.6)).toBe(true);
      expect(validateCoordinates(-90, 180)).toBe(true);
    });

    it('should reject invalid coordinates', () => {
      expect(validateCoordinates(91, 0)).toBe(false);
      expect(validateCoordinates(0, 181)).toBe(false);
      expect(validateCoordinates(NaN, 0)).toBe(false);
      expect(validateCoordinates('45' as any, 0)).toBe(false);
    });
  });

  describe('validateAddress', () => {
    it('should validate and sanitize correct addresses', () => {
      const address = '123 Main St, City, State';
      expect(validateAddress(address)).toBe(address);
    });

    it('should throw for invalid addresses', () => {
      expect(() => validateAddress('')).toThrow(ValidationError);
      expect(() => validateAddress('ab')).toThrow('Address must be at least 3 characters');
    });

    it('should sanitize malicious input', () => {
      const input = '<script>123 Main St</script>';
      expect(validateAddress(input)).toBe('123 Main St');
    });
  });

  describe('validateVenueName', () => {
    it('should validate correct venue names', () => {
      expect(validateVenueName('Starbucks')).toBe('Starbucks');
      expect(validateVenueName('Target Store #1234')).toBe('Target Store #1234');
    });

    it('should reject suspicious patterns', () => {
      expect(() => validateVenueName('<script>')).toThrow('Invalid venue name');
      expect(() => validateVenueName('admin')).toThrow('Invalid venue name');
      expect(() => validateVenueName('null')).toThrow('Invalid venue name');
    });
  });

  describe('validateUrl', () => {
    it('should validate correct URLs', () => {
      expect(validateUrl('https://example.com')).toBe(true);
      expect(validateUrl('http://localhost:3000')).toBe(true);
    });

    it('should reject invalid URLs', () => {
      expect(validateUrl('not-a-url')).toBe(false);
      expect(validateUrl('javascript:alert(1)')).toBe(false);
      expect(validateUrl('ftp://example.com')).toBe(false);
    });
  });

  describe('sanitizeFileName', () => {
    it('should sanitize file names', () => {
      expect(sanitizeFileName('file.txt')).toBe('file.txt');
      expect(sanitizeFileName('../../../etc/passwd')).toBe('___etc_passwd');
      expect(sanitizeFileName('file<>:"|?*.txt')).toBe('file_______.txt');
    });

    it('should handle long file names', () => {
      const longName = 'a'.repeat(300) + '.txt';
      const result = sanitizeFileName(longName);
      expect(result.length).toBeLessThanOrEqual(255);
      expect(result.endsWith('.txt')).toBe(true);
    });
  });

  describe('validateImageType', () => {
    it('should validate correct image types', () => {
      expect(validateImageType('image/jpeg')).toBe(true);
      expect(validateImageType('image/png')).toBe(true);
      expect(validateImageType('IMAGE/JPEG')).toBe(true);
    });

    it('should reject invalid image types', () => {
      expect(validateImageType('text/plain')).toBe(false);
      expect(validateImageType('application/pdf')).toBe(false);
      expect(validateImageType('image/svg+xml')).toBe(false);
    });
  });

  describe('validateFileSize', () => {
    it('should validate correct file sizes', () => {
      expect(validateFileSize(1024, 1)).toBe(true); // 1KB < 1MB
      expect(validateFileSize(5 * 1024 * 1024, 10)).toBe(true); // 5MB < 10MB
    });

    it('should reject invalid file sizes', () => {
      expect(validateFileSize(0, 1)).toBe(false);
      expect(validateFileSize(11 * 1024 * 1024, 10)).toBe(false); // 11MB > 10MB
    });
  });

  describe('validateLicensePlate', () => {
    it('should validate and normalize license plates', () => {
      expect(validateLicensePlate('ABC 123')).toBe('ABC123');
      expect(validateLicensePlate('xyz-789')).toBe('XYZ789');
    });

    it('should reject invalid license plates', () => {
      expect(() => validateLicensePlate('A')).toThrow('License plate must be between 2 and 20 characters');
      expect(() => validateLicensePlate('ABC@123')).toThrow('Invalid license plate format');
    });
  });

  describe('validateAmount', () => {
    it('should validate correct amounts', () => {
      expect(validateAmount(0.01)).toBe(true);
      expect(validateAmount(100)).toBe(true);
      expect(validateAmount(999999)).toBe(true);
    });

    it('should reject invalid amounts', () => {
      expect(validateAmount(0)).toBe(false);
      expect(validateAmount(-10)).toBe(false);
      expect(validateAmount(Infinity)).toBe(false);
      expect(validateAmount(NaN)).toBe(false);
    });
  });

  describe('RateLimiter', () => {
    let rateLimiter: RateLimiter;

    beforeEach(() => {
      rateLimiter = new RateLimiter(3, 1000); // 3 attempts per second
    });

    it('should allow requests within limit', () => {
      expect(rateLimiter.isAllowed('user1')).toBe(true);
      expect(rateLimiter.isAllowed('user1')).toBe(true);
      expect(rateLimiter.isAllowed('user1')).toBe(true);
    });

    it('should block requests over limit', () => {
      expect(rateLimiter.isAllowed('user2')).toBe(true);
      expect(rateLimiter.isAllowed('user2')).toBe(true);
      expect(rateLimiter.isAllowed('user2')).toBe(true);
      expect(rateLimiter.isAllowed('user2')).toBe(false);
    });

    it('should reset limits for a user', () => {
      rateLimiter.isAllowed('user3');
      rateLimiter.isAllowed('user3');
      rateLimiter.isAllowed('user3');
      expect(rateLimiter.isAllowed('user3')).toBe(false);

      rateLimiter.reset('user3');
      expect(rateLimiter.isAllowed('user3')).toBe(true);
    });
  });
});