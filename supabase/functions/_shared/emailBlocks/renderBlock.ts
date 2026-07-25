// Render por bloco (switch principal). Extraído de emailBlocks.ts sem alterar
// nenhuma linha do switch — apenas movido para arquivo próprio.
import { EMAIL_BLOCK_LIMITS, clamp } from "../emailBlocksLimits.ts";
import type { Block, RenderContext, WeekendEventItem } from "./types.ts";
import { escape, sanitizeCustomHtml, resolveCtaUrl, resolveSecondaryUrl, proxyForEmail } from "./utils.ts";

export function renderBlock(block: Block, ctx: RenderContext): string {
  // Bloco oculto (toggle do olho no editor): pula render em preview e em envio real.
  // Paridade com src/lib/emailTemplates/blocks.ts (linha do check `hidden`).
  if ((block as { hidden?: boolean }).hidden) return "";
  const { event, article, settings } = ctx;
  const primary = escape(settings.primary_color);
  const accent = escape(settings.accent_color);
  const brand = escape(settings.brand_name);
  const gradient = `linear-gradient(90deg, ${primary} 0%, ${accent} 50%, #2563eb 100%)`;
  // Cor sólida de fallback para clientes sem gradiente CSS (Outlook desktop).
  const solidPrimary = primary;

  switch (block.kind) {
    case "header": {
      const height = Math.max(24, Math.min(200, block.logo_height ?? 64));
      const align = block.align ?? "center";
      const pad = Math.max(0, Math.min(80, block.padding_y ?? 32));
      const inner = settings.logo_url
        ? `<img src="${escape(proxyForEmail(settings.logo_url))}" alt="${brand}" height="${height}" border="0" style="display:inline-block;height:${height}px;max-height:${height}px;width:auto;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;">`
        : `<div style="font-size:22px;font-weight:800;letter-spacing:-0.02em;text-transform:uppercase;font-style:italic;color:#ffffff;">${brand}</div>`;
      return `<tr><td align="${align}" style="padding:${pad}px 24px ${Math.max(8, pad - 8)}px 24px;text-align:${align};">${inner}</td></tr>`;
    }

    case "hero_image": {
      const maxW = Math.max(300, Math.min(600, block.max_width ?? 552));
      const radius = block.border_radius ?? 12;
      // Sem flyer: preview mostra placeholder; envio real omite o bloco.
      const flyer = event.flyerUrl && event.flyerUrl.trim();
      if (!flyer) {
        if (!ctx.preview) return "";
        return `<tr><td align="center" style="padding:0 24px;">
          <div style="width:100%;max-width:${maxW}px;height:${Math.round(maxW * 0.6)}px;border-radius:${radius}px;border:1px dashed rgba(255,255,255,0.2);background:#111;display:flex;align-items:center;justify-content:center;color:#71717a;font-size:12px;text-align:center;padding:16px;box-sizing:border-box;margin:0 auto;">Flyer do evento (sem imagem cadastrada — placeholder do preview)</div>
        </td></tr>`;
      }
      const flyerSrc = proxyForEmail(flyer);
      return `<tr><td align="center" style="padding:0 24px;">
        <a href="${escape(event.eventUrl)}" style="text-decoration:none;display:block;">
          <img src="${escape(flyerSrc)}" alt="${escape(event.eventTitle)}" width="${maxW}" border="0" style="display:block;width:100%;max-width:${maxW}px;height:auto;border-radius:${radius}px;border:1px solid rgba(255,255,255,0.08);background:#111;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;margin:0 auto;">
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
        ? `<img src="${escape(proxyForEmail(article.image_url))}" alt="" width="120" height="80" border="0" style="display:block;width:120px;height:80px;object-fit:cover;border-radius:8px;border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;">`
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
      const label = escape(block.label || event.ctaLabel || settings.cta_label || "Garantir ingresso");
      const align = block.align ?? "center";
      const fullWidth = block.full_width !== false;
      const bg = block.bg_style === "solid" && block.bg_color ? escape(block.bg_color) : gradient;
      // Fallback sólido para Outlook (não renderiza gradiente CSS).
      const bgSolid = block.bg_style === "solid" && block.bg_color ? escape(block.bg_color) : solidPrimary;
      const widthStyle = fullWidth ? "display:block;width:100%;" : "display:inline-block;width:auto;";
      // Bulletproof button: VML para Outlook (cor sólida), <a> normal p/ o resto (gradiente).
      const vmlWidth = fullWidth ? 480 : 240;
      const vmlButton = `<!--[if mso]>
        <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${escape(url)}" style="height:56px;v-text-anchor:middle;width:${vmlWidth}px;" arcsize="21%" stroke="f" fillcolor="${bgSolid}">
          <w:anchorlock/>
          <center style="color:#ffffff;font-family:Arial,sans-serif;font-size:16px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;">${label}</center>
        </v:roundrect>
      <![endif]-->`;
      const htmlButton = `<!--[if !mso]><!-- -->
        <a href="${escape(url)}" style="${widthStyle}padding:18px 24px;box-sizing:border-box;background-color:${bgSolid};background:${bg};color:#ffffff;font-size:16px;font-weight:900;text-align:center;text-decoration:none;text-transform:uppercase;letter-spacing:0.15em;border-radius:12px;mso-hide:all;">${label}</a>
      <!--<![endif]-->`;
      return `<tr><td align="${align}" style="padding:8px 32px 8px 32px;text-align:${align};">${vmlButton}${htmlButton}</td></tr>`;
    }

    case "pix_button": {
      if (!event.pixWhatsAppUrl) return "";
      const url = event.pixWhatsAppUrl;
      const label = escape(block.label || "Comprar Sem Taxa via Pix");
      const align = block.align ?? "center";
      const fullWidth = block.full_width !== false;
      // Verde WhatsApp fixo (não configurável) — reforça o reconhecimento
      // visual de "Pix/sem taxa", igual ao botão do site.
      const bgSolid = "#25D366";
      const bg = `linear-gradient(90deg, #25D366 0%, #128C7E 100%)`;
      const widthStyle = fullWidth ? "display:block;width:100%;" : "display:inline-block;width:auto;";
      const vmlWidth = fullWidth ? 480 : 240;
      const vmlButton = `<!--[if mso]>
        <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${escape(url)}" style="height:56px;v-text-anchor:middle;width:${vmlWidth}px;" arcsize="21%" stroke="f" fillcolor="${bgSolid}">
          <w:anchorlock/>
          <center style="color:#ffffff;font-family:Arial,sans-serif;font-size:16px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;">${label}</center>
        </v:roundrect>
      <![endif]-->`;
      const htmlButton = `<!--[if !mso]><!-- -->
        <a href="${escape(url)}" style="${widthStyle}padding:18px 24px;box-sizing:border-box;background-color:${bgSolid};background:${bg};color:#ffffff;font-size:16px;font-weight:900;text-align:center;text-decoration:none;text-transform:uppercase;letter-spacing:0.15em;border-radius:12px;mso-hide:all;">${label}</a>
      <!--<![endif]-->`;
      return `<tr><td align="${align}" style="padding:8px 32px 8px 32px;text-align:${align};">${vmlButton}${htmlButton}</td></tr>`;
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
      const imgSrc = proxyForEmail(block.image_url);
      const inner = `<img src="${escape(imgSrc)}" alt="${alt}" width="${maxW}" border="0" style="display:block;width:100%;max-width:${maxW}px;height:auto;border-radius:${radius}px;border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;${align === "center" ? "margin:0 auto;" : align === "right" ? "margin:0 0 0 auto;" : "margin:0;"}">`;
      const wrapped = block.link_url
        ? `<a href="${escape(block.link_url)}" style="text-decoration:none;display:block;">${inner}</a>`
        : inner;
      return `<tr><td align="${align}" style="padding:8px 32px;text-align:${align};">${wrapped}</td></tr>`;
    }

    case "divider": {
      const thickness = Math.max(1, Math.min(8, block.thickness ?? 1));
      const color = escape(block.color || "#3f3f46");
      // Outlook (Word engine) descarta background em <div>. Usar <table bgcolor> renderiza consistente.
      return `<tr><td style="padding:8px 32px;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
          <tr><td bgcolor="${color}" height="${thickness}" style="height:${thickness}px;line-height:${thickness}px;font-size:0;background-color:${color};">&nbsp;</td></tr>
        </table>
      </td></tr>`;
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

      // medium — 2 caixas (horas + minutos), ~30% menor que large
      if (size === "medium") {
        const parts = [
          { v: hours, label: hours === 1 ? "hora" : "horas" },
          { v: minutes, label: "min" },
        ];
        const boxes = parts.map((p) =>
          `<td style="padding:0 4px;"><div style="min-width:56px;padding:7px 9px;background:rgba(0,0,0,0.35);border:1px solid rgba(255,255,255,0.15);border-radius:8px;text-align:center;">
            <div style="color:#ffffff;font-size:16px;font-weight:900;line-height:1;letter-spacing:-0.02em;">${p.v.toString().padStart(2, "0")}</div>
            <div style="color:#ffffff;opacity:0.85;font-size:9px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;margin-top:3px;">${p.label}</div>
          </div></td>`
        ).join("");
        return `<tr><td style="padding:6px 32px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${bg};border-radius:11px;">
            <tr><td align="${align}" style="padding:10px 10px;text-align:${align};">
              <div style="color:#ffffff;font-size:10px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;margin-bottom:6px;">${label}</div>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="display:inline-table;"><tr>${boxes}</tr></table>
              <div style="color:#ffffff;opacity:0.85;font-size:10px;margin-top:6px;">até ${escape(deadlineLabel)}</div>
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
      const heroId = ctx.heroEventId;
      // Filtro defensivo: DEDGE nunca aparece aqui — só via `dedge_block`.
      const isDedgeVenue = (v?: string) => /d\.?\s*edge/i.test((v || "").trim());
      const list = (event.weekendEvents || []).filter((ev) => ev && (!heroId || ev.id !== heroId) && !isDedgeVenue(ev.venue));
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
                  <a href="${url}" style="text-decoration:none;display:block;"><img src="${escape(proxyForEmail(ev.imageUrl))}" alt="${escape(ev.title)}" width="96" height="96" border="0" style="display:block;width:96px;height:96px;object-fit:cover;border:0;outline:none;"></a>
                </td>
                <td style="padding:12px 14px;vertical-align:top;">
                  <div style="color:${barColor};font-size:10px;font-weight:800;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:3px;">${escape(ev.dayLabel)}${ev.timeLabel ? ` · ${escape(ev.timeLabel)}` : ""}</div>
                  <div style="color:#ffffff;font-size:15px;font-weight:800;line-height:1.25;margin-bottom:3px;"><a href="${url}" style="color:#ffffff;text-decoration:none;">${escape(ev.title)}</a></div>
                  <div style="color:#a1a1aa;font-size:12px;">${escape(ev.venue)}${ev.cityState ? ` · ${escape(ev.cityState)}` : ""}</div>
                  ${(ev.ctas && ev.ctas.length > 1) ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:8px;">${ev.ctas.map((c) => `<tr><td style="padding:3px 0;"><a href="${escape(c.url)}" style="display:block;width:100%;box-sizing:border-box;padding:9px 12px;background:${gradient};color:#ffffff;font-size:11px;font-weight:900;text-align:center;text-decoration:none;text-transform:uppercase;letter-spacing:0.1em;border-radius:6px;">${escape((c.dayLabel ? c.dayLabel + " · " : "") + c.label + (c.timeLabel ? " · " + c.timeLabel : ""))} — ${escape(ev.ctaLabel || settings.cta_label || "Garantir ingresso")}</a></td></tr>`).join("")}</table>` : ""}
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
        const singleCtaLabel = escape(ev.ctaLabel || settings.cta_label || "Garantir ingresso");
        const multiCtas = (ev.ctas && ev.ctas.length > 1) ? ev.ctas : null;
        const ticketBtn = multiCtas
          ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:4px;">${multiCtas.map((c) => `<tr><td style="padding:4px 0;"><a href="${escape(c.url)}" style="display:block;width:100%;box-sizing:border-box;padding:12px 16px;background:${gradient};color:#ffffff;font-size:12px;font-weight:900;text-align:center;text-decoration:none;text-transform:uppercase;letter-spacing:0.12em;border-radius:8px;">${escape((c.dayLabel ? c.dayLabel + " · " : "") + c.label + (c.timeLabel ? " · " + c.timeLabel : ""))} — ${singleCtaLabel}</a></td></tr>`).join("")}</table>`
          : (ev.ticketUrl
            ? `<a href="${escape(ev.ticketUrl)}" style="display:inline-block;padding:10px 18px;background:${gradient};color:#ffffff;font-size:12px;font-weight:900;text-decoration:none;text-transform:uppercase;letter-spacing:0.15em;border-radius:8px;">${singleCtaLabel}</a>`
            : "");
        return `<tr><td style="padding:10px 32px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0d0d0d;border:1px solid rgba(255,255,255,0.08);border-radius:14px;overflow:hidden;">
            <tr><td style="padding:0;position:relative;">
              <a href="${url}" style="text-decoration:none;display:block;">
                <img src="${escape(proxyForEmail(ev.imageUrl))}" alt="${escape(ev.title)}" width="552" border="0" style="display:block;width:100%;max-width:552px;height:auto;border:0;outline:none;">
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

    case "event_grid": {
      const list = event.gridEvents || [];
      const align = block.align ?? "left";
      const eyebrow = escape(block.eyebrow || "");
      const title = escape(block.title || "");
      const showHeader = !!(block.eyebrow || block.title);
      const header = showHeader ? `<tr><td style="padding:16px 32px 4px 32px;text-align:${align};">
        ${eyebrow ? `<div style="color:${primary};font-size:11px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:4px;">${eyebrow}</div>` : ""}
        ${title ? `<h2 style="margin:0;color:#ffffff;font-size:22px;line-height:1.2;font-weight:800;letter-spacing:-0.01em;">${title}</h2>` : ""}
      </td></tr>` : "";

      if (list.length === 0) {
        if (!ctx.preview) return "";
        return `${header}<tr><td style="padding:8px 32px;">
          <div style="padding:24px;background:rgba(255,255,255,0.04);border:1px dashed rgba(255,255,255,0.15);border-radius:12px;text-align:center;color:#a1a1aa;font-size:13px;">
            🎟️ Aqui aparece o grid de eventos selecionados quando o e-mail for montado.
          </div>
        </td></tr>`;
      }

      const card = (ev: WeekendEventItem) => {
        const url = escape(ev.eventUrl || "#");
        const ctaLabel = escape(ev.ctaLabel || settings.cta_label || "Garantir ingresso");
        const btn = ev.ticketUrl
          ? `<a href="${escape(ev.ticketUrl)}" style="display:inline-block;width:100%;box-sizing:border-box;padding:10px 12px;background:${gradient};color:#ffffff;font-size:11px;font-weight:900;text-align:center;text-decoration:none;text-transform:uppercase;letter-spacing:0.1em;border-radius:8px;">${ctaLabel}</a>`
          : "";
        return `<td width="50%" style="padding:8px;vertical-align:top;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0d0d0d;border:1px solid rgba(255,255,255,0.08);border-radius:12px;overflow:hidden;">
            <tr><td style="padding:0;">
              <a href="${url}" style="text-decoration:none;display:block;">
                <img src="${escape(proxyForEmail(ev.imageUrl))}" alt="${escape(ev.title)}" width="260" border="0" style="display:block;width:100%;max-width:260px;height:auto;border:0;outline:none;">
              </a>
            </td></tr>
            <tr><td style="padding:12px 14px 14px 14px;">
              <div style="color:${accent};font-size:10px;font-weight:800;letter-spacing:0.15em;text-transform:uppercase;margin-bottom:4px;">${escape(ev.dayLabel)}${ev.timeLabel ? ` · ${escape(ev.timeLabel)}` : ""}</div>
              <div style="color:#ffffff;font-size:14px;font-weight:800;line-height:1.2;margin-bottom:3px;"><a href="${url}" style="color:#ffffff;text-decoration:none;">${escape(ev.title)}</a></div>
              <div style="color:#a1a1aa;font-size:11px;margin-bottom:8px;">${escape(ev.venue)}</div>
              ${btn}
            </td></tr>
          </table>
        </td>`;
      };

      const rows: string[] = [];
      for (let i = 0; i < list.length; i += 2) {
        const pair = list.slice(i, i + 2);
        const cells = pair.map(card).join("");
        rows.push(`<tr><td style="padding:2px 24px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${cells}</tr></table></td></tr>`);
      }
      return `${header}${rows.join("")}`;
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
          ${imageUrl ? `<tr><td style="padding:0;"><img src="${escape(proxyForEmail(imageUrl))}" alt="Dedge" width="552" border="0" style="display:block;width:100%;max-width:552px;height:auto;border:0;outline:none;"></td></tr>` : ""}
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
      const ctaLabel = escape((useWeekend && w?.ctaLabel) || block.cta_label || settings.cta_label || "Garantir ingresso");
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
              <img src="${escape(proxyForEmail(imageUrl))}" alt="${escape(title)}" width="552" border="0" style="display:block;width:100%;max-width:552px;height:auto;border:0;outline:none;">
            </a>
          </td></tr>
          <tr><td style="padding:20px 22px 22px 22px;text-align:${align};background-image:${overlayBg};">
            <div style="color:${accent};font-size:11px;font-weight:800;letter-spacing:0.25em;text-transform:uppercase;margin-bottom:8px;">${eyebrow}</div>
            <div style="color:#ffffff;font-size:12px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;margin-bottom:6px;opacity:0.85;">${escape(dayLabel)}${timeLabel ? ` · ${escape(timeLabel)}` : ""}</div>
            <h1 style="margin:0 0 8px 0;color:#ffffff;font-size:26px;line-height:1.15;font-weight:900;letter-spacing:-0.02em;">
              <a href="${escape(url)}" style="color:#ffffff;text-decoration:none;">${escape(title)}</a>
            </h1>
            ${showVenue ? `<div style="color:#a1a1aa;font-size:14px;margin-bottom:14px;">📍 ${escape(venue)}${city ? ` · ${escape(city)}` : ""}</div>` : ""}
            ${showCta ? ((useWeekend && w?.ctas && w.ctas.length > 1)
              ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">${w!.ctas!.map((c) => `<tr><td style="padding:4px 0;"><a href="${escape(c.url)}" style="display:block;min-width:220px;padding:12px 22px;background:${gradient};color:#ffffff;font-size:12px;font-weight:900;text-align:center;text-decoration:none;text-transform:uppercase;letter-spacing:0.14em;border-radius:10px;">${escape((c.dayLabel ? c.dayLabel + " · " : "") + c.label + (c.timeLabel ? " · " + c.timeLabel : ""))} — ${ctaLabel}</a></td></tr>`).join("")}</table>`
              : (ticketUrl ? `<a href="${escape(ticketUrl)}" style="display:inline-block;padding:14px 26px;background:${gradient};color:#ffffff;font-size:13px;font-weight:900;text-decoration:none;text-transform:uppercase;letter-spacing:0.18em;border-radius:10px;">${ctaLabel}</a>` : "")) : ""}
          </td></tr>
        </table>
      </td></tr>`;
    }

    case "blog_posts_list": {
      const posts = (event.blogPosts || []).slice(0, clamp(block.max_items, EMAIL_BLOCK_LIMITS.blogPostsList.minItems, EMAIL_BLOCK_LIMITS.blogPostsList.maxItems, EMAIL_BLOCK_LIMITS.blogPostsList.defaultItems));
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
              ${p.imageUrl ? `<tr><td style="padding:0;"><a href="${url}" style="text-decoration:none;display:block;"><img src="${escape(proxyForEmail(p.imageUrl))}" alt="${escape(p.title)}" width="552" border="0" style="display:block;width:100%;max-width:552px;height:auto;border:0;outline:none;"></a></td></tr>` : ""}
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
              ${p.imageUrl ? `<td width="96" valign="top" style="padding:0;"><a href="${url}" style="text-decoration:none;display:block;"><img src="${escape(proxyForEmail(p.imageUrl))}" alt="${escape(p.title)}" width="96" height="96" border="0" style="display:block;width:96px;height:96px;object-fit:cover;border:0;outline:none;"></a></td>` : ""}
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
