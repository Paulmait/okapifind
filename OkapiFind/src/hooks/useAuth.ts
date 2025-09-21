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
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Initialize Firestore
const db = getFirestore(firebaseApp);

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
  userProfile: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  setCurrentUser: (user: User | null) => void;
  setUserProfile: (profile: UserProfile | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  signOutUser: () => Promise<void>;
}

// Create auth store with persistence
const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      currentUser: null,
      userProfile: null,
      isLoading: true,
      isAuthenticated: false,
      error: null,

      setCurrentUser: (user) => set({
        currentUser: user,
        isAuthenticated: !!user
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

      signOutUser: async () => {
        try {
          set({ isLoading: true });
          await signOut(firebaseAuth);
          set({
            currentUser: null,
            userProfile: null,
            isAuthenticated: false,
            error: null
          });
          analytics.logEvent('user_signed_out');
        } catch (error: any) {
          console.error('Sign out error:', error);
          set({ error: error.message });
          throw error;
        } finally {
          set({ isLoading: false });
        }
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
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
    userProfile,
    isLoading,
    isAuthenticated,
    error,
    setCurrentUser,
    setUserProfile,
    setLoading,
    setError,
    signOutUser,
  } = useAuthStore();

  const [authInitialized, setAuthInitialized] = useState(false);

  useEffect(() => {
    // Listen to Firebase auth state changes
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
      try {
        if (user) {
          // User is signed in
          setCurrentUser(user);

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

    return () => unsubscribe();
  }, []);

  const checkOrCreateUserProfile = async (user: User) => {
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
    userProfile,
    isLoading: isLoading && !authInitialized,
    isAuthenticated,
    error,

    // Methods
    signOut: signOutUser,
    updatePremiumStatus,
    refreshUserProfile,

    // Computed values
    isReady: authInitialized,
    isPremium: userProfile?.premium || false,
    userEmail: currentUser?.email || userProfile?.email,
    userName: currentUser?.displayName || userProfile?.displayName,
    userPhoto: currentUser?.photoURL || userProfile?.photoURL,
  };
};