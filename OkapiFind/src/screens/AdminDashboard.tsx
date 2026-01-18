// @ts-nocheck
import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  Text,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LineChart, BarChart, PieChart } from 'react-native-chart-kit';
import { collection, query, where, orderBy, limit, getDocs, Timestamp } from 'firebase/firestore';
import { firebaseFirestore } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import { colors } from '../theme/colors';

const { width: screenWidth } = Dimensions.get('window');

interface AnalyticsData {
  dailyActiveUsers: number;
  monthlyActiveUsers: number;
  conversionRate: number;
  avgSessionDuration: number;
  topFeatures: { name: string; usage: number }[];
  revenue: {
    mrr: number;
    arr: number;
    avgRevenuePerUser: number;
    churnRate: number;
  };
  userSegments: {
    free: number;
    plus: number;
    pro: number;
    family: number;
  };
  parkingStats: {
    totalSessions: number;
    avgParkingDuration: number;
    successRate: number;
    aiPredictionAccuracy: number;
  };
}

export const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData>({
    dailyActiveUsers: 0,
    monthlyActiveUsers: 0,
    conversionRate: 0,
    avgSessionDuration: 0,
    topFeatures: [],
    revenue: {
      mrr: 0,
      arr: 0,
      avgRevenuePerUser: 0,
      churnRate: 0,
    },
    userSegments: {
      free: 0,
      plus: 0,
      pro: 0,
      family: 0,
    },
    parkingStats: {
      totalSessions: 0,
      avgParkingDuration: 0,
      successRate: 0,
      aiPredictionAccuracy: 0,
    },
  });

  // Check if user is admin
  const isAdmin = user?.email && [
    'admin@okapifind.com',
    'ceo@okapifind.com',
    'analytics@okapifind.com'
  ].includes(user.email);

  useEffect(() => {
    if (isAdmin) {
      loadAnalytics();
    }
  }, [isAdmin]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);

      // Get current date ranges
      const now = new Date();
      const todayStart = new Date(now.setHours(0, 0, 0, 0));
      const thirtyDaysAgo = new Date(now.setDate(now.getDate() - 30));

      // Fetch Daily Active Users
      const dauQuery = query(
        collection(firebaseFirestore, 'analytics_events'),
        where('timestamp', '>=', Timestamp.fromDate(todayStart)),
        where('event', '==', 'app_open')
      );
      const dauSnapshot = await getDocs(dauQuery);
      const uniqueDAU = new Set(dauSnapshot.docs.map(doc => doc.data().userId));

      // Fetch Monthly Active Users
      const mauQuery = query(
        collection(firebaseFirestore, 'analytics_events'),
        where('timestamp', '>=', Timestamp.fromDate(thirtyDaysAgo)),
        where('event', '==', 'app_open')
      );
      const mauSnapshot = await getDocs(mauQuery);
      const uniqueMAU = new Set(mauSnapshot.docs.map(doc => doc.data().userId));

      // Fetch Revenue Data
      const subscriptionsQuery = query(
        collection(firebaseFirestore, 'subscriptions'),
        where('status', '==', 'active')
      );
      const subscriptionsSnapshot = await getDocs(subscriptionsQuery);

      let monthlyRevenue = 0;
      const segments = { free: 0, plus: 0, pro: 0, family: 0 };

      subscriptionsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        switch (data.plan) {
          case 'plus':
            monthlyRevenue += 2.99;
            segments.plus++;
            break;
          case 'pro':
            monthlyRevenue += 4.99;
            segments.pro++;
            break;
          case 'family':
            monthlyRevenue += 7.99;
            segments.family++;
            break;
          default:
            segments.free++;
        }
      });

      // Fetch Parking Statistics
      const parkingQuery = query(
        collection(firebaseFirestore, 'parking_sessions'),
        where('timestamp', '>=', Timestamp.fromDate(thirtyDaysAgo)),
        orderBy('timestamp', 'desc'),
        limit(1000)
      );
      const parkingSnapshot = await getDocs(parkingQuery);

      let totalDuration = 0;
      let successfulSessions = 0;
      let aiCorrectPredictions = 0;

      parkingSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.duration) totalDuration += data.duration;
        if (data.successful) successfulSessions++;
        if (data.aiPredictionCorrect) aiCorrectPredictions++;
      });

      // Calculate conversion rate (simplified)
      const totalUsers = uniqueMAU.size;
      const paidUsers = segments.plus + segments.pro + segments.family;
      const conversionRate = totalUsers > 0 ? (paidUsers / totalUsers) * 100 : 0;

      // Feature usage (mock data for demonstration)
      const topFeatures = [
        { name: 'Smart AI', usage: 85 },
        { name: 'Save Location', usage: 72 },
        { name: 'Timer', usage: 68 },
        { name: 'Photo', usage: 45 },
        { name: 'Widget', usage: 38 },
      ];

      setAnalyticsData({
        dailyActiveUsers: uniqueDAU.size,
        monthlyActiveUsers: uniqueMAU.size,
        conversionRate: parseFloat(conversionRate.toFixed(2)),
        avgSessionDuration: 8.5, // minutes (mock)
        topFeatures,
        revenue: {
          mrr: monthlyRevenue,
          arr: monthlyRevenue * 12,
          avgRevenuePerUser: paidUsers > 0 ? monthlyRevenue / paidUsers : 0,
          churnRate: 2.8, // % (mock)
        },
        userSegments: segments,
        parkingStats: {
          totalSessions: parkingSnapshot.size,
          avgParkingDuration: parkingSnapshot.size > 0 ? totalDuration / parkingSnapshot.size : 0,
          successRate: parkingSnapshot.size > 0 ? (successfulSessions / parkingSnapshot.size) * 100 : 0,
          aiPredictionAccuracy: parkingSnapshot.size > 0 ? (aiCorrectPredictions / parkingSnapshot.size) * 100 : 0,
        },
      });
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadAnalytics();
  };

  if (!isAdmin) {
    return (
      <View style={styles.container}>
        <View style={styles.accessDenied}>
          <MaterialCommunityIcons name="shield-lock" size={64} color={colors.error} />
          <Text style={styles.accessDeniedText}>Admin Access Required</Text>
          <Text style={styles.accessDeniedSubtext}>
            This dashboard is only available to authorized administrators.
          </Text>
        </View>
      </View>
    );
  }

  const chartConfig = {
    backgroundColor: colors.surface,
    backgroundGradientFrom: colors.surface,
    backgroundGradientTo: colors.surface,
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(33, 150, 243, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
    style: {
      borderRadius: 16,
    },
    propsForDots: {
      r: '6',
      strokeWidth: '2',
      stroke: colors.primary,
    },
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.header}>
        <Text style={styles.title}>Admin Analytics Dashboard</Text>
        <Text style={styles.subtitle}>Real-time metrics and insights</Text>
      </View>

      {/* Key Metrics Cards */}
      <View style={styles.metricsGrid}>
        <View style={styles.metricCard}>
          <MaterialCommunityIcons name="account-group" size={24} color={colors.primary} />
          <Text style={styles.metricValue}>{analyticsData.dailyActiveUsers}</Text>
          <Text style={styles.metricLabel}>Daily Active Users</Text>
        </View>

        <View style={styles.metricCard}>
          <MaterialCommunityIcons name="trending-up" size={24} color={colors.success} />
          <Text style={styles.metricValue}>{analyticsData.monthlyActiveUsers}</Text>
          <Text style={styles.metricLabel}>Monthly Active Users</Text>
        </View>

        <View style={styles.metricCard}>
          <MaterialCommunityIcons name="percent" size={24} color={colors.warning} />
          <Text style={styles.metricValue}>{analyticsData.conversionRate}%</Text>
          <Text style={styles.metricLabel}>Conversion Rate</Text>
        </View>

        <View style={styles.metricCard}>
          <MaterialCommunityIcons name="clock-outline" size={24} color={colors.info} />
          <Text style={styles.metricValue}>{analyticsData.avgSessionDuration}m</Text>
          <Text style={styles.metricLabel}>Avg Session</Text>
        </View>
      </View>

      {/* Revenue Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Revenue Metrics</Text>
        <View style={styles.revenueGrid}>
          <View style={styles.revenueCard}>
            <Text style={styles.revenueLabel}>MRR</Text>
            <Text style={styles.revenueValue}>${analyticsData.revenue.mrr.toFixed(2)}</Text>
          </View>
          <View style={styles.revenueCard}>
            <Text style={styles.revenueLabel}>ARR</Text>
            <Text style={styles.revenueValue}>${analyticsData.revenue.arr.toFixed(2)}</Text>
          </View>
          <View style={styles.revenueCard}>
            <Text style={styles.revenueLabel}>ARPU</Text>
            <Text style={styles.revenueValue}>${analyticsData.revenue.avgRevenuePerUser.toFixed(2)}</Text>
          </View>
          <View style={styles.revenueCard}>
            <Text style={styles.revenueLabel}>Churn</Text>
            <Text style={styles.revenueValue}>{analyticsData.revenue.churnRate}%</Text>
          </View>
        </View>
      </View>

      {/* User Segments Pie Chart */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>User Segments</Text>
        <PieChart
          data={[
            { name: 'Free', population: analyticsData.userSegments.free, color: '#9E9E9E', legendFontColor: '#7F7F7F' },
            { name: 'Plus', population: analyticsData.userSegments.plus, color: '#4CAF50', legendFontColor: '#7F7F7F' },
            { name: 'Pro', population: analyticsData.userSegments.pro, color: '#2196F3', legendFontColor: '#7F7F7F' },
            { name: 'Family', population: analyticsData.userSegments.family, color: '#9C27B0', legendFontColor: '#7F7F7F' },
          ]}
          width={screenWidth - 32}
          height={200}
          chartConfig={chartConfig}
          accessor="population"
          backgroundColor="transparent"
          paddingLeft="15"
          absolute
        />
      </View>

      {/* Feature Usage */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Top Features</Text>
        <BarChart
          data={{
            labels: analyticsData.topFeatures.map(f => f.name),
            datasets: [{
              data: analyticsData.topFeatures.map(f => f.usage)
            }]
          }}
          width={screenWidth - 32}
          height={220}
          yAxisLabel=""
          yAxisSuffix="%"
          chartConfig={chartConfig}
          style={styles.chart}
        />
      </View>

      {/* Parking Statistics */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Parking Intelligence</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <MaterialCommunityIcons name="car" size={20} color={colors.primary} />
            <Text style={styles.statValue}>{analyticsData.parkingStats.totalSessions}</Text>
            <Text style={styles.statLabel}>Total Sessions</Text>
          </View>
          <View style={styles.statCard}>
            <MaterialCommunityIcons name="timer" size={20} color={colors.warning} />
            <Text style={styles.statValue}>{analyticsData.parkingStats.avgParkingDuration.toFixed(1)}h</Text>
            <Text style={styles.statLabel}>Avg Duration</Text>
          </View>
          <View style={styles.statCard}>
            <MaterialCommunityIcons name="check-circle" size={20} color={colors.success} />
            <Text style={styles.statValue}>{analyticsData.parkingStats.successRate.toFixed(1)}%</Text>
            <Text style={styles.statLabel}>Success Rate</Text>
          </View>
          <View style={styles.statCard}>
            <MaterialCommunityIcons name="brain" size={20} color={colors.info} />
            <Text style={styles.statValue}>{analyticsData.parkingStats.aiPredictionAccuracy.toFixed(1)}%</Text>
            <Text style={styles.statLabel}>AI Accuracy</Text>
          </View>
        </View>
      </View>

      {/* Export Button */}
      <TouchableOpacity style={styles.exportButton}>
        <MaterialCommunityIcons name="download" size={20} color="#fff" />
        <Text style={styles.exportButtonText}>Export Full Report</Text>
      </TouchableOpacity>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    padding: 16,
    backgroundColor: colors.primary,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  subtitle: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
    marginTop: 4,
  },
  accessDenied: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  accessDeniedText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: 16,
  },
  accessDeniedSubtext: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 8,
  },
  metricCard: {
    width: '50%',
    padding: 8,
  },
  metricValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: 8,
  },
  metricLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 16,
  },
  revenueGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  revenueCard: {
    width: '50%',
    padding: 12,
    backgroundColor: colors.surface,
    borderRadius: 8,
    marginBottom: 8,
  },
  revenueLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  revenueValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.primary,
    marginTop: 4,
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  statCard: {
    width: '50%',
    padding: 12,
    backgroundColor: colors.surface,
    borderRadius: 8,
    marginBottom: 8,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: 8,
  },
  statLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 4,
  },
  exportButton: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    padding: 16,
    margin: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  exportButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});