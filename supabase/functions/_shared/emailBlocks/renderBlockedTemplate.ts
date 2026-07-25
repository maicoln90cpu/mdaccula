// Renderer principal (wrapper HTML). Extraído sem mudanças.
import type { Block, EventAnnouncementData, EmailTemplateSettings, ArticleSummary, GlobalBlock, RenderContext } from "./types.ts";
import { expandGlobalRefs } from "./types.ts";
import { escape, sanitizeCustomHtml } from "./utils.ts";
import { renderBlock } from "./renderBlock.ts";
import { computePreheader } from "./preheader.ts";

export function renderBlockedTemplate(
  blocks: Block[],
  event: EventAnnouncementData,
  settings: EmailTemplateSettings | null | undefined,
  article?: ArticleSummary | null,
  opts?: { preview?: boolean; projectId?: string; globals?: Map<string, GlobalBlock> | Record<string, GlobalBlock> | null; preheader?: string | null },
): string {
  const s = {
    brand_name: settings?.brand_name || "MDACCULA",
    primary_color: settings?.primary_color || "#a855f7",
    accent_color: settings?.accent_color || "#ec4899",
    background_color: settings?.background_color || "#050505",
    footer_text: settings?.footer_text || "Você recebeu este e-mail porque assinou a lista MDAccula.",
    cta_label: settings?.cta_label || "Garantir ingresso",
    logo_url: settings?.logo_url ?? null,
    custom_html_header: settings?.custom_html_header ?? null,
    custom_html_footer: settings?.custom_html_footer ?? null,
  };
  // Expande blocos globais ANTES de checar hero e renderizar.
  const resolvedBlocks = expandGlobalRefs(blocks, opts?.globals ?? null);
  // Detecta se o template usa weekly_hero com o primeiro evento do FDS —
  // nesse caso, o grid deve pular esse evento para não duplicar o card.
  const heroBlock = resolvedBlocks.find(
    (b) => (b as any).kind === "weekly_hero" && ((b as any).source ?? "first_weekend") === "first_weekend",
  );
  const heroEventId = heroBlock ? event.weekendEvents?.[0]?.id : undefined;
  const ctx: RenderContext = { event, article, settings: s, preview: opts?.preview, projectId: opts?.projectId, heroEventId };
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
<title>${escape(event.eventTitle)} — ${brand}</title>
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
