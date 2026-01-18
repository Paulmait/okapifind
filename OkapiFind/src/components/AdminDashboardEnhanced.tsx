// @ts-nocheck
/**
 * Enhanced Admin Dashboard
 * Comprehensive admin interface with real-time metrics and management tools
 * NOTE: This is a prototype - tables referenced here need to be created in Supabase
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  Alert,
  TouchableOpacity,
  TextInput,
  Modal,
  StyleSheet,
  Dimensions,
  Platform,
} from 'react-native';
import {
  DashboardMetrics,
  AdminUser,
  RefundRequest,
  SupportTicket,
  PushNotification,
  ABTest,
  FeatureFlag,
  FraudAlert,
  LiveMetrics,
  SystemHealth,
} from '../types/admin';
import { supabase } from '../lib/supabase-client';
import { refundService } from '../services/refundService';
import { complianceService } from '../services/complianceService';

const { width } = Dimensions.get('window');

interface AdminDashboardProps {
  adminUser: AdminUser;
  onNavigate: (screen: string, params?: any) => void;
}

const AdminDashboardEnhanced: React.FC<AdminDashboardProps> = ({ adminUser, onNavigate }) => {
  // State management
  const [_metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [liveMetrics, setLiveMetrics] = useState<LiveMetrics | null>(null);
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'overview' | 'users' | 'revenue' | 'support' | 'compliance'>('overview');
  const [isLoading, setIsLoading] = useState(true);

  // Modal states
  const [showUserModal, setShowUserModal] = useState(false);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [_showNotificationModal, setShowNotificationModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [selectedRefund, setSelectedRefund] = useState<RefundRequest | null>(null);

  // Data states
  const [recentUsers, setRecentUsers] = useState<AdminUser[]>([]);
  const [pendingRefunds, setPendingRefunds] = useState<RefundRequest[]>([]);
  const [openTickets, setOpenTickets] = useState<SupportTicket[]>([]);
  const [fraudAlerts, setFraudAlerts] = useState<FraudAlert[]>([]);
  const [_activeTests, setActiveTests] = useState<ABTest[]>([]);
  const [featureFlags, setFeatureFlags] = useState<FeatureFlag[]>([]);

  // Search and filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [_userFilter, _setUserFilter] = useState<'all' | 'active' | 'at_risk' | 'churned'>('all');
  const [_dateRange, _setDateRange] = useState<'today' | 'week' | 'month' | 'quarter'>('week');

  // Real-time updates
  useEffect(() => {
    const setupRealtimeUpdates = () => {
      // Live metrics updates
      const metricsChannel = supabase
        .channel('live-metrics')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'live_metrics' }, (payload: any) => {
          setLiveMetrics(payload.new as LiveMetrics);
        })
        .subscribe();

      // Fraud alerts
      const fraudChannel = supabase
        .channel('fraud-alerts')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'fraud_alerts' }, (payload: any) => {
          const newAlert = payload.new as FraudAlert;
          setFraudAlerts(prev => [newAlert, ...prev]);

          if (newAlert.severity === 'critical') {
            Alert.alert(
              'Critical Fraud Alert',
              `High-risk activity detected for user ${newAlert.user.email}`,
              [{ text: 'Investigate', onPress: () => onNavigate('FraudInvestigation', { alertId: newAlert.id }) }]
            );
          }
        })
        .subscribe();

      // Support tickets
      const ticketsChannel = supabase
        .channel('support-tickets')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'support_tickets' }, (payload: any) => {
          const newTicket = payload.new as SupportTicket;
          setOpenTickets(prev => [newTicket, ...prev]);

          if (newTicket.priority === 'urgent') {
            Alert.alert(
              'Urgent Support Ticket',
              `New urgent ticket: ${newTicket.subject}`,
              [{ text: 'View', onPress: () => onNavigate('SupportTicket', { ticketId: newTicket.id }) }]
            );
          }
        })
        .subscribe();

      return () => {
        supabase.removeChannel(metricsChannel);
        supabase.removeChannel(fraudChannel);
        supabase.removeChannel(ticketsChannel);
      };
    };

    const cleanup = setupRealtimeUpdates();
    return cleanup;
  }, [onNavigate]);

  // Data loading
  const loadDashboardData = useCallback(async () => {
    try {
      setIsLoading(true);

      // Load dashboard metrics
      const [
        metricsData,
        liveData,
        healthData,
        usersData,
        refundsData,
        ticketsData,
        alertsData,
        testsData,
        flagsData,
      ] = await Promise.all([
        fetchDashboardMetrics(),
        fetchLiveMetrics(),
        fetchSystemHealth(),
        fetchRecentUsers(),
        fetchPendingRefunds(),
        fetchOpenTickets(),
        fetchFraudAlerts(),
        fetchActiveTests(),
        fetchFeatureFlags(),
      ]);

      setMetrics(metricsData);
      setLiveMetrics(liveData);
      setSystemHealth(healthData);
      setRecentUsers(usersData);
      setPendingRefunds(refundsData);
      setOpenTickets(ticketsData);
      setFraudAlerts(alertsData);
      setActiveTests(testsData);
      setFeatureFlags(flagsData);

    } catch (error) {
      console.error('Error loading dashboard data:', error);
      Alert.alert('Error', 'Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Refresh handler
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  }, [loadDashboardData]);

  // Data fetching functions
  const fetchDashboardMetrics = async (): Promise<DashboardMetrics> => {
    const { data, error } = await supabase
      .from('dashboard_metrics')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) throw error;
    return data as DashboardMetrics;
  };

  const fetchLiveMetrics = async (): Promise<LiveMetrics> => {
    const { data, error } = await supabase
      .from('live_metrics')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(1)
      .single();

    if (error) throw error;
    return data as LiveMetrics;
  };

  const fetchSystemHealth = async (): Promise<SystemHealth> => {
    const { data, error } = await supabase
      .from('system_health')
      .select('*')
      .order('checked_at', { ascending: false })
      .limit(1)
      .single();

    if (error) throw error;
    return data as SystemHealth;
  };

  const fetchRecentUsers = async (): Promise<AdminUser[]> => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) throw error;
    return data as AdminUser[];
  };

  const fetchPendingRefunds = async (): Promise<RefundRequest[]> => {
    const { refunds } = await refundService.getPendingRefunds(1, 10);
    return refunds;
  };

  const fetchOpenTickets = async (): Promise<SupportTicket[]> => {
    const { data, error } = await supabase
      .from('support_tickets')
      .select('*')
      .in('status', ['open', 'in_progress'])
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) throw error;
    return data as SupportTicket[];
  };

  const fetchFraudAlerts = async (): Promise<FraudAlert[]> => {
    const { data, error } = await supabase
      .from('fraud_alerts')
      .select('*')
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) throw error;
    return data as FraudAlert[];
  };

  const fetchActiveTests = async (): Promise<ABTest[]> => {
    const { data, error } = await supabase
      .from('ab_tests')
      .select('*')
      .eq('status', 'running')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as ABTest[];
  };

  const fetchFeatureFlags = async (): Promise<FeatureFlag[]> => {
    const { data, error } = await supabase
      .from('feature_flags')
      .select('*')
      .eq('enabled', true)
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return data as FeatureFlag[];
  };

  // Action handlers
  const handleUserAction = async (userId: string, action: 'suspend' | 'activate' | 'delete') => {
    try {
      switch (action) {
        case 'suspend':
          await supabase
            .from('users')
            .update({ status: 'suspended' })
            .eq('id', userId);
          break;
        case 'activate':
          await supabase
            .from('users')
            .update({ status: 'active' })
            .eq('id', userId);
          break;
        case 'delete':
          await complianceService.requestDataDeletion(userId, '', 'Admin deletion');
          break;
      }

      await loadDashboardData();
      Alert.alert('Success', `User ${action} completed`);
    } catch (error) {
      Alert.alert('Error', `Failed to ${action} user`);
    }
  };

  const handleRefundAction = async (refundId: string, action: 'approve' | 'deny') => {
    try {
      await refundService.processRefund(
        refundId,
        { action, reason: `${action} by admin` },
        adminUser.id
      );

      await loadDashboardData();
      Alert.alert('Success', `Refund ${action}d successfully`);
    } catch (error) {
      Alert.alert('Error', `Failed to ${action} refund`);
    }
  };

  // @ts-expect-error - Function reserved for future use
  const _handleSendNotification = async (_notification: Partial<PushNotification>) => {
    try {
      await supabase
        .from('push_notifications')
        .insert({
          ..._notification,
          created_by: adminUser.id,
          status: 'scheduled',
        });

      Alert.alert('Success', 'Notification scheduled');
      setShowNotificationModal(false);
    } catch (error) {
      Alert.alert('Error', 'Failed to schedule notification');
    }
  };

  const toggleFeatureFlag = async (flagId: string, enabled: boolean) => {
    try {
      await supabase
        .from('feature_flags')
        .update({ enabled, last_modified_by: adminUser.id })
        .eq('id', flagId);

      await loadDashboardData();
      Alert.alert('Success', `Feature flag ${enabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      Alert.alert('Error', 'Failed to toggle feature flag');
    }
  };

  // Render components
  const renderMetricCard = (title: string, value: string | number, change?: number, color = '#007AFF') => (
    <View style={[styles.metricCard, { borderLeftColor: color }]}>
      <Text style={styles.metricTitle}>{title}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      {change !== undefined && (
        <Text style={[styles.metricChange, { color: change >= 0 ? '#28A745' : '#DC3545' }]}>
          {change >= 0 ? '+' : ''}{change}%
        </Text>
      )}
    </View>
  );

  const renderOverview = () => (
    <ScrollView style={styles.tabContent}>
      {/* Key Metrics */}
      <Text style={styles.sectionTitle}>Live Metrics</Text>
      <View style={styles.metricsGrid}>
        {renderMetricCard('Active Users', liveMetrics?.activeUsers || 0, undefined, '#28A745')}
        {renderMetricCard('Revenue Today', `$${((liveMetrics?.revenue || 0) / 100).toFixed(2)}`, undefined, '#17A2B8')}
        {renderMetricCard('New Signups', liveMetrics?.newSignups || 0, undefined, '#FFC107')}
        {renderMetricCard('Error Rate', `${((liveMetrics?.errors || 0) * 100).toFixed(2)}%`, undefined, '#DC3545')}
      </View>

      {/* System Health */}
      <Text style={styles.sectionTitle}>System Health</Text>
      <View style={styles.healthGrid}>
        <View style={[styles.healthCard, { backgroundColor: systemHealth?.api.status === 'healthy' ? '#D4EDDA' : '#F8D7DA' }]}>
          <Text style={styles.healthTitle}>API</Text>
          <Text style={styles.healthStatus}>{systemHealth?.api.status || 'Unknown'}</Text>
          <Text style={styles.healthDetail}>{systemHealth?.api.responseTime || 0}ms avg</Text>
        </View>
        <View style={[styles.healthCard, { backgroundColor: systemHealth?.database.status === 'healthy' ? '#D4EDDA' : '#F8D7DA' }]}>
          <Text style={styles.healthTitle}>Database</Text>
          <Text style={styles.healthStatus}>{systemHealth?.database.status || 'Unknown'}</Text>
          <Text style={styles.healthDetail}>{systemHealth?.database.connections || 0} connections</Text>
        </View>
      </View>

      {/* Quick Actions */}
      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.quickActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => setShowNotificationModal(true)}
        >
          <Text style={styles.actionButtonText}>Send Notification</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => onNavigate('ABTestCreate')}
        >
          <Text style={styles.actionButtonText}>Create A/B Test</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => onNavigate('AnalyticsExport')}
        >
          <Text style={styles.actionButtonText}>Export Data</Text>
        </TouchableOpacity>
      </View>

      {/* Recent Activity */}
      <Text style={styles.sectionTitle}>Recent Users</Text>
      {recentUsers.slice(0, 5).map(user => (
        <TouchableOpacity
          key={user.id}
          style={styles.listItem}
          onPress={() => {
            setSelectedUser(user);
            setShowUserModal(true);
          }}
        >
          <View style={styles.listItemContent}>
            <Text style={styles.listItemTitle}>{user.email}</Text>
            <Text style={styles.listItemSubtitle}>
              {user.plan} • {user.status} • ${user.lifetimeValue.toFixed(2)} LTV
            </Text>
          </View>
          <View style={[styles.riskIndicator, {
            backgroundColor: user.churnRisk === 'high' ? '#DC3545' :
                           user.churnRisk === 'medium' ? '#FFC107' : '#28A745'
          }]} />
        </TouchableOpacity>
      ))}

      {/* Alerts */}
      {fraudAlerts.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Fraud Alerts</Text>
          {fraudAlerts.slice(0, 3).map(alert => (
            <TouchableOpacity
              key={alert.id}
              style={[styles.listItem, styles.alertItem]}
              onPress={() => onNavigate('FraudInvestigation', { alertId: alert.id })}
            >
              <View style={styles.listItemContent}>
                <Text style={styles.listItemTitle}>{alert.alertType.replace('_', ' ').toUpperCase()}</Text>
                <Text style={styles.listItemSubtitle}>{alert.user.email}</Text>
              </View>
              <View style={[styles.severityBadge, {
                backgroundColor: alert.severity === 'critical' ? '#DC3545' :
                               alert.severity === 'high' ? '#FD7E14' :
                               alert.severity === 'medium' ? '#FFC107' : '#6C757D'
              }]}>
                <Text style={styles.severityText}>{alert.severity}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </>
      )}
    </ScrollView>
  );

  const renderUsers = () => (
    <ScrollView style={styles.tabContent}>
      <View style={styles.filterRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search users..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {recentUsers
        .filter(user =>
          user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (user.displayName && user.displayName.toLowerCase().includes(searchQuery.toLowerCase()))
        )
        .map(user => (
        <TouchableOpacity
          key={user.id}
          style={styles.userCard}
          onPress={() => {
            setSelectedUser(user);
            setShowUserModal(true);
          }}
        >
          <View style={styles.userCardHeader}>
            <Text style={styles.userEmail}>{user.email}</Text>
            <View style={[styles.statusBadge, {
              backgroundColor: user.status === 'active' ? '#28A745' :
                             user.status === 'suspended' ? '#FFC107' : '#DC3545'
            }]}>
              <Text style={styles.statusText}>{user.status}</Text>
            </View>
          </View>
          <View style={styles.userCardBody}>
            <Text>Plan: {user.plan}</Text>
            <Text>Sessions: {user.totalSessions}</Text>
            <Text>LTV: ${user.lifetimeValue.toFixed(2)}</Text>
            <Text>Churn Risk: {user.churnRisk}</Text>
          </View>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  const renderSupport = () => (
    <ScrollView style={styles.tabContent}>
      <Text style={styles.sectionTitle}>Open Tickets ({openTickets.length})</Text>
      {openTickets.map(ticket => (
        <TouchableOpacity
          key={ticket.id}
          style={styles.ticketCard}
          onPress={() => onNavigate('SupportTicket', { ticketId: ticket.id })}
        >
          <View style={styles.ticketHeader}>
            <Text style={styles.ticketSubject}>{ticket.subject}</Text>
            <View style={[styles.priorityBadge, {
              backgroundColor: ticket.priority === 'urgent' ? '#DC3545' :
                             ticket.priority === 'high' ? '#FD7E14' :
                             ticket.priority === 'medium' ? '#FFC107' : '#6C757D'
            }]}>
              <Text style={styles.priorityText}>{ticket.priority}</Text>
            </View>
          </View>
          <Text style={styles.ticketUser}>{ticket.user?.email || ticket.email}</Text>
          <Text style={styles.ticketCategory}>{ticket.category}</Text>
        </TouchableOpacity>
      ))}

      <Text style={styles.sectionTitle}>Pending Refunds ({pendingRefunds.length})</Text>
      {pendingRefunds.map(refund => (
        <TouchableOpacity
          key={refund.id}
          style={styles.refundCard}
          onPress={() => {
            setSelectedRefund(refund);
            setShowRefundModal(true);
          }}
        >
          <View style={styles.refundHeader}>
            <Text style={styles.refundUser}>{refund.user.email}</Text>
            <Text style={styles.refundAmount}>${(refund.amount / 100).toFixed(2)}</Text>
          </View>
          <Text style={styles.refundReason}>Reason: {refund.reason}</Text>
          <Text style={styles.refundDate}>
            Requested: {new Date(refund.requestedAt).toLocaleDateString()}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  const renderCompliance = () => (
    <ScrollView style={styles.tabContent}>
      <Text style={styles.sectionTitle}>Compliance Overview</Text>

      <View style={styles.complianceStats}>
        <View style={styles.complianceStat}>
          <Text style={styles.complianceStatValue}>95%</Text>
          <Text style={styles.complianceStatLabel}>GDPR Compliance</Text>
        </View>
        <View style={styles.complianceStat}>
          <Text style={styles.complianceStatValue}>12</Text>
          <Text style={styles.complianceStatLabel}>Pending Requests</Text>
        </View>
        <View style={styles.complianceStat}>
          <Text style={styles.complianceStatValue}>2.1TB</Text>
          <Text style={styles.complianceStatLabel}>Data Under Management</Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.complianceAction}
        onPress={() => onNavigate('ComplianceRequests')}
      >
        <Text style={styles.complianceActionText}>View All Requests</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.complianceAction}
        onPress={() => onNavigate('DataRetention')}
      >
        <Text style={styles.complianceActionText}>Manage Data Retention</Text>
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>Feature Flags</Text>
      {featureFlags.map(flag => (
        <View key={flag.id} style={styles.flagCard}>
          <View style={styles.flagHeader}>
            <Text style={styles.flagName}>{flag.name}</Text>
            <TouchableOpacity
              style={[styles.flagToggle, { backgroundColor: flag.enabled ? '#28A745' : '#6C757D' }]}
              onPress={() => toggleFeatureFlag(flag.id, !flag.enabled)}
            >
              <Text style={styles.flagToggleText}>{flag.enabled ? 'ON' : 'OFF'}</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.flagDescription}>{flag.description}</Text>
          <Text style={styles.flagRollout}>Rollout: {flag.rolloutPercentage}%</Text>
        </View>
      ))}
    </ScrollView>
  );

  // Tab navigation
  const renderTabContent = () => {
    switch (selectedTab) {
      case 'overview': return renderOverview();
      case 'users': return renderUsers();
      case 'support': return renderSupport();
      case 'compliance': return renderCompliance();
      default: return renderOverview();
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Loading dashboard...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Admin Dashboard</Text>
        <Text style={styles.headerSubtitle}>Welcome back, {adminUser.displayName}</Text>
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabNavigation}>
        {[
          { key: 'overview', label: 'Overview' },
          { key: 'users', label: 'Users' },
          { key: 'support', label: 'Support' },
          { key: 'compliance', label: 'Compliance' },
        ].map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, selectedTab === tab.key && styles.activeTab]}
            onPress={() => setSelectedTab(tab.key as any)}
          >
            <Text style={[styles.tabText, selectedTab === tab.key && styles.activeTabText]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {renderTabContent()}
      </ScrollView>

      {/* User Detail Modal */}
      <Modal visible={showUserModal} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>User Details</Text>
            <TouchableOpacity onPress={() => setShowUserModal(false)}>
              <Text style={styles.modalClose}>Close</Text>
            </TouchableOpacity>
          </View>
          {selectedUser && (
            <ScrollView style={styles.modalContent}>
              <Text style={styles.modalLabel}>Email</Text>
              <Text style={styles.modalValue}>{selectedUser.email}</Text>

              <Text style={styles.modalLabel}>Plan</Text>
              <Text style={styles.modalValue}>{selectedUser.plan}</Text>

              <Text style={styles.modalLabel}>Status</Text>
              <Text style={styles.modalValue}>{selectedUser.status}</Text>

              <Text style={styles.modalLabel}>Lifetime Value</Text>
              <Text style={styles.modalValue}>${selectedUser.lifetimeValue.toFixed(2)}</Text>

              <Text style={styles.modalLabel}>Churn Risk</Text>
              <Text style={styles.modalValue}>{selectedUser.churnRisk}</Text>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.suspendButton]}
                  onPress={() => handleUserAction(selectedUser.id, 'suspend')}
                >
                  <Text style={styles.modalButtonText}>Suspend</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.deleteButton]}
                  onPress={() => handleUserAction(selectedUser.id, 'delete')}
                >
                  <Text style={styles.modalButtonText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}
        </View>
      </Modal>

      {/* Refund Modal */}
      <Modal visible={showRefundModal} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Refund Request</Text>
            <TouchableOpacity onPress={() => setShowRefundModal(false)}>
              <Text style={styles.modalClose}>Close</Text>
            </TouchableOpacity>
          </View>
          {selectedRefund && (
            <ScrollView style={styles.modalContent}>
              <Text style={styles.modalLabel}>User</Text>
              <Text style={styles.modalValue}>{selectedRefund.user.email}</Text>

              <Text style={styles.modalLabel}>Amount</Text>
              <Text style={styles.modalValue}>${(selectedRefund.amount / 100).toFixed(2)}</Text>

              <Text style={styles.modalLabel}>Reason</Text>
              <Text style={styles.modalValue}>{selectedRefund.reason}</Text>

              {selectedRefund.customerReason && (
                <>
                  <Text style={styles.modalLabel}>Customer Reason</Text>
                  <Text style={styles.modalValue}>{selectedRefund.customerReason}</Text>
                </>
              )}

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.approveButton]}
                  onPress={() => handleRefundAction(selectedRefund.id, 'approve')}
                >
                  <Text style={styles.modalButtonText}>Approve</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.denyButton]}
                  onPress={() => handleRefundAction(selectedRefund.id, 'deny')}
                >
                  <Text style={styles.modalButtonText}>Deny</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#212529',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6C757D',
    marginTop: 4,
  },
  tabNavigation: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#007AFF',
  },
  tabText: {
    fontSize: 16,
    color: '#6C757D',
  },
  activeTabText: {
    color: '#007AFF',
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  tabContent: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#212529',
    marginBottom: 16,
    marginTop: 8,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 24,
  },
  metricCard: {
    width: width / 2 - 24,
    margin: 8,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  metricTitle: {
    fontSize: 14,
    color: '#6C757D',
    marginBottom: 8,
  },
  metricValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#212529',
  },
  metricChange: {
    fontSize: 12,
    marginTop: 4,
  },
  healthGrid: {
    flexDirection: 'row',
    marginBottom: 24,
  },
  healthCard: {
    flex: 1,
    margin: 8,
    padding: 16,
    borderRadius: 8,
  },
  healthTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  healthStatus: {
    fontSize: 14,
    textTransform: 'capitalize',
    marginBottom: 4,
  },
  healthDetail: {
    fontSize: 12,
    color: '#6C757D',
  },
  quickActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 24,
  },
  actionButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    margin: 4,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  listItemContent: {
    flex: 1,
  },
  listItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212529',
  },
  listItemSubtitle: {
    fontSize: 14,
    color: '#6C757D',
    marginTop: 4,
  },
  riskIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  alertItem: {
    borderLeftWidth: 4,
    borderLeftColor: '#DC3545',
  },
  severityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  severityText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  filterRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    height: 40,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  userCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  userCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  userEmail: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212529',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  userCardBody: {
    gap: 4,
  },
  ticketCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  ticketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  ticketSubject: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212529',
    flex: 1,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  priorityText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  ticketUser: {
    fontSize: 14,
    color: '#6C757D',
    marginBottom: 4,
  },
  ticketCategory: {
    fontSize: 14,
    color: '#007AFF',
    textTransform: 'capitalize',
  },
  refundCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  refundHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  refundUser: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212529',
  },
  refundAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#DC3545',
  },
  refundReason: {
    fontSize: 14,
    color: '#6C757D',
    marginBottom: 4,
  },
  refundDate: {
    fontSize: 12,
    color: '#6C757D',
  },
  complianceStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 24,
  },
  complianceStat: {
    alignItems: 'center',
  },
  complianceStatValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  complianceStatLabel: {
    fontSize: 12,
    color: '#6C757D',
    textAlign: 'center',
  },
  complianceAction: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  complianceActionText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  flagCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  flagHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  flagName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212529',
  },
  flagToggle: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  flagToggleText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  flagDescription: {
    fontSize: 14,
    color: '#6C757D',
    marginBottom: 4,
  },
  flagRollout: {
    fontSize: 12,
    color: '#007AFF',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#212529',
  },
  modalClose: {
    fontSize: 16,
    color: '#007AFF',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6C757D',
    marginTop: 16,
    marginBottom: 8,
  },
  modalValue: {
    fontSize: 16,
    color: '#212529',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  modalButton: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  suspendButton: {
    backgroundColor: '#FFC107',
  },
  deleteButton: {
    backgroundColor: '#DC3545',
  },
  approveButton: {
    backgroundColor: '#28A745',
  },
  denyButton: {
    backgroundColor: '#DC3545',
  },
});

export default AdminDashboardEnhanced;