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
  type ArticleSummary,
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
  { id: "17b", kind: "event_grid", title: "TEXTO_OCULTO_EVENT_GRID", hidden: true } as any,
  { id: "18", kind: "dedge_block", title: "TEXTO_OCULTO_DEDGE", hidden: true } as any,
  { id: "19", kind: "weekly_hero", eyebrow: "TEXTO_OCULTO_HERO", hidden: true } as any,
  { id: "20", kind: "blog_posts_list", title: "TEXTO_OCULTO_BLOG", hidden: true } as any,
  { id: "21", kind: "footer", text: "TEXTO_OCULTO_FOOTER", hidden: true } as any,
  { id: "22", kind: "image_with_link", image_url: "https://x/y.jpg", link_url: "https://x", hidden: true } as any,
  { id: "23", kind: "article_summary", hidden: true } as any,
  { id: "24", kind: "pix_button", label: "TEXTO_OCULTO_PIX", hidden: true } as any,
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
// pix_button — some sozinho sem pixWhatsAppUrl, aparece só quando o evento
// tem Pix habilitado (mesma regra do site — ver _shared/pixWhatsAppLink.ts).
// ============================================

const eventComPix: EventAnnouncementData = {
  ...mockEvent,
  pixWhatsAppUrl: "https://api.whatsapp.com/send?phone=5511997819194&text=teste",
};

Deno.test("pix_button: renderiza o link quando o evento tem pixWhatsAppUrl", () => {
  const blocks: Block[] = [{ id: "1", kind: "pix_button" } as any];
  const html = renderBlockedTemplate(blocks, eventComPix, null, null);
  assertStringIncludes(html, "https://api.whatsapp.com/send?phone=5511997819194&amp;text=teste");
  assertStringIncludes(html, "Comprar Sem Taxa via Pix");
});

Deno.test("pix_button: some sozinho quando o evento não tem pixWhatsAppUrl (sem Pix habilitado)", () => {
  const blocks: Block[] = [{ id: "1", kind: "pix_button" } as any];
  const html = renderBlockedTemplate(blocks, mockEvent, null, null);
  assertEquals(html.includes("PIX"), false);
});

Deno.test("pix_button: hidden=true suprime mesmo com pixWhatsAppUrl presente", () => {
  const blocks: Block[] = [{ id: "1", kind: "pix_button", hidden: true } as any];
  const html = renderBlockedTemplate(blocks, eventComPix, null, null);
  assertEquals(html.includes("PIX"), false);
});

Deno.test("pix_button: respeita label customizado", () => {
  const blocks: Block[] = [{ id: "1", kind: "pix_button", label: "Pagar via Pix agora" } as any];
  const html = renderBlockedTemplate(blocks, eventComPix, null, null);
  assertStringIncludes(html, "Pagar via Pix agora");
});

