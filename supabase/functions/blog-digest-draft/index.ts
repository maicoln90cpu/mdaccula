// Blog digest: cria rascunho na E-goi com as novidades do blog (só posts, sem eventos).
//
// Guards:
//   1. Auth admin OU x-cron-secret (env CRON_SHARED_SECRET ou internal_cron_secrets.blog_digest_cron).
//   2. Master switch site_settings.egoi_email_enabled = true.
//   3. site_settings.blog_digest_enabled = true (cron sempre; admin pode forçar via force=true).
//   4. egoi_config habilitado + list_id + sender_id.

import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  renderBlockedTemplateText,
  expandGlobalRefs,
  type Block,
  type EventAnnouncementData,
  type EmailTemplateSettings,
  type BlogPostItem,
} from '../_shared/emailBlocks.ts';
import { composeEmail } from '../_shared/emailComposer.ts';
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

function hasAnyBlockKind(blocks: Block[] | null, kinds: string[]): boolean {
  if (!blocks?.length) return false;
  return blocks.some((b) => kinds.includes((b as any).kind));
}

/** HTML mínimo de fallback caso o template salvo esteja vazio/quebrado. */
function renderLegacyBlogHtml(posts: PostRow[], settings: BrandSettings, rangeLabel: string): string {
  const primary = settings.primary_color || '#a855f7';
  const accent = settings.accent_color || '#ec4899';
  const bg = settings.background_color || '#050505';
  const brand = settings.brand_name || 'MDACCULA';
  const footer = settings.footer_text ||
    'Você recebeu este e-mail porque assinou a lista MDAccula.';
  const logo = settings.logo_url
    ? `<img src="${escapeHtml(settings.logo_url)}" alt="${escapeHtml(brand)}" width="140" height="42" style="display:block;height:42px;width:auto;border:0;outline:none;" />`
    : `<div style="font-family:Arial,sans-serif;font-size:22px;font-weight:800;letter-spacing:2px;color:#fff;">${escapeHtml(brand)}</div>`;
  const cards = posts.length === 0
    ? `<tr><td style="padding:12px 20px;color:#bbb;font-family:Arial,sans-serif;font-size:14px;">Nenhuma matéria nova no período.</td></tr>`
    : posts.map((p) => {
        const url = `${SITE_URL}/blog/${escapeHtml(p.slug)}`;
        const img = p.image_url || `${SITE_URL}/placeholder.svg`;
        return `
        <tr><td style="padding:8px 20px;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;background:#0d0d0d;border:1px solid #1e1e1e;border-radius:10px;overflow:hidden;">
            <tr>
              <td width="120" valign="top"><a href="${url}"><img src="${escapeHtml(img)}" width="120" height="120" style="display:block;width:120px;height:120px;object-fit:cover;border:0;outline:none;" alt=""></a></td>
              <td valign="top" style="padding:12px 14px;font-family:Arial,sans-serif;">
                <div style="font-size:16px;font-weight:800;color:#fff;margin:0 0 4px 0;line-height:1.25;">
                  <a href="${url}" style="color:#fff;text-decoration:none;">${escapeHtml(p.title)}</a>
                </div>
                ${p.excerpt ? `<div style="font-size:12px;color:#bbb;margin-top:4px;line-height:1.4;">${escapeHtml(p.excerpt.slice(0, 160))}${p.excerpt.length > 160 ? '…' : ''}</div>` : ''}
              </td>
            </tr>
          </table>
        </td></tr>`;
      }).join('');
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${escapeHtml(brand)} — novidades do blog</title></head>
<body style="margin:0;padding:0;background:${bg};">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;background:${bg};">
  <tr><td align="center" style="padding:24px 12px;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="width:600px;max-width:600px;border-collapse:collapse;background:${bg};">
      <tr><td align="center" style="padding:8px 20px 16px 20px;">${logo}</td></tr>
      <tr><td style="padding:0 20px 8px 20px;font-family:Arial,sans-serif;">
        <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${accent};font-weight:700;">Novidades do blog · ${escapeHtml(rangeLabel)}</div>
        <h1 style="font-size:24px;line-height:1.2;color:#fff;margin:6px 0 4px 0;">Leituras da semana</h1>
      </td></tr>
      ${cards}
      <tr><td align="center" style="padding:16px 20px;">
        <a href="${SITE_URL}/blog" style="display:inline-block;background:${primary};color:#fff;font-family:Arial,sans-serif;font-size:14px;font-weight:700;padding:12px 22px;border-radius:8px;text-decoration:none;">Ver todas as matérias</a>
      </td></tr>
      <tr><td style="padding:24px 20px 8px 20px;font-family:Arial,sans-serif;color:#777;font-size:11px;line-height:1.5;border-top:1px solid #222;">
        ${escapeHtml(footer)}<br><br>
        <a href="[E-GOI_UNSUBSCRIBE_LINK]" style="color:#888;text-decoration:underline;">Descadastrar</a>
      </td></tr>
    </table>
  </td></tr>
</table></body></html>`;
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
        .eq('name', 'blog_digest_cron')
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
    const daysBack = Math.max(1, Math.min(60, Number(body?.days_back) || 7));

    // Guard 1: master switch
    const { data: masterRow } = await admin
      .from('site_settings').select('value').eq('key', 'egoi_email_enabled').maybeSingle();
    if (masterRow?.value !== 'true') {
      return json({ skipped: true, reason: 'master_off' });
    }

    // Guard 2: blog_digest habilitado
    const { data: digestRow } = await admin
      .from('site_settings').select('value').eq('key', 'blog_digest_enabled').maybeSingle();
    const digestEnabled = digestRow?.value === 'true';
    if (isCron && !digestEnabled) {
      return json({ skipped: true, reason: 'digest_disabled' });
    }
    if (!isCron && !digestEnabled && !force) {
      return json({ skipped: true, reason: 'digest_disabled' });
    }

    // Guard 3: egoi_config
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

    const now = new Date();
    const rangeStart = new Date(now.getTime() - daysBack * 24 * 3600 * 1000);
    const rangeLabel = `${rangeStart.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} → ${now.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}`;
    const todayIso = now.toISOString().slice(0, 10);

    let activeTplQuery = (admin.from as any)('email_templates')
      .select('id,name,type,blocks,is_default,subject_template,preheader_template');
    if (overrideTemplateId) {
      activeTplQuery = activeTplQuery.eq('id', overrideTemplateId);
    } else {
      const { data: cfgTplRow } = await admin
        .from('site_settings').select('value').eq('key', 'blog_digest_template_id').maybeSingle();
      const cfgTplId = cfgTplRow?.value && cfgTplRow.value !== '' ? cfgTplRow.value : null;
      if (cfgTplId) {
        activeTplQuery = activeTplQuery.eq('id', cfgTplId);
      } else {
        activeTplQuery = activeTplQuery
          .eq('type', 'blog_digest')
          .order('is_default', { ascending: false })
          .order('updated_at', { ascending: false })
          .limit(1);
      }
    }

    const [{ data: posts }, { data: tplSettings }, { data: activeTpl }, { data: globalBlocksRows }] = await Promise.all([
      admin.from('blog_posts')
        .select('id,title,slug,excerpt,image_url,published_at,published')
        .eq('published', true)
        .gte('published_at', rangeStart.toISOString())
        .order('published_at', { ascending: false, nullsFirst: false })
        .limit(10),
      admin.from('email_template_settings').select('*').maybeSingle(),
      activeTplQuery.maybeSingle(),
      (admin.from as any)('email_global_blocks').select('id, name, description, category, block'),
    ]);

    const pts = (posts ?? []) as PostRow[];
    if (pts.length === 0) {
      return json({ skipped: true, reason: 'no_posts_in_range', range: rangeLabel });
    }
    const settings = (tplSettings ?? {}) as BrandSettings;
    const globalsMap = new Map<string, any>();
    for (const g of ((globalBlocksRows ?? []) as any[])) globalsMap.set(g.id, g);

    // Renderização via template salvo (blocks)
    let html = '';
    let renderSource: 'template' | 'legacy' = 'legacy';
    let renderedEventPayload: EventAnnouncementData | null = null;
    const tplBlocks = Array.isArray((activeTpl as any)?.blocks) ? ((activeTpl as any).blocks as Block[]) : null;
    const resolvedTplBlocks = tplBlocks ? expandGlobalRefs(tplBlocks, globalsMap) : null;

    if (resolvedTplBlocks && resolvedTplBlocks.length > 0) {
      if (!hasAnyBlockKind(resolvedTplBlocks, ['blog_posts_list'])) {
        return json({
          ok: false,
          error: 'Template de Blog news precisa conter bloco de matérias do blog.',
          template_id: (activeTpl as any)?.id ?? null,
          template_name: (activeTpl as any)?.name ?? null,
        }, 400);
      }
      try {
        const blogPosts: BlogPostItem[] = pts.map((p) => ({
          id: p.id,
          title: p.title,
          excerpt: p.excerpt ?? undefined,
          imageUrl: p.image_url ?? undefined,
          url: `${SITE_URL}/blog/${p.slug}`,
        }));

        const firstPost = pts[0];
        const eventPayload: EventAnnouncementData = {
          eventTitle: 'Novidades do blog',
          eventSubtitle: `Blog · ${rangeLabel}`,
          flyerUrl: firstPost?.image_url || (settings as any).logo_url || `${SITE_URL}/placeholder.svg`,
          dateLabel: rangeLabel,
          timeLabel: '',
          venueName: 'MDAccula',
          cityState: 'São Paulo-SP',
          description: 'As matérias em alta desta semana.',
          ticketUrl: `${SITE_URL}/blog`,
          eventUrl: `${SITE_URL}/blog`,
          agendaUrl: `${SITE_URL}/blog`,
          instagramUrl: (settings as any).instagram_url || '',
          youtubeUrl: (settings as any).youtube_url || '',
          tiktokUrl: (settings as any).tiktok_url || '',
          unsubscribeUrl: '[E-GOI_UNSUBSCRIBE_LINK]',
          weekendEvents: [],
          blogPosts,
        };
        renderedEventPayload = eventPayload;
        renderSource = 'template';
      } catch (err) {
        console.error('[blog-digest-draft] template render failed, using legacy HTML:', err);
        html = '';
      }
    }

    if (!html && !renderedEventPayload) {
      html = renderLegacyBlogHtml(pts, settings, rangeLabel);
      renderSource = 'legacy';
    }

    // Assunto/preheader do template salvo (sem fallback hardcoded)
    const meta = buildEmailMeta(
      (activeTpl as any)?.subject_template,
      (activeTpl as any)?.preheader_template,
      {
        rangeLabel,
        weekRange: rangeLabel,
        weekendRange: rangeLabel,
        eventsCount: pts.length,
      },
    );
    if (!meta.subject) return json({ ok: false, error: 'Assunto do template está vazio' }, 400);
    const subject = meta.subject;
    const preheaderFromTpl = meta.preheader;
    const internalName = `MDAccula • Blog news • ${todayIso}`;

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
        metaData: { rangeLabel, weekRange: rangeLabel, weekendRange: rangeLabel, eventsCount: pts.length },
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
      if (resolvedTplBlocks && renderSource === 'template' && renderedEventPayload) {
        textVersion = renderBlockedTemplateText(resolvedTplBlocks, renderedEventPayload, settings as EmailTemplateSettings, null, { globals: globalsMap, preheader: preheaderText });
      }
    } catch (e) { console.warn('[blog-digest-draft] text/preheader gen failed:', e); }

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
      tags: ['mdaccula', 'blog-news'],
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
      posts_count: pts.length,
      range: rangeLabel,
      template_id: (activeTpl as any)?.id ?? null,
      template_name: (activeTpl as any)?.name ?? null,
    });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
