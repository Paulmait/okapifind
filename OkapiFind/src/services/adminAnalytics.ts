/**
 * Admin Analytics Service
 * Server-side analytics aggregation and reporting
 */

import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  setDoc,
  doc,
  Timestamp,
  increment,
  DocumentData,
} from 'firebase/firestore';
import { firebaseFirestore } from '../config/firebase';

interface UserMetrics {
  userId: string;
  email: string;
  plan: 'free' | 'plus' | 'pro' | 'family';
  signupDate: Date;
  lastActive: Date;
  parkingSessions: number;
  aiPredictionsUsed: number;
  totalParkingHours: number;
  successRate: number;
  lifetimeValue: number;
  churnRisk: 'low' | 'medium' | 'high';
}

interface CohortAnalysis {
  cohortMonth: string;
  totalUsers: number;
  retentionRates: {
    month1: number;
    month3: number;
    month6: number;
    month12: number;
  };
  conversionRate: number;
  avgLifetimeValue: number;
}

interface FeatureAdoption {
  feature: string;
  totalUsers: number;
  adoptionRate: number;
  avgUsagePerUser: number;
  retentionImpact: number;
  revenueImpact: number;
}

interface RevenueMetrics {
  date: Date;
  mrr: number;
  arr: number;
  newMRR: number;
  churnedMRR: number;
  expansionMRR: number;
  contractionMRR: number;
  netMRR: number;
  avgRevenuePerUser: number;
  customerAcquisitionCost: number;
  lifetimeValue: number;
  ltv_cac_ratio: number;
}

class AdminAnalyticsService {
  private static instance: AdminAnalyticsService;

  static getInstance(): AdminAnalyticsService {
    if (!AdminAnalyticsService.instance) {
      AdminAnalyticsService.instance = new AdminAnalyticsService();
    }
    return AdminAnalyticsService.instance;
  }

  /**
   * Get comprehensive user metrics
   */
  async getUserMetrics(startDate: Date, endDate: Date): Promise<UserMetrics[]> {
    try {
      const usersQuery = query(
        collection(firebaseFirestore, 'users'),
        where('createdAt', '>=', Timestamp.fromDate(startDate)),
        where('createdAt', '<=', Timestamp.fromDate(endDate))
      );

      const usersSnapshot = await getDocs(usersQuery);
      const metrics: UserMetrics[] = [];

      for (const userDoc of usersSnapshot.docs) {
        const userData = userDoc.data();

        // Get user's parking sessions
        const sessionsQuery = query(
          collection(firebaseFirestore, 'parking_sessions'),
          where('userId', '==', userDoc.id),
          where('timestamp', '>=', Timestamp.fromDate(startDate))
        );
        const sessionsSnapshot = await getDocs(sessionsQuery);

        let totalHours = 0;
        let successfulSessions = 0;
        let aiPredictions = 0;

        sessionsSnapshot.docs.forEach(doc => {
          const session = doc.data();
          if (session.duration) totalHours += session.duration / 3600;
          if (session.successful) successfulSessions++;
          if (session.usedAiPrediction) aiPredictions++;
        });

        // Calculate churn risk based on activity
        const daysSinceLastActive = Math.floor(
          (new Date().getTime() - userData.lastActive?.toDate().getTime()) / (1000 * 60 * 60 * 24)
        );

        let churnRisk: 'low' | 'medium' | 'high' = 'low';
        if (daysSinceLastActive > 30) churnRisk = 'high';
        else if (daysSinceLastActive > 14) churnRisk = 'medium';

        metrics.push({
          userId: userDoc.id,
          email: userData.email || '',
          plan: userData.subscriptionPlan || 'free',
          signupDate: userData.createdAt?.toDate() || new Date(),
          lastActive: userData.lastActive?.toDate() || new Date(),
          parkingSessions: sessionsSnapshot.size,
          aiPredictionsUsed: aiPredictions,
          totalParkingHours: totalHours,
          successRate: sessionsSnapshot.size > 0 ? (successfulSessions / sessionsSnapshot.size) * 100 : 0,
          lifetimeValue: this.calculateLTV(userData),
          churnRisk,
        });
      }

      return metrics;
    } catch (error) {
      console.error('Error getting user metrics:', error);
      return [];
    }
  }

