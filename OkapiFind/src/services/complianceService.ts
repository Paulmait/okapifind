// @ts-nocheck
/**
 * Compliance Service
 * Handles GDPR/CCPA compliance, data export, deletion, and consent management
 */

import { supabase } from '../config/supabase';
import { ComplianceRequest } from '../types/admin';
import CryptoJS from 'crypto-js';

interface DataExportOptions {
  format: 'json' | 'csv' | 'pdf';
  includeAnalytics: boolean;
  includePersonalData: boolean;
  includeTransactionData: boolean;
  dateRange?: {
    start: Date;
    end: Date;
  };
}

interface ConsentRecord {
  userId: string;
  consentType: 'analytics' | 'marketing' | 'cookies' | 'data_processing';
  granted: boolean;
  timestamp: Date;
  version: string;
  ipAddress?: string;
  userAgent?: string;
  source: 'app' | 'web' | 'email' | 'support';
}

interface AuditLog {
  id: string;
  userId?: string;
  action: string;
  resource: string;
  details: any;
  performedBy: string;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
  complianceRelated: boolean;
}

interface DataRetentionPolicy {
  dataType: string;
  retentionPeriodDays: number;
  description: string;
  legalBasis: string;
  autoDelete: boolean;
  notificationBefore: number; // Days before deletion
}

class ComplianceService {
  private static instance: ComplianceService;
  private encryptionKey: string;

  constructor() {
    this.encryptionKey = process.env.COMPLIANCE_ENCRYPTION_KEY || 'default-key';
  }

  static getInstance(): ComplianceService {
    if (!ComplianceService.instance) {
      ComplianceService.instance = new ComplianceService();
    }
    return ComplianceService.instance;
  }

  /**
   * Handle GDPR data export request
   */
  async requestDataExport(
    userId: string,
    userEmail: string,
    options: DataExportOptions = {
      format: 'json',
      includeAnalytics: true,
      includePersonalData: true,
      includeTransactionData: true,
    }
  ): Promise<ComplianceRequest> {
    try {
      // Create compliance request
      const request: Partial<ComplianceRequest> = {
        type: 'data_export',
        userId,
        userEmail,
        status: 'pending',
        requestedAt: new Date(),
        verificationToken: this.generateVerificationToken(),
        notes: [`Export format: ${options.format}`, `Options: ${JSON.stringify(options)}`],
      };

      const { data: complianceRequest, error } = await supabase
        .from('compliance_requests')
        .insert(request)
        .select()
        .single();

      if (error) throw error;

      // Log audit event
      await this.logAuditEvent({
        userId,
        action: 'data_export_requested',
        resource: 'user_data',
        details: { requestId: complianceRequest.id, options },
        performedBy: userId,
        complianceRelated: true,
      });

      // Send verification email
      await this.sendVerificationEmail(complianceRequest, 'data_export');

      // Start async processing
      this.processDataExport(complianceRequest.id, options);

      return complianceRequest as ComplianceRequest;

    } catch (error) {
      console.error('[ComplianceService] Error requesting data export:', error);
      throw error;
    }
  }

  /**
   * Handle right to deletion request
   */
  async requestDataDeletion(
    userId: string,
    userEmail: string,
    reason?: string
  ): Promise<ComplianceRequest> {
    try {
      // Create compliance request
      const request: Partial<ComplianceRequest> = {
        type: 'data_deletion',
        userId,
        userEmail,
        status: 'pending',
        requestedAt: new Date(),
        verificationToken: this.generateVerificationToken(),
        notes: reason ? [`Reason: ${reason}`] : [],
      };

      const { data: complianceRequest, error } = await supabase
        .from('compliance_requests')
        .insert(request)
        .select()
        .single();

      if (error) throw error;

      // Log audit event
      await this.logAuditEvent({
        userId,
        action: 'data_deletion_requested',
        resource: 'user_data',
        details: { requestId: complianceRequest.id, reason },
        performedBy: userId,
        complianceRelated: true,
      });

      // Send verification email
      await this.sendVerificationEmail(complianceRequest, 'data_deletion');

      return complianceRequest as ComplianceRequest;

    } catch (error) {
      console.error('[ComplianceService] Error requesting data deletion:', error);
      throw error;
    }
  }

