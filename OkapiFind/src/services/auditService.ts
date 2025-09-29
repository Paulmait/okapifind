/**
 * Comprehensive Audit Logging Service
 * Tracks all admin actions, user activities, and system events
 * Immutable audit trail for compliance and security
 */

import crypto from 'crypto';

export enum AuditEventType {
  // Authentication Events
  LOGIN_SUCCESS = 'login_success',
  LOGIN_FAILURE = 'login_failure',
  LOGOUT = 'logout',
  PASSWORD_CHANGE = 'password_change',
  PASSWORD_RESET = 'password_reset',
  TWO_FACTOR_ENABLED = '2fa_enabled',
  TWO_FACTOR_DISABLED = '2fa_disabled',
  TWO_FACTOR_FAILURE = '2fa_failure',

  // User Management
  USER_CREATED = 'user_created',
  USER_UPDATED = 'user_updated',
  USER_DELETED = 'user_deleted',
  USER_SUSPENDED = 'user_suspended',
  USER_BANNED = 'user_banned',
  USER_RESTORED = 'user_restored',
  USER_ROLE_CHANGED = 'user_role_changed',
  USER_PERMISSION_CHANGED = 'user_permission_changed',

  // Data Access
  DATA_VIEWED = 'data_viewed',
  DATA_EXPORTED = 'data_exported',
  DATA_DELETED = 'data_deleted',
  DATA_MODIFIED = 'data_modified',
  BULK_DATA_ACCESS = 'bulk_data_access',
  SENSITIVE_DATA_ACCESS = 'sensitive_data_access',

  // Financial Transactions
  PAYMENT_PROCESSED = 'payment_processed',
  REFUND_ISSUED = 'refund_issued',
  SUBSCRIPTION_CREATED = 'subscription_created',
  SUBSCRIPTION_CANCELLED = 'subscription_cancelled',
  INVOICE_GENERATED = 'invoice_generated',
  DISPUTE_HANDLED = 'dispute_handled',

  // Security Events
  UNAUTHORIZED_ACCESS = 'unauthorized_access',
  PERMISSION_DENIED = 'permission_denied',
  SUSPICIOUS_ACTIVITY = 'suspicious_activity',
  BRUTE_FORCE_ATTEMPT = 'brute_force_attempt',
  API_LIMIT_EXCEEDED = 'api_limit_exceeded',
  SECURITY_ALERT = 'security_alert',
  VULNERABILITY_DETECTED = 'vulnerability_detected',

  // System Events
  SYSTEM_CONFIG_CHANGED = 'system_config_changed',
  DEPLOYMENT = 'deployment',
  BACKUP_CREATED = 'backup_created',
  BACKUP_RESTORED = 'backup_restored',
  MAINTENANCE_MODE = 'maintenance_mode',
  SERVICE_RESTART = 'service_restart',

  // Compliance Events
  GDPR_REQUEST = 'gdpr_request',
  DATA_DELETION_REQUEST = 'data_deletion_request',
  DATA_EXPORT_REQUEST = 'data_export_request',
  CONSENT_UPDATED = 'consent_updated',
  PRIVACY_SETTINGS_CHANGED = 'privacy_settings_changed',

  // Admin Actions
  ADMIN_OVERRIDE = 'admin_override',
  ADMIN_IMPERSONATION = 'admin_impersonation',
  ADMIN_DATA_ACCESS = 'admin_data_access',
  ADMIN_SETTINGS_CHANGED = 'admin_settings_changed'
}

export enum AuditSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

export interface AuditLog {
  id: string;
  timestamp: Date;
  eventType: AuditEventType;
  severity: AuditSeverity;
  userId?: string;
  adminId?: string;
  targetUserId?: string;
  ipAddress: string;
  userAgent: string;
  sessionId?: string;
  action: string;
  resource?: string;
  oldValue?: any;
  newValue?: any;
  reason?: string;
  metadata: Record<string, any>;
  success: boolean;
  errorMessage?: string;
  hash: string; // For integrity verification
  previousHash?: string; // Blockchain-like integrity
}

export class AuditService {
  private auditQueue: AuditLog[] = [];
  private batchSize = 100;
  private flushInterval = 10000; // 10 seconds
  private flushTimer?: NodeJS.Timeout;
  private lastHash: string = '';
  private encryptionKey: string;
  private retentionDays = 2555; // 7 years for compliance

  constructor() {
    this.encryptionKey = process.env.AUDIT_ENCRYPTION_KEY || '';
    this.initialize();
  }

  private async initialize() {
    // Start periodic flush
    this.startPeriodicFlush();

    // Load last hash for chain integrity
    await this.loadLastHash();

    // Set up emergency flush on process exit
    this.setupEmergencyFlush();
  }

