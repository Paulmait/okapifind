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

interface SignedUploadRequest {
  session_id: string
  content_type?: string
  file_extension?: string
}

serve(async (req) => {
  const origin = req.headers.get('origin')
  const corsHeaders = getCorsHeaders(origin)

  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

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
    const { session_id, content_type = 'image/jpeg', file_extension = 'jpg' }: SignedUploadRequest = await req.json()

    if (!session_id) {
      return new Response('session_id is required', { status: 400 })
    }

    // Verify session ownership using service role client
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    const { data: session, error: sessionError } = await supabaseAdmin
      .from('parking_sessions')
      .select('id, user_id')
      .eq('id', session_id)
      .single()

    if (sessionError || !session) {
      return new Response('Session not found', { status: 404 })
    }

    if (session.user_id !== user.id) {
      return new Response('Unauthorized - not session owner', { status: 403 })
    }

    // Check user's premium status (photo documentation is a premium feature)
    const { data: settings } = await supabaseAdmin
      .from('user_settings')
      .select('premium')
      .eq('user_id', user.id)
      .single()

    if (!settings?.premium) {
      return new Response(
        JSON.stringify({ error: 'Photo documentation requires premium subscription' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 402
        }
      )
    }

    // Generate unique filename
    const timestamp = Date.now()
    const randomStr = Math.random().toString(36).substring(2, 8)
    const fileName = `${user.id}/${session_id}/${timestamp}_${randomStr}.${file_extension}`

    // Create signed upload URL
    const { data: uploadData, error: uploadError } = await supabaseAdmin
      .storage
      .from('meter-photos')
      .createSignedUploadUrl(fileName, 60) // 60 seconds expiry

    if (uploadError || !uploadData) {
      console.error('Upload URL generation error:', uploadError)
      return new Response('Failed to generate upload URL', { status: 500 })
    }

    // Also create a signed URL for viewing (1 hour expiry)
    const { data: viewData, error: viewError } = await supabaseAdmin
      .storage
      .from('meter-photos')
      .createSignedUrl(fileName, 3600) // 1 hour expiry for viewing

    if (viewError || !viewData) {
      console.error('View URL generation error:', viewError)
      // Non-critical, continue
    }

    // Log analytics event
    await supabaseAdmin
      .from('analytics_events')
      .insert({
        user_id: user.id,
        event: 'meter_photo_upload_requested',
        payload: {
          session_id,
          file_name: fileName,
          content_type,
        }
      })

    return new Response(
      JSON.stringify({
        upload_url: uploadData.signedUrl,
        view_url: viewData?.signedUrl,
        file_path: fileName,
        expires_at: new Date(Date.now() + 60 * 1000).toISOString(), // Upload expires in 60 seconds
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )
  } catch (error) {
    console.error('Signed upload error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    )
  }
})