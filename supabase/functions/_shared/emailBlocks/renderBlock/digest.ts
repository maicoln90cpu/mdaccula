// Família "digest" — grids semanais, hero da semana, Dedge e lista de posts.
// Extraído de renderBlock.ts (Onda 23) sem alterar HTML gerado.
import { EMAIL_BLOCK_LIMITS, clamp } from "../../emailBlocksLimits.ts";
import type { Align, Block, RenderContext, WeekendEventItem } from "../types.ts";
import { escape, proxyForEmail, renderBulletproofButton, resolveGridCardUrl } from "../utils.ts";
import type { RenderStyle } from "./style.ts";

const gridColumns = (block: { columns?: 2 | 3 }): number => (block.columns === 3 ? 3 : 2);

/**
 * Largura de cada célula do grid em %, sempre somando 100% da linha —
 * dividida pela quantidade REAL de itens na linha (`rowLength`), não pela
 * contagem de colunas declarada no bloco. Numa linha incompleta (sobra de
 * itens, ex.: 1 evento sozinho numa grade de 2 colunas), dividir pela
 * contagem declarada deixava a célula com a mesma largura-base de uma linha
 * cheia (ex.: 50%), sobrando metade da linha vazia e a imagem "grudada" à
 * esquerda em vez de ocupar o espaço todo — bug relatado em produção.
 * A última célula recebe o resto exato pra somar 100 mesmo com divisão
 * não-exata (ex.: 33.33+33.33+33.34).
 */
const gridColWidthPct = (index: number, rowLength: number): number => {
  const base = Math.floor((100 / rowLength) * 100) / 100;
  const isLast = index === rowLength - 1;
  if (!isLast) return base;
  return Math.round((100 - base * (rowLength - 1)) * 100) / 100;
};

/**
 * Card compartilhado pelos grids de múltiplos eventos (`event_grid` e
 * `weekend_grid` no layout "grid"). Nome do evento vem primeiro (faixa com
 * fundo em gradiente escuro), imagem logo abaixo, e por fim dia/hora,
 * line-up e botão — ordem pedida para dar mais destaque ao nome antes da
 * imagem carregar.
 *
 * `linkTarget` (só usado por `event_grid`, ver `resolveGridCardUrl`) escolhe
 * um destino único pra imagem+nome+botão: ticketeira externa ou página do
 * evento no site. Quando não informado (uso do `weekend_grid`, fora de
 * escopo desta opção), mantém o comportamento antigo: imagem/nome sempre
 * pra `eventUrl`, botão sempre pra `ticketUrl` (dois destinos distintos).
 */
