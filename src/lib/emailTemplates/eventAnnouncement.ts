/**
 * Template de e-mail "Novo evento no MDAccula" — Dark Neon Identity
 *
 * HTML table-based com inline styles, compatível com Gmail, Outlook,
 * Apple Mail e clientes móveis. Sem CSS moderno, sem JS.
 *
 * Aceita `settings` opcional para customização de marca (logo, cores, textos,
 * toggles de blocos, HTML extra do editor de template).
 */

/** Item da agenda do fim de semana (bloco `weekend_grid`). */
export interface WeekendEventItem {
  id?: string;
  title: string;
  dayLabel: string;      // "Sex, 24/05" ou "Sexta"
  timeLabel?: string;    // "22h"
  venue: string;
  cityState?: string;
  imageUrl: string;
  eventUrl: string;
  ticketUrl?: string;
  articleUrl?: string;   // matéria ligada, se houver
  /** CTA custom por evento (ex.: DEDGE = "Enviar Nomes Para Lista"). */
  ctaLabel?: string;
  /** Múltiplos CTAs quando o card representa vários eventos (ex.: DEDGE quinta/sex/sáb/dom). */
  ctas?: Array<{ label: string; url: string; dayLabel?: string; timeLabel?: string }>;
}

/** Config de uma noite do bloco Dedge (segundas até domingo, opcional). */
export interface DedgeNightConfig {
  label: string;         // "Sexta — Progressive House"
  url: string;
  enabled: boolean;
}

/** Config do bloco `dedge_block` — encerramento fixo da newsletter de FDS. */
export interface DedgeBlockData {
  imageUrl: string;
  eyebrow?: string;      // "Toda semana"
  title?: string;        // "Dedge — sua residência da semana"
  description?: string;
  nights: DedgeNightConfig[];
  primaryUrl?: string;   // botão principal (ex.: todos os eventos Dedge)
  primaryLabel?: string;
}
/** Item de matéria/post do blog (bloco `blog_posts_list`). */
export interface BlogPostItem {
  id?: string;
  title: string;
  excerpt?: string;
  imageUrl?: string;
  url: string;
  publishedLabel?: string; // "há 2 dias" ou "12 mai"
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
  /** Line-up do evento (artistas). Usado pelo bloco `lineup`. */
  lineup?: string[];
  /** Data/hora ISO do evento (usada pelo bloco `countdown` para virada de lote). */
  eventStartIso?: string;
  /** Deadline explícito para countdown (ISO). Ex.: virada de lote às 23:59 SP. */
  ticketBatchDeadlineIso?: string;
  /** Latitude do venue — usada pelo bloco `static_map`. */
  venueLat?: number;
  /** Longitude do venue — usada pelo bloco `static_map`. */
  venueLng?: number;
  /** Eventos do fim de semana / semana (usado por `weekend_grid` e `weekly_hero`). */
  weekendEvents?: WeekendEventItem[];
  /** Últimos posts do blog (usado por `blog_posts_list`). */
  blogPosts?: BlogPostItem[];
  /** Configuração do bloco Dedge (residência semanal). */
  dedge?: DedgeBlockData;
  /** Link VIP alternativo — usado por `cta_button` com url_field="vip_link". */
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

const DEFAULTS: Required<Omit<EmailTemplateSettings, "logo_url" | "custom_html_header" | "custom_html_footer" | "instagram_url" | "youtube_url" | "tiktok_url">> & {
  logo_url: string | null;
  custom_html_header: string | null;
  custom_html_footer: string | null;
  instagram_url: string;
  youtube_url: string;
  tiktok_url: string;
} = {
  brand_name: "MDACCULA",
  logo_url: null,
  primary_color: "#a855f7",
  accent_color: "#ec4899",
  background_color: "#050505",
  footer_text:
    "Você recebeu este e-mail porque assinou a lista MDAccula — agenda cultural de música eletrônica de São Paulo-SP.",
  cta_label: "Garantir ingresso",
  instagram_url: "https://instagram.com/mdaccula",
  youtube_url: "https://youtube.com/@mdaccula",
  tiktok_url: "https://tiktok.com/@mdaccula",
  show_subtitle: true,
  show_description: true,
  show_socials: true,
  show_secondary_link: true,
  secondary_link_label: "Ver agenda completa no site",
  custom_html_header: null,
  custom_html_footer: null,
};

const escape = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/** Sanitização leve para HTML customizado do editor. Remove tags e handlers perigosos. */
const sanitizeCustomHtml = (raw: string) =>
  raw
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/on\w+\s*=\s*"[^"]*"/gi, "")
    .replace(/on\w+\s*=\s*'[^']*'/gi, "")
    .replace(/javascript:/gi, "");

