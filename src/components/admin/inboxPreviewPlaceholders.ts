import { resolveEmailPlaceholders } from "@/lib/emailTemplates/emailMeta";
import type { InboxPreviewData } from "./InboxPreviewHeader";

/**
 * Lista canônica de placeholders reconhecidos (usada tanto pelo resolver
 * quanto pelo dialog de ajuda "Ver placeholders").
 */
export const KNOWN_PLACEHOLDERS: Array<{ key: string; aliases: string[]; description: string; scope: string }> = [
  { key: "event_title", aliases: ["event.title"], description: "Título do evento (ou destaque da semana em digest).", scope: "Evento, Virada, Cortesia" },
  { key: "date_label", aliases: ["event.date_label"], description: "Data já formatada (ex.: 'Sáb, 12 jul').", scope: "Evento, Virada, Cortesia" },
  { key: "time_label", aliases: ["event.time_label"], description: "Horário do evento (ex.: '22h').", scope: "Evento, Virada, Cortesia" },
  { key: "venue_name", aliases: ["event.venue"], description: "Nome da casa/espaço.", scope: "Evento, Virada, Cortesia" },
  { key: "city_state", aliases: ["event.city_state"], description: "Cidade e UF (ex.: 'São Paulo - SP').", scope: "Evento, Virada, Cortesia" },
  { key: "weekend_range", aliases: [], description: "Faixa de datas do fim de semana (ex.: '5-7 jul').", scope: "Agenda FDS" },
  { key: "week_range", aliases: [], description: "Faixa de datas da semana (ex.: '1-7 jul').", scope: "Digest semanal" },
  { key: "range_label", aliases: [], description: "Faixa genérica retornada pelo disparo (quando não diferencia semana/FDS).", scope: "Digest semanal, Agenda FDS" },
  { key: "events_count", aliases: [], description: "Quantidade de eventos incluídos no disparo.", scope: "Digest semanal, Agenda FDS" },
];

/**
 * Substitui placeholders {{campo}} pelos valores em `data`.
 * Aceita as variações listadas em PLACEHOLDER_ALIASES (ver InboxPreviewHeader.tsx).
 * Placeholders reconhecidos mas sem valor viram string vazia (não geram warning).
 * Placeholders totalmente desconhecidos ficam literais (e disparam o warning amber).
 */
export function resolvePlaceholders(
  template: string | null | undefined,
  data: InboxPreviewData | undefined,
): string {
  return resolveEmailPlaceholders(template, data ?? {});
}
