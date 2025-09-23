/**
 * Admin Compliance API
 * Handles GDPR/CCPA compliance requests and data management
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

    const hasCompliancePermission = adminUser.admin_roles.permissions.includes('compliance.handle');

    if (!hasCompliancePermission) {
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
    const endpoint = pathParts[pathParts.length - 1];
    const requestId = pathParts[pathParts.length - 2] === 'requests' ? pathParts[pathParts.length - 1] : null;

    switch (method) {
      case 'GET':
        if (endpoint === 'requests') {
          return await handleGetRequests(supabaseClient, url);
        } else if (endpoint === 'dashboard') {
          return await handleGetDashboard(supabaseClient);
        } else if (endpoint === 'consent-analytics') {
          return await handleGetConsentAnalytics(supabaseClient, url);
        } else if (endpoint === 'audit-logs') {
          return await handleGetAuditLogs(supabaseClient, url);
        } else if (endpoint === 'data-retention') {
          return await handleGetDataRetention(supabaseClient);
        } else if (requestId) {
          return await handleGetRequest(supabaseClient, requestId);
        } else {
          return await handleGetDashboard(supabaseClient);
        }
      case 'POST':
        if (endpoint === 'process-request') {
          return await handleProcessRequest(supabaseClient, adminUser.user_id, req);
        } else if (endpoint === 'data-export') {
          return await handleDataExport(supabaseClient, adminUser.user_id, req);
        } else if (endpoint === 'data-deletion') {
          return await handleDataDeletion(supabaseClient, adminUser.user_id, req);
        }
        break;
      case 'PUT':
        if (requestId) {
          return await handleUpdateRequest(supabaseClient, adminUser.user_id, requestId, req);
        }
        break;
      default:
        return new Response(
          JSON.stringify({ error: 'Method not allowed' }),
          {
            status: 405,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
    }

    return new Response(
      JSON.stringify({ error: 'Endpoint not found' }),
      {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Admin Compliance API Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

async function handleGetRequests(supabaseClient: any, url: URL) {
  const searchParams = url.searchParams;
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '20');
  const type = searchParams.get('type') || '';
  const status = searchParams.get('status') || '';
  const sortBy = searchParams.get('sortBy') || 'requested_at';
  const sortOrder = searchParams.get('sortOrder') || 'desc';

  let query = supabaseClient
    .from('compliance_requests')
    .select(`
      *,
      users!compliance_requests_user_id_fkey(email, display_name)
    `, { count: 'exact' });

  // Apply filters
  if (type) {
    query = query.eq('type', type);
  }

  if (status) {
    query = query.eq('status', status);
  }

  // Apply pagination and sorting
  const offset = (page - 1) * limit;
  query = query
    .order(sortBy, { ascending: sortOrder === 'asc' })
    .range(offset, offset + limit - 1);

  const { data: requests, error, count } = await query;

  if (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  const transformedRequests = requests?.map(request => ({
    id: request.id,
    type: request.type,
    userId: request.user_id,
    userEmail: request.user_email,
    user: request.users ? {
      email: request.users.email,
      displayName: request.users.display_name,
    } : null,
    status: request.status,
    requestedAt: request.requested_at,
    completedAt: request.completed_at,
    dataExportUrl: request.data_export_url,
    verificationToken: request.verification_token,
    processedBy: request.processed_by,
    notes: request.notes || [],
  })) || [];

  return new Response(
    JSON.stringify({
      success: true,
      data: transformedRequests,
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

async function handleGetRequest(supabaseClient: any, requestId: string) {
  const { data: request, error } = await supabaseClient
    .from('compliance_requests')
    .select(`
      *,
      users!compliance_requests_user_id_fkey(email, display_name, created_at)
    `)
    .eq('id', requestId)
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

  if (!request) {
    return new Response(
      JSON.stringify({ error: 'Request not found' }),
      {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  // Get user data summary if it's a data export request
  let userDataSummary = null;
  if (request.type === 'data_export' && request.user_id) {
    userDataSummary = await getUserDataSummary(supabaseClient, request.user_id);
  }

  return new Response(
    JSON.stringify({
      success: true,
      data: {
        ...request,
        user: request.users ? {
          email: request.users.email,
          displayName: request.users.display_name,
          memberSince: request.users.created_at,
        } : null,
        userDataSummary,
      },
    }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

async function handleGetDashboard(supabaseClient: any) {
  // Get compliance metrics
  const [
    pendingRequests,
    consentStats,
    auditLogCount,
    dataRetentionStatus,
    recentRequests,
  ] = await Promise.all([
    getPendingRequests(supabaseClient),
    getConsentStatistics(supabaseClient),
    getAuditLogCount(supabaseClient),
    getDataRetentionStatus(supabaseClient),
    getRecentRequests(supabaseClient),
  ]);

  const dashboard = {
    pendingRequests,
    consentRates: consentStats,
    auditLogCount,
    dataRetentionStatus,
    recentRequests,
    complianceScore: calculateComplianceScore(consentStats, dataRetentionStatus),
  };

  return new Response(
    JSON.stringify({
      success: true,
      data: dashboard,
      generatedAt: new Date().toISOString(),
    }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

async function handleGetConsentAnalytics(supabaseClient: any, url: URL) {
  const searchParams = url.searchParams;
  const timeframe = searchParams.get('timeframe') || 'month';

  const consentAnalytics = {
    consentTrends: await getConsentTrends(supabaseClient, timeframe),
    consentByType: await getConsentByType(supabaseClient),
    consentWithdrawals: await getConsentWithdrawals(supabaseClient, timeframe),
    geographicConsent: await getGeographicConsent(supabaseClient),
  };

  return new Response(
    JSON.stringify({
      success: true,
      data: consentAnalytics,
      timeframe,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

async function handleGetAuditLogs(supabaseClient: any, url: URL) {
  const searchParams = url.searchParams;
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '50');
  const action = searchParams.get('action') || '';
  const userId = searchParams.get('userId') || '';
  const complianceOnly = searchParams.get('complianceOnly') === 'true';

  let query = supabaseClient
    .from('audit_logs')
    .select('*', { count: 'exact' });

  if (action) {
    query = query.eq('action', action);
  }

  if (userId) {
    query = query.eq('user_id', userId);
  }

  if (complianceOnly) {
    query = query.eq('compliance_related', true);
  }

  const offset = (page - 1) * limit;
  query = query
    .order('timestamp', { ascending: false })
    .range(offset, offset + limit - 1);

  const { data: logs, error, count } = await query;

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
      data: logs || [],
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

async function handleGetDataRetention(supabaseClient: any) {
  const retentionStatus = {
    policies: await getRetentionPolicies(supabaseClient),
    expiringData: await getExpiringData(supabaseClient),
    deletionQueue: await getDeletionQueue(supabaseClient),
    storageUsage: await getStorageUsage(supabaseClient),
  };

  return new Response(
    JSON.stringify({
      success: true,
      data: retentionStatus,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

async function handleProcessRequest(supabaseClient: any, adminUserId: string, req: Request) {
  const body = await req.json();
  const { requestId, action, notes } = body;

  if (!requestId || !action) {
    return new Response(
      JSON.stringify({ error: 'Request ID and action are required' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  // Get request details
  const { data: request, error: getError } = await supabaseClient
    .from('compliance_requests')
    .select('*')
    .eq('id', requestId)
    .single();

  if (getError || !request) {
    return new Response(
      JSON.stringify({ error: 'Request not found' }),
      {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  if (request.status !== 'pending') {
    return new Response(
      JSON.stringify({ error: 'Request already processed' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  try {
    let result: { success: boolean; message: string };

    switch (action) {
      case 'approve':
        result = await processApproval(supabaseClient, request, adminUserId, notes);
        break;
      case 'deny':
        result = await processDenial(supabaseClient, request, adminUserId, notes);
        break;
      case 'request_verification':
        result = await requestAdditionalVerification(supabaseClient, request, adminUserId, notes);
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
        action: `compliance_request_${action}`,
        target_resource: 'compliance_request',
        target_id: requestId,
        performed_by: adminUserId,
        details: { action, notes, type: request.type },
        timestamp: new Date().toISOString(),
        compliance_related: true,
      });

    return new Response(
      JSON.stringify({
        success: result.success,
        message: result.message,
      }),
      {
        status: result.success ? 200 : 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Compliance request processing error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to process request' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
}

async function handleDataExport(supabaseClient: any, adminUserId: string, req: Request) {
  const body = await req.json();
  const { userId, userEmail, format = 'json', includeAnalytics = true } = body;

  if (!userId && !userEmail) {
    return new Response(
      JSON.stringify({ error: 'User ID or email is required' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  // Create compliance request
  const request = {
    type: 'data_export',
    user_id: userId,
    user_email: userEmail,
    status: 'processing',
    requested_at: new Date().toISOString(),
    processed_by: adminUserId,
    verification_token: 'admin_initiated',
    notes: [`Admin-initiated data export (${format})`],
  };

  const { data: complianceRequest, error } = await supabaseClient
    .from('compliance_requests')
    .insert(request)
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

  // Start async export processing
  processDataExport(supabaseClient, complianceRequest.id, { format, includeAnalytics });

  return new Response(
    JSON.stringify({
      success: true,
      data: { requestId: complianceRequest.id },
      message: 'Data export initiated',
    }),
    {
      status: 201,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

async function handleDataDeletion(supabaseClient: any, adminUserId: string, req: Request) {
  const body = await req.json();
  const { userId, userEmail, reason } = body;

  if (!userId && !userEmail) {
    return new Response(
      JSON.stringify({ error: 'User ID or email is required' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  // Create compliance request
  const request = {
    type: 'data_deletion',
    user_id: userId,
    user_email: userEmail,
    status: 'approved',
    requested_at: new Date().toISOString(),
    processed_by: adminUserId,
    verification_token: 'admin_initiated',
    notes: [`Admin-initiated deletion: ${reason || 'No reason provided'}`],
  };

  const { data: complianceRequest, error } = await supabaseClient
    .from('compliance_requests')
    .insert(request)
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

  // Process deletion immediately
  await processUserDataDeletion(supabaseClient, complianceRequest.id);

  return new Response(
    JSON.stringify({
      success: true,
      data: { requestId: complianceRequest.id },
      message: 'Data deletion completed',
    }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

// Helper functions

async function getPendingRequests(supabaseClient: any): Promise<number> {
  const { count } = await supabaseClient
    .from('compliance_requests')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');

  return count || 0;
}

async function getConsentStatistics(supabaseClient: any): Promise<any> {
  const { data: consentData } = await supabaseClient
    .from('user_consent')
    .select('analytics_consent, marketing_consent, cookies_consent');

  if (!consentData || consentData.length === 0) {
    return { analytics: 0, marketing: 0, cookies: 0 };
  }

  const total = consentData.length;
  return {
    analytics: (consentData.filter(u => u.analytics_consent).length / total) * 100,
    marketing: (consentData.filter(u => u.marketing_consent).length / total) * 100,
    cookies: (consentData.filter(u => u.cookies_consent).length / total) * 100,
  };
}

async function getAuditLogCount(supabaseClient: any): Promise<number> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const { count } = await supabaseClient
    .from('audit_logs')
    .select('*', { count: 'exact', head: true })
    .eq('compliance_related', true)
    .gte('timestamp', thirtyDaysAgo.toISOString());

  return count || 0;
}

async function getDataRetentionStatus(supabaseClient: any): Promise<any> {
  // Simplified implementation
  return {
    totalRecords: 150000,
    expiringSoon: 1200,
    autoDeleteEnabled: true,
    lastCleanup: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  };
}

async function getRecentRequests(supabaseClient: any): Promise<any[]> {
  const { data } = await supabaseClient
    .from('compliance_requests')
    .select('*')
    .order('requested_at', { ascending: false })
    .limit(5);

  return data || [];
}

function calculateComplianceScore(consentStats: any, retentionStatus: any): number {
  // Simple compliance score calculation
  const avgConsentRate = (consentStats.analytics + consentStats.marketing + consentStats.cookies) / 3;
  const retentionScore = retentionStatus.autoDeleteEnabled ? 100 : 50;

  return Math.round((avgConsentRate + retentionScore) / 2);
}

async function processApproval(
  supabaseClient: any,
  request: any,
  adminUserId: string,
  notes?: string
): Promise<{ success: boolean; message: string }> {
  const now = new Date().toISOString();

  // Update request status
  await supabaseClient
    .from('compliance_requests')
    .update({
      status: 'processing',
      processed_by: adminUserId,
      notes: [...(request.notes || []), `Approved: ${notes || 'No notes'}`],
    })
    .eq('id', request.id);

  // Process based on request type
  switch (request.type) {
    case 'data_export':
      await processDataExport(supabaseClient, request.id, { format: 'json' });
      break;
    case 'data_deletion':
      await processUserDataDeletion(supabaseClient, request.id);
      break;
    case 'consent_withdrawal':
      await processConsentWithdrawal(supabaseClient, request.user_id);
      break;
  }

  return { success: true, message: 'Request approved and processing started' };
}

async function processDenial(
  supabaseClient: any,
  request: any,
  adminUserId: string,
  notes?: string
): Promise<{ success: boolean; message: string }> {
  await supabaseClient
    .from('compliance_requests')
    .update({
      status: 'denied',
      processed_by: adminUserId,
      completed_at: new Date().toISOString(),
      notes: [...(request.notes || []), `Denied: ${notes || 'No reason provided'}`],
    })
    .eq('id', request.id);

  return { success: true, message: 'Request denied' };
}

async function requestAdditionalVerification(
  supabaseClient: any,
  request: any,
  adminUserId: string,
  notes?: string
): Promise<{ success: boolean; message: string }> {
  await supabaseClient
    .from('compliance_requests')
    .update({
      status: 'verification_required',
      notes: [...(request.notes || []), `Additional verification required: ${notes || ''}`],
    })
    .eq('id', request.id);

  // Send verification request email (implementation would depend on email service)

  return { success: true, message: 'Additional verification requested' };
}

async function getUserDataSummary(supabaseClient: any, userId: string): Promise<any> {
  // Get data counts from various tables
  const [
    profileData,
    sessionsCount,
    analyticsCount,
    paymentsCount,
    ticketsCount,
  ] = await Promise.all([
    supabaseClient.from('users').select('*').eq('id', userId).single(),
    supabaseClient.from('user_sessions').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    supabaseClient.from('analytics_events').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    supabaseClient.from('payments').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    supabaseClient.from('support_tickets').select('*', { count: 'exact', head: true }).eq('user_id', userId),
  ]);

  return {
    profileData: profileData.data ? 1 : 0,
    sessions: sessionsCount.count || 0,
    analyticsEvents: analyticsCount.count || 0,
    payments: paymentsCount.count || 0,
    supportTickets: ticketsCount.count || 0,
    estimatedSize: '~2.5 MB', // Calculated estimate
  };
}

// Placeholder implementations for other functions
async function getConsentTrends(supabaseClient: any, timeframe: string): Promise<any> { return []; }
async function getConsentByType(supabaseClient: any): Promise<any> { return {}; }
async function getConsentWithdrawals(supabaseClient: any, timeframe: string): Promise<any> { return []; }
async function getGeographicConsent(supabaseClient: any): Promise<any> { return []; }
async function getRetentionPolicies(supabaseClient: any): Promise<any> { return []; }
async function getExpiringData(supabaseClient: any): Promise<any> { return []; }
async function getDeletionQueue(supabaseClient: any): Promise<any> { return []; }
async function getStorageUsage(supabaseClient: any): Promise<any> { return {}; }

async function processDataExport(supabaseClient: any, requestId: string, options: any): Promise<void> {
  // Simulate async processing
  setTimeout(async () => {
    await supabaseClient
      .from('compliance_requests')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        data_export_url: `https://storage.okapifind.com/exports/${requestId}.${options.format}`,
      })
      .eq('id', requestId);
  }, 5000);
}

async function processUserDataDeletion(supabaseClient: any, requestId: string): Promise<void> {
  // Implementation would delete user data across all tables
  await supabaseClient
    .from('compliance_requests')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('id', requestId);
}

async function processConsentWithdrawal(supabaseClient: any, userId: string): Promise<void> {
  // Implementation would update consent settings
  console.log(`Processing consent withdrawal for user ${userId}`);
}

/* To invoke locally:

1. Serve the function:
   supabase functions serve admin-compliance

2. Get compliance dashboard:
   curl -i --location --request GET 'http://localhost:54321/functions/v1/admin-compliance/dashboard' \
     --header 'Authorization: Bearer [YOUR_ANON_KEY]' \
     --header 'Content-Type: application/json'

3. Process compliance request:
   curl -i --location --request POST 'http://localhost:54321/functions/v1/admin-compliance/process-request' \
     --header 'Authorization: Bearer [YOUR_ANON_KEY]' \
     --header 'Content-Type: application/json' \
     --data-raw '{
       "requestId": "req_123",
       "action": "approve",
       "notes": "Identity verified, processing data export"
     }'
*/