// supabase/functions/blog-digest-draft/index.ts
import { createClient } from "npm:@supabase/supabase-js@2";

// supabase/functions/_shared/emailBlocksLimits.ts
var EMAIL_BLOCK_LIMITS = {
  logo: { minHeight: 24, maxHeight: 200, defaultHeight: 64 },
  padding: { minY: 0, maxY: 80, defaultY: 32 },
  image: { minWidth: 300, maxWidth: 600, defaultWidth: 552 },
  heading: { minFontSize: 18, maxFontSize: 48, defaultFontSize: 28 },
  divider: { minWidth: 120, maxWidth: 552, defaultWidth: 552, minThickness: 1, maxThickness: 8, defaultThickness: 1 },
  map: { minZoom: 12, maxZoom: 19, defaultZoom: 15, minHeight: 200, maxHeight: 400, defaultHeight: 300 },
  lineup: { maxMembers: 3 },
  blogPostsList: { minItems: 1, maxItems: 10, defaultItems: 3 },
  summary: { descriptionMaxChars: 150 }
};
var clamp = (value, min, max, fallback) => Math.max(min, Math.min(max, value ?? fallback));

// supabase/functions/_shared/emailBlocks.ts
function expandGlobalRefs(blocks, globals) {
  if (!globals) {
    return blocks.filter((b) => b.kind !== "global_ref");
  }
  const get = (id) => globals instanceof Map ? globals.get(id) : globals[id];
  const out = [];
  for (const b of blocks) {
    if (b.kind !== "global_ref") {
      out.push(b);
      continue;
    }
    const g = get(b.global_id);
    if (!g) continue;
    const hidden = b.hidden === true;
    out.push({ ...g.block, id: b.id, ...hidden ? { hidden: true } : {} });
  }
  return out;
}
var escape = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
var sanitizeCustomHtml = (raw) => raw.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<iframe[\s\S]*?<\/iframe>/gi, "").replace(/on\w+\s*=\s*"[^"]*"/gi, "").replace(/on\w+\s*=\s*'[^']*'/gi, "").replace(/javascript:/gi, "");
var resolveCtaUrl = (block, event) => {
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
var resolveSecondaryUrl = (block, event) => {
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
function proxyForEmail(url) {
  if (!url) return url;
  if (!/^https?:\/\//i.test(url)) return url;
  if (!/\.webp(\?|$)/i.test(url)) return url;
  const clean = url.replace(/^https?:\/\//i, "");
  return `https://wsrv.nl/?url=${encodeURIComponent(clean)}&output=jpg&q=85`;
}
function renderBlock(block, ctx) {
  if (block.hidden) return "";
  const { event, article, settings } = ctx;
  const primary = escape(settings.primary_color);
  const accent = escape(settings.accent_color);
  const brand = escape(settings.brand_name);
  const gradient = `linear-gradient(90deg, ${primary} 0%, ${accent} 50%, #2563eb 100%)`;
  const solidPrimary = primary;
  switch (block.kind) {
    case "header": {
      const height = Math.max(24, Math.min(200, block.logo_height ?? 64));
      const align = block.align ?? "center";
      const pad = Math.max(0, Math.min(80, block.padding_y ?? 32));
      const inner = settings.logo_url ? `<img src="${escape(settings.logo_url)}" alt="${brand}" height="${height}" border="0" style="display:inline-block;height:${height}px;max-height:${height}px;width:auto;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;">` : `<div style="font-size:22px;font-weight:800;letter-spacing:-0.02em;text-transform:uppercase;font-style:italic;color:#ffffff;">${brand}</div>`;
      return `<tr><td align="${align}" style="padding:${pad}px 24px ${Math.max(8, pad - 8)}px 24px;text-align:${align};">${inner}</td></tr>`;
    }
    case "hero_image": {
      const maxW = Math.max(300, Math.min(600, block.max_width ?? 552));
      const radius = block.border_radius ?? 12;
      const flyer = event.flyerUrl && event.flyerUrl.trim();
      if (!flyer) {
        if (!ctx.preview) return "";
        return `<tr><td align="center" style="padding:0 24px;">
          <div style="width:100%;max-width:${maxW}px;height:${Math.round(maxW * 0.6)}px;border-radius:${radius}px;border:1px dashed rgba(255,255,255,0.2);background:#111;display:flex;align-items:center;justify-content:center;color:#71717a;font-size:12px;text-align:center;padding:16px;box-sizing:border-box;margin:0 auto;">Flyer do evento (sem imagem cadastrada \u2014 placeholder do preview)</div>
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
      const paragraphs = lines.map((l) => `<p style="margin:0 0 10px 0;color:${color};font-size:15px;line-height:1.6;">${escape(l)}</p>`).join("");
      return `<tr><td style="padding:8px 32px 24px 32px;text-align:${align};">${paragraphs}</td></tr>`;
    }
    case "article_summary": {
      if (!article) return "";
      const showImage = block.show_image !== false;
      const imgHtml = showImage && article.image_url ? `<img src="${escape(article.image_url)}" alt="" width="120" height="80" border="0" style="display:block;width:120px;height:80px;object-fit:cover;border-radius:8px;border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;">` : "";
      return `<tr><td style="padding:8px 32px 24px 32px;">
        <a href="${escape(article.url)}" style="text-decoration:none;display:block;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:rgba(168,85,247,0.06);border:1px solid ${primary};border-radius:12px;">
            <tr>
              <td style="padding:16px;vertical-align:top;">
                <div style="color:${primary};font-size:10px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:6px;">\u{1F4F0} Leia a mat\xE9ria</div>
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
      const bgSolid = block.bg_style === "solid" && block.bg_color ? escape(block.bg_color) : solidPrimary;
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
      const wrapped = block.link_url ? `<a href="${escape(block.link_url)}" style="text-decoration:none;display:block;">${inner}</a>` : inner;
      return `<tr><td align="${align}" style="padding:8px 32px;text-align:${align};">${wrapped}</td></tr>`;
    }
    case "divider": {
      const thickness = Math.max(1, Math.min(8, block.thickness ?? 1));
      const color = escape(block.color || "#3f3f46");
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
        const sep = i > 0 ? `<td style="padding:0 8px;color:#3f3f46;">\xB7</td>` : "";
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
        body = artists.map(
          (a) => `<span style="display:inline-block;margin:4px 4px;padding:8px 14px;background:rgba(168,85,247,0.12);border:1px solid ${primary};border-radius:999px;color:${textColor};font-size:13px;font-weight:700;letter-spacing:0.02em;">${escape(a)}</span>`
        ).join("");
      } else if (layout === "list") {
        body = `<ul style="list-style:none;padding:0;margin:0;">${artists.map(
          (a) => `<li style="padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.06);color:${textColor};font-size:15px;font-weight:600;">${escape(a)}</li>`
        ).join("")}</ul>`;
      } else {
        const rows = [];
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
      let deadline;
      const now = /* @__PURE__ */ new Date();
      if (source === "custom" && block.custom_deadline) {
        deadline = new Date(block.custom_deadline);
      } else if (source === "event_start" && event.eventStartIso) {
        deadline = new Date(event.eventStartIso);
      } else if (source === "batch_deadline" && event.ticketBatchDeadlineIso) {
        deadline = new Date(event.ticketBatchDeadlineIso);
      } else {
        deadline = /* @__PURE__ */ new Date();
        deadline.setHours(23, 59, 0, 0);
      }
      const diffMs = Math.max(0, deadline.getTime() - now.getTime());
      const totalMin = Math.floor(diffMs / 6e4);
      const days = Math.floor(totalMin / (60 * 24));
      const hours = Math.floor(totalMin % (60 * 24) / 60);
      const minutes = totalMin % 60;
      const bg = block.bg_style === "solid" && block.bg_color ? escape(block.bg_color) : gradient;
      const align = block.align ?? "center";
      const label = escape(block.label || "Lote atual encerra em");
      const deadlineLabel = deadline.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
      });
      const size = block.size || "large";
      if (size === "minimal") {
        const inline = `${days > 0 ? `${days}d ` : ""}${hours}h ${minutes.toString().padStart(2, "0")}m`;
        return `<tr><td align="${align}" style="padding:8px 32px;text-align:${align};">
          <div style="display:inline-block;padding:10px 16px;background:${bg};border-radius:999px;color:#ffffff;font-size:13px;font-weight:800;letter-spacing:0.02em;">\u23F0 ${label}: ${inline} <span style="opacity:0.85;font-weight:600;">(at\xE9 ${escape(deadlineLabel)})</span></div>
        </td></tr>`;
      }
      if (size === "medium") {
        const parts2 = [
          { v: hours, label: hours === 1 ? "hora" : "horas" },
          { v: minutes, label: "min" }
        ];
        const boxes2 = parts2.map(
          (p) => `<td style="padding:0 4px;"><div style="min-width:56px;padding:7px 9px;background:rgba(0,0,0,0.35);border:1px solid rgba(255,255,255,0.15);border-radius:8px;text-align:center;">
            <div style="color:#ffffff;font-size:16px;font-weight:900;line-height:1;letter-spacing:-0.02em;">${p.v.toString().padStart(2, "0")}</div>
            <div style="color:#ffffff;opacity:0.85;font-size:9px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;margin-top:3px;">${p.label}</div>
          </div></td>`
        ).join("");
        return `<tr><td style="padding:6px 32px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${bg};border-radius:11px;">
            <tr><td align="${align}" style="padding:10px 10px;text-align:${align};">
              <div style="color:#ffffff;font-size:10px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;margin-bottom:6px;">${label}</div>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="display:inline-table;"><tr>${boxes2}</tr></table>
              <div style="color:#ffffff;opacity:0.85;font-size:10px;margin-top:6px;">at\xE9 ${escape(deadlineLabel)}</div>
            </td></tr>
          </table>
        </td></tr>`;
      }
      const parts = [];
      if (days > 0) parts.push({ v: days, label: days === 1 ? "dia" : "dias" });
      parts.push({ v: hours, label: hours === 1 ? "hora" : "horas" });
      parts.push({ v: minutes, label: "min" });
      const boxes = parts.map(
        (p) => `<td style="padding:0 6px;"><div style="min-width:64px;padding:12px 10px;background:rgba(0,0,0,0.35);border:1px solid rgba(255,255,255,0.15);border-radius:10px;text-align:center;">
          <div style="color:#ffffff;font-size:26px;font-weight:900;line-height:1;letter-spacing:-0.02em;">${p.v.toString().padStart(2, "0")}</div>
          <div style="color:#ffffff;opacity:0.85;font-size:10px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;margin-top:4px;">${p.label}</div>
        </div></td>`
      ).join("");
      return `<tr><td style="padding:8px 32px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${bg};border-radius:14px;">
          <tr><td align="${align}" style="padding:18px 16px;text-align:${align};">
            <div style="color:#ffffff;font-size:11px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:10px;">${label}</div>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="display:inline-table;"><tr>${boxes}</tr></table>
            <div style="color:#ffffff;opacity:0.85;font-size:11px;margin-top:10px;">at\xE9 ${escape(deadlineLabel)}</div>
          </td></tr>
        </table>
      </td></tr>`;
    }
    case "ticker": {
      const msgs = (block.messages && block.messages.length > 0 ? block.messages : ["\xDAltimas horas", "Ingressos limitados", "Restam poucos"]).slice(0, 3).map((m) => escape(m));
      const bg = escape(block.bg_color || primary);
      const color = escape(block.text_color || "#ffffff");
      const align = block.align ?? "center";
      const anim = block.animation || "fade";
      const iconMap = { none: "", clock: "\u23F0 ", fire: "\u{1F525} ", bolt: "\u26A1 " };
      const icon = iconMap[block.icon || "clock"] ?? "\u23F0 ";
      const staticLine = msgs.join(" \xB7 ");
      const animatedSpans = anim === "fade" ? msgs.map((m, i) => `<span class="tk tk${i}">${icon}${m}</span>`).join("") : anim === "slide" ? `<span class="tk-slide">${msgs.map((m) => `${icon}${m}`).join("  \xB7  ")}</span>` : `<span>${icon}${staticLine}</span>`;
      const keyframes = anim === "fade" && msgs.length > 1 ? `<style>@media screen{
          .ticker-anim .tk{display:none;}
          .ticker-anim .tk0{display:inline;animation:tkf 9s infinite;}
          ${msgs.length >= 2 ? ".ticker-anim .tk1{display:inline;animation:tkf 9s infinite -3s;}" : ""}
          ${msgs.length >= 3 ? ".ticker-anim .tk2{display:inline;animation:tkf 9s infinite -6s;}" : ""}
          @keyframes tkf{0%,25%{opacity:1}33%,92%{opacity:0}100%{opacity:1}}
        }</style>` : anim === "slide" ? `<style>@media screen{.ticker-anim .tk-slide{display:inline-block;animation:tks 18s linear infinite;}@keyframes tks{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}}</style>` : "";
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
            \u{1F5FA}\uFE0F Mapa aparecer\xE1 aqui quando o evento tiver <strong style="color:#fff;">coordenadas do venue</strong> preenchidas.
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
      const label = showLabel ? `<div style="padding:10px 14px;color:#a1a1aa;font-size:13px;line-height:1.4;text-align:center;background:rgba(0,0,0,0.4);border-top:1px solid rgba(255,255,255,0.06);">
            <strong style="color:#ffffff;">${escape(event.venueName)}</strong> \xB7 ${escape(event.cityState)}<br>
            <span style="color:${primary};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.15em;">Toque para abrir no mapa \u2192</span>
          </div>` : "";
      return `<tr><td style="padding:8px 32px;">
        <a href="${escape(mapsDeepLink)}" style="text-decoration:none;display:block;border-radius:${radius}px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);">
          <img src="${escape(mapSrc)}" alt="Mapa de ${escape(event.venueName)}" width="600" height="${height}" border="0" style="display:block;width:100%;max-width:100%;height:auto;">
          ${label}
        </a>
      </td></tr>`;
    }
    case "weekend_grid": {
      const heroId = ctx.heroEventId;
      const isDedgeVenue = (v) => /d\.?\s*edge/i.test((v || "").trim());
      const list = (event.weekendEvents || []).filter((ev) => ev && (!heroId || ev.id !== heroId) && !isDedgeVenue(ev.venue));
      const align = block.align ?? "left";
      const eyebrow = escape(block.eyebrow || "AGENDA \xB7 FIM DE SEMANA");
      const title = escape(block.title || "O que rola no fds");
      const showArticle = block.show_article_link !== false;
      const layout = block.layout || "cartaz";
      if (list.length === 0) {
        if (!ctx.preview) return "";
        return `<tr><td style="padding:8px 32px;">
          <div style="padding:24px;background:rgba(255,255,255,0.04);border:1px dashed rgba(255,255,255,0.15);border-radius:12px;text-align:center;color:#a1a1aa;font-size:13px;">
            \u{1F4C5} Aqui aparecem os eventos do fim de semana quando a newsletter for gerada.
          </div>
        </td></tr>`;
      }
      const hasHeader = (block.eyebrow || block.title) !== void 0 || (!block.eyebrow && !block.title ? false : true);
      const showHeader = (block.eyebrow ?? "AGENDA \xB7 FIM DE SEMANA") !== "" || (block.title ?? "O que rola no fds") !== "";
      const header = showHeader ? `<tr><td style="padding:16px 32px 4px 32px;text-align:${align};">
        <div style="color:${primary};font-size:11px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:4px;">${eyebrow}</div>
        <h2 style="margin:0;color:#ffffff;font-size:22px;line-height:1.2;font-weight:800;letter-spacing:-0.01em;">${title}</h2>
      </td></tr>` : "";
      if (layout === "timeline") {
        const barColor = escape(block.day_bar_color || accent);
        const rows = list.map((ev) => {
          const url = escape(ev.eventUrl || "#");
          const article2 = showArticle && ev.articleUrl ? `<a href="${escape(ev.articleUrl)}" style="display:inline-block;margin-top:6px;color:${primary};font-size:11px;font-weight:700;text-decoration:none;text-transform:uppercase;letter-spacing:0.15em;">\u{1F4F0} Ler mat\xE9ria \u2192</a>` : "";
          return `<tr><td style="padding:6px 32px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0d0d0d;border:1px solid rgba(255,255,255,0.08);border-radius:12px;overflow:hidden;">
              <tr>
                <td width="6" style="background:${barColor};"></td>
                <td width="96" style="padding:0;">
                  <a href="${url}" style="text-decoration:none;display:block;"><img src="${escape(ev.imageUrl)}" alt="${escape(ev.title)}" width="96" height="96" border="0" style="display:block;width:96px;height:96px;object-fit:cover;border:0;outline:none;"></a>
                </td>
                <td style="padding:12px 14px;vertical-align:top;">
                  <div style="color:${barColor};font-size:10px;font-weight:800;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:3px;">${escape(ev.dayLabel)}${ev.timeLabel ? ` \xB7 ${escape(ev.timeLabel)}` : ""}</div>
                  <div style="color:#ffffff;font-size:15px;font-weight:800;line-height:1.25;margin-bottom:3px;"><a href="${url}" style="color:#ffffff;text-decoration:none;">${escape(ev.title)}</a></div>
                  <div style="color:#a1a1aa;font-size:12px;">${escape(ev.venue)}${ev.cityState ? ` \xB7 ${escape(ev.cityState)}` : ""}</div>
                  ${ev.ctas && ev.ctas.length > 1 ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:8px;">${ev.ctas.map((c) => `<tr><td style="padding:3px 0;"><a href="${escape(c.url)}" style="display:block;width:100%;box-sizing:border-box;padding:9px 12px;background:${gradient};color:#ffffff;font-size:11px;font-weight:900;text-align:center;text-decoration:none;text-transform:uppercase;letter-spacing:0.1em;border-radius:6px;">${escape((c.dayLabel ? c.dayLabel + " \xB7 " : "") + c.label + (c.timeLabel ? " \xB7 " + c.timeLabel : ""))} \u2014 ${escape(ev.ctaLabel || settings.cta_label || "Garantir ingresso")}</a></td></tr>`).join("")}</table>` : ""}
                  ${article2}
                </td>
              </tr>
            </table>
          </td></tr>`;
        }).join("");
        return `${header}${rows}`;
      }
      const cards = list.map((ev) => {
        const url = escape(ev.eventUrl || "#");
        const article2 = showArticle && ev.articleUrl ? `<a href="${escape(ev.articleUrl)}" style="display:inline-block;margin-left:12px;color:${primary};font-size:11px;font-weight:700;text-decoration:none;text-transform:uppercase;letter-spacing:0.15em;">\u{1F4F0} Mat\xE9ria \u2192</a>` : "";
        const singleCtaLabel = escape(ev.ctaLabel || settings.cta_label || "Garantir ingresso");
        const multiCtas = ev.ctas && ev.ctas.length > 1 ? ev.ctas : null;
        const ticketBtn = multiCtas ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:4px;">${multiCtas.map((c) => `<tr><td style="padding:4px 0;"><a href="${escape(c.url)}" style="display:block;width:100%;box-sizing:border-box;padding:12px 16px;background:${gradient};color:#ffffff;font-size:12px;font-weight:900;text-align:center;text-decoration:none;text-transform:uppercase;letter-spacing:0.12em;border-radius:8px;">${escape((c.dayLabel ? c.dayLabel + " \xB7 " : "") + c.label + (c.timeLabel ? " \xB7 " + c.timeLabel : ""))} \u2014 ${singleCtaLabel}</a></td></tr>`).join("")}</table>` : ev.ticketUrl ? `<a href="${escape(ev.ticketUrl)}" style="display:inline-block;padding:10px 18px;background:${gradient};color:#ffffff;font-size:12px;font-weight:900;text-decoration:none;text-transform:uppercase;letter-spacing:0.15em;border-radius:8px;">${singleCtaLabel}</a>` : "";
        return `<tr><td style="padding:10px 32px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0d0d0d;border:1px solid rgba(255,255,255,0.08);border-radius:14px;overflow:hidden;">
            <tr><td style="padding:0;position:relative;">
              <a href="${url}" style="text-decoration:none;display:block;">
                <img src="${escape(ev.imageUrl)}" alt="${escape(ev.title)}" width="552" border="0" style="display:block;width:100%;max-width:552px;height:auto;border:0;outline:none;">
              </a>
            </td></tr>
            <tr><td style="padding:16px 18px 18px 18px;">
              <div style="color:${accent};font-size:11px;font-weight:800;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:6px;">${escape(ev.dayLabel)}${ev.timeLabel ? ` \xB7 ${escape(ev.timeLabel)}` : ""}</div>
              <div style="color:#ffffff;font-size:19px;font-weight:900;line-height:1.2;margin-bottom:4px;letter-spacing:-0.01em;"><a href="${url}" style="color:#ffffff;text-decoration:none;">${escape(ev.title)}</a></div>
              <div style="color:#a1a1aa;font-size:13px;margin-bottom:12px;">${escape(ev.venue)}${ev.cityState ? ` \xB7 ${escape(ev.cityState)}` : ""}</div>
              ${ticketBtn}${article2}
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
      const eyebrow = escape((override ? block.eyebrow : d?.eyebrow) || block.eyebrow || d?.eyebrow || "TODA SEMANA \xB7 RESID\xCANCIA");
      const title = escape((override ? block.title : d?.title) || block.title || d?.title || "Dedge \u2014 sua resid\xEAncia da semana");
      const description = escape((override ? block.description : d?.description) || block.description || d?.description || "");
      const primaryUrl = (override ? block.primary_url : d?.primaryUrl) || block.primary_url || d?.primaryUrl || "";
      const primaryLabel = escape((override ? block.primary_label : d?.primaryLabel) || block.primary_label || d?.primaryLabel || "Ver todos os eventos Dedge");
      const nights = (d?.nights || []).filter((n) => n.enabled && n.url);
      const buttonStyle = block.button_style || "dark";
      if (!imageUrl && nights.length === 0 && !primaryUrl) {
        if (!ctx.preview) return "";
        return `<tr><td style="padding:8px 32px;">
          <div style="padding:24px;background:rgba(255,255,255,0.04);border:1px dashed rgba(255,255,255,0.15);border-radius:12px;text-align:center;color:#a1a1aa;font-size:13px;">
            \u{1F3A7} Bloco Dedge \u2014 configure a imagem e os links das noites nas propriedades do bloco.
          </div>
        </td></tr>`;
      }
      const btnBg = buttonStyle === "primary" ? gradient : "#0a0a0a";
      const btnBorder = buttonStyle === "primary" ? "transparent" : "rgba(255,255,255,0.18)";
      const nightBtns = nights.map(
        (n) => `<tr><td style="padding:6px 0;"><a href="${escape(n.url)}" style="display:block;width:100%;box-sizing:border-box;padding:14px 18px;background:${btnBg};border:1px solid ${btnBorder};color:#ffffff;font-size:13px;font-weight:800;text-align:center;text-decoration:none;text-transform:uppercase;letter-spacing:0.12em;border-radius:10px;">${escape(n.label)}</a></td></tr>`
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
      const title = useWeekend ? w.title : event.eventTitle;
      const imageUrl = useWeekend ? w.imageUrl : event.flyerUrl;
      const url = useWeekend ? w.eventUrl || "#" : event.eventUrl;
      const ticketUrl = useWeekend ? w.ticketUrl || w.eventUrl : event.ticketUrl;
      const venue = useWeekend ? w.venue : event.venueName;
      const city = useWeekend ? w.cityState || "" : event.cityState;
      const dayLabel = useWeekend ? w.dayLabel : event.dateLabel;
      const timeLabel = useWeekend ? w.timeLabel || "" : event.timeLabel;
      const eyebrow = escape(block.eyebrow || "DESTAQUE DA SEMANA");
      const align = block.align || "left";
      const showVenue = block.show_venue !== false;
      const showCta = block.show_cta !== false;
      const ctaLabel = escape(useWeekend && w?.ctaLabel || block.cta_label || settings.cta_label || "Garantir ingresso");
      const overlayBg = block.overlay_intensity === "soft" ? "linear-gradient(180deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.75) 100%)" : "linear-gradient(180deg, rgba(0,0,0,0.1) 20%, rgba(0,0,0,0.92) 100%)";
      if (!imageUrl && !title) {
        if (!ctx.preview) return "";
        return `<tr><td style="padding:8px 32px;">
          <div style="padding:24px;background:rgba(255,255,255,0.04);border:1px dashed rgba(255,255,255,0.15);border-radius:12px;text-align:center;color:#a1a1aa;font-size:13px;">
            \u2B50 Hero da semana aparece quando houver eventos programados.
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
            <div style="color:#ffffff;font-size:12px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;margin-bottom:6px;opacity:0.85;">${escape(dayLabel)}${timeLabel ? ` \xB7 ${escape(timeLabel)}` : ""}</div>
            <h1 style="margin:0 0 8px 0;color:#ffffff;font-size:26px;line-height:1.15;font-weight:900;letter-spacing:-0.02em;">
              <a href="${escape(url)}" style="color:#ffffff;text-decoration:none;">${escape(title)}</a>
            </h1>
            ${showVenue ? `<div style="color:#a1a1aa;font-size:14px;margin-bottom:14px;">\u{1F4CD} ${escape(venue)}${city ? ` \xB7 ${escape(city)}` : ""}</div>` : ""}
            ${showCta ? useWeekend && w?.ctas && w.ctas.length > 1 ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">${w.ctas.map((c) => `<tr><td style="padding:4px 0;"><a href="${escape(c.url)}" style="display:block;min-width:220px;padding:12px 22px;background:${gradient};color:#ffffff;font-size:12px;font-weight:900;text-align:center;text-decoration:none;text-transform:uppercase;letter-spacing:0.14em;border-radius:10px;">${escape((c.dayLabel ? c.dayLabel + " \xB7 " : "") + c.label + (c.timeLabel ? " \xB7 " + c.timeLabel : ""))} \u2014 ${ctaLabel}</a></td></tr>`).join("")}</table>` : ticketUrl ? `<a href="${escape(ticketUrl)}" style="display:inline-block;padding:14px 26px;background:${gradient};color:#ffffff;font-size:13px;font-weight:900;text-decoration:none;text-transform:uppercase;letter-spacing:0.18em;border-radius:10px;">${ctaLabel}</a>` : "" : ""}
          </td></tr>
        </table>
      </td></tr>`;
    }
    case "blog_posts_list": {
      const posts = (event.blogPosts || []).slice(0, clamp(block.max_items, EMAIL_BLOCK_LIMITS.blogPostsList.minItems, EMAIL_BLOCK_LIMITS.blogPostsList.maxItems, EMAIL_BLOCK_LIMITS.blogPostsList.defaultItems));
      const eyebrow = escape(block.eyebrow || "MAT\xC9RIAS");
      const title = escape(block.title || "Do blog nesta semana");
      const layout = block.layout || "list";
      const showExcerpt = block.show_excerpt !== false;
      const showCategory = block.show_category !== false;
      const align = block.align || "left";
      if (posts.length === 0) {
        if (!ctx.preview) return "";
        return `<tr><td style="padding:8px 32px;">
          <div style="padding:24px;background:rgba(255,255,255,0.04);border:1px dashed rgba(255,255,255,0.15);border-radius:12px;text-align:center;color:#a1a1aa;font-size:13px;">
            \u{1F4F0} \xDAltimos posts do blog aparecer\xE3o aqui.
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
                ${showCategory && p.category ? `<div style="color:${accent};font-size:10px;font-weight:800;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:4px;">${escape(p.category)}${p.publishedLabel ? ` \xB7 ${escape(p.publishedLabel)}` : ""}</div>` : p.publishedLabel ? `<div style="color:#71717a;font-size:11px;margin-bottom:4px;">${escape(p.publishedLabel)}</div>` : ""}
                <div style="color:#ffffff;font-size:16px;font-weight:800;line-height:1.25;margin-bottom:4px;"><a href="${url}" style="color:#ffffff;text-decoration:none;">${escape(p.title)}</a></div>
                ${showExcerpt && p.excerpt ? `<div style="color:#a1a1aa;font-size:13px;line-height:1.5;">${escape(p.excerpt)}</div>` : ""}
                <a href="${url}" style="display:inline-block;margin-top:8px;color:${primary};font-size:11px;font-weight:800;text-decoration:none;text-transform:uppercase;letter-spacing:0.15em;">Ler mat\xE9ria \u2192</a>
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
                ${showCategory && p.category ? `<div style="color:${accent};font-size:10px;font-weight:800;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:3px;">${escape(p.category)}${p.publishedLabel ? ` \xB7 ${escape(p.publishedLabel)}` : ""}</div>` : p.publishedLabel ? `<div style="color:#71717a;font-size:11px;margin-bottom:3px;">${escape(p.publishedLabel)}</div>` : ""}
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
      const unsubscribe = block.include_unsubscribe !== false ? `<p style="margin:8px 0 0 0;font-size:11px;"><a href="[E-GOI_UNSUBSCRIBE_LINK]" style="color:#71717a;font-weight:700;text-decoration:underline;">Descadastrar-se</a></p>` : "";
      return `<tr><td align="${align}" style="padding:24px 32px 40px 32px;background:rgba(0,0,0,0.4);border-top:1px solid rgba(255,255,255,0.06);text-align:${align};">
        <p style="margin:0;color:#52525b;font-size:11px;line-height:1.6;max-width:400px;display:inline-block;">${txt}</p>
        ${unsubscribe}
      </td></tr>`;
    }
    default:
      return "";
  }
}
function renderBlockedTemplate(blocks, event, settings, article, opts) {
  const s = {
    brand_name: settings?.brand_name || "MDACCULA",
    primary_color: settings?.primary_color || "#a855f7",
    accent_color: settings?.accent_color || "#ec4899",
    background_color: settings?.background_color || "#050505",
    footer_text: settings?.footer_text || "Voc\xEA recebeu este e-mail porque assinou a lista MDAccula.",
    cta_label: settings?.cta_label || "Garantir ingresso",
    logo_url: settings?.logo_url ?? null,
    custom_html_header: settings?.custom_html_header ?? null,
    custom_html_footer: settings?.custom_html_footer ?? null
  };
  const resolvedBlocks = expandGlobalRefs(blocks, opts?.globals ?? null);
  const heroBlock = resolvedBlocks.find(
    (b) => b.kind === "weekly_hero" && (b.source ?? "first_weekend") === "first_weekend"
  );
  const heroEventId = heroBlock ? event.weekendEvents?.[0]?.id : void 0;
  const ctx = { event, article, settings: s, preview: opts?.preview, projectId: opts?.projectId, heroEventId };
  const bg = escape(s.background_color);
  const brand = escape(s.brand_name);
  const preheader = escape(opts?.preheader ?? computePreheader(event));
  const rows = resolvedBlocks.map((b) => renderBlock(b, ctx)).join("\n");
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
<title>${escape(event.eventTitle)} \u2014 ${brand}</title>
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
function computePreheader(event) {
  const t = (event.eventTitle || "").trim();
  const d = (event.dateLabel || "").trim();
  const v = (event.venueName || "").trim();
  const c = (event.cityState || "").trim();
  const parts = [t];
  if (d) parts.push(d);
  if (v || c) parts.push([v, c].filter(Boolean).join(", "));
  return parts.filter(Boolean).join(" \u2014 ").slice(0, 150);
}
function stripHtml(html) {
  return html.replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|li|h[1-6])>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}
function renderBlockText(block, event, settings) {
  if (block.hidden) return "";
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
        `  ${event.dateLabel} \u2014 ${event.timeLabel}`,
        "LOCAL:",
        `  ${event.venueName} \u2014 ${event.cityState}`
      ].join("\n");
    case "description":
      return event.description || "";
    case "article_summary":
      return "";
    case "cta_button": {
      const url = block.url_field === "vip_link" ? event.vipLink || event.ticketUrl : block.url_field === "event_url" ? event.eventUrl : block.url_field === "custom" ? block.custom_url || event.ticketUrl : event.ticketUrl;
      const label = block.label || event.ctaLabel || settings.cta_label || "Garantir ingresso";
      return `>> ${label.toUpperCase()}: ${url}`;
    }
    case "secondary_link": {
      const url = block.url_field === "event_url" ? event.eventUrl : block.url_field === "custom" ? block.custom_url || event.agendaUrl : event.agendaUrl;
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
      return (block.messages || []).filter(Boolean).join(" \xB7 ");
    case "static_map":
      return event.venueLat && event.venueLng ? `Mapa: https://www.google.com/maps/search/?api=1&query=${event.venueLat},${event.venueLng}` : "";
    case "weekend_grid": {
      const list = event.weekendEvents || [];
      if (!list.length) return "";
      const header = (block.title || "Agenda do fim de semana").toUpperCase();
      const rows = list.map(
        (ev) => `- ${ev.dayLabel}${ev.timeLabel ? " " + ev.timeLabel : ""} \xB7 ${ev.title} @ ${ev.venue}${ev.cityState ? " (" + ev.cityState + ")" : ""} \u2014 ${ev.eventUrl}`
      );
      return `${header}
${rows.join("\n")}`;
    }
    case "dedge_block": {
      const d = event.dedge;
      if (!d) return "";
      const nights = (d.nights || []).filter((n) => n.enabled).map((n) => `  - ${n.label}: ${n.url}`);
      return `D.EDGE
${d.title || ""}
${d.description || ""}
${nights.join("\n")}`.trim();
    }
    case "weekly_hero": {
      const first = event.weekendEvents?.[0];
      if (!first) return "";
      return `${(block.eyebrow || "Destaque").toUpperCase()}: ${first.title} \u2014 ${first.eventUrl}`;
    }
    case "blog_posts_list": {
      const posts = (event.blogPosts || []).slice(0, clamp(block.max_items, EMAIL_BLOCK_LIMITS.blogPostsList.minItems, EMAIL_BLOCK_LIMITS.blogPostsList.maxItems, EMAIL_BLOCK_LIMITS.blogPostsList.defaultItems));
      if (!posts.length) return "";
      const header = (block.title || "No blog").toUpperCase();
      const rows = posts.map((p) => `- ${p.title} \u2014 ${p.url}`);
      return `${header}
${rows.join("\n")}`;
    }
    case "footer":
      return block.text || settings.footer_text || "";
    case "global_ref":
      return "";
    default:
      return "";
  }
}
function renderBlockedTemplateText(blocks, event, settings, _article, opts) {
  const s = {
    brand_name: settings?.brand_name || "MDACCULA",
    footer_text: settings?.footer_text || "",
    cta_label: settings?.cta_label || "Garantir ingresso"
  };
  const resolved = expandGlobalRefs(blocks, opts?.globals ?? null);
  const parts = resolved.map((b) => renderBlockText(b, event, s)).filter((s2) => s2 && s2.trim());
  const body = parts.join("\n\n");
  const preheader = opts?.preheader ?? computePreheader(event);
  const footer = "\n\n---\nVoc\xEA recebeu este e-mail porque assina a lista MDAccula.";
  return `${preheader}

${body}${footer}`.replace(/\n{3,}/g, "\n\n").trim();
}

// supabase/functions/_shared/emailMeta.ts
var PLACEHOLDER_RE = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;
var valueMap = (data) => ({
  event_title: data.eventTitle ?? "",
  "event.title": data.eventTitle ?? "",
  date_label: data.dateLabel ?? "",
  "event.date_label": data.dateLabel ?? "",
  time_label: data.timeLabel ?? "",
  "event.time_label": data.timeLabel ?? "",
  venue_name: data.venueName ?? "",
  "event.venue": data.venueName ?? "",
  "event.venue_name": data.venueName ?? "",
  city_state: data.cityState ?? "",
  "event.city_state": data.cityState ?? "",
  weekend_range: data.weekendRange ?? data.rangeLabel ?? "",
  week_range: data.weekRange ?? data.rangeLabel ?? "",
  range_label: data.rangeLabel ?? "",
  events_count: data.eventsCount == null ? "" : String(data.eventsCount)
});
function resolveEmailPlaceholders(template, data) {
  if (!template) return "";
  const values = valueMap(data);
  return String(template).replace(PLACEHOLDER_RE, (match, key) => values[key] ?? match).trim();
}
function buildEmailMeta(subjectTemplate, preheaderTemplate, data) {
  return {
    subject: resolveEmailPlaceholders(subjectTemplate, data),
    preheader: resolveEmailPlaceholders(preheaderTemplate, data)
  };
}
function injectEmailPreheader(html, preheader) {
  const escaped = preheader.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  const hidden = `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${escaped}</div>`;
  if (/<div\s+style="display:none;max-height:0;overflow:hidden;mso-hide:all;">[\s\S]*?<\/div>/i.test(html)) {
    return html.replace(/<div\s+style="display:none;max-height:0;overflow:hidden;mso-hide:all;">[\s\S]*?<\/div>/i, hidden);
  }
  return html.replace(/<body([^>]*)>/i, `<body$1>
${hidden}`);
}

// supabase/functions/_shared/emailComposer.ts
var issue = (block, code, message) => ({
  blockId: block.id,
  kind: block.kind,
  code,
  message
});
var isValidDate = (value) => !!value && !Number.isNaN(new Date(value).getTime());
function validateEmailBlocks(blocks, event, article, globals) {
  const issues = [];
  for (const original of blocks) {
    if (original.hidden) continue;
    let block = original;
    if (block.kind === "global_ref") {
      const global = globals instanceof Map ? globals.get(block.global_id) : globals?.[block.global_id];
      if (!global) {
        issues.push(issue(block, "GLOBAL_BLOCK_MISSING", "O bloco global vinculado n\xE3o existe mais."));
        continue;
      }
      block = { ...global.block, id: original.id };
      if (block.hidden) continue;
    }
    switch (block.kind) {
      case "hero_image":
        if (!event.flyerUrl?.trim()) issues.push(issue(block, "FLYER_MISSING", "Cadastre o flyer do evento ou oculte o bloco de imagem."));
        break;
      case "title":
        if (!event.eventTitle?.trim()) issues.push(issue(block, "TITLE_MISSING", "O evento precisa de t\xEDtulo."));
        break;
      case "subtitle":
        if (!event.eventSubtitle?.trim()) issues.push(issue(block, "SUBTITLE_MISSING", "Preencha o subt\xEDtulo do evento ou oculte este bloco."));
        break;
      case "event_meta":
        if (!event.dateLabel || !event.timeLabel || !event.venueName || !event.cityState) issues.push(issue(block, "EVENT_META_MISSING", "Preencha data, hora e local do evento."));
        break;
      case "description":
        if (!event.description?.trim()) issues.push(issue(block, "DESCRIPTION_MISSING", "Preencha a descri\xE7\xE3o do evento ou oculte este bloco."));
        break;
      case "article_summary":
        if (!article?.title || !article.url) issues.push(issue(block, "ARTICLE_MISSING", "Vincule uma mat\xE9ria ao evento ou oculte o resumo."));
        break;
      case "cta_button": {
        const url = block.url_field === "vip_link" ? event.vipLink : block.url_field === "event_url" ? event.eventUrl : block.url_field === "custom" ? block.custom_url : event.ticketUrl;
        if (!url?.trim()) issues.push(issue(block, "CTA_URL_MISSING", "Preencha o link usado pelo bot\xE3o principal."));
        break;
      }
      case "secondary_link": {
        const url = block.url_field === "event_url" ? event.eventUrl : block.url_field === "custom" ? block.custom_url : event.agendaUrl;
        if (!url?.trim()) issues.push(issue(block, "SECONDARY_URL_MISSING", "Preencha o destino do link secund\xE1rio."));
        break;
      }
      case "image_with_link":
        if (!block.image_url?.trim()) issues.push(issue(block, "IMAGE_MISSING", "Escolha a imagem deste bloco ou oculte-o."));
        if (!block.link_url?.trim()) issues.push(issue(block, "IMAGE_LINK_MISSING", "Preencha o link da imagem."));
        break;
      case "text":
        if (!block.html?.trim()) issues.push(issue(block, "TEXT_MISSING", "Preencha o conte\xFAdo do bloco de texto."));
        break;
      case "social_icons":
        if (!(block.networks || []).some((network) => network.enabled && network.url?.trim())) issues.push(issue(block, "SOCIAL_LINK_MISSING", "Ative ao menos uma rede social com link preenchido."));
        break;
      case "lineup":
        if (!(event.lineup || []).some(Boolean)) issues.push(issue(block, "LINEUP_MISSING", "Preencha o line-up do evento ou oculte este bloco."));
        break;
      case "countdown": {
        const source = block.deadline_source || "today_2359";
        const value = source === "custom" ? block.custom_deadline : source === "event_start" ? event.eventStartIso : source === "batch_deadline" ? event.ticketBatchDeadlineIso : (/* @__PURE__ */ new Date()).toISOString();
        if (!isValidDate(value)) issues.push(issue(block, "COUNTDOWN_DATE_MISSING", "Defina uma data v\xE1lida para a contagem regressiva."));
        break;
      }
      case "static_map":
        if (typeof event.venueLat !== "number" || typeof event.venueLng !== "number") issues.push(issue(block, "MAP_COORDINATES_MISSING", "Geocodifique o local do evento ou oculte o mapa."));
        break;
      case "weekend_grid":
        if (!(event.weekendEvents || []).length) issues.push(issue(block, "WEEKEND_EVENTS_MISSING", "N\xE3o h\xE1 eventos para montar a agenda deste bloco."));
        break;
      case "dedge_block": {
        const hasBlockContent = !!(block.image_url || block.primary_url);
        const hasData = !!(event.dedge?.imageUrl || event.dedge?.primaryUrl || event.dedge?.nights?.some((night) => night.enabled && night.url));
        if (!hasBlockContent && !hasData) issues.push(issue(block, "DEDGE_CONTENT_MISSING", "Configure a imagem ou os links do bloco Dedge."));
        break;
      }
      case "weekly_hero":
        if ((block.source || "first_weekend") === "first_weekend" && !(event.weekendEvents || []).length) issues.push(issue(block, "WEEKLY_HERO_MISSING", "N\xE3o h\xE1 evento para o destaque da semana."));
        else if (!event.flyerUrl || !event.eventTitle) issues.push(issue(block, "WEEKLY_HERO_MISSING", "O destaque precisa de t\xEDtulo e imagem."));
        break;
      case "blog_posts_list":
        if (!(event.blogPosts || []).length) issues.push(issue(block, "BLOG_POSTS_MISSING", "N\xE3o h\xE1 mat\xE9rias para montar este bloco."));
        break;
      default:
        break;
    }
  }
  return issues;
}
function composeEmail(input) {
  const { template, event, settings, article = null, globals = null } = input;
  const meta = buildEmailMeta(template.subject_template, template.preheader_template, input.metaData ?? {
    eventTitle: event.eventTitle,
    dateLabel: event.dateLabel,
    timeLabel: event.timeLabel,
    venueName: event.venueName,
    cityState: event.cityState
  });
  const issues = validateEmailBlocks(template.blocks, event, article, globals);
  if (!meta.subject) issues.unshift({ blockId: "template", kind: "template", code: "SUBJECT_MISSING", message: "Preencha o assunto do template." });
  if (template.blocks.length === 0) issues.push({ blockId: "template", kind: "template", code: "BLOCKS_MISSING", message: "Adicione ao menos um bloco ao template." });
  return {
    html: renderBlockedTemplate(template.blocks, event, settings, article, { preview: false, globals, preheader: meta.preheader }),
    subject: meta.subject,
    preheader: meta.preheader,
    event,
    issues
  };
}

// supabase/functions/blog-digest-draft/index.ts
var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret, x-cron-job"
};
var BASE = "https://api.egoiapp.com";
var SITE_URL = "https://mdaccula.com";
async function egoiRequest(path, apiKey, init = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Apikey: apiKey,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...init.headers || {}
    }
  });
  const text = await res.text();
  let body = text;
  try {
    body = JSON.parse(text);
  } catch {
  }
  return { status: res.status, ok: res.ok, body };
}
var escapeHtml = (s) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
function hasAnyBlockKind(blocks, kinds) {
  if (!blocks?.length) return false;
  return blocks.some((b) => kinds.includes(b.kind));
}
function renderLegacyBlogHtml(posts, settings, rangeLabel) {
  const primary = settings.primary_color || "#a855f7";
  const accent = settings.accent_color || "#ec4899";
  const bg = settings.background_color || "#050505";
  const brand = settings.brand_name || "MDACCULA";
  const footer = settings.footer_text || "Voc\xEA recebeu este e-mail porque assinou a lista MDAccula.";
  const logo = settings.logo_url ? `<img src="${escapeHtml(settings.logo_url)}" alt="${escapeHtml(brand)}" width="140" height="42" style="display:block;height:42px;width:auto;border:0;outline:none;" />` : `<div style="font-family:Arial,sans-serif;font-size:22px;font-weight:800;letter-spacing:2px;color:#fff;">${escapeHtml(brand)}</div>`;
  const cards = posts.length === 0 ? `<tr><td style="padding:12px 20px;color:#bbb;font-family:Arial,sans-serif;font-size:14px;">Nenhuma mat\xE9ria nova no per\xEDodo.</td></tr>` : posts.map((p) => {
    const url = `${SITE_URL}/blog/${escapeHtml(p.slug)}`;
    const img = p.image_url || `${SITE_URL}/placeholder.svg`;
    return `
        <tr><td style="padding:8px 20px;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;background:#0d0d0d;border:1px solid #1e1e1e;border-radius:10px;overflow:hidden;">
            <tr>
              <td width="120" valign="top"><a href="${url}"><img src="${escapeHtml(img)}" width="120" height="120" style="display:block;width:120px;height:120px;object-fit:cover;border:0;outline:none;" alt=""></a></td>
              <td valign="top" style="padding:12px 14px;font-family:Arial,sans-serif;">
                <div style="font-size:16px;font-weight:800;color:#fff;margin:0 0 4px 0;line-height:1.25;">
                  <a href="${url}" style="color:#fff;text-decoration:none;">${escapeHtml(p.title)}</a>
                </div>
                ${p.excerpt ? `<div style="font-size:12px;color:#bbb;margin-top:4px;line-height:1.4;">${escapeHtml(p.excerpt.slice(0, 160))}${p.excerpt.length > 160 ? "\u2026" : ""}</div>` : ""}
              </td>
            </tr>
          </table>
        </td></tr>`;
  }).join("");
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${escapeHtml(brand)} \u2014 novidades do blog</title></head>
<body style="margin:0;padding:0;background:${bg};">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;background:${bg};">
  <tr><td align="center" style="padding:24px 12px;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="width:600px;max-width:600px;border-collapse:collapse;background:${bg};">
      <tr><td align="center" style="padding:8px 20px 16px 20px;">${logo}</td></tr>
      <tr><td style="padding:0 20px 8px 20px;font-family:Arial,sans-serif;">
        <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${accent};font-weight:700;">Novidades do blog \xB7 ${escapeHtml(rangeLabel)}</div>
        <h1 style="font-size:24px;line-height:1.2;color:#fff;margin:6px 0 4px 0;">Leituras da semana</h1>
      </td></tr>
      ${cards}
      <tr><td align="center" style="padding:16px 20px;">
        <a href="${SITE_URL}/blog" style="display:inline-block;background:${primary};color:#fff;font-family:Arial,sans-serif;font-size:14px;font-weight:700;padding:12px 22px;border-radius:8px;text-decoration:none;">Ver todas as mat\xE9rias</a>
      </td></tr>
      <tr><td style="padding:24px 20px 8px 20px;font-family:Arial,sans-serif;color:#777;font-size:11px;line-height:1.5;border-top:1px solid #222;">
        ${escapeHtml(footer)}<br><br>
        <a href="[E-GOI_UNSUBSCRIBE_LINK]" style="color:#888;text-decoration:underline;">Descadastrar</a>
      </td></tr>
    </table>
  </td></tr>
</table></body></html>`;
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (data, status = 200) => new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
  try {
    const authHeader = req.headers.get("Authorization");
    const cronSecret = req.headers.get("x-cron-secret");
    const cronJobHeader = req.headers.get("x-cron-job");
    const envCronSecret = Deno.env.get("CRON_SHARED_SECRET");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const admin = createClient(supabaseUrl, serviceKey);
    let isCron = !!(cronSecret && envCronSecret && cronSecret === envCronSecret);
    if (!isCron && cronSecret && cronJobHeader) {
      const { data: row } = await admin.from("internal_cron_secrets").select("secret").eq("name", "blog_digest_cron").maybeSingle();
      if (row?.secret && row.secret === cronSecret) isCron = true;
    }
    if (!authHeader && !isCron) return json({ error: "N\xE3o autenticado" }, 401);
    if (!isCron && authHeader) {
      const anonClient = createClient(supabaseUrl, anonKey);
      const token = authHeader.replace("Bearer ", "");
      const { data: userData, error: userErr } = await anonClient.auth.getUser(token);
      if (userErr || !userData.user) return json({ error: "Token inv\xE1lido" }, 401);
      const { data: isAdmin } = await admin.rpc("has_role", {
        _user_id: userData.user.id,
        _role: "admin"
      });
      if (!isAdmin) return json({ error: "Apenas admins" }, 403);
    }
    const body = await req.json().catch(() => ({}));
    const force = body?.force === true;
    const dryRun = body?.dry_run === true;
    const overrideTemplateId = typeof body?.template_id === "string" && body.template_id ? body.template_id : null;
    const daysBack = Math.max(1, Math.min(60, Number(body?.days_back) || 7));
    const { data: masterRow } = await admin.from("site_settings").select("value").eq("key", "egoi_email_enabled").maybeSingle();
    if (masterRow?.value !== "true") {
      return json({ skipped: true, reason: "master_off" });
    }
    const { data: digestRow } = await admin.from("site_settings").select("value").eq("key", "blog_digest_enabled").maybeSingle();
    const digestEnabled = digestRow?.value === "true";
    if (isCron && !digestEnabled) {
      return json({ skipped: true, reason: "digest_disabled" });
    }
    if (!isCron && !digestEnabled && !force) {
      return json({ skipped: true, reason: "digest_disabled" });
    }
    let cfg = null;
    let apiKey;
    if (!dryRun) {
      const { data } = await admin.from("egoi_config").select("*").maybeSingle();
      cfg = data;
      if (!cfg || !cfg.is_enabled || !cfg.list_id || !cfg.sender_id) {
        return json({ skipped: true, reason: "config_disabled_or_incomplete" });
      }
      apiKey = Deno.env.get("EGOI_API_KEY");
      if (!apiKey) return json({ error: "EGOI_API_KEY n\xE3o configurada" }, 500);
    }
    const now = /* @__PURE__ */ new Date();
    const rangeStart = new Date(now.getTime() - daysBack * 24 * 3600 * 1e3);
    const rangeLabel = `${rangeStart.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} \u2192 ${now.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}`;
    const todayIso = now.toISOString().slice(0, 10);
    let activeTplQuery = admin.from("email_templates").select("id,name,type,blocks,is_default,subject_template,preheader_template");
    if (overrideTemplateId) {
      activeTplQuery = activeTplQuery.eq("id", overrideTemplateId);
    } else {
      const { data: cfgTplRow } = await admin.from("site_settings").select("value").eq("key", "blog_digest_template_id").maybeSingle();
      const cfgTplId = cfgTplRow?.value && cfgTplRow.value !== "" ? cfgTplRow.value : null;
      if (cfgTplId) {
        activeTplQuery = activeTplQuery.eq("id", cfgTplId);
      } else {
        activeTplQuery = activeTplQuery.eq("type", "blog_digest").order("is_default", { ascending: false }).order("updated_at", { ascending: false }).limit(1);
      }
    }
    const [{ data: posts }, { data: tplSettings }, { data: activeTpl }, { data: globalBlocksRows }] = await Promise.all([
      admin.from("blog_posts").select("id,title,slug,excerpt,image_url,published_at,published").eq("published", true).gte("published_at", rangeStart.toISOString()).order("published_at", { ascending: false, nullsFirst: false }).limit(10),
      admin.from("email_template_settings").select("*").maybeSingle(),
      activeTplQuery.maybeSingle(),
      admin.from("email_global_blocks").select("id, name, description, category, block")
    ]);
    const pts = posts ?? [];
    if (pts.length === 0) {
      return json({ skipped: true, reason: "no_posts_in_range", range: rangeLabel });
    }
    const settings = tplSettings ?? {};
    const globalsMap = /* @__PURE__ */ new Map();
    for (const g of globalBlocksRows ?? []) globalsMap.set(g.id, g);
    let html = "";
    let renderSource = "legacy";
    let renderedEventPayload = null;
    const tplBlocks = Array.isArray(activeTpl?.blocks) ? activeTpl.blocks : null;
    const resolvedTplBlocks = tplBlocks ? expandGlobalRefs(tplBlocks, globalsMap) : null;
    if (resolvedTplBlocks && resolvedTplBlocks.length > 0) {
      if (!hasAnyBlockKind(resolvedTplBlocks, ["blog_posts_list"])) {
        return json({
          ok: false,
          error: "Template de Blog news precisa conter bloco de mat\xE9rias do blog.",
          template_id: activeTpl?.id ?? null,
          template_name: activeTpl?.name ?? null
        }, 400);
      }
      try {
        const blogPosts = pts.map((p) => ({
          id: p.id,
          title: p.title,
          excerpt: p.excerpt ?? void 0,
          imageUrl: p.image_url ?? void 0,
          url: `${SITE_URL}/blog/${p.slug}`
        }));
        const firstPost = pts[0];
        const eventPayload = {
          eventTitle: "Novidades do blog",
          eventSubtitle: `Blog \xB7 ${rangeLabel}`,
          flyerUrl: firstPost?.image_url || settings.logo_url || `${SITE_URL}/placeholder.svg`,
          dateLabel: rangeLabel,
          timeLabel: "",
          venueName: "MDAccula",
          cityState: "S\xE3o Paulo-SP",
          description: "As mat\xE9rias em alta desta semana.",
          ticketUrl: `${SITE_URL}/blog`,
          eventUrl: `${SITE_URL}/blog`,
          agendaUrl: `${SITE_URL}/blog`,
          instagramUrl: settings.instagram_url || "",
          youtubeUrl: settings.youtube_url || "",
          tiktokUrl: settings.tiktok_url || "",
          unsubscribeUrl: "[E-GOI_UNSUBSCRIBE_LINK]",
          weekendEvents: [],
          blogPosts
        };
        renderedEventPayload = eventPayload;
        renderSource = "template";
      } catch (err) {
        console.error("[blog-digest-draft] template render failed, using legacy HTML:", err);
        html = "";
      }
    }
    if (!html && !renderedEventPayload) {
      html = renderLegacyBlogHtml(pts, settings, rangeLabel);
      renderSource = "legacy";
    }
    const meta = buildEmailMeta(
      activeTpl?.subject_template,
      activeTpl?.preheader_template,
      {
        rangeLabel,
        weekRange: rangeLabel,
        weekendRange: rangeLabel,
        eventsCount: pts.length
      }
    );
    if (!meta.subject) return json({ ok: false, error: "Assunto do template est\xE1 vazio" }, 400);
    const subject = meta.subject;
    const preheaderFromTpl = meta.preheader;
    const internalName = `MDAccula \u2022 Blog news \u2022 ${todayIso}`;
    if (resolvedTplBlocks && renderSource === "template" && renderedEventPayload) {
      const composition = composeEmail({
        template: {
          blocks: resolvedTplBlocks,
          subject_template: activeTpl?.subject_template,
          preheader_template: activeTpl?.preheader_template
        },
        event: renderedEventPayload,
        settings,
        globals: globalsMap,
        metaData: { rangeLabel, weekRange: rangeLabel, weekendRange: rangeLabel, eventsCount: pts.length }
      });
      if (composition.issues.length > 0) return json({ ok: false, error: "Template incompleto", validation_issues: composition.issues }, 400);
      html = composition.html;
    } else if (html && preheaderFromTpl) {
      html = injectEmailPreheader(html, preheaderFromTpl);
    }
    if (dryRun) {
      return json({
        ok: true,
        dry_run: true,
        subject,
        preheader: preheaderFromTpl,
        internal_name: internalName,
        html,
        posts_count: pts.length,
        range: rangeLabel,
        render_source: renderSource,
        template_id: activeTpl?.id ?? null,
        template_name: activeTpl?.name ?? null
      });
    }
    let textVersion = "";
    let preheaderText = preheaderFromTpl || "";
    try {
      if (resolvedTplBlocks && renderSource === "template" && renderedEventPayload) {
        textVersion = renderBlockedTemplateText(resolvedTplBlocks, renderedEventPayload, settings, null, { globals: globalsMap, preheader: preheaderText });
      }
    } catch (e) {
      console.warn("[blog-digest-draft] text/preheader gen failed:", e);
    }
    const createPayload = {
      list_id: Number(cfg.list_id),
      internal_name: internalName,
      subject,
      sender_id: Number(cfg.sender_id),
      content: {
        type: "html",
        body: html,
        ...preheaderText ? { preheader: preheaderText } : {},
        ...textVersion ? { text: textVersion } : {}
      },
      tags: ["mdaccula", "blog-news"]
    };
    if (cfg.reply_to) createPayload.reply_to = Number(cfg.reply_to);
    const created = await egoiRequest("/campaigns/email", apiKey, {
      method: "POST",
      body: JSON.stringify(createPayload)
    });
    if (!created.ok) {
      return json({
        ok: false,
        error: `E-goi ${created.status}`,
        detail: typeof created.body === "string" ? created.body : JSON.stringify(created.body)
      }, 502);
    }
    const campaignHash = created.body?.campaign_hash || created.body?.hash || created.body?.data?.campaign_hash || (created.body?.campaign_id != null ? String(created.body.campaign_id) : null) || (created.body?.id != null ? String(created.body.id) : null);
    return json({
      ok: true,
      status: "draft",
      egoi_campaign_id: campaignHash,
      posts_count: pts.length,
      range: rangeLabel,
      template_id: activeTpl?.id ?? null,
      template_name: activeTpl?.name ?? null
    });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
});