  /**
   * Handle consent withdrawal
   */
  async withdrawConsent(
    userId: string,
    userEmail: string,
    consentTypes: string[]
  ): Promise<ComplianceRequest> {
    try {
      // Create compliance request
      const request: Partial<ComplianceRequest> = {
        type: 'consent_withdrawal',
        userId,
        userEmail,
        status: 'pending',
        requestedAt: new Date(),
        verificationToken: this.generateVerificationToken(),
        notes: [`Withdrawing consent for: ${consentTypes.join(', ')}`],
      };

      const { data: complianceRequest, error } = await supabase
        .from('compliance_requests')
        .insert(request)
        .select()
        .single();

      if (error) throw error;

      // Log audit event
      await this.logAuditEvent({
        userId,
        action: 'consent_withdrawn',
        resource: 'user_consent',
        details: { requestId: complianceRequest.id, consentTypes },
        performedBy: userId,
        complianceRelated: true,
      });

      // Process consent withdrawal immediately
      await this.processConsentWithdrawal(userId, consentTypes);

      // Update status
      await supabase
        .from('compliance_requests')
        .update({
          status: 'completed',
          completedAt: new Date(),
        })
        .eq('id', complianceRequest.id);

      return complianceRequest as ComplianceRequest;

    } catch (error) {
      console.error('[ComplianceService] Error withdrawing consent:', error);
      throw error;
    }
  }

