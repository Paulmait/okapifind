import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ExpoNotification {
  to: string
  sound: 'default' | null
  title: string
  body: string
  data?: Record<string, any>
  badge?: number
  categoryId?: string
}

async function sendExpoPushNotification(notification: ExpoNotification) {
  const response = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(notification)
  })

  const result = await response.json()
  return result
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verify cron secret or admin auth
    const authHeader = req.headers.get('Authorization')
    const cronSecret = Deno.env.get('CRON_SECRET')

    if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
      return new Response('Unauthorized', { status: 401 })
    }

    console.log('Running timer reminder cron job...')

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const now = new Date().toISOString()

    // Find all scheduled timers that should fire
    const { data: timers, error: timerError } = await supabase
      .from('timers')
      .select(`
        id,
        session_id,
        notify_at,
        buffer_seconds,
        session:parking_sessions!inner (
          id,
          user_id,
          car_address,
          venue_name,
          notes
        )
      `)
      .eq('status', 'scheduled')
      .lte('notify_at', now)

    if (timerError) {
      console.error('Error fetching timers:', timerError)
      throw timerError
    }

    console.log(`Found ${timers?.length || 0} timers to process`)

    const notifications: Promise<any>[] = []
    const processedTimerIds: string[] = []

    for (const timer of timers || []) {
      if (!timer.session?.user_id) continue

      // Get user's push tokens
      const { data: devices, error: deviceError } = await supabase
        .from('devices')
        .select('expo_push_token, platform')
        .eq('user_id', timer.session.user_id)
        .not('expo_push_token', 'is', null)

      if (deviceError) {
        console.error(`Error fetching devices for user ${timer.session.user_id}:`, deviceError)
        continue
      }

      // Calculate time remaining (if buffer is set)
      const bufferMinutes = Math.floor((timer.buffer_seconds || 600) / 60)
      const location = timer.session.car_address || timer.session.venue_name || 'saved location'

      // Send notification to each device
      for (const device of devices || []) {
        if (!device.expo_push_token) continue

        const notification: ExpoNotification = {
          to: device.expo_push_token,
          sound: 'default',
          title: '⏰ Parking Timer Alert',
          body: bufferMinutes > 0
            ? `Your parking expires in ${bufferMinutes} minutes at ${location}`
            : `Your parking has expired at ${location}`,
          data: {
            type: 'timer_alert',
            session_id: timer.session_id,
            timer_id: timer.id,
          },
          badge: 1,
          categoryId: 'parking_timer'
        }

        notifications.push(
          sendExpoPushNotification(notification)
            .then(result => {
              console.log(`Notification sent to ${device.expo_push_token}:`, result)
              return result
            })
            .catch(error => {
              console.error(`Failed to send notification to ${device.expo_push_token}:`, error)
              return null
            })
        )
      }

      processedTimerIds.push(timer.id)
    }

    // Wait for all notifications to be sent
    const results = await Promise.all(notifications)

    // Mark timers as fired
    if (processedTimerIds.length > 0) {
      const { error: updateError } = await supabase
        .from('timers')
        .update({
          status: 'fired',
          fired_at: now
        })
        .in('id', processedTimerIds)

      if (updateError) {
        console.error('Error updating timer status:', updateError)
      }

      // Log analytics events
      for (const timer of timers || []) {
        if (!timer.session?.user_id) continue

        await supabase
          .from('analytics_events')
          .insert({
            user_id: timer.session.user_id,
            event: 'timer_notification_sent',
            payload: {
              timer_id: timer.id,
              session_id: timer.session_id,
              notify_at: timer.notify_at,
            }
          })
      }
    }

    // Clean up expired shares
    const { data: expiredCount } = await supabase.rpc('cleanup_expired_shares')
    console.log(`Cleaned up ${expiredCount || 0} expired shares`)

    return new Response(
      JSON.stringify({
        success: true,
        timers_processed: processedTimerIds.length,
        notifications_sent: results.filter(r => r?.data?.status === 'ok').length,
        expired_shares_cleaned: expiredCount || 0
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )
  } catch (error) {
    console.error('Cron error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})