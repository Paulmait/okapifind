import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

serve(async (req) => {
  // CORS headers
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    })
  }

  try {
    const { to, subject, template, data, replyTo } = await req.json()

    // Validate required fields
    if (!to || !subject || !template) {
      throw new Error('Missing required fields: to, subject, or template')
    }

    // Get email HTML based on template
    const html = getEmailTemplate(template, data)

    // Send email using Resend
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'OkapiFind <noreply@okapifind.com>',
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
        reply_to: replyTo || 'support@okapifind.com',
        tags: [
          {
            name: 'template',
            value: template,
          },
        ],
      }),
    })

    if (!res.ok) {
      const error = await res.text()
      throw new Error(`Resend API error: ${error}`)
    }

    const responseData = await res.json()

    return new Response(JSON.stringify({ success: true, id: responseData.id }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      status: 200,
    })
  } catch (error) {
    console.error('Email sending error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        status: 400,
      }
    )
  }
})

function getEmailTemplate(template: string, data: any): string {
  const templates: Record<string, (data: any) => string> = {
    welcome: (data) => `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f7f7f7; padding: 30px; border-radius: 0 0 10px 10px; }
            .button { background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to OkapiFind! 🚗</h1>
            </div>
            <div class="content">
              <p>Hi ${data.name || 'there'},</p>
              <p>Thank you for joining OkapiFind! We're excited to help you never lose your car again.</p>
              <p><strong>Here's what you can do with OkapiFind:</strong></p>
              <ul>
                <li>🎯 Automatically detect when you park</li>
                <li>📸 Add photo notes to remember your spot</li>
                <li>🗺️ Get walking directions back to your car</li>
                <li>⏰ Set parking meter reminders</li>
                <li>📤 Share your parking location with others</li>
              </ul>
              <a href="https://okapifind.com/app" class="button">Open App</a>
              <p style="margin-top: 30px; font-size: 14px; color: #666;">
                Need help? Reply to this email or visit our <a href="https://okapifind.com/support">support center</a>.
              </p>
            </div>
          </div>
        </body>
      </html>
    `,

    payment_failed: (data) => `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #ff6b6b; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f7f7f7; padding: 30px; border-radius: 0 0 10px 10px; }
            .button { background: #ff6b6b; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 20px; }
            .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Payment Failed ⚠️</h1>
            </div>
            <div class="content">
              <p>We were unable to process your payment of <strong>${data.currency} ${data.amount}</strong>.</p>
              <div class="warning">
                <strong>Action Required:</strong> Please update your payment method within 7 days to avoid service interruption.
              </div>
              <p>This was attempt ${data.attempt_count} to process your payment.</p>
              <a href="https://okapifind.com/account/billing" class="button">Update Payment Method</a>
              <p style="margin-top: 30px; font-size: 14px; color: #666;">
                If you believe this is an error, please <a href="mailto:support@okapifind.com">contact support</a>.
              </p>
            </div>
          </div>
        </body>
      </html>
    `,

    subscription_ending: (data) => `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #ffa500; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f7f7f7; padding: 30px; border-radius: 0 0 10px 10px; }
            .button { background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 20px; }
            .features { background: white; padding: 20px; border-radius: 10px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Your Trial Ends in ${data.days_left} Days</h1>
            </div>
            <div class="content">
              <p>Hi ${data.name},</p>
              <p>Your OkapiFind trial is ending soon. Don't lose access to these premium features:</p>
              <div class="features">
                <ul style="list-style: none; padding: 0;">
                  <li>✅ Unlimited parking saves</li>
                  <li>✅ Automatic parking detection</li>
                  <li>✅ Photo notes & voice navigation</li>
                  <li>✅ 30-day parking history</li>
                  <li>✅ Share parking locations</li>
                </ul>
              </div>
              <p><strong>Special Offer:</strong> Subscribe now and get 20% off your first 3 months!</p>
              <a href="https://okapifind.com/subscribe?discount=TRIAL20" class="button">Continue with 20% Off</a>
              <p style="margin-top: 30px; font-size: 14px; color: #666;">
                No longer need OkapiFind? <a href="https://okapifind.com/account/cancel">Cancel anytime</a>
              </p>
            </div>
          </div>
        </body>
      </html>
    `,

    parking_reminder: (data) => `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #28a745; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f7f7f7; padding: 30px; border-radius: 0 0 10px 10px; }
            .button { background: #28a745; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 20px; }
            .location-box { background: white; padding: 15px; border-radius: 10px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Parking Meter Expiring Soon! ⏰</h1>
            </div>
            <div class="content">
              <p>Your parking meter at <strong>${data.location}</strong> will expire in <strong>${data.minutes_left} minutes</strong>.</p>
              <div class="location-box">
                <p><strong>Parking Details:</strong></p>
                <p>📍 Location: ${data.location}</p>
                <p>⏰ Expires at: ${data.expiry_time}</p>
                <p>🚶 Walking distance: ${data.distance} minutes</p>
              </div>
              <a href="https://okapifind.com/navigate?to=${data.parking_id}" class="button">Get Directions</a>
              <p style="margin-top: 30px; font-size: 14px; color: #666;">
                Don't want these reminders? <a href="https://okapifind.com/settings/notifications">Update preferences</a>
              </p>
            </div>
          </div>
        </body>
      </html>
    `,
  }

  const templateFunction = templates[template]
  if (!templateFunction) {
    throw new Error(`Unknown email template: ${template}`)
  }

  return templateFunction(data)
}