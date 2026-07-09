/**
 * Template de e-mail "Novo evento no MDAccula" — Dark Neon Identity
 *
 * Renderiza HTML table-based com inline styles, compatível com Gmail, Outlook,
 * Apple Mail e clientes móveis. Nenhum CSS moderno (grid/flex), nenhum JS,
 * nenhuma web font custom (fallback web-safe).
 *
 * REGRA DE MARCA: o flyer NUNCA é cortado (usa max-width 100% + height auto).
 */

export interface EventAnnouncementData {
  /** Nome do evento (título principal). */
  eventTitle: string;
  /** Subtítulo curto ou tagline (opcional). */
  eventSubtitle?: string;
  /** URL absoluta do flyer (idealmente Bunny CDN). */
  flyerUrl: string;
  /** Data formatada em português: "25 de Maio". */
  dateLabel: string;
  /** Horário formatado: "22h às 06h" ou "23:00". */
  timeLabel: string;
  /** Nome da casa/local. */
  venueName: string;
  /** Cidade e estado: "Cuiabá-MT". */
  cityState: string;
  /** Descrição curta 1-3 linhas. */
  description: string;
  /** URL absoluta do ingresso (CTA principal). */
  ticketUrl: string;
  /** URL da página do evento no site MDAccula. */
  eventUrl: string;
  /** URL da agenda completa (secundário). */
  agendaUrl: string;
  /** URL do Instagram. */
  instagramUrl: string;
  /** URL do YouTube. */
  youtubeUrl: string;
  /** URL do TikTok. */
  tiktokUrl: string;
  /** URL de descadastro (obrigatório por CAN-SPAM/LGPD). */
  unsubscribeUrl: string;
}

