// Weekend agenda draft — gera rascunho da Agenda do FDS na E-goi
// Espelho do weekly-digest-draft, mas coleta eventos de sex/sáb/dom
// e usa templates do tipo 'weekend_agenda'.
//
// Guards:
//   1. Auth admin OU x-cron-secret (env CRON_SHARED_SECRET ou internal_cron_secrets.weekend_agenda_cron).
//   2. site_settings.egoi_email_enabled = true.
//   3. site_settings.weekend_agenda_enabled = true (cron respeita; admin pode force=true).
//   4. egoi_config habilitado + list_id + sender_id (só para envio real, não dry_run).

import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  renderBlockedTemplate,
  renderBlockedTemplateText,
  type Block,
  type EventAnnouncementData,
  type EmailTemplateSettings,
  type WeekendEventItem,
  type BlogPostItem,
} from '../_shared/emailBlocks.ts';
import { buildEmailMeta, injectEmailPreheader } from '../_shared/emailMeta.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret, x-cron-job',
};

const BASE = 'https://api.egoiapp.com';
const SITE_URL = 'https://mdaccula.com';

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

const escapeHtml = (s: string) =>
  String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function formatDatePt(dateStr: string, timeStr?: string | null) {
  try {
    const d = new Date(`${dateStr}T${(timeStr || '00:00').slice(0, 5)}:00`);
    return d.toLocaleDateString('pt-BR', {
      weekday: 'short', day: '2-digit', month: 'short',
    });
  } catch {
    return dateStr;
  }
}

type EventRow = {
  id: string; title: string; slug: string; date: string; end_date: string | null; time: string | null;
  venue: string; location_city: string; location_state: string;
  image_url: string | null; ticket_link: string | null;
};

type PostRow = {
  id: string; title: string; slug: string; excerpt: string | null;
  image_url: string | null; published_at: string | null;
};

type BrandSettings = {
  brand_name?: string; logo_url?: string | null;
  primary_color?: string; accent_color?: string; background_color?: string;
  footer_text?: string;
  instagram_url?: string | null; youtube_url?: string | null; tiktok_url?: string | null;
};

// Fallback HTML mínimo caso nenhum template weekend_agenda esteja disponível.
function renderFallbackHtml(
  events: EventRow[],
  posts: PostRow[],
  settings: BrandSettings,
  rangeLabel: string,
): string {
  const primary = settings.primary_color || '#a855f7';
  const accent = settings.accent_color || '#ec4899';
  const bg = settings.background_color || '#050505';
  const brand = settings.brand_name || 'MDACCULA';
  const footer = settings.footer_text ||
    'Você recebeu este e-mail porque assinou a lista MDAccula — agenda cultural de música eletrônica de São Paulo-SP.';
  const logo = settings.logo_url
    ? `<img src="${escapeHtml(settings.logo_url)}" alt="${escapeHtml(brand)}" width="140" height="42" style="display:block;height:42px;width:auto;border:0;outline:none;" />`
    : `<div style="font-family:Arial,sans-serif;font-size:22px;font-weight:800;letter-spacing:2px;color:#fff;">${escapeHtml(brand)}</div>`;

  const eventCards = events.length === 0
    ? `<tr><td style="padding:12px 20px;color:#bbb;font-family:Arial,sans-serif;font-size:14px;">Nenhum evento confirmado para este fim de semana — fique de olho no site.</td></tr>`
    : events.map((e) => {
        const url = `${SITE_URL}/eventos/${escapeHtml(e.slug)}`;
        const ticket = e.ticket_link || url;
        const img = e.image_url || `${SITE_URL}/placeholder.svg`;
        return `
        <tr><td style="padding:14px 20px 6px 20px;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;background:#0d0d0d;border:1px solid #1e1e1e;border-radius:10px;overflow:hidden;">
            <tr>
              <td width="120" valign="top" style="padding:0;">
                <a href="${url}" target="_blank" style="text-decoration:none;">
                  <img src="${escapeHtml(img)}" alt="${escapeHtml(e.title)}" width="120" height="120" style="display:block;width:120px;height:120px;object-fit:cover;border:0;outline:none;" />
                </a>
              </td>
              <td valign="top" style="padding:12px 14px;font-family:Arial,sans-serif;">
                <div style="font-size:11px;letter-spacing:1px;text-transform:uppercase;color:${accent};font-weight:700;">${escapeHtml(formatDatePt(e.date, e.time))} · ${escapeHtml((e.time || '').slice(0,5) || '22h')}</div>
                <div style="font-size:16px;font-weight:800;color:#fff;margin:4px 0 4px 0;line-height:1.25;">
                  <a href="${url}" target="_blank" style="color:#fff;text-decoration:none;">${escapeHtml(e.title)}</a>
                </div>
                <div style="font-size:12px;color:#bbb;margin-bottom:8px;">${escapeHtml(e.venue)} · ${escapeHtml(e.location_city)}-${escapeHtml(e.location_state)}</div>
                <a href="${ticket}" target="_blank" style="display:inline-block;background:${primary};color:#fff;font-size:12px;font-weight:700;padding:8px 14px;border-radius:6px;text-decoration:none;">Ver detalhes</a>
              </td>
            </tr>
          </table>
        </td></tr>`;
      }).join('');

  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(brand)} — Agenda do FDS</title></head>
