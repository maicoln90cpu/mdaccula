// Família "basic" — blocos textuais e estruturais simples.
// Extraído de renderBlock.ts (Onda 23) sem alterar HTML gerado.
import type { Block, RenderContext } from "../types.ts";
import { escape, sanitizeCustomHtml, applyEmailSafeProseStyles, proxyForEmail } from "../utils.ts";
import type { RenderStyle } from "./style.ts";

export function renderBasicBlock(
  block: Block,
  ctx: RenderContext,
  style: RenderStyle,
): string | null {
  const { event, article, settings } = ctx;
  const { primary, brand } = style;

  switch (block.kind) {
    case "header": {
      const height = Math.max(24, Math.min(200, block.logo_height ?? 64));
      const align = block.align ?? "center";
      const pad = Math.max(0, Math.min(80, block.padding_y ?? 32));
      const padBottom = Math.max(0, Math.min(80, block.padding_bottom ?? 0));
      const bg = block.bg_color ? ` background-color:${escape(block.bg_color)};` : "";
      const inner = settings.logo_url
        ? `<img src="${escape(proxyForEmail(settings.logo_url))}" alt="${brand}" height="${height}" border="0" style="display:inline-block;height:${height}px;max-height:${height}px;width:auto;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;">`
        : `<div style="font-size:22px;font-weight:800;letter-spacing:-0.02em;text-transform:uppercase;font-style:italic;color:#ffffff;">${brand}</div>`;
      return `<tr><td align="${align}" style="padding:${pad}px 24px ${Math.max(8, padBottom || pad - 8)}px 24px;text-align:${align};${bg}">${inner}</td></tr>`;
    }

    case "hero_image": {
      const maxW = Math.max(300, Math.min(600, block.max_width ?? 552));
      const radius = block.border_radius ?? 12;
      const border = block.border_color ? `1px solid ${escape(block.border_color)}` : "1px solid rgba(255,255,255,0.08)";
      const caption = block.caption
        ? `<div style="max-width:${maxW}px;margin:8px auto 0 auto;color:#71717a;font-size:12px;line-height:1.4;text-align:center;">${escape(block.caption)}</div>`
        : "";
      const flyer = event.flyerUrl && event.flyerUrl.trim();
      if (!flyer) {
        if (!ctx.preview) return "";
        return `<tr><td align="center" style="padding:0 24px;">
          <div style="width:100%;max-width:${maxW}px;height:${Math.round(maxW * 0.6)}px;border-radius:${radius}px;border:1px dashed rgba(255,255,255,0.2);background:#111;display:flex;align-items:center;justify-content:center;color:#71717a;font-size:12px;text-align:center;padding:16px;box-sizing:border-box;margin:0 auto;">Flyer do evento (sem imagem cadastrada — placeholder do preview)</div>
          ${caption}
        </td></tr>`;
      }
      const flyerSrc = proxyForEmail(flyer);
      return `<tr><td align="center" style="padding:0 24px;">
        <a href="${escape(event.eventUrl)}" style="text-decoration:none;display:block;">
          <img src="${escape(flyerSrc)}" alt="${escape(event.eventTitle)}" width="${maxW}" border="0" style="display:block;width:100%;max-width:${maxW}px;height:auto;border-radius:${radius}px;border:${border};background:#111;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;margin:0 auto;">
        </a>
        ${caption}
      </td></tr>`;
    }

    case "eyebrow": {
      if (!block.text?.trim()) return "";
      const color = escape(block.text_color || primary);
      const align = block.align ?? "left";
      const text = escape(block.text);
      const label = block.bg_style === "pill"
        ? `<span style="display:inline-block;padding:4px 12px;background:rgba(168,85,247,0.12);border:1px solid ${color};border-radius:999px;color:${color};font-size:11px;font-weight:600;letter-spacing:0.2em;text-transform:uppercase;">${text}</span>`
        : `<p style="margin:0;color:${color};font-size:11px;font-weight:600;letter-spacing:0.2em;text-transform:uppercase;">${text}</p>`;
      return `<tr><td style="padding:24px 32px 0 32px;text-align:${align};">${label}</td></tr>`;
    }

    case "title": {
      const color = escape(block.text_color || "#ffffff");
      const align = block.align ?? "left";
      const size = Math.max(18, Math.min(48, block.font_size ?? 28));
      const weight = block.font_weight === "bold" ? 700 : 800;

      // Contexto multi-evento (event_grid) sem override manual: lista cada
      // evento numa linha própria (marcador + dia/hora), em vez do resumo
      // curto usado no assunto do e-mail (que não pode virar lista — é uma
      // única linha na caixa de entrada, ver composeAutoMultiEventTitle em
      // emailComposer.ts).
      const gridList = event.gridEvents;
      if (!block.text_override?.trim() && gridList && gridList.length > 0) {
        const lines = gridList.map((ev) => {
          const dt = [ev.dayLabel, ev.timeLabel].filter(Boolean).join(" · ");
          const label = `• ${escape(ev.title)}${dt ? ` — ${escape(dt)}` : ""}`;
          return block.uppercase ? label.toUpperCase() : label;
        });
        return `<tr><td style="padding:8px 32px 0 32px;text-align:${align};">
          <h1 style="margin:0;color:${color};font-size:${size}px;line-height:1.4;font-weight:${weight};letter-spacing:-0.01em;">${lines.join("<br>")}</h1>
        </td></tr>`;
      }

      const rawText = block.text_override?.trim() || event.eventTitle;
      const text = block.uppercase ? escape(rawText).toUpperCase() : escape(rawText);
      return `<tr><td style="padding:8px 32px 0 32px;text-align:${align};">
        <h1 style="margin:0;color:${color};font-size:${size}px;line-height:1.15;font-weight:${weight};letter-spacing:-0.01em;">${text}</h1>
      </td></tr>`;
    }

    case "subtitle": {
      if (!event.eventSubtitle) return "";
      const color = escape(block.text_color || "#a1a1aa");
      const align = block.align ?? "left";
      const size = Math.max(12, Math.min(24, block.font_size ?? 16));
      const style2 = block.italic ? "italic" : "normal";
      return `<tr><td style="padding:8px 32px 0 32px;text-align:${align};">
        <p style="margin:0;color:${color};font-size:${size}px;line-height:1.5;font-style:${style2};">${escape(event.eventSubtitle)}</p>
      </td></tr>`;
    }

    case "event_meta": {
      const stacked = block.layout === "stacked";
      const showIcons = block.show_icons !== false;
      const accent = escape(block.accent_color || "#ffffff");
      const dateLabelText = escape(block.date_label || "Data e hora");
      const localLabelText = escape(block.location_label || "Local");
      const dateLabel = showIcons ? `📅 ${dateLabelText}` : dateLabelText;
      const localLabel = showIcons ? `📍 ${localLabelText}` : localLabelText;
      if (stacked) {
        return `<tr><td style="padding:16px 32px;">
          <div style="border-top:1px solid rgba(255,255,255,0.06);border-bottom:1px solid rgba(255,255,255,0.06);padding:20px 0;">
            <div style="color:${accent};font-size:11px;font-weight:700;letter-spacing:-0.01em;text-transform:uppercase;margin-bottom:6px;">${dateLabel}</div>
            <div style="color:#a1a1aa;font-size:14px;line-height:1.5;margin-bottom:14px;">${escape(event.dateLabel)}<br>${escape(event.timeLabel)}</div>
            <div style="color:${accent};font-size:11px;font-weight:700;letter-spacing:-0.01em;text-transform:uppercase;margin-bottom:6px;">${localLabel}</div>
            <div style="color:#a1a1aa;font-size:14px;line-height:1.5;">${escape(event.venueName)}<br>${escape(event.cityState)}</div>
          </div>
        </td></tr>`;
      }
      return `<tr><td style="padding:16px 32px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid rgba(255,255,255,0.06);border-bottom:1px solid rgba(255,255,255,0.06);">
          <tr>
            <td width="50%" style="padding:20px 0;vertical-align:top;">
              <div style="color:${accent};font-size:11px;font-weight:700;letter-spacing:-0.01em;text-transform:uppercase;margin-bottom:6px;">${dateLabel}</div>
              <div style="color:#a1a1aa;font-size:14px;line-height:1.5;">${escape(event.dateLabel)}<br>${escape(event.timeLabel)}</div>
            </td>
            <td width="50%" align="right" style="padding:20px 0;vertical-align:top;">
              <div style="color:${accent};font-size:11px;font-weight:700;letter-spacing:-0.01em;text-transform:uppercase;margin-bottom:6px;">${localLabel}</div>
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
      const size = Math.max(12, Math.min(20, block.font_size ?? 15));
      const lineHeight = block.line_height === "compact" ? 1.35 : 1.6;
      const marginBottom = block.line_height === "compact" ? 6 : 10;
      const lines = event.description.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      const paragraphs = lines
        .map((l) => `<p style="margin:0 0 ${marginBottom}px 0;color:${color};font-size:${size}px;line-height:${lineHeight};">${escape(l)}</p>`)
        .join("");
      return `<tr><td style="padding:8px 32px 24px 32px;text-align:${align};">${paragraphs}</td></tr>`;
    }

    case "article_summary": {
      if (!article) return "";
      const showImage = block.show_image !== false;
      const compact = block.layout === "compact";
      const imgHtml = showImage && article.image_url
        ? `<img src="${escape(proxyForEmail(article.image_url))}" alt="" width="${compact ? 72 : 120}" height="${compact ? 72 : 80}" border="0" style="display:block;width:${compact ? 72 : 120}px;height:${compact ? 72 : 80}px;object-fit:cover;border-radius:8px;border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;">`
        : "";
      const eyebrowLabel = escape(block.eyebrow_label || "📰 Leia a matéria");
      if (compact) {
        return `<tr><td style="padding:8px 32px 24px 32px;">
          <a href="${escape(article.url)}" style="text-decoration:none;display:block;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                ${imgHtml ? `<td width="72" style="padding:0 12px 0 0;vertical-align:top;">${imgHtml}</td>` : ""}
                <td style="vertical-align:top;">
                  <div style="color:${primary};font-size:10px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;margin-bottom:3px;">${eyebrowLabel}</div>
                  <div style="color:#ffffff;font-size:14px;font-weight:700;line-height:1.3;">${escape(article.title)}</div>
                </td>
              </tr>
            </table>
          </a>
        </td></tr>`;
      }
      return `<tr><td style="padding:8px 32px 24px 32px;">
        <a href="${escape(article.url)}" style="text-decoration:none;display:block;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:rgba(168,85,247,0.06);border:1px solid ${primary};border-radius:12px;">
            <tr>
              <td style="padding:16px;vertical-align:top;">
                <div style="color:${primary};font-size:10px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:6px;">${eyebrowLabel}</div>
                <div style="color:#ffffff;font-size:15px;font-weight:700;line-height:1.3;margin-bottom:6px;">${escape(article.title)}</div>
                <div style="color:#a1a1aa;font-size:13px;line-height:1.5;">${escape(article.excerpt)}</div>
              </td>
              ${imgHtml ? `<td width="120" style="padding:16px 16px 16px 0;vertical-align:top;">${imgHtml}</td>` : ""}
            </tr>
          </table>
        </a>
      </td></tr>`;
    }


    case "image_with_link": {
      if (!block.image_url) return "";
      const maxW = Math.max(120, Math.min(552, block.max_width ?? 552));
      const align = block.align ?? "center";
      const radius = block.border_radius ?? 8;
      const border = block.border_color ? `1px solid ${escape(block.border_color)}` : "0";
      const alt = escape(block.alt || "");
      const imgSrc = proxyForEmail(block.image_url);
      const inner = `<img src="${escape(imgSrc)}" alt="${alt}" width="${maxW}" border="0" style="display:block;width:100%;max-width:${maxW}px;height:auto;border-radius:${radius}px;border:${border};outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;${align === "center" ? "margin:0 auto;" : align === "right" ? "margin:0 0 0 auto;" : "margin:0;"}">`;
      const wrapped = block.link_url
        ? `<a href="${escape(block.link_url)}" style="text-decoration:none;display:block;">${inner}</a>`
        : inner;
      const caption = block.caption
        ? `<div style="max-width:${maxW}px;margin:8px auto 0 auto;color:#71717a;font-size:12px;line-height:1.4;text-align:center;">${escape(block.caption)}</div>`
        : "";
      return `<tr><td align="${align}" style="padding:8px 32px;text-align:${align};">${wrapped}${caption}</td></tr>`;
    }

    case "divider": {
      const thickness = Math.max(1, Math.min(8, block.thickness ?? 1));
      const color = escape(block.color || "#3f3f46");
      const vPad = block.spacing === "compact" ? 4 : block.spacing === "wide" ? 16 : 8;
      const width = block.width === "short" ? "33%" : "100%";
      const hPad = block.width === "short" ? "0 32px" : "0";
      return `<tr><td style="padding:${vPad}px 32px;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
          <tr><td align="center" style="padding:${hPad};">
            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="${width}" style="border-collapse:collapse;">
              <tr><td bgcolor="${color}" height="${thickness}" style="height:${thickness}px;line-height:${thickness}px;font-size:0;background-color:${color};">&nbsp;</td></tr>
            </table>
          </td></tr>
        </table>
      </td></tr>`;
    }

    case "spacing": {
      const h = Math.max(4, Math.min(160, block.height ?? 24));
      return `<tr><td height="${h}" style="height:${h}px;line-height:${h}px;font-size:0;">&nbsp;</td></tr>`;
    }

    case "text": {
      const color = escape(block.text_color || "#a1a1aa");
      const safe = applyEmailSafeProseStyles(sanitizeCustomHtml(block.html || ""), color);
      const align = block.align ?? "left";
      const size = Math.max(11, Math.min(22, block.font_size ?? 14));
      const bg = block.bg_highlight
        ? "background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:12px;"
        : "";
      const padding = block.bg_highlight ? "16px 20px" : "0";
      return `<tr><td style="padding:8px 32px;text-align:${align};">
        <div style="${bg}padding:${padding};color:${color};font-size:${size}px;line-height:1.6;">${safe}</div>
      </td></tr>`;
    }

    case "footer": {
      const txt = escape(block.text || settings.footer_text || "");
      const align = block.align ?? "center";
      const color = escape(block.text_color || "#52525b");
      const size = Math.max(9, Math.min(14, block.font_size ?? 11));
      const unsubscribeLabel = escape(block.unsubscribe_label || "Descadastrar-se");
      const unsubscribe = block.include_unsubscribe !== false
        ? `<p style="margin:8px 0 0 0;font-size:${size}px;"><a href="[E-GOI_UNSUBSCRIBE_LINK]" style="color:#71717a;font-weight:700;text-decoration:underline;">${unsubscribeLabel}</a></p>`
        : "";
      return `<tr><td align="${align}" style="padding:24px 32px 40px 32px;background:rgba(0,0,0,0.4);border-top:1px solid rgba(255,255,255,0.06);text-align:${align};">
        <p style="margin:0;color:${color};font-size:${size}px;line-height:1.6;max-width:400px;display:inline-block;">${txt}</p>
        ${unsubscribe}
      </td></tr>`;
    }

    default:
      return null;
  }
}
