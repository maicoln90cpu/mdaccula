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
  renderBlockedTemplate,
  type Block,
  type EventAnnouncementData,
  type EmailTemplateSettings,
  type WeekendEventItem,
  type BlogPostItem,
} from '../_shared/emailBlocks.ts';

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
  id: string; title: string; slug: string; date: string; time: string | null;
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

function renderDigestHtml(
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
    'Você recebeu este e-mail porque assinou a lista MDAccula — agenda cultural de música eletrônica de Cuiabá-MT.';
  const logo = settings.logo_url
    ? `<img src="${escapeHtml(settings.logo_url)}" alt="${escapeHtml(brand)}" width="140" height="42" style="display:block;height:42px;width:auto;border:0;outline:none;" />`
    : `<div style="font-family:Arial,sans-serif;font-size:22px;font-weight:800;letter-spacing:2px;color:#fff;">${escapeHtml(brand)}</div>`;

  const eventCards = events.length === 0
    ? `<tr><td style="padding:12px 20px;color:#bbb;font-family:Arial,sans-serif;font-size:14px;">Nenhum evento confirmado para os próximos 7 dias — fique de olho no site.</td></tr>`
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

  const postCards = posts.length === 0
    ? ''
    : `
    <tr><td style="padding:24px 20px 6px 20px;font-family:Arial,sans-serif;">
      <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${accent};font-weight:700;">Matérias em alta</div>
    </td></tr>` + posts.map((p) => {
      const url = `${SITE_URL}/blog/${escapeHtml(p.slug)}`;
      const img = p.image_url || `${SITE_URL}/placeholder.svg`;
      return `
      <tr><td style="padding:8px 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;background:#0d0d0d;border:1px solid #1e1e1e;border-radius:10px;overflow:hidden;">
          <tr>
            <td width="96" valign="top" style="padding:0;">
              <a href="${url}" target="_blank" style="text-decoration:none;">
                <img src="${escapeHtml(img)}" alt="${escapeHtml(p.title)}" width="96" height="96" style="display:block;width:96px;height:96px;object-fit:cover;border:0;outline:none;" />
              </a>
            </td>
            <td valign="top" style="padding:10px 14px;font-family:Arial,sans-serif;">
              <div style="font-size:14px;font-weight:700;color:#fff;line-height:1.3;">
                <a href="${url}" target="_blank" style="color:#fff;text-decoration:none;">${escapeHtml(p.title)}</a>
              </div>
              ${p.excerpt ? `<div style="font-size:12px;color:#bbb;margin-top:4px;line-height:1.4;">${escapeHtml(p.excerpt.slice(0, 140))}${p.excerpt.length > 140 ? '…' : ''}</div>` : ''}
            </td>
          </tr>
        </table>
      </td></tr>`;
    }).join('');

  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(brand)} — resumo semanal</title></head>
