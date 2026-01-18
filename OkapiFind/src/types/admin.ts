// @ts-nocheck
/**
 * Admin Dashboard Types and Interfaces
 * Comprehensive type definitions for admin functionality
 */

// User Management Types
export interface AdminUser {
  id: string;
  email: string;
  displayName?: string;
  phoneNumber?: string;
  photoURL?: string;
  plan: 'free' | 'plus' | 'pro' | 'family';
  status: 'active' | 'suspended' | 'banned' | 'pending_verification';
  createdAt: Date;
  lastLoginAt?: Date;
  lastActiveAt?: Date;
  emailVerified: boolean;
  phoneVerified: boolean;
  totalSessions: number;
  totalParkingSaved: number;
  lifetimeValue: number;
  churnRisk: 'low' | 'medium' | 'high';
  fraudScore: number;
  notes: string[];
  tags: string[];
  location?: {
    country: string;
    city: string;
    timezone: string;
  };
  deviceInfo: {
    platform: string;
    appVersion: string;
    osVersion: string;
    deviceModel: string;
  };
}

// Analytics & Metrics Types
export interface DashboardMetrics {
  realTimeUsers: number;
  totalUsers: number;
  activeUsers: {
    today: number;
    thisWeek: number;
    thisMonth: number;
  };
  newSignups: {
    today: number;
    thisWeek: number;
    thisMonth: number;
  };
  revenue: {
    today: number;
    thisMonth: number;
    mrr: number;
    arr: number;
  };
  churnRate: number;
  conversionRate: number;
  avgSessionDuration: number;
  crashRate: number;
  appStoreRating: number;
  supportTickets: {
    open: number;
    resolved: number;
    avgResponseTime: number;
  };
}