  /**
   * Perform cohort analysis
   */
  async getCohortAnalysis(months: number = 12): Promise<CohortAnalysis[]> {
    try {
      const cohorts: CohortAnalysis[] = [];
      const now = new Date();

      for (let i = 0; i < months; i++) {
        const cohortStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const cohortEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

        const cohortQuery = query(
          collection(firebaseFirestore, 'users'),
          where('createdAt', '>=', Timestamp.fromDate(cohortStart)),
          where('createdAt', '<=', Timestamp.fromDate(cohortEnd))
        );

        const cohortSnapshot = await getDocs(cohortQuery);
        const cohortUsers = cohortSnapshot.docs.map(doc => doc.id);

        // Calculate retention rates
        const retention = await this.calculateRetention(cohortUsers, cohortStart);

        // Calculate conversion rate
        let paidUsers = 0;
        cohortSnapshot.docs.forEach(doc => {
          const data = doc.data();
          if (data.subscriptionPlan && data.subscriptionPlan !== 'free') {
            paidUsers++;
          }
        });

        cohorts.push({
          cohortMonth: `${cohortStart.getFullYear()}-${(cohortStart.getMonth() + 1).toString().padStart(2, '0')}`,
          totalUsers: cohortUsers.length,
          retentionRates: retention,
          conversionRate: cohortUsers.length > 0 ? (paidUsers / cohortUsers.length) * 100 : 0,
          avgLifetimeValue: await this.calculateAvgLTV(cohortUsers),
        });
      }

      return cohorts;
    } catch (error) {
      console.error('Error getting cohort analysis:', error);
      return [];
    }
  }

  /**
   * Get feature adoption metrics
   */
  async getFeatureAdoption(): Promise<FeatureAdoption[]> {
    try {
      const features = [
        'smart_ai_prediction',
        'save_location',
        'parking_timer',
        'parking_photo',
        'widget_usage',
        'carplay_android_auto',
        'offline_mode',
        'voice_commands',
        'share_location',
        'parking_history',
      ];

      const adoption: FeatureAdoption[] = [];
      const totalUsers = await this.getTotalActiveUsers();

      for (const feature of features) {
        const featureQuery = query(
          collection(firebaseFirestore, 'analytics_events'),
          where('event', '==', `feature_${feature}_used`),
          where('timestamp', '>=', Timestamp.fromDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)))
        );

        const featureSnapshot = await getDocs(featureQuery);
        const uniqueUsers = new Set(featureSnapshot.docs.map(doc => doc.data().userId));

        // Calculate retention impact (simplified)
        const retentionImpact = await this.calculateFeatureRetentionImpact(feature);
        const revenueImpact = await this.calculateFeatureRevenueImpact(feature);

        adoption.push({
          feature,
          totalUsers: uniqueUsers.size,
          adoptionRate: totalUsers > 0 ? (uniqueUsers.size / totalUsers) * 100 : 0,
          avgUsagePerUser: uniqueUsers.size > 0 ? featureSnapshot.size / uniqueUsers.size : 0,
          retentionImpact,
          revenueImpact,
        });
      }

