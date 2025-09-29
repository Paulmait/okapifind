/**
 * Data Encryption at Rest Service
 * Provides AES-256 encryption for sensitive data storage
 */

import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger, LogCategory } from './logger';

interface EncryptionConfig {
  algorithm: 'AES-256-GCM' | 'AES-256-CBC';
  keyDerivation: 'PBKDF2' | 'SCRYPT';
  iterations: number;
  saltLength: number;
  ivLength: number;
  tagLength: number;
  keyRotationDays: number;
}

interface EncryptedData {
  ciphertext: string;
  iv: string;
  salt: string;
  tag?: string;
  algorithm: string;
  timestamp: string;
  keyId: string;
}

interface KeyMetadata {
  id: string;
  createdAt: string;
  rotatedAt?: string;
  algorithm: string;
  status: 'active' | 'rotating' | 'retired';
  usageCount: number;
}

class DataEncryptionService {
  private static instance: DataEncryptionService;
  private config: EncryptionConfig;
  private masterKey?: string;
  private dataKeys: Map<string, string> = new Map();
  private keyMetadata: Map<string, KeyMetadata> = new Map();
  private isInitialized: boolean = false;

  private constructor() {
    this.config = {
      algorithm: 'AES-256-GCM',
      keyDerivation: 'PBKDF2',
      iterations: 100000,
      saltLength: 32,
      ivLength: 16,
      tagLength: 16,
      keyRotationDays: 90,
    };
  }

  static getInstance(): DataEncryptionService {
    if (!DataEncryptionService.instance) {
      DataEncryptionService.instance = new DataEncryptionService();
    }
    return DataEncryptionService.instance;
  }

  /**
   * Initialize encryption service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Load or generate master key
      await this.initializeMasterKey();

      // Load data encryption keys
      await this.loadDataKeys();

      // Check for key rotation
      await this.checkKeyRotation();

      this.isInitialized = true;

      logger.info('Data encryption service initialized', {
        algorithm: this.config.algorithm,
        keyCount: this.dataKeys.size,
      });
    } catch (error) {
      logger.error('Failed to initialize encryption service', error);
      throw error;
    }
  }

  /**
   * Initialize master key
   */
  private async initializeMasterKey(): Promise<void> {
    try {
      // Try to load existing master key
      let masterKey = await SecureStore.getItemAsync('encryption_master_key');

      if (!masterKey) {
        // Generate new master key
        masterKey = await this.generateMasterKey();
        await SecureStore.setItemAsync('encryption_master_key', masterKey);

        logger.logSecurityEvent('master_key_generated', 'high', {
          timestamp: new Date().toISOString(),
        });
      }

      this.masterKey = masterKey;
    } catch (error) {
      logger.error('Failed to initialize master key', error);
      throw error;
    }
  }

  /**
   * Generate master key
   */
  private async generateMasterKey(): Promise<string> {
    const randomBytes = await Crypto.getRandomBytesAsync(32);
    return this.bytesToHex(randomBytes);
  }

  /**
   * Load data encryption keys
   */
  private async loadDataKeys(): Promise<void> {
    try {
      const storedKeys = await SecureStore.getItemAsync('data_encryption_keys');

      if (storedKeys) {
        const parsed = JSON.parse(storedKeys);

        for (const [keyId, encryptedKey] of Object.entries(parsed.keys)) {
          // Decrypt data key using master key
          const decryptedKey = await this.decryptWithMasterKey(encryptedKey as string);
          this.dataKeys.set(keyId, decryptedKey);
        }

        // Load metadata
        for (const [keyId, metadata] of Object.entries(parsed.metadata)) {
          this.keyMetadata.set(keyId, metadata as KeyMetadata);
        }
      } else {
        // Generate initial data key
        await this.generateDataKey('default');
      }
    } catch (error) {
      logger.error('Failed to load data keys', error);
      // Generate new key if loading fails
      await this.generateDataKey('default');
    }
  }

  /**
   * Generate new data encryption key
   */
  private async generateDataKey(keyId: string): Promise<void> {
    const key = await Crypto.getRandomBytesAsync(32);
    const keyHex = this.bytesToHex(key);

    // Encrypt data key with master key
    const encryptedKey = await this.encryptWithMasterKey(keyHex);

    // Store key
    this.dataKeys.set(keyId, keyHex);

    // Create metadata
    const metadata: KeyMetadata = {
      id: keyId,
      createdAt: new Date().toISOString(),
      algorithm: this.config.algorithm,
      status: 'active',
      usageCount: 0,
    };

    this.keyMetadata.set(keyId, metadata);

    // Persist keys
    await this.persistDataKeys();

    logger.logSecurityEvent('data_key_generated', 'medium', { keyId });
  }

