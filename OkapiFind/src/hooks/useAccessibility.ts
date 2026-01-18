import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { accessibilityService, AccessibilitySettings } from '../services/accessibility';
import { findNodeHandle } from 'react-native';

export const useAccessibility = () => {
  const [settings, setSettings] = useState<AccessibilitySettings>(accessibilityService.getSettings());
  const { t } = useTranslation();

  useEffect(() => {
    // Subscribe to settings changes
    const unsubscribe = accessibilityService.addListener(setSettings);
    return unsubscribe;
  }, []);

  const announceToScreenReader = useCallback((
    message: string,
    priority?: 'low' | 'medium' | 'high',
    delay?: number
  ) => {
    accessibilityService.announceToScreenReader(message, priority, delay);
  }, []);

  const updateSettings = useCallback((newSettings: Partial<AccessibilitySettings>) => {
    accessibilityService.updateSettings(newSettings);
  }, []);

  const getAccessibilityLabel = useCallback((
    baseLabel: string,
    role?: string,
    state?: { selected?: boolean; expanded?: boolean; disabled?: boolean }
  ) => {
    return accessibilityService.getAccessibilityLabel(baseLabel, role, state);
  }, []);

  const getAccessibilityHint = useCallback((action: string, context?: string) => {
    return accessibilityService.getAccessibilityHint(action, context);
  }, []);

  const provideFeedback = useCallback((type: 'success' | 'error' | 'warning' | 'selection') => {
    accessibilityService.provideAccessibilityFeedback(type);
  }, []);

  return {
    settings,
    isScreenReaderEnabled: settings.isScreenReaderEnabled,
    fontSize: settings.fontSize,
    highContrast: settings.highContrast,
    reduceMotion: settings.reduceMotion,
    fontScale: accessibilityService.getFontScale(),
    contrastColors: accessibilityService.getContrastColors(),
    announceToScreenReader,
    updateSettings,
    getAccessibilityLabel,
    getAccessibilityHint,
    provideFeedback,
    shouldReduceMotion: () => accessibilityService.shouldReduceMotion(),
    getAnimationDuration: (defaultDuration: number) =>
      accessibilityService.getAnimationDuration(defaultDuration),
  };
};

// Hook for managing focus
export const useFocusManagement = () => {
  const focusRef = useRef<any>(null);

  const setFocus = useCallback(() => {
    if (focusRef.current) {
      const reactTag = findNodeHandle(focusRef.current);
      if (reactTag) {
        accessibilityService.setAccessibilityFocus(reactTag);
      }
    }
  }, []);

  const setFocusOnMount = useCallback(() => {
    // Delay focus to ensure component is mounted
    setTimeout(setFocus, 100);
  }, [setFocus]);

  return {
    focusRef,
    setFocus,
    setFocusOnMount,
  };
};

// Hook for accessible announcements
export const useAccessibleAnnouncements = () => {
  const { announceToScreenReader } = useAccessibility();
  const { t } = useTranslation();

  const announceNavigation = useCallback((screenName: string) => {
    announceToScreenReader(t(`navigation.${screenName.toLowerCase()}`), 'medium', 500);
  }, [announceToScreenReader, t]);

  const announceAction = useCallback((action: string, success: boolean = true) => {
    const message = success
      ? t('accessibility.successMessage')
      : t('accessibility.errorMessage');
    announceToScreenReader(`${action} ${message}`, success ? 'medium' : 'high');
  }, [announceToScreenReader, t]);

  const announceError = useCallback((error: string) => {
    announceToScreenReader(`${t('common.error')}: ${error}`, 'high');
  }, [announceToScreenReader, t]);

  const announceLoading = useCallback((isLoading: boolean) => {
    if (isLoading) {
      announceToScreenReader(t('common.loading'), 'low');
    }
  }, [announceToScreenReader, t]);

  return {
    announceNavigation,
    announceAction,
    announceError,
    announceLoading,
    announceToScreenReader,
  };
};

