import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RevenueCatEvent {
  type: string
  app_user_id: string
  product_id: string
  entitlement_identifier?: string
  expiration_at_ms?: number
  purchased_at_ms?: number
  environment: 'SANDBOX' | 'PRODUCTION'
  store: 'APP_STORE' | 'PLAY_STORE' | 'STRIPE'
  is_trial_conversion?: boolean
  cancellation_reason?: string
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verify webhook secret
    const authHeader = req.headers.get('Authorization')
    const webhookSecret = Deno.env.get('REVENUECAT_WEBHOOK_SECRET')

    if (!authHeader || authHeader !== `Bearer ${webhookSecret}`) {
      return new Response('Unauthorized', { status: 401 })
    }

    // Parse webhook payload
    const payload: RevenueCatEvent = await req.json()
    console.log('RevenueCat webhook received:', payload.type)

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Extract user ID from app_user_id (format: "supabase_{uuid}")
    const userId = payload.app_user_id.replace('supabase_', '')

    // Handle different webhook types
    switch (payload.type) {
      case 'INITIAL_PURCHASE':
      case 'RENEWAL':
      case 'UNCANCELLATION':
      case 'PRODUCT_CHANGE': {
        // Activate or renew subscription
        const expiresAt = payload.expiration_at_ms
          ? new Date(payload.expiration_at_ms)
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // Default 30 days

        // Upsert subscription record
        const { error: subError } = await supabase
          .from('subscriptions')
          .upsert({
            user_id: userId,
            platform: payload.store === 'APP_STORE' ? 'ios' : 'android',
            product_id: payload.product_id,
            rc_customer_id: payload.app_user_id,
            entitlements: {
              premium: true,
              entitlement_id: payload.entitlement_identifier,
              store: payload.store,
              environment: payload.environment,
            },
            active_until: expiresAt.toISOString(),
          }, {
            onConflict: 'user_id,platform'
          })

        if (subError) {
          console.error('Failed to update subscription:', subError)
          throw subError
        }

        // Update user settings premium flag
        const { error: settingsError } = await supabase
          .from('user_settings')
          .update({
            premium: true,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId)

        if (settingsError) {
          console.error('Failed to update user settings:', settingsError)
          // Non-critical, continue
        }

        // Log analytics event
        await supabase
          .from('analytics_events')
          .insert({
            user_id: userId,
            event: 'subscription_activated',
            payload: {
              product_id: payload.product_id,
              store: payload.store,
              is_trial: payload.is_trial_conversion,
              environment: payload.environment,
            }
          })

        console.log(`Subscription activated for user ${userId}`)
        break
      }

      case 'CANCELLATION':
      case 'EXPIRATION': {
        // Deactivate subscription
        const { error: subError } = await supabase
          .from('subscriptions')
          .update({
            active_until: new Date().toISOString(), // Expires now
            entitlements: {
              premium: false,
              cancellation_reason: payload.cancellation_reason,
              environment: payload.environment,
            }
          })
          .eq('rc_customer_id', payload.app_user_id)

        if (subError) {
          console.error('Failed to expire subscription:', subError)
          throw subError
        }

        // Update user settings premium flag
        const { error: settingsError } = await supabase
          .from('user_settings')
          .update({
            premium: false,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId)

        if (settingsError) {
          console.error('Failed to update user settings:', settingsError)
          // Non-critical, continue
        }

        // Log analytics event
        await supabase
          .from('analytics_events')
          .insert({
            user_id: userId,
            event: payload.type === 'CANCELLATION' ? 'subscription_cancelled' : 'subscription_expired',
            payload: {
              product_id: payload.product_id,
              cancellation_reason: payload.cancellation_reason,
              environment: payload.environment,
            }
          })

        console.log(`Subscription deactivated for user ${userId}`)
        break
      }

      case 'BILLING_ISSUE': {
        // Log billing issue
        await supabase
          .from('analytics_events')
          .insert({
            user_id: userId,
            event: 'billing_issue',
            payload: {
              product_id: payload.product_id,
              environment: payload.environment,
            }
          })

        console.log(`Billing issue for user ${userId}`)
        break
      }

      case 'TRANSFER': {
        // Handle account transfer
        console.log(`Account transfer for user ${userId} - manual review required`)

        await supabase
          .from('analytics_events')
          .insert({
            user_id: userId,
            event: 'account_transfer',
            payload: {
              product_id: payload.product_id,
              environment: payload.environment,
            }
          })
        break
      }

      default:
        console.log(`Unhandled webhook type: ${payload.type}`)
    }

    return new Response(
      JSON.stringify({ success: true, type: payload.type }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )
  } catch (error) {
    console.error('Webhook error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    )
  }
})