/**
 * GraphQL Context
 * Provides context for all resolvers
 */

import { Request } from 'express';
import { getAuth } from 'firebase/auth';
import { firebaseApp } from '../config/firebase';

export interface Context {
  req: Request;
  user?: {
    id: string;
    email: string;
    role?: string;
  };
}

/**
 * Create GraphQL context from request
 */
export async function createContext({ req }: { req: Request }): Promise<Context> {
  // Get token from Authorization header
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return { req };
  }

  try {
    // Verify token with Firebase Admin Auth (server-side)
    // Note: This requires Firebase Admin SDK for server-side token verification
    // For now, we'll implement a basic client-side verification approach
    const auth = getAuth(firebaseApp);

    // This is a simplified version - in production, use Firebase Admin SDK
    // for proper server-side token verification
    if (token && token.length > 0) {
      // For client-side apps, the token verification should be handled differently
      // This is a placeholder that would need proper admin SDK implementation
      return {
        req,
        user: {
          id: 'user_from_token', // This should be extracted from verified token
          email: 'user@example.com', // This should be extracted from verified token
          role: undefined,
        },
      };
    }
  } catch (error) {
    console.error('Error verifying token:', error);
  }

  return { req };
}