// Renderer plain-text (multipart/alternative). Extraído sem mudanças.
import { EMAIL_BLOCK_LIMITS, clamp } from "../emailBlocksLimits.ts";
import type { Block, EventAnnouncementData, EmailTemplateSettings, ArticleSummary, GlobalBlock } from "./types.ts";
import { expandGlobalRefs } from "./types.ts";
import { computePreheader } from "./preheader.ts";

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function renderBlockText(block: Block, event: EventAnnouncementData, settings: EmailTemplateSettings): string {
  if ((block as { hidden?: boolean }).hidden) return "";
  switch (block.kind) {
    case "header":
      return (settings.brand_name || "MDACCULA").toUpperCase();
    case "hero_image":
      return "";
    case "eyebrow":
      return (block.text || "").toUpperCase();
    case "title":
      return (event.eventTitle || "").toUpperCase();
    case "subtitle":
      return event.eventSubtitle || "";
    case "event_meta":
      return [
        "DATA E HORA:",
        `  ${event.dateLabel} — ${event.timeLabel}`,
        "LOCAL:",
        `  ${event.venueName} — ${event.cityState}`,
      ].join("\n");
    case "description":
      return event.description || "";
    case "article_summary":
      return "";
    case "cta_button": {
      const url =
        block.url_field === "vip_link" ? event.vipLink || event.ticketUrl :
        block.url_field === "event_url" ? event.eventUrl :
        block.url_field === "custom" ? (block.custom_url || event.ticketUrl) :
        event.ticketUrl;
      const label = block.label || event.ctaLabel || settings.cta_label || "Garantir ingresso";
      return `>> ${label.toUpperCase()}: ${url}`;
    }
    case "pix_button": {
      if (!event.pixWhatsAppUrl) return "";
      const label = block.label || "Comprar Sem Taxa via Pix";
      return `>> ${label.toUpperCase()}: ${event.pixWhatsAppUrl}`;
    }
    case "secondary_link": {
      const url =
        block.url_field === "event_url" ? event.eventUrl :
        block.url_field === "custom" ? (block.custom_url || event.agendaUrl) :
        event.agendaUrl;
      return `${block.label || "Ver mais"}: ${url}`;
    }
    case "image_with_link":
      return block.link_url ? `Link: ${block.link_url}` : "";
    case "divider":
      return "----";
    case "text":
      return stripHtml(block.html || "");
    case "social_icons": {
      const list = (block.networks || []).filter((n) => n.enabled && n.url);
      if (!list.length) return "";
      return "Siga: " + list.map((n) => `${n.label} (${n.url})`).join(" | ");
    }
    case "lineup": {
      const artists = (event.lineup || []).filter(Boolean);
      if (!artists.length) return "";
      return (block.title || "Line-up").toUpperCase() + ":\n  " + artists.join(", ");
    }
    case "countdown":
      return block.label || "Contagem regressiva";
    case "ticker":
      return (block.messages || []).filter(Boolean).join(" · ");
    case "static_map":
      return event.venueLat && event.venueLng
        ? `Mapa: https://www.google.com/maps/search/?api=1&query=${event.venueLat},${event.venueLng}`
        : "";
    case "weekend_grid": {
      const list = event.weekendEvents || [];
      if (!list.length) return "";
      const header = (block.title || "Agenda do fim de semana").toUpperCase();
      const rows = list.map((ev) =>
        `- ${ev.dayLabel}${ev.timeLabel ? " " + ev.timeLabel : ""} · ${ev.title} @ ${ev.venue}${ev.cityState ? " (" + ev.cityState + ")" : ""} — ${ev.eventUrl}`
      );
      return `${header}\n${rows.join("\n")}`;
    }
    case "event_grid": {
      const list = event.gridEvents || [];
      if (!list.length) return "";
      const header = (block.title || "Eventos selecionados").toUpperCase();
      const rows = list.map((ev) =>
        `- ${ev.dayLabel}${ev.timeLabel ? " " + ev.timeLabel : ""} · ${ev.title} @ ${ev.venue} — ${ev.ticketUrl || ev.eventUrl}`
      );
      return `${header}\n${rows.join("\n")}`;
    }
    case "dedge_block": {
      const d = event.dedge;
      if (!d) return "";
      const nights = (d.nights || []).filter((n) => n.enabled).map((n) => `  - ${n.label}: ${n.url}`);
      return `D.EDGE\n${d.title || ""}\n${d.description || ""}\n${nights.join("\n")}`.trim();
    }
    case "weekly_hero": {
      const first = event.weekendEvents?.[0];
      if (!first) return "";
      return `${(block.eyebrow || "Destaque").toUpperCase()}: ${first.title} — ${first.eventUrl}`;
    }
    case "blog_posts_list": {
      const posts = (event.blogPosts || []).slice(0, clamp(block.max_items, EMAIL_BLOCK_LIMITS.blogPostsList.minItems, EMAIL_BLOCK_LIMITS.blogPostsList.maxItems, EMAIL_BLOCK_LIMITS.blogPostsList.defaultItems));
      if (!posts.length) return "";
      const header = (block.title || "No blog").toUpperCase();
      const rows = posts.map((p) => `- ${p.title} — ${p.url}`);
      return `${header}\n${rows.join("\n")}`;
    }
    case "footer":
      return block.text || settings.footer_text || "";
    case "global_ref":
      return "";
    default:
      return "";
  }
}

/**
 * Versão plain-text do template para o campo `content.text` da E-goi.
 * Melhora entregabilidade (multipart), acessibilidade e fallback em clientes sem HTML.
 */
export function renderBlockedTemplateText(
  blocks: Block[],
  event: EventAnnouncementData,
  settings: EmailTemplateSettings | null | undefined,
  _article?: ArticleSummary | null,
  opts?: { globals?: Map<string, GlobalBlock> | Record<string, GlobalBlock> | null; preheader?: string | null },
): string {
  const s: EmailTemplateSettings = {
    brand_name: settings?.brand_name || "MDACCULA",
    footer_text: settings?.footer_text || "",
    cta_label: settings?.cta_label || "Garantir ingresso",
  };
  const resolved = expandGlobalRefs(blocks, opts?.globals ?? null);
  const parts = resolved.map((b) => renderBlockText(b, event, s)).filter((s) => s && s.trim());
  const body = parts.join("\n\n");
  const preheader = opts?.preheader ?? computePreheader(event);
  const footer = "\n\n---\nVocê recebeu este e-mail porque assina a lista MDAccula.";
  return `${preheader}\n\n${body}${footer}`.replace(/\n{3,}/g, "\n\n").trim();
}
