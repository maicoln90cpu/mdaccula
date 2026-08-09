// B.9 — Puxa métricas de uma campanha E-goi e persiste em event_email_campaign_stats.
// Guards: auth admin, master switch ligado, campanha existe e tem egoi_campaign_id.
//
// Endpoint E-goi v3: GET /reports/email/{campaign_hash} (tag "Reports", não
// "Email" — confirmado via SDK oficial, github.com/E-goi/sdk-python,
// egoi_api/paths/__init__.py: REPORTS_EMAIL_CAMPAIGN_HASH = "/reports/email/{campaign_hash}").
// O path usado antes (/campaigns/email/{id}/statistics) não existe na API —
// E-goi respondia 404 em toda tentativa, por isso stats_json nunca era
// gravado pra nenhuma campanha (bug real, achado em conferência ao vivo de
// 2026-08-09 via net.http_post direto na API com timeout maior).
import { createClient } from 'npm:@supabase/supabase-js@2';
import { parseStats } from './parseStats.ts';

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
    const envCronSecret = Deno.env.get('CRON_SHARED_SECRET');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const admin = createClient(supabaseUrl, serviceKey);

    // B.9-extra: valida x-cron-secret contra env OU tabela interna (usada pelo pg_cron)
    let isCron = !!(cronSecret && envCronSecret && cronSecret === envCronSecret);
    if (!isCron && cronSecret && cronJobHeader) {
      const { data: row } = await admin
        .from('internal_cron_secrets')
        .select('secret')
        .eq('name', 'egoi_stats_cron')
        .maybeSingle();
      if (row?.secret && row.secret === cronSecret) isCron = true;
    }

    if (!authHeader && !isCron) return json({ error: 'Não autenticado' }, 401);

    if (!isCron && authHeader) {
      const anonClient = createClient(supabaseUrl, anonKey);
      const token = authHeader.replace('Bearer ', '');
      const { data: userData, error: userErr } = await anonClient.auth.getUser(token);
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

      // Chamadas em lotes de 4 em paralelo — sequencial estourava o timeout
      // do pg_net (5s por padrão) já com 9 campanhas (~17s reais), o que
      // fazia o cron nunca terminar e stats_json nunca ser gravado.
      const CONCURRENCY = 4;
      let ok = 0, fail = 0;
      const rows = campaigns ?? [];
      for (let i = 0; i < rows.length; i += CONCURRENCY) {
        const batch = rows.slice(i, i + CONCURRENCY);
        const results = await Promise.all(
          batch.map((c) => egoiGet(`/reports/email/${encodeURIComponent(c.egoi_campaign_id)}`, apiKey)),
        );
        for (let j = 0; j < batch.length; j++) {
          const res = results[j];
          if (res.ok) {
            const stats = parseStats(res.body);
            await admin.from('event_email_campaign_stats').upsert(
              {
                campaign_id: batch[j].id,
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

    const res = await egoiGet(`/reports/email/${encodeURIComponent(egoiId)}`, apiKey);
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
