import React, { useState, useEffect } from 'react';
import { BrandConfig } from '../../config/brand';

interface ResponsiveLayoutProps {
  children: React.ReactNode;
  sidebar?: React.ReactNode;
  bottomNav?: React.ReactNode;
  header?: React.ReactNode;
}

export const ResponsiveLayout: React.FC<ResponsiveLayoutProps> = ({
  children,
  sidebar,
  bottomNav,
  header,
}) => {
  const [screenSize, setScreenSize] = useState<'mobile' | 'tablet' | 'desktop'>('desktop');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      if (width < BrandConfig.breakpoints.md) {
        setScreenSize('mobile');
      } else if (width < BrandConfig.breakpoints.lg) {
        setScreenSize('tablet');
      } else {
        setScreenSize('desktop');
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const styles = {
    container: {
      display: 'flex',
      flexDirection: 'column' as const,
      minHeight: '100vh',
      backgroundColor: BrandConfig.colors.background.primary,
    },
    header: {
      position: 'sticky' as const,
      top: 0,
      zIndex: BrandConfig.zIndex.sticky,
      backgroundColor: BrandConfig.colors.white,
      borderBottom: `1px solid ${BrandConfig.colors.gray[200]}`,
      boxShadow: BrandConfig.shadows.sm.web,
    },
    mainWrapper: {
      display: 'flex',
      flex: 1,
      position: 'relative' as const,
    },
    sidebar: {
      width: screenSize === 'mobile' ? '280px' : '300px',
      backgroundColor: BrandConfig.colors.white,
      borderRight: `1px solid ${BrandConfig.colors.gray[200]}`,
      height: '100%',
      overflowY: 'auto' as const,
      transition: 'transform 0.3s ease',
      ...(screenSize === 'mobile' && {
        position: 'fixed' as const,
        top: 0,
        left: 0,
        bottom: 0,
        zIndex: BrandConfig.zIndex.modal,
        transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
      }),
      ...(screenSize === 'tablet' && {
        width: '250px',
      }),
    },
    sidebarOverlay: {
      position: 'fixed' as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      zIndex: BrandConfig.zIndex.overlay,
      display: sidebarOpen && screenSize === 'mobile' ? 'block' : 'none',
    },
    main: {
      flex: 1,
      padding: screenSize === 'mobile'
        ? BrandConfig.spacing.md
        : screenSize === 'tablet'
        ? BrandConfig.spacing.lg
        : BrandConfig.spacing.xl,
      paddingBottom: screenSize === 'mobile' && bottomNav
        ? '80px'
        : BrandConfig.spacing.xl,
      maxWidth: '100%',
      overflowX: 'hidden' as const,
    },
    bottomNav: {
      position: 'fixed' as const,
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: BrandConfig.colors.white,
      borderTop: `1px solid ${BrandConfig.colors.gray[200]}`,
      boxShadow: '0 -2px 10px rgba(0, 0, 0, 0.1)',
      zIndex: BrandConfig.zIndex.sticky,
      display: screenSize === 'mobile' ? 'block' : 'none',
    },
    menuButton: {
      position: 'fixed' as const,
      top: '10px',
      left: '10px',
      zIndex: BrandConfig.zIndex.sticky + 1,
      backgroundColor: BrandConfig.colors.white,
      border: `1px solid ${BrandConfig.colors.gray[300]}`,
      borderRadius: BrandConfig.borderRadius.md,
      padding: '8px',
      cursor: 'pointer',
      display: screenSize === 'mobile' ? 'flex' : 'none',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: BrandConfig.shadows.md.web,
    },
    contentGrid: {
      display: 'grid',
      gridTemplateColumns: screenSize === 'mobile'
        ? '1fr'
        : screenSize === 'tablet'
        ? 'repeat(auto-fit, minmax(300px, 1fr))'
        : 'repeat(auto-fit, minmax(350px, 1fr))',
      gap: BrandConfig.spacing.lg,
      width: '100%',
    },
  };

  return (
    <div style={styles.container}>
      {header && <div style={styles.header}>{header}</div>}

      <div style={styles.mainWrapper}>
        {sidebar && screenSize !== 'mobile' && (
          <div style={styles.sidebar}>{sidebar}</div>
        )}

        {sidebar && screenSize === 'mobile' && (
          <>
            <div
              style={styles.sidebarOverlay}
              onClick={() => setSidebarOpen(false)}
            />
            <div style={styles.sidebar}>{sidebar}</div>
            <button
              style={styles.menuButton}
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label="Toggle menu"
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke={BrandConfig.colors.text.primary}
                strokeWidth="2"
              >
                {sidebarOpen ? (
                  <path d="M18 6L6 18M6 6l12 12" />
                ) : (
                  <path d="M3 12h18M3 6h18M3 18h18" />
                )}
              </svg>
            </button>
          </>
        )}

        <main style={styles.main}>
          <div style={styles.contentGrid}>
            {children}
          </div>
        </main>
      </div>

      {bottomNav && (
        <div style={styles.bottomNav}>{bottomNav}</div>
      )}
    </div>
  );
};

interface CardProps {
  children: React.ReactNode;
  title?: string;
  actions?: React.ReactNode;
  padding?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  title,
  actions,
  padding = true
}) => {
  const styles = {
    card: {
      backgroundColor: BrandConfig.colors.white,
      borderRadius: BrandConfig.borderRadius.lg,
      boxShadow: BrandConfig.shadows.md.web,
      overflow: 'hidden' as const,
      transition: 'box-shadow 0.3s ease',
    },
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: BrandConfig.spacing.md,
      borderBottom: `1px solid ${BrandConfig.colors.gray[200]}`,
    },
    title: {
      fontSize: BrandConfig.fonts.sizes.lg.web,
      fontWeight: BrandConfig.fonts.weights.semibold,
      color: BrandConfig.colors.text.primary,
    },
    content: {
      padding: padding ? BrandConfig.spacing.md : 0,
    },
  };

  return (
    <div style={styles.card}>
      {title && (
        <div style={styles.header}>
          <h3 style={styles.title}>{title}</h3>
          {actions}
        </div>
      )}
      <div style={styles.content}>{children}</div>
    </div>
  );
};

