// B.9 — Puxa métricas de uma campanha E-goi e persiste em event_email_campaign_stats.
// Guards: auth admin, master switch ligado, campanha existe e tem egoi_campaign_id.
// Endpoint E-goi v3: GET /campaigns/email/{campaign_id}/statistics
//   https://developers.e-goi.com/api/v3/#tag/Email/operation/getEmailCampaignStatistics
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BASE = 'https://api.egoiapp.com';

async function egoiGet(path: string, apiKey: string) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Apikey: apiKey, Accept: 'application/json' },
  });
  const text = await res.text();
  let body: any = text;
  try { body = JSON.parse(text); } catch { /* keep raw */ }
  return { status: res.status, ok: res.ok, body };
}

/**
 * Normaliza a resposta da E-goi em um shape estável.
 * A API v3 costuma retornar campos como total, opens, unique_opens, clicks,
 * unique_clicks, bounces, unsubscribed, complaints. Fazemos best-effort com fallbacks.
 */
function parseStats(raw: any) {
  const src = raw?.data ?? raw ?? {};
  const num = (v: any) => (typeof v === 'number' ? v : Number(v ?? 0) || 0);

  const sent = num(src.total ?? src.sent ?? src.sends ?? src.delivered_total);
  const delivered = num(src.delivered ?? src.total_delivered ?? sent);
  const opens_unique = num(src.unique_opens ?? src.opens_unique ?? src.opens?.unique);
  const opens_total = num(src.opens ?? src.opens?.total ?? opens_unique);
  const clicks_unique = num(src.unique_clicks ?? src.clicks_unique ?? src.clicks?.unique);
  const clicks_total = num(src.clicks ?? src.clicks?.total ?? clicks_unique);
  const bounces = num(src.bounces ?? src.bounced ?? src.total_bounces);
  const unsubscribes = num(src.unsubscribed ?? src.unsubscribes ?? src.total_unsubscribes);
  const complaints = num(src.complaints ?? src.spam ?? 0);

  const base = delivered || sent || 0;
  const open_rate = base > 0 ? +(opens_unique / base * 100).toFixed(2) : 0;
  const click_rate = base > 0 ? +(clicks_unique / base * 100).toFixed(2) : 0;

  return {
    sent,
    delivered,
    opens_unique,
    opens_total,
    clicks_unique,
    clicks_total,
    bounces,
    unsubscribes,
    complaints,
    open_rate,
    click_rate,
    raw: src,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    const authHeader = req.headers.get('Authorization');
    const cronSecret = req.headers.get('x-cron-secret');
    const cronJobHeader = req.headers.get('x-cron-job');
    const expectedCron = Deno.env.get('CRON_SHARED_SECRET');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // B.9-extra: cron via pg_net usa Authorization: Bearer <service_role_key> + x-cron-job header
    const bearerToken = authHeader?.replace('Bearer ', '').trim();
    const isCronBySecret = !!(cronSecret && expectedCron && cronSecret === expectedCron);
    const isCronByServiceRole = !!(bearerToken && bearerToken === serviceKey && cronJobHeader);
    const isCron = isCronBySecret || isCronByServiceRole;

    if (!authHeader && !isCron) return json({ error: 'Não autenticado' }, 401);

    const admin = createClient(supabaseUrl, serviceKey);

    if (!isCron && authHeader) {
      const anonClient = createClient(supabaseUrl, anonKey);
      const { data: userData, error: userErr } = await anonClient.auth.getUser(bearerToken!);
      if (userErr || !userData.user) return json({ error: 'Token inválido' }, 401);
      const { data: isAdmin } = await admin.rpc('has_role', {
        _user_id: userData.user.id, _role: 'admin',
      });
      if (!isAdmin) return json({ error: 'Apenas admins' }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const campaignId = body?.campaign_id as string | undefined; // event_email_campaigns.id
    const egoiOverride = body?.egoi_campaign_id as string | undefined;
    const syncAll = body?.sync_all === true;

    const apiKey = Deno.env.get('EGOI_API_KEY');
    if (!apiKey) return json({ error: 'EGOI_API_KEY não configurada' }, 500);

    // Guard master switch
    const { data: masterRow } = await admin
      .from('site_settings')
      .select('value')
      .eq('key', 'egoi_email_enabled')
      .maybeSingle();
    if (masterRow?.value !== 'true') {
      return json({ skipped: true, reason: 'master_off' });
    }

    // Modo 1: sync_all (usado pelo cron) — busca campanhas sent nos últimos 30 dias
    if (syncAll) {
      const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
      const { data: campaigns } = await admin
        .from('event_email_campaigns')
        .select('id, egoi_campaign_id, status, sent_at')
        .eq('status', 'sent')
        .not('egoi_campaign_id', 'is', null)
        .gte('sent_at', since);

      let ok = 0, fail = 0;
      for (const c of campaigns ?? []) {
        const res = await egoiGet(`/campaigns/email/${encodeURIComponent(c.egoi_campaign_id)}/statistics`, apiKey);
        if (res.ok) {
          const stats = parseStats(res.body);
          await admin.from('event_email_campaign_stats').upsert(
            {
              campaign_id: c.id,
              stats_json: stats,
              fetched_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'campaign_id' },
          );
          ok++;
        } else {
          fail++;
        }
      }
      return json({ ok: true, synced: ok, failed: fail, total: campaigns?.length ?? 0 });
    }

    // Modo 2: fetch de uma campanha específica
    if (!campaignId) return json({ error: 'campaign_id é obrigatório' }, 400);

    const { data: campaign } = await admin
      .from('event_email_campaigns')
      .select('id, egoi_campaign_id')
      .eq('id', campaignId)
      .maybeSingle();

    if (!campaign) return json({ error: 'Campanha não encontrada' }, 404);
    const egoiId = egoiOverride || campaign.egoi_campaign_id;
    if (!egoiId) return json({ error: 'egoi_campaign_id ausente' }, 400);

    const res = await egoiGet(`/campaigns/email/${encodeURIComponent(egoiId)}/statistics`, apiKey);
    if (!res.ok) {
      return json({
        error: `E-goi ${res.status}`,
        detail: typeof res.body === 'string' ? res.body : JSON.stringify(res.body),
      }, 502);
    }

    const stats = parseStats(res.body);
    await admin.from('event_email_campaign_stats').upsert(
      {
        campaign_id: campaign.id,
        stats_json: stats,
        fetched_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'campaign_id' },
    );

    return json({ ok: true, campaign_id: campaign.id, stats });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
