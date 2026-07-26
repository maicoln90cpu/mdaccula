// B.11 — Weekly digest: monta rascunho na E-goi com agenda dos próximos 7 dias
// + últimos posts do blog e retorna o hash da campanha.
//
// Guards (defesa em profundidade):
//   1. Auth admin OU x-cron-secret (env CRON_SHARED_SECRET ou internal_cron_secrets.weekly_digest_cron).
//   2. Master switch site_settings.egoi_email_enabled = true.
//   3. site_settings.weekly_digest_enabled = true (só para chamadas cron; admin pode forçar via force=true).
//   4. egoi_config habilitado + list_id + sender_id.
//
// Modo padrão: cria rascunho (não envia). Admin pode enviar depois via aba Histórico da E-goi.

import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  renderBlockedTemplateText,
  expandGlobalRefs,
  type Block,
  type EventAnnouncementData,
  type EmailTemplateSettings,
} from '../_shared/emailBlocks.ts';
import { composeEmail } from '../_shared/emailComposer.ts';
import { buildEmailMeta, injectEmailPreheader } from '../_shared/emailMeta.ts';
import { sendEgoiCampaign } from '../_shared/egoiClient.ts';
// Extraído na Onda 29 para manter este arquivo abaixo de 600 linhas.
// Comportamento preservado 1:1 — se editar renderização, replicar teste em
// src/__tests__/contracts/frontend-edge-render-parity.test.ts.
import {
  formatDatePt,
  renderDigestHtml,
  type BrandSettings,
  type EventRow,
  type PostRow,
} from '../_shared/weeklyDigestDraft/legacyHtml.ts';
import { buildEventPayload } from '../_shared/weeklyDigestDraft/buildEventPayload.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret, x-cron-job',
};

const BASE = 'https://api.egoiapp.com';

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
  let body: any = text;
  try { body = JSON.parse(text); } catch { /* keep raw */ }
  return { status: res.status, ok: res.ok, body };
}

