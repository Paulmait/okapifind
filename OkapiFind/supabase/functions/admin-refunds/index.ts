/**
 * Admin Refunds API
 * Handles refund processing and management for admin dashboard
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Verify admin authentication and permissions
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: adminUser, error: adminError } = await supabaseClient
      .from('admin_users')
      .select('*, admin_roles(*)')
      .eq('user_id', user.id)
      .single();

    if (adminError || !adminUser || !adminUser.is_active) {
      return new Response(
        JSON.stringify({ error: 'Access denied' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const hasRefundPermission = adminUser.admin_roles.permissions.includes('revenue.refund');

    if (!hasRefundPermission) {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Route handling
    const url = new URL(req.url);
    const method = req.method;
    const pathParts = url.pathname.split('/');
    const refundId = pathParts[pathParts.length - 1];

    switch (method) {
      case 'GET':
        if (refundId && refundId !== 'admin-refunds') {
          return await handleGetRefund(supabaseClient, refundId);
        } else {
          return await handleGetRefunds(supabaseClient, url);
        }
      case 'POST':
        return await handleProcessRefund(supabaseClient, adminUser.user_id, req);
      case 'PUT':
        return await handleUpdateRefund(supabaseClient, adminUser.user_id, refundId, req);
      default:
        return new Response(
          JSON.stringify({ error: 'Method not allowed' }),
          {
            status: 405,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
    }
  } catch (error) {
    console.error('Admin Refunds API Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

async function handleGetRefunds(supabaseClient: any, url: URL) {
  const searchParams = url.searchParams;
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '20');
  const status = searchParams.get('status') || '';
  const reason = searchParams.get('reason') || '';
  const sortBy = searchParams.get('sortBy') || 'requested_at';
  const sortOrder = searchParams.get('sortOrder') || 'desc';

  let query = supabaseClient
    .from('refund_requests')
    .select(`
      *,
      users!refund_requests_user_id_fkey(email, display_name)
    `, { count: 'exact' });

  // Apply filters
  if (status) {
    query = query.eq('status', status);
  }

  if (reason) {
    query = query.eq('reason', reason);
  }

  // Apply pagination and sorting
  const offset = (page - 1) * limit;
  query = query
    .order(sortBy, { ascending: sortOrder === 'asc' })
    .range(offset, offset + limit - 1);

  const { data: refunds, error, count } = await query;

  if (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  // Transform data for admin dashboard
  const transformedRefunds = refunds?.map(refund => ({
    id: refund.id,
    userId: refund.user_id,
    user: {
      email: refund.users?.email || '',
      displayName: refund.users?.display_name || '',
    },
    subscriptionId: refund.subscription_id,
    paymentIntentId: refund.payment_intent_id,
    amount: refund.amount,
    currency: refund.currency,
    reason: refund.reason,
    customerReason: refund.customer_reason,
    status: refund.status,
    requestedAt: refund.requested_at,
    processedAt: refund.processed_at,
    processedBy: refund.processed_by,
    stripeRefundId: refund.stripe_refund_id,
    isRetentionOffer: refund.is_retention_offer,
    retentionOfferType: refund.retention_offer_type,
    notes: refund.notes || [],
    attachments: refund.attachments || [],
  })) || [];

  return new Response(
    JSON.stringify({
      success: true,
      data: transformedRefunds,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

async function handleGetRefund(supabaseClient: any, refundId: string) {
  const { data: refund, error } = await supabaseClient
    .from('refund_requests')
    .select(`
      *,
      users!refund_requests_user_id_fkey(email, display_name),
      retention_offers(*)
    `)
    .eq('id', refundId)
    .single();

  if (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  if (!refund) {
    return new Response(
      JSON.stringify({ error: 'Refund not found' }),
      {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  return new Response(
    JSON.stringify({
      success: true,
      data: {
        ...refund,
        user: {
          email: refund.users?.email || '',
          displayName: refund.users?.display_name || '',
        },
      },
    }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

async function handleProcessRefund(supabaseClient: any, adminUserId: string, req: Request) {
  const body = await req.json();
  const { refundId, decision, reason, retentionOffer } = body;

  // Get refund request
  const { data: refundRequest, error: getError } = await supabaseClient
    .from('refund_requests')
    .select('*')
    .eq('id', refundId)
    .single();

  if (getError || !refundRequest) {
    return new Response(
      JSON.stringify({ error: 'Refund request not found' }),
      {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  if (refundRequest.status !== 'pending') {
    return new Response(
      JSON.stringify({ error: 'Refund request already processed' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  try {
    let updateData: any = {
      processed_at: new Date().toISOString(),
      processed_by: adminUserId,
      notes: [
        ...(refundRequest.notes || []),
        `${decision.toUpperCase()}: ${reason || 'No reason provided'}`
      ],
    };

    if (decision === 'approve') {
      // Process Stripe refund
      const stripeRefund = await processStripeRefund(
        refundRequest.payment_intent_id,
        refundRequest.amount,
        refundRequest.reason
      );

      updateData.stripe_refund_id = stripeRefund.id;
      updateData.status = 'processed';

      // Cancel subscription if full refund
      if (refundRequest.amount === stripeRefund.amount) {
        await cancelSubscription(refundRequest.subscription_id);
      }

    } else if (decision === 'deny') {
      updateData.status = 'denied';

    } else if (decision === 'offer_retention' && retentionOffer) {
      // Create retention offer
      await supabaseClient
        .from('retention_offers')
        .insert({
          refund_request_id: refundId,
          type: retentionOffer.type,
          description: retentionOffer.description,
          value: retentionOffer.value,
          duration_months: retentionOffer.durationMonths,
          status: 'pending',
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        });

      updateData.is_retention_offer = true;
      updateData.retention_offer_type = retentionOffer.type;
      updateData.status = 'pending'; // Keep pending until customer responds
    }

    // Update refund request
    const { data: updatedRefund, error: updateError } = await supabaseClient
      .from('refund_requests')
      .update(updateData)
      .eq('id', refundId)
      .select()
      .single();

    if (updateError) {
      throw new Error(updateError.message);
    }

    // Log admin action
    await supabaseClient
      .from('audit_logs')
      .insert({
        action: 'refund_processed',
        target_resource: 'refund_request',
        target_id: refundId,
        performed_by: adminUserId,
        details: { decision, reason, refund_id: refundId },
        timestamp: new Date().toISOString(),
        compliance_related: false,
      });

    // Send notification to customer (implement email service)
    await sendRefundNotification(updatedRefund, decision);

    return new Response(
      JSON.stringify({
        success: true,
        data: updatedRefund,
        message: `Refund ${decision}ed successfully`,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Refund processing error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to process refund' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
}

async function handleUpdateRefund(
  supabaseClient: any,
  adminUserId: string,
  refundId: string,
  req: Request
) {
  const body = await req.json();
  const { notes, tags } = body;

  const updateData: any = {};

  if (notes !== undefined) {
    updateData.notes = notes;
  }

  if (tags !== undefined) {
    updateData.admin_tags = tags;
  }

  updateData.updated_at = new Date().toISOString();

  const { data: updatedRefund, error } = await supabaseClient
    .from('refund_requests')
    .update(updateData)
    .eq('id', refundId)
    .select()
    .single();

  if (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  return new Response(
    JSON.stringify({
      success: true,
      data: updatedRefund,
      message: 'Refund updated successfully',
    }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

async function processStripeRefund(
  paymentIntentId: string,
  amount: number,
  reason: string
): Promise<any> {
  const stripeUrl = 'https://api.stripe.com/v1/refunds';

  const body = new URLSearchParams({
    payment_intent: paymentIntentId,
    amount: amount.toString(),
    reason: mapRefundReasonToStripe(reason),
  });

  const response = await fetch(stripeUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Stripe refund failed: ${error.error?.message || 'Unknown error'}`);
  }

  return await response.json();
}

function mapRefundReasonToStripe(reason: string): string {
  switch (reason) {
    case 'fraudulent':
      return 'fraudulent';
    case 'duplicate_charge':
      return 'duplicate';
    default:
      return 'requested_by_customer';
  }
}

async function cancelSubscription(subscriptionId: string): Promise<void> {
  const stripeUrl = `https://api.stripe.com/v1/subscriptions/${subscriptionId}`;

  const response = await fetch(stripeUrl, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
    },
  });

  if (!response.ok) {
    console.error('Failed to cancel Stripe subscription:', await response.text());
  }
}

async function sendRefundNotification(refund: any, decision: string): Promise<void> {
  // Implementation would integrate with your email service
  console.log(`Would send ${decision} notification to ${refund.user_email}`);

  // Example integration with Supabase Edge Functions email service
  // You could call another edge function or use a service like SendGrid, Resend, etc.
}

/* To invoke locally:

1. Serve the function:
   supabase functions serve admin-refunds

2. Get refunds:
   curl -i --location --request GET 'http://localhost:54321/functions/v1/admin-refunds?status=pending' \
     --header 'Authorization: Bearer [YOUR_ANON_KEY]' \
     --header 'Content-Type: application/json'

3. Process refund:
   curl -i --location --request POST 'http://localhost:54321/functions/v1/admin-refunds' \
     --header 'Authorization: Bearer [YOUR_ANON_KEY]' \
     --header 'Content-Type: application/json' \
     --data-raw '{
       "refundId": "refund_123",
       "decision": "approve",
       "reason": "Customer request approved"
     }'
*/