export interface UserSegment {
  id: string;
  name: string;
  description: string;
  criteria: SegmentCriteria;
  userCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface SegmentCriteria {
  plan?: ('free' | 'plus' | 'pro' | 'family')[];
  signupDateRange?: {
    start: Date;
    end: Date;
  };
  lastActiveRange?: {
    start: Date;
    end: Date;
  };
  sessionCountRange?: {
    min: number;
    max: number;
  };
  location?: {
    countries: string[];
    cities: string[];
  };
  churnRisk?: ('low' | 'medium' | 'high')[];
  customEvents?: {
    event: string;
    count: number;
    timeframe: 'day' | 'week' | 'month';
  }[];
}

// Refund Management Types
export interface RefundRequest {
  id: string;
  userId: string;
  user: {
    email: string;
    displayName?: string;
  };
  subscriptionId: string;
  paymentIntentId: string;
  amount: number;
  currency: string;
  reason: RefundReason;
  customerReason?: string;
  status: 'pending' | 'approved' | 'denied' | 'processed' | 'failed';
  requestedAt: Date;
  processedAt?: Date;
  processedBy?: string;
  stripeRefundId?: string;
  isRetentionOffer: boolean;
  retentionOfferType?: 'discount' | 'free_month' | 'plan_downgrade';
  notes: string[];
  attachments: string[];
}

export type RefundReason =
  | 'accidental_purchase'
  | 'not_as_described'
  | 'technical_issues'
  | 'billing_error'
  | 'duplicate_charge'
  | 'fraudulent'
  | 'customer_request'
  | 'app_not_working'
  | 'other';

export interface RefundAnalytics {
  totalRefunds: number;
  totalRefundAmount: number;
  refundRate: number;
  reasonBreakdown: Record<RefundReason, number>;
  monthlyTrend: Array<{
    month: string;
    count: number;
    amount: number;
  }>;
  preventionSuggestions: string[];
}

// Support Ticket Types
export interface SupportTicket {
  id: string;
  ticketNumber: string;
  userId?: string;
  user?: {
    email: string;
    displayName?: string;
    plan: string;
  };
  email: string;
  subject: string;
  message: string;
  category: TicketCategory;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'waiting_for_customer' | 'resolved' | 'closed';
  assignedTo?: string;
  createdAt: Date;
  updatedAt: Date;
  firstResponseAt?: Date;
  resolvedAt?: Date;
  responses: TicketResponse[];
  tags: string[];
  satisfaction?: {
    rating: number;
    feedback?: string;
  };
  escalated: boolean;
  escalatedAt?: Date;
  escalatedReason?: string;
}

export type TicketCategory =
  | 'billing'
  | 'technical_support'
  | 'feature_request'
  | 'bug_report'
  | 'account_issue'
  | 'refund_request'
  | 'general_inquiry'
  | 'privacy_concern'
  | 'abuse_report';

export interface TicketResponse {
  id: string;
  ticketId: string;
  fromAdmin: boolean;
  author: string;
  message: string;
  createdAt: Date;
  attachments: string[];
  internal: boolean; // Internal admin notes
}

// Push Notification Types
export interface PushNotification {
  id: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  audience: NotificationAudience;
  scheduledFor?: Date;
  sentAt?: Date;
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed';
  stats: {
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    failed: number;
  };
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  abTestVariant?: string;
  tags: string[];
}

export interface NotificationAudience {
  type: 'all' | 'segment' | 'individual';
  segmentId?: string;
  userIds?: string[];
  criteria?: {
    platform?: ('ios' | 'android')[];
    plan?: ('free' | 'plus' | 'pro' | 'family')[];
    lastActiveRange?: {
      start: Date;
      end: Date;
    };
    location?: {
      countries: string[];
      timezones: string[];
    };
  };
}

// A/B Testing Types
export interface ABTest {
  id: string;
  name: string;
  description: string;
  status: 'draft' | 'running' | 'paused' | 'completed';
  startDate: Date;
  endDate?: Date;
  variants: ABTestVariant[];
  targetAudience: SegmentCriteria;
  primaryMetric: string;
  secondaryMetrics: string[];
  results?: ABTestResults;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ABTestVariant {
  id: string;
  name: string;
  description: string;
  trafficAllocation: number; // Percentage 0-100
  config: Record<string, any>;
  isControl: boolean;
}

export interface ABTestResults {
  totalParticipants: number;
  variantResults: Array<{
    variantId: string;
    participants: number;
    conversions: number;
    conversionRate: number;
    confidence: number;
    isWinner: boolean;
  }>;
  significanceLevel: number;
  pValue: number;
  endReason: 'time_limit' | 'significance_reached' | 'manual_stop';
}

// Feature Flag Types
export interface FeatureFlag {
  id: string;
  name: string;
  description: string;
  key: string;
  enabled: boolean;
  environments: ('development' | 'staging' | 'production')[];
  rolloutPercentage: number;
  targeting: FeatureFlagTargeting;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  lastModifiedBy: string;
}

export interface FeatureFlagTargeting {
  type: 'percentage' | 'user_list' | 'segment';
  percentage?: number;
  userIds?: string[];
  segmentId?: string;
  rules?: FeatureFlagRule[];
}

export interface FeatureFlagRule {
  attribute: string;
  operator: 'equals' | 'not_equals' | 'in' | 'not_in' | 'greater_than' | 'less_than';
  value: any;
}

// Content Moderation Types
export interface ModerationQueue {
  id: string;
  contentType: 'user_feedback' | 'parking_photo' | 'user_profile' | 'support_message';
  contentId: string;
  userId: string;
  content: any;
  reportReason?: string;
  reportedBy?: string;
  reportedAt?: Date;
  status: 'pending' | 'approved' | 'rejected' | 'escalated';
  reviewedBy?: string;
  reviewedAt?: Date;
  reviewNotes?: string;
  autoModeration?: {
    flagged: boolean;
    confidence: number;
    reasons: string[];
  };
  priority: 'low' | 'medium' | 'high' | 'urgent';
  createdAt: Date;
}

// Fraud Detection Types
export interface FraudAlert {
  id: string;
  userId: string;
  user: {
    email: string;
    displayName?: string;
  };
  alertType: FraudAlertType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  evidence: FraudEvidence;
  status: 'open' | 'investigating' | 'false_positive' | 'confirmed' | 'resolved';
  actionTaken?: string;
  investigatedBy?: string;
  createdAt: Date;
  resolvedAt?: Date;
  notes: string[];
}

export type FraudAlertType =
  | 'multiple_accounts'
  | 'suspicious_payment'
  | 'rapid_signups'
  | 'location_anomaly'
  | 'device_fingerprint_mismatch'
  | 'chargeback_risk'
  | 'velocity_check_failed'
  | 'bot_behavior';

export interface FraudEvidence {
  ipAddress?: string;
  deviceFingerprint?: string;
  paymentMethod?: string;
  locationData?: any;
  behaviorPattern?: string;
  riskScore: number;
  additionalData: Record<string, any>;
}

// Revenue & Analytics Types
export interface RevenueAnalytics {
  mrr: number;
  arr: number;
  growth: {
    mrr: number;
    users: number;
  };
  churn: {
    rate: number;
    reason_breakdown: Record<string, number>;
  };
  ltv: number;
  cac: number;
  payback_period: number;
  cohortAnalysis: CohortData[];
  revenueByPlan: Record<string, number>;
  geographicBreakdown: Array<{
    country: string;
    revenue: number;
    users: number;
  }>;
}

export interface CohortData {
  month: string;
  newUsers: number;
  retention: number[];
  revenue: number[];
}

// Export/Report Types
export interface ExportRequest {
  id: string;
  type: 'users' | 'analytics' | 'revenue' | 'support_tickets' | 'refunds';
  format: 'csv' | 'pdf' | 'json';
  filters: any;
  dateRange: {
    start: Date;
    end: Date;
  };
  status: 'pending' | 'processing' | 'completed' | 'failed';
  fileUrl?: string;
  requestedBy: string;
  requestedAt: Date;
  completedAt?: Date;
  errorMessage?: string;
}

// Compliance Types
export interface ComplianceRequest {
  id: string;
  type: 'data_export' | 'data_deletion' | 'consent_withdrawal';
  userId: string;
  userEmail: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  requestedAt: Date;
  completedAt?: Date;
  dataExportUrl?: string;
  verificationToken: string;
  processedBy?: string;
  notes: string[];
}

// Admin Role Types
export interface AdminRole {
  id: string;
  name: string;
  description: string;
  permissions: AdminPermission[];
  createdAt: Date;
  updatedAt: Date;
}

export type AdminPermission =
  | 'users.view'
  | 'users.edit'
  | 'users.suspend'
  | 'users.delete'
  | 'analytics.view'
  | 'analytics.export'
  | 'revenue.view'
  | 'revenue.refund'
  | 'support.view'
  | 'support.respond'
  | 'support.close'
  | 'notifications.send'
  | 'notifications.schedule'
  | 'features.manage'
  | 'abtest.create'
  | 'abtest.manage'
  | 'moderation.review'
  | 'fraud.investigate'
  | 'compliance.handle'
  | 'admin.manage';

export interface AdminUser {
  id: string;
  email: string;
  displayName: string;
  roleId: string;
  role: AdminRole;
  isActive: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  permissions: AdminPermission[];
  twoFactorEnabled: boolean;
}

// Real-time Dashboard Types
export interface LiveMetrics {
  timestamp: Date;
  activeUsers: number;
  newSignups: number;
  revenue: number;
  errors: number;
  apiLatency: number;
  crashRate: number;
  conversionRate: number;
}

export interface SystemHealth {
  api: {
    status: 'healthy' | 'degraded' | 'down';
    responseTime: number;
    errorRate: number;
  };
  database: {
    status: 'healthy' | 'degraded' | 'down';
    connections: number;
    queryTime: number;
  };
  storage: {
    status: 'healthy' | 'degraded' | 'down';
    usage: number;
    bandwidth: number;
  };
  external_services: Array<{
    name: string;
    status: 'healthy' | 'degraded' | 'down';
    lastCheck: Date;
  }>;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
  filters?: Record<string, any>;
}

// Dashboard Filter Types
export interface DashboardFilters {
  dateRange: {
    start: Date;
    end: Date;
    preset?: 'today' | 'yesterday' | 'last_7_days' | 'last_30_days' | 'last_90_days' | 'custom';
  };
  userSegment?: string;
  platform?: ('ios' | 'android')[];
  plan?: ('free' | 'plus' | 'pro' | 'family')[];
  location?: {
    countries: string[];
    cities: string[];
  };
}

// Event Types for Real-time Updates
export interface DashboardEvent {
  type: 'user_signup' | 'payment_received' | 'support_ticket' | 'fraud_alert' | 'system_alert';
  data: any;
  timestamp: Date;
  severity?: 'info' | 'warning' | 'error' | 'critical';
}

export interface WebSocketMessage {
  type: 'metrics_update' | 'new_event' | 'system_health' | 'alert';
  payload: any;
  timestamp: Date;
}