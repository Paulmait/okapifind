/**
 * Two-Factor Authentication (2FA/MFA) Service
 * Implements TOTP, SMS, Email, and Backup Codes
 */

import * as speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import crypto from 'crypto';

export enum TwoFactorMethod {
  TOTP = 'totp',         // Time-based One-Time Password (Google Authenticator)
  SMS = 'sms',           // SMS verification
  EMAIL = 'email',       // Email verification
  BACKUP = 'backup',     // Backup codes
  BIOMETRIC = 'biometric' // Face ID / Touch ID
}

export interface TwoFactorSetup {
  userId: string;
  method: TwoFactorMethod;
  secret?: string;
  qrCode?: string;
  backupCodes?: string[];
  phoneNumber?: string;
  email?: string;
  isEnabled: boolean;
  isVerified: boolean;
  lastUsed?: Date;
  trustedDevices: TrustedDevice[];
}

export interface TrustedDevice {
  deviceId: string;
  deviceName: string;
  deviceType: string;
  lastAccess: Date;
  ipAddress: string;
  location?: string;
  fingerprint: string;
}

export class TwoFactorAuthService {
  private userSecrets: Map<string, TwoFactorSetup> = new Map();
  private verificationAttempts: Map<string, number> = new Map();
  private maxAttempts = 5;
  private lockoutDuration = 900000; // 15 minutes
  private lockedOutUsers: Map<string, number> = new Map();
  private backupCodeLength = 10;
  private backupCodeCount = 10;

  constructor() {
    this.initialize();
  }

  private async initialize() {
    // Load existing 2FA configurations
    await this.loadConfigurations();

    // Set up periodic cleanup
    this.startCleanupTask();
  }

  /**
   * Enable 2FA for a user
   */
  public async enableTwoFactor(
    userId: string,
    method: TwoFactorMethod,
    contact?: string
  ): Promise<TwoFactorSetup> {
    // Check if user is locked out
    if (this.isLockedOut(userId)) {
      throw new Error('Account temporarily locked due to too many failed attempts');
    }

    let setup: TwoFactorSetup;

    switch (method) {
      case TwoFactorMethod.TOTP:
        setup = await this.setupTOTP(userId);
        break;
      case TwoFactorMethod.SMS:
        if (!contact) throw new Error('Phone number required for SMS 2FA');
        setup = await this.setupSMS(userId, contact);
        break;
      case TwoFactorMethod.EMAIL:
        if (!contact) throw new Error('Email required for email 2FA');
        setup = await this.setupEmail(userId, contact);
        break;
      case TwoFactorMethod.BIOMETRIC:
        setup = await this.setupBiometric(userId);
        break;
      default:
        setup = await this.setupTOTP(userId);
    }

    // Generate backup codes
    setup.backupCodes = this.generateBackupCodes();

    // Store setup
    this.userSecrets.set(userId, setup);

    // Save to database
    await this.saveConfiguration(setup);

    // Log the event
    await this.log2FAEvent(userId, 'enable', method, true);

    return setup;
  }

  /**
   * Set up TOTP (Google Authenticator)
   */
  private async setupTOTP(userId: string): Promise<TwoFactorSetup> {
    const secret = speakeasy.generateSecret({
      name: `OkapiFind (${userId})`,
      issuer: 'OkapiFind',
      length: 32
    });

    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url!);

