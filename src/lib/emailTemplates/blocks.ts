/**
 * Sistema de blocos para templates de e-mail.
 *
 * Cada template = array de blocos tipados. O renderer transforma isso em HTML
 * table-based compatível com clientes de e-mail (Gmail, Outlook, Apple Mail).
 *
 * Suporta placeholders da E-goi (ex: [E-GOI_UNSUBSCRIBE_LINK]) que são
 * substituídos pelo motor E-goi no momento do envio real.
 */
import type { EmailTemplateSettings, EventAnnouncementData } from "./eventAnnouncement";

// ============================================
// Tipos de bloco
// ============================================

export type SocialNetwork = {
  id: string;
  label: string;
  url: string;
  enabled: boolean;
};

export type Align = "left" | "center" | "right";

export type Block =
  | { id: string; kind: "header"; logo_height?: number; align?: Align; padding_y?: number }
  | { id: string; kind: "hero_image"; max_width?: number; border_radius?: number }
  | { id: string; kind: "eyebrow"; text?: string; align?: Align; text_color?: string }
  | { id: string; kind: "title"; align?: Align; text_color?: string; font_size?: number }
  | { id: string; kind: "subtitle"; align?: Align; text_color?: string }
  | { id: string; kind: "event_meta"; layout?: "columns" | "stacked" }
  | { id: string; kind: "description"; align?: Align; text_color?: string }
  | { id: string; kind: "article_summary"; show_image?: boolean }
  | {
      id: string;
      kind: "cta_button";
      label?: string;
      url_field?: "ticket_link" | "vip_link" | "event_url" | "custom";
      custom_url?: string;
      align?: Align;
      full_width?: boolean;
      bg_style?: "gradient" | "solid";
      bg_color?: string;
    }
  | {
      id: string;
      kind: "secondary_link";
      label?: string;
      url_field?: "agenda_url" | "event_url" | "custom";
      custom_url?: string;
      align?: Align;
    }
  | {
      id: string;
      kind: "image_with_link";
      image_url: string;
      link_url: string;
      alt?: string;
      max_width?: number;
      align?: Align;
      border_radius?: number;
    }
  | { id: string; kind: "divider"; thickness?: number; color?: string }
  | { id: string; kind: "text"; html: string; align?: Align; text_color?: string }
  | { id: string; kind: "social_icons"; networks: SocialNetwork[]; style?: "text" | "pill"; align?: Align }
  | {
      id: string;
      kind: "lineup";
      title?: string;
      layout?: "chips" | "list" | "grid";
      align?: Align;
      title_color?: string;
      text_color?: string;
    }
  | {
      id: string;
      kind: "countdown";
      label?: string;
      deadline_source?: "today_2359" | "event_start" | "batch_deadline" | "custom";
      custom_deadline?: string; // ISO
      bg_style?: "gradient" | "solid";
      bg_color?: string;
      align?: Align;
    }
  | { id: string; kind: "footer"; text?: string; include_unsubscribe?: boolean; align?: Align };

export type Template = {
  id?: string;
  name: string;
  type: "event_new" | "ticket_batch" | "weekly_digest" | "custom";
  blocks: Block[];
  is_default?: boolean;
  subject_template?: string | null;
  preheader_template?: string | null;
};

// ============================================
// Dados de renderização (evento + matéria)
// ============================================

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
  /** Modo preview: renderiza mesmo com URLs vazias (usa "#") para o admin visualizar. */
  preview?: boolean;
};