  /**
   * Verify and process compliance request
   */
  async verifyAndProcess(
    requestId: string,
    verificationToken: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Get compliance request
      const { data: request } = await supabase
        .from('compliance_requests')
        .select('*')
        .eq('id', requestId)
        .eq('verification_token', verificationToken)
        .single();

      if (!request) {
        return { success: false, message: 'Invalid verification token' };
      }

      if (request.status !== 'pending') {
        return { success: false, message: 'Request already processed' };
      }

      // Check if token expired (30 days)
      const tokenAge = Date.now() - new Date(request.requested_at).getTime();
      const thirtyDays = 30 * 24 * 60 * 60 * 1000;

      if (tokenAge > thirtyDays) {
        return { success: false, message: 'Verification token expired' };
      }

      // Process based on request type
      let result: { success: boolean; message: string };

      switch (request.type) {
        case 'data_export':
          result = await this.completeDataExport(request.id);
          break;
        case 'data_deletion':
          result = await this.completeDataDeletion(request.id);
          break;
        case 'consent_withdrawal':
          result = { success: true, message: 'Consent withdrawal already processed' };
          break;
        default:
          result = { success: false, message: 'Unknown request type' };
      }

      // Log audit event
      await this.logAuditEvent({
        userId: request.user_id,
        action: 'compliance_request_verified',
        resource: 'compliance_request',
        details: { requestId, type: request.type, result },
        performedBy: request.user_id,
        complianceRelated: true,
      });

      return result;

    } catch (error) {
      console.error('[ComplianceService] Error verifying request:', error);
      return { success: false, message: 'Verification failed' };
    }
  }

  /**
   * Record user consent
   */
  async recordConsent(
    userId: string,
    consentType: ConsentRecord['consentType'],
    granted: boolean,
    version: string,
    source: ConsentRecord['source'] = 'app',
    metadata?: any
  ): Promise<void> {
    try {
      const consentRecord: Partial<ConsentRecord> = {
        userId,
        consentType,
        granted,
        timestamp: new Date(),
        version,
        source,
        ipAddress: metadata?.ipAddress,
        userAgent: metadata?.userAgent,
      };

      await supabase
        .from('user_consent_history')
        .insert(consentRecord);

      // Update current consent status
      await supabase
        .from('user_consent')
        .upsert({
          user_id: userId,
          [`${consentType}_consent`]: granted,
          [`${consentType}_consent_date`]: new Date(),
          consent_version: version,
        });

      // Log audit event
      await this.logAuditEvent({
        userId,
        action: `consent_${granted ? 'granted' : 'revoked'}`,
        resource: 'user_consent',
        details: { consentType, version, source },
        performedBy: userId,
        complianceRelated: true,
      });

    } catch (error) {
      console.error('[ComplianceService] Error recording consent:', error);
      throw error;
    }
  }

  /**
   * Get user consent history
   */
  async getConsentHistory(userId: string): Promise<ConsentRecord[]> {
    try {
      const { data, error } = await supabase
        .from('user_consent_history')
        .select('*')
        .eq('user_id', userId)
        .order('timestamp', { ascending: false });

      if (error) throw error;

      return data as ConsentRecord[];

    } catch (error) {
      console.error('[ComplianceService] Error getting consent history:', error);
      return [];
    }
  }

  /**
   * Generate privacy report for user
   */
  async generatePrivacyReport(userId: string): Promise<any> {
    try {
      // Get user data summary
      const userDataSummary = await this.getUserDataSummary(userId);

      // Get consent history
      const consentHistory = await this.getConsentHistory(userId);

      // Get data processing activities
      const processingActivities = await this.getProcessingActivities(userId);

      // Get data sharing information
      const dataSharingInfo = await this.getDataSharingInfo();

      // Get retention policies
      const retentionPolicies = await this.getRetentionPolicies();

      return {
        userId,
        generatedAt: new Date(),
        dataSummary: userDataSummary,
        consentHistory,
        processingActivities,
        dataSharingInfo,
        retentionPolicies,
        rights: {
          dataPortability: 'You can request a copy of your data',
          dataRectification: 'You can request correction of inaccurate data',
          dataErasure: 'You can request deletion of your data',
          processingRestriction: 'You can request to limit how we process your data',
          dataObjection: 'You can object to certain data processing',
        },
      };

    } catch (error) {
      console.error('[ComplianceService] Error generating privacy report:', error);
      throw error;
    }
  }

  /**
   * Check data retention and auto-delete expired data
   */
  async enforceDataRetention(): Promise<void> {
    try {
      const retentionPolicies = await this.getRetentionPolicies();

      for (const policy of retentionPolicies) {
        if (policy.autoDelete) {
          await this.deleteExpiredData(policy);
        }
      }

    } catch (error) {
      console.error('[ComplianceService] Error enforcing data retention:', error);
    }
  }

  /**
   * Log audit event
   */
  async logAuditEvent(event: Omit<AuditLog, 'id' | 'timestamp'>): Promise<void> {
    try {
      const auditLog: Partial<AuditLog> = {
        ...event,
        timestamp: new Date(),
      };

      await supabase
        .from('audit_logs')
        .insert(auditLog);

    } catch (error) {
      console.error('[ComplianceService] Error logging audit event:', error);
    }
  }

  /**
   * Get compliance dashboard metrics
   */
  async getComplianceDashboard(): Promise<any> {
    try {
      // Get pending requests
      const { data: pendingRequests } = await supabase
        .from('compliance_requests')
        .select('*')
        .eq('status', 'pending');

      // Get consent statistics
      const { data: consentStats } = await supabase
        .from('user_consent')
        .select('analytics_consent, marketing_consent, cookies_consent');

      // Calculate consent rates
      const totalUsers = consentStats?.length || 0;
      const consentRates = {
        analytics: totalUsers > 0 ? (consentStats?.filter(u => u.analytics_consent).length || 0) / totalUsers : 0,
        marketing: totalUsers > 0 ? (consentStats?.filter(u => u.marketing_consent).length || 0) / totalUsers : 0,
        cookies: totalUsers > 0 ? (consentStats?.filter(u => u.cookies_consent).length || 0) / totalUsers : 0,
      };

      // Get recent audit events
      const { data: recentAudits } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('compliance_related', true)
        .order('timestamp', { ascending: false })
        .limit(10);

      return {
        pendingRequests: pendingRequests?.length || 0,
        consentRates,
        recentAudits: recentAudits || [],
        dataRetentionStatus: await this.getDataRetentionStatus(),
      };

    } catch (error) {
      console.error('[ComplianceService] Error getting compliance dashboard:', error);
      throw error;
    }
  }

  // Private helper methods

  private async processDataExport(
    requestId: string,
    options: DataExportOptions
  ): Promise<void> {
    try {
      // Update status to processing
      await supabase
        .from('compliance_requests')
        .update({ status: 'processing' })
        .eq('id', requestId);

      // Get request details
      const { data: request } = await supabase
        .from('compliance_requests')
        .select('*')
        .eq('id', requestId)
        .single();

      if (!request) throw new Error('Request not found');

      // Collect user data
      const userData = await this.collectUserData(request.user_id, options);

      // Generate export file
      const exportUrl = await this.generateExportFile(userData, options.format);

      // Update request with file URL
      await supabase
        .from('compliance_requests')
        .update({
          status: 'completed',
          completed_at: new Date(),
          data_export_url: exportUrl,
        })
        .eq('id', requestId);

      // Send completion notification
      await this.sendCompletionNotification(request, 'data_export');

    } catch (error) {
      console.error('[ComplianceService] Error processing data export:', error);

      // Update request with error
      await supabase
        .from('compliance_requests')
        .update({
          status: 'failed',
          notes: ['Export processing failed'],
        })
        .eq('id', requestId);
    }
  }

  private async completeDataExport(requestId: string): Promise<{ success: boolean; message: string }> {
    try {
      const { data: request } = await supabase
        .from('compliance_requests')
        .select('*')
        .eq('id', requestId)
        .single();

      if (!request) {
        return { success: false, message: 'Request not found' };
      }

      if (request.data_export_url) {
        return {
          success: true,
          message: `Your data export is ready for download: ${request.data_export_url}`,
        };
      } else {
        return { success: false, message: 'Data export not yet ready' };
      }

    } catch (error) {
      return { success: false, message: 'Failed to complete data export' };
    }
  }

  private async completeDataDeletion(requestId: string): Promise<{ success: boolean; message: string }> {
    try {
      const { data: request } = await supabase
        .from('compliance_requests')
        .select('*')
        .eq('id', requestId)
        .single();

      if (!request) {
        return { success: false, message: 'Request not found' };
      }

      // Perform data deletion
      await this.deleteUserData(request.user_id);

      // Update request status
      await supabase
        .from('compliance_requests')
        .update({
          status: 'completed',
          completed_at: new Date(),
          processed_by: 'system',
        })
        .eq('id', requestId);

      return { success: true, message: 'Your data has been successfully deleted' };

    } catch (error) {
      console.error('[ComplianceService] Error completing data deletion:', error);
      return { success: false, message: 'Failed to delete data' };
    }
  }

  private async processConsentWithdrawal(
    userId: string,
    consentTypes: string[]
  ): Promise<void> {
    try {
      const updates: any = {};

      consentTypes.forEach(type => {
        updates[`${type}_consent`] = false;
        updates[`${type}_consent_date`] = new Date();
      });

      await supabase
        .from('user_consent')
        .upsert({
          user_id: userId,
          ...updates,
        });

      // If analytics consent withdrawn, anonymize data
      if (consentTypes.includes('analytics')) {
        await this.anonymizeAnalyticsData(userId);
      }

    } catch (error) {
      console.error('[ComplianceService] Error processing consent withdrawal:', error);
      throw error;
    }
  }

  private async collectUserData(
    userId: string,
    options: DataExportOptions
  ): Promise<any> {
    const userData: any = { userId, exportedAt: new Date() };

    // Personal data
    if (options.includePersonalData) {
      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      userData.profile = this.sanitizePersonalData(profile);
    }

    // Transaction data
    if (options.includeTransactionData) {
      const { data: transactions } = await supabase
        .from('payments')
        .select('*')
        .eq('user_id', userId);

      userData.transactions = transactions || [];
    }

    // Analytics data
    if (options.includeAnalytics) {
      const { data: analytics } = await supabase
        .from('analytics_events')
        .select('*')
        .eq('user_id', userId);

      userData.analytics = analytics || [];
    }

    return userData;
  }

  private async generateExportFile(
    userData: any,
    format: 'json' | 'csv' | 'pdf'
  ): Promise<string> {
    // In a real implementation, you would:
    // 1. Convert data to the requested format
    // 2. Upload to secure storage (with expiration)
    // 3. Return signed URL

    // For now, return a placeholder URL
    return `https://storage.okapifind.com/exports/${userData.userId}_${Date.now()}.${format}`;
  }

  private async deleteUserData(userId: string): Promise<void> {
    const tables = [
      'users',
      'user_sessions',
      'parking_sessions',
      'analytics_events',
      'user_feedback',
      'support_tickets',
      'payments',
      'subscriptions',
    ];

    for (const table of tables) {
      await supabase
        .from(table)
        .delete()
        .eq('user_id', userId);
    }

    // Keep audit logs for compliance
    await this.logAuditEvent({
      userId,
      action: 'user_data_deleted',
      resource: 'user_data',
      details: { reason: 'GDPR_deletion_request' },
      performedBy: 'system',
      complianceRelated: true,
    });
  }

  private async anonymizeAnalyticsData(userId: string): Promise<void> {
    await supabase
      .from('analytics_events')
      .update({ user_id: null, anonymized: true })
      .eq('user_id', userId);
  }

  private sanitizePersonalData(data: any): any {
    if (!data) return null;

    // Remove sensitive fields
    const sanitized = { ...data };
    delete sanitized.password_hash;
    delete sanitized.two_factor_secret;
    delete sanitized.reset_tokens;

    return sanitized;
  }

  private async getUserDataSummary(userId: string): Promise<any> {
    // Implementation would count data across all tables
    return {
      personalData: 'Profile information, preferences',
      analyticsData: 'App usage, feature interactions',
      transactionData: 'Payment history, subscriptions',
      supportData: 'Support tickets, feedback',
    };
  }

  private async getProcessingActivities(userId: string): Promise<any[]> {
    return [
      {
        purpose: 'Service Provision',
        legalBasis: 'Contract',
        dataCategories: ['Profile', 'Usage'],
        retention: '2 years after account closure',
      },
      {
        purpose: 'Analytics',
        legalBasis: 'Legitimate Interest',
        dataCategories: ['Usage Analytics'],
        retention: '1 year',
      },
    ];
  }

  private async getDataSharingInfo(): Promise<any> {
    return {
      categories: [
        {
          category: 'Service Providers',
          purpose: 'Payment processing, analytics',
          recipients: ['Stripe', 'Firebase'],
          safeguards: 'Data Processing Agreements',
        },
      ],
    };
  }

  private async getRetentionPolicies(): Promise<DataRetentionPolicy[]> {
    return [
      {
        dataType: 'user_analytics',
        retentionPeriodDays: 365,
        description: 'User analytics and usage data',
        legalBasis: 'Legitimate interest',
        autoDelete: true,
        notificationBefore: 30,
      },
      {
        dataType: 'support_tickets',
        retentionPeriodDays: 1095, // 3 years
        description: 'Customer support communications',
        legalBasis: 'Contract',
        autoDelete: false,
        notificationBefore: 90,
      },
    ];
  }

  private async deleteExpiredData(policy: DataRetentionPolicy): Promise<void> {
    const cutoffDate = new Date(Date.now() - policy.retentionPeriodDays * 24 * 60 * 60 * 1000);

    // Delete data older than retention period
    await supabase
      .from(policy.dataType)
      .delete()
      .lt('created_at', cutoffDate.toISOString());

    // Log retention enforcement
    await this.logAuditEvent({
      action: 'data_retention_enforced',
      resource: policy.dataType,
      details: { policy: policy.dataType, cutoffDate },
      performedBy: 'system',
      complianceRelated: true,
    });
  }

  private async getDataRetentionStatus(): Promise<any> {
    // Implementation would check data age across tables
    return {
      totalRecords: 150000,
      expiringSoon: 1200,
      autoDeleteEnabled: true,
      lastCleanup: new Date(Date.now() - 24 * 60 * 60 * 1000),
    };
  }

  private generateVerificationToken(): string {
    return CryptoJS.SHA256(`${Date.now()}_${Math.random()}`).toString();
  }

  private async sendVerificationEmail(
    request: any,
    type: 'data_export' | 'data_deletion'
  ): Promise<void> {
    // Implementation would send verification email
    console.log(`[ComplianceService] Would send ${type} verification email to ${request.user_email}`);
  }

  private async sendCompletionNotification(
    request: any,
    type: 'data_export' | 'data_deletion'
  ): Promise<void> {
    // Implementation would send completion notification
    console.log(`[ComplianceService] Would send ${type} completion notification to ${request.user_email}`);
  }
}

export const complianceService = ComplianceService.getInstance();
export default ComplianceService;