export function renderEventAnnouncementEmail(
  data: EventAnnouncementData,
  settingsInput?: EmailTemplateSettings | null,
  opts?: { preheader?: string | null },
): string {
  const s = { ...DEFAULTS, ...(settingsInput ?? {}) };

  const {
    eventTitle,
    eventSubtitle,
    flyerUrl,
    dateLabel,
    timeLabel,
    venueName,
    cityState,
    description,
    ticketUrl,
    eventUrl,
    agendaUrl,
    instagramUrl,
    youtubeUrl,
    tiktokUrl,
    unsubscribeUrl,
  } = data;

  const preheader = escape(opts?.preheader ?? `${eventTitle} — ${dateLabel} em ${venueName}, ${cityState}`);
  const bg = escape(s.background_color);
  const primary = escape(s.primary_color);
  const accent = escape(s.accent_color);
  const brand = escape(s.brand_name);
  const ctaLabel = escape(s.cta_label);
  const gradient = `linear-gradient(90deg, ${primary} 0%, ${accent} 50%, #2563eb 100%)`;

  const headerBlock = s.logo_url
    ? `<img src="${escape(s.logo_url)}" alt="${brand}" style="display:block;max-height:64px;width:auto;margin:0 auto;">`
    : `<div style="font-size:22px;font-weight:800;letter-spacing:-0.02em;text-transform:uppercase;font-style:italic;color:#ffffff;">${brand}</div>`;

  const socialLinks = [
    s.instagram_url ? { label: "Instagram", url: s.instagram_url, color: primary } : null,
    s.youtube_url ? { label: "YouTube", url: s.youtube_url, color: accent } : null,
    s.tiktok_url ? { label: "TikTok", url: s.tiktok_url, color: "#60a5fa" } : null,
  ].filter(Boolean) as { label: string; url: string; color: string }[];

  const customHeader = s.custom_html_header ? sanitizeCustomHtml(s.custom_html_header) : "";
  const customFooter = s.custom_html_footer ? sanitizeCustomHtml(s.custom_html_footer) : "";

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark light">
<meta name="supported-color-schemes" content="dark light">
<title>${escape(eventTitle)} — ${brand}</title>
</head>
<body style="margin:0;padding:0;background:${bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#e5e5e5;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${preheader}</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${bg};">
<tr><td align="center" style="padding:24px 12px;">

<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#080808;border:1px solid rgba(255,255,255,0.08);border-radius:16px;overflow:hidden;">

  ${customHeader ? `<tr><td style="padding:16px 24px 0 24px;">${customHeader}</td></tr>` : ""}

  <tr><td align="center" style="padding:32px 24px 24px 24px;">${headerBlock}</td></tr>

  <tr><td align="center" style="padding:0 24px;">
    <a href="${escape(eventUrl)}" style="text-decoration:none;display:block;">
      <img src="${escape(flyerUrl)}" alt="${escape(eventTitle)}" width="552" style="display:block;width:100%;max-width:552px;height:auto;border-radius:12px;border:1px solid rgba(255,255,255,0.08);background:#111;">
    </a>
  </td></tr>

  <tr><td style="padding:32px 32px 8px 32px;">
    <p style="margin:0 0 8px 0;color:${primary};font-size:11px;font-weight:600;letter-spacing:0.2em;text-transform:uppercase;">Novo evento confirmado</p>
    <h1 style="margin:0 0 8px 0;color:#ffffff;font-size:28px;line-height:1.15;font-weight:800;letter-spacing:-0.01em;">${escape(eventTitle)}</h1>
    ${s.show_subtitle && eventSubtitle ? `<p style="margin:0;color:#a1a1aa;font-size:16px;line-height:1.5;">${escape(eventSubtitle)}</p>` : ""}
  </td></tr>

  <tr><td style="padding:16px 32px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid rgba(255,255,255,0.06);border-bottom:1px solid rgba(255,255,255,0.06);">
      <tr>
        <td width="50%" style="padding:20px 0;vertical-align:top;">
          <div style="color:#ffffff;font-size:11px;font-weight:700;letter-spacing:-0.01em;text-transform:uppercase;margin-bottom:6px;">Data e hora</div>
          <div style="color:#a1a1aa;font-size:14px;line-height:1.5;">${escape(dateLabel)}<br>${escape(timeLabel)}</div>
        </td>
        <td width="50%" align="right" style="padding:20px 0;vertical-align:top;">
          <div style="color:#ffffff;font-size:11px;font-weight:700;letter-spacing:-0.01em;text-transform:uppercase;margin-bottom:6px;">Local</div>
          <div style="color:#a1a1aa;font-size:14px;line-height:1.5;">${escape(venueName)}<br>${escape(cityState)}</div>
        </td>
      </tr>
    </table>
  </td></tr>

  ${s.show_description ? `<tr><td style="padding:8px 32px 24px 32px;"><p style="margin:0;color:#a1a1aa;font-size:15px;line-height:1.6;">${escape(description)}</p></td></tr>` : ""}

  <tr><td align="center" style="padding:8px 32px 24px 32px;">
    <a href="${escape(ticketUrl)}" style="display:block;width:100%;padding:18px 24px;box-sizing:border-box;background:${gradient};color:#ffffff;font-size:16px;font-weight:900;text-align:center;text-decoration:none;text-transform:uppercase;letter-spacing:0.15em;border-radius:12px;">${ctaLabel}</a>
    ${s.show_secondary_link ? `<a href="${escape(agendaUrl)}" style="display:block;margin-top:20px;color:#71717a;font-size:12px;font-weight:700;text-decoration:none;text-transform:uppercase;letter-spacing:0.2em;">${escape(s.secondary_link_label)}</a>` : ""}
  </td></tr>

  <tr><td align="center" style="padding:32px 32px 40px 32px;background:rgba(0,0,0,0.4);border-top:1px solid rgba(255,255,255,0.06);">
    ${
      s.show_socials && socialLinks.length > 0
        ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 24px auto;"><tr>${socialLinks
            .map(
              (l, i) =>
                `${i > 0 ? `<td style="padding:0 8px;color:#3f3f46;">·</td>` : ""}<td style="padding:0 8px;"><a href="${escape(
                  l.url,
                )}" style="color:${l.color};font-size:12px;font-weight:700;text-decoration:none;text-transform:uppercase;letter-spacing:0.1em;">${l.label}</a></td>`,
            )
            .join("")}</tr></table>`
        : ""
    }
    <p style="margin:0 0 12px 0;color:#52525b;font-size:11px;line-height:1.6;max-width:400px;">${escape(s.footer_text)}</p>
    <p style="margin:0;font-size:11px;"><a href="${escape(unsubscribeUrl)}" style="color:#71717a;font-weight:700;text-decoration:underline;">Descadastrar-se</a></p>
    ${customFooter ? `<div style="margin-top:16px;">${customFooter}</div>` : ""}
  </td></tr>

</table>

</td></tr>
</table>
</body>
</html>`;
}

