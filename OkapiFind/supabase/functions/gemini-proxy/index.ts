// Supabase Edge Function: Google Gemini AI Proxy
// Securely proxies Gemini AI API calls for parking sign OCR and analysis

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface GeminiRequest {
  action: 'analyze-sign' | 'analyze-meter' | 'generate-reminder'
  imageBase64?: string
  prompt?: string
  context?: Record<string, unknown>
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

    // Check premium status for AI features (optional rate limiting)
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('is_premium')
      .eq('id', user.id)
      .single()

    // Parse request
    const { action, imageBase64, prompt, context }: GeminiRequest = await req.json()

    // Get the API key from environment (never exposed to client)
    const apiKey = Deno.env.get('GEMINI_API_KEY')
    if (!apiKey) {
      console.error('GEMINI_API_KEY not configured')
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Build the Gemini API request based on action
    let geminiPrompt: string
    const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = []

    switch (action) {
      case 'analyze-sign':
        geminiPrompt = `Analyze this parking sign image and extract:
1. Time restrictions (e.g., "2 HOUR PARKING 8AM-6PM")
2. Days applicable (e.g., "MON-FRI", "EXCEPT SUNDAYS")
3. Any special conditions (permit required, street cleaning, etc.)
4. Estimated time remaining if currently parked

Respond in JSON format:
{
  "timeLimit": "duration in minutes or null",
  "restrictions": ["list of restrictions"],
  "hoursActive": {"start": "HH:MM", "end": "HH:MM"},
  "daysActive": ["days"],
  "specialConditions": ["conditions"],
  "canParkNow": true/false,
  "confidence": 0-100
}`
        break

      case 'analyze-meter':
        geminiPrompt = `Analyze this parking meter image and extract:
1. Time remaining displayed
2. Maximum time allowed
3. Rate per hour
4. Payment methods accepted
5. Meter status (expired, active, out of service)

Respond in JSON format:
{
  "timeRemaining": "minutes or null",
  "maxTime": "minutes",
  "ratePerHour": "amount in cents",
  "paymentMethods": ["methods"],
  "status": "active|expired|out-of-service",
  "confidence": 0-100
}`
        break

      case 'generate-reminder':
        geminiPrompt = prompt || `Generate a helpful parking reminder message based on the context provided.`
        break

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

    // Add text prompt
    parts.push({ text: geminiPrompt })

    // Add image if provided
    if (imageBase64) {
      parts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: imageBase64,
        },
      })
    }

    // Add context if provided
    if (context) {
      parts.push({ text: `\nContext: ${JSON.stringify(context)}` })
    }

    // Make request to Gemini API
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`

    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts,
        }],
        generationConfig: {
          temperature: 0.2, // Lower temperature for more consistent results
          topK: 32,
          topP: 0.95,
          maxOutputTokens: 1024,
        },
        safetySettings: [
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        ],
      }),
    })

    const data = await response.json()

    // Extract the text response
    let result: unknown
    try {
      const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text
      if (textContent) {
        // Try to parse as JSON if it looks like JSON
        const jsonMatch = textContent.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          result = JSON.parse(jsonMatch[0])
        } else {
          result = { text: textContent }
        }
      } else {
        result = { error: 'No response generated' }
      }
    } catch {
      result = { text: data.candidates?.[0]?.content?.parts?.[0]?.text || 'Unable to parse response' }
    }

    // Log usage for analytics
    await supabaseClient.from('api_usage_logs').insert({
      user_id: user.id,
      endpoint: `gemini/${action}`,
      timestamp: new Date().toISOString(),
      is_premium: profile?.is_premium || false,
    }).catch(() => {
      // Non-critical, ignore errors
    })

    return new Response(
      JSON.stringify({ success: true, result }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Gemini proxy error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
