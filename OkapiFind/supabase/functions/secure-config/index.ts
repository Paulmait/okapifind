// Supabase Edge Function: Secure Configuration
// Provides non-sensitive configuration to authenticated clients

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify the user is authenticated via Supabase
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get user's premium status
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('is_premium, subscription_tier')
      .eq('id', user.id)
      .single()

    // Return non-sensitive configuration
    // API keys are NOT included - they stay server-side
    const config = {
      features: {
        offlineMode: true,
        voiceCommands: true,
        arNavigation: profile?.is_premium || false,
        photoNotes: true,
        safetyMode: true,
        aiPoweredAnalysis: profile?.is_premium || false,
        unlimitedHistory: profile?.is_premium || false,
        multiVehicle: profile?.is_premium || false,
      },
      limits: {
        maxPhotoSize: 5 * 1024 * 1024, // 5MB
        maxPhotosPerSession: profile?.is_premium ? 10 : 3,
        maxSafetyShareDuration: profile?.is_premium ? 480 : 120, // minutes
        historyRetention: profile?.is_premium ? 365 : 30, // days
      },
      endpoints: {
        mapsProxy: `${Deno.env.get('SUPABASE_URL')}/functions/v1/google-maps-proxy`,
        geminiProxy: `${Deno.env.get('SUPABASE_URL')}/functions/v1/gemini-proxy`,
        signedUpload: `${Deno.env.get('SUPABASE_URL')}/functions/v1/signed-upload`,
        startShare: `${Deno.env.get('SUPABASE_URL')}/functions/v1/start-share`,
      },
      version: {
        minAppVersion: '1.0.0',
        currentVersion: '1.0.0',
        forceUpdate: false,
      },
    }

    return new Response(
      JSON.stringify({ success: true, config }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Secure config error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
