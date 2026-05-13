/**
 * Helper único de visibilidade/atividade de eventos.
 *
 * Regra:
 *  - Evento COM horário definido (`time`): inativo após `time + hoursAfterStart`.
 *  - Evento SEM horário definido: inativo após `date 00:00 + hoursWithoutTime`.
 *  - `end_time` deixa de afetar visibilidade (ainda existe no schema, só não é mais usado).
 *  - Comparação em UTC respeitando `timezoneOffset` (ex.: -3 = BRT).
 */

export interface EventVisibilityParams {
  date: string;            // YYYY-MM-DD (data inicial)
  end_date?: string | null; // YYYY-MM-DD (data final de festivais multi-dias). Quando ausente, == date.
  time?: string | null;    // HH:MM[:SS] opcional
  end_time?: string | null; // mantido por compatibilidade — ignorado no cálculo
}

export interface EventVisibilitySettings {
  timezoneOffset: number;   // ex.: -3
  hoursAfterStart: number;  // default 12
  hoursWithoutTime: number; // default 24
}

const DEFAULTS: EventVisibilitySettings = {
  timezoneOffset: -3,
  hoursAfterStart: 12,
  hoursWithoutTime: 24,
};

/**
 * Compatibilidade: aceita também a antiga chave `graceHours` (ignorada),
 * para não quebrar imports legados durante migração de chamadas.
 */
export type TimezoneSettings = Partial<EventVisibilitySettings> & {
  graceHours?: number;
};

/**
 * Converte data+hora local (no offset informado) para epoch ms (UTC).
 */
function localToUtcMs(
  dateStr: string,
  hours: number,
  minutes: number,
  timezoneOffset: number
): number {
  const [year, month, day] = dateStr.split("-").map(Number);
  // Date.UTC trata os args como UTC. Para representar "hora local no offset X",
  // subtraímos o offset (ex.: 22:00 BRT = 22:00 - (-3h) = 01:00 UTC).
  return Date.UTC(year, month - 1, day, hours, minutes, 0) - timezoneOffset * 3_600_000;
}

function parseHHMM(timeStr: string): { h: number; m: number } {
  const [h, m] = timeStr.split(":").map(Number);
  return { h: h || 0, m: m || 0 };
}

/**
 * Verifica se o evento ainda deve ser considerado ativo/visível.
 */
export function isEventActive(
  event: EventVisibilityParams,
  settings: TimezoneSettings = {}
): boolean {
  if (!event.date) return true;

  const cfg: EventVisibilitySettings = {
    timezoneOffset: settings.timezoneOffset ?? DEFAULTS.timezoneOffset,
    hoursAfterStart: settings.hoursAfterStart ?? DEFAULTS.hoursAfterStart,
    hoursWithoutTime: settings.hoursWithoutTime ?? DEFAULTS.hoursWithoutTime,
  };

  let endMs: number;
  // Para festivais multi-dias, a janela de graça é aplicada sobre o ÚLTIMO dia.
  const referenceDate = event.end_date && event.end_date >= event.date ? event.end_date : event.date;

  if (event.time) {
    const { h, m } = parseHHMM(event.time);
    const startUtc = localToUtcMs(referenceDate, h, m, cfg.timezoneOffset);
    endMs = startUtc + cfg.hoursAfterStart * 3_600_000;
  } else {
    const startUtc = localToUtcMs(referenceDate, 0, 0, cfg.timezoneOffset);
    endMs = startUtc + cfg.hoursWithoutTime * 3_600_000;
  }

  return Date.now() < endMs;
}

/** Alias mantido por compatibilidade. */
export const isEventVisible = isEventActive;

/** Filtra lista mantendo apenas ativos. */
export function filterVisibleEvents<T extends EventVisibilityParams>(
  events: T[],
  settings: TimezoneSettings = {}
): T[] {
  return events.filter((e) => isEventActive(e, settings));
}
