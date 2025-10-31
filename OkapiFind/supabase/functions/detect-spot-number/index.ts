/**
 * Detect Spot Number Edge Function
 * OCR processing for parking spot numbers
 * PREMIUM FEATURE - Backend enforcement
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://okapifind.vercel.app',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Get user
    const {
      data: { user },
    } = await supabaseClient.auth.getUser()

    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    // ✅ PREMIUM CHECK - Spot number detection is a premium feature
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: settings } = await supabaseAdmin
      .from('user_settings')
      .select('premium')
      .eq('user_id', user.id)
      .single()

    if (!settings?.premium) {
      return new Response(
        JSON.stringify({ error: 'Spot number detection requires premium subscription' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 402, // Payment Required
        }
      )
    }

    // Get request body
    const { image_path } = await req.json()

    if (!image_path) {
      return new Response(JSON.stringify({ error: 'image_path required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // Get signed URL for image
    const { data: signedUrlData } = await supabaseAdmin.storage
      .from('parking-images')
      .createSignedUrl(image_path, 60)

    if (!signedUrlData?.signedUrl) {
      return new Response(JSON.stringify({ error: 'Failed to get image URL' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      })
    }

    // TODO: Call Google Cloud Vision API or similar OCR service
    // For now, return placeholder response
    // In production, this would:
    // 1. Download image from signed URL
    // 2. Send to OCR service (Google Vision, AWS Textract, etc.)
    // 3. Parse results for spot number patterns
    // 4. Return formatted spot number with confidence

    // Placeholder response
    const response = {
      spot_number: 'A123', // Would come from OCR
      confidence: 0.85,
      raw_text: 'A 123',
      message: 'OCR service integration pending - using placeholder',
    }

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
