/**
 * Admin Users API
 * Handles user management operations for admin dashboard
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AdminPermissions {
  users: {
    view: boolean;
    edit: boolean;
    suspend: boolean;
    delete: boolean;
  };
}

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

    // Verify admin authentication
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Check admin permissions
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

    const permissions: AdminPermissions = {
      users: {
        view: adminUser.admin_roles.permissions.includes('users.view'),
        edit: adminUser.admin_roles.permissions.includes('users.edit'),
        suspend: adminUser.admin_roles.permissions.includes('users.suspend'),
        delete: adminUser.admin_roles.permissions.includes('users.delete'),
      },
    };

    // Route handling
    const url = new URL(req.url);
    const method = req.method;
    const pathParts = url.pathname.split('/');
    const userId = pathParts[pathParts.length - 1];

    switch (method) {
      case 'GET':
        return await handleGetUsers(supabaseClient, permissions, url);
      case 'PUT':
        return await handleUpdateUser(supabaseClient, permissions, userId, req);
      case 'DELETE':
        return await handleDeleteUser(supabaseClient, permissions, userId, adminUser.user_id);
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
    console.error('Admin Users API Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

async function handleGetUsers(supabaseClient: any, permissions: AdminPermissions, url: URL) {
  if (!permissions.users.view) {
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
  const search = searchParams.get('search') || '';
  const status = searchParams.get('status') || '';
  const plan = searchParams.get('plan') || '';
  const churnRisk = searchParams.get('churnRisk') || '';
  const sortBy = searchParams.get('sortBy') || 'created_at';
  const sortOrder = searchParams.get('sortOrder') || 'desc';

  let query = supabaseClient
    .from('users')
    .select(`
      *,
      subscriptions(plan, status),
      user_analytics(
        total_sessions,
        total_parking_saved,
        lifetime_value,
        churn_risk_score
      )
    `, { count: 'exact' });

  // Apply filters
  if (search) {
    query = query.or(`email.ilike.%${search}%,display_name.ilike.%${search}%`);
  }

  if (status) {
    query = query.eq('status', status);
  }

  if (plan) {
    query = query.eq('subscriptions.plan', plan);
  }

  if (churnRisk) {
    query = query.eq('user_analytics.churn_risk_score', churnRisk);
  }

  // Apply pagination and sorting
  const offset = (page - 1) * limit;
  query = query
    .order(sortBy, { ascending: sortOrder === 'asc' })
    .range(offset, offset + limit - 1);

  const { data: users, error, count } = await query;

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
  const transformedUsers = users?.map(user => ({
    id: user.id,
    email: user.email,
    displayName: user.display_name,
    phoneNumber: user.phone_number,
    photoURL: user.photo_url,
    plan: user.subscriptions?.[0]?.plan || 'free',
    status: user.status,
    createdAt: user.created_at,
    lastLoginAt: user.last_login_at,
    lastActiveAt: user.last_active_at,
    emailVerified: user.email_verified,
    phoneVerified: user.phone_verified,
    totalSessions: user.user_analytics?.[0]?.total_sessions || 0,
    totalParkingSaved: user.user_analytics?.[0]?.total_parking_saved || 0,
    lifetimeValue: user.user_analytics?.[0]?.lifetime_value || 0,
    churnRisk: user.user_analytics?.[0]?.churn_risk_score || 'low',
    fraudScore: user.fraud_score || 0,
    notes: user.admin_notes || [],
    tags: user.admin_tags || [],
    location: {
      country: user.country,
      city: user.city,
      timezone: user.timezone,
    },
    deviceInfo: {
      platform: user.last_platform,
      appVersion: user.last_app_version,
      osVersion: user.last_os_version,
      deviceModel: user.last_device_model,
    },
  })) || [];

  return new Response(
    JSON.stringify({
      success: true,
      data: transformedUsers,
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

async function handleUpdateUser(
  supabaseClient: any,
  permissions: AdminPermissions,
  userId: string,
  req: Request
) {
  if (!permissions.users.edit) {
    return new Response(
      JSON.stringify({ error: 'Insufficient permissions' }),
      {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  const body = await req.json();
  const { action, data, notes } = body;

  switch (action) {
    case 'suspend':
      if (!permissions.users.suspend) {
        return new Response(
          JSON.stringify({ error: 'Insufficient permissions to suspend users' }),
          {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      const { error: suspendError } = await supabaseClient
        .from('users')
        .update({
          status: 'suspended',
          suspended_at: new Date().toISOString(),
          admin_notes: notes ? [notes] : [],
        })
        .eq('id', userId);

      if (suspendError) {
        return new Response(
          JSON.stringify({ error: suspendError.message }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // Log admin action
      await logAdminAction(supabaseClient, {
        action: 'user_suspended',
        target_user_id: userId,
        notes,
      });

      break;

    case 'activate':
      const { error: activateError } = await supabaseClient
        .from('users')
        .update({
          status: 'active',
          suspended_at: null,
        })
        .eq('id', userId);

      if (activateError) {
        return new Response(
          JSON.stringify({ error: activateError.message }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      await logAdminAction(supabaseClient, {
        action: 'user_activated',
        target_user_id: userId,
        notes,
      });

      break;

    case 'update_notes':
      const { error: notesError } = await supabaseClient
        .from('users')
        .update({
          admin_notes: data.notes,
        })
        .eq('id', userId);

      if (notesError) {
        return new Response(
          JSON.stringify({ error: notesError.message }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      break;

    case 'update_tags':
      const { error: tagsError } = await supabaseClient
        .from('users')
        .update({
          admin_tags: data.tags,
        })
        .eq('id', userId);

      if (tagsError) {
        return new Response(
          JSON.stringify({ error: tagsError.message }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

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

  return new Response(
    JSON.stringify({ success: true, message: 'User updated successfully' }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

async function handleDeleteUser(
  supabaseClient: any,
  permissions: AdminPermissions,
  userId: string,
  adminUserId: string
) {
  if (!permissions.users.delete) {
    return new Response(
      JSON.stringify({ error: 'Insufficient permissions' }),
      {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  // Get user email for compliance request
  const { data: user, error: getUserError } = await supabaseClient
    .from('users')
    .select('email')
    .eq('id', userId)
    .single();

  if (getUserError || !user) {
    return new Response(
      JSON.stringify({ error: 'User not found' }),
      {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  // Create compliance request for data deletion
  const { error: complianceError } = await supabaseClient
    .from('compliance_requests')
    .insert({
      type: 'data_deletion',
      user_id: userId,
      user_email: user.email,
      status: 'approved',
      requested_at: new Date().toISOString(),
      processed_by: adminUserId,
      verification_token: 'admin_initiated',
      notes: ['Admin-initiated account deletion'],
    });

  if (complianceError) {
    return new Response(
      JSON.stringify({ error: 'Failed to create compliance request' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  // Mark user as deleted (don't actually delete for audit purposes)
  const { error: deleteError } = await supabaseClient
    .from('users')
    .update({
      status: 'deleted',
      deleted_at: new Date().toISOString(),
      email: `deleted_${userId}@okapifind.com`,
      display_name: null,
      phone_number: null,
      photo_url: null,
    })
    .eq('id', userId);

  if (deleteError) {
    return new Response(
      JSON.stringify({ error: deleteError.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  // Log admin action
  await logAdminAction(supabaseClient, {
    action: 'user_deleted',
    target_user_id: userId,
    notes: 'Admin-initiated deletion',
  });

  return new Response(
    JSON.stringify({ success: true, message: 'User deletion initiated' }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

async function logAdminAction(supabaseClient: any, action: any) {
  await supabaseClient
    .from('audit_logs')
    .insert({
      ...action,
      timestamp: new Date().toISOString(),
      compliance_related: true,
    });
}

/* To invoke locally:

1. Serve the function:
   supabase functions serve admin-users

2. Test with curl:
   curl -i --location --request GET 'http://localhost:54321/functions/v1/admin-users?page=1&limit=10' \
     --header 'Authorization: Bearer [YOUR_ANON_KEY]' \
     --header 'Content-Type: application/json'

3. Update user:
   curl -i --location --request PUT 'http://localhost:54321/functions/v1/admin-users/[USER_ID]' \
     --header 'Authorization: Bearer [YOUR_ANON_KEY]' \
     --header 'Content-Type: application/json' \
     --data-raw '{
       "action": "suspend",
       "notes": "Suspicious activity detected"
     }'
*/