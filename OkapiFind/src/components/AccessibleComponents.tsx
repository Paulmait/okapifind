import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import {
  TouchableOpacity,
  TouchableOpacityProps,
  Text,
  TextProps,
  View,
  ViewProps,
  TextInput,
  TextInputProps,
  StyleSheet,
} from 'react-native';
import { useAccessibility, useFocusManagement } from '../hooks/useAccessibility';
import { useTranslation } from 'react-i18next';

// Accessible Button Component
interface AccessibleButtonProps extends TouchableOpacityProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'small' | 'medium' | 'large';
  loading?: boolean;
  accessibilityHint?: string;
}

export const AccessibleButton = forwardRef<TouchableOpacity, AccessibleButtonProps>(
  ({
    title,
    subtitle,
    icon,
    variant = 'primary',
    size = 'medium',
    loading = false,
    accessibilityHint,
    disabled,
    style,
    onPress,
    ...props
  }, ref) => {
    const { settings, fontScale, contrastColors, getAccessibilityLabel, provideFeedback } = useAccessibility();
    const { t } = useTranslation();

    const buttonRef = useRef<TouchableOpacity>(null);
    useImperativeHandle(ref, () => buttonRef.current!);

    const handlePress = (event: any) => {
      if (loading || disabled) return;

      provideFeedback('selection');
      onPress?.(event);
    };

    const getButtonStyles = () => {
      const baseStyle = {
        backgroundColor: contrastColors.primary,
        padding: size === 'small' ? 8 : size === 'large' ? 16 : 12,
        borderRadius: 8,
        opacity: disabled ? 0.6 : 1,
      };

      if (variant === 'secondary') {
        baseStyle.backgroundColor = 'transparent';
      } else if (variant === 'danger') {
        baseStyle.backgroundColor = contrastColors.error;
      }

      return baseStyle;
    };

    const getTextStyles = () => ({
      color: variant === 'secondary' ? contrastColors.primary : contrastColors.background,
      fontSize: 16 * fontScale,
      fontWeight: settings.boldText ? 'bold' : '600' as const,
      textAlign: 'center' as const,
    });

    const accessibilityLabel = getAccessibilityLabel(
      loading ? `${title}, ${t('common.loading')}` : title,
      'button',
      { disabled: disabled || loading }
    );

    return (
      <TouchableOpacity
        ref={buttonRef}
        style={[getButtonStyles(), style]}
        onPress={handlePress}
        disabled={disabled || loading}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint || `${t('accessibility.buttonHint')}`}
        accessibilityState={{
          disabled: disabled || loading,
          busy: loading
        }}
        {...props}
      >
        <View style={styles.buttonContent}>
          {icon && <View style={styles.buttonIcon}>{icon}</View>}
          <View style={styles.buttonText}>
            <Text style={getTextStyles()}>{title}</Text>
            {subtitle && (
              <Text style={[getTextStyles(), { fontSize: 14 * fontScale, opacity: 0.8 }]}>
                {subtitle}
              </Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  }
);

// Accessible Text Component
interface AccessibleTextProps extends TextProps {
  variant?: 'heading' | 'subheading' | 'body' | 'caption';
  importance?: 'high' | 'medium' | 'low';
}

export const AccessibleText = forwardRef<Text, AccessibleTextProps>(
  ({ variant = 'body', importance = 'medium', style, children, ...props }, ref) => {
    const { fontScale, contrastColors, settings } = useAccessibility();

    const getTextStyles = () => {
      const baseStyles = {
        color: contrastColors.text,
        fontWeight: settings.boldText ? 'bold' : 'normal' as const,
      };

      switch (variant) {
        case 'heading':
          return {
            ...baseStyles,
            fontSize: 24 * fontScale,
            fontWeight: settings.boldText ? 'bold' : '600' as const,
            marginBottom: 8,
          };
        case 'subheading':
          return {
            ...baseStyles,
            fontSize: 18 * fontScale,
            fontWeight: settings.boldText ? 'bold' : '500' as const,
            marginBottom: 4,
          };
        case 'body':
          return {
            ...baseStyles,
            fontSize: 16 * fontScale,
            lineHeight: 24 * fontScale,
          };
        case 'caption':
          return {
            ...baseStyles,
            fontSize: 14 * fontScale,
            color: contrastColors.textSecondary,
          };
        default:
          return baseStyles;
      }
    };

    const accessibilityRole = variant === 'heading' ? 'header' : 'text';

    return (
      <Text
        ref={ref}
        style={[getTextStyles(), style]}
        accessibilityRole={accessibilityRole}
        accessibilityLevel={variant === 'heading' ? 1 : undefined}
        {...props}
      >
        {children}
      </Text>
    );
  }
);

// Accessible Input Component
interface AccessibleInputProps extends TextInputProps {
  label: string;
  error?: string;
  required?: boolean;
  helperText?: string;
}

export const AccessibleInput = forwardRef<TextInput, AccessibleInputProps>(
  ({ label, error, required, helperText, style, ...props }, ref) => {
    const { fontScale, contrastColors, getAccessibilityLabel } = useAccessibility();
    const { t } = useTranslation();
    const { focusRef, setFocus } = useFocusManagement();

    const inputRef = useRef<TextInput>(null);
    useImperativeHandle(ref, () => inputRef.current!);
    useImperativeHandle(focusRef, () => inputRef.current!);

    const getInputStyles = () => ({
      fontSize: 16 * fontScale,
      color: contrastColors.text,
      backgroundColor: contrastColors.surface,
      borderColor: error ? contrastColors.error : contrastColors.border,
      borderWidth: error ? 2 : 1,
      borderRadius: 8,
      padding: 12,
      minHeight: 48,
    });

    const accessibilityLabel = getAccessibilityLabel(
      required ? `${label}, ${t('form.required')}` : label,
      'text input'
    );

    const accessibilityHint = error
      ? `${t('form.error')}: ${error}`
      : helperText || `${t('form.enterValue', { field: label })}`;

    return (
      <View style={styles.inputContainer}>
        <AccessibleText variant="body" style={styles.inputLabel}>
          {label}
          {required && <AccessibleText variant="body" style={{ color: contrastColors.error }}> *</AccessibleText>}
        </AccessibleText>

        <TextInput
          ref={inputRef}
          style={[getInputStyles(), style]}
          accessibilityLabel={accessibilityLabel}
          accessibilityHint={accessibilityHint}
          accessibilityState={{
            disabled: props.editable === false,
            invalid: !!error
          }}
          onFocus={setFocus}
          {...props}
        />

        {error && (
          <AccessibleText
            variant="caption"
            style={[styles.errorText, { color: contrastColors.error }]}
            accessibilityRole="alert"
          >
            {error}
          </AccessibleText>
        )}

        {helperText && !error && (
          <AccessibleText variant="caption" style={styles.helperText}>
            {helperText}
          </AccessibleText>
        )}
      </View>
    );
  }
);

// Accessible Card Component
interface AccessibleCardProps extends ViewProps {
  title?: string;
  subtitle?: string;
  onPress?: () => void;
  interactive?: boolean;
}

export const AccessibleCard = forwardRef<View, AccessibleCardProps>(
  ({ title, subtitle, onPress, interactive = false, children, style, ...props }, ref) => {
    const { contrastColors, getAccessibilityLabel, provideFeedback } = useAccessibility();

    const handlePress = () => {
      if (onPress) {
        provideFeedback('selection');
        onPress();
      }
    };

    const cardStyles = {
      backgroundColor: contrastColors.surface,
      borderRadius: 12,
      padding: 16,
      marginVertical: 4,
      shadowColor: contrastColors.text,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    };

    const accessibilityLabel = title
      ? getAccessibilityLabel(title, interactive ? 'button' : 'text')
      : undefined;

    if (interactive && onPress) {
      return (
        <TouchableOpacity
          ref={ref as any}
          style={[cardStyles, style]}
          onPress={handlePress}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          {...props}
        >
          <View>
            {title && <AccessibleText variant="subheading">{title}</AccessibleText>}
            {subtitle && <AccessibleText variant="caption">{subtitle}</AccessibleText>}
            {children}
          </View>
        </TouchableOpacity>
      );
    }

    return (
      <View
        ref={ref}
        style={[cardStyles, style]}
        accessibilityRole="text"
        accessibilityLabel={accessibilityLabel}
        {...props}
      >
        {title && <AccessibleText variant="subheading">{title}</AccessibleText>}
        {subtitle && <AccessibleText variant="caption">{subtitle}</AccessibleText>}
        {children}
      </View>
    );
  }
);

// Accessible Loading Component
interface AccessibleLoadingProps {
  message?: string;
  size?: 'small' | 'large';
}

export const AccessibleLoading: React.FC<AccessibleLoadingProps> = ({
  message,
  size = 'large'
}) => {
  const { contrastColors } = useAccessibility();
  const { t } = useTranslation();
  const { announceLoading } = useAccessibleAnnouncements();

  React.useEffect(() => {
    announceLoading(true);
  }, [announceLoading]);

  return (
    <View
      style={styles.loadingContainer}
      accessibilityRole="progressbar"
      accessibilityLabel={message || t('common.loading')}
      accessibilityState={{ busy: true }}
    >
      <View
        style={[
          styles.loadingSpinner,
          {
            borderColor: contrastColors.primary,
            width: size === 'small' ? 20 : 40,
            height: size === 'small' ? 20 : 40,
          }
        ]}
      />
      {message && (
        <AccessibleText variant="body" style={styles.loadingText}>
          {message}
        </AccessibleText>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonIcon: {
    marginRight: 8,
  },
  buttonText: {
    alignItems: 'center',
  },
  inputContainer: {
    marginVertical: 8,
  },
  inputLabel: {
    marginBottom: 4,
    fontWeight: '500',
  },
  errorText: {
    marginTop: 4,
    fontSize: 12,
  },
  helperText: {
    marginTop: 4,
    fontSize: 12,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingSpinner: {
    borderWidth: 2,
    borderTopColor: 'transparent',
    borderRadius: 20,
    marginBottom: 8,
  },
  loadingText: {
    textAlign: 'center',
  },
});

// Display names for debugging
AccessibleButton.displayName = 'AccessibleButton';
AccessibleText.displayName = 'AccessibleText';
AccessibleInput.displayName = 'AccessibleInput';
AccessibleCard.displayName = 'AccessibleCard';
AccessibleLoading.displayName = 'AccessibleLoading';