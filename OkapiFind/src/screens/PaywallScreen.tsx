import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Purchases, { PurchasesPackage } from 'react-native-purchases';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../types/navigation';
import { Colors } from '../constants/colors';
import { usePremium } from '../hooks/usePremium';
import { logEvent, AnalyticsEvent, analytics } from '../services/analytics';

type PaywallScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Paywall'>;

const PREMIUM_FEATURES = [
  { icon: '✓', title: 'Unlimited Parking Saves', description: 'Save as many locations as you need' },
  { icon: '✓', title: 'OCR Timer', description: 'Scan parking signs & set automatic reminders' },
  { icon: '✓', title: 'Safety Mode', description: 'Extra security features for night parking' },
  { icon: '✓', title: 'Photo Documentation', description: 'Capture and store parking photos' },
  { icon: '✓', title: 'Offline Maps', description: 'Find your car without internet' },
  { icon: '✓', title: 'Family Sharing', description: 'Share parking locations with loved ones' },
  { icon: '✓', title: 'Parking History', description: 'View all your previous parking spots' },
  { icon: '✓', title: 'Priority Support', description: 'Get help when you need it most' },
];

export default function PaywallScreen() {
  const navigation = useNavigation<PaywallScreenNavigationProp>();
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';
  const { subscribe, restorePurchases: restore, loadOfferings } = usePremium();

  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<PurchasesPackage | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);

  useEffect(() => {
    // Log paywall view event on mount
    logEvent(AnalyticsEvent.PAYWALL_VIEW);
    loadPackages();
  }, []);

  const loadPackages = async () => {
    try {
      const offerings = await loadOfferings();
      if (offerings?.current?.availablePackages) {
        const availablePackages = offerings.current.availablePackages;
        setPackages(availablePackages);

        const annualPackage = availablePackages.find(
          (pkg) => pkg.packageType === 'ANNUAL'
        );
        const monthlyPackage = availablePackages.find(
          (pkg) => pkg.packageType === 'MONTHLY'
        );

        setSelectedPackage(annualPackage || monthlyPackage || availablePackages[0]);
      }
    } catch (error) {
      console.error('Error loading packages:', error);
      Alert.alert('Error', 'Failed to load subscription options. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async () => {
    if (!selectedPackage) {
      Alert.alert('Please select a subscription');
      return;
    }

    setPurchasing(true);
    try {
      const result = await subscribe(selectedPackage.identifier);

      if (result.success) {
        // Log successful purchase event
        logEvent(AnalyticsEvent.PAYWALL_PURCHASE_SUCCESS, {
          package_id: selectedPackage.identifier,
          package_type: selectedPackage.packageType,
          price: selectedPackage.product.price,
          currency: selectedPackage.product.currencyCode,
        });

        Alert.alert('Success!', 'Welcome to OkapiFind Premium!', [
          { text: 'OK', onPress: () => navigation.goBack() }
        ]);
      } else if (result.userCancelled) {
        // Log cancelled purchase event
        analytics.logPurchaseCancelled(selectedPackage.identifier);
      } else {
        // Log failed purchase event
        analytics.logPurchaseFailed(selectedPackage.identifier, result.error || 'Unknown error');
        Alert.alert('Purchase Failed', result.error || 'Please try again or contact support.');
      }
    } catch (error: any) {
      // Log error event
      analytics.logPurchaseFailed(selectedPackage.identifier, error.message || 'Unexpected error');
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    // Log restore event
    logEvent(AnalyticsEvent.PAYWALL_RESTORE);

    setPurchasing(true);
    try {
      const result = await restore();

      if (result.success && result.isPremium) {
        // Log successful restore with premium
        analytics.logRestoreSuccess(true);
        Alert.alert('Success!', 'Your Premium subscription has been restored!', [
          { text: 'OK', onPress: () => navigation.goBack() }
        ]);
      } else if (result.success && !result.isPremium) {
        // Log successful restore without premium
        analytics.logRestoreSuccess(false);
        Alert.alert('No Subscription Found', 'No active subscription was found to restore.');
      } else {
        // Log failed restore
        analytics.logRestoreFailed(result.error || 'Unknown error');
        Alert.alert('Error', result.error || 'Failed to restore purchases. Please try again.');
      }
    } catch (error: any) {
      // Log error event
      analytics.logRestoreFailed(error.message || 'Unexpected error');
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setPurchasing(false);
    }
  };

  const openPrivacyPolicy = () => {
    navigation.navigate('Legal', { document: 'privacy' });
  };

  const openTermsOfService = () => {
    navigation.navigate('Legal', { document: 'terms' });
  };

  const formatPrice = (pkg: PurchasesPackage) => {
    const price = pkg.product.priceString;
    const period = pkg.packageType === 'ANNUAL' ? '/year' : '/month';
    return `${price}${period}`;
  };

  const formatSavings = (annualPkg: PurchasesPackage, monthlyPkg: PurchasesPackage) => {
    const annualPrice = annualPkg.product.price;
    const monthlyPrice = monthlyPkg.product.price;
    const monthlyCostIfAnnual = annualPrice / 12;
    const savings = ((monthlyPrice - monthlyCostIfAnnual) / monthlyPrice) * 100;
    return Math.round(savings);
  };

  const styles = getStyles(isDarkMode);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading subscription options...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const monthlyPackage = packages.find(pkg => pkg.packageType === 'MONTHLY');
  const annualPackage = packages.find(pkg => pkg.packageType === 'ANNUAL');

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Text style={styles.logo}>🚗</Text>
            <Text style={styles.logoArrow}>↑</Text>
          </View>
          <Text style={styles.headline}>Unlock OkapiFind Premium</Text>
          <Text style={styles.subheadline}>All the tools you need to never lose your car</Text>
        </View>

        <View style={styles.featuresSection}>
          <Text style={styles.featuresTitle}>Premium Features</Text>
          {PREMIUM_FEATURES.map((feature, index) => (
            <View key={index} style={styles.featureRow}>
              <View style={styles.featureIconContainer}>
                <Text style={styles.featureIcon}>{feature.icon}</Text>
              </View>
              <View style={styles.featureTextContainer}>
                <Text style={styles.featureTitle}>{feature.title}</Text>
                <Text style={styles.featureDescription}>{feature.description}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.packagesSection}>
          {annualPackage && (
            <TouchableOpacity
              style={[
                styles.packageCard,
                selectedPackage === annualPackage && styles.packageCardSelected
              ]}
              onPress={() => {
                setSelectedPackage(annualPackage);
                analytics.logPackageSelected(annualPackage.identifier, 'ANNUAL');
              }}
            >
              <View style={styles.bestValueContainer}>
                <View style={styles.bestValueRibbon}>
                  <Text style={styles.bestValueText}>BEST VALUE</Text>
                </View>
              </View>
              <View style={styles.packageContent}>
                <Text style={styles.packageTitle}>Annual Plan</Text>
                <Text style={styles.packagePrice}>{formatPrice(annualPackage)}</Text>
                {monthlyPackage && (
                  <Text style={styles.packageSavings}>
                    Save {formatSavings(annualPackage, monthlyPackage)}% vs monthly
                  </Text>
                )}
              </View>
              <View style={styles.radioContainer}>
                <View style={[
                  styles.radio,
                  selectedPackage === annualPackage && styles.radioSelected
                ]} />
              </View>
            </TouchableOpacity>
          )}

          {monthlyPackage && (
            <TouchableOpacity
              style={[
                styles.packageCard,
                selectedPackage === monthlyPackage && styles.packageCardSelected
              ]}
              onPress={() => {
                setSelectedPackage(monthlyPackage);
                analytics.logPackageSelected(monthlyPackage.identifier, 'MONTHLY');
              }}
            >
              <View style={styles.packageContent}>
                <Text style={styles.packageTitle}>Monthly Plan</Text>
                <Text style={styles.packagePrice}>{formatPrice(monthlyPackage)}</Text>
                <Text style={styles.packageDescription}>Cancel anytime</Text>
              </View>
              <View style={styles.radioContainer}>
                <View style={[
                  styles.radio,
                  selectedPackage === monthlyPackage && styles.radioSelected
                ]} />
              </View>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.buttonsContainer}>
          <TouchableOpacity
            style={[styles.primaryButton, purchasing && styles.buttonDisabled]}
            onPress={handlePurchase}
            disabled={purchasing}
          >
            {purchasing ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>Start Premium</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryButton, purchasing && styles.buttonDisabled]}
            onPress={handleRestore}
            disabled={purchasing}
          >
            <Text style={styles.secondaryButtonText}>Restore Purchases</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            By subscribing, you agree to our{' '}
            <Text style={styles.link} onPress={openTermsOfService}>
              Terms of Service
            </Text>
            {' '}and{' '}
            <Text style={styles.link} onPress={openPrivacyPolicy}>
              Privacy Policy
            </Text>
          </Text>
          <Text style={styles.footerNote}>
            Subscriptions automatically renew unless cancelled at least 24 hours before the end of the current period.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (isDarkMode: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: isDarkMode ? Colors.background : '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: isDarkMode ? Colors.textSecondary : '#666',
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 1,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 24,
    color: isDarkMode ? Colors.textSecondary : '#666',
  },
  header: {
    alignItems: 'center',
    paddingTop: 40,
    paddingBottom: 32,
    paddingHorizontal: 20,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    position: 'relative',
  },
  logo: {
    fontSize: 40,
    color: isDarkMode ? Colors.background : '#FFFFFF',
  },
  logoArrow: {
    fontSize: 20,
    color: isDarkMode ? Colors.background : '#FFFFFF',
    position: 'absolute',
    top: 10,
  },
  headline: {
    fontSize: 28,
    fontWeight: 'bold',
    color: isDarkMode ? Colors.textPrimary : '#000',
    textAlign: 'center',
    marginBottom: 8,
  },
  subheadline: {
    fontSize: 16,
    color: isDarkMode ? Colors.textSecondary : '#666',
    textAlign: 'center',
  },
  featuresSection: {
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  featuresTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: isDarkMode ? Colors.textPrimary : '#000',
    marginBottom: 16,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  featureIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  featureIcon: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  featureTextContainer: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: isDarkMode ? Colors.textPrimary : '#000',
    marginBottom: 2,
  },
  featureDescription: {
    fontSize: 13,
    color: isDarkMode ? Colors.textSecondary : '#666',
  },
  packagesSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  packageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: isDarkMode ? '#333' : '#E0E0E0',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    backgroundColor: isDarkMode ? Colors.backgroundLight : '#FFFFFF',
  },
  packageCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: isDarkMode ? 'rgba(255, 215, 0, 0.1)' : Colors.primaryLight,
  },
  bestValueContainer: {
    position: 'absolute',
    top: -12,
    left: 16,
    zIndex: 1,
  },
  bestValueRibbon: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  bestValueText: {
    color: Colors.background,
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  packageContent: {
    flex: 1,
  },
  packageTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: isDarkMode ? Colors.textPrimary : '#000',
    marginBottom: 4,
  },
  packagePrice: {
    fontSize: 16,
    color: Colors.primaryDark,
    fontWeight: '500',
    marginBottom: 4,
  },
  packageDescription: {
    fontSize: 14,
    color: isDarkMode ? Colors.textSecondary : '#666',
  },
  packageSavings: {
    fontSize: 14,
    color: Colors.success,
    fontWeight: '500',
  },
  radioContainer: {
    marginLeft: 16,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.primary,
    backgroundColor: isDarkMode ? Colors.backgroundLight : '#FFFFFF',
  },
  radioSelected: {
    backgroundColor: Colors.primary,
  },
  buttonsContainer: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  primaryButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  secondaryButton: {
    borderWidth: 2,
    borderColor: isDarkMode ? '#666' : '#CCCCCC',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  secondaryButtonText: {
    color: isDarkMode ? Colors.textSecondary : '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  footerText: {
    fontSize: 12,
    color: isDarkMode ? Colors.textSecondary : '#666',
    textAlign: 'center',
    marginBottom: 8,
  },
  footerNote: {
    fontSize: 11,
    color: isDarkMode ? '#666' : '#999',
    textAlign: 'center',
  },
  link: {
    color: Colors.primary,
    textDecorationLine: 'underline',
  },
});