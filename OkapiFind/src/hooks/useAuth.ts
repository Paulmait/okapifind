import { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  getFirestore
} from 'firebase/firestore';
import { firebaseAuth, firebaseApp } from '../config/firebase';
import { analytics } from '../services/analytics';
import { authService } from '../services/auth.service';
import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isFirebaseConfigured } from '../config/firebase';
import { supabaseAuthService, SupabaseUser } from '../services/supabaseAuth.service';

// Web-compatible storage
const storage = Platform.OS === 'web'
  ? {
      getItem: async (name: string) => {
        const value = localStorage.getItem(name);
        return value;
      },
      setItem: async (name: string, value: string) => {
        localStorage.setItem(name, value);
      },
      removeItem: async (name: string) => {
        localStorage.removeItem(name);
      },
    }
  : AsyncStorage;

// Initialize Firestore safely - only if Firebase is configured
let db: ReturnType<typeof getFirestore> | null = null;
try {
  if (isFirebaseConfigured() && firebaseApp && typeof firebaseApp.name === 'string') {
    db = getFirestore(firebaseApp);
  }
} catch (error) {
  console.warn('Firestore initialization skipped - Firebase not configured');
}

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  createdAt: any;
  lastLoginAt: any;
  premium: boolean;
  subscriptionId?: string;
  provider: string;
}

interface AuthState {
  currentUser: User | null;
  supabaseUser: SupabaseUser | null;
  userProfile: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  authProvider: 'firebase' | 'supabase' | null;
  setCurrentUser: (user: User | null) => void;
  setSupabaseUser: (user: SupabaseUser | null) => void;
  setUserProfile: (profile: UserProfile | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  signOutUser: () => Promise<void>;
  signInWithGoogle: () => Promise<any>;
  signInWithApple: () => Promise<any>;
  appleSignInAvailable: boolean;
  setAppleSignInAvailable: (available: boolean) => void;
}

// Create auth store with persistence
const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      currentUser: null,
      supabaseUser: null,
      userProfile: null,
      isLoading: true,
      isAuthenticated: false,
      error: null,
      appleSignInAvailable: false,
      authProvider: null,

      setCurrentUser: (user) => set({
        currentUser: user,
        isAuthenticated: !!user || !!get().supabaseUser,
        authProvider: user ? 'firebase' : get().authProvider
      }),

      setSupabaseUser: (user) => set({
        supabaseUser: user,
        isAuthenticated: !!user || !!get().currentUser,
        authProvider: user ? 'supabase' : get().authProvider
      }),

      setUserProfile: (profile) => set({
        userProfile: profile
      }),

      setLoading: (loading) => set({
        isLoading: loading
      }),

      setError: (error) => set({
        error
      }),

      setAppleSignInAvailable: (available) => set({
        appleSignInAvailable: available
      }),

      signOutUser: async () => {
        try {
          set({ isLoading: true });
          const { authProvider } = get();

          // Sign out from Firebase if needed
          if ((authProvider === 'firebase' || !authProvider) && isFirebaseConfigured() && firebaseAuth && typeof firebaseAuth.signOut === 'function') {
            try {
              await signOut(firebaseAuth);
            } catch (e) {
              console.warn('Firebase sign out failed:', e);
            }
          }

          // Sign out from Supabase if needed
          if (authProvider === 'supabase' || !authProvider) {
            try {
              await supabaseAuthService.signOut();
            } catch (e) {
              console.warn('Supabase sign out failed:', e);
            }
          }

          set({
            currentUser: null,
            supabaseUser: null,
            userProfile: null,
            isAuthenticated: false,
            authProvider: null,
            error: null
          });
          analytics.logEvent('user_signed_out');
        } catch (error: any) {
          console.error('Sign out error:', error);
          set({ error: error.message });
          // Still clear local state even if signOut fails
          set({
            currentUser: null,
            supabaseUser: null,
            userProfile: null,
            isAuthenticated: false,
            authProvider: null,
          });
        } finally {
          set({ isLoading: false });
        }
      },

