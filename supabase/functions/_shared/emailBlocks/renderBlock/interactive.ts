// Família "interactive" — botões CTA, ticker, countdown, links sociais, mapa, lineup.
// Extraído de renderBlock.ts (Onda 23) sem alterar HTML gerado.
import type { Block, RenderContext } from "../types.ts";
import { escape, resolveCtaUrl, resolveSecondaryUrl } from "../utils.ts";
import type { RenderStyle } from "./style.ts";

export function renderInteractiveBlock(
  block: Block,
  ctx: RenderContext,
  style: RenderStyle,
): string | null {
  const { event, settings } = ctx;
  const { primary, accent, gradient, solidPrimary } = style;

  switch (block.kind) {
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

    case "pix_button": {
      if (!event.pixWhatsAppUrl) return "";
      const url = event.pixWhatsAppUrl;
      const label = escape(block.label || "Comprar Sem Taxa via Pix");
      const align = block.align ?? "center";
      const fullWidth = block.full_width !== false;
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

    case "social_icons": {
      const list = (block.networks || []).filter((n) => n.enabled && (ctx.preview || n.url));
      if (list.length === 0) return "";
      const align = block.align ?? "center";
      const style2 = block.style || "text";
      const colors = [primary, accent, "#60a5fa", "#f472b6", "#34d399", "#fbbf24", "#a78bfa", "#fb923c"];
      const cells = list.map((n, i) => {
        const href = escape(n.url || "#");
        if (style2 === "pill") {
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
      const style2 = block.map_style || "roadmap";
      const radius = block.border_radius ?? 12;
      const showLabel = block.show_address_label !== false;
      const projectId = ctx.projectId || "xfvpuzlspvvsmmunznxw";
      const mapSrc = `https://${projectId}.supabase.co/functions/v1/render-static-map?lat=${lat}&lng=${lng}&zoom=${zoom}&w=600&h=${height}&style=${style2}`;
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

    default:
      return null;
  }
}
