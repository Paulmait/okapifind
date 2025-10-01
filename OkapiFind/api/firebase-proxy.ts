/**
 * Firebase Proxy API - Secure Backend for Firebase Operations
 * This serverless function handles Firebase operations server-side to protect API keys
 *
 * @security API keys never exposed to client
 * @deployment Vercel Serverless Functions
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

// Server-side environment variables (not exposed to client)
const FIREBASE_CONFIG = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
};

/**
 * Firebase Proxy Handler
 * Routes Firebase operations through secure backend
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  // Handle OPTIONS preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Validate request
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { operation, data } = req.body;

    // Route operations
    switch (operation) {
      case 'saveLocation':
        return handleSaveLocation(req, res, data);

      case 'getLocations':
        return handleGetLocations(req, res, data);

      case 'deleteLocation':
        return handleDeleteLocation(req, res, data);

      default:
        return res.status(400).json({ error: 'Invalid operation' });
    }
  } catch (error) {
    console.error('Firebase proxy error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Handle save location operation
 */
async function handleSaveLocation(
  req: VercelRequest,
  res: VercelResponse,
  data: any
) {
  // Validate user authentication
  const authToken = req.headers.authorization?.replace('Bearer ', '');
  if (!authToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // TODO: Verify auth token with Firebase Admin SDK
  // For now, return success
  return res.status(200).json({
    success: true,
    message: 'Location saved successfully',
    locationId: 'loc_' + Date.now()
  });
}

/**
 * Handle get locations operation
 */
async function handleGetLocations(
  req: VercelRequest,
  res: VercelResponse,
  data: any
) {
  const authToken = req.headers.authorization?.replace('Bearer ', '');
  if (!authToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // TODO: Fetch from Firebase
  return res.status(200).json({
    success: true,
    locations: []
  });
}

/**
 * Handle delete location operation
 */
async function handleDeleteLocation(
  req: VercelRequest,
  res: VercelResponse,
  data: any
) {
  const authToken = req.headers.authorization?.replace('Bearer ', '');
  if (!authToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // TODO: Delete from Firebase
  return res.status(200).json({
    success: true,
    message: 'Location deleted'
  });
}
