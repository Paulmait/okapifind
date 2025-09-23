import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@13.10.0?target=deno'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
})

const endpointSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? ''

serve(async (req) => {
  const signature = req.headers.get('stripe-signature')

  if (!signature) {
    return new Response('No signature', { status: 400 })
  }

  try {
    const body = await req.text()
    const event = stripe.webhooks.constructEvent(body, signature, endpointSecret)

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        await handleCheckoutComplete(session)
        break
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        await updateSubscription(subscription)
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        await cancelSubscription(subscription)
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        await handleFailedPayment(invoice)
        break
      }

      default:
        console.log(`Unhandled event type ${event.type}`)
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (err) {
    console.error('Webhook Error:', err)
    return new Response(
      JSON.stringify({ error: 'Webhook handler failed' }),
      { status: 400 }
    )
  }
})

async function handleCheckoutComplete(session: Stripe.Checkout.Session) {
  // Import Supabase client
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.39.0')
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  const { customer, subscription, metadata } = session

  // Update user subscription in database
  const { error } = await supabase
    .from('subscriptions')
    .upsert({
      user_id: metadata?.user_id,
      stripe_customer_id: customer as string,
      stripe_subscription_id: subscription as string,
      status: 'active',
      current_period_end: new Date(session.expires_at * 1000).toISOString(),
      plan_id: metadata?.plan_id,
      updated_at: new Date().toISOString(),
    })

  if (error) {
    console.error('Error updating subscription:', error)
  }
}

async function updateSubscription(subscription: Stripe.Subscription) {
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.39.0')
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  const { error } = await supabase
    .from('subscriptions')
    .update({
      status: subscription.status,
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      cancel_at_period_end: subscription.cancel_at_period_end,
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscription.id)

  if (error) {
    console.error('Error updating subscription:', error)
  }
}

async function cancelSubscription(subscription: Stripe.Subscription) {
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.39.0')
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  const { error } = await supabase
    .from('subscriptions')
    .update({
      status: 'canceled',
      canceled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscription.id)

  if (error) {
    console.error('Error canceling subscription:', error)
  }
}

async function handleFailedPayment(invoice: Stripe.Invoice) {
  // Send email notification about failed payment
  const emailResponse = await fetch(
    `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-email`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: invoice.customer_email,
        subject: 'Payment Failed - Action Required',
        template: 'payment_failed',
        data: {
          amount: (invoice.amount_due / 100).toFixed(2),
          currency: invoice.currency.toUpperCase(),
          attempt_count: invoice.attempt_count,
        },
      }),
    }
  )

  if (!emailResponse.ok) {
    console.error('Failed to send payment failure email')
  }
}