function renderGridEventCard(
  ev: WeekendEventItem,
  opts: { columns: number; accentColor: string; gradient: string; solidPrimary: string; defaultCtaLabel: string; showTime: boolean; align?: Align; linkTarget?: "ticket_link" | "event_url" },
): string {
  const { columns, accentColor, gradient, solidPrimary, defaultCtaLabel, showTime, align = "left", linkTarget } = opts;
  const url = escape(linkTarget ? resolveGridCardUrl(ev, linkTarget) || "#" : ev.eventUrl || "#");
  const ctaLabel = escape(ev.ctaLabel || defaultCtaLabel);

  // Largura máxima da imagem derivada da largura útil do e-mail (552px) menos
  // o padding de 8px por lado de cada card — em 2 colunas dá 260 (igual ao
  // valor fixo de antes), em 3 colunas dá 168.
  const imgMaxWidth = Math.floor((552 - columns * 16) / columns);

  const btnUrl = linkTarget ? resolveGridCardUrl(ev, linkTarget) : ev.ticketUrl;
  const btn = btnUrl
    ? renderBulletproofButton(escape(btnUrl), ctaLabel, {
      bg: gradient,
      bgSolid: solidPrimary,
      fullWidth: true,
      vmlWidth: Math.max(imgMaxWidth - 28, 60),
      padding: "10px 12px",
      fontSize: 11,
      height: 38,
      radius: 8,
      letterSpacing: "0.1em",
    })
    : "";

  const maxNames = columns >= 3
    ? EMAIL_BLOCK_LIMITS.gridCardLineup.maxNamesAt3Cols
    : EMAIL_BLOCK_LIMITS.gridCardLineup.maxNamesAt2Cols;
  const names = (ev.lineup || []).filter(Boolean);
  const shown = names.slice(0, maxNames);
  const extra = names.length - shown.length;
  const lineupChips = names.length === 0 ? "" : `<div style="margin-bottom:8px;">${shown
    .map((n) => `<span style="display:inline-block;margin:2px 3px 2px 0;padding:3px 8px;background:rgba(168,85,247,0.12);border:1px solid ${accentColor};border-radius:999px;color:#e4e4e7;font-size:9px;font-weight:700;letter-spacing:0.02em;">${escape(n)}</span>`)
    // Junta com espaço real (não ""), mesma correção já aplicada no bloco
    // avulso `lineup` (interactive.ts) — sem isso o Outlook (que ignora
    // "display:inline-block"/margin em e-mail) cola os nomes uns nos outros.
    .join(" ")}${extra > 0 ? `<span style="display:inline-block;margin:2px 0;padding:3px 8px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.15);border-radius:999px;color:#a1a1aa;font-size:9px;font-weight:700;">+${extra}</span>` : ""}</div>`;

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0d0d0d;border:1px solid rgba(255,255,255,0.08);border-radius:12px;overflow:hidden;">
    <tr><td style="padding:8px 12px 8px 12px;background-image:linear-gradient(180deg, rgba(0,0,0,0.62) 0%, rgba(0,0,0,0.9) 100%);text-align:${align};">
      <a href="${url}" style="display:block;color:#ffffff;text-decoration:none;font-size:13px;font-weight:900;line-height:1.2;">${escape(ev.title)}</a>
    </td></tr>
    <tr><td align="${align}" style="padding:0;text-align:${align};">
      <a href="${url}" style="text-decoration:none;display:block;">
        <img src="${escape(proxyForEmail(ev.imageUrl))}" alt="${escape(ev.title)}" width="${imgMaxWidth}" border="0" style="display:block;margin:0 auto;width:100%;max-width:${imgMaxWidth}px;height:auto;border:0;outline:none;">
      </a>
    </td></tr>
    <tr><td style="padding:10px 14px 14px 14px;text-align:${align};">
      <div style="color:${accentColor};font-size:10px;font-weight:800;letter-spacing:0.15em;text-transform:uppercase;margin-bottom:6px;">${escape(ev.dayLabel)}${showTime && ev.timeLabel ? ` · ${escape(ev.timeLabel)}` : ""}</div>
      <div style="color:#a1a1aa;font-size:11px;margin-bottom:8px;">${escape(ev.venue)}</div>
      ${lineupChips}
      ${btn}
    </td></tr>
  </table>`;
}

export function renderDigestBlock(
  block: Block,
  ctx: RenderContext,
  style: RenderStyle,
): string | null {
  const { event, settings } = ctx;
  const { primary, accent, gradient, solidPrimary } = style;

  switch (block.kind) {
    case "weekend_grid": {
      const heroId = ctx.heroEventId;
      const isDedgeVenue = (v?: string) => /d\.?\s*edge/i.test((v || "").trim());
      const list = (event.weekendEvents || []).filter((ev) => ev && (!heroId || ev.id !== heroId) && !isDedgeVenue(ev.venue));
      const align = block.align ?? "left";
      const eyebrow = escape(block.eyebrow || "AGENDA · FIM DE SEMANA");
      const title = escape(block.title || "O que rola no fds");
      const showArticle = block.show_article_link !== false;
      const layout = block.layout || "cartaz";
      const showTime = block.show_time !== false;

      if (list.length === 0) {
        if (!ctx.preview) return "";
        return `<tr><td style="padding:8px 32px;">
          <div style="padding:24px;background:rgba(255,255,255,0.04);border:1px dashed rgba(255,255,255,0.15);border-radius:12px;text-align:center;color:#a1a1aa;font-size:13px;">
            📅 Aqui aparecem os eventos do fim de semana quando a newsletter for gerada.
          </div>
        </td></tr>`;
      }

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
                  <div style="color:${barColor};font-size:10px;font-weight:800;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:3px;">${escape(ev.dayLabel)}${showTime && ev.timeLabel ? ` · ${escape(ev.timeLabel)}` : ""}</div>
                  <div style="color:#ffffff;font-size:15px;font-weight:800;line-height:1.25;margin-bottom:3px;"><a href="${url}" style="color:#ffffff;text-decoration:none;">${escape(ev.title)}</a></div>
                  <div style="color:#a1a1aa;font-size:12px;">${escape(ev.venue)}${ev.cityState ? ` · ${escape(ev.cityState)}` : ""}</div>
                  ${(ev.ctas && ev.ctas.length > 1) ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:8px;">${ev.ctas.map((c) => `<tr><td style="padding:3px 0;">${renderBulletproofButton(escape(c.url), escape((c.dayLabel ? c.dayLabel + " · " : "") + c.label + (c.timeLabel ? " · " + c.timeLabel : "")) + " — " + escape(ev.ctaLabel || settings.cta_label || "Garantir ingresso"), { bg: gradient, bgSolid: solidPrimary, fullWidth: true, vmlWidth: 420, padding: "9px 12px", fontSize: 11, height: 36, radius: 6, letterSpacing: "0.1em" })}</td></tr>`).join("")}</table>` : ""}
                  ${article}
                </td>
              </tr>
            </table>
          </td></tr>`;
        }).join("");
        return `${header}${rows}`;
      }

      if (layout === "grid") {
        if (list.length === 1) {
          const ev = list[0];
          const url = escape(ev.eventUrl || "#");
          const article = showArticle && ev.articleUrl
            ? `<a href="${escape(ev.articleUrl)}" style="display:inline-block;margin-left:12px;color:${primary};font-size:11px;font-weight:700;text-decoration:none;text-transform:uppercase;letter-spacing:0.15em;">📰 Matéria →</a>`
            : "";
          const singleCtaLabel = escape(ev.ctaLabel || settings.cta_label || "Garantir ingresso");
          const multiCtas = (ev.ctas && ev.ctas.length > 1) ? ev.ctas : null;
          const ticketBtn = multiCtas
            ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:4px;">${multiCtas.map((c) => `<tr><td style="padding:4px 0;">${renderBulletproofButton(escape(c.url), escape((c.dayLabel ? c.dayLabel + " · " : "") + c.label + (c.timeLabel ? " · " + c.timeLabel : "")) + " — " + singleCtaLabel, { bg: gradient, bgSolid: solidPrimary, fullWidth: true, vmlWidth: 480, padding: "12px 16px", fontSize: 12, height: 46, radius: 8, letterSpacing: "0.12em" })}</td></tr>`).join("")}</table>`
            : (ev.ticketUrl
              ? renderBulletproofButton(escape(ev.ticketUrl), singleCtaLabel, { bg: gradient, bgSolid: solidPrimary, fullWidth: false, vmlWidth: 220, padding: "10px 18px", fontSize: 12, height: 42, radius: 8, letterSpacing: "0.15em" })
              : "");
          const singleCard = `<tr><td style="padding:10px 32px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0d0d0d;border:1px solid rgba(255,255,255,0.08);border-radius:14px;overflow:hidden;">
              <tr><td style="padding:0;position:relative;">
                <a href="${url}" style="text-decoration:none;display:block;">
                  <img src="${escape(proxyForEmail(ev.imageUrl))}" alt="${escape(ev.title)}" width="552" border="0" style="display:block;width:100%;max-width:552px;height:auto;border:0;outline:none;">
                </a>
              </td></tr>
              <tr><td style="padding:16px 18px 18px 18px;">
                <div style="color:${escape(block.day_bar_color || accent)};font-size:11px;font-weight:800;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:6px;">${escape(ev.dayLabel)}${showTime && ev.timeLabel ? ` · ${escape(ev.timeLabel)}` : ""}</div>
                <div style="color:#ffffff;font-size:19px;font-weight:900;line-height:1.2;margin-bottom:4px;letter-spacing:-0.01em;"><a href="${url}" style="color:#ffffff;text-decoration:none;">${escape(ev.title)}</a></div>
                <div style="color:#a1a1aa;font-size:13px;margin-bottom:12px;">${escape(ev.venue)}${ev.cityState ? ` · ${escape(ev.cityState)}` : ""}</div>
                ${ticketBtn}${article}
              </td></tr>
            </table>
          </td></tr>`;
          return `${header}${singleCard}`;
        }

        const columns = gridColumns(block);
        const accentColor = escape(block.day_bar_color || accent);
        const defaultCtaLabel = settings.cta_label || "Garantir ingresso";
        const gridRows: string[] = [];
        for (let i = 0; i < list.length; i += columns) {
          const group = list.slice(i, i + columns);
          const cells = group
            .map((ev, idx) => `<td width="${gridColWidthPct(idx, group.length)}%" style="padding:8px;vertical-align:top;">${renderGridEventCard(ev, { columns: group.length, accentColor, gradient, solidPrimary, defaultCtaLabel, showTime, align })}</td>`)
            .join("");
          gridRows.push(`<tr><td style="padding:2px 24px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${cells}</tr></table></td></tr>`);
        }
        return `${header}${gridRows.join("")}`;
      }

      const cards = list.map((ev) => {
        const url = escape(ev.eventUrl || "#");
        const article = showArticle && ev.articleUrl
          ? `<a href="${escape(ev.articleUrl)}" style="display:inline-block;margin-left:12px;color:${primary};font-size:11px;font-weight:700;text-decoration:none;text-transform:uppercase;letter-spacing:0.15em;">📰 Matéria →</a>`
          : "";
        const singleCtaLabel = escape(ev.ctaLabel || settings.cta_label || "Garantir ingresso");
        const multiCtas = (ev.ctas && ev.ctas.length > 1) ? ev.ctas : null;
        const ticketBtn = multiCtas
          ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:4px;">${multiCtas.map((c) => `<tr><td style="padding:4px 0;">${renderBulletproofButton(escape(c.url), escape((c.dayLabel ? c.dayLabel + " · " : "") + c.label + (c.timeLabel ? " · " + c.timeLabel : "")) + " — " + singleCtaLabel, { bg: gradient, bgSolid: solidPrimary, fullWidth: true, vmlWidth: 480, padding: "12px 16px", fontSize: 12, height: 46, radius: 8, letterSpacing: "0.12em" })}</td></tr>`).join("")}</table>`
          : (ev.ticketUrl
            ? renderBulletproofButton(escape(ev.ticketUrl), singleCtaLabel, { bg: gradient, bgSolid: solidPrimary, fullWidth: false, vmlWidth: 220, padding: "10px 18px", fontSize: 12, height: 42, radius: 8, letterSpacing: "0.15em" })
            : "");
        return `<tr><td style="padding:10px 32px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0d0d0d;border:1px solid rgba(255,255,255,0.08);border-radius:14px;overflow:hidden;">
            <tr><td style="padding:0;position:relative;">
              <a href="${url}" style="text-decoration:none;display:block;">
                <img src="${escape(proxyForEmail(ev.imageUrl))}" alt="${escape(ev.title)}" width="552" border="0" style="display:block;width:100%;max-width:552px;height:auto;border:0;outline:none;">
              </a>
            </td></tr>
            <tr><td style="padding:16px 18px 18px 18px;">
              <div style="color:${escape(block.day_bar_color || accent)};font-size:11px;font-weight:800;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:6px;">${escape(ev.dayLabel)}${showTime && ev.timeLabel ? ` · ${escape(ev.timeLabel)}` : ""}</div>
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

      const columns = gridColumns(block);
      const defaultCtaLabel = settings.cta_label || "Garantir ingresso";
      const linkTarget = block.link_target ?? "ticket_link";
      const rows: string[] = [];
      for (let i = 0; i < list.length; i += columns) {
        const group = list.slice(i, i + columns);
        const cells = group
          .map((ev, idx) => `<td width="${gridColWidthPct(idx, group.length)}%" style="padding:8px;vertical-align:top;">${renderGridEventCard(ev, { columns: group.length, accentColor: accent, gradient, solidPrimary, defaultCtaLabel, showTime: true, align, linkTarget })}</td>`)
          .join("");
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
      const cardStyle = block.card_style || "featured";
      const showDescription = block.show_description !== false;

      if (!imageUrl && nights.length === 0 && !primaryUrl) {
        if (!ctx.preview) return "";
        return `<tr><td style="padding:8px 32px;">
          <div style="padding:24px;background:rgba(255,255,255,0.04);border:1px dashed rgba(255,255,255,0.15);border-radius:12px;text-align:center;color:#a1a1aa;font-size:13px;">
            🎧 Bloco Dedge — configure a imagem e os links das noites nas propriedades do bloco.
          </div>
        </td></tr>`;
      }

      // Variante compacta — no padrão dos cards do "Últimos posts do blog" (layout list):
      // thumbnail pequena, título discreto, sem caixa preta full-width nem botões grandes.
      if (cardStyle === "compact") {
        const linkUrl = primaryUrl || nights[0]?.url || "#";
        // Reaproveita o mesmo campo/fallback de override do card featured
        // (primary_label) — só o texto padrão muda, mais curto pro link
        // pequeno do card compacto. Antes esse texto vinha hardcoded, sem
        // nenhum jeito de editar mesmo com override_content ligado.
        const compactLinkLabel = escape(
          (override ? block.primary_label : d?.primaryLabel) || block.primary_label || d?.primaryLabel || "Ver eventos Dedge →"
        );
        return `<tr><td style="padding:8px 32px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0d0d0d;border:1px solid rgba(255,255,255,0.08);border-radius:12px;overflow:hidden;">
            <tr>
              ${imageUrl ? `<td width="96" valign="top" style="padding:0;"><a href="${escape(linkUrl)}" style="text-decoration:none;display:block;"><img src="${escape(proxyForEmail(imageUrl))}" alt="${title}" width="96" height="96" border="0" style="display:block;width:96px;height:96px;object-fit:cover;border:0;outline:none;"></a></td>` : ""}
              <td style="padding:12px 14px;vertical-align:top;">
                <div style="color:${accent};font-size:10px;font-weight:800;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:3px;">${eyebrow}</div>
                <div style="color:#ffffff;font-size:15px;font-weight:800;line-height:1.25;margin-bottom:3px;"><a href="${escape(linkUrl)}" style="color:#ffffff;text-decoration:none;">${title}</a></div>
                ${showDescription && description ? `<div style="color:#a1a1aa;font-size:12px;line-height:1.45;">${description}</div>` : ""}
                <a href="${escape(linkUrl)}" style="display:inline-block;margin-top:6px;color:${primary};font-size:11px;font-weight:800;text-decoration:none;text-transform:uppercase;letter-spacing:0.12em;">${compactLinkLabel}</a>
              </td>
            </tr>
          </table>
        </td></tr>`;
      }

      const btnBg = buttonStyle === "primary" ? gradient : "#0a0a0a";
      const btnBgSolid = buttonStyle === "primary" ? solidPrimary : "#0a0a0a";
      const btnBorderColor = buttonStyle === "primary" ? "transparent" : "rgba(255,255,255,0.18)";
      const nightBtns = nights.map((n) =>
        `<tr><td style="padding:6px 0;">${renderBulletproofButton(escape(n.url), escape(n.label), { bg: btnBg, bgSolid: btnBgSolid, fullWidth: true, vmlWidth: 480, padding: "14px 18px", fontSize: 13, fontWeight: 800, height: 50, radius: 10, letterSpacing: "0.12em", border: `1px solid ${btnBorderColor}`, strokeColor: buttonStyle === "primary" ? undefined : "#8a8a8a" })}</td></tr>`
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
            ${renderBulletproofButton(escape(primaryUrl), primaryLabel, { bg: gradient, bgSolid: solidPrimary, fullWidth: false, vmlWidth: 240, padding: "14px 22px", fontSize: 13, height: 50, radius: 10, letterSpacing: "0.15em" })}
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
      const showDatetime = block.show_datetime !== false;
      const accentColor = escape(block.accent_color || accent);
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
            <div style="color:${accentColor};font-size:11px;font-weight:800;letter-spacing:0.25em;text-transform:uppercase;margin-bottom:8px;">${eyebrow}</div>
            ${showDatetime ? `<div style="color:#ffffff;font-size:12px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;margin-bottom:6px;opacity:0.85;">${escape(dayLabel)}${timeLabel ? ` · ${escape(timeLabel)}` : ""}</div>` : ""}
            <h1 style="margin:0 0 8px 0;color:#ffffff;font-size:26px;line-height:1.15;font-weight:900;letter-spacing:-0.02em;">
              <a href="${escape(url)}" style="color:#ffffff;text-decoration:none;">${escape(title)}</a>
            </h1>
            ${showVenue ? `<div style="color:#a1a1aa;font-size:14px;margin-bottom:14px;">📍 ${escape(venue)}${city ? ` · ${escape(city)}` : ""}</div>` : ""}
            ${showCta ? ((useWeekend && w?.ctas && w.ctas.length > 1)
              ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">${w!.ctas!.map((c) => `<tr><td style="padding:4px 0;">${renderBulletproofButton(escape(c.url), escape((c.dayLabel ? c.dayLabel + " · " : "") + c.label + (c.timeLabel ? " · " + c.timeLabel : "")) + " — " + ctaLabel, { bg: gradient, bgSolid: solidPrimary, fullWidth: false, vmlWidth: 260, padding: "12px 22px", fontSize: 12, height: 46, radius: 10, letterSpacing: "0.14em" })}</td></tr>`).join("")}</table>`
              : (ticketUrl ? renderBulletproofButton(escape(ticketUrl), ctaLabel, { bg: gradient, bgSolid: solidPrimary, fullWidth: false, vmlWidth: 260, padding: "14px 26px", fontSize: 13, height: 50, radius: 10, letterSpacing: "0.18em" }) : "")) : ""}
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
      const categoryColor = escape(block.category_color || accent);
      const showReadMore = block.show_read_more_link === true;
      const readMoreLabel = escape(block.read_more_label || "Ler matéria →");

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
                ${showCategory && p.category ? `<div style="color:${categoryColor};font-size:10px;font-weight:800;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:4px;">${escape(p.category)}${p.publishedLabel ? ` · ${escape(p.publishedLabel)}` : ""}</div>` : (p.publishedLabel ? `<div style="color:#71717a;font-size:11px;margin-bottom:4px;">${escape(p.publishedLabel)}</div>` : "")}
                <div style="color:#ffffff;font-size:16px;font-weight:800;line-height:1.25;margin-bottom:4px;"><a href="${url}" style="color:#ffffff;text-decoration:none;">${escape(p.title)}</a></div>
                ${showExcerpt && p.excerpt ? `<div style="color:#a1a1aa;font-size:13px;line-height:1.5;">${escape(p.excerpt)}</div>` : ""}
                <a href="${url}" style="display:inline-block;margin-top:8px;color:${primary};font-size:11px;font-weight:800;text-decoration:none;text-transform:uppercase;letter-spacing:0.15em;">${readMoreLabel}</a>
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
                ${showCategory && p.category ? `<div style="color:${categoryColor};font-size:10px;font-weight:800;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:3px;">${escape(p.category)}${p.publishedLabel ? ` · ${escape(p.publishedLabel)}` : ""}</div>` : (p.publishedLabel ? `<div style="color:#71717a;font-size:11px;margin-bottom:3px;">${escape(p.publishedLabel)}</div>` : "")}
                <div style="color:#ffffff;font-size:15px;font-weight:800;line-height:1.25;margin-bottom:3px;"><a href="${url}" style="color:#ffffff;text-decoration:none;">${escape(p.title)}</a></div>
                ${showExcerpt && p.excerpt ? `<div style="color:#a1a1aa;font-size:12px;line-height:1.45;">${escape(p.excerpt)}</div>` : ""}
                ${showReadMore ? `<a href="${url}" style="display:inline-block;margin-top:6px;color:${primary};font-size:10px;font-weight:800;text-decoration:none;text-transform:uppercase;letter-spacing:0.12em;">${readMoreLabel}</a>` : ""}
              </td>
            </tr>
          </table>
        </td></tr>`;
      }).join("");
      return `${header}${rows}`;
    }

    default:
      return null;
  }
}