<body style="margin:0;padding:0;background:${bg};">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;background:${bg};">
  <tr><td align="center" style="padding:24px 12px;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="width:600px;max-width:600px;border-collapse:collapse;background:${bg};">
      <tr><td align="center" style="padding:8px 20px 16px 20px;">${logo}</td></tr>
      <tr><td style="padding:0 20px 8px 20px;font-family:Arial,sans-serif;">
        <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${accent};font-weight:700;">Agenda do FDS · ${escapeHtml(rangeLabel)}</div>
        <h1 style="font-size:24px;line-height:1.2;color:#fff;margin:6px 0 4px 0;">O que rola no fim de semana</h1>
        <p style="font-size:14px;color:#bbb;margin:0;">Sextou, sabadou e domingou em São Paulo.</p>
      </td></tr>
      ${eventCards}
      <tr><td align="center" style="padding:16px 20px;">
        <a href="${SITE_URL}/eventos" target="_blank" style="display:inline-block;background:${primary};color:#fff;font-family:Arial,sans-serif;font-size:14px;font-weight:700;padding:12px 22px;border-radius:8px;text-decoration:none;">Ver agenda completa</a>
      </td></tr>
      <tr><td style="padding:24px 20px 8px 20px;font-family:Arial,sans-serif;color:#777;font-size:11px;line-height:1.5;border-top:1px solid #222;">
        ${escapeHtml(footer)}
        <br><br>
        <a href="[E-GOI_UNSUBSCRIBE_LINK]" style="color:#888;text-decoration:underline;">Descadastrar</a>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
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
        .eq('name', 'weekend_agenda_cron')
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

    // Guard 1: master switch
    const { data: masterRow } = await admin
      .from('site_settings').select('value').eq('key', 'egoi_email_enabled').maybeSingle();
    if (masterRow?.value !== 'true') {
      return json({ skipped: true, reason: 'master_off' });
    }

    // Guard 2: agenda FDS habilitada
    const { data: agendaRow } = await admin
      .from('site_settings').select('value').eq('key', 'weekend_agenda_enabled').maybeSingle();
    const agendaEnabled = agendaRow?.value === 'true';
    if (isCron && !agendaEnabled) return json({ skipped: true, reason: 'agenda_disabled' });
    if (!isCron && !agendaEnabled && !force) return json({ skipped: true, reason: 'agenda_disabled' });

    // Guard 3: egoi_config (só quando vai enviar)
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

    // Range: próxima sex/sáb/dom (se já é sex/sáb/dom, usa o FDS corrente).
    const now = new Date();
    const day = now.getDay(); // 0 dom .. 6 sáb
    const daysToFriday =
      day === 5 ? 0 :
      day === 6 ? -1 :
      day === 0 ? -2 :
      (5 - day + 7) % 7;
    const rangeStart = new Date(now);
    rangeStart.setDate(now.getDate() + daysToFriday);
    rangeStart.setHours(0, 0, 0, 0);
    const rangeEnd = new Date(rangeStart);
    rangeEnd.setDate(rangeStart.getDate() + 2);

    const startIso = rangeStart.toISOString().slice(0, 10);
    const endIso = rangeEnd.toISOString().slice(0, 10);
    const todayIso = now.toISOString().slice(0, 10);
    const rangeLabel = `${rangeStart.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} → ${rangeEnd.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}`;

    // Query do template
    let activeTplQuery = (admin.from as any)('email_templates')
      .select('id,name,type,blocks,is_default,subject_template,preheader_template');
    if (overrideTemplateId) {
      activeTplQuery = activeTplQuery.eq('id', overrideTemplateId);
    } else {
      // Prioriza template configurado em site_settings.weekend_agenda_template_id, senão pega is_default
      const { data: cfgTplRow } = await admin
        .from('site_settings').select('value').eq('key', 'weekend_agenda_template_id').maybeSingle();
      const cfgTplId = cfgTplRow?.value && cfgTplRow.value !== '' ? cfgTplRow.value : null;
      if (cfgTplId) {
        activeTplQuery = activeTplQuery.eq('id', cfgTplId);
      } else {
        activeTplQuery = activeTplQuery
          .eq('type', 'weekend_agenda')
          .order('is_default', { ascending: false })
          .order('updated_at', { ascending: false })
          .limit(1);
      }
    }

    const [{ data: eventRows }, { data: posts }, { data: tplSettings }, { data: activeTpl }, { data: globalBlocksRows }] = await Promise.all([
      admin.from('events')
        .select('id,title,slug,date,end_date,time,venue,location_city,location_state,image_url,ticket_link,status')
        .eq('status', 'active')
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
    const globalsMap = new Map<string, any>();
    for (const g of ((globalBlocksRows ?? []) as any[])) globalsMap.set(g.id, g);

    const evs = ((eventRows ?? []) as EventRow[])
      .filter((event) => event.date <= endIso && ((event.end_date && event.end_date >= event.date ? event.end_date : event.date) >= startIso))
      .slice(0, 20);
    const pts = (posts ?? []) as PostRow[];
    const settings = (tplSettings ?? {}) as BrandSettings;

    let html = '';
    let renderSource: 'template' | 'legacy' = 'legacy';
    let renderedEventPayload: EventAnnouncementData | null = null;
    const tplBlocks = Array.isArray((activeTpl as any)?.blocks) ? ((activeTpl as any).blocks as Block[]) : null;

    if (tplBlocks && tplBlocks.length > 0) {
      try {
        // Templates "Cartaz" (1 imagem grande) → agrupar recorrentes em 1 card.
        // DEDGE é SEMPRE consolidado (todo template) — regra da casa.
        const tplName = String((activeTpl as any)?.name || '').toLowerCase();
        const isCartazTemplate = tplName.includes('cartaz');
        const isDedgeVenue = (v: string) => /d\.?\s*edge/i.test((v || '').trim());

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
            const subEvents = group.map((g) => ({
              label: g.title,
              url: g.ticket_link || `${SITE_URL}/eventos/${g.slug}`,
              dayLabel: formatDatePt(g.date, g.time),
              timeLabel: (g.time || '').slice(0, 5) || '22h',
            }));
            return [{
              ...head,
              title: head.venue,
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
          };
        });
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
          eventTitle: first?.title || 'Agenda do fim de semana',
          eventSubtitle: `Agenda do FDS · ${rangeLabel}`,
          flyerUrl: first?.image_url || (settings as any).logo_url || `${SITE_URL}/placeholder.svg`,
          dateLabel: rangeLabel,
          timeLabel: first ? ((first.time || '').slice(0, 5) || '22h') : '',
          venueName: first?.venue || 'São Paulo',
          cityState: first ? `${first.location_city}-${first.location_state}` : 'São Paulo-SP',
          description: 'Sextou, sabadou e domingou em São Paulo.',
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
        console.error('[weekend-agenda-draft] template render failed, using fallback:', err);
        html = '';
      }
    }

    if (!html && !renderedEventPayload) {
      html = renderFallbackHtml(evs, pts, settings, rangeLabel);
      renderSource = 'legacy';
    }

    // Resolve subject/preheader a partir do template salvo (sem fallback hardcoded fixo).
    const firstEv = evs[0];
    const meta = buildEmailMeta(
      (activeTpl as any)?.subject_template,
      (activeTpl as any)?.preheader_template,
      {
        eventTitle: firstEv?.title || 'Agenda do fim de semana',
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
    const internalName = `MDAccula • Agenda FDS • ${todayIso}`;

    if (tplBlocks && renderSource === 'template' && renderedEventPayload) {
      html = renderBlockedTemplate(
        tplBlocks,
        renderedEventPayload,
        settings as EmailTemplateSettings,
        null,
        { preview: false, globals: globalsMap, preheader: preheaderFromTpl },
      );
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

    let textVersion = '';
    let preheaderText = preheaderFromTpl || '';
    try {
      if (tplBlocks && renderSource === 'template' && renderedEventPayload) {
        textVersion = renderBlockedTemplateText(tplBlocks, renderedEventPayload, settings as EmailTemplateSettings, null, { globals: globalsMap, preheader: preheaderText });
      }
    } catch (e) { console.warn('[weekend-agenda-draft] text/preheader gen failed:', e); }

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
      tags: ['mdaccula', 'agenda-fds'],
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

    return json({
      ok: true,
      status: 'draft',
      egoi_campaign_id: campaignHash,
      events_count: evs.length,
      posts_count: pts.length,
      range: rangeLabel,
    });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
