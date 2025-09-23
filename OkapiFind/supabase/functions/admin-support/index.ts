/**
 * Admin Support API
 * Handles support ticket management and customer support operations
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    const permissions = {
      view: adminUser.admin_roles.permissions.includes('support.view'),
      respond: adminUser.admin_roles.permissions.includes('support.respond'),
      close: adminUser.admin_roles.permissions.includes('support.close'),
    };

    // Route handling
    const url = new URL(req.url);
    const method = req.method;
    const pathParts = url.pathname.split('/');
    const ticketId = pathParts[pathParts.length - 1];

    switch (method) {
      case 'GET':
        if (ticketId && ticketId !== 'admin-support') {
          return await handleGetTicket(supabaseClient, permissions, ticketId);
        } else {
          return await handleGetTickets(supabaseClient, permissions, url);
        }
      case 'POST':
        return await handleCreateResponse(supabaseClient, permissions, adminUser, req);
      case 'PUT':
        return await handleUpdateTicket(supabaseClient, permissions, adminUser, ticketId, req);
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
    console.error('Admin Support API Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

async function handleGetTickets(supabaseClient: any, permissions: any, url: URL) {
  if (!permissions.view) {
    return new Response(
      JSON.stringify({ error: 'Insufficient permissions' }),
      {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  const searchParams = url.searchParams;
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '20');
  const status = searchParams.get('status') || '';
  const priority = searchParams.get('priority') || '';
  const category = searchParams.get('category') || '';
  const assignedTo = searchParams.get('assignedTo') || '';
  const search = searchParams.get('search') || '';
  const sortBy = searchParams.get('sortBy') || 'created_at';
  const sortOrder = searchParams.get('sortOrder') || 'desc';

  let query = supabaseClient
    .from('support_tickets')
    .select(`
      *,
      users!support_tickets_user_id_fkey(email, display_name, plan),
      ticket_responses(count)
    `, { count: 'exact' });

  // Apply filters
  if (status) {
    query = query.eq('status', status);
  }

  if (priority) {
    query = query.eq('priority', priority);
  }

  if (category) {
    query = query.eq('category', category);
  }

  if (assignedTo) {
    query = query.eq('assigned_to', assignedTo);
  }

  if (search) {
    query = query.or(`subject.ilike.%${search}%,message.ilike.%${search}%,email.ilike.%${search}%`);
  }

  // Apply pagination and sorting
  const offset = (page - 1) * limit;
  query = query
    .order(sortBy, { ascending: sortOrder === 'asc' })
    .range(offset, offset + limit - 1);

  const { data: tickets, error, count } = await query;

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
  const transformedTickets = tickets?.map(ticket => ({
    id: ticket.id,
    ticketNumber: ticket.ticket_number,
    userId: ticket.user_id,
    user: ticket.users ? {
      email: ticket.users.email,
      displayName: ticket.users.display_name,
      plan: ticket.users.plan,
    } : null,
    email: ticket.email,
    subject: ticket.subject,
    message: ticket.message,
    category: ticket.category,
    priority: ticket.priority,
    status: ticket.status,
    assignedTo: ticket.assigned_to,
    createdAt: ticket.created_at,
    updatedAt: ticket.updated_at,
    firstResponseAt: ticket.first_response_at,
    resolvedAt: ticket.resolved_at,
    responseCount: ticket.ticket_responses?.[0]?.count || 0,
    tags: ticket.tags || [],
    satisfaction: ticket.satisfaction,
    escalated: ticket.escalated,
    escalatedAt: ticket.escalated_at,
    escalatedReason: ticket.escalated_reason,
  })) || [];

  return new Response(
    JSON.stringify({
      success: true,
      data: transformedTickets,
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

async function handleGetTicket(supabaseClient: any, permissions: any, ticketId: string) {
  if (!permissions.view) {
    return new Response(
      JSON.stringify({ error: 'Insufficient permissions' }),
      {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  const { data: ticket, error } = await supabaseClient
    .from('support_tickets')
    .select(`
      *,
      users!support_tickets_user_id_fkey(email, display_name, plan, created_at),
      ticket_responses(
        *,
        admin_users!ticket_responses_author_fkey(display_name)
      )
    `)
    .eq('id', ticketId)
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

  if (!ticket) {
    return new Response(
      JSON.stringify({ error: 'Ticket not found' }),
      {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  // Transform response data
  const responses = ticket.ticket_responses?.map((response: any) => ({
    id: response.id,
    ticketId: response.ticket_id,
    fromAdmin: response.from_admin,
    author: response.from_admin
      ? response.admin_users?.display_name || 'Admin'
      : ticket.users?.display_name || ticket.email,
    message: response.message,
    createdAt: response.created_at,
    attachments: response.attachments || [],
    internal: response.internal || false,
  })) || [];

  const transformedTicket = {
    ...ticket,
    user: ticket.users ? {
      email: ticket.users.email,
      displayName: ticket.users.display_name,
      plan: ticket.users.plan,
      memberSince: ticket.users.created_at,
    } : null,
    responses: responses.sort((a: any, b: any) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    ),
  };

  return new Response(
    JSON.stringify({
      success: true,
      data: transformedTicket,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

async function handleCreateResponse(supabaseClient: any, permissions: any, adminUser: any, req: Request) {
  if (!permissions.respond) {
    return new Response(
      JSON.stringify({ error: 'Insufficient permissions' }),
      {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  const body = await req.json();
  const { ticketId, message, internal = false, attachments = [] } = body;

  if (!ticketId || !message) {
    return new Response(
      JSON.stringify({ error: 'Ticket ID and message are required' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  // Get ticket details
  const { data: ticket, error: ticketError } = await supabaseClient
    .from('support_tickets')
    .select('*')
    .eq('id', ticketId)
    .single();

  if (ticketError || !ticket) {
    return new Response(
      JSON.stringify({ error: 'Ticket not found' }),
      {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  const now = new Date().toISOString();

  // Create response
  const { data: response, error: responseError } = await supabaseClient
    .from('ticket_responses')
    .insert({
      ticket_id: ticketId,
      from_admin: true,
      author: adminUser.user_id,
      message,
      internal,
      attachments,
      created_at: now,
    })
    .select()
    .single();

  if (responseError) {
    return new Response(
      JSON.stringify({ error: responseError.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  // Update ticket
  const updateData: any = {
    updated_at: now,
    status: internal ? ticket.status : 'in_progress',
  };

  // Set first response time if this is the first admin response
  if (!ticket.first_response_at && !internal) {
    updateData.first_response_at = now;
  }

  // Assign ticket to responding admin if not already assigned
  if (!ticket.assigned_to) {
    updateData.assigned_to = adminUser.user_id;
  }

  await supabaseClient
    .from('support_tickets')
    .update(updateData)
    .eq('id', ticketId);

  // Send notification to customer (if not internal)
  if (!internal) {
    await sendTicketNotification(supabaseClient, ticket, 'response', {
      adminName: adminUser.display_name,
      message,
    });
  }

  // Log admin action
  await supabaseClient
    .from('audit_logs')
    .insert({
      action: 'ticket_response_created',
      target_resource: 'support_ticket',
      target_id: ticketId,
      performed_by: adminUser.user_id,
      details: { internal, message_length: message.length },
      timestamp: now,
      compliance_related: false,
    });

  return new Response(
    JSON.stringify({
      success: true,
      data: response,
      message: 'Response created successfully',
    }),
    {
      status: 201,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

async function handleUpdateTicket(
  supabaseClient: any,
  permissions: any,
  adminUser: any,
  ticketId: string,
  req: Request
) {
  const body = await req.json();
  const { action, data, notes } = body;

  const now = new Date().toISOString();

  switch (action) {
    case 'assign':
      if (!data.assignedTo) {
        return new Response(
          JSON.stringify({ error: 'Assigned user ID is required' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      await supabaseClient
        .from('support_tickets')
        .update({
          assigned_to: data.assignedTo,
          updated_at: now,
        })
        .eq('id', ticketId);

      break;

    case 'change_priority':
      if (!data.priority) {
        return new Response(
          JSON.stringify({ error: 'Priority is required' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      await supabaseClient
        .from('support_tickets')
        .update({
          priority: data.priority,
          updated_at: now,
        })
        .eq('id', ticketId);

      break;

    case 'change_category':
      if (!data.category) {
        return new Response(
          JSON.stringify({ error: 'Category is required' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      await supabaseClient
        .from('support_tickets')
        .update({
          category: data.category,
          updated_at: now,
        })
        .eq('id', ticketId);

      break;

    case 'escalate':
      await supabaseClient
        .from('support_tickets')
        .update({
          escalated: true,
          escalated_at: now,
          escalated_reason: data.reason,
          priority: 'urgent',
          updated_at: now,
        })
        .eq('id', ticketId);

      // Notify escalation team
      await sendEscalationNotification(supabaseClient, ticketId, data.reason);

      break;

    case 'resolve':
      if (!permissions.close) {
        return new Response(
          JSON.stringify({ error: 'Insufficient permissions to resolve tickets' }),
          {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      await supabaseClient
        .from('support_tickets')
        .update({
          status: 'resolved',
          resolved_at: now,
          updated_at: now,
        })
        .eq('id', ticketId);

      // Send resolution notification
      const { data: ticket } = await supabaseClient
        .from('support_tickets')
        .select('*')
        .eq('id', ticketId)
        .single();

      await sendTicketNotification(supabaseClient, ticket, 'resolved', {
        adminName: adminUser.display_name,
      });

      break;

    case 'close':
      if (!permissions.close) {
        return new Response(
          JSON.stringify({ error: 'Insufficient permissions to close tickets' }),
          {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      await supabaseClient
        .from('support_tickets')
        .update({
          status: 'closed',
          updated_at: now,
        })
        .eq('id', ticketId);

      break;

    case 'add_tags':
      if (!data.tags || !Array.isArray(data.tags)) {
        return new Response(
          JSON.stringify({ error: 'Tags array is required' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      await supabaseClient
        .from('support_tickets')
        .update({
          tags: data.tags,
          updated_at: now,
        })
        .eq('id', ticketId);

      break;

    case 'reopen':
      await supabaseClient
        .from('support_tickets')
        .update({
          status: 'open',
          resolved_at: null,
          updated_at: now,
        })
        .eq('id', ticketId);

      break;

    default:
      return new Response(
        JSON.stringify({ error: 'Invalid action' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
  }

  // Log admin action
  await supabaseClient
    .from('audit_logs')
    .insert({
      action: `ticket_${action}`,
      target_resource: 'support_ticket',
      target_id: ticketId,
      performed_by: adminUser.user_id,
      details: { action, data, notes },
      timestamp: now,
      compliance_related: false,
    });

  return new Response(
    JSON.stringify({
      success: true,
      message: `Ticket ${action} completed successfully`,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

async function sendTicketNotification(
  supabaseClient: any,
  ticket: any,
  type: 'response' | 'resolved',
  data: any
): Promise<void> {
  // Implementation would integrate with your email service
  console.log(`Would send ${type} notification for ticket ${ticket.id} to ${ticket.email}`);

  // Example: Store notification for sending
  await supabaseClient
    .from('email_queue')
    .insert({
      to: ticket.email,
      template: `support_ticket_${type}`,
      data: {
        ticketNumber: ticket.ticket_number,
        subject: ticket.subject,
        ...data,
      },
      scheduled_for: new Date().toISOString(),
    });
}

async function sendEscalationNotification(
  supabaseClient: any,
  ticketId: string,
  reason: string
): Promise<void> {
  // Get escalation team members
  const { data: escalationTeam } = await supabaseClient
    .from('admin_users')
    .select('email, display_name')
    .eq('receive_escalations', true)
    .eq('is_active', true);

  if (escalationTeam && escalationTeam.length > 0) {
    for (const member of escalationTeam) {
      await supabaseClient
        .from('email_queue')
        .insert({
          to: member.email,
          template: 'support_escalation',
          data: {
            ticketId,
            reason,
            escalatedBy: 'Admin',
          },
          scheduled_for: new Date().toISOString(),
        });
    }
  }
}

/* To invoke locally:

1. Serve the function:
   supabase functions serve admin-support

2. Get tickets:
   curl -i --location --request GET 'http://localhost:54321/functions/v1/admin-support?status=open&page=1&limit=10' \
     --header 'Authorization: Bearer [YOUR_ANON_KEY]' \
     --header 'Content-Type: application/json'

3. Create response:
   curl -i --location --request POST 'http://localhost:54321/functions/v1/admin-support' \
     --header 'Authorization: Bearer [YOUR_ANON_KEY]' \
     --header 'Content-Type: application/json' \
     --data-raw '{
       "ticketId": "ticket_123",
       "message": "Thank you for contacting us. We are looking into your issue.",
       "internal": false
     }'

4. Update ticket:
   curl -i --location --request PUT 'http://localhost:54321/functions/v1/admin-support/ticket_123' \
     --header 'Authorization: Bearer [YOUR_ANON_KEY]' \
     --header 'Content-Type: application/json' \
     --data-raw '{
       "action": "resolve",
       "notes": "Issue resolved via email"
     }'
*/