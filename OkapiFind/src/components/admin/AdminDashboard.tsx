import React, { useState, useEffect } from 'react';
import { BrandConfig } from '../../config/brand';
import { ResponsiveLayout, Card, Button } from '../web/ResponsiveLayout';

interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  totalDevices: number;
  totalLocations: number;
  totalSessions: number;
  averageSessionDuration: number;
  totalParkingSaved: number;
  totalNavigations: number;
  revenueToday: number;
  revenueMonth: number;
  errorRate: number;
  crashRate: number;
}

interface UserMetrics {
  userId: string;
  email: string;
  deviceId: string;
  lastActive: Date;
  totalSessions: number;
  locationsTracked: number;
  parkingSaved: number;
  platform: string;
  country: string;
  city: string;
  isPremium: boolean;
}

interface LocationHeatmap {
  lat: number;
  lng: number;
  weight: number;
  timestamp: Date;
}

export const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [users, setUsers] = useState<UserMetrics[]>([]);
  const [_locations, setLocations] = useState<LocationHeatmap[]>([]);
  const [_selectedUser, setSelectedUser] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState({ start: new Date(), end: new Date() });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'locations' | 'analytics' | 'export'>('overview');
  const [refreshInterval, setRefreshInterval] = useState(30000);

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [statsRes, usersRes, locationsRes] = await Promise.all([
        fetch('/api/admin/stats', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` }
        }),
        fetch('/api/admin/users', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` }
        }),
        fetch('/api/admin/locations', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` }
        })
      ]);

      const statsData = await statsRes.json();
      const usersData = await usersRes.json();
      const locationsData = await locationsRes.json();

      setStats(statsData);
      setUsers(usersData);
      setLocations(locationsData);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportData = async (format: 'csv' | 'json' | 'excel') => {
    try {
      const response = await fetch(`/api/admin/export?format=${format}&start=${dateRange.start.toISOString()}&end=${dateRange.end.toISOString()}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` }
      });

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `okapifind-data-${Date.now()}.${format}`;
      a.click();
    } catch (error) {
      console.error('Failed to export data:', error);
    }
  };

  const styles = {
    dashboard: {
      padding: BrandConfig.spacing.xl,
      backgroundColor: BrandConfig.colors.background.secondary,
      minHeight: '100vh',
    },
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: BrandConfig.spacing.xl,
      backgroundColor: BrandConfig.colors.white,
      padding: BrandConfig.spacing.lg,
      borderRadius: BrandConfig.borderRadius.lg,
      boxShadow: BrandConfig.shadows.md.web,
    },
    title: {
      fontSize: BrandConfig.fonts.sizes['3xl'].web,
      fontWeight: BrandConfig.fonts.weights.bold,
      color: BrandConfig.colors.text.primary,
    },
    tabs: {
      display: 'flex',
      gap: BrandConfig.spacing.md,
      marginBottom: BrandConfig.spacing.xl,
      borderBottom: `2px solid ${BrandConfig.colors.gray[200]}`,
    },
    tab: {
      padding: `${BrandConfig.spacing.md}px ${BrandConfig.spacing.lg}px`,
      background: 'none',
      border: 'none',
      fontSize: BrandConfig.fonts.sizes.base.web,
      fontWeight: BrandConfig.fonts.weights.medium,
      color: BrandConfig.colors.text.secondary,
      cursor: 'pointer',
      borderBottom: '2px solid transparent',
      marginBottom: '-2px',
      transition: 'all 0.2s',
    },
    activeTab: {
      color: BrandConfig.colors.primary,
      borderBottomColor: BrandConfig.colors.primary,
    },
    statsGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
      gap: BrandConfig.spacing.lg,
      marginBottom: BrandConfig.spacing.xl,
    },
    statCard: {
      backgroundColor: BrandConfig.colors.white,
      padding: BrandConfig.spacing.lg,
      borderRadius: BrandConfig.borderRadius.lg,
      boxShadow: BrandConfig.shadows.sm.web,
    },
    statValue: {
      fontSize: BrandConfig.fonts.sizes['3xl'].web,
      fontWeight: BrandConfig.fonts.weights.bold,
      color: BrandConfig.colors.primary,
      marginBottom: BrandConfig.spacing.xs,
    },
    statLabel: {
      fontSize: BrandConfig.fonts.sizes.sm.web,
      color: BrandConfig.colors.text.secondary,
    },
    statChange: {
      fontSize: BrandConfig.fonts.sizes.xs.web,
      marginTop: BrandConfig.spacing.sm,
      display: 'flex',
      alignItems: 'center',
      gap: BrandConfig.spacing.xs,
    },
    changePositive: {
      color: BrandConfig.colors.success,
    },
    changeNegative: {
      color: BrandConfig.colors.error,
    },
    userTable: {
      width: '100%',
      backgroundColor: BrandConfig.colors.white,
      borderRadius: BrandConfig.borderRadius.lg,
      overflow: 'hidden',
      boxShadow: BrandConfig.shadows.md.web,
    },
    tableHeader: {
      backgroundColor: BrandConfig.colors.gray[50],
      padding: BrandConfig.spacing.md,
      fontWeight: BrandConfig.fonts.weights.semibold,
      fontSize: BrandConfig.fonts.sizes.sm.web,
      color: BrandConfig.colors.text.secondary,
      textTransform: 'uppercase' as const,
      letterSpacing: '0.5px',
    },
    tableRow: {
      display: 'grid',
      gridTemplateColumns: '2fr 2fr 1fr 1fr 1fr 1fr 1fr 1fr',
      padding: BrandConfig.spacing.md,
      borderBottom: `1px solid ${BrandConfig.colors.gray[200]}`,
      alignItems: 'center',
      transition: 'background-color 0.2s',
    },
    tableCell: {
      fontSize: BrandConfig.fonts.sizes.sm.web,
      color: BrandConfig.colors.text.primary,
    },
    mapContainer: {
      height: '500px',
      borderRadius: BrandConfig.borderRadius.lg,
      overflow: 'hidden',
      marginBottom: BrandConfig.spacing.xl,
    },
    chartContainer: {
      backgroundColor: BrandConfig.colors.white,
      padding: BrandConfig.spacing.xl,
      borderRadius: BrandConfig.borderRadius.lg,
      boxShadow: BrandConfig.shadows.md.web,
      marginBottom: BrandConfig.spacing.xl,
    },
    exportSection: {
      backgroundColor: BrandConfig.colors.white,
      padding: BrandConfig.spacing.xl,
      borderRadius: BrandConfig.borderRadius.lg,
      boxShadow: BrandConfig.shadows.md.web,
    },
    exportButtons: {
      display: 'flex',
      gap: BrandConfig.spacing.md,
      marginTop: BrandConfig.spacing.lg,
    },
    filters: {
      display: 'flex',
      gap: BrandConfig.spacing.md,
      marginBottom: BrandConfig.spacing.lg,
    },
    input: {
      padding: `${BrandConfig.spacing.sm}px ${BrandConfig.spacing.md}px`,
      border: `1px solid ${BrandConfig.colors.gray[300]}`,
      borderRadius: BrandConfig.borderRadius.md,
      fontSize: BrandConfig.fonts.sizes.sm.web,
    },
    badge: {
      padding: `${BrandConfig.spacing.xs}px ${BrandConfig.spacing.sm}px`,
      borderRadius: BrandConfig.borderRadius.full,
      fontSize: BrandConfig.fonts.sizes.xs.web,
      fontWeight: BrandConfig.fonts.weights.medium,
    },
    premiumBadge: {
      backgroundColor: BrandConfig.colors.secondary,
      color: BrandConfig.colors.white,
    },
    activeBadge: {
      backgroundColor: BrandConfig.colors.success,
      color: BrandConfig.colors.white,
    },
    inactiveBadge: {
      backgroundColor: BrandConfig.colors.gray[300],
      color: BrandConfig.colors.white,
    },
  };

  const renderOverview = () => (
    <>
      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <div style={styles.statValue}>
            {stats?.totalUsers.toLocaleString() || '0'}
          </div>
          <div style={styles.statLabel}>Total Users</div>
          <div style={{ ...styles.statChange, ...styles.changePositive }}>
            ↑ 12% from last week
          </div>
        </div>

        <div style={styles.statCard}>
          <div style={styles.statValue}>
            {stats?.activeUsers.toLocaleString() || '0'}
          </div>
          <div style={styles.statLabel}>Active Users (24h)</div>
          <div style={{ ...styles.statChange, ...styles.changePositive }}>
            ↑ 8% from yesterday
          </div>
        </div>

        <div style={styles.statCard}>
          <div style={styles.statValue}>
            {stats?.totalLocations.toLocaleString() || '0'}
          </div>
          <div style={styles.statLabel}>Locations Tracked</div>
          <div style={{ ...styles.statChange, ...styles.changePositive }}>
            ↑ 23% growth
          </div>
        </div>

        <div style={styles.statCard}>
          <div style={styles.statValue}>
            {stats?.totalParkingSaved.toLocaleString() || '0'}
          </div>
          <div style={styles.statLabel}>Parking Spots Saved</div>
          <div style={{ ...styles.statChange, ...styles.changePositive }}>
            ↑ 15% this month
          </div>
        </div>

        <div style={styles.statCard}>
          <div style={styles.statValue}>
            ${stats?.revenueToday.toLocaleString() || '0'}
          </div>
          <div style={styles.statLabel}>Revenue Today</div>
          <div style={{ ...styles.statChange, ...styles.changePositive }}>
            ↑ $500 from yesterday
          </div>
        </div>

        <div style={styles.statCard}>
          <div style={styles.statValue}>
            ${stats?.revenueMonth.toLocaleString() || '0'}
          </div>
          <div style={styles.statLabel}>Revenue This Month</div>
          <div style={{ ...styles.statChange, ...styles.changePositive }}>
            ↑ 18% MoM
          </div>
        </div>

        <div style={styles.statCard}>
          <div style={styles.statValue}>
            {((stats?.averageSessionDuration || 0) / 60000).toFixed(1)}m
          </div>
          <div style={styles.statLabel}>Avg Session Duration</div>
          <div style={{ ...styles.statChange, ...styles.changeNegative }}>
            ↓ 2% from last week
          </div>
        </div>

        <div style={styles.statCard}>
          <div style={styles.statValue}>
            {(stats?.errorRate || 0).toFixed(2)}%
          </div>
          <div style={styles.statLabel}>Error Rate</div>
          <div style={{ ...styles.statChange, ...styles.changePositive }}>
            ↓ 0.5% improvement
          </div>
        </div>
      </div>

      <Card title="Real-time Activity Map">
        <div style={styles.mapContainer}>
          {/* Map would be rendered here with location heatmap */}
          <div style={{ padding: '20px', textAlign: 'center' }}>
            Live location heatmap visualization
          </div>
        </div>
      </Card>
    </>
  );

  const renderUsers = () => (
    <div style={styles.userTable}>
      <div style={styles.tableRow}>
        <div style={styles.tableHeader}>User ID</div>
        <div style={styles.tableHeader}>Email</div>
        <div style={styles.tableHeader}>Device</div>
        <div style={styles.tableHeader}>Platform</div>
        <div style={styles.tableHeader}>Sessions</div>
        <div style={styles.tableHeader}>Locations</div>
        <div style={styles.tableHeader}>Status</div>
        <div style={styles.tableHeader}>Actions</div>
      </div>

      {users.map((user) => (
        <div
          key={user.userId}
          style={styles.tableRow}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = BrandConfig.colors.gray[50];
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <div style={styles.tableCell}>{user.userId.substring(0, 8)}...</div>
          <div style={styles.tableCell}>{user.email}</div>
          <div style={styles.tableCell}>{user.deviceId.substring(0, 8)}...</div>
          <div style={styles.tableCell}>{user.platform}</div>
          <div style={styles.tableCell}>{user.totalSessions}</div>
          <div style={styles.tableCell}>{user.locationsTracked}</div>
          <div style={styles.tableCell}>
            {user.isPremium ? (
              <span style={{ ...styles.badge, ...styles.premiumBadge }}>Premium</span>
            ) : (
              <span style={{ ...styles.badge, ...styles.activeBadge }}>Active</span>
            )}
          </div>
          <div style={styles.tableCell}>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSelectedUser(user.userId)}
            >
              View Details
            </Button>
          </div>
        </div>
      ))}
    </div>
  );

  const renderExport = () => (
    <div style={styles.exportSection}>
      <h3 style={{ marginBottom: BrandConfig.spacing.lg }}>Export Data</h3>

      <div style={styles.filters}>
        <input
          type="date"
          style={styles.input}
          onChange={(e) => setDateRange({ ...dateRange, start: new Date(e.target.value) })}
        />
        <input
          type="date"
          style={styles.input}
          onChange={(e) => setDateRange({ ...dateRange, end: new Date(e.target.value) })}
        />
        <select style={styles.input}>
          <option>All Users</option>
          <option>Premium Users</option>
          <option>Active Users</option>
        </select>
      </div>

      <div style={styles.exportButtons}>
        <Button onClick={() => exportData('csv')}>Export as CSV</Button>
        <Button onClick={() => exportData('json')}>Export as JSON</Button>
        <Button onClick={() => exportData('excel')}>Export as Excel</Button>
        <Button variant="secondary">Generate Report</Button>
      </div>
    </div>
  );

  const sidebar = (
    <div style={{ padding: BrandConfig.spacing.lg }}>
      <h3 style={{ marginBottom: BrandConfig.spacing.lg }}>Quick Actions</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: BrandConfig.spacing.sm }}>
        <Button fullWidth onClick={() => setRefreshInterval(5000)}>
          Refresh (5s)
        </Button>
        <Button fullWidth onClick={() => setRefreshInterval(30000)}>
          Refresh (30s)
        </Button>
        <Button fullWidth variant="outline">Send Notification</Button>
        <Button fullWidth variant="outline">View Logs</Button>
        <Button fullWidth variant="outline">System Health</Button>
      </div>
    </div>
  );

  return (
    <ResponsiveLayout sidebar={sidebar}>
      <div style={styles.dashboard}>
        <div style={styles.header}>
          <h1 style={styles.title}>Admin Dashboard</h1>
          <div style={{ display: 'flex', gap: BrandConfig.spacing.md }}>
            <span>Last updated: {new Date().toLocaleTimeString()}</span>
            <Button size="sm" onClick={fetchDashboardData}>Refresh</Button>
          </div>
        </div>

        <div style={styles.tabs}>
          <button
            style={{ ...styles.tab, ...(activeTab === 'overview' ? styles.activeTab : {}) }}
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </button>
          <button
            style={{ ...styles.tab, ...(activeTab === 'users' ? styles.activeTab : {}) }}
            onClick={() => setActiveTab('users')}
          >
            Users
          </button>
          <button
            style={{ ...styles.tab, ...(activeTab === 'locations' ? styles.activeTab : {}) }}
            onClick={() => setActiveTab('locations')}
          >
            Locations
          </button>
          <button
            style={{ ...styles.tab, ...(activeTab === 'analytics' ? styles.activeTab : {}) }}
            onClick={() => setActiveTab('analytics')}
          >
            Analytics
          </button>
          <button
            style={{ ...styles.tab, ...(activeTab === 'export' ? styles.activeTab : {}) }}
            onClick={() => setActiveTab('export')}
          >
            Export
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '50px' }}>Loading...</div>
        ) : (
          <>
            {activeTab === 'overview' && renderOverview()}
            {activeTab === 'users' && renderUsers()}
            {activeTab === 'export' && renderExport()}
          </>
        )}
      </div>
    </ResponsiveLayout>
  );
};