// Utilidades puras usadas pelo renderer HTML. Extraído sem mudanças.
import type { Block, EventAnnouncementData } from "./types.ts";

export const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

export const sanitizeCustomHtml = (raw: string) =>
  raw
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/on\w+\s*=\s*"[^"]*"/gi, "")
    .replace(/on\w+\s*=\s*'[^']*'/gi, "")
    .replace(/javascript:/gi, "");

/**
 * Injeta estilo inline nas tags que o editor rich-text do bloco `text`
 * (Tiptap) gera sem nenhum atributo `style` — `<p>`, `<ul>`/`<ol>`/`<li>`,
 * `<blockquote>` e `<h2>`. Sem isso, clientes de e-mail (principalmente
 * Outlook desktop, que ignora quase todo CSS não-inline) renderizam
 * parágrafos/listas sem respiro nenhum entre si — dando a impressão de que
 * "quebra de linha não funciona", mesmo a estrutura HTML estando correta.
 * Só aplica quando a tag ainda não tem `style=` (Tiptap nunca gera um, mas
 * evita dobrar estilo se isso mudar no futuro).
 */
export const applyEmailSafeProseStyles = (html: string, color: string) =>
  html
    .replace(/<p(?![^>]*style=)([^>]*)>/gi, '<p$1 style="margin:0 0 12px 0;">')
    .replace(/<h2(?![^>]*style=)([^>]*)>/gi, `<h2$1 style="margin:0 0 10px 0;color:${color};font-size:18px;font-weight:800;line-height:1.3;">`)
    .replace(/<ul(?![^>]*style=)([^>]*)>/gi, '<ul$1 style="margin:0 0 12px 0;padding-left:20px;">')
    .replace(/<ol(?![^>]*style=)([^>]*)>/gi, '<ol$1 style="margin:0 0 12px 0;padding-left:20px;">')
    .replace(/<li(?![^>]*style=)([^>]*)>/gi, '<li$1 style="margin:0 0 4px 0;">')
    .replace(/<blockquote(?![^>]*style=)([^>]*)>/gi, `<blockquote$1 style="margin:0 0 12px 0;padding:8px 0 8px 14px;border-left:3px solid ${color};font-style:italic;opacity:0.9;">`);

export const resolveCtaUrl = (block: Extract<Block, { kind: "cta_button" }>, event: EventAnnouncementData) => {
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

export const resolveSecondaryUrl = (block: Extract<Block, { kind: "secondary_link" }>, event: EventAnnouncementData) => {
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

/**
 * Reescreve URL de imagem para compatibilidade com Outlook desktop.
 *
 * Outlook 2016+ (motor Word) NÃO suporta WebP → mostra "X" no lugar do flyer.
 * Solução: passar URLs .webp por um proxy (wsrv.nl, gratuito, cache de borda) que
 * converte para JPG on-the-fly. Outros formatos e placeholders/data-URIs passam intactos.
 * Aplicado APENAS no HTML de e-mail — o site continua servindo WebP nativo.
 */
export function proxyForEmail(url: string): string {
  if (!url) return url;
  if (!/^https?:\/\//i.test(url)) return url;
  if (!/\.webp(\?|$)/i.test(url)) return url;
  const clean = url.replace(/^https?:\/\//i, "");
  return `https://wsrv.nl/?url=${encodeURIComponent(clean)}&output=jpg&q=85`;
}

/**
 * Ícones padrão do bloco `social_icons` (style: "icon") por id de rede conhecida.
 * PNG 64x64, hospedados como assets estáticos do site (public/email-icons/) —
 * sem depender de bucket/auth. `icon_url` por rede sobrescreve o padrão.
 */
export const DEFAULT_SOCIAL_ICON_URLS: Record<string, string> = {
  instagram: "https://mdaccula.com/email-icons/instagram.png",
  youtube: "https://mdaccula.com/email-icons/youtube.png",
  tiktok: "https://mdaccula.com/email-icons/tiktok.png",
  soundcloud: "https://mdaccula.com/email-icons/soundcloud.png",
  spotify: "https://mdaccula.com/email-icons/spotify.png",
  linktree: "https://mdaccula.com/email-icons/linktree.png",
  whatsapp: "https://mdaccula.com/email-icons/whatsapp.png",
};