    return {
      userId,
      method: TwoFactorMethod.TOTP,
      secret: secret.base32,
      qrCode: qrCodeUrl,
      isEnabled: false, // Will be enabled after verification
      isVerified: false,
      trustedDevices: []
    };
  }

  /**
   * Set up SMS verification
   */
  private async setupSMS(userId: string, phoneNumber: string): Promise<TwoFactorSetup> {
    // Validate phone number
    const cleanedPhone = this.validatePhoneNumber(phoneNumber);

    // Send verification code
    const code = this.generateVerificationCode();
    await this.sendSMSCode(cleanedPhone, code);

    return {
      userId,
      method: TwoFactorMethod.SMS,
      phoneNumber: cleanedPhone,
      isEnabled: false,
      isVerified: false,
      trustedDevices: []
    };
  }

  /**
   * Set up Email verification
   */
  private async setupEmail(userId: string, email: string): Promise<TwoFactorSetup> {
    // Validate email
    if (!this.validateEmail(email)) {
      throw new Error('Invalid email address');
    }

    // Send verification code
    const code = this.generateVerificationCode();
    await this.sendEmailCode(email, code);

    return {
      userId,
      method: TwoFactorMethod.EMAIL,
      email,
      isEnabled: false,
      isVerified: false,
      trustedDevices: []
    };
  }

  /**
   * Set up Biometric authentication
   */
  private async setupBiometric(userId: string): Promise<TwoFactorSetup> {
    // Check if WebAuthn is supported
    if (!window.PublicKeyCredential) {
      throw new Error('Biometric authentication not supported on this device');
    }

    // Create credential
    const credential = await this.createBiometricCredential(userId);

    return {
      userId,
      method: TwoFactorMethod.BIOMETRIC,
      secret: credential,
      isEnabled: false,
      isVerified: false,
      trustedDevices: []
    };
  }

  /**
   * Verify 2FA code
   */
  public async verifyTwoFactor(
    userId: string,
    code: string,
    method?: TwoFactorMethod
  ): Promise<boolean> {
    // Check if user is locked out
    if (this.isLockedOut(userId)) {
      throw new Error('Account temporarily locked due to too many failed attempts');
    }

    const setup = this.userSecrets.get(userId);
    if (!setup) {
      throw new Error('2FA not configured for this user');
    }

    let isValid = false;

    switch (setup.method) {
      case TwoFactorMethod.TOTP:
        isValid = this.verifyTOTP(setup.secret!, code);
        break;
      case TwoFactorMethod.SMS:
      case TwoFactorMethod.EMAIL:
        isValid = await this.verifyCode(userId, code);
        break;
      case TwoFactorMethod.BACKUP:
        isValid = this.verifyBackupCode(setup, code);
        break;
      case TwoFactorMethod.BIOMETRIC:
        isValid = await this.verifyBiometric(userId, code);
        break;
    }

    if (!isValid) {
      this.recordFailedAttempt(userId);
      await this.log2FAEvent(userId, 'verify_failed', setup.method, false);

      // Check if should lock out
      const attempts = this.verificationAttempts.get(userId) || 0;
      if (attempts >= this.maxAttempts) {
        this.lockoutUser(userId);
        await this.alertSecurityTeam(userId, 'Multiple failed 2FA attempts');
      }

      return false;
    }

    // Reset attempts on success
    this.verificationAttempts.delete(userId);

    // Enable 2FA if this was first verification
    if (!setup.isEnabled) {
      setup.isEnabled = true;
      setup.isVerified = true;
      await this.saveConfiguration(setup);
    }

    // Update last used
    setup.lastUsed = new Date();

    await this.log2FAEvent(userId, 'verify_success', setup.method, true);

    return true;
  }

  /**
   * Verify TOTP code
   */
  private verifyTOTP(secret: string, token: string): boolean {
    return speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 2 // Allow 2 time steps before/after
    });
  }

  /**
   * Verify SMS/Email code
   */
  private async verifyCode(userId: string, code: string): Promise<boolean> {
    // In production, this would check against stored codes in database
    const storedCode = await this.getStoredCode(userId);
    return storedCode === code;
  }

  /**
   * Verify backup code
   */
  private verifyBackupCode(setup: TwoFactorSetup, code: string): boolean {
    if (!setup.backupCodes) return false;

    const index = setup.backupCodes.indexOf(code);
    if (index > -1) {
      // Remove used backup code
      setup.backupCodes.splice(index, 1);
      this.saveConfiguration(setup);
      return true;
    }

    return false;
  }

  /**
   * Verify biometric
   */
  private async verifyBiometric(userId: string, credentialId: string): Promise<boolean> {
    try {
      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge: new Uint8Array(32),
          allowCredentials: [{
            id: Uint8Array.from(credentialId, c => c.charCodeAt(0)),
            type: 'public-key'
          }],
          userVerification: 'required'
        }
      });

      return !!assertion;
    } catch (error) {
      console.error('Biometric verification failed:', error);
      return false;
    }
  }

  /**
   * Generate backup codes
   */
  private generateBackupCodes(): string[] {
    const codes: string[] = [];
    for (let i = 0; i < this.backupCodeCount; i++) {
      const code = crypto.randomBytes(5).toString('hex').toUpperCase();
      codes.push(`${code.slice(0, 5)}-${code.slice(5)}`);
    }
    return codes;
  }

  /**
   * Generate verification code
   */
  private generateVerificationCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Add trusted device
   */
  public async addTrustedDevice(
    userId: string,
    device: Omit<TrustedDevice, 'lastAccess'>
  ): Promise<void> {
    const setup = this.userSecrets.get(userId);
    if (!setup) return;

    const trustedDevice: TrustedDevice = {
      ...device,
      lastAccess: new Date()
    };

    setup.trustedDevices.push(trustedDevice);
    await this.saveConfiguration(setup);
  }

  /**
   * Check if device is trusted
   */
  public isDeviceTrusted(userId: string, deviceId: string): boolean {
    const setup = this.userSecrets.get(userId);
    if (!setup) return false;

    return setup.trustedDevices.some(d => d.deviceId === deviceId);
  }

  /**
   * Remove trusted device
   */
  public async removeTrustedDevice(userId: string, deviceId: string): Promise<void> {
    const setup = this.userSecrets.get(userId);
    if (!setup) return;

    setup.trustedDevices = setup.trustedDevices.filter(d => d.deviceId !== deviceId);
    await this.saveConfiguration(setup);
  }

  /**
   * Disable 2FA
   */
  public async disableTwoFactor(userId: string, password: string): Promise<void> {
    // Verify password first
    const isPasswordValid = await this.verifyPassword(userId, password);
    if (!isPasswordValid) {
      throw new Error('Invalid password');
    }

    // Remove 2FA setup
    this.userSecrets.delete(userId);

    // Remove from database
    await this.removeConfiguration(userId);

    await this.log2FAEvent(userId, 'disable', TwoFactorMethod.TOTP, true);
  }

  /**
   * Helper methods
   */
  private validatePhoneNumber(phone: string): string {
    // Remove all non-numeric characters
    const cleaned = phone.replace(/\D/g, '');

    // Check if valid length
    if (cleaned.length < 10 || cleaned.length > 15) {
      throw new Error('Invalid phone number');
    }

    return cleaned;
  }

  private validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private isLockedOut(userId: string): boolean {
    const lockoutTime = this.lockedOutUsers.get(userId);
    if (!lockoutTime) return false;

    if (Date.now() - lockoutTime > this.lockoutDuration) {
      this.lockedOutUsers.delete(userId);
      return false;
    }

    return true;
  }

  private recordFailedAttempt(userId: string) {
    const attempts = this.verificationAttempts.get(userId) || 0;
    this.verificationAttempts.set(userId, attempts + 1);
  }

  private lockoutUser(userId: string) {
    this.lockedOutUsers.set(userId, Date.now());
    this.verificationAttempts.delete(userId);
  }

  /**
   * Database operations
   */
  private async saveConfiguration(setup: TwoFactorSetup): Promise<void> {
    await fetch('/api/2fa/save', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify(setup)
    });
  }

  private async removeConfiguration(userId: string): Promise<void> {
    await fetch(`/api/2fa/remove/${userId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
  }

  private async loadConfigurations(): Promise<void> {
    try {
      const response = await fetch('/api/2fa/configurations', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const configs = await response.json();
        configs.forEach((config: TwoFactorSetup) => {
          this.userSecrets.set(config.userId, config);
        });
      }
    } catch (error) {
      console.error('Failed to load 2FA configurations:', error);
    }
  }

  private async getStoredCode(userId: string): Promise<string | null> {
    try {
      const response = await fetch(`/api/2fa/code/${userId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        return data.code;
      }
    } catch (error) {
      console.error('Failed to get stored code:', error);
    }

    return null;
  }

  private async verifyPassword(userId: string, password: string): Promise<boolean> {
    try {
      const response = await fetch('/api/auth/verify-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ userId, password })
      });

      return response.ok;
    } catch (error) {
      console.error('Failed to verify password:', error);
      return false;
    }
  }

  private async sendSMSCode(phone: string, code: string): Promise<void> {
    await fetch('/api/2fa/send-sms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ phone, code })
    });
  }

  private async sendEmailCode(email: string, code: string): Promise<void> {
    await fetch('/api/2fa/send-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, code })
    });
  }

  private async createBiometricCredential(userId: string): Promise<string> {
    const credential = await navigator.credentials.create({
      publicKey: {
        challenge: new Uint8Array(32),
        rp: { name: 'OkapiFind' },
        user: {
          id: Uint8Array.from(userId, c => c.charCodeAt(0)),
          name: userId,
          displayName: userId
        },
        pubKeyCredParams: [{ alg: -7, type: 'public-key' }],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required'
        }
      }
    });

    return btoa(String.fromCharCode(...new Uint8Array((credential as any).rawId)));
  }

  private async log2FAEvent(
    userId: string,
    action: string,
    method: TwoFactorMethod,
    success: boolean
  ): Promise<void> {
    await fetch('/api/audit/2fa', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId,
        action,
        method,
        success,
        timestamp: new Date().toISOString(),
        ipAddress: await this.getClientIP()
      })
    });
  }

  private async alertSecurityTeam(userId: string, reason: string): Promise<void> {
    await fetch('/api/security/alert', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Priority': 'high'
      },
      body: JSON.stringify({
        userId,
        reason,
        timestamp: new Date().toISOString()
      })
    });
  }

  private async getClientIP(): Promise<string> {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch {
      return 'unknown';
    }
  }

  private startCleanupTask() {
    // Clean up expired lockouts every 5 minutes
    setInterval(() => {
      const now = Date.now();
      for (const [userId, lockoutTime] of this.lockedOutUsers) {
        if (now - lockoutTime > this.lockoutDuration) {
          this.lockedOutUsers.delete(userId);
        }
      }
    }, 300000);
  }
}

// Export singleton instance
export const twoFactorAuth = new TwoFactorAuthService();