/** Mock realista para preview e testes. */
export const MOCK_EVENT_DATA: EventAnnouncementData = {
  eventTitle: "NEON GARDEN: MELODIC TECHNO",
  eventSubtitle: "Uma imersão visual e sonora exclusiva no coração de São Paulo.",
  flyerUrl: "https://placehold.co/1080x1350/1a1a2e/ffffff/png?text=Flyer+do+Evento",
  dateLabel: "Sábado, 25 de Maio",
  timeLabel: "22h às 06h",
  venueName: "Musiva",
  cityState: "São Paulo-SP",
  description:
    "Prepare-se para uma noite intensa com line-up selecionado, sistema de som premium e visuais imersivos.\nIngressos limitados, primeiro lote em promoção.\nAcesso permitido apenas para maiores de 18 anos.",
  ticketUrl: "https://mdaccula.com/eventos/neon-garden-melodic-techno",
  eventUrl: "https://mdaccula.com/eventos/neon-garden-melodic-techno",
  agendaUrl: "https://mdaccula.com/eventos",
  instagramUrl: "https://instagram.com/mdaccula",
  youtubeUrl: "https://youtube.com/@mdaccula",
  tiktokUrl: "https://tiktok.com/@mdaccula",
  unsubscribeUrl: "https://mdaccula.com/descadastrar?token=EXAMPLE",
  lineup: ["ANNA", "Adam Beyer", "Charlotte de Witte", "Amelie Lens", "Local Support"],
  eventStartIso: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
  ticketBatchDeadlineIso: (() => {
    const d = new Date();
    d.setHours(23, 59, 0, 0);
    return d.toISOString();
  })(),
  venueLat: -15.601411,
  venueLng: -56.097892,
  weekendEvents: [
    {
      id: "w1",
      title: "NEON GARDEN: MELODIC TECHNO",
      dayLabel: "Sexta, 24/05",
      timeLabel: "22h",
      venue: "Musiva",
      cityState: "São Paulo-SP",
      imageUrl: "https://mdaccula.b-cdn.net/event-images/placeholder-flyer.jpg",
      eventUrl: "https://mdaccula.com/eventos/neon-garden",
      ticketUrl: "https://mdaccula.com/eventos/neon-garden",
      articleUrl: "https://mdaccula.com/blog/neon-garden-materia",
    },
    {
      id: "w2",
      title: "OPEN AIR SUNSET",
      dayLabel: "Sábado, 25/05",
      timeLabel: "17h",
      venue: "Rooftop 121",
      cityState: "São Paulo-SP",
      imageUrl: "https://mdaccula.b-cdn.net/event-images/placeholder-flyer.jpg",
      eventUrl: "https://mdaccula.com/eventos/open-air-sunset",
      ticketUrl: "https://mdaccula.com/eventos/open-air-sunset",
    },
    {
      id: "w3",
      title: "AFTER SUNDAY: DEEP HOUSE",
      dayLabel: "Domingo, 26/05",
      timeLabel: "16h",
      venue: "Casa da Praia",
      cityState: "São Paulo-SP",
      imageUrl: "https://mdaccula.b-cdn.net/event-images/placeholder-flyer.jpg",
      eventUrl: "https://mdaccula.com/eventos/after-sunday",
    },
  ],
  blogPosts: [
    {
      id: "p1",
      title: "Charlotte de Witte revela setlist inédito em São Paulo",
      excerpt: "A rainha do techno passa por São Paulo com um set exclusivo de melodic techno.",
      imageUrl: "https://mdaccula.b-cdn.net/event-images/placeholder-flyer.jpg",
      url: "https://mdaccula.com/blog/charlotte-de-witte-sao-paulo",
      publishedLabel: "há 2 dias",
      category: "Matéria",
    },
    {
      id: "p2",
      title: "Guia da cena eletrônica em São Paulo — 2025",
      excerpt: "Da progressive ao tech house: os coletivos, DJs e casas que estão moldando a cena local.",
      imageUrl: "https://mdaccula.b-cdn.net/event-images/placeholder-flyer.jpg",
      url: "https://mdaccula.com/blog/guia-cena-eletronica-sao-paulo-2025",
      publishedLabel: "há 5 dias",
      category: "Guia",
    },
    {
      id: "p3",
      title: "Musiva completa 2 anos: os melhores momentos",
      excerpt: "Duas temporadas de line-ups internacionais, sistema Function-One e produção audiovisual autoral.",
      imageUrl: "https://mdaccula.b-cdn.net/event-images/placeholder-flyer.jpg",
      url: "https://mdaccula.com/blog/musiva-2-anos",
      publishedLabel: "há 1 semana",
      category: "Notícia",
    },
  ],
  dedge: {
    imageUrl: "https://mdaccula.b-cdn.net/event-images/dedge-hero.jpg",
    eyebrow: "TODA SEMANA · RESIDÊNCIA",
    title: "Dedge — sua noite fixa da semana",
    description: "Três noites por semana com residentes rotativos e line-ups selecionados. Escolha sua vibe:",
    nights: [
      { label: "Quinta — Progressive & Deep", url: "https://mdaccula.com/eventos/dedge-quinta", enabled: true },
      { label: "Sexta — Melodic Techno", url: "https://mdaccula.com/eventos/dedge-sexta", enabled: true },
      { label: "Sábado — Tech House", url: "https://mdaccula.com/eventos/dedge-sabado", enabled: true },
    ],
    primaryUrl: "https://mdaccula.com/eventos?venue=dedge",
    primaryLabel: "Ver todos os eventos Dedge",
  },
};
