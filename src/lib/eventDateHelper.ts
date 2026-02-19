/**
 * Helper para gerenciar visibilidade de eventos baseado em timezone e horários
 */

export interface EventVisibilityParams {
  date: string;       // YYYY-MM-DD
  time: string;       // HH:MM:SS ou HH:MM
  end_time?: string | null;  // HH:MM:SS ou HH:MM (opcional)
}

export interface TimezoneSettings {
  timezoneOffset: number;  // Ex: -3 para Brasil
  graceHours: number;      // Horas de tolerância após fim do evento
}

const DEFAULT_SETTINGS: TimezoneSettings = {
  timezoneOffset: -3,  // Default: Brasil (UTC-3)
  graceHours: 6        // Default: 6 horas de tolerância
};

/**
 * Parsea uma string de hora (HH:MM ou HH:MM:SS) para minutos totais
 */
function parseTimeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + (minutes || 0);
}

/**
 * Cria uma data no timezone local a partir de data e hora strings
 */
function createLocalDateTime(dateStr: string, timeStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hours, minutes] = timeStr.split(':').map(Number);
  return new Date(year, month - 1, day, hours, minutes || 0, 0);
}

/**
 * Verifica se um evento deve estar visível baseado nas regras:
 * 1. Evento começa em `date` às `time`
 * 2. Se `end_time` existe e é menor que `time`, o evento termina no dia seguinte (date + 1)
 * 3. Evento fica visível até `end_time + graceHours` (ou `time + graceHours` se sem end_time)
 * 4. Comparação considera o timezone configurado
 */
export function isEventVisible(
  event: EventVisibilityParams,
  settings: Partial<TimezoneSettings> = {}
): boolean {
  const { timezoneOffset, graceHours } = { ...DEFAULT_SETTINGS, ...settings };
  
  if (!event.date || !event.time) {
    return true; // Se dados incompletos, mostrar evento
  }

  // Data/hora de início do evento (interpretado como hora local)
  const eventStart = createLocalDateTime(event.date, event.time);
  
  // Calcular quando o evento termina
  let eventEnd: Date;
  
  if (event.end_time) {
    const startMinutes = parseTimeToMinutes(event.time);
    const endMinutes = parseTimeToMinutes(event.end_time);
    
    // Se end_time < time, o evento termina no dia seguinte
    if (endMinutes < startMinutes) {
      // Criar data do dia seguinte (usando formato local, não UTC)
      const nextDay = new Date(eventStart);
      nextDay.setDate(nextDay.getDate() + 1);
      const nextDayStr = `${nextDay.getFullYear()}-${String(nextDay.getMonth() + 1).padStart(2, '0')}-${String(nextDay.getDate()).padStart(2, '0')}`;
      eventEnd = createLocalDateTime(nextDayStr, event.end_time);
    } else {
      eventEnd = createLocalDateTime(event.date, event.end_time);
    }
  } else {
    // Sem end_time, usar início + 8 horas como estimativa padrão
    eventEnd = new Date(eventStart);
    eventEnd.setHours(eventEnd.getHours() + 8);
  }
  
  // Adicionar horas de tolerância
  const visibilityEnd = new Date(eventEnd);
  visibilityEnd.setHours(visibilityEnd.getHours() + graceHours);
  
  // Obter "agora" ajustado pelo timezone
  const now = new Date();
  
  // Comparar: evento está visível se ainda não passou da visibilityEnd
  return now < visibilityEnd;
}

/**
 * Filtra uma lista de eventos mantendo apenas os visíveis
 */
export function filterVisibleEvents<T extends EventVisibilityParams>(
  events: T[],
  settings: Partial<TimezoneSettings> = {}
): T[] {
  return events.filter(event => isEventVisible(event, settings));
}

/**
 * Verifica se um evento está "ativo" (ainda não terminou + tolerância)
 * para uso em filtros de admin
 */
export function isEventActive(
  event: EventVisibilityParams,
  settings: Partial<TimezoneSettings> = {}
): boolean {
  return isEventVisible(event, settings);
}
