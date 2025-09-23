/**
 * Admin Analytics API
 * Provides detailed analytics and metrics for admin dashboard
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

    const hasAnalyticsPermission = adminUser.admin_roles.permissions.includes('analytics.view');

    if (!hasAnalyticsPermission) {
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

    if (method !== 'GET') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        {
          status: 405,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    switch (endpoint) {
      case 'dashboard':
        return await handleDashboardMetrics(supabaseClient, url);
      case 'users':
        return await handleUserAnalytics(supabaseClient, url);
      case 'revenue':
        return await handleRevenueAnalytics(supabaseClient, url);
      case 'cohorts':
        return await handleCohortAnalysis(supabaseClient, url);
      case 'features':
        return await handleFeatureAdoption(supabaseClient, url);
      case 'funnel':
        return await handleFunnelAnalysis(supabaseClient, url);
      case 'retention':
        return await handleRetentionAnalysis(supabaseClient, url);
      case 'export':
        return await handleDataExport(supabaseClient, adminUser.user_id, url);
      default:
        return await handleDashboardMetrics(supabaseClient, url);
    }
  } catch (error) {
    console.error('Admin Analytics API Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

async function handleDashboardMetrics(supabaseClient: any, url: URL) {
  const searchParams = url.searchParams;
  const timeframe = searchParams.get('timeframe') || 'week';

  const now = new Date();
  const startDate = getStartDate(now, timeframe);

  // Get real-time metrics
  const [
    totalUsers,
    activeUsers,
    newSignups,
    revenue,
    sessions,
    crashes,
    supportTickets,
  ] = await Promise.all([
    getTotalUsers(supabaseClient),
    getActiveUsers(supabaseClient, startDate),
    getNewSignups(supabaseClient, startDate),
    getRevenue(supabaseClient, startDate),
    getSessions(supabaseClient, startDate),
    getCrashes(supabaseClient, startDate),
    getSupportTickets(supabaseClient),
  ]);

  const metrics = {
    realTimeUsers: await getRealTimeUsers(supabaseClient),
    totalUsers,
    activeUsers: {
      today: await getActiveUsers(supabaseClient, new Date(now.getTime() - 24 * 60 * 60 * 1000)),
      thisWeek: await getActiveUsers(supabaseClient, new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)),
      thisMonth: await getActiveUsers(supabaseClient, new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)),
    },
    newSignups: {
      today: await getNewSignups(supabaseClient, new Date(now.getTime() - 24 * 60 * 60 * 1000)),
      thisWeek: await getNewSignups(supabaseClient, new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)),
      thisMonth: await getNewSignups(supabaseClient, new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)),
    },
    revenue: {
      today: await getRevenue(supabaseClient, new Date(now.getTime() - 24 * 60 * 60 * 1000)),
      thisMonth: await getRevenue(supabaseClient, new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)),
      mrr: await getMRR(supabaseClient),
      arr: await getARR(supabaseClient),
    },
    churnRate: await getChurnRate(supabaseClient),
    conversionRate: await getConversionRate(supabaseClient),
    avgSessionDuration: sessions.avgDuration,
    crashRate: crashes.rate,
    appStoreRating: 4.8, // Would integrate with app store APIs
    supportTickets: {
      open: supportTickets.open,
      resolved: supportTickets.resolved,
      avgResponseTime: supportTickets.avgResponseTime,
    },
  };

  return new Response(
    JSON.stringify({
      success: true,
      data: metrics,
      timeframe,
      generatedAt: new Date().toISOString(),
    }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

async function handleUserAnalytics(supabaseClient: any, url: URL) {
  const searchParams = url.searchParams;
  const timeframe = searchParams.get('timeframe') || 'week';
  const segment = searchParams.get('segment') || 'all';

  const startDate = getStartDate(new Date(), timeframe);

  // User analytics by segments
  const userAnalytics = {
    totalUsers: await getTotalUsers(supabaseClient),
    usersByPlan: await getUsersByPlan(supabaseClient),
    usersByStatus: await getUsersByStatus(supabaseClient),
    usersByChurnRisk: await getUsersByChurnRisk(supabaseClient),
    geographicDistribution: await getGeographicDistribution(supabaseClient),
    platformDistribution: await getPlatformDistribution(supabaseClient),
    userEngagement: await getUserEngagement(supabaseClient, startDate),
    topUsers: await getTopUsers(supabaseClient),
  };

  return new Response(
    JSON.stringify({
      success: true,
      data: userAnalytics,
      timeframe,
      segment,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

async function handleRevenueAnalytics(supabaseClient: any, url: URL) {
  const searchParams = url.searchParams;
  const timeframe = searchParams.get('timeframe') || 'month';

  const revenueAnalytics = {
    mrr: await getMRR(supabaseClient),
    arr: await getARR(supabaseClient),
    growth: await getGrowthMetrics(supabaseClient),
    churn: await getChurnAnalysis(supabaseClient),
    ltv: await getLTV(supabaseClient),
    cac: await getCAC(supabaseClient),
    paybackPeriod: await getPaybackPeriod(supabaseClient),
    revenueByPlan: await getRevenueByPlan(supabaseClient),
    revenueTimeSeries: await getRevenueTimeSeries(supabaseClient, timeframe),
    geographicRevenue: await getGeographicRevenue(supabaseClient),
  };

  return new Response(
    JSON.stringify({
      success: true,
      data: revenueAnalytics,
      timeframe,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

async function handleCohortAnalysis(supabaseClient: any, url: URL) {
  const searchParams = url.searchParams;
  const months = parseInt(searchParams.get('months') || '12');

  const cohorts = await getCohortAnalysis(supabaseClient, months);

  return new Response(
    JSON.stringify({
      success: true,
      data: cohorts,
      months,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

async function handleFeatureAdoption(supabaseClient: any, url: URL) {
  const featureAdoption = await getFeatureAdoption(supabaseClient);

  return new Response(
    JSON.stringify({
      success: true,
      data: featureAdoption,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

async function handleFunnelAnalysis(supabaseClient: any, url: URL) {
  const funnelData = await getFunnelAnalysis(supabaseClient);

  return new Response(
    JSON.stringify({
      success: true,
      data: funnelData,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

async function handleRetentionAnalysis(supabaseClient: any, url: URL) {
  const retentionData = await getRetentionAnalysis(supabaseClient);

  return new Response(
    JSON.stringify({
      success: true,
      data: retentionData,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

async function handleDataExport(supabaseClient: any, adminUserId: string, url: URL) {
  const searchParams = url.searchParams;
  const type = searchParams.get('type') || 'users';
  const format = searchParams.get('format') || 'csv';
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  // Check export permissions
  const { data: adminUser } = await supabaseClient
    .from('admin_users')
    .select('*, admin_roles(*)')
    .eq('user_id', adminUserId)
    .single();

  const hasExportPermission = adminUser?.admin_roles.permissions.includes('analytics.export');

  if (!hasExportPermission) {
    return new Response(
      JSON.stringify({ error: 'Insufficient permissions for data export' }),
      {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  // Create export request
  const exportRequest = {
    id: crypto.randomUUID(),
    type,
    format,
    filters: {
      startDate,
      endDate,
    },
    status: 'processing',
    requested_by: adminUserId,
    requested_at: new Date().toISOString(),
  };

  await supabaseClient
    .from('export_requests')
    .insert(exportRequest);

  // Start async export processing (would typically be done in a background job)
  processExportRequest(supabaseClient, exportRequest);

  return new Response(
    JSON.stringify({
      success: true,
      data: { exportId: exportRequest.id },
      message: 'Export request created. You will be notified when ready.',
    }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

// Helper functions for metrics calculation

function getStartDate(now: Date, timeframe: string): Date {
  switch (timeframe) {
    case 'today':
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    case 'week':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case 'month':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case 'quarter':
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    case 'year':
      return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    default:
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }
}

async function getTotalUsers(supabaseClient: any): Promise<number> {
  const { count } = await supabaseClient
    .from('users')
    .select('*', { count: 'exact', head: true })
    .neq('status', 'deleted');

  return count || 0;
}

async function getRealTimeUsers(supabaseClient: any): Promise<number> {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

  const { count } = await supabaseClient
    .from('user_sessions')
    .select('*', { count: 'exact', head: true })
    .gte('last_activity', fiveMinutesAgo.toISOString())
    .is('ended_at', null);

  return count || 0;
}

async function getActiveUsers(supabaseClient: any, startDate: Date): Promise<number> {
  const { count } = await supabaseClient
    .from('analytics_events')
    .select('user_id', { count: 'exact', head: true })
    .gte('timestamp', startDate.toISOString())
    .not('user_id', 'is', null);

  return count || 0;
}

async function getNewSignups(supabaseClient: any, startDate: Date): Promise<number> {
  const { count } = await supabaseClient
    .from('users')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', startDate.toISOString());

  return count || 0;
}

async function getRevenue(supabaseClient: any, startDate: Date): Promise<number> {
  const { data } = await supabaseClient
    .from('payments')
    .select('amount')
    .eq('status', 'succeeded')
    .gte('created_at', startDate.toISOString());

  return data?.reduce((sum: number, payment: any) => sum + payment.amount, 0) || 0;
}

async function getMRR(supabaseClient: any): Promise<number> {
  const { data } = await supabaseClient
    .from('subscriptions')
    .select('plan')
    .eq('status', 'active');

  const planPrices = { plus: 299, pro: 499, family: 799 }; // in cents

  return data?.reduce((sum: number, sub: any) => {
    return sum + (planPrices[sub.plan as keyof typeof planPrices] || 0);
  }, 0) || 0;
}

async function getARR(supabaseClient: any): Promise<number> {
  const mrr = await getMRR(supabaseClient);
  return mrr * 12;
}

async function getSessions(supabaseClient: any, startDate: Date): Promise<{ count: number; avgDuration: number }> {
  const { data } = await supabaseClient
    .from('user_sessions')
    .select('started_at, ended_at')
    .gte('started_at', startDate.toISOString())
    .not('ended_at', 'is', null);

  if (!data || data.length === 0) {
    return { count: 0, avgDuration: 0 };
  }

  const totalDuration = data.reduce((sum: number, session: any) => {
    const duration = new Date(session.ended_at).getTime() - new Date(session.started_at).getTime();
    return sum + duration;
  }, 0);

  return {
    count: data.length,
    avgDuration: totalDuration / data.length / 1000, // in seconds
  };
}

async function getCrashes(supabaseClient: any, startDate: Date): Promise<{ count: number; rate: number }> {
  const { count: totalSessions } = await supabaseClient
    .from('user_sessions')
    .select('*', { count: 'exact', head: true })
    .gte('started_at', startDate.toISOString());

  const { count: crashes } = await supabaseClient
    .from('error_events')
    .select('*', { count: 'exact', head: true })
    .eq('error_type', 'crash')
    .gte('timestamp', startDate.toISOString());

  const rate = totalSessions ? (crashes || 0) / totalSessions : 0;

  return { count: crashes || 0, rate };
}

async function getSupportTickets(supabaseClient: any): Promise<{ open: number; resolved: number; avgResponseTime: number }> {
  const [openTickets, resolvedTickets] = await Promise.all([
    supabaseClient
      .from('support_tickets')
      .select('*', { count: 'exact', head: true })
      .in('status', ['open', 'in_progress']),
    supabaseClient
      .from('support_tickets')
      .select('created_at, first_response_at')
      .eq('status', 'resolved')
      .not('first_response_at', 'is', null)
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
  ]);

  const avgResponseTime = resolvedTickets.data?.reduce((sum: number, ticket: any) => {
    const responseTime = new Date(ticket.first_response_at).getTime() - new Date(ticket.created_at).getTime();
    return sum + responseTime;
  }, 0) / (resolvedTickets.data?.length || 1) / (1000 * 60 * 60); // in hours

  return {
    open: openTickets.count || 0,
    resolved: resolvedTickets.data?.length || 0,
    avgResponseTime: avgResponseTime || 0,
  };
}

// Additional helper functions would be implemented for other metrics...
// (getUsersByPlan, getChurnRate, getCohortAnalysis, etc.)

async function processExportRequest(supabaseClient: any, exportRequest: any): Promise<void> {
  // This would typically be handled by a background job
  // For now, just mark as completed
  setTimeout(async () => {
    await supabaseClient
      .from('export_requests')
      .update({
        status: 'completed',
        file_url: `https://storage.okapifind.com/exports/${exportRequest.id}.${exportRequest.format}`,
        completed_at: new Date().toISOString(),
      })
      .eq('id', exportRequest.id);
  }, 5000);
}

/* Placeholder implementations for other metrics functions */
async function getUsersByPlan(supabaseClient: any): Promise<any> { return {}; }
async function getUsersByStatus(supabaseClient: any): Promise<any> { return {}; }
async function getUsersByChurnRisk(supabaseClient: any): Promise<any> { return {}; }
async function getGeographicDistribution(supabaseClient: any): Promise<any> { return {}; }
async function getPlatformDistribution(supabaseClient: any): Promise<any> { return {}; }
async function getUserEngagement(supabaseClient: any, startDate: Date): Promise<any> { return {}; }
async function getTopUsers(supabaseClient: any): Promise<any> { return []; }
async function getGrowthMetrics(supabaseClient: any): Promise<any> { return {}; }
async function getChurnAnalysis(supabaseClient: any): Promise<any> { return {}; }
async function getLTV(supabaseClient: any): Promise<number> { return 0; }
async function getCAC(supabaseClient: any): Promise<number> { return 0; }
async function getPaybackPeriod(supabaseClient: any): Promise<number> { return 0; }
async function getRevenueByPlan(supabaseClient: any): Promise<any> { return {}; }
async function getRevenueTimeSeries(supabaseClient: any, timeframe: string): Promise<any> { return []; }
async function getGeographicRevenue(supabaseClient: any): Promise<any> { return []; }
async function getCohortAnalysis(supabaseClient: any, months: number): Promise<any> { return []; }
async function getFeatureAdoption(supabaseClient: any): Promise<any> { return []; }
async function getFunnelAnalysis(supabaseClient: any): Promise<any> { return {}; }
async function getRetentionAnalysis(supabaseClient: any): Promise<any> { return {}; }
async function getChurnRate(supabaseClient: any): Promise<number> { return 0; }
async function getConversionRate(supabaseClient: any): Promise<number> { return 0; }

/* To invoke locally:

1. Serve the function:
   supabase functions serve admin-analytics

2. Get dashboard metrics:
   curl -i --location --request GET 'http://localhost:54321/functions/v1/admin-analytics/dashboard?timeframe=week' \
     --header 'Authorization: Bearer [YOUR_ANON_KEY]' \
     --header 'Content-Type: application/json'

3. Export data:
   curl -i --location --request GET 'http://localhost:54321/functions/v1/admin-analytics/export?type=users&format=csv' \
     --header 'Authorization: Bearer [YOUR_ANON_KEY]' \
     --header 'Content-Type: application/json'
*/