function hasAnyBlockKind(blocks: Block[] | null, kinds: string[]): boolean {
  if (!blocks?.length) return false;
  return blocks.some((b) => kinds.includes((b as any).kind));
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

    // Auth: admin OR cron secret
    let isCron = !!(cronSecret && envCronSecret && cronSecret === envCronSecret);
    if (!isCron && cronSecret && cronJobHeader) {
      const { data: row } = await admin
        .from('internal_cron_secrets')
        .select('secret')
        .eq('name', 'weekly_digest_cron')
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
    const dryRun = body?.dry_run === true;
    const overrideTemplateId: string | null = typeof body?.template_id === 'string' && body.template_id ? body.template_id : null;
    const range: 'week' | 'weekend' = body?.range === 'weekend' ? 'weekend' : 'week';

    // Guard 1: master switch
    const { data: masterRow } = await admin
      .from('site_settings').select('value').eq('key', 'egoi_email_enabled').maybeSingle();
    if (masterRow?.value !== 'true') {
      return json({ skipped: true, reason: 'master_off' });
    }

    // Guard 2: digest habilitado (cron sempre respeita; admin pode forçar)
    const { data: digestRow } = await admin
      .from('site_settings').select('value').eq('key', 'weekly_digest_enabled').maybeSingle();
    const digestEnabled = digestRow?.value === 'true';
    if (isCron && !digestEnabled) {
      return json({ skipped: true, reason: 'digest_disabled' });
    }
    if (!isCron && !digestEnabled && !force) {
      return json({ skipped: true, reason: 'digest_disabled' });
    }

    // Guard 2b: disparo automático no cron (padrão = rascunho)
    const { data: sendOnCronRow } = await admin
      .from('site_settings').select('value').eq('key', 'weekly_digest_send_on_cron').maybeSingle();
    const sendOnCron = isCron && sendOnCronRow?.value === 'true';

    // Guard 3: egoi_config (só necessário quando vai enviar de fato)
    let cfg: any = null;
    let apiKey: string | undefined;
    if (!dryRun) {
      const { data } = await admin.from('egoi_config').select('*').maybeSingle();
      cfg = data;
      if (!cfg || !cfg.is_enabled || !cfg.list_id || !cfg.sender_id) {
        return json({ skipped: true, reason: 'config_disabled_or_incomplete' });
      }
      apiKey = Deno.env.get('EGOI_API_KEY');
      if (!apiKey) return json({ error: 'EGOI_API_KEY não configurada' }, 500);
    }

    // Coleta de dados
    // Faixa de datas: semanal = próximos 7 dias; fim de semana = próxima sexta/sábado/domingo.
    const now = new Date();
    let rangeStart: Date;
    let rangeEnd: Date;
    if (range === 'weekend') {
      const day = now.getDay(); // 0 dom .. 6 sáb
      // Se hoje é sex/sáb/dom, usa o FDS corrente; senão pula para próxima sexta.
      const daysToFriday = day === 5 || day === 6 || day === 0 ? (day === 5 ? 0 : day === 6 ? -1 : -2) : (5 - day + 7) % 7;
      rangeStart = new Date(now);
      rangeStart.setDate(now.getDate() + daysToFriday);
      rangeStart.setHours(0, 0, 0, 0);
      rangeEnd = new Date(rangeStart);
      rangeEnd.setDate(rangeStart.getDate() + 2); // sex + sáb + dom
    } else {
      rangeStart = now;
      rangeEnd = new Date(now.getTime() + 7 * 24 * 3600 * 1000);
    }
    const startIso = rangeStart.toISOString().slice(0, 10);
    const endIso = rangeEnd.toISOString().slice(0, 10);

    const templateTypes = range === 'weekend'
      ? ['weekend_agenda']
      : ['weekly_digest', 'weekly_digest_editorial'];

    let activeTplQuery = (admin.from as any)('email_templates')
      .select('id,name,type,blocks,is_default,subject_template,preheader_template');
    if (overrideTemplateId) {
      activeTplQuery = activeTplQuery.eq('id', overrideTemplateId);
    } else {
      const settingKey = range === 'weekend' ? 'weekend_agenda_template_id' : 'weekly_digest_template_id';
      const { data: cfgTplRow } = await admin
        .from('site_settings').select('value').eq('key', settingKey).maybeSingle();
      const cfgTplId = cfgTplRow?.value && cfgTplRow.value !== '' ? cfgTplRow.value : null;
      if (cfgTplId) {
        activeTplQuery = activeTplQuery.eq('id', cfgTplId);
      } else {
        activeTplQuery = activeTplQuery
          .in('type', templateTypes)
          .order('is_default', { ascending: false })
          .order('updated_at', { ascending: false })
          .limit(1);
      }
    }

    const [{ data: eventRows }, { data: posts }, { data: tplSettings }, { data: activeTpl }, { data: globalBlocksRows }] = await Promise.all([
      admin.from('events')
        .select('id,title,slug,date,end_date,time,venue,location_city,location_state,image_url,ticket_link,cta_type,status')
        .eq('status', 'active')
        // Multi-dia: inclui eventos cuja janela [date, coalesce(end_date, date)]
        // intersecta [startIso, endIso]. Sem isso o Nostalgia (09→10/07) some no dia 10.
        .lte('date', endIso)
        .or(`date.gte.${startIso},end_date.gte.${startIso}`)
        .order('date', { ascending: true })
        .limit(50),
      admin.from('blog_posts')
        .select('id,title,slug,excerpt,image_url,published_at,published')
        .eq('published', true)
        .order('published_at', { ascending: false, nullsFirst: false })
        .limit(3),
      admin.from('email_template_settings').select('*').maybeSingle(),
      activeTplQuery.maybeSingle(),
      (admin.from as any)('email_global_blocks').select('id, name, description, category, block'),
    ]);
    // Catálogo de blocos globais para expandir global_ref no render.
    const globalsMap = new Map<string, any>();
    for (const g of ((globalBlocksRows ?? []) as any[])) globalsMap.set(g.id, g);

    const evs = ((eventRows ?? []) as EventRow[])
      .filter((event) => event.date <= endIso && ((event.end_date && event.end_date >= event.date ? event.end_date : event.date) >= startIso))
      .slice(0, 20);
    const pts = (posts ?? []) as PostRow[];
    const settings = (tplSettings ?? {}) as BrandSettings;

    const todayIso = now.toISOString().slice(0, 10);
    const rangeLabel = `${rangeStart.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} → ${rangeEnd.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}`;
    const digestLabel = range === 'weekend' ? 'Agenda do FDS' : 'Resumo semanal';
    if (evs.length === 0 && pts.length === 0) {
      return json({ skipped: true, reason: 'no_content_in_range', range: rangeLabel });
    }

    // Tenta renderizar via template ativo (blocos). Se falhar por qualquer motivo, cai no HTML legado.
    let html = '';
    let renderSource: 'template' | 'legacy' = 'legacy';
    let renderedEventPayload: EventAnnouncementData | null = null;
    const tplBlocks = Array.isArray((activeTpl as any)?.blocks) ? ((activeTpl as any).blocks as Block[]) : null;
    const resolvedTplBlocks = tplBlocks ? expandGlobalRefs(tplBlocks, globalsMap) : null;

    if (resolvedTplBlocks && resolvedTplBlocks.length > 0) {
      if (!hasAnyBlockKind(resolvedTplBlocks, range === 'weekend'
        ? ['weekend_grid', 'weekly_hero', 'dedge_block']
        : ['weekend_grid', 'weekly_hero', 'blog_posts_list', 'dedge_block']
      )) {
        return json({
          ok: false,
          error: range === 'weekend'
            ? 'Template de Agenda FDS precisa conter bloco de agenda dinâmica.'
            : 'Template de Digest semanal precisa conter bloco de agenda ou blog dinâmico.',
          template_id: (activeTpl as any)?.id ?? null,
          template_name: (activeTpl as any)?.name ?? null,
        }, 400);
      }
      try {
        // Templates "Cartaz" mostram 1 imagem grande por card → agrupar eventos
        // recorrentes (mesmo venue) em UM card com todas as datas.
        // DEDGE é SEMPRE consolidado (todo template) — regra da casa: 1 card
        // com todos os links (cada data com CTA "Enviar Nomes Para Lista").
        const tplName = String((activeTpl as any)?.name || '').toLowerCase();
        const isCartazTemplate = tplName.includes('cartaz');
        const isDedgeVenue = (v: string) => /d\.?\s*edge/i.test((v || '').trim());

        // Agrupa por venue; consolida se cartaz OU se é DEDGE.
        const groupsMap = evs.reduce<Record<string, EventRow[]>>((acc, e) => {
          const key = (e.venue || '').trim().toLowerCase() || e.id;
          (acc[key] ||= []).push(e);
          return acc;
        }, {});

        const evsForRender = Object.values(groupsMap)
          .map((group) => group.sort((a, b) => a.date.localeCompare(b.date)))
          .flatMap((group) => {
            const head = group[0];
            const shouldMerge = group.length > 1 && (isCartazTemplate || isDedgeVenue(head.venue));
            if (!shouldMerge) return group;
            const joinedDates = group.map((g) => formatDatePt(g.date, g.time)).join(' · ');
            // Preserva sub-eventos para renderizar 1 CTA por data (ex.: DEDGE quinta/sex/sáb/dom).
            const subEvents = group.map((g) => ({
              label: g.title,
              url: g.ticket_link || `${SITE_URL}/eventos/${g.slug}`,
              dayLabel: formatDatePt(g.date, g.time),
              timeLabel: (g.time || '').slice(0, 5) || '22h',
            }));
            return [{
              ...head,
              title: head.venue,
              date: head.date,
              __joinedDates: joinedDates,
              __isDedge: isDedgeVenue(head.venue),
              __subEvents: subEvents,
            } as EventRow & { __joinedDates?: string; __isDedge?: boolean; __subEvents?: Array<{ label: string; url: string; dayLabel: string; timeLabel: string }> }];
          })
          .sort((a, b) => a.date.localeCompare(b.date));

        // Separa DEDGE dos demais eventos — DEDGE só aparece via bloco `dedge_block`.
        const dedgeGroup = evsForRender.filter((e) => (e as any).__isDedge || isDedgeVenue(e.venue));
        const nonDedge = evsForRender.filter((e) => !((e as any).__isDedge || isDedgeVenue(e.venue)));
        const first = nonDedge[0] ?? evsForRender[0];
        const weekendEvents: WeekendEventItem[] = nonDedge.map((e) => {
          return {
            id: e.id,
            title: e.title,
            dayLabel: (e as any).__joinedDates
              ? (e as any).__joinedDates
              : (e.end_date && e.end_date !== e.date
                  ? `${formatDatePt(e.date, e.time)} → ${formatDatePt(e.end_date, e.time)}`
                  : formatDatePt(e.date, e.time)),
            timeLabel: (e.time || '').slice(0, 5) || '22h',
            venue: e.venue,
            cityState: `${e.location_city}-${e.location_state}`,
            imageUrl: e.image_url || `${SITE_URL}/placeholder.svg`,
            eventUrl: `${SITE_URL}/eventos/${e.slug}`,
            ticketUrl: e.ticket_link || `${SITE_URL}/eventos/${e.slug}`,
            ctaLabel: e.cta_type && e.cta_type !== DEFAULT_EVENT_CTA_TYPE ? getEventCtaButtonLabel(e.cta_type) : undefined,
          };
        });
        // Monta payload dedicado do bloco Dedge com todas as noites da semana.
        const dedgeHead = dedgeGroup[0];
        const dedgeSubs = dedgeHead
          ? (((dedgeHead as any).__subEvents as Array<{ label: string; url: string; dayLabel: string; timeLabel: string }> | undefined)
              ?? [{
                label: dedgeHead.title,
                url: dedgeHead.ticket_link || `${SITE_URL}/eventos/${dedgeHead.slug}`,
                dayLabel: formatDatePt(dedgeHead.date, dedgeHead.time),
                timeLabel: (dedgeHead.time || '').slice(0, 5) || '22h',
              }])
          : [];
        const dedgePayload = dedgeHead ? {
          imageUrl: dedgeHead.image_url || `${SITE_URL}/placeholder.svg`,
          eyebrow: 'TODA SEMANA · RESIDÊNCIA',
          title: 'Dedge — sua residência da semana',
          description: '',
          nights: dedgeSubs.map((s) => ({
            label: `${s.dayLabel} — ${s.label}`,
            url: s.url,
            enabled: true,
          })),
          primaryUrl: `${SITE_URL}/eventos?venue=dedge`,
          primaryLabel: 'Ver todos os eventos Dedge',
        } : undefined;
        const blogPosts: BlogPostItem[] = pts.map((p) => ({
          id: p.id,
          title: p.title,
          excerpt: p.excerpt ?? undefined,
          imageUrl: p.image_url ?? undefined,
          url: `${SITE_URL}/blog/${p.slug}`,
        }));

        const eventPayload: EventAnnouncementData = {
          eventTitle: first?.title || (range === 'weekend' ? 'Agenda do fim de semana' : 'O que rola na semana'),
          eventSubtitle: `${digestLabel} · ${rangeLabel}`,
          flyerUrl: first?.image_url || (settings as any).logo_url || `${SITE_URL}/placeholder.svg`,
          dateLabel: rangeLabel,
          timeLabel: first ? ((first.time || '').slice(0, 5) || '22h') : '',
          venueName: first?.venue || 'São Paulo',
          cityState: first ? `${first.location_city}-${first.location_state}` : 'São Paulo-SP',
          description: 'Os destaques da agenda e do blog nos próximos dias em São Paulo.',
          ticketUrl: first ? (first.ticket_link || `${SITE_URL}/eventos/${first.slug}`) : `${SITE_URL}/eventos`,
          eventUrl: first ? `${SITE_URL}/eventos/${first.slug}` : `${SITE_URL}/eventos`,
          agendaUrl: `${SITE_URL}/eventos`,
          instagramUrl: (settings as any).instagram_url || '',
          youtubeUrl: (settings as any).youtube_url || '',
          tiktokUrl: (settings as any).tiktok_url || '',
          unsubscribeUrl: '[E-GOI_UNSUBSCRIBE_LINK]',
          weekendEvents,
          blogPosts,
          dedge: dedgePayload,
        };

        renderedEventPayload = eventPayload;
        renderSource = 'template';
      } catch (err) {
        console.error('[weekly-digest-draft] template render failed, using legacy HTML:', err);
        html = '';
      }
    }

    if (!html && !renderedEventPayload) {
      html = renderDigestHtml(evs, pts, settings, rangeLabel);
      renderSource = 'legacy';
    }

    // Resolve subject/preheader a partir do template salvo (sem fallback hardcoded).
    // Ex.: {{event_title}}, {{event.title}}, {{date_label}}, {{weekend_range}}, {{week_range}}
    const firstEv = evs[0];
    const meta = buildEmailMeta(
      (activeTpl as any)?.subject_template,
      (activeTpl as any)?.preheader_template,
      {
        eventTitle: firstEv?.title || 'MDAccula',
        dateLabel: firstEv ? formatDatePt(firstEv.date, firstEv.time) : rangeLabel,
        timeLabel: firstEv ? ((firstEv.time || '').slice(0, 5) || '22h') : '',
        venueName: firstEv?.venue || '',
        cityState: firstEv ? `${firstEv.location_city}-${firstEv.location_state}` : 'São Paulo-SP',
        weekendRange: rangeLabel,
        weekRange: rangeLabel,
        rangeLabel,
        eventsCount: evs.length,
      },
    );
    if (!meta.subject) return json({ ok: false, error: 'Assunto do template está vazio' }, 400);
    const subject = meta.subject;
    const preheaderFromTpl = meta.preheader;
    const internalName = `MDAccula • ${digestLabel} • ${todayIso}`;

    if (resolvedTplBlocks && renderSource === 'template' && renderedEventPayload) {
      const composition = composeEmail({
        template: {
          blocks: resolvedTplBlocks,
          subject_template: (activeTpl as any)?.subject_template,
          preheader_template: (activeTpl as any)?.preheader_template,
        },
        event: renderedEventPayload,
        settings: settings as EmailTemplateSettings,
        globals: globalsMap,
        metaData: {
          eventTitle: firstEv?.title || 'MDAccula', dateLabel: firstEv ? formatDatePt(firstEv.date, firstEv.time) : rangeLabel,
          timeLabel: firstEv ? ((firstEv.time || '').slice(0, 5) || '22h') : '', venueName: firstEv?.venue || '',
          cityState: firstEv ? `${firstEv.location_city}-${firstEv.location_state}` : 'São Paulo-SP', weekendRange: rangeLabel,
          weekRange: rangeLabel, rangeLabel, eventsCount: evs.length,
        },
      });
      if (composition.issues.length > 0) return json({ ok: false, error: 'Template incompleto', validation_issues: composition.issues }, 400);
      html = composition.html;
    } else if (html && preheaderFromTpl) {
      html = injectEmailPreheader(html, preheaderFromTpl);
    }

    if (dryRun) {
      return json({
        ok: true,
        dry_run: true,
        subject,
        preheader: preheaderFromTpl,
        internal_name: internalName,
        html,
        events_count: evs.length,
        posts_count: pts.length,
        range: rangeLabel,
        render_source: renderSource,
        template_id: (activeTpl as any)?.id ?? null,
        template_name: (activeTpl as any)?.name ?? null,
      });
    }



    // Payload E-goi enriquecido: preheader dedicado e versão text (multipart).
    let textVersion = '';
    let preheaderText = preheaderFromTpl || '';
    try {
      if (resolvedTplBlocks && renderSource === 'template' && renderedEventPayload) {
        textVersion = renderBlockedTemplateText(resolvedTplBlocks, renderedEventPayload, settings as EmailTemplateSettings, null, { globals: globalsMap, preheader: preheaderText });
      }
    } catch (e) { console.warn('[weekly-digest-draft] text/preheader gen failed:', e); }

    const digestTag = range === 'weekend' ? 'agenda-fds' : 'digest-semanal';
    const createPayload: Record<string, unknown> = {
      list_id: Number(cfg.list_id),
      internal_name: internalName,
      subject,
      sender_id: Number(cfg.sender_id),
      content: {
        type: 'html',
        body: html,
        ...(preheaderText ? { preheader: preheaderText } : {}),
        ...(textVersion ? { text: textVersion } : {}),
      },
      tags: ['mdaccula', digestTag],
    };
    if (cfg.reply_to) createPayload.reply_to = Number(cfg.reply_to);

    const created = await egoiRequest('/campaigns/email', apiKey!, {
      method: 'POST',
      body: JSON.stringify(createPayload),
    });

    if (!created.ok) {
      return json({
        ok: false,
        error: `E-goi ${created.status}`,
        detail: typeof created.body === 'string' ? created.body : JSON.stringify(created.body),
      }, 502);
    }

    const campaignHash =
      created.body?.campaign_hash ||
      created.body?.hash ||
      created.body?.data?.campaign_hash ||
      (created.body?.campaign_id != null ? String(created.body.campaign_id) : null) ||
      (created.body?.id != null ? String(created.body.id) : null);

    let status: 'draft' | 'sent' = 'draft';
    if (sendOnCron && campaignHash) {
      const sendRes = await sendEgoiCampaign(campaignHash, Number(cfg.list_id), apiKey!);
      if (!sendRes.ok) {
        return json({
          ok: false,
          status: 'draft',
          error: `E-goi send ${sendRes.status}`,
          detail: typeof sendRes.body === 'string' ? sendRes.body : JSON.stringify(sendRes.body),
          egoi_campaign_id: campaignHash,
          events_count: evs.length,
          posts_count: pts.length,
          range: rangeLabel,
          template_id: (activeTpl as any)?.id ?? null,
          template_name: (activeTpl as any)?.name ?? null,
        }, 502);
      }
      status = 'sent';
    }

    return json({
      ok: true,
      status,
      egoi_campaign_id: campaignHash,
      events_count: evs.length,
      posts_count: pts.length,
      range: rangeLabel,
      template_id: (activeTpl as any)?.id ?? null,
      template_name: (activeTpl as any)?.name ?? null,
    });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