Deno.test("pix_button (text): gera linha só quando há pixWhatsAppUrl", () => {
  const blocks: Block[] = [{ id: "1", kind: "pix_button" } as any];
  const comPix = renderBlockedTemplateText(blocks, eventComPix, null, null);
  assertStringIncludes(comPix, "https://api.whatsapp.com/send?phone=5511997819194&text=teste");
  const semPix = renderBlockedTemplateText(blocks, mockEvent, null, null);
  assertEquals(semPix.includes("PIX"), false);
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

// ============================================
// Etapa 3 — proxyForEmail aplicado em todo bloco com imagem (Outlook/.webp)
// ============================================
//
// Bug corrigido: proxyForEmail() (converte .webp → JPG via wsrv.nl porque
// Outlook não renderiza WebP) só era chamado em 2 dos 8 pontos que montam
// <img src> no renderBlock — hero_image e image_with_link. Cards de evento
// (weekend_grid, weekly_hero, dedge_block), posts do blog (blog_posts_list,
// article_summary) e o logo do header usavam a URL crua, sem proteção. Se
// fosse .webp (pipeline de otimização do site gera .webp), ficava quebrada/
// ilegível no Outlook mesmo com o rascunho gerado corretamente. Ver R-021
// em docs/TESTING.md.

const WEBP_URL = "https://mdaccula.b-cdn.net/events/flyer.webp";

Deno.test("proxyForEmail: weekend_grid (timeline) proxya imagem .webp do evento", () => {
  const event: EventAnnouncementData = {
    ...mockEvent,
    weekendEvents: [{ title: "Evento FDS", dayLabel: "Sexta", venue: "Local", imageUrl: WEBP_URL, eventUrl: "https://x/e" }],
  };
  const blocks: Block[] = [{ id: "1", kind: "weekend_grid", layout: "timeline" } as any];
  const html = renderBlockedTemplate(blocks, event, null, null);
  assertStringIncludes(html, "wsrv.nl");
  assertEquals(html.includes(`src="${WEBP_URL}"`), false);
});

Deno.test("proxyForEmail: weekend_grid (cards) proxya imagem .webp do evento", () => {
  const event: EventAnnouncementData = {
    ...mockEvent,
    weekendEvents: [{ title: "Evento FDS", dayLabel: "Sexta", venue: "Local", imageUrl: WEBP_URL, eventUrl: "https://x/e" }],
  };
  const blocks: Block[] = [{ id: "1", kind: "weekend_grid", layout: "cards" } as any];
  const html = renderBlockedTemplate(blocks, event, null, null);
  assertStringIncludes(html, "wsrv.nl");
  assertEquals(html.includes(`src="${WEBP_URL}"`), false);
});

Deno.test("proxyForEmail: blog_posts_list (cards) proxya imagem .webp do post", () => {
  const event: EventAnnouncementData = {
    ...mockEvent,
    blogPosts: [{ title: "Post", imageUrl: WEBP_URL, url: "https://x/blog/post" }],
  };
  const blocks: Block[] = [{ id: "1", kind: "blog_posts_list", layout: "cards" } as any];
  const html = renderBlockedTemplate(blocks, event, null, null);
  assertStringIncludes(html, "wsrv.nl");
  assertEquals(html.includes(`src="${WEBP_URL}"`), false);
});

Deno.test("proxyForEmail: blog_posts_list (list) proxya imagem .webp do post", () => {
  const event: EventAnnouncementData = {
    ...mockEvent,
    blogPosts: [{ title: "Post", imageUrl: WEBP_URL, url: "https://x/blog/post" }],
  };
  const blocks: Block[] = [{ id: "1", kind: "blog_posts_list", layout: "list" } as any];
  const html = renderBlockedTemplate(blocks, event, null, null);
  assertStringIncludes(html, "wsrv.nl");
  assertEquals(html.includes(`src="${WEBP_URL}"`), false);
});

Deno.test("proxyForEmail: dedge_block proxya imagem .webp", () => {
  const blocks: Block[] = [
    { id: "1", kind: "dedge_block", override_content: true, image_url: WEBP_URL } as any,
  ];
  const html = renderBlockedTemplate(blocks, mockEvent, null, null);
  assertStringIncludes(html, "wsrv.nl");
  assertEquals(html.includes(`src="${WEBP_URL}"`), false);
});

Deno.test("proxyForEmail: weekly_hero proxya flyer .webp do evento (sem FDS)", () => {
  const event: EventAnnouncementData = { ...mockEvent, flyerUrl: WEBP_URL };
  const blocks: Block[] = [{ id: "1", kind: "weekly_hero" } as any];
  const html = renderBlockedTemplate(blocks, event, null, null);
  assertStringIncludes(html, "wsrv.nl");
  assertEquals(html.includes(`src="${WEBP_URL}"`), false);
});

Deno.test("proxyForEmail: article_summary proxya imagem .webp da matéria vinculada", () => {
  const blocks: Block[] = [{ id: "1", kind: "article_summary" } as any];
  const article: ArticleSummary = { title: "Matéria", excerpt: "Resumo", url: "https://x/materia", image_url: WEBP_URL };
  const html = renderBlockedTemplate(blocks, mockEvent, null, article);
  assertStringIncludes(html, "wsrv.nl");
  assertEquals(html.includes(`src="${WEBP_URL}"`), false);
});

Deno.test("proxyForEmail: header proxya logo .webp das configurações", () => {
  const blocks: Block[] = [{ id: "1", kind: "header" } as any];
  const html = renderBlockedTemplate(blocks, mockEvent, { logo_url: WEBP_URL } as any, null);
  assertStringIncludes(html, "wsrv.nl");
  assertEquals(html.includes(`src="${WEBP_URL}"`), false);
});

Deno.test("proxyForEmail: imagem .jpg passa intacta (sem proxy desnecessário)", () => {
  const jpgUrl = "https://mdaccula.b-cdn.net/events/flyer.jpg";
  const event: EventAnnouncementData = {
    ...mockEvent,
    weekendEvents: [{ title: "Evento", dayLabel: "Sexta", venue: "Local", imageUrl: jpgUrl, eventUrl: "https://x/e" }],
  };
  const blocks: Block[] = [{ id: "1", kind: "weekend_grid", layout: "cards" } as any];
  const html = renderBlockedTemplate(blocks, event, null, null);
  assertStringIncludes(html, `src="${jpgUrl}"`);
  assertEquals(html.includes("wsrv.nl"), false);
});

// ============================================
// event_grid — bloco de 2 colunas para múltiplos eventos
// ============================================

Deno.test("event_grid: renderiza 2 cards por linha (HTML)", () => {
  const event = {
    ...mockEvent,
    gridEvents: [
      { id: "1", title: "Evento A", dayLabel: "23/08", timeLabel: "22h", venue: "Clube X", imageUrl: "https://x.com/a.jpg", eventUrl: "https://mdaccula.com/eventos/a", ticketUrl: "https://x.com/ingresso-a" },
      { id: "2", title: "Evento B", dayLabel: "23/08", timeLabel: "23h", venue: "Clube Y", imageUrl: "https://x.com/b.jpg", eventUrl: "https://mdaccula.com/eventos/b", ticketUrl: "https://x.com/ingresso-b" },
    ],
  };
  const blocks = [{ id: "g1", kind: "event_grid" as const }];
  const html = renderBlockedTemplate(blocks, event as any, null, null, { preview: false });
  assertStringIncludes(html, "Evento A");
  assertStringIncludes(html, "Evento B");
  assertStringIncludes(html, "https://x.com/ingresso-a");
  assertStringIncludes(html, "https://x.com/ingresso-b");
  // 2 colunas: width="50%" deveria aparecer 2 vezes (uma por coluna)
  const widthOccurrences = (html.match(/width="50%"/g) || []).length;
  assertEquals(widthOccurrences, 2);
  // Verifica que ambos os títulos estão no MESMO <tr> (não em filas separadas)
  // Procura pelo padrão: <tr><td width="50%">...Evento A...<td width="50%">...Evento B...</tr>
  // Se cada card tivesse seu próprio <tr>, não conseguiríamos achar este padrão (seria <tr>..A..</tr><tr>..B..</tr>).
  // Fecha no início do próximo <td width="50%"> (não no primeiro </td>) porque o
  // título agora vive numa linha própria dentro do card (sobreposta à imagem),
  // então o primeiro </td> depois de "Evento A" é só o da linha da imagem.
  const correctPairingPattern = /<tr[^>]*><td width="50%"[\s\S]*?Evento A[\s\S]*?<td width="50%"[\s\S]*?Evento B[\s\S]*?<\/tr>/;
  const isCorrectlyPaired = correctPairingPattern.test(html);
  assertEquals(isCorrectlyPaired, true, "Eventos devem estar em um <tr> com <td width=\"50%\"> para cada um (2 colunas em 1 linha, não separados em 2 linhas)");
});

Deno.test("event_grid: número ímpar de eventos deixa a última linha com 1 card só", () => {
  const event = {
    ...mockEvent,
    gridEvents: [
      { id: "1", title: "Evento A", dayLabel: "23/08", venue: "Clube X", imageUrl: "https://x.com/a.jpg", eventUrl: "https://mdaccula.com/eventos/a" },
      { id: "2", title: "Evento B", dayLabel: "23/08", venue: "Clube Y", imageUrl: "https://x.com/b.jpg", eventUrl: "https://mdaccula.com/eventos/b" },
      { id: "3", title: "Evento C", dayLabel: "24/08", venue: "Clube Z", imageUrl: "https://x.com/c.jpg", eventUrl: "https://mdaccula.com/eventos/c" },
    ],
  };
  const blocks = [{ id: "g1", kind: "event_grid" as const }];
  const html = renderBlockedTemplate(blocks, event as any, null, null, { preview: false });
  assertStringIncludes(html, "Evento C");
  // Só 2 pares de 50%: 3 eventos = 2 fileiras (2+1), não 4 células de 50%.
  const widthOccurrences = (html.match(/width="50%"/g) || []).length;
  assertEquals(widthOccurrences, 3);
});

Deno.test("event_grid: lista vazia não renderiza nada fora de preview", () => {
  const event = { ...mockEvent, gridEvents: [] };
  const blocks = [{ id: "g1", kind: "event_grid" as const }];
  const html = renderBlockedTemplate(blocks, event as any, null, null, { preview: false });
  // Nenhum conteúdo específico do event_grid deve aparecer
  assertEquals(html.includes("🎟️"), false); // placeholder não aparece fora de preview
  assertEquals(html.includes("width=\"50%\""), false); // nenhuma coluna de evento
});

Deno.test("event_grid: respeita eyebrow/title customizados", () => {
  const event = {
    ...mockEvent,
    gridEvents: [
      { id: "1", title: "Evento A", dayLabel: "23/08", venue: "Clube X", imageUrl: "https://x.com/a.jpg", eventUrl: "https://mdaccula.com/eventos/a" },
    ],
  };
  const blocks = [{ id: "g1", kind: "event_grid" as const, eyebrow: "ÚLTIMAS HORAS", title: "Vira o lote hoje" }];
  const html = renderBlockedTemplate(blocks, event as any, null, null, { preview: false });
  assertStringIncludes(html, "ÚLTIMAS HORAS");
  assertStringIncludes(html, "Vira o lote hoje");
});

Deno.test("event_grid: versão texto puro lista os eventos", () => {
  const event = {
    ...mockEvent,
    gridEvents: [
      { id: "1", title: "Evento A", dayLabel: "23/08", timeLabel: "22h", venue: "Clube X", imageUrl: "https://x.com/a.jpg", eventUrl: "https://mdaccula.com/eventos/a", ticketUrl: "https://x.com/ingresso-a" },
    ],
  };
  const blocks = [{ id: "g1", kind: "event_grid" as const }];
  const text = renderBlockedTemplateText(blocks, event as any, null, null);
  assertStringIncludes(text, "Evento A");
  assertStringIncludes(text, "https://x.com/ingresso-a");
});

// ============================================
// Personalizações novas (fases 1-5) — cada campo precisa afetar o HTML
// gerado, tanto no preview do editor quanto no envio real (mesmo `renderBlockedTemplate`).
// ============================================

Deno.test("header: bg_color e padding_bottom aplicam estilo customizado", () => {
  const blocks: Block[] = [{ id: "1", kind: "header", bg_color: "#123456", padding_bottom: 40 } as any];
  const html = renderBlockedTemplate(blocks, mockEvent, null, null);
  assertStringIncludes(html, "background-color:#123456;");
  assertStringIncludes(html, "40px");
});

Deno.test("hero_image: border_color e caption aparecem no HTML", () => {
  const blocks: Block[] = [{ id: "1", kind: "hero_image", border_color: "#ff00ff", caption: "LEGENDA_FLYER_XYZ" } as any];
  const html = renderBlockedTemplate(blocks, mockEvent, null, null);
  assertStringIncludes(html, "border:1px solid #ff00ff;");
  assertStringIncludes(html, "LEGENDA_FLYER_XYZ");
});

Deno.test("eyebrow: bg_style pill envolve o texto num badge", () => {
  const blocks: Block[] = [{ id: "1", kind: "eyebrow", text: "ETIQUETA_XYZ", bg_style: "pill" } as any];
  const html = renderBlockedTemplate(blocks, mockEvent, null, null);
  assertStringIncludes(html, "border-radius:999px;");
  assertStringIncludes(html, "ETIQUETA_XYZ");
});

// R-038 (auditoria de templates, agosto/2026): eyebrow sem texto não deve mais
// cair no fallback fixo "Novo evento" — isso vazava contexto de "novo evento"
// pra templates de outro tipo (ex: virada de lote) quando o campo era deixado
// em branco. Agora o bloco simplesmente não renderiza nada.
Deno.test("eyebrow: sem texto não renderiza nada (nem cai no fallback antigo 'Novo evento')", () => {
  const blocks: Block[] = [{ id: "1", kind: "eyebrow" } as any];
  const html = renderBlockedTemplate(blocks, mockEvent, null, null);
  assertEquals(html.includes("Novo evento"), false);
});

Deno.test("eyebrow: texto só com espaços também não renderiza nada", () => {
  const blocks: Block[] = [{ id: "1", kind: "eyebrow", text: "   " } as any];
  const html = renderBlockedTemplate(blocks, mockEvent, null, null);
  assertEquals(html.includes("Novo evento"), false);
});

Deno.test("title: font_weight bold e uppercase alteram peso/caixa do título", () => {
  const blocks: Block[] = [{ id: "1", kind: "title", font_weight: "bold", uppercase: true } as any];
  const html = renderBlockedTemplate(blocks, mockEvent, null, null);
  assertStringIncludes(html, "font-weight:700;");
  assertStringIncludes(html, "TITULO_UNICO_XYZ".toUpperCase());
});

Deno.test("subtitle: font_size e italic aplicam no HTML", () => {
  const blocks: Block[] = [{ id: "1", kind: "subtitle", font_size: 20, italic: true } as any];
  const html = renderBlockedTemplate(blocks, mockEvent, null, null);
  assertStringIncludes(html, "font-size:20px;");
  assertStringIncludes(html, "font-style:italic;");
});

Deno.test("event_meta: show_icons=false remove os emojis e accent_color troca a cor do rótulo", () => {
  const blocks: Block[] = [{ id: "1", kind: "event_meta", show_icons: false, accent_color: "#00ff00" } as any];
  const html = renderBlockedTemplate(blocks, mockEvent, null, null);
  assertEquals(html.includes("📅"), false);
  assertEquals(html.includes("📍"), false);
  assertStringIncludes(html, "color:#00ff00;");
});

Deno.test("description: font_size e line_height compact aplicam no HTML", () => {
  const blocks: Block[] = [{ id: "1", kind: "description", font_size: 18, line_height: "compact" } as any];
  const html = renderBlockedTemplate(blocks, mockEvent, null, null);
  assertStringIncludes(html, "font-size:18px;");
  assertStringIncludes(html, "line-height:1.35;");
});

Deno.test("article_summary: layout compact usa card menor sem excerpt", () => {
  const article: ArticleSummary = { title: "MATERIA_XYZ", excerpt: "RESUMO_XYZ", url: "https://x.com/materia" };
  const blocks: Block[] = [{ id: "1", kind: "article_summary", layout: "compact" } as any];
  const html = renderBlockedTemplate(blocks, mockEvent, null, article);
  assertStringIncludes(html, "MATERIA_XYZ");
  assertEquals(html.includes("RESUMO_XYZ"), false); // compact não mostra excerpt
});

Deno.test("cta_button: size large e shape pill alteram padding/border-radius", () => {
  const blocks: Block[] = [{ id: "1", kind: "cta_button", size: "large", shape: "pill" } as any];
  const html = renderBlockedTemplate(blocks, mockEvent, null, null);
  assertStringIncludes(html, "22px 30px");
  assertStringIncludes(html, "border-radius:999px;");
});

Deno.test("secondary_link: variant ghost adiciona borda e text_color troca a cor", () => {
  const blocks: Block[] = [{ id: "1", kind: "secondary_link", variant: "ghost", text_color: "#ff0000" } as any];
  const html = renderBlockedTemplate(blocks, mockEvent, null, null);
  assertStringIncludes(html, "border:1px solid #ff0000;");
});

Deno.test("image_with_link: border_color e caption aparecem no HTML", () => {
  const blocks: Block[] = [{ id: "1", kind: "image_with_link", image_url: "https://x.com/img.jpg", link_url: "https://x.com", border_color: "#abcdef", caption: "LEGENDA_IMG_XYZ" } as any];
  const html = renderBlockedTemplate(blocks, mockEvent, null, null);
  assertStringIncludes(html, "border:1px solid #abcdef;");
  assertStringIncludes(html, "LEGENDA_IMG_XYZ");
});

Deno.test("divider: spacing wide e width short alteram padding/largura", () => {
  const blocks: Block[] = [{ id: "1", kind: "divider", spacing: "wide", width: "short" } as any];
  const html = renderBlockedTemplate(blocks, mockEvent, null, null);
  assertStringIncludes(html, "padding:16px 32px;");
  assertStringIncludes(html, 'width="33%"');
});

Deno.test("spacing: altera a altura do respiro e não renderiza nenhum conteúdo visível", () => {
  const blocks: Block[] = [{ id: "1", kind: "spacing", height: 48 } as any];
  const html = renderBlockedTemplate(blocks, mockEvent, null, null);
  assertStringIncludes(html, 'height="48"');
  assertStringIncludes(html, "height:48px;line-height:48px;font-size:0;");
});

Deno.test("spacing: sem height definido usa o padrão de 24px, e valores fora do range são limitados (clamp 4-160)", () => {
  const withDefault = renderBlockedTemplate([{ id: "1", kind: "spacing" } as any], mockEvent, null, null);
  assertStringIncludes(withDefault, 'height="24"');

  const tooSmall = renderBlockedTemplate([{ id: "1", kind: "spacing", height: 1 } as any], mockEvent, null, null);
  assertStringIncludes(tooSmall, 'height="4"');

  const tooBig = renderBlockedTemplate([{ id: "1", kind: "spacing", height: 999 } as any], mockEvent, null, null);
  assertStringIncludes(tooBig, 'height="160"');
});

Deno.test("text: font_size e bg_highlight aplicam caixa de destaque", () => {
  const blocks: Block[] = [{ id: "1", kind: "text", html: "<p>TEXTO_LIVRE_XYZ</p>", font_size: 18, bg_highlight: true } as any];
  const html = renderBlockedTemplate(blocks, mockEvent, null, null);
  assertStringIncludes(html, "font-size:18px;");
  assertStringIncludes(html, "border-radius:12px;");
});

// Regressão R-035: o editor rich-text (Tiptap) gera <p>/<ul>/<li>/<blockquote>/<h2>
// sem nenhum estilo inline — sem isso, Outlook/Gmail colapsam a margem entre
// parágrafos e a "quebra de linha" parece não ter efeito nenhum.
Deno.test("text: quebra de parágrafo (Tiptap Enter) ganha margem inline entre <p>s", () => {
  const blocks: Block[] = [{ id: "1", kind: "text", html: "<p>Primeira frase</p><p>Segunda frase</p>" } as any];
  const html = renderBlockedTemplate(blocks, mockEvent, null, null);
  assertStringIncludes(html, '<p style="margin:0 0 12px 0;">Primeira frase</p>');
  assertStringIncludes(html, '<p style="margin:0 0 12px 0;">Segunda frase</p>');
});

Deno.test("text: quebra de linha simples (Shift+Enter, <br>) não é alterada", () => {
  const blocks: Block[] = [{ id: "1", kind: "text", html: "<p>linha 1<br>linha 2</p>" } as any];
  const html = renderBlockedTemplate(blocks, mockEvent, null, null);
  assertStringIncludes(html, "linha 1<br>linha 2");
});

Deno.test("text: lista com marcadores (Tiptap) ganha margem/padding inline em <ul> e <li>", () => {
  const blocks: Block[] = [{ id: "1", kind: "text", html: "<ul><li>Item A</li><li>Item B</li></ul>" } as any];
  const html = renderBlockedTemplate(blocks, mockEvent, null, null);
  assertStringIncludes(html, '<ul style="margin:0 0 12px 0;padding-left:20px;">');
  assertStringIncludes(html, '<li style="margin:0 0 4px 0;">Item A</li>');
});

Deno.test("text: citação (blockquote) ganha borda lateral usando a cor do texto do bloco", () => {
  const blocks: Block[] = [{ id: "1", kind: "text", html: "<blockquote><p>cita</p></blockquote>", text_color: "#ff00ff" } as any];
  const html = renderBlockedTemplate(blocks, mockEvent, null, null);
  assertStringIncludes(html, "border-left:3px solid #ff00ff;");
});

Deno.test("text: subtítulo (h2) ganha estilo inline com a cor do bloco", () => {
  const blocks: Block[] = [{ id: "1", kind: "text", html: "<h2>Subtítulo</h2>", text_color: "#00ffaa" } as any];
  const html = renderBlockedTemplate(blocks, mockEvent, null, null);
  assertStringIncludes(html, "color:#00ffaa;font-size:18px;font-weight:800;");
});

Deno.test("text: tag que já vem com style= não é sobrescrita pelo pós-processamento", () => {
  const blocks: Block[] = [{ id: "1", kind: "text", html: '<p style="color:red;">já estilizado</p>' } as any];
  const html = renderBlockedTemplate(blocks, mockEvent, null, null);
  assertStringIncludes(html, '<p style="color:red;">já estilizado</p>');
});

Deno.test("social_icons: style icon usa a imagem do ícone quando icon_url está preenchido (sobrescreve o padrão)", () => {
  const blocks: Block[] = [{
    id: "1",
    kind: "social_icons",
    style: "icon",
    icon_size: "small",
    networks: [{ id: "instagram", label: "Instagram", url: "https://instagram.com/x", enabled: true, icon_url: "https://cdn.example.com/ig.png" }],
  } as any];
  const html = renderBlockedTemplate(blocks, mockEvent, null, null);
  assertStringIncludes(html, "https://cdn.example.com/ig.png");
  assertEquals(html.includes("mdaccula.com/email-icons"), false); // custom sobrescreve o padrão
  assertStringIncludes(html, 'width="24"');
});

Deno.test("social_icons: style icon sem icon_url usa o ícone padrão da rede conhecida", () => {
  const blocks: Block[] = [{
    id: "1",
    kind: "social_icons",
    style: "icon",
    networks: [
      { id: "instagram", label: "Instagram", url: "https://instagram.com/x", enabled: true },
      { id: "youtube", label: "YouTube", url: "https://youtube.com/@x", enabled: true },
      { id: "whatsapp", label: "WhatsApp", url: "https://wa.me/x", enabled: true },
    ],
  } as any];
  const html = renderBlockedTemplate(blocks, mockEvent, null, null);
  assertStringIncludes(html, "https://mdaccula.com/email-icons/instagram.png");
  assertStringIncludes(html, "https://mdaccula.com/email-icons/youtube.png");
  assertStringIncludes(html, "https://mdaccula.com/email-icons/whatsapp.png");
});

Deno.test("social_icons: style icon com rede desconhecida (sem padrão e sem icon_url) cai de volta pro texto (fallback seguro)", () => {
  const blocks: Block[] = [{
    id: "1",
    kind: "social_icons",
    style: "icon",
    networks: [{ id: "mastodon", label: "Mastodon", url: "https://mastodon.social/@x", enabled: true }],
  } as any];
  const html = renderBlockedTemplate(blocks, mockEvent, null, null);
  assertStringIncludes(html, "Mastodon");
  assertEquals(html.includes("<img"), false);
});

Deno.test("lineup: highlight_headliner destaca o 1º artista e section_bg envolve numa caixa", () => {
  const event = { ...mockEvent, lineup: ["Headliner XYZ", "Suporte 1", "Suporte 2"] };
  const blocks: Block[] = [{ id: "1", kind: "lineup", layout: "list", highlight_headliner: true, section_bg: true } as any];
  const html = renderBlockedTemplate(blocks, event, null, null);
  assertStringIncludes(html, "font-size:19px;font-weight:800;");
  assertStringIncludes(html, "Headliner XYZ");
});

Deno.test("countdown: number_color e show_unit_labels=false aplicam no HTML", () => {
  const blocks: Block[] = [{ id: "1", kind: "countdown", size: "large", number_color: "#00ffff", show_unit_labels: false } as any];
  const html = renderBlockedTemplate(blocks, mockEvent, null, null);
  assertStringIncludes(html, "color:#00ffff;");
  assertEquals(html.includes("HORAS") || html.includes("horas"), false);
});

Deno.test("ticker: speed e shape pill alteram duração da animação e border-radius", () => {
  const blocks: Block[] = [{ id: "1", kind: "ticker", messages: ["MSG_XYZ", "MSG_ABC"], animation: "fade", speed: "fast", shape: "pill" } as any];
  const html = renderBlockedTemplate(blocks, mockEvent, null, null);
  assertStringIncludes(html, "border-radius:999px;");
  // fade dur = 9 * 0.6 = 5.4 -> Math.round = 5
  assertStringIncludes(html, "tkf 5s infinite");
});

Deno.test("static_map: pin_color entra na URL do proxy e directions_label troca o texto do botão", () => {
  const event = { ...mockEvent, venueLat: -23.5, venueLng: -46.6 };
  const blocks: Block[] = [{ id: "1", kind: "static_map", pin_color: "#a855f7", directions_label: "Ir até lá" } as any];
  const html = renderBlockedTemplate(blocks, event, null, null);
  assertStringIncludes(html, `pincolor=${encodeURIComponent("#a855f7")}`);
  assertStringIncludes(html, "Ir até lá");
});

Deno.test("weekend_grid: layout cartaz também respeita day_bar_color e show_time=false esconde o horário", () => {
  const event = {
    ...mockEvent,
    weekendEvents: [
      { id: "1", title: "Evento A", dayLabel: "SEX", timeLabel: "23h", venue: "Clube X", imageUrl: "https://x.com/a.jpg", eventUrl: "https://x.com/a" },
    ],
  };
  const blocks: Block[] = [{ id: "1", kind: "weekend_grid", layout: "cartaz", day_bar_color: "#00ff00", show_time: false } as any];
  const html = renderBlockedTemplate(blocks, event as any, null, null);
  assertStringIncludes(html, "color:#00ff00;");
  assertEquals(html.includes("23h"), false);
});

Deno.test("weekly_hero: accent_color troca a cor da etiqueta e show_datetime=false esconde dia/hora", () => {
  const event = {
    ...mockEvent,
    weekendEvents: [
      { id: "1", title: "Evento A", dayLabel: "SEX", timeLabel: "23h", venue: "Clube X", imageUrl: "https://x.com/a.jpg", eventUrl: "https://x.com/a" },
    ],
  };
  const blocks: Block[] = [{ id: "1", kind: "weekly_hero", accent_color: "#ff00ff", show_datetime: false } as any];
  const html = renderBlockedTemplate(blocks, event as any, null, null);
  assertStringIncludes(html, "color:#ff00ff;");
  assertEquals(html.includes("23h"), false);
});

Deno.test("blog_posts_list: category_color troca a cor e show_read_more_link mostra link no layout lista", () => {
  const event = {
    ...mockEvent,
    blogPosts: [{ id: "1", title: "Post A", category: "Eventos", url: "https://x.com/post-a" }],
  };
  const blocks: Block[] = [{ id: "1", kind: "blog_posts_list", layout: "list", category_color: "#00ffaa", show_read_more_link: true } as any];
  const html = renderBlockedTemplate(blocks, event as any, null, null);
  assertStringIncludes(html, "color:#00ffaa;");
  assertStringIncludes(html, "Ler matéria →");
});

Deno.test("dedge_block: card_style compact usa o layout discreto e show_description=false esconde a descrição", () => {
  const blocks: Block[] = [{
    id: "1",
    kind: "dedge_block",
    card_style: "compact",
    show_description: false,
    image_url: "https://x.com/dedge.jpg",
    title: "DEDGE_TITULO_XYZ",
    description: "DEDGE_DESC_OCULTA_XYZ",
    primary_url: "https://x.com/dedge",
  } as any];
  const html = renderBlockedTemplate(blocks, mockEvent, null, null);
  assertStringIncludes(html, "DEDGE_TITULO_XYZ");
  assertStringIncludes(html, "Ver eventos Dedge →");
  assertEquals(html.includes("DEDGE_DESC_OCULTA_XYZ"), false);
  // Compacto não deve renderizar a caixa preta full-width do modo "featured"
  assertEquals(html.includes("background:#000000;"), false);
});

Deno.test("footer: text_color e font_size aplicam no HTML", () => {
  const blocks: Block[] = [{ id: "1", kind: "footer", text: "RODAPE_XYZ", text_color: "#999999", font_size: 13 } as any];
  const html = renderBlockedTemplate(blocks, mockEvent, null, null);
  assertStringIncludes(html, "color:#999999;font-size:13px;");
});

Deno.test("pix_button: align e full_width=false respeitam o layout inline (campos agora expostos no editor)", () => {
  const blocks: Block[] = [{ id: "1", kind: "pix_button", align: "right", full_width: false } as any];
  const html = renderBlockedTemplate(blocks, eventComPix, null, null);
  assertStringIncludes(html, 'align="right"');
  assertStringIncludes(html, "display:inline-block;width:auto;");
});

Deno.test("event_grid: align direita é respeitado no cabeçalho (campo agora exposto no editor)", () => {
  const event = {
    ...mockEvent,
    gridEvents: [
      { id: "1", title: "Evento A", dayLabel: "23/08", venue: "Clube X", imageUrl: "https://x.com/a.jpg", eventUrl: "https://x.com/a" },
    ],
  };
  const blocks: Block[] = [{ id: "1", kind: "event_grid", eyebrow: "EYEBROW_XYZ", align: "right" } as any];
  const html = renderBlockedTemplate(blocks, event as any, null, null);
  assertStringIncludes(html, 'text-align:right');
});

// ============================================================
// Item 2 (melhorias no editor de e-mail) — textos que estavam presos no
// código ganharam campo editável, com fallback pro texto atual.
// ============================================================

Deno.test("title: text_override sobrescreve event.eventTitle; sem override, usa o título do evento (comportamento antigo preservado)", () => {
  const withOverride = renderBlockedTemplate(
    [{ id: "1", kind: "title", text_override: "3 eventos com nova promo hoje" } as any],
    mockEvent, null, null,
  );
  assertStringIncludes(withOverride, "3 eventos com nova promo hoje");
  // O <h1> visível do bloco usa o override — não o confundir com o <title>
  // do <head> do e-mail, que sempre usa event.eventTitle (metadado da aba
  // do navegador/cliente de e-mail, independente do bloco).
  assertEquals(withOverride.includes("<h1"), true);
  assertStringIncludes(withOverride, '<h1 style="margin:0;color:#ffffff;font-size:28px;line-height:1.15;font-weight:800;letter-spacing:-0.01em;">3 eventos com nova promo hoje</h1>');

  const withoutOverride = renderBlockedTemplate([{ id: "1", kind: "title" } as any], mockEvent, null, null);
  assertStringIncludes(withoutOverride, mockEvent.eventTitle);
});

Deno.test("title: text_override em branco (só espaços) cai no fallback do título do evento", () => {
  const html = renderBlockedTemplate([{ id: "1", kind: "title", text_override: "   " } as any], mockEvent, null, null);
  assertStringIncludes(html, mockEvent.eventTitle);
});

Deno.test("title: contexto multi-evento (gridEvents) sem override lista cada evento numa linha, com marcador e dia/hora", () => {
  const event = {
    ...mockEvent,
    gridEvents: [
      { id: "1", title: "BOMA presents: The Moment", dayLabel: "22/08", timeLabel: "17h", venue: "V1", imageUrl: "https://x.com/a.jpg", eventUrl: "https://x.com/a" },
      { id: "2", title: "Nostalgia", dayLabel: "23/08", timeLabel: "22h", venue: "V2", imageUrl: "https://x.com/b.jpg", eventUrl: "https://x.com/b" },
    ],
  };
  const html = renderBlockedTemplate([{ id: "1", kind: "title" } as any], event as any, null, null);
  assertStringIncludes(html, "• BOMA presents: The Moment — 22/08 · 17h<br>• Nostalgia — 23/08 · 22h");
});

Deno.test("title: com gridEvents, text_override ainda vence a lista", () => {
  const event = {
    ...mockEvent,
    gridEvents: [
      { id: "1", title: "Evento A", dayLabel: "22/08", venue: "V1", imageUrl: "https://x.com/a.jpg", eventUrl: "https://x.com/a" },
    ],
  };
  const html = renderBlockedTemplate([{ id: "1", kind: "title", text_override: "Promo especial" } as any], event as any, null, null);
  assertStringIncludes(html, ">Promo especial<");
  assertEquals(html.includes("•"), false);
});

Deno.test("event_meta: date_label e location_label sobrescrevem os rótulos padrão", () => {
  const html = renderBlockedTemplate(
    [{ id: "1", kind: "event_meta", date_label: "Quando", location_label: "Onde" } as any],
    mockEvent, null, null,
  );
  assertStringIncludes(html, "Quando");
  assertStringIncludes(html, "Onde");
  assertEquals(html.includes(">📅 Data e hora<"), false);
  assertEquals(html.includes(">📍 Local<"), false);
});

Deno.test("article_summary: eyebrow_label sobrescreve \"📰 Leia a matéria\" nos dois layouts", () => {
  const article: ArticleSummary = { title: "Materia", excerpt: "Resumo", url: "https://x.com/m" };
  const card = renderBlockedTemplate([{ id: "1", kind: "article_summary", layout: "card", eyebrow_label: "Vem aí" } as any], mockEvent, null, article);
  const compact = renderBlockedTemplate([{ id: "1", kind: "article_summary", layout: "compact", eyebrow_label: "Vem aí" } as any], mockEvent, null, article);
  assertStringIncludes(card, "Vem aí");
  assertStringIncludes(compact, "Vem aí");
  assertEquals(card.includes("📰 Leia a matéria"), false);
});

Deno.test('footer: unsubscribe_label sobrescreve "Descadastrar-se"', () => {
  const html = renderBlockedTemplate([{ id: "1", kind: "footer", unsubscribe_label: "Sair da lista" } as any], mockEvent, null, null);
  assertStringIncludes(html, ">Sair da lista<");
  assertEquals(html.includes(">Descadastrar-se<"), false);
});

Deno.test("dedge_block (compact): reaproveita primary_label pro texto do link, em vez do texto fixo \"Ver eventos Dedge →\"", () => {
  const html = renderBlockedTemplate(
    [{ id: "1", kind: "dedge_block", card_style: "compact", image_url: "https://x.com/d.jpg", primary_label: "Ver residência Dedge" } as any],
    mockEvent, null, null,
  );
  assertStringIncludes(html, "Ver residência Dedge");
  assertEquals(html.includes("Ver eventos Dedge →"), false);
});

Deno.test("dedge_block (compact): sem primary_label, mantém o texto padrão \"Ver eventos Dedge →\" (comportamento antigo preservado)", () => {
  const html = renderBlockedTemplate(
    [{ id: "1", kind: "dedge_block", card_style: "compact", image_url: "https://x.com/d.jpg" } as any],
    mockEvent, null, null,
  );
  assertStringIncludes(html, "Ver eventos Dedge →");
});

Deno.test('blog_posts_list: read_more_label sobrescreve "Ler matéria →" nos layouts cards e lista', () => {
  const event = { ...mockEvent, blogPosts: [{ id: "1", title: "Post A", url: "https://x.com/a" }] };
  const cards = renderBlockedTemplate([{ id: "1", kind: "blog_posts_list", layout: "cards", read_more_label: "Ver post" } as any], event as any, null, null);
  const list = renderBlockedTemplate([{ id: "1", kind: "blog_posts_list", layout: "list", show_read_more_link: true, read_more_label: "Ver post" } as any], event as any, null, null);
  assertStringIncludes(cards, "Ver post");
  assertStringIncludes(list, "Ver post");
  assertEquals(cards.includes("Ler matéria →"), false);
});

Deno.test("countdown: rótulos de unidade e prefixo da data-limite são editáveis (tamanhos large/medium/minimal)", () => {
  const eventComDias = { ...mockEvent, ticketBatchDeadlineIso: new Date(Date.now() + 30 * 3600 * 1000).toISOString() };
  const custom = {
    unit_label_day: "d", unit_label_days: "ds", unit_label_hour: "h", unit_label_hours: "hs",
    unit_label_minutes: "m", until_prefix: "encerra em",
  };
  const large = renderBlockedTemplate([{ id: "1", kind: "countdown", size: "large", deadline_source: "batch_deadline", ...custom } as any], eventComDias, null, null);
  assertStringIncludes(large, "encerra em");
  const medium = renderBlockedTemplate([{ id: "1", kind: "countdown", size: "medium", deadline_source: "batch_deadline", ...custom } as any], eventComDias, null, null);
  assertStringIncludes(medium, ">hs<");
  const minimal = renderBlockedTemplate([{ id: "1", kind: "countdown", size: "minimal", deadline_source: "batch_deadline", ...custom } as any], eventComDias, null, null);
  assertStringIncludes(minimal, "(encerra em");
});

Deno.test("countdown: sem rótulos customizados, mantém os textos padrão em português (comportamento antigo preservado)", () => {
  const html = renderBlockedTemplate([{ id: "1", kind: "countdown", size: "large" } as any], mockEvent, null, null);
  assertStringIncludes(html, "até");
});

// ------------------------------------------------------------
// Paridade HTML ↔ texto-puro: quando um campo é deixado vazio, os dois
// formatos devem cair no MESMO texto padrão (antes divergiam).
// ------------------------------------------------------------

Deno.test("paridade HTML/texto-puro: countdown sem label usa o mesmo padrão nos dois formatos", () => {
  const blocks: Block[] = [{ id: "1", kind: "countdown" } as any];
  const text = renderBlockedTemplateText(blocks, mockEvent, null, null);
  assertStringIncludes(text, "Lote atual encerra em");
});

Deno.test("paridade HTML/texto-puro: title com gridEvents lista os eventos nos dois formatos", () => {
  const event = {
    ...mockEvent,
    gridEvents: [
      { id: "1", title: "Evento A", dayLabel: "22/08", timeLabel: "17h", venue: "V1", imageUrl: "https://x.com/a.jpg", eventUrl: "https://x.com/a" },
      { id: "2", title: "Evento B", dayLabel: "23/08", timeLabel: "22h", venue: "V2", imageUrl: "https://x.com/b.jpg", eventUrl: "https://x.com/b" },
    ],
  };
  const blocks: Block[] = [{ id: "1", kind: "title" } as any];
  const text = renderBlockedTemplateText(blocks, event as any, null, null);
  assertStringIncludes(text, "• EVENTO A — 22/08 · 17H");
  assertStringIncludes(text, "• EVENTO B — 23/08 · 22H");
});

Deno.test("paridade HTML/texto-puro: weekend_grid sem título usa o mesmo padrão nos dois formatos", () => {
  const event = { ...mockEvent, weekendEvents: [{ id: "1", title: "Ev", dayLabel: "SEX", venue: "V", imageUrl: "https://x.com/a.jpg", eventUrl: "https://x.com/a" }] };
  const blocks: Block[] = [{ id: "1", kind: "weekend_grid" } as any];
  const text = renderBlockedTemplateText(blocks, event as any, null, null);
  assertStringIncludes(text, "O QUE ROLA NO FDS");
});

Deno.test("paridade HTML/texto-puro: event_grid some no texto-puro quando também some no HTML (sem eyebrow/title)", () => {
  const event = { ...mockEvent, gridEvents: [{ id: "1", title: "Ev", dayLabel: "SEX", venue: "V", imageUrl: "https://x.com/a.jpg", eventUrl: "https://x.com/a" }] };
  const blocks: Block[] = [{ id: "1", kind: "event_grid" } as any];
  const text = renderBlockedTemplateText(blocks, event as any, null, null);
  assertEquals(text.includes("EVENTOS SELECIONADOS"), false);
});

Deno.test("paridade HTML/texto-puro: dedge_block sem título usa o mesmo padrão nos dois formatos", () => {
  const event = { ...mockEvent, dedge: { imageUrl: "https://x.com/d.jpg", nights: [] } };
  const blocks: Block[] = [{ id: "1", kind: "dedge_block" } as any];
  const text = renderBlockedTemplateText(blocks, event as any, null, null);
  assertStringIncludes(text, "Dedge — sua residência da semana");
});

Deno.test("paridade HTML/texto-puro: footer sem texto usa o mesmo aviso de descadastro nos dois formatos", () => {
  const blocks: Block[] = [{ id: "1", kind: "footer" } as any];
  const text = renderBlockedTemplateText(blocks, mockEvent, null, null);
  assertStringIncludes(text, "Você recebeu este e-mail porque assinou a lista MDAccula.");
});

Deno.test("todos os blocos com campos novos renderizam sem lançar exceção (smoke test fim-a-fim)", () => {
  const event = {
    ...mockEvent,
    venueLat: -23.5,
    venueLng: -46.6,
    lineup: ["Artista A", "Artista B"],
    weekendEvents: [{ id: "1", title: "Evento A", dayLabel: "SEX", venue: "Clube X", imageUrl: "https://x.com/a.jpg", eventUrl: "https://x.com/a" }],
    gridEvents: [{ id: "2", title: "Evento B", dayLabel: "SAB", venue: "Clube Y", imageUrl: "https://x.com/b.jpg", eventUrl: "https://x.com/b" }],
    blogPosts: [{ id: "3", title: "Post A", url: "https://x.com/post-a" }],
    pixWhatsAppUrl: "https://api.whatsapp.com/send?phone=5511997819194",
  };
  const article: ArticleSummary = { title: "Materia", excerpt: "Resumo", url: "https://x.com/m" };
  const blocks: Block[] = [
    { id: "1", kind: "header", bg_color: "#111", padding_bottom: 10 } as any,
    { id: "2", kind: "hero_image", border_color: "#222", caption: "cap" } as any,
    { id: "3", kind: "eyebrow", bg_style: "pill" } as any,
    { id: "4", kind: "title", font_weight: "bold", uppercase: true } as any,
    { id: "5", kind: "subtitle", font_size: 14, italic: true } as any,
    { id: "6", kind: "event_meta", show_icons: false, accent_color: "#333" } as any,
    { id: "7", kind: "description", font_size: 16, line_height: "compact" } as any,
    { id: "8", kind: "article_summary", layout: "compact" } as any,
    { id: "9", kind: "cta_button", size: "small", shape: "pill" } as any,
    { id: "10", kind: "pix_button", align: "center", full_width: true } as any,
    { id: "11", kind: "secondary_link", variant: "ghost", text_color: "#444" } as any,
    { id: "12", kind: "image_with_link", image_url: "https://x.com/i.jpg", link_url: "https://x.com", border_color: "#555", caption: "cap2" } as any,
    { id: "13", kind: "divider", spacing: "compact", width: "short" } as any,
    { id: "13b", kind: "spacing", height: 32 } as any,
    { id: "14", kind: "text", html: "<p>x</p>", font_size: 12, bg_highlight: true } as any,
    { id: "15", kind: "social_icons", style: "icon", icon_size: "medium", networks: [{ id: "instagram", label: "Instagram", url: "https://instagram.com/x", enabled: true, icon_url: "https://cdn.example.com/ig.png" }] } as any,
    { id: "16", kind: "lineup", layout: "grid", highlight_headliner: true, section_bg: true } as any,
    { id: "17", kind: "countdown", size: "medium", number_color: "#666", show_unit_labels: false } as any,
    { id: "18", kind: "ticker", messages: ["a", "b"], speed: "slow", shape: "pill" } as any,
    { id: "19", kind: "static_map", pin_color: "#777", directions_label: "Ir" } as any,
    { id: "20", kind: "weekend_grid", layout: "cartaz", day_bar_color: "#888", show_time: false } as any,
    { id: "21", kind: "event_grid", title: "t", eyebrow: "e", align: "right" } as any,
    { id: "22", kind: "dedge_block", card_style: "compact", show_description: false, image_url: "https://x.com/d.jpg", primary_url: "https://x.com/d" } as any,
    { id: "23", kind: "weekly_hero", accent_color: "#999", show_datetime: false } as any,
    { id: "24", kind: "blog_posts_list", layout: "list", category_color: "#aaa", show_read_more_link: true } as any,
    { id: "25", kind: "footer", text_color: "#bbb", font_size: 12 } as any,
  ];
  const html = renderBlockedTemplate(blocks, event as any, null, article);
  const text = renderBlockedTemplateText(blocks, event as any, null, article);
  // Não deve lançar exceção (o teste já teria falhado acima) e deve gerar HTML/texto não vazios.
  assertEquals(html.length > 0, true);
  assertEquals(text.length > 0, true);
});
