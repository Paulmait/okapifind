import {
  collection,
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
  Timestamp,
  getFirestore,
  getDoc,
} from 'firebase/firestore';
import { firebaseApp } from '../config/firebase';

const db = getFirestore(firebaseApp);

export interface SafetySession {
  userId: string;
  userEmail: string;
  userName?: string;
  startLocation: {
    latitude: number;
    longitude: number;
  };
  destination: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  currentLocation: {
    latitude: number;
    longitude: number;
    timestamp: Timestamp;
  };
  shareId: string;
  createdAt: Timestamp;
  expiresAt: Date;
  isActive: boolean;
  estimatedArrival?: string;
  endedAt?: Timestamp;
  lastUpdate?: Timestamp;
}

export interface LocationUpdate {
  latitude: number;
  longitude: number;
  timestamp: Timestamp;
  speed?: number;
  heading?: number;
  accuracy?: number;
}

class SafetyService {
  private sessionListeners = new Map<string, () => void>();

  /**
   * Create a new safety sharing session
   */
  async createSession(
    userId: string,
    userEmail: string,
    userName: string,
    startLocation: { latitude: number; longitude: number },
    destination: { latitude: number; longitude: number; address?: string }
  ): Promise<string> {
    const sessionId = `${userId}_${Date.now()}`;
    const shareId = this.generateShareId();

    const sessionData: Omit<SafetySession, 'createdAt' | 'currentLocation'> = {
      userId,
      userEmail,
      userName,
      startLocation,
      destination,
      shareId,
      isActive: true,
      expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours
      currentLocation: {
        ...startLocation,
        timestamp: serverTimestamp() as Timestamp,
      },
    };

    await setDoc(doc(db, 'safety_sessions', sessionId), {
      ...sessionData,
      createdAt: serverTimestamp(),
      currentLocation: {
        ...startLocation,
        timestamp: serverTimestamp(),
      },
    });

    return sessionId;
  }

  /**
   * Update the current location for a session
   */
  async updateLocation(
    sessionId: string,
    location: { latitude: number; longitude: number },
    additionalData?: { speed?: number; heading?: number; accuracy?: number }
  ): Promise<void> {
    const updateData: any = {
      currentLocation: {
        latitude: location.latitude,
        longitude: location.longitude,
        timestamp: serverTimestamp(),
        ...additionalData,
      },
      lastUpdate: serverTimestamp(),
    };

    // Check if arrived at destination
    const session = await this.getSession(sessionId);
    if (session && this.hasArrivedAtDestination(location, session.destination)) {
      updateData.isActive = false;
      updateData.arrivedAt = serverTimestamp();
    }

    await updateDoc(doc(db, 'safety_sessions', sessionId), updateData);
  }

  /**
   * End a safety sharing session
   */
  async endSession(sessionId: string): Promise<void> {
    await updateDoc(doc(db, 'safety_sessions', sessionId), {
      isActive: false,
      endedAt: serverTimestamp(),
    });
  }

  /**
   * Get a session by ID
   */
  async getSession(sessionId: string): Promise<SafetySession | null> {
    const docSnap = await getDoc(doc(db, 'safety_sessions', sessionId));
    if (docSnap.exists()) {
      return docSnap.data() as SafetySession;
    }
    return null;
  }

  /**
   * Get a session by share ID (for recipients)
   */
  async getSessionByShareId(shareId: string): Promise<SafetySession | null> {
    const q = query(
      collection(db, 'safety_sessions'),
      where('shareId', '==', shareId),
      where('isActive', '==', true)
    );

    const snapshot = await new Promise<any>((resolve) => {
      const unsubscribe = onSnapshot(q, (snap) => {
        unsubscribe();
        resolve(snap);
      });
    });

    if (!snapshot.empty) {
      const doc = snapshot.docs[0];
      return { id: doc.id, ...doc.data() } as SafetySession;
    }
    return null;
  }

