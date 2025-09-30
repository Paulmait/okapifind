/**
 * Health Check Endpoint for Vercel
 * Monitors service status and uptime
 */

import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const healthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0',
    services: {
      api: 'operational',
      database: checkDatabaseHealth(),
      firebase: checkFirebaseHealth(),
      maps: checkMapsHealth(),
    },
    memory: {
      used: process.memoryUsage().heapUsed / 1024 / 1024,
      total: process.memoryUsage().heapTotal / 1024 / 1024,
    },
  };

  // Return 200 if all services are operational
  const allHealthy = Object.values(healthStatus.services).every(
    (status) => status === 'operational'
  );

  res.status(allHealthy ? 200 : 503).json(healthStatus);
}

// Service health check functions
function checkDatabaseHealth(): string {
  // Check if Supabase URL is configured
  return process.env.SUPABASE_URL ? 'operational' : 'not_configured';
}

function checkFirebaseHealth(): string {
  // Check if Firebase API key is configured
  return process.env.EXPO_PUBLIC_FIREBASE_API_KEY
    ? 'operational'
    : 'not_configured';
}

function checkMapsHealth(): string {
  // Check if Google Maps API key is configured
  return process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
    ? 'operational'
    : 'not_configured';
}