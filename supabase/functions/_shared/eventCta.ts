/**
 * Fonte única do "tipo de botão" (CTA) de um evento.
 *
 * Usado tanto pelo frontend (via alias `@shared/eventCta.ts`) quanto pelas
 * Edge Functions, para que o texto do botão/card seja o mesmo no site
 * (Home, /eventos, /evento/:slug) e nos e-mails (disparo único + digests).
 */

export type EventCtaType = "buy_ticket" | "buy_ticket_discount" | "guest_list" | "courtesy";

export const DEFAULT_EVENT_CTA_TYPE: EventCtaType = "buy_ticket";

export const EVENT_CTA_TYPES: EventCtaType[] = [
  "buy_ticket",
  "buy_ticket_discount",
  "guest_list",
  "courtesy",
];

export const EVENT_CTA_CONFIG: Record<EventCtaType, { buttonLabel: string; cardTitle: string }> = {
  buy_ticket: { buttonLabel: "Comprar Ingresso", cardTitle: "Ingressos" },
  buy_ticket_discount: { buttonLabel: "Comprar Ingresso com Desconto", cardTitle: "Ingressos com Desconto" },
  guest_list: { buttonLabel: "Enviar Nomes para Lista", cardTitle: "Lista Social" },
  courtesy: { buttonLabel: "Emitir Cortesia", cardTitle: "Cortesia" },
};

const isEventCtaType = (value: unknown): value is EventCtaType =>
  typeof value === "string" && (EVENT_CTA_TYPES as string[]).includes(value);

export function normalizeEventCtaType(value: string | null | undefined): EventCtaType {
  return isEventCtaType(value) ? value : DEFAULT_EVENT_CTA_TYPE;
}

export function getEventCtaButtonLabel(value: string | null | undefined): string {
  return EVENT_CTA_CONFIG[normalizeEventCtaType(value)].buttonLabel;
}

export function getEventCtaCardTitle(value: string | null | undefined): string {
  return EVENT_CTA_CONFIG[normalizeEventCtaType(value)].cardTitle;
}
