/**
 * Helper único para construir o payload enviado à edge function `generate-blog-post-v2`.
 * Garante que TODOS os campos relevantes do evento (incl. weekday calculado e ai_context)
 * cheguem ao backend, evitando divergências entre EventForm (criar) e EventsManager (regerar).
 */

export interface EventLike {
  id?: string;
  title: string;
  subtitle?: string | null;
  date: string; // YYYY-MM-DD
  time?: string | null;
  end_time?: string | null;
  venue: string;
  address?: string | null;
  location_city: string;
  location_state: string;
  description?: string | null;
  genres?: string[] | null;
  lineup?: string[] | null;
  ticket_link?: string | null;
  vip_link?: string | null;
  image_url?: string | null;
  ai_context?: string | null;
}

const WEEKDAYS_PT = [
  "domingo",
  "segunda-feira",
  "terça-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sábado",
];

const MONTHS_PT = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/**
 * Calcula nome do dia da semana em PT-BR a partir de uma string YYYY-MM-DD,
 * tratando a data como local (sem shift de fuso) — evita o bug clássico de
 * `new Date('2026-09-19')` retornar sexta em UTC-3.
 */
export function weekdayPtBr(dateStr: string): string {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return "";
  const dt = new Date(y, m - 1, d);
  return WEEKDAYS_PT[dt.getDay()] ?? "";
}

/** Ex: "19 de setembro de 2026 (sábado)" */
export function dateFormattedPtBr(dateStr: string): string {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return "";
  const wd = weekdayPtBr(dateStr);
  return `${d} de ${MONTHS_PT[m - 1]} de ${y}${wd ? ` (${wd})` : ""}`;
}

export interface ArticlePayload {
  eventId?: string;
  eventName: string;
  title: string;
  subtitle: string;
  eventDate: string;
  dateFormatted: string;
  weekday: string;
  eventTime: string;
  endTime: string;
  eventLocation: string;
  venue: string;
  address: string;
  locationCity: string;
  locationState: string;
  description: string;
  genres: string;
  lineup: string;
  ticketLink: string;
  vipLink: string;
  eventImageUrl: string;
  aiContext: string;
  category: string;
  generateImage: boolean;
}

/**
 * Remove partes duplicadas (comparação case-insensitive/trim) preservando a
 * ordem — evita "São Paulo - São Paulo - SP" quando o venue foi cadastrado
 * com o nome da cidade em vez de um local específico.
 */
function dedupeParts(parts: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const part of parts) {
    if (!part) continue;
    const key = part.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(part);
  }
  return result;
}

export function buildArticlePayload(
  event: EventLike,
  opts: { generateImage?: boolean; aiContextOverride?: string } = {},
): ArticlePayload {
  const eventLocation = dedupeParts([event.venue, event.location_city, event.location_state]).join(" - ");

  return {
    eventId: event.id,
    eventName: event.title,
    title: event.title,
    subtitle: event.subtitle ?? "",
    eventDate: event.date,
    dateFormatted: dateFormattedPtBr(event.date),
    weekday: weekdayPtBr(event.date),
    eventTime: event.time ?? "",
    endTime: event.end_time ?? "",
    eventLocation,
    venue: event.venue,
    address: event.address ?? "",
    locationCity: event.location_city,
    locationState: event.location_state,
    description: event.description ?? "",
    genres: (event.genres ?? []).join(", "),
    lineup: (event.lineup ?? []).join(", "),
    ticketLink: event.ticket_link ?? "",
    vipLink: event.vip_link ?? "",
    eventImageUrl: event.image_url ?? "",
    aiContext: opts.aiContextOverride ?? event.ai_context ?? "",
    category: "Eventos",
    generateImage: opts.generateImage ?? !event.image_url,
  };
}
