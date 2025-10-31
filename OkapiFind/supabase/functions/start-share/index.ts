import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

// ✅ SECURITY: Restrict CORS to specific domains only
const allowedOrigins = [
  'https://okapifind.vercel.app',
  'https://www.okapifind.com',
  'http://localhost:19006', // For development
  'exp://localhost:8081', // For Expo development
]

const getCorsHeaders = (origin: string | null) => {
  const isAllowed = origin && allowedOrigins.includes(origin)
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : allowedOrigins[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
}

interface StartShareRequest {
  session_id: string
  expires_in?: number // minutes, default 120 (2 hours)
  recipient_info?: {
    phone?: string
    name?: string
  }
}

interface GetShareRequest {
  token: string
}

serve(async (req) => {
  const origin = req.headers.get('origin')
  const corsHeaders = getCorsHeaders(origin)

  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const url = new URL(req.url)
  const path = url.pathname.split('/').pop()

  // Handle GET request for viewing shared location
  if (req.method === 'GET' && path === 'view') {
    const token = url.searchParams.get('token')
    if (!token) {
      return new Response('Token required', { status: 400 })
    }

    try {
      // Use service role to fetch share data
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      const supabase = createClient(supabaseUrl, supabaseServiceKey)

      // Get share details
      const { data: share, error: shareError } = await supabase
        .from('safety_shares')
        .select(`
          id,
          expires_at,
          active,
          created_at,
          session:parking_sessions!inner (
            id,
            car_address,
            venue_name,
            notes
          )
        `)
        .eq('share_token', token)
        .eq('active', true)
        .single()

      if (shareError || !share) {
        return new Response('Share not found or expired', { status: 404 })
      }

      // Check if expired
      if (new Date(share.expires_at) < new Date()) {
        // Mark as inactive
        await supabase
          .from('safety_shares')
          .update({ active: false })
          .eq('id', share.id)

        return new Response('Share has expired', { status: 410 })
      }

      // Get latest locations (last 50)
      const { data: locations, error: locError } = await supabase
        .from('share_locations')
        .select('at_point, speed, heading, accuracy, recorded_at')
        .eq('share_id', share.id)
        .order('recorded_at', { ascending: false })
        .limit(50)

      if (locError) {
        console.error('Location fetch error:', locError)
      }

      // Format locations for response
      const formattedLocations = (locations || []).map(loc => {
        const coords = loc.at_point.coordinates || [0, 0]
        return {
          latitude: coords[1],
          longitude: coords[0],
          speed: loc.speed,
          heading: loc.heading,
          accuracy: loc.accuracy,
          timestamp: loc.recorded_at
        }
      })

      // Get destination from session
      const destination = share.session ? {
        address: share.session.car_address,
        venue: share.session.venue_name,
        notes: share.session.notes
      } : null

      return new Response(
        JSON.stringify({
          share_id: share.id,
          active: share.active,
          expires_at: share.expires_at,
          created_at: share.created_at,
          destination,
          locations: formattedLocations,
          latest_location: formattedLocations[0] || null
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      )
    } catch (error) {
      console.error('Share view error:', error)
      return new Response(
        JSON.stringify({ error: error.message }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500
        }
      )
    }
  }

  // Handle POST request for starting a share
  if (req.method === 'POST') {
    try {
      // Get auth token
      const authHeader = req.headers.get('Authorization')
      if (!authHeader) {
        return new Response('No authorization header', { status: 401 })
      }

      // Initialize Supabase client
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!
      const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
      const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } }
      })

      // Get authenticated user
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        return new Response('Unauthorized', { status: 401 })
      }

      // Parse request
      const { session_id, expires_in = 120, recipient_info }: StartShareRequest = await req.json()

      if (!session_id) {
        return new Response('session_id is required', { status: 400 })
      }

      // Verify session ownership using service role
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

      const { data: session, error: sessionError } = await supabaseAdmin
        .from('parking_sessions')
        .select('id, user_id, car_point')
        .eq('id', session_id)
        .single()

      if (sessionError || !session) {
        return new Response('Session not found', { status: 404 })
      }

      if (session.user_id !== user.id) {
        return new Response('Unauthorized - not session owner', { status: 403 })
      }

      // Check user's premium status
      const { data: settings } = await supabaseAdmin
        .from('user_settings')
        .select('premium')
        .eq('user_id', user.id)
        .single()

      if (!settings?.premium) {
        return new Response('Safety Mode requires premium subscription', { status: 402 })
      }

      // Deactivate any existing shares for this session
      await supabaseAdmin
        .from('safety_shares')
        .update({ active: false })
        .eq('session_id', session_id)
        .eq('active', true)

      // Create new share
      const expiresAt = new Date(Date.now() + expires_in * 60 * 1000)

      const { data: newShare, error: shareError } = await supabaseAdmin
        .from('safety_shares')
        .insert({
          session_id,
          created_by: user.id,
          expires_at: expiresAt.toISOString(),
          active: true,
          recipient_info: recipient_info || null
        })
        .select('id, share_token')
        .single()

      if (shareError || !newShare) {
        console.error('Share creation error:', shareError)
        return new Response('Failed to create share', { status: 500 })
      }

      // Create initial location entry
      const coords = session.car_point.coordinates || [0, 0]
      await supabaseAdmin
        .from('share_locations')
        .insert({
          share_id: newShare.id,
          at_point: session.car_point,
          recorded_at: new Date().toISOString()
        })

      // Generate public share URL
      const baseUrl = Deno.env.get('PUBLIC_SITE_URL') || 'https://okapifind.com'
      const shareUrl = `${baseUrl}/track/${newShare.share_token}`

      // Log analytics event
      await supabaseAdmin
        .from('analytics_events')
        .insert({
          user_id: user.id,
          event: 'safety_share_started',
          payload: {
            session_id,
            share_id: newShare.id,
            expires_in,
            has_recipient: !!recipient_info
          }
        })

      return new Response(
        JSON.stringify({
          share_id: newShare.id,
          share_token: newShare.share_token,
          share_url: shareUrl,
          expires_at: expiresAt.toISOString(),
          api_endpoint: `${supabaseUrl}/functions/v1/start-share/view?token=${newShare.share_token}`
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      )
    } catch (error) {
      console.error('Start share error:', error)
      return new Response(
        JSON.stringify({ error: error.message }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      )
    }
  }

  return new Response('Method not allowed', { status: 405 })
})