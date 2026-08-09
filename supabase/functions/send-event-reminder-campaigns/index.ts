// Item 5 da melhoria de disparo de e-mail — automação "Lembrete de evento":
// dispara (ou deixa em rascunho) o e-mail de cada evento ativo e
// não-recorrente que cai exatamente X dias à frente da data de hoje (BRT).
// Poller horário (ver migration do cron) — granularidade é de dia, então a
// function decide sozinha se é a hora configurada antes de fazer qualquer
// trabalho.
//
// Dedup/retry: usa event_email_campaigns com campaign_type='event_reminder'
// como chave — se já existe uma linha 'draft'/'sent' pro evento, não
// dispara de novo; cada linha 'failed' conta como 1 tentativa, até
// MAX_ATTEMPTS. Isso também alimenta a aba Histórico e controle (item 4 da
// mesma melhoria) automaticamente, sem trabalho extra.
//
// Guards:
//   1. Auth admin OU x-cron-secret (env CRON_SHARED_SECRET ou
//      internal_cron_secrets.event_reminder_cron).
//   2. site_settings.egoi_email_enabled = true (master switch — nunca
//      pulado, nem com force).
//   3. site_settings.event_reminder_enabled = true (admin pode forçar via
//      force=true no body).
//   4. Só roda na hora configurada (site_settings.event_reminder_hour) em
//      chamadas de cron — force=true ou chamada manual pulam essa checagem.
//   5. egoi_config habilitado + list_id + sender_id.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, handleCorsPreFlight } from '../_shared/index.ts';
import { safeCacheStaticMapImagesInHtml } from '../_shared/renderStaticMapCache.ts';
import {
  expandGlobalRefs,
  renderBlockedTemplateText,
  type Block,
  type EmailTemplateSettings,
} from '../_shared/emailBlocks.ts';
import { buildEventAnnouncementData, composeEmail, type EmailEventRow } from '../_shared/emailComposer.ts';
import { sendEgoiCampaign } from '../_shared/egoiClient.ts';
import { writeDigestCampaignHistory } from '../_shared/digestCampaignHistory.ts';
import { filterPendingReminderEvents, type ExistingCampaignRow } from './pendingEventsFilter.ts';

const BASE = 'https://api.egoiapp.com';
const SITE_URL = 'https://mdaccula.com';
// Templates de lembrete de evento único nunca devem renderizar blocos de
// digest/agenda multi-evento — mesmo filtro de dispatchEventDraft.ts.
const EVENT_ONLY_BLOCK_KINDS = ['weekend_grid', 'weekly_hero', 'blog_posts_list', 'dedge_block'];

