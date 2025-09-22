import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES } from '../components/LanguageSwitcher';

// Get the locale for the current language
export const getCurrentLocale = (languageCode: string): string => {
  const language = SUPPORTED_LANGUAGES.find(lang => lang.code === languageCode);

  switch (languageCode) {
    case 'en':
      return 'en-US';
    case 'es':
      return 'es-ES';
    case 'fr':
      return 'fr-FR';
    case 'ar':
      return 'ar-SA';
    default:
      return 'en-US';
  }
};

// Number formatting utility
export class NumberFormatter {
  static format(
    number: number,
    languageCode: string,
    options: Intl.NumberFormatOptions = {}
  ): string {
    try {
      const locale = getCurrentLocale(languageCode);
      return new Intl.NumberFormat(locale, options).format(number);
    } catch (error) {
      console.warn('Number formatting failed:', error);
      return number.toString();
    }
  }

  static formatCurrency(
    amount: number,
    languageCode: string,
    currency: string = 'USD'
  ): string {
    return this.format(amount, languageCode, {
      style: 'currency',
      currency,
    });
  }

  static formatPercent(
    value: number,
    languageCode: string,
    decimals: number = 0
  ): string {
    return this.format(value / 100, languageCode, {
      style: 'percent',
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }

  static formatDistance(
    meters: number,
    languageCode: string,
    useMetric: boolean = true
  ): string {
    if (useMetric) {
      if (meters < 1000) {
        return `${this.format(Math.round(meters), languageCode)} m`;
      } else {
        return `${this.format(meters / 1000, languageCode, {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        })} km`;
      }
    } else {
      // Convert to imperial
      const feet = meters * 3.28084;
      if (feet < 5280) {
        return `${this.format(Math.round(feet), languageCode)} ft`;
      } else {
        const miles = feet / 5280;
        return `${this.format(miles, languageCode, {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        })} mi`;
      }
    }
  }
}

// Date formatting utility
export class DateFormatter {
  static format(
    date: Date,
    languageCode: string,
    options: Intl.DateTimeFormatOptions = {}
  ): string {
    try {
      const locale = getCurrentLocale(languageCode);
      return new Intl.DateTimeFormat(locale, options).format(date);
    } catch (error) {
      console.warn('Date formatting failed:', error);
      return date.toISOString();
    }
  }

  static formatTime(date: Date, languageCode: string): string {
    return this.format(date, languageCode, {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  static formatDate(date: Date, languageCode: string): string {
    return this.format(date, languageCode, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  static formatShortDate(date: Date, languageCode: string): string {
    return this.format(date, languageCode, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  static formatDateTime(date: Date, languageCode: string): string {
    return this.format(date, languageCode, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  static formatRelativeTime(
    date: Date,
    languageCode: string,
    t: (key: string, options?: any) => string
  ): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    const diffWeeks = Math.floor(diffDays / 7);

    if (diffMinutes < 1) {
      return t('time.now');
    } else if (diffMinutes === 1) {
      return t('time.minuteAgo');
    } else if (diffMinutes < 60) {
      return t('time.minutesAgo', { count: diffMinutes });
    } else if (diffHours === 1) {
      return t('time.hourAgo');
    } else if (diffHours < 24) {
      return t('time.hoursAgo', { count: diffHours });
    } else if (diffDays === 1) {
      return t('time.dayAgo');
    } else if (diffDays < 7) {
      return t('time.daysAgo', { count: diffDays });
    } else if (diffWeeks === 1) {
      return t('time.weekAgo');
    } else {
      return t('time.weeksAgo', { count: diffWeeks });
    }
  }

  // Calendar formatting for different cultures
  static formatCalendar(date: Date, languageCode: string): string {
    const locale = getCurrentLocale(languageCode);

    // Special handling for Arabic (Islamic calendar could be added here)
    if (languageCode === 'ar') {
      return this.format(date, languageCode, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    }

    return this.format(date, languageCode, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }
}

// React hooks for formatting
export const useNumberFormat = () => {
  const { i18n } = useTranslation();

  return {
    formatNumber: (number: number, options?: Intl.NumberFormatOptions) =>
      NumberFormatter.format(number, i18n.language, options),
    formatCurrency: (amount: number, currency?: string) =>
      NumberFormatter.formatCurrency(amount, i18n.language, currency),
    formatPercent: (value: number, decimals?: number) =>
      NumberFormatter.formatPercent(value, i18n.language, decimals),
    formatDistance: (meters: number, useMetric?: boolean) =>
      NumberFormatter.formatDistance(meters, i18n.language, useMetric),
  };
};

export const useDateFormat = () => {
  const { i18n, t } = useTranslation();

  return {
    formatDate: (date: Date, options?: Intl.DateTimeFormatOptions) =>
      DateFormatter.format(date, i18n.language, options),
    formatTime: (date: Date) =>
      DateFormatter.formatTime(date, i18n.language),
    formatShortDate: (date: Date) =>
      DateFormatter.formatShortDate(date, i18n.language),
    formatDateTime: (date: Date) =>
      DateFormatter.formatDateTime(date, i18n.language),
    formatRelativeTime: (date: Date) =>
      DateFormatter.formatRelativeTime(date, i18n.language, t),
    formatCalendar: (date: Date) =>
      DateFormatter.formatCalendar(date, i18n.language),
  };
};

// Unit conversion utilities
export const useUnits = () => {
  const { i18n, t } = useTranslation();

  // This could be made configurable per user
  const useMetricSystem = i18n.language !== 'en'; // US uses imperial, others metric

  return {
    useMetric: useMetricSystem,
    formatDistance: (meters: number) =>
      NumberFormatter.formatDistance(meters, i18n.language, useMetricSystem),
    metersToFeet: (meters: number) => meters * 3.28084,
    metersToMiles: (meters: number) => meters * 0.000621371,
    feetToMeters: (feet: number) => feet * 0.3048,
    milesToMeters: (miles: number) => miles * 1609.34,
  };
};

// Address formatting for different regions
export const formatAddress = (
  address: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
  },
  languageCode: string
): string => {
  if (!address) return '';

  const { street, city, state, country, postalCode } = address;

  // Different address formats for different regions
  switch (languageCode) {
    case 'en':
      // US/UK format: Street, City, State PostalCode
      return [street, city, state, postalCode].filter(Boolean).join(', ');

    case 'fr':
      // French format: Street, PostalCode City
      return [street, postalCode && city ? `${postalCode} ${city}` : city]
        .filter(Boolean).join(', ');

    case 'ar':
      // Arabic format (RTL considerations)
      return [street, city, state, country].filter(Boolean).join('، ');

    default:
      return [street, city, state, postalCode, country].filter(Boolean).join(', ');
  }
};