// Hook for keyboard navigation
export const useKeyboardNavigation = () => {
  const [currentFocusIndex, setCurrentFocusIndex] = useState(0);
  const [focusableElements, setFocusableElements] = useState<any[]>([]);

  const registerFocusableElement = useCallback((element: any, index: number) => {
    setFocusableElements(prev => {
      const newElements = [...prev];
      newElements[index] = element;
      return newElements;
    });
  }, []);

  const navigateToNext = useCallback(() => {
    setCurrentFocusIndex(prev => {
      const nextIndex = (prev + 1) % focusableElements.length;
      if (focusableElements[nextIndex]) {
        const reactTag = findNodeHandle(focusableElements[nextIndex]);
        if (reactTag) {
          accessibilityService.setAccessibilityFocus(reactTag);
        }
      }
      return nextIndex;
    });
  }, [focusableElements]);

  const navigateToPrevious = useCallback(() => {
    setCurrentFocusIndex(prev => {
      const nextIndex = prev === 0 ? focusableElements.length - 1 : prev - 1;
      if (focusableElements[nextIndex]) {
        const reactTag = findNodeHandle(focusableElements[nextIndex]);
        if (reactTag) {
          accessibilityService.setAccessibilityFocus(reactTag);
        }
      }
      return nextIndex;
    });
  }, [focusableElements]);

  return {
    currentFocusIndex,
    registerFocusableElement,
    navigateToNext,
    navigateToPrevious,
  };
};

// Hook for accessible forms
export const useAccessibleForm = () => {
  const { getAccessibilityLabel, provideFeedback, announceToScreenReader } = useAccessibility();
  const { announceError } = useAccessibleAnnouncements();
  const { t } = useTranslation();

  const getFieldAccessibilityProps = useCallback((
    fieldName: string,
    value: any,
    error?: string,
    required?: boolean
  ) => {
    const label = t(`form.${fieldName}`) || fieldName;
    const baseLabel = required ? `${label}, ${t('form.required')}` : label;

    const accessibilityLabel = getAccessibilityLabel(
      baseLabel,
      'text input',
      { disabled: false }
    );

    const accessibilityHint = error
      ? `${t('form.error')}: ${error}`
      : t('form.enterValue', { field: label });

    return {
      accessibilityLabel,
      accessibilityHint,
      accessibilityState: {
        disabled: false,
        invalid: !!error
      },
      accessibilityRole: 'text' as const,
    };
  }, [getAccessibilityLabel, t]);

  const announceFormError = useCallback((errors: Record<string, string>) => {
    const errorCount = Object.keys(errors).length;
    if (errorCount > 0) {
      announceError(`${errorCount} ${t('form.errorsFound')}`);
      provideFeedback('error');
    }
  }, [announceError, provideFeedback, t]);

  const announceFormSuccess = useCallback((message: string) => {
    announceToScreenReader(message, 'medium');
    provideFeedback('success');
  }, [announceToScreenReader, provideFeedback]);

  return {
    getFieldAccessibilityProps,
    announceFormError,
    announceFormSuccess,
  };
};

// Hook for accessible lists
export const useAccessibleList = <T>(items: T[]) => {
  const { getAccessibilityLabel } = useAccessibility();
  const { t } = useTranslation();

  const getItemAccessibilityProps = useCallback((
    item: T,
    index: number,
    getItemLabel: (item: T) => string,
    isSelected?: boolean
  ) => {
    const baseLabel = getItemLabel(item);
    const position = t('accessibility.listItemPosition', {
      current: index + 1,
      total: items.length
    });

    const accessibilityLabel = getAccessibilityLabel(
      `${baseLabel}, ${position}`,
      'button',
      { selected: isSelected }
    );

    return {
      accessibilityLabel,
      accessibilityRole: 'button' as const,
      accessibilityState: {
        selected: isSelected || false
      },
    };
  }, [items.length, getAccessibilityLabel, t]);

  return {
    getItemAccessibilityProps,
    listLength: items.length,
  };
};