// ============================================
// Renderer de blocos de e-mail — Deno / Edge Functions
// ============================================
//
// Port das funções puras de `src/lib/emailTemplates/blocks.ts` (frontend).
// Este arquivo é **duplicado propositalmente**: edge functions não conseguem
// importar de `src/`, então mantemos os dois lados em paralelo. Se mudar o
// visual dos blocos no frontend, replicar aqui.
//
// Escopo: apenas tipos + `renderBlockedTemplate`. Sem presets/UI helpers.

export type SocialNetwork = {
  id: string;
  label: string;
  url: string;
  enabled: boolean;
};

export type Align = "left" | "center" | "right";

export interface WeekendEventItem {
  id?: string;
  title: string;
  dayLabel: string;
  timeLabel?: string;
  venue: string;
  cityState?: string;
  imageUrl: string;
  eventUrl: string;
  ticketUrl?: string;
  articleUrl?: string;
}

export interface DedgeNightConfig { label: string; url: string; enabled: boolean; }

export interface DedgeBlockData {
  imageUrl: string;
  eyebrow?: string;
  title?: string;
  description?: string;
  nights: DedgeNightConfig[];
  primaryUrl?: string;
  primaryLabel?: string;
}

export interface BlogPostItem {
  id?: string;
  title: string;
  excerpt?: string;
  imageUrl?: string;
  url: string;
  publishedLabel?: string;
  category?: string;
}

export interface EventAnnouncementData {
  eventTitle: string;
  eventSubtitle?: string;
  flyerUrl: string;
  dateLabel: string;
  timeLabel: string;
  venueName: string;
  cityState: string;
  description: string;
  ticketUrl: string;
  eventUrl: string;
  agendaUrl: string;
  instagramUrl: string;
  youtubeUrl: string;
  tiktokUrl: string;
  unsubscribeUrl: string;
  lineup?: string[];
  eventStartIso?: string;
  ticketBatchDeadlineIso?: string;
  venueLat?: number;
  venueLng?: number;
  weekendEvents?: WeekendEventItem[];
  blogPosts?: BlogPostItem[];
  dedge?: DedgeBlockData;
  vipLink?: string;
}

export interface EmailTemplateSettings {
  brand_name?: string;
  logo_url?: string | null;
  primary_color?: string;
  accent_color?: string;
  background_color?: string;
  footer_text?: string;
  cta_label?: string;
  instagram_url?: string | null;
  youtube_url?: string | null;
  tiktok_url?: string | null;
  show_subtitle?: boolean;
  show_description?: boolean;
  show_socials?: boolean;
  show_secondary_link?: boolean;
  secondary_link_label?: string;
  custom_html_header?: string | null;
  custom_html_footer?: string | null;
}

export type Block =
  | { id: string; kind: "header"; logo_height?: number; align?: Align; padding_y?: number }
  | { id: string; kind: "hero_image"; max_width?: number; border_radius?: number }
  | { id: string; kind: "eyebrow"; text?: string; align?: Align; text_color?: string }
  | { id: string; kind: "title"; align?: Align; text_color?: string; font_size?: number }
  | { id: string; kind: "subtitle"; align?: Align; text_color?: string }
  | { id: string; kind: "event_meta"; layout?: "columns" | "stacked" }
  | { id: string; kind: "description"; align?: Align; text_color?: string }
  | { id: string; kind: "article_summary"; show_image?: boolean }
  | { id: string; kind: "cta_button"; label?: string; url_field?: "ticket_link" | "vip_link" | "event_url" | "custom"; custom_url?: string; align?: Align; full_width?: boolean; bg_style?: "gradient" | "solid"; bg_color?: string }
  | { id: string; kind: "secondary_link"; label?: string; url_field?: "agenda_url" | "event_url" | "custom"; custom_url?: string; align?: Align }
  | { id: string; kind: "image_with_link"; image_url: string; link_url: string; alt?: string; max_width?: number; align?: Align; border_radius?: number }
  | { id: string; kind: "divider"; thickness?: number; color?: string }
  | { id: string; kind: "text"; html: string; align?: Align; text_color?: string }
  | { id: string; kind: "social_icons"; networks: SocialNetwork[]; style?: "text" | "pill"; align?: Align }
  | { id: string; kind: "lineup"; title?: string; layout?: "chips" | "list" | "grid"; align?: Align; title_color?: string; text_color?: string }
  | { id: string; kind: "countdown"; label?: string; deadline_source?: "today_2359" | "event_start" | "batch_deadline" | "custom"; custom_deadline?: string; bg_style?: "gradient" | "solid"; bg_color?: string; align?: Align; size?: "large" | "medium" | "minimal" }
  | { id: string; kind: "ticker"; messages?: string[]; bg_color?: string; text_color?: string; animation?: "none" | "slide" | "fade"; align?: Align; icon?: "none" | "clock" | "fire" | "bolt" }
  | { id: string; kind: "static_map"; zoom?: number; height?: number; map_style?: "roadmap" | "terrain"; show_address_label?: boolean; border_radius?: number }
  | { id: string; kind: "weekend_grid"; layout?: "cartaz" | "timeline"; title?: string; eyebrow?: string; show_article_link?: boolean; day_bar_color?: string; align?: Align }
  | { id: string; kind: "dedge_block"; override_content?: boolean; image_url?: string; eyebrow?: string; title?: string; description?: string; primary_label?: string; primary_url?: string; button_style?: "dark" | "primary" }
  | { id: string; kind: "weekly_hero"; source?: "first_weekend" | "main_event"; eyebrow?: string; cta_label?: string; show_venue?: boolean; show_cta?: boolean; overlay_intensity?: "soft" | "strong"; align?: Align }
  | { id: string; kind: "blog_posts_list"; title?: string; eyebrow?: string; max_items?: number; layout?: "list" | "cards"; show_excerpt?: boolean; show_category?: boolean; align?: Align }
  | { id: string; kind: "footer"; text?: string; include_unsubscribe?: boolean; align?: Align };

export type ArticleSummary = {
  title: string;
  excerpt: string;
  url: string;
  image_url?: string;
};

export type RenderContext = {
  event: EventAnnouncementData;
  article?: ArticleSummary | null;
  settings: Required<Pick<EmailTemplateSettings,
    "brand_name" | "primary_color" | "accent_color" | "background_color" | "footer_text" | "cta_label"
  >> & Partial<EmailTemplateSettings>;
  preview?: boolean;
  /** Project ID para montar URLs do render-static-map (edge). */
  projectId?: string;
};

