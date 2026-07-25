// ============================================
// Renderer de blocos de e-mail — Deno / Edge Functions
// ============================================
//
// Este arquivo é apenas um **barrel** que reexporta a API pública dos módulos
// em `./emailBlocks/`. Foi dividido em ondas de refatoração (Onda 5) para
// manter arquivos pequenos e permitir edição isolada. Se você mudar o visual
// dos blocos no frontend, replicar em `./emailBlocks/renderBlock.ts` e nas
// funções de texto correspondentes.
//
// API pública preservada 1:1 — nenhum consumidor precisa atualizar imports.

export type {
  SocialNetwork,
  Align,
  WeekendEventItem,
  DedgeNightConfig,
  DedgeBlockData,
  BlogPostItem,
  EventAnnouncementData,
  EmailTemplateSettings,
  Block,
  GlobalBlock,
  ArticleSummary,
  RenderContext,
} from "./emailBlocks/types.ts";

export { expandGlobalRefs } from "./emailBlocks/types.ts";
export { proxyForEmail } from "./emailBlocks/utils.ts";
export { computePreheader } from "./emailBlocks/preheader.ts";
export { renderBlockedTemplate } from "./emailBlocks/renderBlockedTemplate.ts";
export { renderBlockedTemplateText } from "./emailBlocks/renderBlockedTemplateText.ts";