<body style="margin:0;padding:0;background:${bg};">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;background:${bg};">
  <tr><td align="center" style="padding:24px 12px;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="width:600px;max-width:600px;border-collapse:collapse;background:${bg};">
      <tr><td align="center" style="padding:8px 20px 16px 20px;">${logo}</td></tr>
      <tr><td style="padding:0 20px 8px 20px;font-family:Arial,sans-serif;">
        <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${accent};font-weight:700;">Resumo semanal · ${escapeHtml(rangeLabel)}</div>
        <h1 style="font-size:24px;line-height:1.2;color:#fff;margin:6px 0 4px 0;">O que rola na semana</h1>
        <p style="font-size:14px;color:#bbb;margin:0;">Os destaques da agenda e do blog nos próximos dias em Cuiabá.</p>
      </td></tr>

      ${eventCards}

      <tr><td align="center" style="padding:16px 20px;">
        <a href="${SITE_URL}/eventos" target="_blank" style="display:inline-block;background:${primary};color:#fff;font-family:Arial,sans-serif;font-size:14px;font-weight:700;padding:12px 22px;border-radius:8px;text-decoration:none;">Ver agenda completa</a>
      </td></tr>

      ${postCards}

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
      .select('id,name,type,blocks,is_default');
    if (overrideTemplateId) {
      activeTplQuery = activeTplQuery.eq('id', overrideTemplateId);
    } else {
      activeTplQuery = activeTplQuery
        .in('type', templateTypes)
        .order('is_default', { ascending: false })
        .order('updated_at', { ascending: false })
        .limit(1);
    }

    const [{ data: events }, { data: posts }, { data: tplSettings }, { data: activeTpl }] = await Promise.all([
      admin.from('events')
        .select('id,title,slug,date,time,venue,location_city,location_state,image_url,ticket_link,status')
        .eq('status', 'active')
        .gte('date', startIso)
        .lte('date', endIso)
        .order('date', { ascending: true })
        .limit(20),
      admin.from('blog_posts')
        .select('id,title,slug,excerpt,image_url,published_at,published')
        .eq('published', true)
        .order('published_at', { ascending: false, nullsFirst: false })
        .limit(3),
      admin.from('email_template_settings').select('*').maybeSingle(),
      activeTplQuery.maybeSingle(),
    ]);

    const evs = (events ?? []) as EventRow[];
    const pts = (posts ?? []) as PostRow[];
    const settings = (tplSettings ?? {}) as BrandSettings;

    const todayIso = now.toISOString().slice(0, 10);
    const rangeLabel = `${rangeStart.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} → ${rangeEnd.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}`;
    const digestLabel = range === 'weekend' ? 'Agenda do FDS' : 'Resumo semanal';

    // Tenta renderizar via template ativo (blocos). Se falhar por qualquer motivo, cai no HTML legado.
    let html = '';
    let renderSource: 'template' | 'legacy' = 'legacy';
    const tplBlocks = Array.isArray((activeTpl as any)?.blocks) ? ((activeTpl as any).blocks as Block[]) : null;

    if (tplBlocks && tplBlocks.length > 0) {
      try {
        const first = evs[0];
        const weekendEvents: WeekendEventItem[] = evs.map((e) => ({
          id: e.id,
          title: e.title,
          dayLabel: formatDatePt(e.date, e.time),
          timeLabel: (e.time || '').slice(0, 5) || '22h',
          venue: e.venue,
          cityState: `${e.location_city}-${e.location_state}`,
          imageUrl: e.image_url || `${SITE_URL}/placeholder.svg`,
          eventUrl: `${SITE_URL}/eventos/${e.slug}`,
          ticketUrl: e.ticket_link || `${SITE_URL}/eventos/${e.slug}`,
        }));
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
          venueName: first?.venue || 'Cuiabá',
          cityState: first ? `${first.location_city}-${first.location_state}` : 'Cuiabá-MT',
          description: 'Os destaques da agenda e do blog nos próximos dias em Cuiabá.',
          ticketUrl: first ? (first.ticket_link || `${SITE_URL}/eventos/${first.slug}`) : `${SITE_URL}/eventos`,
          eventUrl: first ? `${SITE_URL}/eventos/${first.slug}` : `${SITE_URL}/eventos`,
          agendaUrl: `${SITE_URL}/eventos`,
          instagramUrl: (settings as any).instagram_url || '',
          youtubeUrl: (settings as any).youtube_url || '',
          tiktokUrl: (settings as any).tiktok_url || '',
          unsubscribeUrl: '[E-GOI_UNSUBSCRIBE_LINK]',
          weekendEvents,
          blogPosts,
        };

        html = renderBlockedTemplate(
          tplBlocks,
          eventPayload,
          settings as EmailTemplateSettings,
          null,
          { preview: false },
        );
        renderSource = 'template';
      } catch (err) {
        console.error('[weekly-digest-draft] template render failed, using legacy HTML:', err);
        html = '';
      }
    }

    if (!html) {
      html = renderDigestHtml(evs, pts, settings, rangeLabel);
      renderSource = 'legacy';
    }

    const subject = range === 'weekend'
      ? `🎉 Agenda do FDS — ${evs.length} ${evs.length === 1 ? 'evento' : 'eventos'} confirmados`
      : `📬 MDAccula desta semana — ${evs.length} ${evs.length === 1 ? 'evento' : 'eventos'} no radar`;
    const internalName = `MDAccula • ${digestLabel} • ${todayIso}`;

    if (dryRun) {
      return json({
        ok: true,
        dry_run: true,
        subject,
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



    const createPayload: Record<string, unknown> = {
      list_id: Number(cfg.list_id),
      internal_name: internalName,
      subject,
      sender_id: Number(cfg.sender_id),
      content: { type: 'html', body: html },
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
