/**
 * Firebase Mock for Testing
 */

export const mockFirebaseAuth = {
  currentUser: null,
  signInWithCredential: jest.fn(),
  signOut: jest.fn(),
  onAuthStateChanged: jest.fn(),
};

export const mockGoogleAuthProvider = {
  credential: jest.fn(),
};

export const mockOAuthProvider = jest.fn().mockImplementation(() => ({
  credential: jest.fn(),
}));

export const mockFirebaseUser = {
  uid: 'test-user-123',
  email: 'test@example.com',
  displayName: 'Test User',
  photoURL: 'https://example.com/photo.jpg',
  providerData: [{ providerId: 'google.com' }],
};

export const mockFirebaseApp = {
  name: 'test-app',
  options: {},
};

// Mock Firebase modules
jest.mock('firebase/app', () => ({
  initializeApp: jest.fn(() => mockFirebaseApp),
  getApp: jest.fn(() => mockFirebaseApp),
}));

jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(() => mockFirebaseAuth),
  signInWithCredential: mockFirebaseAuth.signInWithCredential,
  signOut: mockFirebaseAuth.signOut,
  onAuthStateChanged: mockFirebaseAuth.onAuthStateChanged,
  GoogleAuthProvider: mockGoogleAuthProvider,
  OAuthProvider: mockOAuthProvider,
}));

jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(),
  collection: jest.fn(),
  doc: jest.fn(),
  addDoc: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
}));

export { mockFirebaseAuth as auth };