  /**
   * Subscribe to location updates for a session
   */
  subscribeToSession(
    sessionId: string,
    callback: (session: SafetySession | null) => void
  ): () => void {
    const unsubscribe = onSnapshot(
      doc(db, 'safety_sessions', sessionId),
      (doc) => {
        if (doc.exists()) {
          callback({ id: doc.id, ...doc.data() } as SafetySession);
        } else {
          callback(null);
        }
      },
      (error) => {
        console.error('Error subscribing to session:', error);
        callback(null);
      }
    );

    this.sessionListeners.set(sessionId, unsubscribe);
    return unsubscribe;
  }

  /**
   * Subscribe to location updates by share ID (for recipients)
   */
  subscribeToShareSession(
    shareId: string,
    callback: (session: SafetySession | null) => void
  ): () => void {
    const q = query(
      collection(db, 'safety_sessions'),
      where('shareId', '==', shareId)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (!snapshot.empty) {
          const doc = snapshot.docs[0];
          callback({ id: doc.id, ...doc.data() } as SafetySession);
        } else {
          callback(null);
        }
      },
      (error) => {
        console.error('Error subscribing to shared session:', error);
        callback(null);
      }
    );

    return unsubscribe;
  }

  /**
   * Calculate distance between two coordinates (in meters)
   */
  calculateDistance(
    coord1: { latitude: number; longitude: number },
    coord2: { latitude: number; longitude: number }
  ): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (coord1.latitude * Math.PI) / 180;
    const φ2 = (coord2.latitude * Math.PI) / 180;
    const Δφ = ((coord2.latitude - coord1.latitude) * Math.PI) / 180;
    const Δλ = ((coord2.longitude - coord1.longitude) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  /**
   * Check if user has arrived at destination (within 50 meters)
   */
  private hasArrivedAtDestination(
    currentLocation: { latitude: number; longitude: number },
    destination: { latitude: number; longitude: number }
  ): boolean {
    const distance = this.calculateDistance(currentLocation, destination);
    return distance < 50; // 50 meters threshold
  }

  /**
   * Generate a short, unique share ID
   */
  private generateShareId(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Clean up expired sessions (run periodically)
   */
  async cleanupExpiredSessions(): Promise<void> {
    const now = new Date();
    const q = query(
      collection(db, 'safety_sessions'),
      where('expiresAt', '<', now),
      where('isActive', '==', true)
    );

    const snapshot = await new Promise<any>((resolve) => {
      const unsubscribe = onSnapshot(q, (snap) => {
        unsubscribe();
        resolve(snap);
      });
    });

    const batch = [];
    for (const doc of snapshot.docs) {
      batch.push(
        updateDoc(doc.ref, {
          isActive: false,
          expiredAt: serverTimestamp(),
        })
      );
    }

    await Promise.all(batch);
  }

  /**
   * Get active sessions for a user
   */
  async getUserActiveSessions(userId: string): Promise<SafetySession[]> {
    const q = query(
      collection(db, 'safety_sessions'),
      where('userId', '==', userId),
      where('isActive', '==', true)
    );

    const snapshot = await new Promise<any>((resolve) => {
      const unsubscribe = onSnapshot(q, (snap) => {
        unsubscribe();
        resolve(snap);
      });
    });

    return snapshot.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data(),
    })) as SafetySession[];
  }

  /**
   * Generate a share link for a session
   */
  generateShareLink(shareId: string): string {
    // In production, use Firebase Dynamic Links
    // For now, use a simple URL scheme
    const baseUrl = 'https://okapifind.com/track';
    return `${baseUrl}/${shareId}`;
  }

  /**
   * Format estimated arrival time
   */
  formatEstimatedArrival(distanceInMeters: number, speedInMps?: number): string {
    const avgWalkingSpeed = speedInMps || 1.4; // Average walking speed: 1.4 m/s
    const timeInSeconds = distanceInMeters / avgWalkingSpeed;
    const timeInMinutes = Math.ceil(timeInSeconds / 60);

    if (timeInMinutes < 1) {
      return 'Arriving now';
    } else if (timeInMinutes === 1) {
      return '1 minute';
    } else if (timeInMinutes < 60) {
      return `${timeInMinutes} minutes`;
    } else {
      const hours = Math.floor(timeInMinutes / 60);
      const minutes = timeInMinutes % 60;
      return `${hours}h ${minutes}m`;
    }
  }
}

export const safetyService = new SafetyService();
export default safetyService;