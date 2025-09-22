import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  FlatList,
  I18nManager,
  Alert,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../constants/colors';

interface Language {
  code: string;
  name: string;
  nativeName: string;
  isRTL: boolean;
  flag: string;
}

const SUPPORTED_LANGUAGES: Language[] = [
  {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    isRTL: false,
    flag: '🇺🇸',
  },
  {
    code: 'es',
    name: 'Spanish',
    nativeName: 'Español',
    isRTL: false,
    flag: '🇪🇸',
  },
  {
    code: 'fr',
    name: 'French',
    nativeName: 'Français',
    isRTL: false,
    flag: '🇫🇷',
  },
  {
    code: 'ar',
    name: 'Arabic',
    nativeName: 'العربية',
    isRTL: true,
    flag: '🇸🇦',
  },
];

interface LanguageSwitcherProps {
  style?: any;
  showModal?: boolean;
  onLanguageChange?: (language: Language) => void;
}

const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({
  style,
  showModal = false,
  onLanguageChange,
}) => {
  const { t, i18n } = useTranslation();
  const [modalVisible, setModalVisible] = useState(showModal);

  const currentLanguage = SUPPORTED_LANGUAGES.find(
    lang => lang.code === i18n.language
  ) || SUPPORTED_LANGUAGES[0];

  const handleLanguageChange = async (language: Language) => {
    try {
      // Store the selected language
      await AsyncStorage.setItem('user_language', language.code);

      // Change the app language
      await i18n.changeLanguage(language.code);

      // Handle RTL layout
      if (language.isRTL !== I18nManager.isRTL) {
        I18nManager.allowRTL(language.isRTL);
        I18nManager.forceRTL(language.isRTL);

        // Alert user that app restart is required for RTL changes
        Alert.alert(
          t('common.success'),
          'Language changed successfully. Please restart the app to apply layout changes.',
          [
            {
              text: t('common.ok'),
              onPress: () => {
                setModalVisible(false);
                onLanguageChange?.(language);
              },
            },
          ]
        );
      } else {
        setModalVisible(false);
        onLanguageChange?.(language);
      }
    } catch (error) {
      console.error('Failed to change language:', error);
      Alert.alert(
        t('common.error'),
        'Failed to change language. Please try again.'
      );
    }
  };

  const renderLanguageItem = ({ item }: { item: Language }) => {
    const isSelected = item.code === currentLanguage.code;

    return (
      <TouchableOpacity
        style={[
          styles.languageItem,
          isSelected && styles.selectedLanguageItem,
        ]}
        onPress={() => handleLanguageChange(item)}
        accessibilityLabel={`${item.name} - ${item.nativeName}`}
        accessibilityRole="button"
        accessibilityState={{ selected: isSelected }}
      >
        <View style={styles.languageInfo}>
          <Text style={styles.flagEmoji}>{item.flag}</Text>
          <View style={styles.languageTexts}>
            <Text style={[styles.languageName, isSelected && styles.selectedText]}>
              {item.name}
            </Text>
            <Text style={[styles.nativeLanguageName, isSelected && styles.selectedText]}>
              {item.nativeName}
            </Text>
          </View>
        </View>
        {isSelected && (
          <Text style={styles.checkmark}>✓</Text>
        )}
      </TouchableOpacity>
    );
  };

  if (modalVisible) {
    return (
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('settings.language')}</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setModalVisible(false)}
                accessibilityLabel={t('accessibility.closeButton')}
                accessibilityRole="button"
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={SUPPORTED_LANGUAGES}
              renderItem={renderLanguageItem}
              keyExtractor={(item) => item.code}
              showsVerticalScrollIndicator={false}
              style={styles.languageList}
            />
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.languageSwitcher, style]}
      onPress={() => setModalVisible(true)}
      accessibilityLabel={`${t('settings.language')}: ${currentLanguage.name}`}
      accessibilityRole="button"
      accessibilityHint="Tap to change language"
    >
      <Text style={styles.flagEmoji}>{currentLanguage.flag}</Text>
      <Text style={styles.currentLanguage}>{currentLanguage.name}</Text>
      <Text style={styles.dropdownArrow}>▼</Text>
    </TouchableOpacity>
  );
};

// Hook for RTL support
export const useRTL = () => {
  const { i18n } = useTranslation();
  const currentLanguage = SUPPORTED_LANGUAGES.find(
    lang => lang.code === i18n.language
  );

  return {
    isRTL: currentLanguage?.isRTL || false,
    textAlign: currentLanguage?.isRTL ? 'right' : 'left',
    flexDirection: currentLanguage?.isRTL ? 'row-reverse' : 'row',
  };
};

// RTL-aware text component
export const RTLText: React.FC<{
  children: React.ReactNode;
  style?: any;
  numberOfLines?: number;
}> = ({ children, style, numberOfLines }) => {
  const { textAlign } = useRTL();

  return (
    <Text
      style={[{ textAlign: textAlign as any }, style]}
      numberOfLines={numberOfLines}
    >
      {children}
    </Text>
  );
};

// RTL-aware view component
export const RTLView: React.FC<{
  children: React.ReactNode;
  style?: any;
}> = ({ children, style }) => {
  const { flexDirection } = useRTL();

  return (
    <View style={[{ flexDirection: flexDirection as any }, style]}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  languageSwitcher: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  flagEmoji: {
    fontSize: 20,
    marginRight: 8,
  },
  currentLanguage: {
    fontSize: 16,
    color: Colors.text,
    flex: 1,
  },
  dropdownArrow: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginLeft: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 16,
    padding: 20,
    margin: 20,
    maxHeight: '80%',
    minWidth: 300,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.text,
  },
  closeButton: {
    padding: 4,
  },
  closeButtonText: {
    fontSize: 18,
    color: Colors.textSecondary,
  },
  languageList: {
    maxHeight: 300,
  },
  languageItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  selectedLanguageItem: {
    backgroundColor: Colors.primary + '20',
  },
  languageInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  languageTexts: {
    marginLeft: 12,
  },
  languageName: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text,
    marginBottom: 2,
  },
  nativeLanguageName: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  selectedText: {
    color: Colors.primary,
  },
  checkmark: {
    fontSize: 18,
    color: Colors.primary,
    fontWeight: 'bold',
  },
});

export default React.memo(LanguageSwitcher);
export { SUPPORTED_LANGUAGES };