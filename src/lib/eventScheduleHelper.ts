/**
 * Helpers para o campo `schedule` (jsonb) de eventos festival multi-dias.
 * Cada entrada representa a programação de UM dia do festival.
 */

export interface ScheduleEntry {
  date: string;           // YYYY-MM-DD
  time: string;           // HH:mm:ss ou HH:mm
  end_time?: string | null;
  lineup?: string[];
}

export type EventSchedule = ScheduleEntry[];

/**
 * Verifica se um valor jsonb é uma agenda válida (array com pelo menos 1 entrada).
 */
export function isValidSchedule(value: unknown): value is EventSchedule {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(
      (e) =>
        e &&
        typeof e === 'object' &&
        typeof (e as Record<string, unknown>).date === 'string' &&
        typeof (e as Record<string, unknown>).time === 'string',
    )
  );
}

/**
 * Coage o jsonb retornado do banco para EventSchedule (ou null).
 */
export function parseSchedule(value: unknown): EventSchedule | null {
  return isValidSchedule(value) ? (value as EventSchedule) : null;
}

/**
 * Lista de datas (YYYY-MM-DD) entre start e end, inclusivo.
 */
export function datesInRange(startDate: string, endDate: string): string[] {
  const out: string[] = [];
  const [sy, sm, sd] = startDate.split('-').map(Number);
  const [ey, em, ed] = endDate.split('-').map(Number);
  const start = new Date(sy, sm - 1, sd);
  const end = new Date(ey, em - 1, ed);
  const cursor = new Date(start);
  // segurança: limita a 30 dias para evitar loops infinitos por bug
  let safety = 0;
  while (cursor <= end && safety < 30) {
    const y = cursor.getFullYear();
    const m = String(cursor.getMonth() + 1).padStart(2, '0');
    const d = String(cursor.getDate()).padStart(2, '0');
    out.push(`${y}-${m}-${d}`);
    cursor.setDate(cursor.getDate() + 1);
    safety += 1;
  }
  return out;
}

/**
 * Reconcilia uma agenda existente com um novo intervalo de datas.
 * - Mantém as entradas cujas datas continuam no intervalo (preserva line-up).
 * - Adiciona entradas vazias (com horário herdado) para datas novas.
 * - Remove entradas fora do intervalo.
 */
export function reconcileSchedule(
  current: EventSchedule | null,
  startDate: string,
  endDate: string | null | undefined,
  fallbackTime: string,
  fallbackEndTime?: string | null,
): EventSchedule | null {
  if (!endDate || endDate === startDate) return null;
  const dates = datesInRange(startDate, endDate);
  return dates.map((date) => {
    const existing = current?.find((e) => e.date === date);
    return {
      date,
      time: existing?.time || fallbackTime,
      end_time: existing?.end_time ?? fallbackEndTime ?? null,
      lineup: existing?.lineup || [],
    };
  });
}
