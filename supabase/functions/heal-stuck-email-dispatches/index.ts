// R-062 — Poller de cron (a cada 5 min, ver migration do cron job) que
// resolve linhas de event_email_campaigns presas em status 'in_progress' —
// gravadas por create-event-email-campaign/create-multi-event-email-campaign
// ANTES de qualquer chamada à E-goi (ver _shared/emailDispatchHistory.ts).
// Uma linha 'in_progress' há mais de HISTORY_IN_PROGRESS_STALE_MS é um sinal
// seguro e inequívoco de que a function correspondente morreu (timeout de
// plataforma, abort de cliente) SEM lançar nenhuma exceção JS — se ela
// tivesse lançado, o próprio catch externo já teria finalizado a linha e
// liberado o claim (R-055/R-057/R-058/R-059). Como a linha só é criada
// ANTES de qualquer contato com a E-goi, é seguro assumir que nenhuma
// campanha real foi criada e marcar como 'failed' + liberar o claim do
// evento (events.email_campaign_dispatched_at).
//
// Proteção contra corrida com um reenvio manual concorrente: usa lock
// otimista (UPDATE ... WHERE id = X AND updated_at = <valor lido>, com
// `count: 'exact'`, nunca `.select()` encadeado — mesma lição do R-059, que
// reaplicar o filtro sobre o RETURNING dá falso-negativo) — só finaliza e
// libera o claim se a linha não mudou entre a leitura e a escrita. Se um
// admin reaproveitou essa mesma linha num reenvio manual nesse meio-tempo,
// o `count` vem 0 e este poller não mexe em nada daquele evento.
//
// Auth: admin autenticado OU x-cron-secret (env CRON_SHARED_SECRET ou
// internal_cron_secrets.heal_stuck_email_dispatches_cron) — mesmo padrão de
// send-scheduled-email-campaigns.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, handleCorsPreFlight } from '../_shared/index.ts';
import { HISTORY_IN_PROGRESS_STALE_MS } from '../_shared/emailDispatchHistory.ts';
import { findEgoiCampaignForDispatch } from '../_shared/egoiCampaignLookup.ts';

const BATCH_LIMIT = 50;

type StuckRow = {
  id: string;
  event_id: string | null;
  updated_at: string;
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

    // Auth: admin OU cron secret (mesmo padrão de send-scheduled-email-campaigns).
    let isCron = !!(cronSecret && envCronSecret && cronSecret === envCronSecret);
    if (!isCron && cronSecret) {
      const { data: row } = await admin
        .from('internal_cron_secrets')
        .select('secret')
        .eq('name', 'heal_stuck_email_dispatches_cron')
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
        _user_id: userData.user.id,
        _role: 'admin',
      });
      if (!isAdmin) return json({ error: 'Apenas admins' }, 403);
    }

    const staleBefore = new Date(Date.now() - HISTORY_IN_PROGRESS_STALE_MS).toISOString();
    const { data: staleRows, error: selectErr } = await admin
      .from('event_email_campaigns')
      .select('id, event_id, updated_at')
      .eq('status', 'in_progress')
      .lt('updated_at', staleBefore)
      .limit(BATCH_LIMIT);
    if (selectErr) throw selectErr;

    const rows = (staleRows ?? []) as StuckRow[];
    if (rows.length === 0) {
      return json({ ok: true, healed: 0, skipped: 0, confirmed: 0, checked: 0 });
    }

    const staleMessage =
      'Disparo não finalizado a tempo (provável interrupção de plataforma) — ' +
      `liberado automaticamente pelo heal-stuck-email-dispatches às ${new Date().toISOString()}. ` +
      'Nenhuma criação na E-goi foi confirmada antes deste ponto.';

    let healed = 0;
    let skipped = 0;
    let confirmed = 0;
    const eventIdsToRelease: string[] = [];

    // Fase 3 — verificação extra na E-goi antes de liberar qualquer reserva.
    // Sem chave configurada não há como perguntar: mantém o comportamento
    // anterior (a linha 'in_progress' só é criada ANTES de qualquer contato
    // com a E-goi, então liberar continua sendo o padrão seguro).
    const egoiApiKey = Deno.env.get('EGOI_API_KEY') ?? null;

    for (const row of rows) {
      if (egoiApiKey) {
        const lookup = await findEgoiCampaignForDispatch(egoiApiKey, row.id);
        if (lookup.result === 'unknown') {
          // Na dúvida NÃO libera — tenta de novo no próximo ciclo do cron.
          console.warn(
            '[heal-stuck-email-dispatches] E-goi indisponível, mantendo reserva:',
            row.id,
            lookup.reason,
          );
          skipped++;
          continue;
        }
        if (lookup.result === 'found') {
          // A campanha existe de verdade na E-goi: a function morreu DEPOIS de
          // criá-la. Finaliza a linha como concluída e NÃO libera o claim do
          // evento (liberar permitiria uma campanha duplicada).
          const egoiStatus = String(lookup.campaign.status ?? '').toLowerCase();
          const finalStatus = egoiStatus === 'sent' ? 'sent' : 'draft';
          const { error: confirmErr } = await admin
            .from('event_email_campaigns')
            .update({
              status: finalStatus,
              egoi_campaign_id: lookup.campaign.campaign_hash ?? null,
              error_message:
                'Disparo interrompido, mas a campanha foi encontrada na E-goi — ' +
                'reserva mantida para evitar campanha duplicada.',
            })
            .eq('id', row.id)
            .eq('updated_at', row.updated_at);
          if (confirmErr) {
            console.error('[heal-stuck-email-dispatches] Falha ao confirmar campanha existente:', row.id, confirmErr);
            continue;
          }
          confirmed++;
          continue;
        }
      }

      // Lock otimista: só finaliza se `updated_at` não mudou desde a leitura
      // acima — se mudou, alguém (um reenvio manual) reaproveitou essa linha
      // nesse meio-tempo, e este poller não deve mexer nela nem no claim do
      // evento correspondente.
      const { error: updateErr, count } = await admin
        .from('event_email_campaigns')
        .update({ status: 'failed', error_message: staleMessage }, { count: 'exact' })
        .eq('id', row.id)
        .eq('updated_at', row.updated_at);
      if (updateErr) {
        console.error('[heal-stuck-email-dispatches] Falha ao finalizar linha presa:', row.id, updateErr);
        continue;
      }
      if (!count) {
        skipped++;
        continue;
      }
      healed++;
      if (row.event_id) eventIdsToRelease.push(row.event_id);
    }

    if (eventIdsToRelease.length > 0) {
      const { error: releaseErr } = await admin
        .from('events')
        .update({ email_campaign_dispatched_at: null })
        .in('id', eventIdsToRelease);
      if (releaseErr) {
        console.error('[heal-stuck-email-dispatches] Falha ao liberar claim dos eventos:', releaseErr);
      }
    }

    return json({ ok: true, healed, skipped, confirmed, checked: rows.length, event_ids: eventIdsToRelease });
  } catch (e) {
    console.error('[heal-stuck-email-dispatches]', e);
    return json({ error: (e as Error).message }, 500);
  }
});