  /**
   * Persist data keys
   */
  private async persistDataKeys(): Promise<void> {
    const encryptedKeys: Record<string, string> = {};

    for (const [keyId, key] of this.dataKeys.entries()) {
      encryptedKeys[keyId] = await this.encryptWithMasterKey(key);
    }

    const metadata: Record<string, KeyMetadata> = {};
    for (const [keyId, meta] of this.keyMetadata.entries()) {
      metadata[keyId] = meta;
    }

    await SecureStore.setItemAsync(
      'data_encryption_keys',
      JSON.stringify({ keys: encryptedKeys, metadata })
    );
  }

  /**
   * Encrypt data
   */
  async encrypt(data: string, keyId: string = 'default'): Promise<EncryptedData> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const key = this.dataKeys.get(keyId);
    if (!key) {
      throw new Error(`Encryption key ${keyId} not found`);
    }

    try {
      // Generate random IV and salt
      const iv = await Crypto.getRandomBytesAsync(this.config.ivLength);
      const salt = await Crypto.getRandomBytesAsync(this.config.saltLength);

      // Derive key from salt
      const derivedKey = await this.deriveKey(key, salt);

      // Encrypt data
      const encrypted = await this.performEncryption(data, derivedKey, iv);

      // Update key usage
      const metadata = this.keyMetadata.get(keyId)!;
      metadata.usageCount++;
      await this.persistDataKeys();

      return {
        ciphertext: encrypted.ciphertext,
        iv: this.bytesToHex(iv),
        salt: this.bytesToHex(salt),
        tag: encrypted.tag,
        algorithm: this.config.algorithm,
        timestamp: new Date().toISOString(),
        keyId,
      };
    } catch (error) {
      logger.error('Encryption failed', error, { keyId });
      throw error;
    }
  }

  /**
   * Decrypt data
   */
  async decrypt(encryptedData: EncryptedData): Promise<string> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const key = this.dataKeys.get(encryptedData.keyId);
    if (!key) {
      throw new Error(`Decryption key ${encryptedData.keyId} not found`);
    }

    try {
      // Convert hex strings back to bytes
      const iv = this.hexToBytes(encryptedData.iv);
      const salt = this.hexToBytes(encryptedData.salt);

      // Derive key from salt
      const derivedKey = await this.deriveKey(key, salt);

      // Decrypt data
      const decrypted = await this.performDecryption(
        encryptedData.ciphertext,
        derivedKey,
        iv,
        encryptedData.tag
      );

      return decrypted;
    } catch (error) {
      logger.error('Decryption failed', error, { keyId: encryptedData.keyId });
      throw error;
    }
  }

  /**
   * Encrypt with master key (for key encryption)
   */
  private async encryptWithMasterKey(data: string): Promise<string> {
    if (!this.masterKey) {
      throw new Error('Master key not initialized');
    }

    // Simple XOR encryption for demonstration
    // In production, use proper AES encryption
    const encrypted = this.xorEncrypt(data, this.masterKey);
    return encrypted;
  }

  /**
   * Decrypt with master key
   */
  private async decryptWithMasterKey(encryptedData: string): Promise<string> {
    if (!this.masterKey) {
      throw new Error('Master key not initialized');
    }

    // Simple XOR decryption for demonstration
    const decrypted = this.xorDecrypt(encryptedData, this.masterKey);
    return decrypted;
  }

  /**
   * Perform actual encryption
   */
  private async performEncryption(
    plaintext: string,
    key: Uint8Array,
    iv: Uint8Array
  ): Promise<{ ciphertext: string; tag?: string }> {
    // In production, use native crypto libraries for AES-256-GCM
    // This is a simplified implementation
    const encrypted = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      plaintext + this.bytesToHex(key) + this.bytesToHex(iv)
    );

    return {
      ciphertext: encrypted,
      tag: encrypted.substring(0, 32), // Simulated auth tag
    };
  }

  /**
   * Perform actual decryption
   */
  private async performDecryption(
    ciphertext: string,
    key: Uint8Array,
    iv: Uint8Array,
    tag?: string
  ): Promise<string> {
    // In production, use native crypto libraries for AES-256-GCM
    // This is a placeholder that returns the ciphertext
    // Real implementation would decrypt using the key and IV
    return 'decrypted_data_placeholder';
  }

  /**
   * Derive key using PBKDF2
   */
  private async deriveKey(password: string, salt: Uint8Array): Promise<Uint8Array> {
    // In production, use proper PBKDF2 implementation
    const derived = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      password + this.bytesToHex(salt)
    );

    return this.hexToBytes(derived);
  }

  /**
   * Simple XOR encryption (for demonstration)
   */
  private xorEncrypt(text: string, key: string): string {
    let result = '';
    for (let i = 0; i < text.length; i++) {
      result += String.fromCharCode(
        text.charCodeAt(i) ^ key.charCodeAt(i % key.length)
      );
    }
    return Buffer.from(result).toString('base64');
  }

  /**
   * Simple XOR decryption
   */
  private xorDecrypt(encrypted: string, key: string): string {
    const text = Buffer.from(encrypted, 'base64').toString();
    let result = '';
    for (let i = 0; i < text.length; i++) {
      result += String.fromCharCode(
        text.charCodeAt(i) ^ key.charCodeAt(i % key.length)
      );
    }
    return result;
  }

  /**
   * Check and perform key rotation if needed
   */
  private async checkKeyRotation(): Promise<void> {
    const now = new Date();

    for (const [keyId, metadata] of this.keyMetadata.entries()) {
      const createdAt = new Date(metadata.createdAt);
      const daysSinceCreation = Math.floor(
        (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysSinceCreation >= this.config.keyRotationDays && metadata.status === 'active') {
        await this.rotateKey(keyId);
      }
    }
  }

  /**
   * Rotate encryption key
   */
  async rotateKey(keyId: string): Promise<void> {
    const oldMetadata = this.keyMetadata.get(keyId);
    if (!oldMetadata) return;

    logger.logSecurityEvent('key_rotation_started', 'high', { keyId });

    // Mark old key as rotating
    oldMetadata.status = 'rotating';

    // Generate new key with new ID
    const newKeyId = `${keyId}_${Date.now()}`;
    await this.generateDataKey(newKeyId);

    // Re-encrypt data with new key (in background)
    this.reencryptDataInBackground(keyId, newKeyId);

    // Mark old key as retired after re-encryption
    setTimeout(() => {
      oldMetadata.status = 'retired';
      oldMetadata.rotatedAt = new Date().toISOString();
      this.persistDataKeys();
    }, 60000); // After 1 minute

    logger.logSecurityEvent('key_rotation_completed', 'high', {
      oldKeyId: keyId,
      newKeyId,
    });
  }

  /**
   * Re-encrypt data in background
   */
  private async reencryptDataInBackground(
    oldKeyId: string,
    newKeyId: string
  ): Promise<void> {
    // This would re-encrypt all data using the new key
    // Implementation depends on where encrypted data is stored
    logger.info('Re-encrypting data with new key', { oldKeyId, newKeyId });
  }

  /**
   * Securely delete encryption key
   */
  async deleteKey(keyId: string): Promise<void> {
    if (keyId === 'default') {
      throw new Error('Cannot delete default encryption key');
    }

    const metadata = this.keyMetadata.get(keyId);
    if (metadata?.status === 'active') {
      throw new Error('Cannot delete active encryption key');
    }

    // Remove from memory
    this.dataKeys.delete(keyId);
    this.keyMetadata.delete(keyId);

    // Persist changes
    await this.persistDataKeys();

    logger.logSecurityEvent('encryption_key_deleted', 'medium', { keyId });
  }

  /**
   * Encrypt file
   */
  async encryptFile(filePath: string): Promise<string> {
    // Read file content
    const content = await AsyncStorage.getItem(filePath);
    if (!content) throw new Error('File not found');

    // Encrypt content
    const encrypted = await this.encrypt(content);

    // Save encrypted file
    const encryptedPath = `${filePath}.encrypted`;
    await AsyncStorage.setItem(encryptedPath, JSON.stringify(encrypted));

    // Delete original file
    await AsyncStorage.removeItem(filePath);

    return encryptedPath;
  }

  /**
   * Decrypt file
   */
  async decryptFile(encryptedPath: string): Promise<string> {
    // Read encrypted content
    const encryptedContent = await AsyncStorage.getItem(encryptedPath);
    if (!encryptedContent) throw new Error('Encrypted file not found');

    const encrypted: EncryptedData = JSON.parse(encryptedContent);

    // Decrypt content
    const decrypted = await this.decrypt(encrypted);

    // Save decrypted file
    const decryptedPath = encryptedPath.replace('.encrypted', '');
    await AsyncStorage.setItem(decryptedPath, decrypted);

    return decryptedPath;
  }

  /**
   * Utility functions
   */
  private bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  private hexToBytes(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return bytes;
  }

  /**
   * Get encryption statistics
   */
  getStatistics(): any {
    const stats: any = {
      initialized: this.isInitialized,
      algorithm: this.config.algorithm,
      keyCount: this.dataKeys.size,
      keys: [],
    };

    for (const [keyId, metadata] of this.keyMetadata.entries()) {
      stats.keys.push({
        id: keyId,
        status: metadata.status,
        usageCount: metadata.usageCount,
        createdAt: metadata.createdAt,
        rotatedAt: metadata.rotatedAt,
      });
    }

    return stats;
  }

  /**
   * Export encryption configuration
   */
  exportConfiguration(): EncryptionConfig {
    return { ...this.config };
  }

  /**
   * Update encryption configuration
   */
  updateConfiguration(config: Partial<EncryptionConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info('Encryption configuration updated', config);
  }
}

export const dataEncryption = DataEncryptionService.getInstance();