      signInWithGoogle: async () => {
        // This will be implemented by components using the GoogleLoginButton
        throw new Error('Use GoogleLoginButton component for Google Sign-In');
      },

      signInWithApple: async () => {
        return await authService.signInWithApple();
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => storage),
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        userProfile: state.userProfile
      }),
    }
  )
);

export const useAuth = () => {
  const {
    currentUser,
    supabaseUser,
    userProfile,
    isLoading,
    isAuthenticated,
    error,
    appleSignInAvailable,
    authProvider,
    setCurrentUser,
    setSupabaseUser,
    setUserProfile,
    setLoading,
    setError,
    setAppleSignInAvailable,
    signOutUser,
    signInWithGoogle,
    signInWithApple,
  } = useAuthStore();

  const [authInitialized, setAuthInitialized] = useState(false);

  // Check Apple Sign-In availability
  useEffect(() => {
    if (Platform.OS === 'ios') {
      AppleAuthentication.isAvailableAsync().then(setAppleSignInAvailable);
    }
  }, []);

  // Listen for Supabase auth state changes
  useEffect(() => {
    const unsubscribe = supabaseAuthService.onAuthStateChange((user) => {
      console.log('🔵 Supabase auth state changed:', { hasUser: !!user, email: user?.email });

      if (user) {
        setSupabaseUser(user);
        // Create a basic profile from Supabase user
        setUserProfile({
          uid: user.id,
          email: user.email,
          displayName: user.email?.split('@')[0] || null,
          photoURL: null,
          createdAt: user.created_at,
          lastLoginAt: user.updated_at,
          premium: false,
          provider: 'magic_link',
        });
        analytics.setUserId(user.id);
        analytics.logEvent('user_authenticated', {
          provider: 'magic_link',
          uid: user.id,
        });
      } else if (!currentUser) {
        // Only clear if no Firebase user either
        setSupabaseUser(null);
      }
    });

    // Check for existing Supabase session on mount
    supabaseAuthService.getCurrentUser().then((user) => {
      if (user) {
        console.log('🔵 Found existing Supabase session:', user.email);
        setSupabaseUser(user);
        setUserProfile({
          uid: user.id,
          email: user.email,
          displayName: user.email?.split('@')[0] || null,
          photoURL: null,
          createdAt: user.created_at,
          lastLoginAt: user.updated_at,
          premium: false,
          provider: 'magic_link',
        });
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // Check if Firebase is properly configured before setting up auth listener
    if (!isFirebaseConfigured() || !firebaseAuth || typeof firebaseAuth.onAuthStateChanged !== 'function') {
      console.warn('Firebase not configured - running in offline/anonymous mode');
      setLoading(false);
      setAuthInitialized(true);
      return;
    }

    // Timeout fallback in case Firebase doesn't initialize
    const initTimeout = setTimeout(() => {
      if (!authInitialized) {
        console.warn('Auth initialization timeout - proceeding without auth');
        setLoading(false);
        setAuthInitialized(true);
        setError('Authentication service unavailable. Some features may be limited.');
      }
    }, 5000); // 5 second timeout

    // Listen to Firebase auth state changes
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
      try {
        clearTimeout(initTimeout); // Cancel timeout if auth state changes

        console.log('🔥 Firebase onAuthStateChanged:', {
          hasUser: !!user,
          uid: user?.uid,
          email: user?.email,
        });

        if (user) {
          // User is signed in
          setCurrentUser(user);

          console.log('✅ Setting current user in store');

          // Check/create user profile in Firestore
          await checkOrCreateUserProfile(user);

          // Set analytics user ID
          analytics.setUserId(user.uid);
          analytics.logEvent('user_authenticated', {
            provider: user.providerData[0]?.providerId || 'unknown',
            uid: user.uid,
          });
        } else {
          // User is signed out
          console.log('🚪 User signed out');
          setCurrentUser(null);
          setUserProfile(null);
          analytics.setUserId(null);
        }
      } catch (error: any) {
        console.error('Auth state change error:', error);
        setError(error.message);
      } finally {
        setLoading(false);
        setAuthInitialized(true);
      }
    });

    return () => {
      clearTimeout(initTimeout);
      unsubscribe();
    };
  }, []);

  const checkOrCreateUserProfile = async (user: User) => {
    // Skip Firestore operations if not configured
    if (!db) {
      console.warn('Firestore not available - using basic profile');
      setUserProfile({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        createdAt: null,
        lastLoginAt: null,
        premium: false,
        provider: user.providerData[0]?.providerId || 'unknown',
      });
      return;
    }

    try {
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        // User exists, update last login
        const userData = userDoc.data() as UserProfile;

        // Update last login time
        await setDoc(userDocRef, {
          lastLoginAt: serverTimestamp(),
        }, { merge: true });

        setUserProfile({
          ...userData,
          uid: user.uid,
        });

        analytics.logEvent('existing_user_login', {
          uid: user.uid,
          premium: userData.premium,
        });
      } else {
        // New user, create profile
        const newUserProfile: UserProfile = {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          createdAt: serverTimestamp(),
          lastLoginAt: serverTimestamp(),
          premium: false,
          provider: user.providerData[0]?.providerId || 'unknown',
        };

        await setDoc(userDocRef, newUserProfile);
        setUserProfile(newUserProfile);

        analytics.logEvent('new_user_created', {
          uid: user.uid,
          provider: newUserProfile.provider,
        });
      }
    } catch (error: any) {
      console.error('Error managing user profile:', error);
      setError(error.message);

      // Still set basic profile even if Firestore fails
      setUserProfile({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        createdAt: null,
        lastLoginAt: null,
        premium: false,
        provider: user.providerData[0]?.providerId || 'unknown',
      });
    }
  };

  const updatePremiumStatus = async (isPremium: boolean, subscriptionId?: string) => {
    if (!currentUser) return;
    if (!db) {
      console.warn('Firestore not available - updating local state only');
      if (userProfile) {
        setUserProfile({ ...userProfile, premium: isPremium, subscriptionId });
      }
      return;
    }

    try {
      const userDocRef = doc(db, 'users', currentUser.uid);
      await setDoc(userDocRef, {
        premium: isPremium,
        subscriptionId: subscriptionId || null,
        premiumUpdatedAt: serverTimestamp(),
      }, { merge: true });

      // Update local state
      if (userProfile) {
        setUserProfile({
          ...userProfile,
          premium: isPremium,
          subscriptionId,
        });
      }

      analytics.logEvent('premium_status_updated', {
        uid: currentUser.uid,
        premium: isPremium,
        subscription_id: subscriptionId,
      });
    } catch (error: any) {
      console.error('Error updating premium status:', error);
      setError(error.message);
    }
  };

  const refreshUserProfile = async () => {
    if (!currentUser) return;
    if (!db) {
      console.warn('Firestore not available - cannot refresh profile');
      return;
    }

    try {
      const userDocRef = doc(db, 'users', currentUser.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const userData = userDoc.data() as UserProfile;
        setUserProfile({
          ...userData,
          uid: currentUser.uid,
        });
      }
    } catch (error: any) {
      console.error('Error refreshing user profile:', error);
      setError(error.message);
    }
  };

  return {
    // State
    currentUser,
    supabaseUser,
    userProfile,
    isLoading: isLoading && !authInitialized,
    isAuthenticated,
    authProvider,
    error,

    // Methods
    signOut: signOutUser,
    signInWithGoogle,
    signInWithApple,
    updatePremiumStatus,
    refreshUserProfile,

    // Computed values
    isReady: authInitialized,
    isPremium: userProfile?.premium || false,
    appleSignInAvailable,
    userEmail: currentUser?.email || supabaseUser?.email || userProfile?.email,
    userName: currentUser?.displayName || userProfile?.displayName || (supabaseUser?.email?.split('@')[0]),
    userPhoto: currentUser?.photoURL || userProfile?.photoURL,
  };
};