const escape = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export function renderEventAnnouncementEmail(data: EventAnnouncementData): string {
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

  const preheader = `${escape(eventTitle)} — ${escape(dateLabel)} em ${escape(venueName)}, ${escape(cityState)}`;

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark light">
<meta name="supported-color-schemes" content="dark light">
<title>${escape(eventTitle)} — MDAccula</title>
</head>
<body style="margin:0;padding:0;background:#050505;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#e5e5e5;">
<!-- Preheader (hidden preview text) -->
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${preheader}</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#050505;">
<tr><td align="center" style="padding:24px 12px;">

<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#080808;border:1px solid rgba(255,255,255,0.08);border-radius:16px;overflow:hidden;">

  <!-- Header / Logo -->
  <tr><td align="center" style="padding:32px 24px 24px 24px;">
    <div style="font-size:22px;font-weight:800;letter-spacing:-0.02em;text-transform:uppercase;font-style:italic;">
      <span style="color:#ffffff;">MD</span><span style="color:#c084fc;">A</span><span style="color:#e879f9;">C</span><span style="color:#f472b6;">C</span><span style="color:#f472b6;">U</span><span style="color:#60a5fa;">L</span><span style="color:#60a5fa;">A</span>
    </div>
  </td></tr>

  <!-- Hero Flyer -->
  <tr><td align="center" style="padding:0 24px;">
    <a href="${escape(eventUrl)}" style="text-decoration:none;display:block;">
      <img src="${escape(flyerUrl)}" alt="${escape(eventTitle)}" width="552" style="display:block;width:100%;max-width:552px;height:auto;border-radius:12px;border:1px solid rgba(255,255,255,0.08);background:#111;">
    </a>
  </td></tr>

  <!-- Event Info -->
  <tr><td style="padding:32px 32px 8px 32px;">
    <p style="margin:0 0 8px 0;color:#c084fc;font-size:11px;font-weight:600;letter-spacing:0.2em;text-transform:uppercase;">Novo evento confirmado</p>
    <h1 style="margin:0 0 8px 0;color:#ffffff;font-size:28px;line-height:1.15;font-weight:800;letter-spacing:-0.01em;">${escape(eventTitle)}</h1>
    ${eventSubtitle ? `<p style="margin:0;color:#a1a1aa;font-size:16px;line-height:1.5;">${escape(eventSubtitle)}</p>` : ""}
  </td></tr>

  <!-- Metadata -->
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

  <!-- Description -->
  <tr><td style="padding:8px 32px 24px 32px;">
    <p style="margin:0;color:#a1a1aa;font-size:15px;line-height:1.6;">${escape(description)}</p>
  </td></tr>

  <!-- CTA -->
  <tr><td align="center" style="padding:8px 32px 24px 32px;">
    <!--[if mso]>
    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${escape(ticketUrl)}" style="height:56px;v-text-anchor:middle;width:536px;" arcsize="14%" strokecolor="#7c3aed" fillcolor="#a855f7">
      <w:anchorlock/>
      <center style="color:#ffffff;font-family:Arial,sans-serif;font-size:16px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;">Garantir ingresso</center>
    </v:roundrect>
    <![endif]-->
    <!--[if !mso]><!-- -->
    <a href="${escape(ticketUrl)}" style="display:block;width:100%;padding:18px 24px;box-sizing:border-box;background:linear-gradient(90deg,#9333ea 0%,#db2777 50%,#2563eb 100%);color:#ffffff;font-size:16px;font-weight:900;text-align:center;text-decoration:none;text-transform:uppercase;letter-spacing:0.15em;border-radius:12px;">Garantir ingresso</a>
    <!--<![endif]-->
    <a href="${escape(agendaUrl)}" style="display:block;margin-top:20px;color:#71717a;font-size:12px;font-weight:700;text-decoration:none;text-transform:uppercase;letter-spacing:0.2em;">Ver agenda completa no site</a>
  </td></tr>

  <!-- Footer -->
  <tr><td align="center" style="padding:32px 32px 40px 32px;background:rgba(0,0,0,0.4);border-top:1px solid rgba(255,255,255,0.06);">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 24px auto;">
      <tr>
        <td style="padding:0 8px;"><a href="${escape(instagramUrl)}" style="color:#c084fc;font-size:12px;font-weight:700;text-decoration:none;text-transform:uppercase;letter-spacing:0.1em;">Instagram</a></td>
        <td style="padding:0 8px;color:#3f3f46;">·</td>
        <td style="padding:0 8px;"><a href="${escape(youtubeUrl)}" style="color:#f472b6;font-size:12px;font-weight:700;text-decoration:none;text-transform:uppercase;letter-spacing:0.1em;">YouTube</a></td>
        <td style="padding:0 8px;color:#3f3f46;">·</td>
        <td style="padding:0 8px;"><a href="${escape(tiktokUrl)}" style="color:#60a5fa;font-size:12px;font-weight:700;text-decoration:none;text-transform:uppercase;letter-spacing:0.1em;">TikTok</a></td>
      </tr>
    </table>
    <p style="margin:0 0 12px 0;color:#52525b;font-size:11px;line-height:1.6;max-width:400px;">
      Você recebeu este e-mail porque assinou a lista MDAccula — agenda cultural de música eletrônica de Cuiabá-MT.
    </p>
    <p style="margin:0;font-size:11px;">
      <a href="${escape(unsubscribeUrl)}" style="color:#71717a;font-weight:700;text-decoration:underline;">Descadastrar-se</a>
    </p>
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
  eventSubtitle: "Uma imersão visual e sonora exclusiva no coração de Cuiabá.",
  flyerUrl:
    "https://mdaccula.b-cdn.net/event-images/placeholder-flyer.jpg",
  dateLabel: "Sábado, 25 de Maio",
  timeLabel: "22h às 06h",
  venueName: "Musiva",
  cityState: "Cuiabá-MT",
  description:
    "Prepare-se para uma noite intensa com line-up selecionado, sistema de som premium e visuais imersivos. Ingressos limitados, primeiro lote em promoção.",
  ticketUrl: "https://mdaccula.com/eventos/neon-garden-melodic-techno",
  eventUrl: "https://mdaccula.com/eventos/neon-garden-melodic-techno",
  agendaUrl: "https://mdaccula.com/eventos",
  instagramUrl: "https://instagram.com/mdaccula",
  youtubeUrl: "https://youtube.com/@mdaccula",
  tiktokUrl: "https://tiktok.com/@mdaccula",
  unsubscribeUrl: "https://mdaccula.com/descadastrar?token=EXAMPLE",
};
