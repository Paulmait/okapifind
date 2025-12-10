import React, { useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Switch,
  Alert,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAccessibility, useAccessibleAnnouncements } from '../hooks/useAccessibility';
import {
  AccessibleText,
  AccessibleButton,
  AccessibleCard,
} from '../components/AccessibleComponents';

const AccessibilitySettingsScreen: React.FC = () => {
  const { t } = useTranslation();
  const {
    settings,
    updateSettings,
    contrastColors,
    fontScale,
    provideFeedback
  } = useAccessibility();
  const { announceAction } = useAccessibleAnnouncements();

  const [testAnnouncement, setTestAnnouncement] = useState(false);

  const handleFontSizeChange = (size: 'small' | 'normal' | 'large' | 'extraLarge') => {
    updateSettings({ fontSize: size });
    announceAction(`Font size changed to ${size}`);
    provideFeedback('success');
  };

  const handleHighContrastToggle = (enabled: boolean) => {
    updateSettings({ highContrast: enabled });
    announceAction(`High contrast ${enabled ? 'enabled' : 'disabled'}`);
    provideFeedback('success');
  };

  const handleReduceMotionToggle = (enabled: boolean) => {
    updateSettings({ reduceMotion: enabled });
    announceAction(`Reduce motion ${enabled ? 'enabled' : 'disabled'}`);
    provideFeedback('success');
  };

  const handleBoldTextToggle = (enabled: boolean) => {
    updateSettings({ boldText: enabled });
    announceAction(`Bold text ${enabled ? 'enabled' : 'disabled'}`);
    provideFeedback('success');
  };

  const testScreenReader = () => {
    setTestAnnouncement(true);
    announceAction('Screen reader test successful', true);
    setTimeout(() => setTestAnnouncement(false), 2000);
  };

  const showAccessibilityInfo = () => {
    Alert.alert(
      t('settings.accessibility'),
      `Screen Reader: ${settings.isScreenReaderEnabled ? 'Enabled' : 'Disabled'}\n` +
      `Font Scale: ${fontScale}x\n` +
      `High Contrast: ${settings.highContrast ? 'On' : 'Off'}\n` +
      `Reduce Motion: ${settings.reduceMotion ? 'On' : 'Off'}\n` +
      `Bold Text: ${settings.boldText ? 'On' : 'Off'}`,
      [{ text: t('common.ok') }]
    );
  };

  const FontSizeOption = ({ size, label }: { size: string; label: string }) => (
    <AccessibleButton
      title={label}
      variant={settings.fontSize === size ? 'primary' : 'secondary'}
      onPress={() => handleFontSizeChange(size as any)}
      style={[
        styles.fontSizeButton,
        {
          backgroundColor: settings.fontSize === size
            ? contrastColors.primary
            : 'transparent',
          borderColor: contrastColors.primary,
          borderWidth: 1,
        }
      ]}
      accessibilityHint={`Set font size to ${label}`}
      accessibilityState={{ selected: settings.fontSize === size }}
    />
  );

  return (
    <View style={[styles.container, { backgroundColor: contrastColors.background }]}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        accessibilityLabel={t('settings.accessibility')}
      >
        {/* Screen Reader Status */}
        <AccessibleCard
          title={t('accessibility.screenReaderStatus')}
          subtitle={settings.isScreenReaderEnabled
            ? t('accessibility.screenReaderEnabled')
            : t('accessibility.screenReaderDisabled')
          }
          style={styles.card}
        >
          <View style={styles.statusContainer}>
            <AccessibleText variant="body">
              {settings.isVoiceOverRunning && 'VoiceOver: Active'}
              {settings.isTalkBackRunning && 'TalkBack: Active'}
            </AccessibleText>
          </View>
        </AccessibleCard>

        {/* Font Size Settings */}
        <AccessibleCard title={t('settings.fontSize')} style={styles.card}>
          <View style={styles.fontSizeContainer}>
            <FontSizeOption size="small" label={t('settings.small')} />
            <FontSizeOption size="normal" label={t('settings.normal')} />
            <FontSizeOption size="large" label={t('settings.large')} />
            <FontSizeOption size="extraLarge" label={t('settings.extraLarge')} />
          </View>

          <View style={styles.previewContainer}>
            <AccessibleText variant="caption">
              {t('accessibility.previewText')}
            </AccessibleText>
            <AccessibleText variant="body" style={styles.previewText}>
              {t('accessibility.sampleText')}
            </AccessibleText>
          </View>
        </AccessibleCard>

        {/* High Contrast */}
        <AccessibleCard style={styles.card}>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <AccessibleText variant="subheading">
                {t('settings.highContrast')}
              </AccessibleText>
              <AccessibleText variant="caption">
                {t('accessibility.highContrastDescription')}
              </AccessibleText>
            </View>
            <Switch
              value={settings.highContrast}
              onValueChange={handleHighContrastToggle}
              trackColor={{
                false: contrastColors.border,
                true: contrastColors.primary
              }}
              thumbColor={contrastColors.background}
              accessibilityLabel={t('settings.highContrast')}
              accessibilityHint={`${t('accessibility.toggleHint')} ${settings.highContrast ? t('common.disable') : t('common.enable')} high contrast`}
              accessibilityRole="switch"
              accessibilityState={{ checked: settings.highContrast }}
            />
          </View>
        </AccessibleCard>

        {/* Reduce Motion */}
        <AccessibleCard style={styles.card}>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <AccessibleText variant="subheading">
                {t('settings.reduceMotion')}
              </AccessibleText>
              <AccessibleText variant="caption">
                {t('accessibility.reduceMotionDescription')}
              </AccessibleText>
            </View>
            <Switch
              value={settings.reduceMotion}
              onValueChange={handleReduceMotionToggle}
              trackColor={{
                false: contrastColors.border,
                true: contrastColors.primary
              }}
              thumbColor={contrastColors.background}
              accessibilityLabel={t('settings.reduceMotion')}
              accessibilityHint={`${t('accessibility.toggleHint')} ${settings.reduceMotion ? t('common.disable') : t('common.enable')} reduce motion`}
              accessibilityRole="switch"
              accessibilityState={{ checked: settings.reduceMotion }}
            />
          </View>
        </AccessibleCard>

        {/* Bold Text */}
        <AccessibleCard style={styles.card}>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <AccessibleText variant="subheading">
                {t('accessibility.boldText')}
              </AccessibleText>
              <AccessibleText variant="caption">
                {t('accessibility.boldTextDescription')}
              </AccessibleText>
            </View>
            <Switch
              value={settings.boldText}
              onValueChange={handleBoldTextToggle}
              trackColor={{
                false: contrastColors.border,
                true: contrastColors.primary
              }}
              thumbColor={contrastColors.background}
              accessibilityLabel={t('accessibility.boldText')}
              accessibilityHint={`${t('accessibility.toggleHint')} ${settings.boldText ? t('common.disable') : t('common.enable')} bold text`}
              accessibilityRole="switch"
              accessibilityState={{ checked: settings.boldText }}
            />
          </View>
        </AccessibleCard>

        {/* Test Features */}
        <AccessibleCard title={t('accessibility.testFeatures')} style={styles.card}>
          <View style={styles.testContainer}>
            <AccessibleButton
              title={t('accessibility.testScreenReader')}
              onPress={testScreenReader}
              variant="secondary"
              style={styles.testButton}
              accessibilityHint={t('accessibility.testScreenReaderHint')}
            />

            {testAnnouncement && (
              <AccessibleText
                variant="body"
                style={[styles.testMessage, { color: contrastColors.success }]}
                accessibilityRole="alert"
              >
                {t('accessibility.testSuccessful')}
              </AccessibleText>
            )}

            <AccessibleButton
              title={t('accessibility.showInfo')}
              onPress={showAccessibilityInfo}
              variant="secondary"
              style={styles.testButton}
              accessibilityHint={t('accessibility.showInfoHint')}
            />
          </View>
        </AccessibleCard>

        {/* WCAG Information */}
        <AccessibleCard title={t('accessibility.wcagCompliance')} style={styles.card}>
          <AccessibleText variant="body" style={styles.wcagText}>
            {t('accessibility.wcagDescription')}
          </AccessibleText>
          <AccessibleText variant="caption" style={styles.wcagLevel}>
            {t('accessibility.wcagLevel')}
          </AccessibleText>
        </AccessibleCard>

      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  card: {
    marginBottom: 16,
  },
  statusContainer: {
    marginTop: 8,
  },
  fontSizeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  fontSizeButton: {
    flex: 1,
    minWidth: 80,
    marginBottom: 8,
  },
  previewContainer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: 8,
  },
  previewText: {
    marginTop: 4,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  testContainer: {
    gap: 12,
  },
  testButton: {
    marginBottom: 8,
  },
  testMessage: {
    textAlign: 'center',
    fontWeight: '500',
  },
  wcagText: {
    marginBottom: 8,
    lineHeight: 24,
  },
  wcagLevel: {
    fontStyle: 'italic',
  },
});

export default React.memo(AccessibilitySettingsScreen);