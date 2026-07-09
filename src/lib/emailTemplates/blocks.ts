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

export type Block =
  | { id: string; kind: "header"; logo_height?: number }
  | { id: string; kind: "hero_image" }
  | { id: string; kind: "eyebrow"; text?: string }
  | { id: string; kind: "title" }
  | { id: string; kind: "subtitle" }
  | { id: string; kind: "event_meta" }
  | { id: string; kind: "description" }
  | { id: string; kind: "article_summary" }
  | {
      id: string;
      kind: "cta_button";
      label?: string;
      url_field?: "ticket_link" | "vip_link" | "event_url" | "custom";
      custom_url?: string;
    }
  | {
      id: string;
      kind: "secondary_link";
      label?: string;
      url_field?: "agenda_url" | "event_url" | "custom";
      custom_url?: string;
    }
  | {
      id: string;
      kind: "image_with_link";
      image_url: string;
      link_url: string;
      alt?: string;
      max_width?: number;
    }
  | { id: string; kind: "divider" }
  | { id: string; kind: "text"; html: string }
  | { id: string; kind: "social_icons"; networks: SocialNetwork[] }
  | { id: string; kind: "footer"; text?: string; include_unsubscribe?: boolean };

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
      const inner = settings.logo_url
        ? `<img src="${escape(settings.logo_url)}" alt="${brand}" style="display:block;max-height:${height}px;width:auto;margin:0 auto;">`
        : `<div style="font-size:22px;font-weight:800;letter-spacing:-0.02em;text-transform:uppercase;font-style:italic;color:#ffffff;">${brand}</div>`;
      return `<tr><td align="center" style="padding:32px 24px 24px 24px;">${inner}</td></tr>`;
    }

    case "hero_image":
      return `<tr><td align="center" style="padding:0 24px;">
        <a href="${escape(event.eventUrl)}" style="text-decoration:none;display:block;">
          <img src="${escape(event.flyerUrl)}" alt="${escape(event.eventTitle)}" width="552" style="display:block;width:100%;max-width:552px;height:auto;border-radius:12px;border:1px solid rgba(255,255,255,0.08);background:#111;">
        </a>
      </td></tr>`;

    case "eyebrow":
      return `<tr><td style="padding:24px 32px 0 32px;">
        <p style="margin:0;color:${primary};font-size:11px;font-weight:600;letter-spacing:0.2em;text-transform:uppercase;">${escape(block.text || "Novo evento")}</p>
      </td></tr>`;

    case "title":
      return `<tr><td style="padding:8px 32px 0 32px;">
        <h1 style="margin:0;color:#ffffff;font-size:28px;line-height:1.15;font-weight:800;letter-spacing:-0.01em;">${escape(event.eventTitle)}</h1>
      </td></tr>`;

    case "subtitle":
      if (!event.eventSubtitle) return "";
      return `<tr><td style="padding:8px 32px 0 32px;">
        <p style="margin:0;color:#a1a1aa;font-size:16px;line-height:1.5;">${escape(event.eventSubtitle)}</p>
      </td></tr>`;

    case "event_meta":
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

    case "description":
      if (!event.description) return "";
      return `<tr><td style="padding:8px 32px 24px 32px;">
        <p style="margin:0;color:#a1a1aa;font-size:15px;line-height:1.6;">${escape(event.description)}</p>
      </td></tr>`;

    case "article_summary": {
      if (!article) return "";
      const imgHtml = article.image_url
        ? `<img src="${escape(article.image_url)}" alt="" width="120" style="display:block;width:120px;height:80px;object-fit:cover;border-radius:8px;border:0;">`
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
      return `<tr><td align="center" style="padding:8px 32px 8px 32px;">
        <a href="${escape(url)}" style="display:block;width:100%;padding:18px 24px;box-sizing:border-box;background:${gradient};color:#ffffff;font-size:16px;font-weight:900;text-align:center;text-decoration:none;text-transform:uppercase;letter-spacing:0.15em;border-radius:12px;">${label}</a>
      </td></tr>`;
    }

    case "secondary_link": {
      const url = resolveSecondaryUrl(block, event);
      const label = escape(block.label || "Ver mais");
      return `<tr><td align="center" style="padding:8px 32px 24px 32px;">
        <a href="${escape(url)}" style="display:inline-block;color:#71717a;font-size:12px;font-weight:700;text-decoration:none;text-transform:uppercase;letter-spacing:0.2em;">${label}</a>
      </td></tr>`;
    }

    case "image_with_link": {
      if (!block.image_url) return "";
      const maxW = block.max_width ?? 552;
      const alt = escape(block.alt || "");
      const inner = `<img src="${escape(block.image_url)}" alt="${alt}" width="${maxW}" style="display:block;width:100%;max-width:${maxW}px;height:auto;border-radius:8px;border:0;">`;
      const wrapped = block.link_url
        ? `<a href="${escape(block.link_url)}" style="text-decoration:none;display:block;">${inner}</a>`
        : inner;
      return `<tr><td align="center" style="padding:8px 32px;">${wrapped}</td></tr>`;
    }

    case "divider":
      return `<tr><td style="padding:8px 32px;"><div style="height:1px;background:rgba(255,255,255,0.08);"></div></td></tr>`;

    case "text": {
      const safe = sanitizeCustomHtml(block.html || "");
      return `<tr><td style="padding:8px 32px;color:#a1a1aa;font-size:14px;line-height:1.6;">${safe}</td></tr>`;
    }

    case "social_icons": {
      const enabled = (block.networks || []).filter((n) => n.enabled && n.url);
      if (enabled.length === 0) return "";
      const colors = [primary, accent, "#60a5fa", "#f472b6", "#34d399", "#fbbf24", "#a78bfa", "#fb923c"];
      const cells = enabled.map((n, i) => {
        const sep = i > 0 ? `<td style="padding:0 8px;color:#3f3f46;">·</td>` : "";
        return `${sep}<td style="padding:0 8px;"><a href="${escape(n.url)}" style="color:${colors[i % colors.length]};font-size:12px;font-weight:700;text-decoration:none;text-transform:uppercase;letter-spacing:0.1em;">${escape(n.label)}</a></td>`;
      }).join("");
      return `<tr><td align="center" style="padding:16px 32px 8px 32px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>${cells}</tr></table>
      </td></tr>`;
    }

    case "footer": {
      const txt = escape(block.text || settings.footer_text || "");
      const unsubscribe = block.include_unsubscribe !== false
        // Placeholder oficial E-goi: substituído por link rastreável no envio real.
        ? `<p style="margin:8px 0 0 0;font-size:11px;"><a href="[E-GOI_UNSUBSCRIBE_LINK]" style="color:#71717a;font-weight:700;text-decoration:underline;">Descadastrar-se</a></p>`
        : "";
      return `<tr><td align="center" style="padding:24px 32px 40px 32px;background:rgba(0,0,0,0.4);border-top:1px solid rgba(255,255,255,0.06);">
        <p style="margin:0;color:#52525b;font-size:11px;line-height:1.6;max-width:400px;">${txt}</p>
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
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark light">
<meta name="supported-color-schemes" content="dark light">
<title>${escape(event.eventTitle)} — ${brand}</title>
</head>
<body style="margin:0;padding:0;background:${bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#e5e5e5;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${bg};">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#080808;border:1px solid rgba(255,255,255,0.08);border-radius:16px;overflow:hidden;">
${customHeader ? `<tr><td style="padding:16px 24px 0 24px;">${customHeader}</td></tr>` : ""}
${rows}
${customFooter ? `<tr><td style="padding:0 24px 16px 24px;">${customFooter}</td></tr>` : ""}
</table>
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
