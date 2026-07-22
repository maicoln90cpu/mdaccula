// Poller de cron (a cada 5 min, ver migration do cron job) que dispara os
// e-mails agendados pela aba "Envio manual" (event_email_campaigns.status =
// 'scheduled' e scheduled_at vencido). A campanha já existe como rascunho na
// E-goi (criada por create-event-email-campaign no momento do agendamento) —
// aqui só chamamos POST .../actions/send, com a MESMA defensividade contra
// falso-positivo de envio usada em create-event-email-campaign (R-004: list_id
// obrigatório no body do send; R-007/R-008: 2xx sozinho não confirma envio,
// é preciso inspecionar o corpo da resposta).
//
// Auth: admin autenticado OU x-cron-secret (env CRON_SHARED_SECRET ou
// internal_cron_secrets.scheduled_email_send_cron) — mesmo padrão de
// weekly-digest-draft.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { sendEgoiCampaign } from '../_shared/egoiClient.ts';
import { corsHeaders, handleCorsPreFlight } from '../_shared/index.ts';

const MAX_ATTEMPTS = 3;
const BATCH_LIMIT = 20;

type ScheduledRow = {
  id: string;
  event_id: string;
  egoi_campaign_id: string | null;
  scheduled_send_attempts: number;
};

Deno.serve(async (req) => {
  const preflight = handleCorsPreFlight(req);
  if (preflight) return preflight;

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    const authHeader = req.headers.get('Authorization');
    const cronSecret = req.headers.get('x-cron-secret');
    const envCronSecret = Deno.env.get('CRON_SHARED_SECRET');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const admin = createClient(supabaseUrl, serviceKey);

    // Auth: admin OU cron secret (mesmo padrão de weekly-digest-draft).
    let isCron = !!(cronSecret && envCronSecret && cronSecret === envCronSecret);
    if (!isCron && cronSecret) {
      const { data: row } = await admin
        .from('internal_cron_secrets')
        .select('secret')
        .eq('name', 'scheduled_email_send_cron')
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

    // Guard 1: Master switch
    const { data: masterRow } = await admin
      .from('site_settings')
      .select('value')
      .eq('key', 'egoi_email_enabled')
      .maybeSingle();
    if (masterRow?.value !== 'true') {
      return json({ ok: true, skipped: true, reason: 'master_off' });
    }

    // Guard 2: Agência config
    const { data: cfg } = await admin
      .from('egoi_config')
      .select('*')
      .maybeSingle();
    if (!cfg || !cfg.is_enabled || !cfg.list_id || !cfg.sender_id) {
      return json({ ok: true, skipped: true, reason: 'config_disabled_or_incomplete' });
    }

    const apiKey = Deno.env.get('EGOI_API_KEY');
    if (!apiKey) {
      return json({ ok: true, skipped: true, reason: 'egoi_api_key_missing' });
    }

    const nowIso = new Date().toISOString();
    const { data: dueRows, error: dueErr } = await admin
      .from('event_email_campaigns')
      .select('id, event_id, egoi_campaign_id, scheduled_send_attempts')
      .eq('status', 'scheduled')
      .is('scheduled_send_claimed_at', null)
      .lte('scheduled_at', nowIso)
      .order('scheduled_at', { ascending: true })
      .limit(BATCH_LIMIT);
    if (dueErr) throw dueErr;

    let sent = 0;
    let retried = 0;
    let failed = 0;

    for (const row of (dueRows ?? []) as ScheduledRow[]) {
      // Claim atômico — evita duas invocações concorrentes disparando o
      // mesmo e-mail duas vezes.
      const { data: claimed } = await admin
        .from('event_email_campaigns')
        .update({
          scheduled_send_claimed_at: nowIso,
          scheduled_send_attempts: row.scheduled_send_attempts + 1,
        })
        .eq('id', row.id)
        .is('scheduled_send_claimed_at', null)
        .select('id, scheduled_send_attempts')
        .maybeSingle();
      if (!claimed) continue; // outra invocação já pegou esta linha

      if (!row.egoi_campaign_id) {
        // Não deveria acontecer — o agendamento só é criado com hash válido.
        await admin
          .from('event_email_campaigns')
          .update({ status: 'failed', error_message: 'Agendamento sem egoi_campaign_id' })
          .eq('id', row.id);
        failed++;
        continue;
      }

      const sendRes = await sendEgoiCampaign(
        row.egoi_campaign_id,
        Number(cfg.list_id),
        apiKey,
        cfg.segment_id ? Number(cfg.segment_id) : null,
      );

      if (sendRes.ok) {
        await admin
          .from('event_email_campaigns')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            error_message: null,
          })
          .eq('id', row.id);
        sent++;
        continue;
      }

      const errorMessage = `E-goi send ${sendRes.status}: ${
        typeof sendRes.body === 'string' ? sendRes.body : JSON.stringify(sendRes.body)
      }`.slice(0, 1000);

      if (claimed.scheduled_send_attempts < MAX_ATTEMPTS) {
        // Libera o claim para tentar de novo no próximo poll.
        await admin
          .from('event_email_campaigns')
          .update({ scheduled_send_claimed_at: null, error_message: errorMessage })
          .eq('id', row.id);
        retried++;
      } else {
        await admin
          .from('event_email_campaigns')
          .update({ status: 'failed', error_message: errorMessage })
          .eq('id', row.id);
        failed++;
      }
    }

    return json({ ok: true, processed: (dueRows ?? []).length, sent, retried, failed });
  } catch (e) {
    console.error('[send-scheduled-email-campaigns]', e);
    return json({ error: (e as Error).message }, 500);
  }
});