// ============================================
// Utils
// ============================================

const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const sanitizeCustomHtml = (raw: string) =>
  raw
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/on\w+\s*=\s*"[^"]*"/gi, "")
    .replace(/on\w+\s*=\s*'[^']*'/gi, "")
    .replace(/javascript:/gi, "");

const resolveCtaUrl = (block: Extract<Block, { kind: "cta_button" }>, event: EventAnnouncementData) => {
  switch (block.url_field) {
    case "vip_link":
      return event.vipLink || event.ticketUrl;
    case "event_url":
      return event.eventUrl;
    case "custom":
      return block.custom_url || event.ticketUrl;
    case "ticket_link":
    default:
      return event.ticketUrl;
  }
};

const resolveSecondaryUrl = (block: Extract<Block, { kind: "secondary_link" }>, event: EventAnnouncementData) => {
  switch (block.url_field) {
    case "event_url":
      return event.eventUrl;
    case "custom":
      return block.custom_url || event.agendaUrl;
    case "agenda_url":
    default:
      return event.agendaUrl;
  }
};

// ============================================
// Render por bloco
// ============================================

function renderBlock(block: Block, ctx: RenderContext): string {
  const { event, article, settings } = ctx;
  const primary = escape(settings.primary_color);
  const accent = escape(settings.accent_color);
  const brand = escape(settings.brand_name);
  const gradient = `linear-gradient(90deg, ${primary} 0%, ${accent} 50%, #2563eb 100%)`;

  switch (block.kind) {
    case "header": {
      const height = Math.max(24, Math.min(200, block.logo_height ?? 64));
      const align = block.align ?? "center";
      const pad = Math.max(0, Math.min(80, block.padding_y ?? 32));
      const inner = settings.logo_url
        ? `<img src="${escape(settings.logo_url)}" alt="${brand}" height="${height}" border="0" style="display:inline-block;height:${height}px;max-height:${height}px;width:auto;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;">`
        : `<div style="font-size:22px;font-weight:800;letter-spacing:-0.02em;text-transform:uppercase;font-style:italic;color:#ffffff;">${brand}</div>`;
      return `<tr><td align="${align}" style="padding:${pad}px 24px ${Math.max(8, pad - 8)}px 24px;text-align:${align};">${inner}</td></tr>`;
    }

    case "hero_image": {
      const maxW = Math.max(300, Math.min(600, block.max_width ?? 552));
      const radius = block.border_radius ?? 12;
      return `<tr><td align="center" style="padding:0 24px;">
        <a href="${escape(event.eventUrl)}" style="text-decoration:none;display:block;">
          <img src="${escape(event.flyerUrl)}" alt="${escape(event.eventTitle)}" width="${maxW}" border="0" style="display:block;width:100%;max-width:${maxW}px;height:auto;border-radius:${radius}px;border:1px solid rgba(255,255,255,0.08);background:#111;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;margin:0 auto;">
        </a>
      </td></tr>`;
    }

    case "eyebrow": {
      const color = escape(block.text_color || primary);
      const align = block.align ?? "left";
      return `<tr><td style="padding:24px 32px 0 32px;text-align:${align};">
        <p style="margin:0;color:${color};font-size:11px;font-weight:600;letter-spacing:0.2em;text-transform:uppercase;">${escape(block.text || "Novo evento")}</p>
      </td></tr>`;
    }

    case "title": {
      const color = escape(block.text_color || "#ffffff");
      const align = block.align ?? "left";
      const size = Math.max(18, Math.min(48, block.font_size ?? 28));
      return `<tr><td style="padding:8px 32px 0 32px;text-align:${align};">
        <h1 style="margin:0;color:${color};font-size:${size}px;line-height:1.15;font-weight:800;letter-spacing:-0.01em;">${escape(event.eventTitle)}</h1>
      </td></tr>`;
    }

    case "subtitle": {
      if (!event.eventSubtitle) return "";
      const color = escape(block.text_color || "#a1a1aa");
      const align = block.align ?? "left";
      return `<tr><td style="padding:8px 32px 0 32px;text-align:${align};">
        <p style="margin:0;color:${color};font-size:16px;line-height:1.5;">${escape(event.eventSubtitle)}</p>
      </td></tr>`;
    }

    case "event_meta": {
      const stacked = block.layout === "stacked";
      if (stacked) {
        return `<tr><td style="padding:16px 32px;">
          <div style="border-top:1px solid rgba(255,255,255,0.06);border-bottom:1px solid rgba(255,255,255,0.06);padding:20px 0;">
            <div style="color:#ffffff;font-size:11px;font-weight:700;letter-spacing:-0.01em;text-transform:uppercase;margin-bottom:6px;">Data e hora</div>
            <div style="color:#a1a1aa;font-size:14px;line-height:1.5;margin-bottom:14px;">${escape(event.dateLabel)}<br>${escape(event.timeLabel)}</div>
            <div style="color:#ffffff;font-size:11px;font-weight:700;letter-spacing:-0.01em;text-transform:uppercase;margin-bottom:6px;">Local</div>
            <div style="color:#a1a1aa;font-size:14px;line-height:1.5;">${escape(event.venueName)}<br>${escape(event.cityState)}</div>
          </div>
        </td></tr>`;
      }
      return `<tr><td style="padding:16px 32px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid rgba(255,255,255,0.06);border-bottom:1px solid rgba(255,255,255,0.06);">
          <tr>
            <td width="50%" style="padding:20px 0;vertical-align:top;">
              <div style="color:#ffffff;font-size:11px;font-weight:700;letter-spacing:-0.01em;text-transform:uppercase;margin-bottom:6px;">Data e hora</div>
              <div style="color:#a1a1aa;font-size:14px;line-height:1.5;">${escape(event.dateLabel)}<br>${escape(event.timeLabel)}</div>
            </td>
            <td width="50%" align="right" style="padding:20px 0;vertical-align:top;">
              <div style="color:#ffffff;font-size:11px;font-weight:700;letter-spacing:-0.01em;text-transform:uppercase;margin-bottom:6px;">Local</div>
              <div style="color:#a1a1aa;font-size:14px;line-height:1.5;">${escape(event.venueName)}<br>${escape(event.cityState)}</div>
            </td>
          </tr>
        </table>
      </td></tr>`;
    }

    case "description": {
      if (!event.description) return "";
      const color = escape(block.text_color || "#a1a1aa");
      const align = block.align ?? "left";
      const lines = event.description.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      const paragraphs = lines
        .map((l) => `<p style="margin:0 0 10px 0;color:${color};font-size:15px;line-height:1.6;">${escape(l)}</p>`)
        .join("");
      return `<tr><td style="padding:8px 32px 24px 32px;text-align:${align};">${paragraphs}</td></tr>`;
    }

    case "article_summary": {
      if (!article) return "";
      const showImage = block.show_image !== false;
      const imgHtml = showImage && article.image_url
        ? `<img src="${escape(article.image_url)}" alt="" width="120" height="80" border="0" style="display:block;width:120px;height:80px;object-fit:cover;border-radius:8px;border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;">`
        : "";
      return `<tr><td style="padding:8px 32px 24px 32px;">
        <a href="${escape(article.url)}" style="text-decoration:none;display:block;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:rgba(168,85,247,0.06);border:1px solid ${primary};border-radius:12px;">
            <tr>
              <td style="padding:16px;vertical-align:top;">
                <div style="color:${primary};font-size:10px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:6px;">📰 Leia a matéria</div>
                <div style="color:#ffffff;font-size:15px;font-weight:700;line-height:1.3;margin-bottom:6px;">${escape(article.title)}</div>
                <div style="color:#a1a1aa;font-size:13px;line-height:1.5;">${escape(article.excerpt)}</div>
              </td>
              ${imgHtml ? `<td width="120" style="padding:16px 16px 16px 0;vertical-align:top;">${imgHtml}</td>` : ""}
            </tr>
          </table>
        </a>
      </td></tr>`;
    }

    case "cta_button": {
      const url = resolveCtaUrl(block, event);
      const label = escape(block.label || settings.cta_label || "Garantir ingresso");
      const align = block.align ?? "center";
      const fullWidth = block.full_width !== false;
      const bg = block.bg_style === "solid" && block.bg_color ? escape(block.bg_color) : gradient;
      const widthStyle = fullWidth ? "display:block;width:100%;" : "display:inline-block;width:auto;";
      return `<tr><td align="${align}" style="padding:8px 32px 8px 32px;text-align:${align};">
        <a href="${escape(url)}" style="${widthStyle}padding:18px 24px;box-sizing:border-box;background:${bg};color:#ffffff;font-size:16px;font-weight:900;text-align:center;text-decoration:none;text-transform:uppercase;letter-spacing:0.15em;border-radius:12px;">${label}</a>
      </td></tr>`;
    }

    case "secondary_link": {
      const url = resolveSecondaryUrl(block, event);
      const label = escape(block.label || "Ver mais");
      const align = block.align ?? "center";
      return `<tr><td align="${align}" style="padding:8px 32px 24px 32px;text-align:${align};">
        <a href="${escape(url)}" style="display:inline-block;color:#71717a;font-size:12px;font-weight:700;text-decoration:none;text-transform:uppercase;letter-spacing:0.2em;">${label}</a>
      </td></tr>`;
    }

    case "image_with_link": {
      if (!block.image_url) return "";
      const maxW = Math.max(120, Math.min(552, block.max_width ?? 552));
      const align = block.align ?? "center";
      const radius = block.border_radius ?? 8;
      const alt = escape(block.alt || "");
      const inner = `<img src="${escape(block.image_url)}" alt="${alt}" width="${maxW}" border="0" style="display:block;width:100%;max-width:${maxW}px;height:auto;border-radius:${radius}px;border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;${align === "center" ? "margin:0 auto;" : align === "right" ? "margin:0 0 0 auto;" : "margin:0;"}">`;
      const wrapped = block.link_url
        ? `<a href="${escape(block.link_url)}" style="text-decoration:none;display:block;">${inner}</a>`
        : inner;
      return `<tr><td align="${align}" style="padding:8px 32px;text-align:${align};">${wrapped}</td></tr>`;
    }

    case "divider": {
      const thickness = Math.max(1, Math.min(8, block.thickness ?? 1));
      const color = escape(block.color || "rgba(255,255,255,0.08)");
      return `<tr><td style="padding:8px 32px;"><div style="height:${thickness}px;background:${color};line-height:${thickness}px;font-size:0;">&nbsp;</div></td></tr>`;
    }

    case "text": {
      const safe = sanitizeCustomHtml(block.html || "");
      const color = escape(block.text_color || "#a1a1aa");
      const align = block.align ?? "left";
      return `<tr><td style="padding:8px 32px;color:${color};font-size:14px;line-height:1.6;text-align:${align};">${safe}</td></tr>`;
    }

    case "social_icons": {
      const list = (block.networks || []).filter((n) => n.enabled && (ctx.preview || n.url));
      if (list.length === 0) return "";
      const align = block.align ?? "center";
      const style = block.style || "text";
      const colors = [primary, accent, "#60a5fa", "#f472b6", "#34d399", "#fbbf24", "#a78bfa", "#fb923c"];
      const cells = list.map((n, i) => {
        const href = escape(n.url || "#");
        if (style === "pill") {
          return `<td style="padding:4px 6px;"><a href="${href}" style="display:inline-block;padding:8px 14px;background:${colors[i % colors.length]};color:#ffffff;font-size:11px;font-weight:700;text-decoration:none;text-transform:uppercase;letter-spacing:0.1em;border-radius:999px;">${escape(n.label)}</a></td>`;
        }
        const sep = i > 0 ? `<td style="padding:0 8px;color:#3f3f46;">·</td>` : "";
        return `${sep}<td style="padding:0 8px;"><a href="${href}" style="color:${colors[i % colors.length]};font-size:12px;font-weight:700;text-decoration:none;text-transform:uppercase;letter-spacing:0.1em;">${escape(n.label)}</a></td>`;
      }).join("");
      return `<tr><td align="${align}" style="padding:16px 32px 8px 32px;text-align:${align};">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="display:inline-table;"><tr>${cells}</tr></table>
      </td></tr>`;
    }

    case "lineup": {
      const artists = (event.lineup || []).filter(Boolean);
      if (artists.length === 0) return "";
      const align = block.align ?? "center";
      const titleColor = escape(block.title_color || primary);
      const textColor = escape(block.text_color || "#ffffff");
      const title = escape(block.title || "Line-up");
      const layout = block.layout || "chips";
      let body = "";
      if (layout === "chips") {
        body = artists.map((a) =>
          `<span style="display:inline-block;margin:4px 4px;padding:8px 14px;background:rgba(168,85,247,0.12);border:1px solid ${primary};border-radius:999px;color:${textColor};font-size:13px;font-weight:700;letter-spacing:0.02em;">${escape(a)}</span>`
        ).join("");
      } else if (layout === "list") {
        body = `<ul style="list-style:none;padding:0;margin:0;">${artists.map((a) =>
          `<li style="padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.06);color:${textColor};font-size:15px;font-weight:600;">${escape(a)}</li>`
        ).join("")}</ul>`;
      } else {
        const rows: string[] = [];
        for (let i = 0; i < artists.length; i += 2) {
          const a = escape(artists[i]);
          const b = artists[i + 1] ? escape(artists[i + 1]) : "";
          rows.push(`<tr><td width="50%" style="padding:8px 12px 8px 0;color:${textColor};font-size:15px;font-weight:700;">${a}</td><td width="50%" style="padding:8px 0 8px 12px;color:${textColor};font-size:15px;font-weight:700;">${b}</td></tr>`);
        }
        body = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows.join("")}</table>`;
      }
      return `<tr><td style="padding:8px 32px 16px 32px;text-align:${align};">
        <div style="color:${titleColor};font-size:11px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:10px;">${title}</div>
        <div style="text-align:${align};">${body}</div>
      </td></tr>`;
    }

    case "countdown": {
      const source = block.deadline_source || "today_2359";
      let deadline: Date;
      const now = new Date();
      if (source === "custom" && block.custom_deadline) {
        deadline = new Date(block.custom_deadline);
      } else if (source === "event_start" && event.eventStartIso) {
        deadline = new Date(event.eventStartIso);
      } else if (source === "batch_deadline" && event.ticketBatchDeadlineIso) {
        deadline = new Date(event.ticketBatchDeadlineIso);
      } else {
        deadline = new Date();
        deadline.setHours(23, 59, 0, 0);
      }
      const diffMs = Math.max(0, deadline.getTime() - now.getTime());
      const totalMin = Math.floor(diffMs / 60000);
      const days = Math.floor(totalMin / (60 * 24));
      const hours = Math.floor((totalMin % (60 * 24)) / 60);
      const minutes = totalMin % 60;
      const bg = block.bg_style === "solid" && block.bg_color ? escape(block.bg_color) : gradient;
      const align = block.align ?? "center";
      const label = escape(block.label || "Lote atual encerra em");
      const deadlineLabel = deadline.toLocaleString("pt-BR", {
        day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
      });
      const size = block.size || "large";

      if (size === "minimal") {
        const inline = `${days > 0 ? `${days}d ` : ""}${hours}h ${minutes.toString().padStart(2, "0")}m`;
        return `<tr><td align="${align}" style="padding:8px 32px;text-align:${align};">
          <div style="display:inline-block;padding:10px 16px;background:${bg};border-radius:999px;color:#ffffff;font-size:13px;font-weight:800;letter-spacing:0.02em;">⏰ ${label}: ${inline} <span style="opacity:0.85;font-weight:600;">(até ${escape(deadlineLabel)})</span></div>
        </td></tr>`;
      }

      if (size === "medium") {
        const parts = [
          { v: days, label: days === 1 ? "dia" : "dias" },
          { v: hours, label: hours === 1 ? "hora" : "horas" },
        ];
        const boxes = parts.map((p) =>
          `<td style="padding:0 6px;"><div style="min-width:80px;padding:10px 12px;background:rgba(0,0,0,0.35);border:1px solid rgba(255,255,255,0.15);border-radius:10px;text-align:center;">
            <div style="color:#ffffff;font-size:22px;font-weight:900;line-height:1;letter-spacing:-0.02em;">${p.v.toString().padStart(2, "0")}</div>
            <div style="color:#ffffff;opacity:0.85;font-size:10px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;margin-top:4px;">${p.label}</div>
          </div></td>`
        ).join("");
        return `<tr><td style="padding:8px 32px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${bg};border-radius:14px;">
            <tr><td align="${align}" style="padding:14px 12px;text-align:${align};">
              <div style="color:#ffffff;font-size:11px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:8px;">${label}</div>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="display:inline-table;"><tr>${boxes}</tr></table>
              <div style="color:#ffffff;opacity:0.85;font-size:11px;margin-top:8px;">até ${escape(deadlineLabel)}</div>
            </td></tr>
          </table>
        </td></tr>`;
      }

      const parts: Array<{ v: number; label: string }> = [];
      if (days > 0) parts.push({ v: days, label: days === 1 ? "dia" : "dias" });
      parts.push({ v: hours, label: hours === 1 ? "hora" : "horas" });
      parts.push({ v: minutes, label: "min" });
      const boxes = parts.map((p) =>
        `<td style="padding:0 6px;"><div style="min-width:64px;padding:12px 10px;background:rgba(0,0,0,0.35);border:1px solid rgba(255,255,255,0.15);border-radius:10px;text-align:center;">
          <div style="color:#ffffff;font-size:26px;font-weight:900;line-height:1;letter-spacing:-0.02em;">${p.v.toString().padStart(2, "0")}</div>
          <div style="color:#ffffff;opacity:0.85;font-size:10px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;margin-top:4px;">${p.label}</div>
        </div></td>`
      ).join("");
      return `<tr><td style="padding:8px 32px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${bg};border-radius:14px;">
          <tr><td align="${align}" style="padding:18px 16px;text-align:${align};">
            <div style="color:#ffffff;font-size:11px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:10px;">${label}</div>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="display:inline-table;"><tr>${boxes}</tr></table>
            <div style="color:#ffffff;opacity:0.85;font-size:11px;margin-top:10px;">até ${escape(deadlineLabel)}</div>
          </td></tr>
        </table>
      </td></tr>`;
    }

    case "ticker": {
      const msgs = (block.messages && block.messages.length > 0
        ? block.messages
        : ["Últimas horas", "Ingressos limitados", "Restam poucos"]
      ).slice(0, 3).map((m) => escape(m));
      const bg = escape(block.bg_color || primary);
      const color = escape(block.text_color || "#ffffff");
      const align = block.align ?? "center";
      const anim = block.animation || "fade";
      const iconMap: Record<string, string> = { none: "", clock: "⏰ ", fire: "🔥 ", bolt: "⚡ " };
      const icon = iconMap[block.icon || "clock"] ?? "⏰ ";

      const staticLine = msgs.join(" · ");
      const animatedSpans = anim === "fade"
        ? msgs.map((m, i) => `<span class="tk tk${i}">${icon}${m}</span>`).join("")
        : anim === "slide"
        ? `<span class="tk-slide">${msgs.map((m) => `${icon}${m}`).join("  ·  ")}</span>`
        : `<span>${icon}${staticLine}</span>`;

      const keyframes = anim === "fade" && msgs.length > 1
        ? `<style>@media screen{
          .ticker-anim .tk{display:none;}
          .ticker-anim .tk0{display:inline;animation:tkf 9s infinite;}
          ${msgs.length >= 2 ? ".ticker-anim .tk1{display:inline;animation:tkf 9s infinite -3s;}" : ""}
          ${msgs.length >= 3 ? ".ticker-anim .tk2{display:inline;animation:tkf 9s infinite -6s;}" : ""}
          @keyframes tkf{0%,25%{opacity:1}33%,92%{opacity:0}100%{opacity:1}}
        }</style>`
        : anim === "slide"
        ? `<style>@media screen{.ticker-anim .tk-slide{display:inline-block;animation:tks 18s linear infinite;}@keyframes tks{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}}</style>`
        : "";

      return `${keyframes}<tr><td align="${align}" style="padding:0 32px;">
        <div class="ticker-anim" style="background:${bg};color:${color};padding:10px 16px;border-radius:8px;font-size:12px;font-weight:800;letter-spacing:0.15em;text-transform:uppercase;text-align:${align};overflow:hidden;white-space:nowrap;">
          <!--[if mso]>${icon}${escape(msgs[0])}<![endif]-->
          <!--[if !mso]><!-->${animatedSpans}<!--<![endif]-->
        </div>
      </td></tr>`;
    }

    case "static_map": {
      const lat = event.venueLat;
      const lng = event.venueLng;
      if (typeof lat !== "number" || typeof lng !== "number") {
        if (!ctx.preview) return "";
        return `<tr><td style="padding:8px 32px;">
          <div style="padding:24px;background:rgba(255,255,255,0.04);border:1px dashed rgba(255,255,255,0.15);border-radius:12px;text-align:center;color:#a1a1aa;font-size:13px;">
            🗺️ Mapa aparecerá aqui quando o evento tiver <strong style="color:#fff;">coordenadas do venue</strong> preenchidas.
          </div>
        </td></tr>`;
      }
      const zoom = Math.max(12, Math.min(19, block.zoom ?? 15));
      const height = Math.max(200, Math.min(400, block.height ?? 300));
      const style = block.map_style || "roadmap";
      const radius = block.border_radius ?? 12;
      const showLabel = block.show_address_label !== false;
      const projectId = ctx.projectId || "xfvpuzlspvvsmmunznxw";
      const mapSrc = `https://${projectId}.supabase.co/functions/v1/render-static-map?lat=${lat}&lng=${lng}&zoom=${zoom}&w=600&h=${height}&style=${style}`;
      const mapsDeepLink = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
      const label = showLabel
        ? `<div style="padding:10px 14px;color:#a1a1aa;font-size:13px;line-height:1.4;text-align:center;background:rgba(0,0,0,0.4);border-top:1px solid rgba(255,255,255,0.06);">
            <strong style="color:#ffffff;">${escape(event.venueName)}</strong> · ${escape(event.cityState)}<br>
            <span style="color:${primary};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.15em;">Toque para abrir no mapa →</span>
          </div>`
        : "";
      return `<tr><td style="padding:8px 32px;">
        <a href="${escape(mapsDeepLink)}" style="text-decoration:none;display:block;border-radius:${radius}px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);">
          <img src="${escape(mapSrc)}" alt="Mapa de ${escape(event.venueName)}" width="600" height="${height}" border="0" style="display:block;width:100%;max-width:100%;height:auto;">
          ${label}
        </a>
      </td></tr>`;
    }

    case "weekend_grid": {
      const list = (event.weekendEvents || []).filter(Boolean);
      const align = block.align ?? "left";
      const eyebrow = escape(block.eyebrow || "AGENDA · FIM DE SEMANA");
      const title = escape(block.title || "O que rola no fds");
      const showArticle = block.show_article_link !== false;
      const layout = block.layout || "cartaz";

      if (list.length === 0) {
        if (!ctx.preview) return "";
        return `<tr><td style="padding:8px 32px;">
          <div style="padding:24px;background:rgba(255,255,255,0.04);border:1px dashed rgba(255,255,255,0.15);border-radius:12px;text-align:center;color:#a1a1aa;font-size:13px;">
            📅 Aqui aparecem os eventos do fim de semana quando a newsletter for gerada.
          </div>
        </td></tr>`;
      }

      const hasHeader = (block.eyebrow || block.title) !== undefined
        || (!block.eyebrow && !block.title ? false : true);
      const showHeader = (block.eyebrow ?? "AGENDA · FIM DE SEMANA") !== "" || (block.title ?? "O que rola no fds") !== "";
      const header = showHeader ? `<tr><td style="padding:16px 32px 4px 32px;text-align:${align};">
        <div style="color:${primary};font-size:11px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:4px;">${eyebrow}</div>
        <h2 style="margin:0;color:#ffffff;font-size:22px;line-height:1.2;font-weight:800;letter-spacing:-0.01em;">${title}</h2>
      </td></tr>` : "";

      if (layout === "timeline") {
        const barColor = escape(block.day_bar_color || accent);
        const rows = list.map((ev) => {
          const url = escape(ev.eventUrl || "#");
          const article = showArticle && ev.articleUrl
            ? `<a href="${escape(ev.articleUrl)}" style="display:inline-block;margin-top:6px;color:${primary};font-size:11px;font-weight:700;text-decoration:none;text-transform:uppercase;letter-spacing:0.15em;">📰 Ler matéria →</a>`
            : "";
          return `<tr><td style="padding:6px 32px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0d0d0d;border:1px solid rgba(255,255,255,0.08);border-radius:12px;overflow:hidden;">
              <tr>
                <td width="6" style="background:${barColor};"></td>
                <td width="96" style="padding:0;">
                  <a href="${url}" style="text-decoration:none;display:block;"><img src="${escape(ev.imageUrl)}" alt="${escape(ev.title)}" width="96" height="96" border="0" style="display:block;width:96px;height:96px;object-fit:cover;border:0;outline:none;"></a>
                </td>
                <td style="padding:12px 14px;vertical-align:top;">
                  <div style="color:${barColor};font-size:10px;font-weight:800;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:3px;">${escape(ev.dayLabel)}${ev.timeLabel ? ` · ${escape(ev.timeLabel)}` : ""}</div>
                  <div style="color:#ffffff;font-size:15px;font-weight:800;line-height:1.25;margin-bottom:3px;"><a href="${url}" style="color:#ffffff;text-decoration:none;">${escape(ev.title)}</a></div>
                  <div style="color:#a1a1aa;font-size:12px;">${escape(ev.venue)}${ev.cityState ? ` · ${escape(ev.cityState)}` : ""}</div>
                  ${article}
                </td>
              </tr>
            </table>
          </td></tr>`;
        }).join("");
        return `${header}${rows}`;
      }

      const cards = list.map((ev) => {
        const url = escape(ev.eventUrl || "#");
        const article = showArticle && ev.articleUrl
          ? `<a href="${escape(ev.articleUrl)}" style="display:inline-block;margin-left:12px;color:${primary};font-size:11px;font-weight:700;text-decoration:none;text-transform:uppercase;letter-spacing:0.15em;">📰 Matéria →</a>`
          : "";
        const ticketBtn = ev.ticketUrl
          ? `<a href="${escape(ev.ticketUrl)}" style="display:inline-block;padding:10px 18px;background:${gradient};color:#ffffff;font-size:12px;font-weight:900;text-decoration:none;text-transform:uppercase;letter-spacing:0.15em;border-radius:8px;">Garantir ingresso</a>`
          : "";
        return `<tr><td style="padding:10px 32px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0d0d0d;border:1px solid rgba(255,255,255,0.08);border-radius:14px;overflow:hidden;">
            <tr><td style="padding:0;position:relative;">
              <a href="${url}" style="text-decoration:none;display:block;">
                <img src="${escape(ev.imageUrl)}" alt="${escape(ev.title)}" width="552" border="0" style="display:block;width:100%;max-width:552px;height:auto;border:0;outline:none;">
              </a>
            </td></tr>
            <tr><td style="padding:16px 18px 18px 18px;">
              <div style="color:${accent};font-size:11px;font-weight:800;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:6px;">${escape(ev.dayLabel)}${ev.timeLabel ? ` · ${escape(ev.timeLabel)}` : ""}</div>
              <div style="color:#ffffff;font-size:19px;font-weight:900;line-height:1.2;margin-bottom:4px;letter-spacing:-0.01em;"><a href="${url}" style="color:#ffffff;text-decoration:none;">${escape(ev.title)}</a></div>
              <div style="color:#a1a1aa;font-size:13px;margin-bottom:12px;">${escape(ev.venue)}${ev.cityState ? ` · ${escape(ev.cityState)}` : ""}</div>
              ${ticketBtn}${article}
            </td></tr>
          </table>
        </td></tr>`;
      }).join("");
      return `${header}${cards}`;
    }

    case "dedge_block": {
      const d = event.dedge;
      const override = block.override_content === true;
      const imageUrl = (override ? block.image_url : d?.imageUrl) || block.image_url || d?.imageUrl || "";
      const eyebrow = escape((override ? block.eyebrow : d?.eyebrow) || block.eyebrow || d?.eyebrow || "TODA SEMANA · RESIDÊNCIA");
      const title = escape((override ? block.title : d?.title) || block.title || d?.title || "Dedge — sua residência da semana");
      const description = escape((override ? block.description : d?.description) || block.description || d?.description || "");
      const primaryUrl = (override ? block.primary_url : d?.primaryUrl) || block.primary_url || d?.primaryUrl || "";
      const primaryLabel = escape((override ? block.primary_label : d?.primaryLabel) || block.primary_label || d?.primaryLabel || "Ver todos os eventos Dedge");
      const nights = (d?.nights || []).filter((n) => n.enabled && n.url);
      const buttonStyle = block.button_style || "dark";

      if (!imageUrl && nights.length === 0 && !primaryUrl) {
        if (!ctx.preview) return "";
        return `<tr><td style="padding:8px 32px;">
          <div style="padding:24px;background:rgba(255,255,255,0.04);border:1px dashed rgba(255,255,255,0.15);border-radius:12px;text-align:center;color:#a1a1aa;font-size:13px;">
            🎧 Bloco Dedge — configure a imagem e os links das noites nas propriedades do bloco.
          </div>
        </td></tr>`;
      }

      const btnBg = buttonStyle === "primary" ? gradient : "#0a0a0a";
      const btnBorder = buttonStyle === "primary" ? "transparent" : "rgba(255,255,255,0.18)";
      const nightBtns = nights.map((n) =>
        `<tr><td style="padding:6px 0;"><a href="${escape(n.url)}" style="display:block;width:100%;box-sizing:border-box;padding:14px 18px;background:${btnBg};border:1px solid ${btnBorder};color:#ffffff;font-size:13px;font-weight:800;text-align:center;text-decoration:none;text-transform:uppercase;letter-spacing:0.12em;border-radius:10px;">${escape(n.label)}</a></td></tr>`
      ).join("");

      return `<tr><td style="padding:20px 32px 8px 32px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#000000;border:1px solid rgba(255,255,255,0.12);border-radius:16px;overflow:hidden;">
          ${imageUrl ? `<tr><td style="padding:0;"><img src="${escape(imageUrl)}" alt="Dedge" width="552" border="0" style="display:block;width:100%;max-width:552px;height:auto;border:0;outline:none;"></td></tr>` : ""}
          <tr><td style="padding:22px 22px 8px 22px;text-align:center;">
            <div style="color:${accent};font-size:11px;font-weight:800;letter-spacing:0.25em;text-transform:uppercase;margin-bottom:6px;">${eyebrow}</div>
            <h2 style="margin:0 0 8px 0;color:#ffffff;font-size:22px;line-height:1.2;font-weight:900;letter-spacing:-0.01em;">${title}</h2>
            ${description ? `<p style="margin:0 0 4px 0;color:#a1a1aa;font-size:14px;line-height:1.55;">${description}</p>` : ""}
          </td></tr>
          ${nights.length > 0 ? `<tr><td style="padding:12px 22px 6px 22px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${nightBtns}</table>
          </td></tr>` : ""}
          ${primaryUrl ? `<tr><td align="center" style="padding:8px 22px 22px 22px;text-align:center;">
            <a href="${escape(primaryUrl)}" style="display:inline-block;padding:14px 22px;background:${gradient};color:#ffffff;font-size:13px;font-weight:900;text-decoration:none;text-transform:uppercase;letter-spacing:0.15em;border-radius:10px;">${primaryLabel}</a>
          </td></tr>` : ""}
        </table>
      </td></tr>`;
    }

    case "weekly_hero": {
      const source = block.source || "first_weekend";
      const w = event.weekendEvents?.[0];
      const useWeekend = source === "first_weekend" && !!w;
      const title = useWeekend ? w!.title : event.eventTitle;
      const imageUrl = useWeekend ? w!.imageUrl : event.flyerUrl;
      const url = useWeekend ? (w!.eventUrl || "#") : event.eventUrl;
      const ticketUrl = useWeekend ? (w!.ticketUrl || w!.eventUrl) : event.ticketUrl;
      const venue = useWeekend ? w!.venue : event.venueName;
      const city = useWeekend ? (w!.cityState || "") : event.cityState;
      const dayLabel = useWeekend ? w!.dayLabel : event.dateLabel;
      const timeLabel = useWeekend ? (w!.timeLabel || "") : event.timeLabel;
      const eyebrow = escape(block.eyebrow || "DESTAQUE DA SEMANA");
      const align = block.align || "left";
      const showVenue = block.show_venue !== false;
      const showCta = block.show_cta !== false;
      const ctaLabel = escape(block.cta_label || settings.cta_label || "Garantir ingresso");
      const overlayBg = block.overlay_intensity === "soft"
        ? "linear-gradient(180deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.75) 100%)"
        : "linear-gradient(180deg, rgba(0,0,0,0.1) 20%, rgba(0,0,0,0.92) 100%)";

      if (!imageUrl && !title) {
        if (!ctx.preview) return "";
        return `<tr><td style="padding:8px 32px;">
          <div style="padding:24px;background:rgba(255,255,255,0.04);border:1px dashed rgba(255,255,255,0.15);border-radius:12px;text-align:center;color:#a1a1aa;font-size:13px;">
            ⭐ Hero da semana aparece quando houver eventos programados.
          </div>
        </td></tr>`;
      }

      return `<tr><td style="padding:12px 32px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#000;border:1px solid rgba(255,255,255,0.1);border-radius:16px;overflow:hidden;">
          <tr><td style="padding:0;position:relative;background:#000;">
            <a href="${escape(url)}" style="text-decoration:none;display:block;">
              <img src="${escape(imageUrl)}" alt="${escape(title)}" width="552" border="0" style="display:block;width:100%;max-width:552px;height:auto;border:0;outline:none;">
            </a>
          </td></tr>
          <tr><td style="padding:20px 22px 22px 22px;text-align:${align};background-image:${overlayBg};">
            <div style="color:${accent};font-size:11px;font-weight:800;letter-spacing:0.25em;text-transform:uppercase;margin-bottom:8px;">${eyebrow}</div>
            <div style="color:#ffffff;font-size:12px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;margin-bottom:6px;opacity:0.85;">${escape(dayLabel)}${timeLabel ? ` · ${escape(timeLabel)}` : ""}</div>
            <h1 style="margin:0 0 8px 0;color:#ffffff;font-size:26px;line-height:1.15;font-weight:900;letter-spacing:-0.02em;">
              <a href="${escape(url)}" style="color:#ffffff;text-decoration:none;">${escape(title)}</a>
            </h1>
            ${showVenue ? `<div style="color:#a1a1aa;font-size:14px;margin-bottom:14px;">📍 ${escape(venue)}${city ? ` · ${escape(city)}` : ""}</div>` : ""}
            ${showCta && ticketUrl ? `<a href="${escape(ticketUrl)}" style="display:inline-block;padding:14px 26px;background:${gradient};color:#ffffff;font-size:13px;font-weight:900;text-decoration:none;text-transform:uppercase;letter-spacing:0.18em;border-radius:10px;">${ctaLabel}</a>` : ""}
          </td></tr>
        </table>
      </td></tr>`;
    }

    case "blog_posts_list": {
      const posts = (event.blogPosts || []).slice(0, Math.max(1, Math.min(block.max_items ?? 3, 5)));
      const eyebrow = escape(block.eyebrow || "MATÉRIAS");
      const title = escape(block.title || "Do blog nesta semana");
      const layout = block.layout || "list";
      const showExcerpt = block.show_excerpt !== false;
      const showCategory = block.show_category !== false;
      const align = block.align || "left";

      if (posts.length === 0) {
        if (!ctx.preview) return "";
        return `<tr><td style="padding:8px 32px;">
          <div style="padding:24px;background:rgba(255,255,255,0.04);border:1px dashed rgba(255,255,255,0.15);border-radius:12px;text-align:center;color:#a1a1aa;font-size:13px;">
            📰 Últimos posts do blog aparecerão aqui.
          </div>
        </td></tr>`;
      }

      const header = `<tr><td style="padding:14px 32px 6px 32px;text-align:${align};">
        <div style="color:${primary};font-size:11px;font-weight:800;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:4px;">${eyebrow}</div>
        <h2 style="margin:0;color:#ffffff;font-size:20px;line-height:1.2;font-weight:800;letter-spacing:-0.01em;">${title}</h2>
      </td></tr>`;

      if (layout === "cards") {
        const cards = posts.map((p) => {
          const url = escape(p.url || "#");
          return `<tr><td style="padding:8px 32px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0d0d0d;border:1px solid rgba(255,255,255,0.08);border-radius:12px;overflow:hidden;">
              ${p.imageUrl ? `<tr><td style="padding:0;"><a href="${url}" style="text-decoration:none;display:block;"><img src="${escape(p.imageUrl)}" alt="${escape(p.title)}" width="552" border="0" style="display:block;width:100%;max-width:552px;height:auto;border:0;outline:none;"></a></td></tr>` : ""}
              <tr><td style="padding:14px 16px 16px 16px;">
                ${showCategory && p.category ? `<div style="color:${accent};font-size:10px;font-weight:800;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:4px;">${escape(p.category)}${p.publishedLabel ? ` · ${escape(p.publishedLabel)}` : ""}</div>` : (p.publishedLabel ? `<div style="color:#71717a;font-size:11px;margin-bottom:4px;">${escape(p.publishedLabel)}</div>` : "")}
                <div style="color:#ffffff;font-size:16px;font-weight:800;line-height:1.25;margin-bottom:4px;"><a href="${url}" style="color:#ffffff;text-decoration:none;">${escape(p.title)}</a></div>
                ${showExcerpt && p.excerpt ? `<div style="color:#a1a1aa;font-size:13px;line-height:1.5;">${escape(p.excerpt)}</div>` : ""}
                <a href="${url}" style="display:inline-block;margin-top:8px;color:${primary};font-size:11px;font-weight:800;text-decoration:none;text-transform:uppercase;letter-spacing:0.15em;">Ler matéria →</a>
              </td></tr>
            </table>
          </td></tr>`;
        }).join("");
        return `${header}${cards}`;
      }

      const rows = posts.map((p) => {
        const url = escape(p.url || "#");
        return `<tr><td style="padding:8px 32px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0d0d0d;border:1px solid rgba(255,255,255,0.08);border-radius:12px;overflow:hidden;">
            <tr>
              ${p.imageUrl ? `<td width="96" valign="top" style="padding:0;"><a href="${url}" style="text-decoration:none;display:block;"><img src="${escape(p.imageUrl)}" alt="${escape(p.title)}" width="96" height="96" border="0" style="display:block;width:96px;height:96px;object-fit:cover;border:0;outline:none;"></a></td>` : ""}
              <td style="padding:12px 14px;vertical-align:top;">
                ${showCategory && p.category ? `<div style="color:${accent};font-size:10px;font-weight:800;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:3px;">${escape(p.category)}${p.publishedLabel ? ` · ${escape(p.publishedLabel)}` : ""}</div>` : (p.publishedLabel ? `<div style="color:#71717a;font-size:11px;margin-bottom:3px;">${escape(p.publishedLabel)}</div>` : "")}
                <div style="color:#ffffff;font-size:15px;font-weight:800;line-height:1.25;margin-bottom:3px;"><a href="${url}" style="color:#ffffff;text-decoration:none;">${escape(p.title)}</a></div>
                ${showExcerpt && p.excerpt ? `<div style="color:#a1a1aa;font-size:12px;line-height:1.45;">${escape(p.excerpt)}</div>` : ""}
              </td>
            </tr>
          </table>
        </td></tr>`;
      }).join("");
      return `${header}${rows}`;
    }

    case "footer": {
      const txt = escape(block.text || settings.footer_text || "");
      const align = block.align ?? "center";
      const unsubscribe = block.include_unsubscribe !== false
        ? `<p style="margin:8px 0 0 0;font-size:11px;"><a href="[E-GOI_UNSUBSCRIBE_LINK]" style="color:#71717a;font-weight:700;text-decoration:underline;">Descadastrar-se</a></p>`
        : "";
      return `<tr><td align="${align}" style="padding:24px 32px 40px 32px;background:rgba(0,0,0,0.4);border-top:1px solid rgba(255,255,255,0.06);text-align:${align};">
        <p style="margin:0;color:#52525b;font-size:11px;line-height:1.6;max-width:400px;display:inline-block;">${txt}</p>
        ${unsubscribe}
      </td></tr>`;
    }

    default:
      return "";
  }
}

