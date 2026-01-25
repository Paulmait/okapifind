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