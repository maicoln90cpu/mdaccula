// Fallback HTML legado do weekly-digest-draft. Extraído do index.ts na Onda 29
// para manter o handler abaixo de 600 linhas. Comportamento preservado 1:1.
import { proxyForEmail } from "../emailBlocks.ts";

export type EventRow = {
  id: string; title: string; slug: string; date: string; end_date: string | null; time: string | null;
  venue: string; location_city: string; location_state: string;
  image_url: string | null; ticket_link: string | null; cta_type: string | null;
  lineup?: string[] | null;
};

export type PostRow = {
  id: string; title: string; slug: string; excerpt: string | null;
  image_url: string | null; published_at: string | null;
};

export type BrandSettings = {
  brand_name?: string; logo_url?: string | null;
  primary_color?: string; accent_color?: string; background_color?: string;
  footer_text?: string;
  instagram_url?: string | null; youtube_url?: string | null; tiktok_url?: string | null;
};

const SITE_URL = "https://mdaccula.com";

export const escapeHtml = (s: string) =>
  String(s || "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

export function formatDatePt(dateStr: string, timeStr?: string | null) {
  try {
    const d = new Date(`${dateStr}T${(timeStr || "00:00").slice(0, 5)}:00`);
    return d.toLocaleDateString("pt-BR", {
      weekday: "short", day: "2-digit", month: "short",
    });
  } catch {
    return dateStr;
  }
}

export function renderDigestHtml(
  events: EventRow[],
  posts: PostRow[],
  settings: BrandSettings,
  rangeLabel: string,
): string {
  const primary = settings.primary_color || "#a855f7";
  const accent = settings.accent_color || "#ec4899";
  const bg = settings.background_color || "#050505";
  const brand = settings.brand_name || "MDACCULA";
  const footer = settings.footer_text ||
    "Você recebeu este e-mail porque assinou a lista MDAccula — agenda cultural de música eletrônica de São Paulo-SP.";
  const logo = settings.logo_url
    ? `<img src="${escapeHtml(proxyForEmail(settings.logo_url))}" alt="${escapeHtml(brand)}" width="140" height="42" style="display:block;height:42px;width:auto;border:0;outline:none;" />`
    : `<div style="font-family:Arial,sans-serif;font-size:22px;font-weight:800;letter-spacing:2px;color:#fff;">${escapeHtml(brand)}</div>`;

  const eventCards = events.length === 0
    ? `<tr><td style="padding:12px 20px;color:#bbb;font-family:Arial,sans-serif;font-size:14px;">Nenhum evento confirmado para os próximos 7 dias — fique de olho no site.</td></tr>`
    : events.map((e) => {
        const url = `${SITE_URL}/eventos/${escapeHtml(e.slug)}`;
        const ticket = e.ticket_link || url;
        const img = proxyForEmail(e.image_url || `${SITE_URL}/placeholder.svg`);
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
                <div style="font-size:11px;letter-spacing:1px;text-transform:uppercase;color:${accent};font-weight:700;">${escapeHtml(formatDatePt(e.date, e.time))} · ${escapeHtml((e.time || "").slice(0,5) || "22h")}</div>
                <div style="font-size:16px;font-weight:800;color:#fff;margin:4px 0 4px 0;line-height:1.25;">
                  <a href="${url}" target="_blank" style="color:#fff;text-decoration:none;">${escapeHtml(e.title)}</a>
                </div>
                <div style="font-size:12px;color:#bbb;margin-bottom:8px;">${escapeHtml(e.venue)} · ${escapeHtml(e.location_city)}-${escapeHtml(e.location_state)}</div>
                <a href="${ticket}" target="_blank" style="display:inline-block;background:${primary};color:#fff;font-size:12px;font-weight:700;padding:8px 14px;border-radius:6px;text-decoration:none;">Ver detalhes</a>
              </td>
            </tr>
          </table>
        </td></tr>`;
      }).join("");

  const postCards = posts.length === 0
    ? ""
    : `
    <tr><td style="padding:24px 20px 6px 20px;font-family:Arial,sans-serif;">
      <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${accent};font-weight:700;">Matérias em alta</div>
    </td></tr>` + posts.map((p) => {
      const url = `${SITE_URL}/blog/${escapeHtml(p.slug)}`;
      const img = proxyForEmail(p.image_url || `${SITE_URL}/placeholder.svg`);
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
              ${p.excerpt ? `<div style="font-size:12px;color:#bbb;margin-top:4px;line-height:1.4;">${escapeHtml(p.excerpt.slice(0, 140))}${p.excerpt.length > 140 ? "…" : ""}</div>` : ""}
            </td>
          </tr>
        </table>
      </td></tr>`;
    }).join("");

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
        <p style="font-size:14px;color:#bbb;margin:0;">Os destaques da agenda e do blog nos próximos dias em São Paulo.</p>
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