  public async log(
    eventType: AuditEventType,
    data: Partial<AuditLog>
  ): Promise<void> {
    const auditLog: AuditLog = {
      id: this.generateAuditId(),
      timestamp: new Date(),
      eventType,
      severity: this.determineSeverity(eventType),
      ipAddress: await this.getClientIP(),
      userAgent: navigator.userAgent,
      sessionId: sessionStorage.getItem('sessionId') || undefined,
      action: data.action || eventType,
      success: data.success !== false,
      metadata: data.metadata || {},
      previousHash: this.lastHash,
      hash: '', // Will be set below
      ...data
    };

    // Generate hash for integrity
    auditLog.hash = this.generateHash(auditLog);
    this.lastHash = auditLog.hash;

    // Add to queue
    this.auditQueue.push(auditLog);

    // Check if immediate flush needed
    if (this.isHighPriority(eventType) || this.auditQueue.length >= this.batchSize) {
      await this.flush();
    }

    // Alert on critical events
    if (auditLog.severity === AuditSeverity.CRITICAL) {
      await this.alertSecurityTeam(auditLog);
    }
  }

  private generateAuditId(): string {
    return `audit_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  private generateHash(log: Omit<AuditLog, 'hash'>): string {
    const data = JSON.stringify({
      ...log,
      previousHash: this.lastHash
    });

    return crypto
      .createHash('sha256')
      .update(data)
      .digest('hex');
  }

  private determineSeverity(eventType: AuditEventType): AuditSeverity {
    const criticalEvents = [
      AuditEventType.UNAUTHORIZED_ACCESS,
      AuditEventType.DATA_DELETED,
      AuditEventType.USER_BANNED,
      AuditEventType.SECURITY_ALERT,
      AuditEventType.VULNERABILITY_DETECTED,
      AuditEventType.ADMIN_OVERRIDE,
      AuditEventType.ADMIN_IMPERSONATION
    ];

    const warningEvents = [
      AuditEventType.LOGIN_FAILURE,
      AuditEventType.TWO_FACTOR_FAILURE,
      AuditEventType.PERMISSION_DENIED,
      AuditEventType.SUSPICIOUS_ACTIVITY,
      AuditEventType.API_LIMIT_EXCEEDED,
      AuditEventType.BRUTE_FORCE_ATTEMPT
    ];

    const errorEvents = [
      AuditEventType.PAYMENT_PROCESSED,
      AuditEventType.REFUND_ISSUED,
      AuditEventType.DATA_DELETION_REQUEST
    ];

    if (criticalEvents.includes(eventType)) return AuditSeverity.CRITICAL;
    if (warningEvents.includes(eventType)) return AuditSeverity.WARNING;
    if (errorEvents.includes(eventType)) return AuditSeverity.ERROR;
    return AuditSeverity.INFO;
  }

  private isHighPriority(eventType: AuditEventType): boolean {
    return [
      AuditEventType.UNAUTHORIZED_ACCESS,
      AuditEventType.DATA_DELETED,
      AuditEventType.USER_BANNED,
      AuditEventType.SECURITY_ALERT,
      AuditEventType.ADMIN_OVERRIDE,
      AuditEventType.REFUND_ISSUED
    ].includes(eventType);
  }

  private startPeriodicFlush() {
    this.flushTimer = setInterval(async () => {
      if (this.auditQueue.length > 0) {
        await this.flush();
      }
    }, this.flushInterval);
  }

  private async flush() {
    if (this.auditQueue.length === 0) return;

    const logs = [...this.auditQueue];
    this.auditQueue = [];

    try {
      // Encrypt sensitive data
      const encryptedLogs = logs.map(log => this.encryptSensitiveData(log));

      const response = await fetch('/api/audit/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Audit-Hash': this.lastHash,
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        },
        body: JSON.stringify(encryptedLogs)
      });

      if (!response.ok) {
        // Store failed logs for retry
        this.storeFailedLogs(logs);
      }
    } catch (error) {
      console.error('Failed to flush audit logs:', error);
      this.storeFailedLogs(logs);
    }
  }

  private encryptSensitiveData(log: AuditLog): AuditLog {
    // Encrypt PII and sensitive fields
    const sensitiveFields = ['email', 'phone', 'ssn', 'creditCard', 'password'];
    const encrypted = { ...log };

    if (encrypted.metadata) {
      Object.keys(encrypted.metadata).forEach(key => {
        if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
          encrypted.metadata[key] = this.encrypt(encrypted.metadata[key]);
        }
      });
    }

    return encrypted;
  }

  private encrypt(data: string): string {
    if (!this.encryptionKey) return data;

    const cipher = crypto.createCipher('aes-256-gcm', this.encryptionKey);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
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

  private async loadLastHash() {
    try {
      const response = await fetch('/api/audit/last-hash', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        this.lastHash = data.hash;
      }
    } catch (error) {
      console.error('Failed to load last audit hash:', error);
    }
  }

  private storeFailedLogs(logs: AuditLog[]) {
    try {
      const existing = JSON.parse(localStorage.getItem('failedAuditLogs') || '[]');
      const combined = [...existing, ...logs];

      // Keep only last 1000 failed logs
      if (combined.length > 1000) {
        combined.splice(0, combined.length - 1000);
      }

      localStorage.setItem('failedAuditLogs', JSON.stringify(combined));
    } catch (error) {
      console.error('Failed to store audit logs locally:', error);
    }
  }

  private async alertSecurityTeam(log: AuditLog) {
    try {
      await fetch('/api/security/alert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Priority': 'high'
        },
        body: JSON.stringify({
          alert: 'Critical Security Event',
          log,
          timestamp: new Date().toISOString()
        })
      });
    } catch (error) {
      console.error('Failed to alert security team:', error);
    }
  }

  private setupEmergencyFlush() {
    // Flush on page unload
    window.addEventListener('beforeunload', () => {
      if (this.auditQueue.length > 0) {
        const logs = JSON.stringify(this.auditQueue);
        navigator.sendBeacon('/api/audit/emergency', logs);
      }
    });

    // Flush on visibility change
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.auditQueue.length > 0) {
        this.flush();
      }
    });
  }

  // Query methods for audit logs
  public async searchLogs(
    criteria: {
      startDate?: Date;
      endDate?: Date;
      userId?: string;
      eventType?: AuditEventType;
      severity?: AuditSeverity;
      searchTerm?: string;
    }
  ): Promise<AuditLog[]> {
    const params = new URLSearchParams();

    if (criteria.startDate) params.append('startDate', criteria.startDate.toISOString());
    if (criteria.endDate) params.append('endDate', criteria.endDate.toISOString());
    if (criteria.userId) params.append('userId', criteria.userId);
    if (criteria.eventType) params.append('eventType', criteria.eventType);
    if (criteria.severity) params.append('severity', criteria.severity);
    if (criteria.searchTerm) params.append('search', criteria.searchTerm);

    try {
      const response = await fetch(`/api/audit/search?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        }
      });

      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.error('Failed to search audit logs:', error);
    }

    return [];
  }

  public async verifyIntegrity(
    startId: string,
    endId: string
  ): Promise<boolean> {
    try {
      const response = await fetch('/api/audit/verify-integrity', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        },
        body: JSON.stringify({ startId, endId })
      });

      if (response.ok) {
        const result = await response.json();
        return result.valid;
      }
    } catch (error) {
      console.error('Failed to verify audit integrity:', error);
    }

    return false;
  }

  public async generateComplianceReport(
    startDate: Date,
    endDate: Date,
    format: 'pdf' | 'csv' | 'json'
  ): Promise<Blob | null> {
    try {
      const response = await fetch('/api/audit/compliance-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        },
        body: JSON.stringify({
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          format
        })
      });

      if (response.ok) {
        return await response.blob();
      }
    } catch (error) {
      console.error('Failed to generate compliance report:', error);
    }

    return null;
  }

  // Helper methods for common audit scenarios
  public async logAdminAction(
    adminId: string,
    action: string,
    targetUserId: string,
    metadata: Record<string, any>
  ) {
    await this.log(AuditEventType.ADMIN_DATA_ACCESS, {
      adminId,
      action,
      targetUserId,
      metadata,
      success: true
    });
  }

  public async logSecurityEvent(
    eventType: AuditEventType,
    userId: string,
    details: string,
    metadata?: Record<string, any>
  ) {
    await this.log(eventType, {
      userId,
      action: details,
      metadata: metadata || {},
      severity: AuditSeverity.WARNING
    });
  }

  public async logDataAccess(
    userId: string,
    resource: string,
    action: 'view' | 'export' | 'modify' | 'delete',
    metadata?: Record<string, any>
  ) {
    const eventMap = {
      view: AuditEventType.DATA_VIEWED,
      export: AuditEventType.DATA_EXPORTED,
      modify: AuditEventType.DATA_MODIFIED,
      delete: AuditEventType.DATA_DELETED
    };

    await this.log(eventMap[action], {
      userId,
      resource,
      action,
      metadata: metadata || {},
      success: true
    });
  }
}

// Export singleton instance
export const auditService = new AuditService();