async function egoiRequest(path: string, apiKey: string, init: RequestInit = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Apikey: apiKey,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  // deno-lint-ignore no-explicit-any
  let body: any = text;
  try { body = JSON.parse(text); } catch { /* keep raw */ }
  return { status: res.status, ok: res.ok, body };
}

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
        .eq('name', 'event_reminder_cron')
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
    const force = body?.force === true;
    // dry_run: mesmo padrão de weekly-digest-draft/weekend-agenda-draft/
    // blog-digest-draft — renderiza o e-mail de um evento-alvo elegível SEM
    // criar campanha na E-goi nem gravar em event_email_campaigns. Usado
    // pelo botão "Enviar teste agora" (item 5 da melhoria: esta automação
    // era a única sem essa opção, por gerar N campanhas por execução em
    // vez de 1 — o dry_run aqui só usa o primeiro evento-alvo como amostra).
    const dryRun = body?.dry_run === true;
    const templateIdOverride = (body?.template_id as string | undefined) || undefined;

    // Guard 1: master switch (nunca pulado, nem com force).
    const { data: masterRow } = await admin
      .from('site_settings').select('value').eq('key', 'egoi_email_enabled').maybeSingle();
    if (masterRow?.value !== 'true') {
      return json({ skipped: true, reason: 'master_off' });
    }

    // Guard 2: automação habilitada (force ignora, pra admin testar).
    const { data: settingsRows } = await admin
      .from('site_settings')
      .select('key,value')
      .in('key', [
        'event_reminder_enabled',
        'event_reminder_days_before',
        'event_reminder_hour',
        'event_reminder_template_id',
        'event_reminder_send_on_cron',
      ]);
    const settingsMap: Record<string, string> = {};
    // deno-lint-ignore no-explicit-any
    (settingsRows ?? []).forEach((r: any) => { settingsMap[r.key] = r.value ?? ''; });

    const enabled = settingsMap.event_reminder_enabled === 'true';
    if (!enabled && !force) return json({ skipped: true, reason: 'reminder_disabled' });

    const daysBefore = Math.max(1, Math.min(30, parseInt(settingsMap.event_reminder_days_before || '3', 10) || 3));
    const configuredHour = Math.max(0, Math.min(23, parseInt(settingsMap.event_reminder_hour || '10', 10) || 10));
    const sendOnCron = settingsMap.event_reminder_send_on_cron === 'true';

    // Guard 3: só roda na hora configurada em chamadas de cron; force ou
    // chamada manual do admin pulam essa checagem.
    const now = new Date();
    const brtNow = new Date(now.getTime() - 3 * 60 * 60 * 1000);
    const brtHour = brtNow.getUTCHours();
    if (isCron && !force && brtHour !== configuredHour) {
      return json({
        skipped: true,
        reason: 'not_configured_hour',
        brt_hour: brtHour,
        configured_hour: configuredHour,
      });
    }

    // Guard 4: egoi_config
    // deno-lint-ignore no-explicit-any
    const { data: cfg } = await admin.from('egoi_config').select('*').maybeSingle() as { data: any };
    if (!cfg || !cfg.is_enabled || !cfg.list_id || !cfg.sender_id) {
      return json({ skipped: true, reason: 'config_disabled_or_incomplete' });
    }
    const apiKey = Deno.env.get('EGOI_API_KEY');
    if (!apiKey) return json({ error: 'EGOI_API_KEY não configurada' }, 500);
    const segmentId = cfg.segment_id != null ? Number(cfg.segment_id) : null;

    // Data-alvo: hoje (BRT) + N dias.
    const targetDate = new Date(brtNow);
    targetDate.setUTCDate(targetDate.getUTCDate() + daysBefore);
    const targetDateIso = targetDate.toISOString().slice(0, 10);

    const { data: eventRows } = await admin
      .from('events')
      .select(
        'id,title,subtitle,slug,date,time,venue,location_city,location_state,image_url,description,ticket_link,vip_link,cta_type,lineup,latitude,longitude,venue_lat,venue_lng,pix_button_enabled'
      )
      .eq('status', 'active')
      .eq('date', targetDateIso)
      .is('recurring_event_config_id', null)
      .limit(50);

    const candidates = (eventRows ?? []) as EmailEventRow[];
    if (candidates.length === 0) {
      return json({ ok: true, skipped: true, reason: 'no_events_on_target_date', target_date: targetDateIso });
    }

    // Dedup/retry: conta quantas linhas 'failed' já existem por evento (cada
    // uma é uma tentativa já feita) e pula quem já tem 'sent'/'draft'. Não
    // se aplica ao dry_run — a amostra é só pra preview, não conta como
    // tentativa real.
    let pending = candidates;
    if (!dryRun) {
      const { data: existingRows } = await admin
        .from('event_email_campaigns')
        .select('event_id,status')
        .eq('campaign_type', 'event_reminder')
        .in('event_id', candidates.map((e) => e.id));
      pending = filterPendingReminderEvents(
        candidates,
        (existingRows ?? []) as ExistingCampaignRow[],
      );

      if (pending.length === 0) {
        return json({
          ok: true,
          skipped: true,
          reason: 'all_already_processed',
          target_date: targetDateIso,
          candidates: candidates.length,
        });
      }
    }

    // Template + settings + globais — carregados 1x, reaproveitados pra
    // todos os eventos deste run (mesma config vale pro batch inteiro).
    const overrideTemplateId = templateIdOverride || settingsMap.event_reminder_template_id || null;
    // deno-lint-ignore no-explicit-any
    let tplQuery = (admin.from as any)('email_templates')
      .select('id,name,type,blocks,is_default,subject_template,preheader_template');
    tplQuery = overrideTemplateId
      ? tplQuery.eq('id', overrideTemplateId)
      : tplQuery
          .eq('type', 'event_reminder')
          .order('is_default', { ascending: false })
          .order('updated_at', { ascending: false })
          .limit(1);

    const [{ data: activeTpl }, { data: tplSettings }, { data: globalBlocksRows }] = await Promise.all([
      tplQuery.maybeSingle(),
      admin.from('email_template_settings').select('*').maybeSingle(),
      // deno-lint-ignore no-explicit-any
      (admin.from as any)('email_global_blocks').select('id, name, description, category, block'),
    ]);
    if (!activeTpl) {
      return json({ ok: false, error: 'Nenhum template do tipo "Lembrete de evento" encontrado' }, 400);
    }
    // deno-lint-ignore no-explicit-any
    const globalsMap = new Map<string, any>();
    // deno-lint-ignore no-explicit-any
    for (const g of ((globalBlocksRows ?? []) as any[])) globalsMap.set(g.id, g);
    const settings = (tplSettings ?? {}) as EmailTemplateSettings;

    // deno-lint-ignore no-explicit-any
    const rawBlocks = Array.isArray((activeTpl as any).blocks) ? ((activeTpl as any).blocks as Block[]) : [];
    const resolvedBlocks = (expandGlobalRefs(rawBlocks, globalsMap) as Block[]).filter(
      (b) => !EVENT_ONLY_BLOCK_KINDS.includes((b as { kind: string }).kind)
    );

    if (dryRun) {
      // Renderiza só o primeiro evento-alvo como amostra — não cria nada
      // na E-goi nem grava em event_email_campaigns.
      const sampleEvent = pending[0];
      const eventData = buildEventAnnouncementData(sampleEvent, { baseUrl: SITE_URL });
      const composition = composeEmail({
        template: {
          blocks: resolvedBlocks,
          // deno-lint-ignore no-explicit-any
          subject_template: (activeTpl as any).subject_template,
          // deno-lint-ignore no-explicit-any
          preheader_template: (activeTpl as any).preheader_template,
        },
        event: eventData,
        settings,
        globals: globalsMap,
      });
      const html = await safeCacheStaticMapImagesInHtml(composition.html, 'send-event-reminder-campaigns');
      return json({
        ok: true,
        html,
        subject: composition.subject,
        preheader: composition.preheader,
        // deno-lint-ignore no-explicit-any
        template_name: (activeTpl as any).name ?? null,
        target_date: targetDateIso,
        sample_event_id: sampleEvent.id,
      });
    }

    let sent = 0;
    let drafted = 0;
    let failed = 0;
    const results: Array<{ event_id: string; status: string; error?: string }> = [];

    for (const eventRow of pending) {
      try {
        const eventData = buildEventAnnouncementData(eventRow, { baseUrl: SITE_URL });
        const composition = composeEmail({
          template: {
            blocks: resolvedBlocks,
            // deno-lint-ignore no-explicit-any
            subject_template: (activeTpl as any).subject_template,
            // deno-lint-ignore no-explicit-any
            preheader_template: (activeTpl as any).preheader_template,
          },
          event: eventData,
          settings,
          globals: globalsMap,
        });

        if (composition.issues.length > 0) {
          const msg = composition.issues.map((i) => i.message).join(' ').slice(0, 1000);
          await writeDigestCampaignHistory(admin, [eventRow.id], {
            campaignHash: null,
            status: 'failed',
            mode: 'draft',
            errorMessage: msg,
            sentAt: null,
            campaignType: 'event_reminder',
            segmentId: null,
          });
          failed++;
          results.push({ event_id: eventRow.id, status: 'failed', error: msg });
          continue;
        }

        const html = await safeCacheStaticMapImagesInHtml(composition.html, 'send-event-reminder-campaigns');
        let textVersion = '';
        try {
          textVersion = renderBlockedTemplateText(resolvedBlocks, eventData, settings, null, {
            globals: globalsMap,
            preheader: composition.preheader,
          });
        } catch (e) {
          console.warn('[send-event-reminder-campaigns] text gen failed:', e);
        }

        const createPayload: Record<string, unknown> = {
          list_id: Number(cfg.list_id),
          internal_name: `MDAccula • Lembrete de evento • ${eventRow.title} • ${targetDateIso}`,
          subject: composition.subject,
          sender_id: Number(cfg.sender_id),
          content: {
            type: 'html',
            body: html,
            ...(composition.preheader ? { preheader: composition.preheader } : {}),
            ...(textVersion ? { text: textVersion } : {}),
          },
          tags: ['mdaccula', 'lembrete-evento'],
        };
        if (cfg.reply_to) createPayload.reply_to = Number(cfg.reply_to);

        const created = await egoiRequest('/campaigns/email', apiKey, {
          method: 'POST',
          body: JSON.stringify(createPayload),
        });

        if (!created.ok) {
          const detail = typeof created.body === 'string' ? created.body : JSON.stringify(created.body);
          await writeDigestCampaignHistory(admin, [eventRow.id], {
            campaignHash: null,
            status: 'failed',
            mode: sendOnCron ? 'immediate' : 'draft',
            errorMessage: `E-goi ${created.status}: ${detail}`.slice(0, 1000),
            sentAt: null,
            campaignType: 'event_reminder',
            segmentId: null,
          });
          failed++;
          results.push({ event_id: eventRow.id, status: 'failed', error: detail });
          continue;
        }

        const campaignHash =
          created.body?.campaign_hash ||
          created.body?.hash ||
          created.body?.data?.campaign_hash ||
          (created.body?.campaign_id != null ? String(created.body.campaign_id) : null) ||
          (created.body?.id != null ? String(created.body.id) : null);

        let status: 'draft' | 'sent' = 'draft';
        if (sendOnCron && campaignHash) {
          const sendRes = await sendEgoiCampaign(campaignHash, Number(cfg.list_id), apiKey, segmentId);
          if (sendRes.ok) {
            status = 'sent';
          } else {
            const detail = typeof sendRes.body === 'string' ? sendRes.body : JSON.stringify(sendRes.body);
            await writeDigestCampaignHistory(admin, [eventRow.id], {
              campaignHash,
              status: 'draft',
              mode: 'immediate',
              errorMessage: `E-goi send ${sendRes.status}: ${detail}`.slice(0, 1000),
              sentAt: null,
              campaignType: 'event_reminder',
              segmentId,
            });
            failed++;
            results.push({ event_id: eventRow.id, status: 'failed', error: detail });
            continue;
          }
        }

        await writeDigestCampaignHistory(admin, [eventRow.id], {
          campaignHash,
          status,
          mode: sendOnCron ? 'immediate' : 'draft',
          errorMessage: null,
          sentAt: status === 'sent' ? new Date().toISOString() : null,
          campaignType: 'event_reminder',
          segmentId,
        });
        if (status === 'sent') sent++; else drafted++;
        results.push({ event_id: eventRow.id, status });
      } catch (e) {
        failed++;
        results.push({ event_id: eventRow.id, status: 'failed', error: (e as Error).message });
      }
    }

    return json({
      ok: true,
      target_date: targetDateIso,
      days_before: daysBefore,
      candidates: candidates.length,
      processed: pending.length,
      sent,
      drafted,
      failed,
      results,
    });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