interface ButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  onClick,
  disabled = false,
}) => {
  const baseStyles = {
    border: 'none',
    borderRadius: BrandConfig.borderRadius.md,
    fontWeight: BrandConfig.fonts.weights.medium,
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'all 0.2s ease',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: BrandConfig.spacing.sm,
    width: fullWidth ? '100%' : 'auto',
    opacity: disabled ? 0.5 : 1,
  };

  const sizeStyles = {
    sm: {
      padding: `${BrandConfig.buttons.sizes.sm.paddingY}px ${BrandConfig.buttons.sizes.sm.paddingX}px`,
      fontSize: `${BrandConfig.buttons.sizes.sm.fontSize}px`,
      minHeight: `${BrandConfig.buttons.minHeight.sm}px`,
    },
    md: {
      padding: `${BrandConfig.buttons.sizes.md.paddingY}px ${BrandConfig.buttons.sizes.md.paddingX}px`,
      fontSize: `${BrandConfig.buttons.sizes.md.fontSize}px`,
      minHeight: `${BrandConfig.buttons.minHeight.md}px`,
    },
    lg: {
      padding: `${BrandConfig.buttons.sizes.lg.paddingY}px ${BrandConfig.buttons.sizes.lg.paddingX}px`,
      fontSize: `${BrandConfig.buttons.sizes.lg.fontSize}px`,
      minHeight: `${BrandConfig.buttons.minHeight.lg}px`,
    },
  };

  const variantStyles = {
    primary: {
      backgroundColor: BrandConfig.colors.primary,
      color: BrandConfig.colors.white,
    },
    secondary: {
      backgroundColor: BrandConfig.colors.secondary,
      color: BrandConfig.colors.white,
    },
    outline: {
      backgroundColor: 'transparent',
      color: BrandConfig.colors.primary,
      border: `2px solid ${BrandConfig.colors.primary}`,
    },
    ghost: {
      backgroundColor: 'transparent',
      color: BrandConfig.colors.text.primary,
    },
  };

  return (
    <button
      style={{
        ...baseStyles,
        ...sizeStyles[size],
        ...variantStyles[variant],
      }}
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.transform = 'scale(1.02)';
          e.currentTarget.style.boxShadow = BrandConfig.shadows.lg.web;
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'scale(1)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      {children}
    </button>
  );
};