import React, { useState } from 'react';
import { BrandConfig } from '../../config/brand';
import { Button } from './ResponsiveLayout';

interface AuthComponentProps {
  onSuccess: (user: any) => void;
  onError?: (error: string) => void;
}

export const AuthComponent: React.FC<AuthComponentProps> = ({ onSuccess, onError }) => {
  const [mode, setMode] = useState<'signin' | 'signup' | 'reset'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const endpoint = mode === 'signin' ? '/api/auth/signin'
        : mode === 'signup' ? '/api/auth/signup'
        : '/api/auth/reset';

      const body = mode === 'signin'
        ? { email, password }
        : mode === 'signup'
        ? { email, password, name }
        : { email };

      if (mode === 'signup' && password !== confirmPassword) {
        throw new Error('Passwords do not match');
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Platform': 'web',
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      if (mode === 'reset') {
        setSuccess('Password reset email sent! Check your inbox.');
        setTimeout(() => setMode('signin'), 3000);
      } else {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        onSuccess(data.user);
      }
    } catch (err: any) {
      setError(err.message);
      onError?.(err.message);
    } finally {
      setLoading(false);
    }
  };

  const styles = {
    container: {
      maxWidth: '400px',
      margin: '0 auto',
      padding: BrandConfig.spacing.xl,
    },
    form: {
      backgroundColor: BrandConfig.colors.white,
      borderRadius: BrandConfig.borderRadius.xl,
      padding: BrandConfig.spacing.xl,
      boxShadow: BrandConfig.shadows.lg.web,
    },
    logo: {
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      marginBottom: BrandConfig.spacing.xl,
    },
    logoImage: {
      width: '80px',
      height: '80px',
      marginBottom: BrandConfig.spacing.md,
    },
    title: {
      fontSize: BrandConfig.fonts.sizes['2xl'].web,
      fontWeight: BrandConfig.fonts.weights.bold,
      color: BrandConfig.colors.text.primary,
      marginBottom: BrandConfig.spacing.sm,
      textAlign: 'center' as const,
    },
    subtitle: {
      fontSize: BrandConfig.fonts.sizes.sm.web,
      color: BrandConfig.colors.text.secondary,
      textAlign: 'center' as const,
      marginBottom: BrandConfig.spacing.xl,
    },
    inputGroup: {
      marginBottom: BrandConfig.spacing.md,
    },
    label: {
      display: 'block',
      fontSize: BrandConfig.fonts.sizes.sm.web,
      fontWeight: BrandConfig.fonts.weights.medium,
      color: BrandConfig.colors.text.primary,
      marginBottom: BrandConfig.spacing.xs,
    },
    input: {
      width: '100%',
      padding: `${BrandConfig.inputs.padding}px`,
      fontSize: BrandConfig.fonts.sizes.base.web,
      border: `${BrandConfig.inputs.borderWidth}px solid ${BrandConfig.colors.gray[300]}`,
      borderRadius: BrandConfig.borderRadius.md,
      transition: 'border-color 0.2s',
      minHeight: `${BrandConfig.inputs.minHeight}px`,
      outline: 'none',
    },
    inputFocus: {
      borderColor: BrandConfig.colors.primary,
      boxShadow: `0 0 0 ${BrandConfig.inputs.focusRingWidth}px ${BrandConfig.colors.primaryAlpha}`,
    },
    error: {
      backgroundColor: `${BrandConfig.colors.error}15`,
      color: BrandConfig.colors.error,
      padding: BrandConfig.spacing.sm,
      borderRadius: BrandConfig.borderRadius.md,
      fontSize: BrandConfig.fonts.sizes.sm.web,
      marginBottom: BrandConfig.spacing.md,
    },
    success: {
      backgroundColor: `${BrandConfig.colors.success}15`,
      color: BrandConfig.colors.success,
      padding: BrandConfig.spacing.sm,
      borderRadius: BrandConfig.borderRadius.md,
      fontSize: BrandConfig.fonts.sizes.sm.web,
      marginBottom: BrandConfig.spacing.md,
    },
    divider: {
      display: 'flex',
      alignItems: 'center',
      marginTop: BrandConfig.spacing.lg,
      marginBottom: BrandConfig.spacing.lg,
    },
    dividerLine: {
      flex: 1,
      height: '1px',
      backgroundColor: BrandConfig.colors.gray[300],
    },
    dividerText: {
      padding: `0 ${BrandConfig.spacing.md}px`,
      fontSize: BrandConfig.fonts.sizes.sm.web,
      color: BrandConfig.colors.text.tertiary,
    },
    socialButtons: {
      display: 'flex',
      gap: BrandConfig.spacing.md,
      marginBottom: BrandConfig.spacing.lg,
    },
    socialButton: {
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: BrandConfig.spacing.sm,
      padding: `${BrandConfig.spacing.sm}px`,
      border: `1px solid ${BrandConfig.colors.gray[300]}`,
      borderRadius: BrandConfig.borderRadius.md,
      backgroundColor: BrandConfig.colors.white,
      cursor: 'pointer',
      transition: 'background-color 0.2s',
      fontSize: BrandConfig.fonts.sizes.sm.web,
    },
    links: {
      display: 'flex',
      justifyContent: 'space-between',
      marginTop: BrandConfig.spacing.md,
      fontSize: BrandConfig.fonts.sizes.sm.web,
    },
    link: {
      color: BrandConfig.colors.primary,
      cursor: 'pointer',
      textDecoration: 'none',
    },
  };

  return (
    <div style={styles.container}>
      <form style={styles.form} onSubmit={handleSubmit}>
        <div style={styles.logo}>
          <img
            src="/icon-192.png"
            alt="OkapiFind"
            style={styles.logoImage}
          />
        </div>

        <h2 style={styles.title}>
          {mode === 'signin' ? 'Welcome Back'
            : mode === 'signup' ? 'Create Account'
            : 'Reset Password'}
        </h2>

        <p style={styles.subtitle}>
          {mode === 'signin' ? 'Sign in to continue to OkapiFind'
            : mode === 'signup' ? 'Join OkapiFind to never lose your car again'
            : 'Enter your email to receive a reset link'}
        </p>

        {error && <div style={styles.error}>{error}</div>}
        {success && <div style={styles.success}>{success}</div>}

        {mode === 'signup' && (
          <div style={styles.inputGroup}>
            <label style={styles.label}>Full Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={styles.input}
              placeholder="John Doe"
              required
              onFocus={(e) => {
                e.target.style.borderColor = BrandConfig.colors.primary;
                e.target.style.boxShadow = `0 0 0 ${BrandConfig.inputs.focusRingWidth}px ${BrandConfig.colors.primaryAlpha}`;
              }}
              onBlur={(e) => {
                e.target.style.borderColor = BrandConfig.colors.gray[300];
                e.target.style.boxShadow = 'none';
              }}
            />
          </div>
        )}

        <div style={styles.inputGroup}>
          <label style={styles.label}>Email Address</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={styles.input}
            placeholder="you@example.com"
            required
            onFocus={(e) => {
              e.target.style.borderColor = BrandConfig.colors.primary;
              e.target.style.boxShadow = `0 0 0 ${BrandConfig.inputs.focusRingWidth}px ${BrandConfig.colors.primaryAlpha}`;
            }}
            onBlur={(e) => {
              e.target.style.borderColor = BrandConfig.colors.gray[300];
              e.target.style.boxShadow = 'none';
            }}
          />
        </div>

        {mode !== 'reset' && (
          <div style={styles.inputGroup}>
            <label style={styles.label}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={styles.input}
              placeholder="••••••••"
              required
              minLength={6}
              onFocus={(e) => {
                e.target.style.borderColor = BrandConfig.colors.primary;
                e.target.style.boxShadow = `0 0 0 ${BrandConfig.inputs.focusRingWidth}px ${BrandConfig.colors.primaryAlpha}`;
              }}
              onBlur={(e) => {
                e.target.style.borderColor = BrandConfig.colors.gray[300];
                e.target.style.boxShadow = 'none';
              }}
            />
          </div>
        )}

        {mode === 'signup' && (
          <div style={styles.inputGroup}>
            <label style={styles.label}>Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              style={styles.input}
              placeholder="••••••••"
              required
              minLength={6}
              onFocus={(e) => {
                e.target.style.borderColor = BrandConfig.colors.primary;
                e.target.style.boxShadow = `0 0 0 ${BrandConfig.inputs.focusRingWidth}px ${BrandConfig.colors.primaryAlpha}`;
              }}
              onBlur={(e) => {
                e.target.style.borderColor = BrandConfig.colors.gray[300];
                e.target.style.boxShadow = 'none';
              }}
            />
          </div>
        )}

        <Button
          variant="primary"
          size="lg"
          fullWidth
          disabled={loading}
        >
          {loading ? 'Loading...'
            : mode === 'signin' ? 'Sign In'
            : mode === 'signup' ? 'Create Account'
            : 'Send Reset Email'}
        </Button>

        {mode !== 'reset' && (
          <>
            <div style={styles.divider}>
              <div style={styles.dividerLine} />
              <span style={styles.dividerText}>OR</span>
              <div style={styles.dividerLine} />
            </div>

            <div style={styles.socialButtons}>
              <button
                type="button"
                style={styles.socialButton}
                onClick={() => console.log('Google login')}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = BrandConfig.colors.gray[50];
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = BrandConfig.colors.white;
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Google
              </button>

              <button
                type="button"
                style={styles.socialButton}
                onClick={() => console.log('Apple login')}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = BrandConfig.colors.gray[50];
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = BrandConfig.colors.white;
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="black">
                  <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                </svg>
                Apple
              </button>
            </div>
          </>
        )}

        <div style={styles.links}>
          {mode === 'signin' && (
            <>
              <a
                style={styles.link}
                onClick={() => setMode('reset')}
              >
                Forgot password?
              </a>
              <a
                style={styles.link}
                onClick={() => setMode('signup')}
              >
                Create account
              </a>
            </>
          )}
          {mode === 'signup' && (
            <a
              style={styles.link}
              onClick={() => setMode('signin')}
            >
              Already have an account? Sign in
            </a>
          )}
          {mode === 'reset' && (
            <a
              style={styles.link}
              onClick={() => setMode('signin')}
            >
              Back to sign in
            </a>
          )}
        </div>
      </form>
    </div>
  );
};