      return adoption.sort((a, b) => b.adoptionRate - a.adoptionRate);
    } catch (error) {
      console.error('Error getting feature adoption:', error);
      return [];
    }
  }

  /**
   * Get detailed revenue metrics
   */
  async getRevenueMetrics(date: Date = new Date()): Promise<RevenueMetrics> {
    try {
      const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
      const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);

      // Get active subscriptions
      const subscriptionsQuery = query(
        collection(firebaseFirestore, 'subscriptions'),
        where('status', '==', 'active')
      );
      const subscriptionsSnapshot = await getDocs(subscriptionsQuery);

      let mrr = 0;
      let userCount = 0;

      subscriptionsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        userCount++;
        switch (data.plan) {
          case 'plus': mrr += 2.99; break;
          case 'pro': mrr += 4.99; break;
          case 'family': mrr += 7.99; break;
        }
      });

      // Get new subscriptions this month
      const newSubsQuery = query(
        collection(firebaseFirestore, 'subscriptions'),
        where('createdAt', '>=', Timestamp.fromDate(startOfMonth)),
        where('createdAt', '<=', Timestamp.fromDate(endOfMonth))
      );
      const newSubsSnapshot = await getDocs(newSubsQuery);

      let newMRR = 0;
      newSubsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        switch (data.plan) {
          case 'plus': newMRR += 2.99; break;
          case 'pro': newMRR += 4.99; break;
          case 'family': newMRR += 7.99; break;
        }
      });

      // Calculate other metrics (simplified for demonstration)
      const churnedMRR = mrr * 0.028; // 2.8% monthly churn
      const expansionMRR = mrr * 0.015; // 1.5% expansion
      const contractionMRR = mrr * 0.005; // 0.5% contraction

      const netMRR = newMRR + expansionMRR - churnedMRR - contractionMRR;
      const arr = mrr * 12;
      const arpu = userCount > 0 ? mrr / userCount : 0;
      const cac = 15; // $15 CAC (example)
      const ltv = arpu * 36; // 36 month average lifetime
      const ltv_cac = ltv / cac;

      return {
        date,
        mrr,
        arr,
        newMRR,
        churnedMRR,
        expansionMRR,
        contractionMRR,
        netMRR,
        avgRevenuePerUser: arpu,
        customerAcquisitionCost: cac,
        lifetimeValue: ltv,
        ltv_cac_ratio: ltv_cac,
      };
    } catch (error) {
      console.error('Error getting revenue metrics:', error);
      return {
        date,
        mrr: 0,
        arr: 0,
        newMRR: 0,
        churnedMRR: 0,
        expansionMRR: 0,
        contractionMRR: 0,
        netMRR: 0,
        avgRevenuePerUser: 0,
        customerAcquisitionCost: 0,
        lifetimeValue: 0,
        ltv_cac_ratio: 0,
      };
    }
  }

  /**
   * Generate and store daily analytics report
   */
  async generateDailyReport(): Promise<void> {
    try {
      const today = new Date();
      const reportId = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;

      // Gather all metrics
      const userMetrics = await this.getUserMetrics(
        new Date(today.getTime() - 24 * 60 * 60 * 1000),
        today
      );
      const revenueMetrics = await this.getRevenueMetrics(today);
      const featureAdoption = await this.getFeatureAdoption();

      // Store report
      await setDoc(doc(firebaseFirestore, 'admin_reports', reportId), {
        date: Timestamp.fromDate(today),
        metrics: {
          users: {
            total: userMetrics.length,
            active: userMetrics.filter(u => u.churnRisk === 'low').length,
            atRisk: userMetrics.filter(u => u.churnRisk === 'medium').length,
            churning: userMetrics.filter(u => u.churnRisk === 'high').length,
          },
          revenue: revenueMetrics,
          topFeatures: featureAdoption.slice(0, 5),
        },
        generated: Timestamp.now(),
      });

      console.log('Daily analytics report generated successfully');
    } catch (error) {
      console.error('Error generating daily report:', error);
    }
  }

  // Helper methods

  private calculateLTV(userData: DocumentData): number {
    const monthsSinceSignup = Math.max(1,
      (Date.now() - userData.createdAt?.toDate().getTime()) / (1000 * 60 * 60 * 24 * 30)
    );

    let monthlyValue = 0;
    switch (userData.subscriptionPlan) {
      case 'plus': monthlyValue = 2.99; break;
      case 'pro': monthlyValue = 4.99; break;
      case 'family': monthlyValue = 7.99; break;
    }

    // Predict lifetime based on engagement
    const predictedLifetimeMonths = userData.engagement === 'high' ? 36 :
                                    userData.engagement === 'medium' ? 24 : 12;

    return monthlyValue * predictedLifetimeMonths;
  }

  private async calculateRetention(
    userIds: string[],
    cohortStart: Date
  ): Promise<{ month1: number; month3: number; month6: number; month12: number }> {
    const retention = { month1: 0, month3: 0, month6: 0, month12: 0 };

    if (userIds.length === 0) return retention;

    // Check activity after 1, 3, 6, 12 months
    const checkDates = [1, 3, 6, 12];

    for (const months of checkDates) {
      const checkDate = new Date(cohortStart);
      checkDate.setMonth(checkDate.getMonth() + months);

      if (checkDate > new Date()) continue;

      const activeQuery = query(
        collection(firebaseFirestore, 'analytics_events'),
        where('userId', 'in', userIds.slice(0, 10)), // Firestore 'in' limit
        where('timestamp', '>=', Timestamp.fromDate(checkDate)),
        where('timestamp', '<=', Timestamp.fromDate(new Date(checkDate.getTime() + 7 * 24 * 60 * 60 * 1000)))
      );

      const activeSnapshot = await getDocs(activeQuery);
      const activeUsers = new Set(activeSnapshot.docs.map(doc => doc.data().userId));

      const retentionRate = (activeUsers.size / userIds.length) * 100;

      switch (months) {
        case 1: retention.month1 = retentionRate; break;
        case 3: retention.month3 = retentionRate; break;
        case 6: retention.month6 = retentionRate; break;
        case 12: retention.month12 = retentionRate; break;
      }
    }

    return retention;
  }

  private async calculateAvgLTV(userIds: string[]): Promise<number> {
    if (userIds.length === 0) return 0;

    let totalLTV = 0;
    const sampleSize = Math.min(userIds.length, 100); // Sample for performance

    for (let i = 0; i < sampleSize; i++) {
      const userDoc = await getDocs(
        query(
          collection(firebaseFirestore, 'users'),
          where('userId', '==', userIds[i])
        )
      );

      if (!userDoc.empty) {
        totalLTV += this.calculateLTV(userDoc.docs[0].data());
      }
    }

    return totalLTV / sampleSize;
  }

  private async getTotalActiveUsers(): Promise<number> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const activeQuery = query(
      collection(firebaseFirestore, 'analytics_events'),
      where('event', '==', 'app_open'),
      where('timestamp', '>=', Timestamp.fromDate(thirtyDaysAgo))
    );

    const activeSnapshot = await getDocs(activeQuery);
    const uniqueUsers = new Set(activeSnapshot.docs.map(doc => doc.data().userId));
    return uniqueUsers.size;
  }

  private async calculateFeatureRetentionImpact(feature: string): Promise<number> {
    // Simplified calculation - in production, use cohort analysis
    const baseRetention = 65; // 65% base retention
    const featureBoosts: { [key: string]: number } = {
      'smart_ai_prediction': 15,
      'save_location': 10,
      'parking_timer': 8,
      'parking_photo': 5,
      'widget_usage': 12,
      'carplay_android_auto': 18,
      'offline_mode': 7,
      'voice_commands': 6,
      'share_location': 4,
      'parking_history': 3,
    };

    return featureBoosts[feature] || 0;
  }

  private async calculateFeatureRevenueImpact(feature: string): Promise<number> {
    // Simplified calculation - in production, use actual conversion data
    const revenueMultipliers: { [key: string]: number } = {
      'smart_ai_prediction': 2.5,
      'save_location': 1.8,
      'parking_timer': 1.5,
      'parking_photo': 1.3,
      'widget_usage': 1.7,
      'carplay_android_auto': 2.2,
      'offline_mode': 1.4,
      'voice_commands': 1.6,
      'share_location': 1.2,
      'parking_history': 1.1,
    };

    return revenueMultipliers[feature] || 1.0;
  }
}

export default AdminAnalyticsService;