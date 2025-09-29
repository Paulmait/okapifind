/**
 * Unified Backend API
 * Works with both web and mobile apps
 * Deployed to Vercel Edge Functions
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import cors from 'cors';

// Initialize services
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const resend = new Resend(process.env.RESEND_API_KEY);

// CORS configuration for cross-platform
const corsOptions = {
  origin: [
    'http://localhost:3000',
    'http://localhost:19006',
    'https://okapifind.vercel.app',
    'https://okapifind.com',
    'exp://*',  // Expo
    'okapifind://',  // Deep linking
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Platform', 'X-Version'],
};

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP',
  standardHeaders: true,
  legacyHeaders: false,
});

// Platform detection middleware
const detectPlatform = (req: VercelRequest): 'web' | 'ios' | 'android' | 'unknown' => {
  const platform = req.headers['x-platform'] as string;
  const userAgent = req.headers['user-agent'] || '';

  if (platform) return platform as any;

  if (userAgent.includes('OkapiFind-iOS')) return 'ios';
  if (userAgent.includes('OkapiFind-Android')) return 'android';
  if (userAgent.includes('Mozilla') || userAgent.includes('Chrome')) return 'web';

  return 'unknown';
};

// Authentication middleware
const authenticate = async (req: VercelRequest): Promise<any> => {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    throw new Error('No authorization token provided');
  }

  try {
    // Verify JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;

    // Get user from Supabase
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', decoded.userId)
      .single();

    if (error || !user) {
      throw new Error('Invalid token');
    }

    return user;
  } catch (error) {
    throw new Error('Authentication failed');
  }
};

// Main API handler
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Apply CORS
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Detect platform
  const platform = detectPlatform(req);

  // Log request for monitoring
  console.log(`[${platform}] ${req.method} ${req.url}`);

  // Parse the path
  const path = req.url?.split('?')[0] || '';

  try {
    // Route handling
    switch (path) {
      case '/api/health':
        return handleHealth(req, res);

      case '/api/auth/register':
        return handleRegister(req, res, platform);

      case '/api/auth/login':
        return handleLogin(req, res, platform);

      case '/api/auth/logout':
        return handleLogout(req, res);

      case '/api/auth/refresh':
        return handleRefreshToken(req, res);

      case '/api/parking/save':
        return handleSaveParking(req, res, platform);

      case '/api/parking/history':
        return handleParkingHistory(req, res);

      case '/api/parking/current':
        return handleCurrentParking(req, res);

      case '/api/parking/navigate':
        return handleNavigate(req, res, platform);

      case '/api/user/profile':
        return handleUserProfile(req, res);

      case '/api/user/preferences':
        return handleUserPreferences(req, res);

      case '/api/subscription/status':
        return handleSubscriptionStatus(req, res);

      case '/api/subscription/create':
        return handleCreateSubscription(req, res);

      case '/api/email/verify':
        return handleEmailVerification(req, res);

      case '/api/email/welcome':
        return handleWelcomeEmail(req, res);

      default:
        res.status(404).json({ error: 'Endpoint not found' });
    }
  } catch (error: any) {
    console.error('API Error:', error);
    res.status(error.status || 500).json({
      error: error.message || 'Internal server error',
      platform,
    });
  }
}

// Health check endpoint
async function handleHealth(req: VercelRequest, res: VercelResponse) {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      database: await checkDatabase(),
      email: await checkEmail(),
    },
  });
}

// Authentication endpoints
async function handleRegister(req: VercelRequest, res: VercelResponse, platform: string) {
  const { email, password, name } = req.body;

  // Validate input
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  // Create user in Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name,
        platform,
        registered_at: new Date().toISOString(),
      },
    },
  });

  if (authError) {
    return res.status(400).json({ error: authError.message });
  }

  // Create user profile
  const { error: profileError } = await supabase
    .from('users')
    .insert({
      id: authData.user!.id,
      email,
      name,
      platform,
      created_at: new Date().toISOString(),
    });

  if (profileError) {
    console.error('Profile creation error:', profileError);
  }

  // Send welcome email via Resend
  if (platform === 'web') {
    await resend.emails.send({
      from: 'OkapiFind <welcome@okapifind.com>',
      to: email,
      subject: 'Welcome to OkapiFind!',
      react: WelcomeEmailTemplate({ name: name || 'there' }),
    });
  }

  // Generate JWT token
  const token = jwt.sign(
    { userId: authData.user!.id, email },
    process.env.JWT_SECRET!,
    { expiresIn: '7d' }
  );

  res.status(201).json({
    success: true,
    token,
    user: {
      id: authData.user!.id,
      email,
      name,
    },
  });
}

async function handleLogin(req: VercelRequest, res: VercelResponse, platform: string) {
  const { email, password } = req.body;

  // Sign in with Supabase Auth
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Update last login
  await supabase
    .from('users')
    .update({
      last_login: new Date().toISOString(),
      last_platform: platform,
    })
    .eq('id', data.user.id);

  // Generate JWT token
  const token = jwt.sign(
    { userId: data.user.id, email },
    process.env.JWT_SECRET!,
    { expiresIn: '7d' }
  );

  res.status(200).json({
    success: true,
    token,
    user: {
      id: data.user.id,
      email: data.user.email,
    },
  });
}

async function handleLogout(req: VercelRequest, res: VercelResponse) {
  const user = await authenticate(req);

  // Sign out from Supabase
  await supabase.auth.signOut();

  res.status(200).json({ success: true });
}

async function handleRefreshToken(req: VercelRequest, res: VercelResponse) {
  const { refreshToken } = req.body;

  const { data, error } = await supabase.auth.refreshSession({
    refresh_token: refreshToken,
  });

  if (error) {
    return res.status(401).json({ error: 'Invalid refresh token' });
  }

  const token = jwt.sign(
    { userId: data.user!.id, email: data.user!.email },
    process.env.JWT_SECRET!,
    { expiresIn: '7d' }
  );

  res.status(200).json({
    success: true,
    token,
    refreshToken: data.session?.refresh_token,
  });
}

// Parking endpoints
async function handleSaveParking(req: VercelRequest, res: VercelResponse, platform: string) {
  const user = await authenticate(req);
  const { latitude, longitude, notes, photo, address } = req.body;

  // Validate coordinates
  if (!latitude || !longitude) {
    return res.status(400).json({ error: 'Location required' });
  }

  // Save parking location
  const { data, error } = await supabase
    .from('parking_locations')
    .insert({
      user_id: user.id,
      latitude,
      longitude,
      notes,
      photo_url: photo,
      address,
      platform,
      created_at: new Date().toISOString(),
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    return res.status(500).json({ error: 'Failed to save parking location' });
  }

  // Deactivate previous parking locations
  await supabase
    .from('parking_locations')
    .update({ is_active: false })
    .eq('user_id', user.id)
    .neq('id', data.id);

  res.status(201).json({
    success: true,
    parking: data,
  });
}

async function handleParkingHistory(req: VercelRequest, res: VercelResponse) {
  const user = await authenticate(req);
  const { limit = 30, offset = 0 } = req.query;

  const { data, error } = await supabase
    .from('parking_locations')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .range(Number(offset), Number(offset) + Number(limit) - 1);

  if (error) {
    return res.status(500).json({ error: 'Failed to fetch history' });
  }

  res.status(200).json({
    success: true,
    history: data,
  });
}

async function handleCurrentParking(req: VercelRequest, res: VercelResponse) {
  const user = await authenticate(req);

  const { data, error } = await supabase
    .from('parking_locations')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single();

  if (error) {
    return res.status(404).json({ error: 'No active parking found' });
  }

  res.status(200).json({
    success: true,
    parking: data,
  });
}

async function handleNavigate(req: VercelRequest, res: VercelResponse, platform: string) {
  const user = await authenticate(req);
  const { parkingId } = req.query;

  const { data, error } = await supabase
    .from('parking_locations')
    .select('*')
    .eq('id', parkingId)
    .eq('user_id', user.id)
    .single();

  if (error || !data) {
    return res.status(404).json({ error: 'Parking location not found' });
  }

  // Generate navigation URL based on platform
  let navigationUrl = '';
  if (platform === 'ios') {
    navigationUrl = `maps://maps.apple.com/?daddr=${data.latitude},${data.longitude}`;
  } else if (platform === 'android') {
    navigationUrl = `google.navigation:q=${data.latitude},${data.longitude}`;
  } else {
    navigationUrl = `https://www.google.com/maps/dir/?api=1&destination=${data.latitude},${data.longitude}`;
  }

  res.status(200).json({
    success: true,
    parking: data,
    navigationUrl,
  });
}

// User endpoints
async function handleUserProfile(req: VercelRequest, res: VercelResponse) {
  const user = await authenticate(req);

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch profile' });
    }

    res.status(200).json({
      success: true,
      profile: data,
    });
  } else if (req.method === 'PUT') {
    const updates = req.body;

    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: 'Failed to update profile' });
    }

    res.status(200).json({
      success: true,
      profile: data,
    });
  }
}

async function handleUserPreferences(req: VercelRequest, res: VercelResponse) {
  const user = await authenticate(req);

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error) {
      // Return defaults if no preferences exist
      return res.status(200).json({
        success: true,
        preferences: {
          notifications: true,
          auto_detect: true,
          voice_guidance: true,
          dark_mode: false,
          language: 'en',
        },
      });
    }

    res.status(200).json({
      success: true,
      preferences: data,
    });
  } else if (req.method === 'PUT') {
    const preferences = req.body;

    const { data, error } = await supabase
      .from('user_preferences')
      .upsert({
        user_id: user.id,
        ...preferences,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: 'Failed to update preferences' });
    }

    res.status(200).json({
      success: true,
      preferences: data,
    });
  }
}

// Subscription endpoints
async function handleSubscriptionStatus(req: VercelRequest, res: VercelResponse) {
  const user = await authenticate(req);

  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single();

  if (error || !data) {
    return res.status(200).json({
      success: true,
      subscription: {
        plan: 'free',
        status: 'active',
        features: ['basic_parking', 'basic_navigation'],
      },
    });
  }

  res.status(200).json({
    success: true,
    subscription: data,
  });
}

async function handleCreateSubscription(req: VercelRequest, res: VercelResponse) {
  const user = await authenticate(req);
  const { plan, paymentMethodId } = req.body;

  // This would integrate with Stripe or RevenueCat
  // For now, return mock response
  res.status(201).json({
    success: true,
    subscription: {
      id: 'sub_' + Math.random().toString(36).substr(2, 9),
      user_id: user.id,
      plan,
      status: 'active',
      created_at: new Date().toISOString(),
    },
  });
}

// Email endpoints
async function handleEmailVerification(req: VercelRequest, res: VercelResponse) {
  const { token } = req.query;

  // Verify email token
  const { error } = await supabase.auth.verifyOtp({
    token_hash: token as string,
    type: 'email',
  });

  if (error) {
    return res.status(400).json({ error: 'Invalid verification token' });
  }

  res.status(200).json({
    success: true,
    message: 'Email verified successfully',
  });
}

async function handleWelcomeEmail(req: VercelRequest, res: VercelResponse) {
  const { email, name } = req.body;

  await resend.emails.send({
    from: 'OkapiFind <welcome@okapifind.com>',
    to: email,
    subject: 'Welcome to OkapiFind!',
    html: `
      <h1>Welcome to OkapiFind, ${name}!</h1>
      <p>Never lose your car again with our smart parking app.</p>
      <a href="https://okapifind.com/get-started">Get Started</a>
    `,
  });

  res.status(200).json({ success: true });
}

// Helper functions
async function checkDatabase(): Promise<boolean> {
  try {
    const { error } = await supabase.from('users').select('count').limit(1);
    return !error;
  } catch {
    return false;
  }
}

async function checkEmail(): Promise<boolean> {
  try {
    // Check if Resend is configured
    return !!process.env.RESEND_API_KEY;
  } catch {
    return false;
  }
}

// Email template component
function WelcomeEmailTemplate({ name }: { name: string }) {
  return {
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: -apple-system, sans-serif; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; }
            .content { background: white; padding: 30px; border: 1px solid #e5e7eb; border-radius: 0 0 10px 10px; }
            .button { background: #007AFF; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to OkapiFind, ${name}!</h1>
            </div>
            <div class="content">
              <p>Thanks for joining OkapiFind. Never lose your car again!</p>
              <h2>Getting Started:</h2>
              <ol>
                <li>Open the app when you park</li>
                <li>Tap the big blue button to save your location</li>
                <li>We'll guide you back when you need it!</li>
              </ol>
              <p>
                <a href="https://okapifind.com/app" class="button">Open App</a>
              </p>
              <p>Happy parking!<br>The OkapiFind Team</p>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `Welcome to OkapiFind, ${name}! Thanks for joining. Never lose your car again!`,
  };
}