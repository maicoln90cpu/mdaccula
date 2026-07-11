// Testes de regressão — paridade front↔backend para `hidden` e `global_ref`.
//
// Bug corrigido: `renderBlock` no backend não checava `block.hidden`, então blocos
// marcados como ocultos no editor apareciam no preview do digest/agenda FDS e nos
// envios reais. Além disso, `global_ref` era ignorado (default do switch → "")
// deixando blocos globais quebrados em envio real.
//
// Estes testes travam a correção em três camadas:
//   1. hidden retorna "" para cada kind conhecido.
//   2. global_ref é expandido antes do render; sem catálogo é removido.
//   3. snapshot HTML — texto do bloco oculto não aparece no output final.

import { assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  renderBlockedTemplate,
  renderBlockedTemplateText,
  computePreheader,
  expandGlobalRefs,
  type Block,
  type EventAnnouncementData,
  type GlobalBlock,
} from "./emailBlocks.ts";

const mockEvent: EventAnnouncementData = {
  eventTitle: "TITULO_UNICO_XYZ",
  eventSubtitle: "SUBTITULO_UNICO_XYZ",
  flyerUrl: "https://example.com/flyer.jpg",
  dateLabel: "17 de julho",
  timeLabel: "22h",
  venueName: "Casa Aragon",
  cityState: "São Paulo-SP",
  description: "DESC_UNICO_XYZ",
  ticketUrl: "https://example.com/ticket",
  eventUrl: "https://example.com/evento",
  agendaUrl: "https://example.com/eventos",
  instagramUrl: "",
  youtubeUrl: "",
  tiktokUrl: "",
  unsubscribeUrl: "https://example.com/unsub",
};

// Lista canônica de todos os kinds que precisam respeitar hidden.
// Se alguém adicionar um kind novo e esquecer de rodar por renderBlock, este teste falha.
const KINDS_QUE_DEVEM_RESPEITAR_HIDDEN: Array<Block> = [
  { id: "1", kind: "header", hidden: true } as any,
  { id: "2", kind: "hero_image", hidden: true } as any,
  { id: "3", kind: "eyebrow", text: "TEXTO_OCULTO_EYEBROW", hidden: true } as any,
  { id: "4", kind: "title", hidden: true } as any,
  { id: "5", kind: "subtitle", hidden: true } as any,
  { id: "6", kind: "event_meta", hidden: true } as any,
  { id: "7", kind: "description", hidden: true } as any,
  { id: "8", kind: "cta_button", label: "TEXTO_OCULTO_CTA", hidden: true } as any,
  { id: "9", kind: "secondary_link", label: "TEXTO_OCULTO_SEC", hidden: true } as any,
  { id: "10", kind: "divider", hidden: true } as any,
  { id: "11", kind: "text", html: "<p>TEXTO_OCULTO_HTML</p>", hidden: true } as any,
  { id: "12", kind: "social_icons", networks: [], hidden: true } as any,
  { id: "13", kind: "lineup", hidden: true } as any,
  { id: "14", kind: "countdown", label: "TEXTO_OCULTO_COUNTDOWN", hidden: true } as any,
  { id: "15", kind: "ticker", messages: ["TEXTO_OCULTO_TICKER"], hidden: true } as any,
  { id: "16", kind: "static_map", hidden: true } as any,
  { id: "17", kind: "weekend_grid", title: "TEXTO_OCULTO_WEEKEND", hidden: true } as any,
  { id: "18", kind: "dedge_block", title: "TEXTO_OCULTO_DEDGE", hidden: true } as any,
  { id: "19", kind: "weekly_hero", eyebrow: "TEXTO_OCULTO_HERO", hidden: true } as any,
  { id: "20", kind: "blog_posts_list", title: "TEXTO_OCULTO_BLOG", hidden: true } as any,
  { id: "21", kind: "footer", text: "TEXTO_OCULTO_FOOTER", hidden: true } as any,
  { id: "22", kind: "image_with_link", image_url: "https://x/y.jpg", link_url: "https://x", hidden: true } as any,
  { id: "23", kind: "article_summary", hidden: true } as any,
];

Deno.test("backend: hidden=true remove qualquer bloco do HTML final", () => {
  const html = renderBlockedTemplate(KINDS_QUE_DEVEM_RESPEITAR_HIDDEN, mockEvent, null, null);
  // Nenhum texto marcador dos blocos ocultos pode aparecer.
  const marcadores = [
    "TEXTO_OCULTO_EYEBROW",
    "TEXTO_OCULTO_CTA",
    "TEXTO_OCULTO_SEC",
    "TEXTO_OCULTO_HTML",
    "TEXTO_OCULTO_COUNTDOWN",
    "TEXTO_OCULTO_TICKER",
    "TEXTO_OCULTO_WEEKEND",
    "TEXTO_OCULTO_DEDGE",
    "TEXTO_OCULTO_HERO",
    "TEXTO_OCULTO_BLOG",
    "TEXTO_OCULTO_FOOTER",
  ];
  for (const m of marcadores) {
    assertEquals(html.includes(m), false, `Backend renderizou bloco oculto contendo "${m}"`);
  }
});

