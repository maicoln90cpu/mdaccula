// Testa a fonte única de mapeamento de CTA por evento (`eventCta.ts`) e a
// precedência do rótulo do botão no bloco `cta_button`:
//   block.label (override explícito no template) > event.ctaLabel (cta_type
//   do evento) > settings.cta_label (fallback global) > "Garantir ingresso".
//
// Motivação: antes desta mudança, o botão "Enviar Nome para Lista" só
// aparecia via inferência de substring na URL (`ticket_link`), só na página
// de detalhe do evento — nunca na Home, no modal, nem nos e-mails.

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  DEFAULT_EVENT_CTA_TYPE,
  EVENT_CTA_CONFIG,
  getEventCtaButtonLabel,
  getEventCtaCardTitle,
  normalizeEventCtaType,
} from "./eventCta.ts";
import { renderBlockedTemplate, type Block, type EventAnnouncementData } from "./emailBlocks.ts";

Deno.test("normalizeEventCtaType cai para o padrão em valores desconhecidos/nulos", () => {
  assertEquals(normalizeEventCtaType(null), DEFAULT_EVENT_CTA_TYPE);
  assertEquals(normalizeEventCtaType(undefined), DEFAULT_EVENT_CTA_TYPE);
  assertEquals(normalizeEventCtaType("algo-invalido"), DEFAULT_EVENT_CTA_TYPE);
  assertEquals(normalizeEventCtaType("courtesy"), "courtesy");
});

Deno.test("getEventCtaButtonLabel/getEventCtaCardTitle cobrem os 4 tipos", () => {
  assertEquals(getEventCtaButtonLabel("buy_ticket"), "Comprar Ingresso");
  assertEquals(getEventCtaButtonLabel("buy_ticket_discount"), "Comprar Ingresso com Desconto");
  assertEquals(getEventCtaButtonLabel("guest_list"), "Enviar Nomes para Lista");
  assertEquals(getEventCtaButtonLabel("courtesy"), "Emitir Cortesia");
  assertEquals(getEventCtaCardTitle("guest_list"), EVENT_CTA_CONFIG.guest_list.cardTitle);
});

const baseEvent: EventAnnouncementData = {
  eventTitle: "Evento Teste",
  flyerUrl: "https://example.com/flyer.jpg",
  dateLabel: "17 de julho",
  timeLabel: "22h",
  venueName: "Casa Aragon",
  cityState: "São Paulo-SP",
  description: "Descrição",
  ticketUrl: "https://example.com/ticket",
  eventUrl: "https://example.com/evento",
  agendaUrl: "https://example.com/eventos",
  instagramUrl: "",
  youtubeUrl: "",
  tiktokUrl: "",
  unsubscribeUrl: "https://example.com/unsub",
};

const ctaBlock: Block[] = [{ id: "cta", kind: "cta_button", url_field: "ticket_link" } as Block];

Deno.test("cta_button: event.ctaLabel vence o fallback global settings.cta_label", () => {
  const html = renderBlockedTemplate(ctaBlock, { ...baseEvent, ctaLabel: "Emitir Cortesia" }, { cta_label: "Garantir ingresso" });
  assertEquals(html.includes("Emitir Cortesia"), true);
  assertEquals(html.includes(">Garantir ingresso<"), false);
});

Deno.test("cta_button: sem ctaLabel do evento, usa settings.cta_label (comportamento antigo preservado)", () => {
  const html = renderBlockedTemplate(ctaBlock, baseEvent, { cta_label: "Garantir ingresso" });
  assertEquals(html.includes("Garantir ingresso"), true);
});

Deno.test("cta_button: label explícito do bloco sempre vence, mesmo com ctaLabel do evento", () => {
  const overrideBlock: Block[] = [{ id: "cta", kind: "cta_button", url_field: "ticket_link", label: "Texto do Template" } as Block];
  const html = renderBlockedTemplate(overrideBlock, { ...baseEvent, ctaLabel: "Emitir Cortesia" }, { cta_label: "Garantir ingresso" });
  assertEquals(html.includes("Texto do Template"), true);
  assertEquals(html.includes("Emitir Cortesia"), false);
});
