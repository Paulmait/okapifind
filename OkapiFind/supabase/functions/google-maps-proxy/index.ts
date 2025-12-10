// Supabase Edge Function: Google Maps API Proxy
// Securely proxies Google Maps API calls without exposing API keys to the client

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface MapsRequest {
  endpoint: 'directions' | 'places' | 'geocode' | 'distance' | 'nearbysearch'
  params: Record<string, string>
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

    // Parse request
    const { endpoint, params }: MapsRequest = await req.json()

    // Get the API key from environment (never exposed to client)
    const apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY')
    if (!apiKey) {
      console.error('GOOGLE_MAPS_API_KEY not configured')
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Build the Google Maps API URL
    let baseUrl: string
    switch (endpoint) {
      case 'directions':
        baseUrl = 'https://maps.googleapis.com/maps/api/directions/json'
        break
      case 'places':
        baseUrl = 'https://maps.googleapis.com/maps/api/place/details/json'
        break
      case 'geocode':
        baseUrl = 'https://maps.googleapis.com/maps/api/geocode/json'
        break
      case 'distance':
        baseUrl = 'https://maps.googleapis.com/maps/api/distancematrix/json'
        break
      case 'nearbysearch':
        baseUrl = 'https://maps.googleapis.com/maps/api/place/nearbysearch/json'
        break
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid endpoint' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

    // Add API key and build query string
    const queryParams = new URLSearchParams({ ...params, key: apiKey })
    const url = `${baseUrl}?${queryParams.toString()}`

    // Make the request to Google Maps API
    const response = await fetch(url)
    const data = await response.json()

    // Log usage for analytics (optional)
    await supabaseClient.from('api_usage_logs').insert({
      user_id: user.id,
      endpoint: `google-maps/${endpoint}`,
      timestamp: new Date().toISOString(),
    }).catch(() => {
      // Non-critical, ignore errors
    })

    return new Response(
      JSON.stringify(data),
      { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Google Maps proxy error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
