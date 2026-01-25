export const Colors = {
  // Primary brand colors from logo - WCAG 2.1 AA compliant
  // Gold (#FFD700) on Navy (#0F1B2A) = 10.4:1 contrast ratio (AAA)
  primary: '#FFD700', // Gold/yellow from logo
  primaryDark: '#E5C100', // Darker gold for better contrast on light backgrounds
  primaryLight: '#FFF4CC', // Light yellow for backgrounds

  // Background colors from splash screen
  background: '#0F1B2A', // Dark navy blue from splash
  backgroundLight: '#1A2B3D', // Slightly lighter navy

  // Text colors - WCAG AA compliant (minimum 4.5:1 for normal text)
  text: '#FFFFFF', // Default text color (alias for textPrimary)
  textPrimary: '#FFFFFF', // White text - 15.1:1 on navy
  textSecondary: '#B8C5D3', // Light gray-blue - 7.2:1 on navy
  textDark: '#0F1B2A', // Dark text on light backgrounds

  // UI elements - Accessible status colors
  cardBackground: '#FFFFFF',
  cardBorder: '#E0E0E0',
  success: '#008A3E', // Darker green - WCAG AA compliant, distinguishable for color-blind users
  danger: '#D32F2F', // Darker red - WCAG AA compliant
  error: '#D32F2F', // Alias for danger
  warning: '#E5A000', // Darker amber - better for tritanopia
  info: '#0277BD', // Darker blue - WCAG AA compliant
  surface: '#F5F5F5', // Surface color for cards and overlays
  border: '#E0E0E0', // Default border color

  // Additional colors
  white: '#FFFFFF',
  black: '#000000',
  gray: '#757575', // Darker gray for WCAG compliance
  lightGray: '#F5F5F5',
  darkGray: '#424242',
  disabled: '#9E9E9E',
  separator: '#E0E0E0',

  // Button colors - WCAG compliant
  buttonPrimary: '#FFD700',
  buttonPrimaryText: '#0F1B2A',
  buttonSecondary: '#0F1B2A',
  buttonSecondaryText: '#FFD700',

  // Map colors
  mapAccent: '#FFD700',
  mapPath: '#E5A000', // Slightly darker for better visibility

  // Car indicator colors - Accessible for color blindness
  carIndicator: '#00BFA5', // Teal - visible for red-green color blind users
  carIndicatorLight: '#B2DFDB', // Light teal for backgrounds
  carIndicatorDark: '#00897B', // Dark teal for contrast
  userLocation: '#2196F3', // Blue - universally distinguishable

  // Shadows
  shadow: 'rgba(0, 0, 0, 0.1)',
  shadowDark: 'rgba(0, 0, 0, 0.3)',
};

export const BrandColors = {
  gold: '#FFD700',
  goldDark: '#E5C100',
  goldLight: '#FFF4CC',
  navy: '#0F1B2A',
  navyLight: '#1A2B3D',
  white: '#FFFFFF',
  offWhite: '#F8F9FA',
  // Teal palette for accessibility
  teal: '#00BFA5',
  tealDark: '#00897B',
  tealLight: '#B2DFDB',
  cyan: '#00E5FF',
};

/**
 * Dark Mode color palette
 * Optimized for OLED screens and reduced eye strain
 */
export const DarkModeColors = {
  // Backgrounds - true black for OLED power savings
  background: '#000000',
  backgroundElevated: '#121212',
  backgroundCard: '#1E1E1E',
  backgroundInput: '#2C2C2C',

  // Text colors - high contrast on black
  textPrimary: '#FFFFFF',
  textSecondary: '#B3B3B3',
  textMuted: '#808080',

  // Accent colors - teal for accessibility
  primary: '#00BFA5', // Teal instead of gold for dark mode
  primaryLight: '#4DD0B6',
  accent: '#00E5FF', // Bright cyan for highlights

  // Status colors - brighter for dark backgrounds
  success: '#00E676',
  error: '#FF5252',
  warning: '#FFD740',
  info: '#40C4FF',

  // Car indicator - bright teal
  carIndicator: '#00E5FF',
  userLocation: '#448AFF',

  // Borders and separators
  border: '#333333',
  separator: '#2C2C2C',

  // Card and surface
  cardBackground: '#1E1E1E',
  surface: '#121212',
};

/**
 * Light Mode color palette (default)
 */