// ============================================
// Utilitários de renderização
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
      return (event as any).vipLink || event.ticketUrl;
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
// Renderização por bloco
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
      // Preserva quebras de linha do texto do evento: cada linha vira um parágrafo.
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
      // Em modo preview, exibe todas as redes ativadas (mesmo sem URL) para o admin ver o layout.
      // No envio real, filtra só as que têm URL válida.
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
        // grid — 2 colunas via table
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
        // today_2359 — hoje às 23:59 no timezone do servidor de renderização
        deadline = new Date();
        deadline.setHours(23, 59, 0, 0);
      }
      const diffMs = Math.max(0, deadline.getTime() - now.getTime());
      const totalMin = Math.floor(diffMs / 60000);
      const days = Math.floor(totalMin / (60 * 24));
      const hours = Math.floor((totalMin % (60 * 24)) / 60);
      const minutes = totalMin % 60;
      const parts: Array<{ v: number; label: string }> = [];
      if (days > 0) parts.push({ v: days, label: days === 1 ? "dia" : "dias" });
      parts.push({ v: hours, label: hours === 1 ? "hora" : "horas" });
      parts.push({ v: minutes, label: "min" });
      const bg = block.bg_style === "solid" && block.bg_color ? escape(block.bg_color) : gradient;
      const align = block.align ?? "center";
      const label = escape(block.label || "Lote atual encerra em");
      const deadlineLabel = deadline.toLocaleString("pt-BR", {
        day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
      });
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
  const ctx: RenderContext = { event, article, settings: s };
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

// ============================================
// Utilitário: cria bloco novo com id
// ============================================

let blockCounter = Date.now();
export const newBlockId = () => `b${++blockCounter}`;

export const BLOCK_LABELS: Record<Block["kind"], string> = {
  header: "Cabeçalho (logo)",
  hero_image: "Flyer do evento",
  eyebrow: "Etiqueta (texto pequeno)",
  title: "Título do evento",
  subtitle: "Subtítulo do evento",
  event_meta: "Data, hora e local",
  description: "Descrição do evento",
  article_summary: "Resumo da matéria (se houver)",
  cta_button: "Botão CTA (ingresso)",
  secondary_link: "Link secundário",
  image_with_link: "Imagem com link",
  divider: "Divisor",
  text: "Bloco de texto livre",
  social_icons: "Redes sociais",
  footer: "Rodapé + descadastrar",
};

export const AVAILABLE_BLOCKS: Block["kind"][] = [
  "header", "hero_image", "eyebrow", "title", "subtitle", "event_meta",
  "description", "article_summary", "cta_button", "secondary_link",
  "image_with_link", "divider", "text", "social_icons", "footer",
];

// ============================================
// Presets de template (B.5.2)
// ============================================

/**
 * Gera blocos base para cada preset. Usa `newBlockId()` a cada chamada para
 * garantir IDs únicos quando o usuário cria múltiplos templates a partir do
 * mesmo preset.
 */
