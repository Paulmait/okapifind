/**
 * Unified Brand Configuration
 * Consistent branding across web, iOS, and Android
 */

export const BrandConfig = {
  // Brand Identity
  name: 'OkapiFind',
  tagline: 'Never lose your car again',
  description: 'Smart parking app that automatically remembers where you parked',

  // Brand Colors (Works across all platforms)
  colors: {
    // Primary Colors
    primary: '#007AFF',        // iOS Blue - Main brand color
    primaryDark: '#0051D5',    // Darker shade for hover/active
    primaryLight: '#4DA3FF',   // Lighter shade for backgrounds
    primaryAlpha: 'rgba(0, 122, 255, 0.1)', // Transparent primary

    // Secondary Colors
    secondary: '#5856D6',      // Purple accent
    secondaryDark: '#3634A3',
    secondaryLight: '#7C7AE6',

    // Status Colors
    success: '#34C759',        // Green
    warning: '#FF9500',        // Orange
    error: '#FF3B30',          // Red
    info: '#5AC8FA',           // Light Blue

    // Neutral Colors
    black: '#000000',
    white: '#FFFFFF',
    gray: {
      50: '#F9FAFB',
      100: '#F3F4F6',
      200: '#E5E7EB',
      300: '#D1D5DB',
      400: '#9CA3AF',
      500: '#6B7280',
      600: '#4B5563',
      700: '#374151',
      800: '#1F2937',
      900: '#111827',
    },

    // Background Colors
    background: {
      primary: '#FFFFFF',
      secondary: '#F9FAFB',
      tertiary: '#F3F4F6',
      inverse: '#1F2937',
    },

    // Text Colors
    text: {
      primary: '#111827',
      secondary: '#6B7280',
      tertiary: '#9CA3AF',
      inverse: '#FFFFFF',
      link: '#007AFF',
    },

    // Gradient (for special elements)
    gradient: {
      start: '#667EEA',
      end: '#764BA2',
    },
  },

  // Typography (Cross-platform fonts)
  fonts: {
    // Font families with fallbacks
    primary: {
      web: '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, Oxygen, Ubuntu, sans-serif',
      ios: 'System',
      android: 'Roboto',
    },
    mono: {
      web: '"SF Mono", "Monaco", "Inconsolata", "Fira Code", monospace',
      ios: 'Menlo',
      android: 'monospace',
    },

    // Font sizes (rem for web, number for mobile)
    sizes: {
      xs: { web: '0.75rem', mobile: 12 },    // 12px
      sm: { web: '0.875rem', mobile: 14 },   // 14px
      base: { web: '1rem', mobile: 16 },     // 16px
      lg: { web: '1.125rem', mobile: 18 },   // 18px
      xl: { web: '1.25rem', mobile: 20 },    // 20px
      '2xl': { web: '1.5rem', mobile: 24 },  // 24px
      '3xl': { web: '1.875rem', mobile: 30 },// 30px
      '4xl': { web: '2.25rem', mobile: 36 }, // 36px
      '5xl': { web: '3rem', mobile: 48 },    // 48px
    },

    // Font weights
    weights: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },

    // Line heights
    lineHeights: {
      tight: 1.25,
      normal: 1.5,
      relaxed: 1.75,
      loose: 2,
    },
  },

  // Spacing (consistent across platforms)
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    '2xl': 48,
    '3xl': 64,
  },

  // Border Radius
  borderRadius: {
    none: 0,
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    '2xl': 24,
    full: 9999,
  },

  // Shadows (for depth)
  shadows: {
    sm: {
      web: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
      },
      android: 2,
    },
    md: {
      web: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: 4,
    },
    lg: {
      web: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
      },
      android: 6,
    },
    xl: {
      web: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
      },
      android: 8,
    },
  },

  // Breakpoints for responsive design
  breakpoints: {
    xs: 0,      // Mobile portrait
    sm: 640,    // Mobile landscape
    md: 768,    // Tablet portrait
    lg: 1024,   // Tablet landscape / Desktop
    xl: 1280,   // Desktop
    '2xl': 1536,// Large desktop
  },

  // Animation durations
  animations: {
    fast: 150,
    normal: 300,
    slow: 500,
  },

  // Z-index layers
  zIndex: {
    base: 0,
    dropdown: 10,
    sticky: 20,
    overlay: 30,
    modal: 40,
    popover: 50,
    tooltip: 60,
    toast: 70,
  },

  // Icon sizes
  icons: {
    xs: 16,
    sm: 20,
    md: 24,
    lg: 28,
    xl: 32,
    '2xl': 40,
  },

  // Button configurations
  buttons: {
    sizes: {
      sm: {
        paddingX: 12,
        paddingY: 6,
        fontSize: 14,
        iconSize: 16,
      },
      md: {
        paddingX: 16,
        paddingY: 8,
        fontSize: 16,
        iconSize: 20,
      },
      lg: {
        paddingX: 24,
        paddingY: 12,
        fontSize: 18,
        iconSize: 24,
      },
    },
    minHeight: {
      sm: 32,
      md: 44,  // Minimum touch target
      lg: 56,
    },
  },

  // Input field configurations
  inputs: {
    minHeight: 44,  // Accessibility minimum
    padding: 12,
    borderWidth: 1,
    focusRingWidth: 2,
  },

  // Card configurations
  cards: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
};

// Export type-safe theme
export type BrandTheme = typeof BrandConfig;

// Helper function to get platform-specific values
export const getPlatformValue = <T>(
  values: { web?: T; ios?: T; android?: T; default?: T },
  platform: 'web' | 'ios' | 'android'
): T => {
  return values[platform] || values.default || (values.web as T);
};

// Export individual color schemes for quick access
export const { colors, fonts, spacing, borderRadius } = BrandConfig;