export const LightModeColors = {
  // Backgrounds
  background: '#FFFFFF',
  backgroundElevated: '#F5F5F5',
  backgroundCard: '#FFFFFF',
  backgroundInput: '#F0F0F0',

  // Text colors
  textPrimary: '#0F1B2A',
  textSecondary: '#666666',
  textMuted: '#999999',

  // Accent colors
  primary: '#FFD700',
  primaryDark: '#E5C100',
  accent: '#00BFA5',

  // Status colors
  success: '#008A3E',
  error: '#D32F2F',
  warning: '#E5A000',
  info: '#0277BD',

  // Car indicator - teal for accessibility
  carIndicator: '#00BFA5',
  userLocation: '#2196F3',

  // Borders and separators
  border: '#E0E0E0',
  separator: '#EEEEEE',

  // Card and surface
  cardBackground: '#FFFFFF',
  surface: '#F5F5F5',
};

/**
 * Accessible color palettes for different types of color vision deficiency
 * These colors are designed to be distinguishable for users with color blindness
 */
export const AccessibleColors = {
  // Default palette (normal vision)
  default: {
    success: '#008A3E',
    error: '#D32F2F',
    warning: '#E5A000',
    info: '#0277BD',
    primary: '#FFD700',
  },

  // Protanopia (red-blind) - uses blue/yellow distinction
  protanopia: {
    success: '#0277BD', // Blue instead of green
    error: '#E5A000', // Amber/orange instead of red
    warning: '#9C27B0', // Purple for warning
    info: '#00BCD4', // Cyan for info
    primary: '#FFD700', // Gold remains visible
  },

  // Deuteranopia (green-blind) - uses blue/yellow distinction
  deuteranopia: {
    success: '#0277BD', // Blue instead of green
    error: '#D32F2F', // Red still visible
    warning: '#E5A000', // Amber for warning
    info: '#00BCD4', // Cyan for info
    primary: '#FFD700', // Gold remains visible
  },

  // Tritanopia (blue-yellow blind) - uses red/cyan distinction
  tritanopia: {
    success: '#00BFA5', // Teal/cyan instead of green
    error: '#D32F2F', // Red remains visible
    warning: '#FF5722', // Deep orange for warning
    info: '#E91E63', // Pink for info (instead of blue)
    primary: '#FF9800', // Orange instead of gold
  },

  // High contrast mode - maximum distinguishability
  highContrast: {
    success: '#00FF00', // Bright green
    error: '#FF0000', // Bright red
    warning: '#FFFF00', // Bright yellow
    info: '#00FFFF', // Bright cyan
    primary: '#FFFFFF', // White on dark backgrounds
  },
};

/**
 * Get accessible colors based on user's color blind mode setting
 */
export const getAccessibleColors = (
  mode: 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia' | 'highContrast' = 'none'
): typeof AccessibleColors.default => {
  switch (mode) {
    case 'protanopia':
      return AccessibleColors.protanopia;
    case 'deuteranopia':
      return AccessibleColors.deuteranopia;
    case 'tritanopia':
      return AccessibleColors.tritanopia;
    case 'highContrast':
      return AccessibleColors.highContrast;
    default:
      return AccessibleColors.default;
  }
};

/**
 * Theme type for appearance settings
 */
export type ThemeMode = 'light' | 'dark' | 'system';
export type ColorBlindMode = 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia' | 'highContrast';

/**
 * Get theme colors based on appearance mode
 */
export const getThemeColors = (mode: 'light' | 'dark' = 'light') => {
  return mode === 'dark' ? DarkModeColors : LightModeColors;
};

/**
 * Car indicator colors for different accessibility modes
 * Teal (#00BFA5) is the default - visible for most color blind users
 */
export const CarIndicatorColors = {
  default: '#00BFA5', // Teal - accessible for red-green color blindness
  highContrast: '#00FFFF', // Bright cyan - maximum visibility
  darkMode: '#00E5FF', // Bright cyan for dark backgrounds

  // Pulse/glow effect colors
  pulseDefault: 'rgba(0, 191, 165, 0.3)',
  pulseHighContrast: 'rgba(0, 255, 255, 0.4)',
  pulseDarkMode: 'rgba(0, 229, 255, 0.3)',
};

/**
 * Get the appropriate car indicator color based on settings
 */
export const getCarIndicatorColor = (
  isDarkMode: boolean = false,
  colorBlindMode: ColorBlindMode = 'none'
): string => {
  if (colorBlindMode === 'highContrast') {
    return CarIndicatorColors.highContrast;
  }
  if (isDarkMode) {
    return CarIndicatorColors.darkMode;
  }
  return CarIndicatorColors.default;
};