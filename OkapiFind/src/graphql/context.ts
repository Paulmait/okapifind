/**
 * GraphQL Context
 * Provides context for all resolvers
 */

import { Request } from 'express';
import { auth } from '../config/firebase.config';

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
    // Verify token with Firebase Auth
    const decodedToken = await auth.currentUser?.getIdTokenResult();

    if (decodedToken) {
      return {
        req,
        user: {
          id: decodedToken.claims.sub || '',
          email: decodedToken.claims.email as string,
          role: decodedToken.claims.role as string | undefined,
        },
      };
    }
  } catch (error) {
    console.error('Error verifying token:', error);
  }

  return { req };
}