Deno.test("backend: bloco visível ao lado de oculto continua aparecendo", () => {
  const blocks: Block[] = [
    { id: "a", kind: "eyebrow", text: "VISIVEL_EYEBROW" } as any,
    { id: "b", kind: "eyebrow", text: "OCULTO_EYEBROW", hidden: true } as any,
  ];
  const html = renderBlockedTemplate(blocks, mockEvent, null, null);
  assertStringIncludes(html, "VISIVEL_EYEBROW");
  assertEquals(html.includes("OCULTO_EYEBROW"), false);
});

Deno.test("backend: expandGlobalRefs sem catálogo remove global_ref (não vaza no envio)", () => {
  const blocks: Block[] = [
    { id: "a", kind: "text", html: "<p>ANTES</p>" } as any,
    { id: "b", kind: "global_ref", global_id: "xyz" } as any,
    { id: "c", kind: "text", html: "<p>DEPOIS</p>" } as any,
  ];
  const out = expandGlobalRefs(blocks, null);
  assertEquals(out.length, 2);
  assertEquals(out[0].id, "a");
  assertEquals(out[1].id, "c");
});

Deno.test("backend: expandGlobalRefs resolve global_ref com catálogo", () => {
  const globals = new Map<string, GlobalBlock>();
  globals.set("g1", {
    id: "g1",
    name: "Rodapé padrão",
    category: "footer",
    block: { id: "template", kind: "text", html: "<p>CONTEUDO_GLOBAL</p>" } as any,
  });
  const blocks: Block[] = [
    { id: "ref-1", kind: "global_ref", global_id: "g1" } as any,
  ];
  const html = renderBlockedTemplate(blocks, mockEvent, null, null, { globals });
  assertStringIncludes(html, "CONTEUDO_GLOBAL");
});

Deno.test("backend: global_ref com hidden=true no wrapper também é ocultado", () => {
  const globals = new Map<string, GlobalBlock>();
  globals.set("g1", {
    id: "g1",
    name: "Bloco X",
    category: "geral",
    block: { id: "template", kind: "text", html: "<p>NAO_DEVE_APARECER</p>" } as any,
  });
  const blocks: Block[] = [
    { id: "ref-1", kind: "global_ref", global_id: "g1", hidden: true } as any,
    { id: "vis", kind: "text", html: "<p>DEVE_APARECER</p>" } as any,
  ];
  const html = renderBlockedTemplate(blocks, mockEvent, null, null, { globals });
  assertEquals(html.includes("NAO_DEVE_APARECER"), false);
  assertStringIncludes(html, "DEVE_APARECER");
});

// ============================================
// Etapa 2 — renderBlockedTemplateText (multipart plain-text)
// ============================================

Deno.test("text: gera versão plain-text com título, descrição e URL de CTA", () => {
  const blocks: Block[] = [
    { id: "1", kind: "title" } as any,
    { id: "2", kind: "description" } as any,
    { id: "3", kind: "cta_button", label: "Comprar", url_field: "ticket_link" } as any,
  ];
  const text = renderBlockedTemplateText(blocks, mockEvent, null, null);
  assertStringIncludes(text, "TITULO_UNICO_XYZ");
  assertStringIncludes(text, "DESC_UNICO_XYZ");
  assertStringIncludes(text, "https://example.com/ticket");
  // Não pode ter HTML no plain-text
  assertEquals(text.includes("<"), false);
  assertEquals(text.includes("&nbsp;"), false);
});

Deno.test("text: respeita hidden=true", () => {
  const blocks: Block[] = [
    { id: "a", kind: "text", html: "<p>VISIVEL_TXT</p>" } as any,
    { id: "b", kind: "text", html: "<p>OCULTO_TXT</p>", hidden: true } as any,
  ];
  const text = renderBlockedTemplateText(blocks, mockEvent, null, null);
  assertStringIncludes(text, "VISIVEL_TXT");
  assertEquals(text.includes("OCULTO_TXT"), false);
});

Deno.test("text: expande global_ref quando catálogo disponível", () => {
  const globals = new Map<string, GlobalBlock>();
  globals.set("g1", {
    id: "g1",
    name: "Rodapé",
    category: "footer",
    block: { id: "tpl", kind: "text", html: "<p>GLOBAL_TXT_CONTENT</p>" } as any,
  });
  const blocks: Block[] = [
    { id: "ref-1", kind: "global_ref", global_id: "g1" } as any,
  ];
  const text = renderBlockedTemplateText(blocks, mockEvent, null, null, { globals });
  assertStringIncludes(text, "GLOBAL_TXT_CONTENT");
});

Deno.test("computePreheader: monta título — data em venue, cidade", () => {
  const pre = computePreheader(mockEvent);
  assertStringIncludes(pre, "TITULO_UNICO_XYZ");
  assertStringIncludes(pre, "17 de julho");
  assertStringIncludes(pre, "Casa Aragon");
});

Deno.test("computePreheader: limita em 150 chars", () => {
  const longEvent = { ...mockEvent, eventTitle: "X".repeat(500) };
  const pre = computePreheader(longEvent);
  assertEquals(pre.length <= 150, true);
});