export function buildPresetBlocks(
  type: "event_new" | "ticket_batch" | "weekly_digest",
): Block[] {
  const defaultSocials: SocialNetwork[] = [
    { id: "instagram", label: "Instagram", url: "", enabled: true },
    { id: "youtube", label: "YouTube", url: "", enabled: true },
    { id: "tiktok", label: "TikTok", url: "", enabled: false },
    { id: "soundcloud", label: "SoundCloud", url: "", enabled: false },
    { id: "spotify", label: "Spotify", url: "", enabled: false },
    { id: "linktree", label: "Linktree", url: "", enabled: false },
  ];

  if (type === "event_new") {
    return [
      { id: newBlockId(), kind: "header", logo_height: 64 },
      { id: newBlockId(), kind: "hero_image" },
      { id: newBlockId(), kind: "eyebrow", text: "Novo evento confirmado" },
      { id: newBlockId(), kind: "title" },
      { id: newBlockId(), kind: "subtitle" },
      { id: newBlockId(), kind: "event_meta" },
      { id: newBlockId(), kind: "description" },
      { id: newBlockId(), kind: "article_summary" },
      { id: newBlockId(), kind: "cta_button", label: "Garantir ingresso", url_field: "ticket_link" },
      { id: newBlockId(), kind: "secondary_link", label: "Ver agenda completa", url_field: "agenda_url" },
      { id: newBlockId(), kind: "social_icons", networks: defaultSocials },
      { id: newBlockId(), kind: "footer", include_unsubscribe: true },
    ];
  }

  if (type === "ticket_batch") {
    // Virada de lote: urgência + arte específica opcional (image_with_link)
    // com fallback para o flyer do evento (hero_image renderiza sozinho).
    return [
      { id: newBlockId(), kind: "header", logo_height: 56 },
      {
        id: newBlockId(),
        kind: "image_with_link",
        image_url: "",
        link_url: "",
        alt: "Arte da virada de lote (opcional — preencha na hora do disparo)",
        max_width: 552,
      },
      { id: newBlockId(), kind: "hero_image" },
      { id: newBlockId(), kind: "eyebrow", text: "ÚLTIMAS HORAS · LOTE ATUAL" },
      { id: newBlockId(), kind: "title" },
      { id: newBlockId(), kind: "event_meta" },
      {
        id: newBlockId(),
        kind: "text",
        html: "<p><strong>O lote atual está acabando.</strong> Garanta o seu antes da próxima virada de preço.</p>",
      },
      { id: newBlockId(), kind: "cta_button", label: "Garantir ingresso agora", url_field: "ticket_link" },
      { id: newBlockId(), kind: "divider" },
      { id: newBlockId(), kind: "social_icons", networks: defaultSocials },
      { id: newBlockId(), kind: "footer", include_unsubscribe: true },
    ];
  }

  // weekly_digest — resumo semanal (usa blocos de texto/imagem livre; a
  // renderização com múltiplos eventos/notícias virá na fase B.7)
  return [
    { id: newBlockId(), kind: "header", logo_height: 64 },
    { id: newBlockId(), kind: "eyebrow", text: "Resumo da semana · MDAccula" },
    {
      id: newBlockId(),
      kind: "text",
      html:
        "<h2 style=\"color:#fff;font-size:22px;margin:0 0 12px 0;\">O que rolou (e o que vem por aí)</h2>" +
        "<p>Uma seleção rápida dos eventos, matérias e novidades da semana em Cuiabá.</p>",
    },
    { id: newBlockId(), kind: "divider" },
    {
      id: newBlockId(),
      kind: "text",
      html:
        "<p><strong>📅 Próximos eventos</strong><br>Adicione aqui os destaques (edição manual até B.7 automatizar).</p>",
    },
    { id: newBlockId(), kind: "divider" },
    {
      id: newBlockId(),
      kind: "text",
      html:
        "<p><strong>📰 Matérias em alta</strong><br>Cole links ou use blocos de imagem-com-link para destacar posts do blog.</p>",
    },
    {
      id: newBlockId(),
      kind: "cta_button",
      label: "Ver tudo no site",
      url_field: "custom",
      custom_url: "https://mdaccula.com",
    },
    { id: newBlockId(), kind: "social_icons", networks: defaultSocials },
    { id: newBlockId(), kind: "footer", include_unsubscribe: true },
  ];
}

export const TEMPLATE_PRESETS: Array<{
  key: "event_new" | "ticket_batch" | "weekly_digest";
  name: string;
  description: string;
  subject_template: string;
  preheader_template: string;
}> = [
  {
    key: "event_new",
    name: "Novo evento",
    description: "Anúncio de evento novo confirmado — flyer, data, local, CTA de ingresso e resumo da matéria (se houver).",
    subject_template: "🎧 Novo evento: {{event_title}} — {{date_label}}",
    preheader_template: "{{event_title}} em {{venue_name}}, {{city_state}}. Ingressos abertos.",
  },
  {
    key: "ticket_batch",
    name: "Virada de lote",
    description: "Aviso de urgência para virada de lote (mesmo dia ou 1 dia antes). Inclui bloco de arte específica opcional.",
    subject_template: "⏰ Últimas horas do lote — {{event_title}}",
    preheader_template: "O lote atual está acabando. Garanta antes da próxima virada de preço.",
  },
  {
    key: "weekly_digest",
    name: "Resumo semanal",
    description: "Newsletter semanal com destaques da agenda e matérias do blog.",
    subject_template: "📬 MDAccula desta semana",
    preheader_template: "Eventos, matérias e novidades da cena eletrônica em Cuiabá.",
  },
];