// ============================================
// Renderer principal
// ============================================

export function renderBlockedTemplate(
  blocks: Block[],
  event: EventAnnouncementData,
  settings: EmailTemplateSettings | null | undefined,
  article?: ArticleSummary | null,
  opts?: { preview?: boolean; projectId?: string },
): string {
  const s = {
    brand_name: settings?.brand_name || "MDACCULA",
    primary_color: settings?.primary_color || "#a855f7",
    accent_color: settings?.accent_color || "#ec4899",
    background_color: settings?.background_color || "#050505",
    footer_text: settings?.footer_text || "Você recebeu este e-mail porque assinou a lista MDAccula.",
    cta_label: settings?.cta_label || "Garantir ingresso",
    logo_url: settings?.logo_url ?? null,
    custom_html_header: settings?.custom_html_header ?? null,
    custom_html_footer: settings?.custom_html_footer ?? null,
  };
  const ctx: RenderContext = { event, article, settings: s, preview: opts?.preview, projectId: opts?.projectId };
  const bg = escape(s.background_color);
  const brand = escape(s.brand_name);
  const preheader = `${escape(event.eventTitle)} — ${escape(event.dateLabel)} em ${escape(event.venueName)}, ${escape(event.cityState)}`;

  const rows = blocks.map((b) => renderBlock(b, ctx)).join("\n");
  const customHeader = s.custom_html_header ? sanitizeCustomHtml(s.custom_html_header) : "";
  const customFooter = s.custom_html_footer ? sanitizeCustomHtml(s.custom_html_footer) : "";

  return `<!doctype html>
<html lang="pt-BR" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="color-scheme" content="dark light">
<meta name="supported-color-schemes" content="dark light">
<title>${escape(event.eventTitle)} — ${brand}</title>
<!--[if mso]>
<xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch><o:AllowPNG/></o:OfficeDocumentSettings></xml>
<style>table,td,div,p,a{font-family:'Segoe UI',Arial,sans-serif !important;} img{-ms-interpolation-mode:bicubic;}</style>
<![endif]-->
<style>img{border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;display:block;}</style>
</head>
<body style="margin:0;padding:0;background:${bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#e5e5e5;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${bg};">
<tr><td align="center" style="padding:24px 12px;">
<!--[if mso | IE]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#080808;border:1px solid rgba(255,255,255,0.08);border-radius:16px;overflow:hidden;">
${customHeader ? `<tr><td style="padding:16px 24px 0 24px;">${customHeader}</td></tr>` : ""}
${rows}
${customFooter ? `<tr><td style="padding:0 24px 16px 24px;">${customFooter}</td></tr>` : ""}
</table>
<!--[if mso | IE]></td></tr></table><![endif]-->
</td></tr>
</table>
</body>
</html>`;
}
