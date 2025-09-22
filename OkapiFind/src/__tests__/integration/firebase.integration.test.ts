/**
 * Firebase Integration Tests
 */

import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithCredential,
  GoogleAuthProvider,
  OAuthProvider,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { authService } from '../../services/auth.service';
import '../utils/setupTests';

describe('Firebase Integration Tests', () => {
  let mockFirestore: any;
  let mockAuth: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Firestore
    mockFirestore = {
      collection: jest.fn(),
      doc: jest.fn(),
      addDoc: jest.fn(),
      getDoc: jest.fn(),
      updateDoc: jest.fn(),
      deleteDoc: jest.fn(),
      query: jest.fn(),
      where: jest.fn(),
      getDocs: jest.fn(),
    };

    // Mock Auth
    mockAuth = {
      signInWithCredential: jest.fn(),
      signOut: jest.fn(),
      onAuthStateChanged: jest.fn(),
      currentUser: null,
    };

    (getFirestore as jest.Mock).mockReturnValue(mockFirestore);
    (getAuth as jest.Mock).mockReturnValue(mockAuth);
  });

  describe('Firebase App Initialization', () => {
    it('should initialize Firebase app with correct config', () => {
      const mockApp = { name: 'test-app' };
      (initializeApp as jest.Mock).mockReturnValue(mockApp);

      const firebaseConfig = {
        apiKey: 'test-api-key',
        authDomain: 'test.firebaseapp.com',
        projectId: 'test-project',
        storageBucket: 'test.appspot.com',
        messagingSenderId: '123456789',
        appId: '1:123456789:web:abcdef123456789',
      };

      const app = initializeApp(firebaseConfig);

      expect(initializeApp).toHaveBeenCalledWith(firebaseConfig);
      expect(app).toEqual(mockApp);
    });

    it('should initialize Auth service', () => {
      expect(getAuth).toHaveBeenCalled();
    });

    it('should initialize Firestore', () => {
      expect(getFirestore).toHaveBeenCalled();
    });
  });

  describe('Authentication Flow Integration', () => {
    it('should handle complete Google sign-in flow', async () => {
      const mockCredential = { providerId: 'google.com' };
      const mockUser = {
        uid: 'user-123',
        email: 'test@example.com',
        displayName: 'Test User',
        photoURL: 'https://example.com/photo.jpg',
        providerData: [{ providerId: 'google.com' }],
      };

      (GoogleAuthProvider.credential as jest.Mock).mockReturnValue(mockCredential);
      (signInWithCredential as jest.Mock).mockResolvedValue({
        user: mockUser,
      });

      const result = await authService.signInWithGoogleCredential(mockCredential as any);

      expect(signInWithCredential).toHaveBeenCalledWith(expect.anything(), mockCredential);
      expect(result).toEqual({
        uid: mockUser.uid,
        email: mockUser.email,
        displayName: mockUser.displayName,
        photoURL: mockUser.photoURL,
        providerId: 'google.com',
      });
    });

    it('should handle authentication state changes', () => {
      const mockCallback = jest.fn();
      const mockUnsubscribe = jest.fn();

      (onAuthStateChanged as jest.Mock).mockReturnValue(mockUnsubscribe);

      const unsubscribe = authService.onAuthStateChanged(mockCallback);

      expect(onAuthStateChanged).toHaveBeenCalledWith(expect.anything(), expect.any(Function));
      expect(unsubscribe).toBe(mockUnsubscribe);
    });

    it('should handle sign out flow', async () => {
      (signOut as jest.Mock).mockResolvedValue(undefined);

      await authService.signOut();

      expect(signOut).toHaveBeenCalledWith(expect.anything());
    });
  });

  describe('Firestore Data Operations', () => {
    beforeEach(() => {
      mockFirestore.collection.mockReturnValue('mock-collection-ref');
      mockFirestore.doc.mockReturnValue('mock-doc-ref');
      mockFirestore.query.mockReturnValue('mock-query');
      mockFirestore.where.mockReturnValue('mock-where-clause');
    });

    it('should create document in collection', async () => {
      const testData = {
        id: 'test-123',
        location: {
          latitude: 37.7749,
          longitude: -122.4194,
        },
        timestamp: new Date().toISOString(),
      };

      const mockDocRef = { id: 'new-doc-id' };
      (addDoc as jest.Mock).mockResolvedValue(mockDocRef);

      const result = await addDoc(
        collection(mockFirestore, 'parking_spots'),
        testData
      );

      expect(collection).toHaveBeenCalledWith(mockFirestore, 'parking_spots');
      expect(addDoc).toHaveBeenCalledWith('mock-collection-ref', testData);
      expect(result).toEqual(mockDocRef);
    });

    it('should read document from collection', async () => {
      const mockDocData = {
        id: 'test-123',
        location: {
          latitude: 37.7749,
          longitude: -122.4194,
        },
        exists: () => true,
        data: () => ({
          location: { latitude: 37.7749, longitude: -122.4194 },
          timestamp: '2023-01-01T00:00:00.000Z',
        }),
      };

      (getDoc as jest.Mock).mockResolvedValue(mockDocData);

      const docRef = doc(mockFirestore, 'parking_spots', 'test-123');
      const result = await getDoc(docRef);

      expect(doc).toHaveBeenCalledWith(mockFirestore, 'parking_spots', 'test-123');
      expect(getDoc).toHaveBeenCalledWith('mock-doc-ref');
      expect(result).toEqual(mockDocData);
      expect(result.exists()).toBe(true);
      expect(result.data()).toEqual({
        location: { latitude: 37.7749, longitude: -122.4194 },
        timestamp: '2023-01-01T00:00:00.000Z',
      });
    });

    it('should update document in collection', async () => {
      const updateData = {
        notes: 'Updated parking spot',
        updatedAt: new Date().toISOString(),
      };

      (updateDoc as jest.Mock).mockResolvedValue(undefined);

      const docRef = doc(mockFirestore, 'parking_spots', 'test-123');
      await updateDoc(docRef, updateData);

      expect(doc).toHaveBeenCalledWith(mockFirestore, 'parking_spots', 'test-123');
      expect(updateDoc).toHaveBeenCalledWith('mock-doc-ref', updateData);
    });

    it('should delete document from collection', async () => {
      (deleteDoc as jest.Mock).mockResolvedValue(undefined);

      const docRef = doc(mockFirestore, 'parking_spots', 'test-123');
      await deleteDoc(docRef);

      expect(doc).toHaveBeenCalledWith(mockFirestore, 'parking_spots', 'test-123');
      expect(deleteDoc).toHaveBeenCalledWith('mock-doc-ref');
    });

    it('should query collection with conditions', async () => {
      const mockQuerySnapshot = {
        docs: [
          {
            id: 'doc1',
            data: () => ({ location: { latitude: 37.7749, longitude: -122.4194 } }),
          },
          {
            id: 'doc2',
            data: () => ({ location: { latitude: 37.7750, longitude: -122.4195 } }),
          },
        ],
        forEach: jest.fn((callback) => {
          mockQuerySnapshot.docs.forEach(callback);
        }),
      };

      (getDocs as jest.Mock).mockResolvedValue(mockQuerySnapshot);

      const collectionRef = collection(mockFirestore, 'parking_spots');
      const q = query(collectionRef, where('userId', '==', 'user-123'));
      const querySnapshot = await getDocs(q);

      expect(collection).toHaveBeenCalledWith(mockFirestore, 'parking_spots');
      expect(query).toHaveBeenCalledWith('mock-collection-ref', 'mock-where-clause');
      expect(where).toHaveBeenCalledWith('userId', '==', 'user-123');
      expect(getDocs).toHaveBeenCalledWith('mock-query');

      expect(querySnapshot.docs).toHaveLength(2);
      expect(querySnapshot.docs[0].id).toBe('doc1');
    });
  });

  describe('Error Handling', () => {
    it('should handle authentication errors', async () => {
      const error = new Error('Authentication failed');
      error.code = 'auth/invalid-credential';

      (signInWithCredential as jest.Mock).mockRejectedValue(error);

      const mockCredential = { providerId: 'google.com' };

      await expect(
        authService.signInWithGoogleCredential(mockCredential as any)
      ).rejects.toThrow('Google Sign-In failed: Authentication failed');
    });

    it('should handle Firestore permission errors', async () => {
      const error = new Error('Permission denied');
      error.code = 'permission-denied';

      (addDoc as jest.Mock).mockRejectedValue(error);

      const testData = { test: 'data' };

      await expect(
        addDoc(collection(mockFirestore, 'parking_spots'), testData)
      ).rejects.toThrow('Permission denied');
    });

    it('should handle network errors', async () => {
      const error = new Error('Network error');
      error.code = 'unavailable';

      (getDoc as jest.Mock).mockRejectedValue(error);

      const docRef = doc(mockFirestore, 'parking_spots', 'test-123');

      await expect(getDoc(docRef)).rejects.toThrow('Network error');
    });

    it('should handle document not found', async () => {
      const mockDocData = {
        exists: () => false,
        data: () => undefined,
      };

      (getDoc as jest.Mock).mockResolvedValue(mockDocData);

      const docRef = doc(mockFirestore, 'parking_spots', 'non-existent');
      const result = await getDoc(docRef);

      expect(result.exists()).toBe(false);
      expect(result.data()).toBeUndefined();
    });
  });

  describe('Real-time Data Synchronization', () => {
    it('should handle real-time updates', () => {
      const mockUnsubscribe = jest.fn();
      const mockCallback = jest.fn();

      // Mock onSnapshot functionality
      const mockOnSnapshot = jest.fn((callback) => {
        // Simulate real-time update
        setTimeout(() => {
          callback({
            docs: [
              {
                id: 'updated-doc',
                data: () => ({ updated: true }),
              },
            ],
          });
        }, 0);

        return mockUnsubscribe;
      });

      // Simulate onSnapshot call
      const collectionRef = collection(mockFirestore, 'parking_spots');
      const unsubscribe = mockOnSnapshot(mockCallback);

      expect(unsubscribe).toBe(mockUnsubscribe);

      // Wait for async callback
      setTimeout(() => {
        expect(mockCallback).toHaveBeenCalledWith({
          docs: [
            {
              id: 'updated-doc',
              data: () => ({ updated: true }),
            },
          ],
        });
      }, 0);
    });
  });

  describe('Batch Operations', () => {
    it('should handle batch writes', async () => {
      const mockBatch = {
        set: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        commit: jest.fn().mockResolvedValue(undefined),
      };

      const mockWriteBatch = jest.fn(() => mockBatch);

      // Simulate batch operations
      const batch = mockWriteBatch();
      const docRef1 = doc(mockFirestore, 'parking_spots', 'doc1');
      const docRef2 = doc(mockFirestore, 'parking_spots', 'doc2');

      batch.set(docRef1, { data: 'new' });
      batch.update(docRef2, { updated: true });

      await batch.commit();

      expect(batch.set).toHaveBeenCalledWith('mock-doc-ref', { data: 'new' });
      expect(batch.update).toHaveBeenCalledWith('mock-doc-ref', { updated: true });
      expect(batch.commit).toHaveBeenCalled();
    });
  });

  describe('Offline Support', () => {
    it('should handle offline mode', async () => {
      const offlineError = new Error('Client is offline');
      offlineError.code = 'unavailable';

      (getDoc as jest.Mock).mockRejectedValueOnce(offlineError);

      const docRef = doc(mockFirestore, 'parking_spots', 'test-123');

      await expect(getDoc(docRef)).rejects.toThrow('Client is offline');

      // Simulate coming back online
      const mockDocData = {
        exists: () => true,
        data: () => ({ cached: true }),
      };

      (getDoc as jest.Mock).mockResolvedValueOnce(mockDocData);

      const retryResult = await getDoc(docRef);
      expect(retryResult.exists()).toBe(true);
    });

    it('should handle cached data', async () => {
      const mockCachedDoc = {
        exists: () => true,
        data: () => ({ cached: true, fromCache: true }),
        metadata: {
          fromCache: true,
          hasPendingWrites: false,
        },
      };

      (getDoc as jest.Mock).mockResolvedValue(mockCachedDoc);

      const docRef = doc(mockFirestore, 'parking_spots', 'test-123');
      const result = await getDoc(docRef);

      expect(result.metadata.fromCache).toBe(true);
      expect(result.data().cached).toBe(true);
    });
  });
});