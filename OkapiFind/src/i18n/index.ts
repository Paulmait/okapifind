import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { Platform, NativeModules, I18nManager } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Import translations - 12 languages for worldwide audience
import en from './locales/en.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import ar from './locales/ar.json';
import de from './locales/de.json';
import zh from './locales/zh.json';
import ja from './locales/ja.json';
import pt from './locales/pt.json';
import it from './locales/it.json';
import ko from './locales/ko.json';
import ru from './locales/ru.json';
import hi from './locales/hi.json';

// Supported languages configuration
export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English', nativeName: 'English', rtl: false },
  { code: 'es', name: 'Spanish', nativeName: 'Español', rtl: false },
  { code: 'fr', name: 'French', nativeName: 'Français', rtl: false },
  { code: 'de', name: 'German', nativeName: 'Deutsch', rtl: false },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', rtl: false },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', rtl: false },
  { code: 'zh', name: 'Chinese', nativeName: '中文', rtl: false },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', rtl: false },
  { code: 'ko', name: 'Korean', nativeName: '한국어', rtl: false },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', rtl: false },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', rtl: false },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', rtl: true },
];

// Get device locale
const getDeviceLocale = (): string => {
  let locale = 'en';

  if (Platform.OS === 'ios') {
    locale = NativeModules.SettingsManager?.settings?.AppleLocale?.split('_')[0] || 'en';
  } else if (Platform.OS === 'android') {
    locale = NativeModules.I18nManager?.localeIdentifier?.split('_')[0] || 'en';
  }

  // Check if the detected locale is supported
  const isSupported = SUPPORTED_LANGUAGES.some(lang => lang.code === locale);
  return isSupported ? locale : 'en';
};

// Check if language is RTL
export const isRTL = (langCode: string): boolean => {
  const lang = SUPPORTED_LANGUAGES.find(l => l.code === langCode);
  return lang?.rtl || false;
};

// Language detection
const languageDetector = {
  type: 'languageDetector' as const,
  async: true,
  detect: async (callback: (lang: string) => void) => {
    try {
      // Try to get saved language from storage
      const savedLanguage = await AsyncStorage.getItem('user_language');
      if (savedLanguage) {
        // Handle RTL for saved language
        const rtl = isRTL(savedLanguage);
        if (I18nManager.isRTL !== rtl) {
          I18nManager.allowRTL(rtl);
          I18nManager.forceRTL(rtl);
        }
        callback(savedLanguage);
        return;
      }

      // Fall back to device locale
      const deviceLocale = getDeviceLocale();
      callback(deviceLocale);
    } catch (error) {
      console.warn('Language detection failed:', error);
      callback('en'); // Default to English
    }
  },
  init: () => {},
  cacheUserLanguage: async (language: string) => {
    try {
      await AsyncStorage.setItem('user_language', language);
      // Handle RTL layout
      const rtl = isRTL(language);
      if (I18nManager.isRTL !== rtl) {
        I18nManager.allowRTL(rtl);
        I18nManager.forceRTL(rtl);
      }
    } catch (error) {
      console.warn('Failed to cache user language:', error);
    }
  },
};

// Initialize i18n
i18n
  .use(languageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      es: { translation: es },
      fr: { translation: fr },
      ar: { translation: ar },
      de: { translation: de },
      zh: { translation: zh },
      ja: { translation: ja },
      pt: { translation: pt },
      it: { translation: it },
      ko: { translation: ko },
      ru: { translation: ru },
      hi: { translation: hi },
    },
    fallbackLng: 'en',
    debug: __DEV__,
    interpolation: {
      escapeValue: false, // React already escapes values
    },
    react: {
      useSuspense: false, // Disable suspense for React Native
    },
    compatibilityJSON: 'v4', // For React Native compatibility
  });

/**
 * Change the app language
 * @param langCode - Language code (e.g., 'en', 'es', 'ar')
 */
export const changeLanguage = async (langCode: string): Promise<void> => {
  await i18n.changeLanguage(langCode);
  await AsyncStorage.setItem('user_language', langCode);

  // Handle RTL layout changes
  const rtl = isRTL(langCode);
  if (I18nManager.isRTL !== rtl) {
    I18nManager.allowRTL(rtl);
    I18nManager.forceRTL(rtl);
    // Note: App may need to restart for RTL changes to take full effect
  }
};

/**
 * Get current language info
 */
export const getCurrentLanguage = () => {
  const code = i18n.language;
  return SUPPORTED_LANGUAGES.find(lang => lang.code === code) || SUPPORTED_LANGUAGES[0];
};

export default i18n;