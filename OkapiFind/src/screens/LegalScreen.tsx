import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Platform,
  Image,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../types/navigation';
import { getPrivacyPolicy } from '../data/privacyPolicy';
import { getTermsOfService } from '../data/termsOfService';
import { Colors } from '../constants/colors';

type LegalScreenRouteProp = RouteProp<RootStackParamList, 'Legal'>;
type LegalScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Legal'>;

const LegalScreen: React.FC = () => {
  const route = useRoute<LegalScreenRouteProp>();
  const navigation = useNavigation<LegalScreenNavigationProp>();
  const { document } = route.params;

  const content = document === 'privacy' ? getPrivacyPolicy() : getTermsOfService();
  const title = document === 'privacy' ? 'Privacy Policy' : 'Terms of Service';

  // Parse markdown-like content for better display
  const renderContent = () => {
    const lines = content.split('\n');
    return lines.map((line, index) => {
      // Headers
      if (line.startsWith('# ')) {
        return (
          <Text key={index} style={styles.h1}>
            {line.replace('# ', '')}
          </Text>
        );
      }
      if (line.startsWith('## ')) {
        return (
          <Text key={index} style={styles.h2}>
            {line.replace('## ', '')}
          </Text>
        );
      }

      // Bold text
      if (line.includes('**')) {
        const parts = line.split('**');
        return (
          <Text key={index} style={styles.paragraph}>
            {parts.map((part, i) => (
              <Text key={i} style={i % 2 === 1 ? styles.bold : undefined}>
                {part}
              </Text>
            ))}
          </Text>
        );
      }

      // List items
      if (line.startsWith('• ')) {
        return (
          <Text key={index} style={styles.listItem}>
            {line}
          </Text>
        );
      }

      // Regular paragraphs
      if (line.trim()) {
        return (
          <Text key={index} style={styles.paragraph}>
            {line}
          </Text>
        );
      }

      // Empty lines
      return <View key={index} style={styles.spacer} />;
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{title}</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={true}
        contentContainerStyle={styles.contentContainer}
      >
        <View style={styles.logoSection}>
          <Image
            source={require('../../assets/icon.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.brandName}>Okapi<Text style={styles.brandHighlight}>Find</Text></Text>
          <Text style={styles.lastUpdated}>Last Updated: January 18, 2026</Text>
        </View>

        <View style={styles.content}>
          {renderContent()}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            If you have any questions about this {document === 'privacy' ? 'Privacy Policy' : 'Terms of Service'},
            please contact us at support@okapifind.com
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: Colors.primary,
  },
  backButton: {
    flex: 1,
  },
  backButtonText: {
    fontSize: 16,
    color: Colors.background,
    fontWeight: '600',
  },
  headerTitle: {
    flex: 2,
    fontSize: 18,
    fontWeight: '600',
    color: Colors.background,
    textAlign: 'center',
  },
  placeholder: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 40,
  },
  logoSection: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
    borderBottomWidth: 2,
    borderBottomColor: Colors.primary,
    backgroundColor: '#fafafa',
  },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 16,
    marginBottom: 12,
  },
  brandName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.background,
    marginBottom: 8,
  },
  brandHighlight: {
    color: Colors.primary,
  },
  lastUpdated: {
    fontSize: 13,
    color: '#666',
  },
  content: {
    padding: 20,
  },
  h1: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.background,
    marginTop: 20,
    marginBottom: 16,
  },
  h2: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.background,
    marginTop: 24,
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: Colors.primary,
  },
  paragraph: {
    fontSize: 15,
    color: '#444',
    lineHeight: 24,
    marginBottom: 12,
  },
  bold: {
    fontWeight: '600',
    color: Colors.background,
  },
  listItem: {
    fontSize: 15,
    color: '#444',
    lineHeight: 24,
    marginBottom: 8,
    paddingLeft: 12,
  },
  spacer: {
    height: 8,
  },
  footer: {
    padding: 20,
    backgroundColor: '#f5f5f5',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  footerText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default LegalScreen;