/**
 * Helpers puros extraídos de src/pages/Eventos.tsx (Onda 17).
 * Sem dependência de estado React — apenas utilitários de data e filtragem.
 */
import { parseLocalDate } from '@/lib/utils';
import type { Event } from '@/types';

export const getEffectiveEventEndDate = (
  event: Pick<Event, 'date'> & { end_date?: string | null }
) => (event.end_date && event.end_date >= event.date ? event.end_date : event.date);

export const eventOccursOnDate = (
  event: Pick<Event, 'date'> & { end_date?: string | null },
  date: string
) => event.date <= date && date <= getEffectiveEventEndDate(event);

export const formatDateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

// Sexta a domingo do fim de semana mais próximo — se hoje já é sex/sáb/dom,
// usa o fim de semana em curso (a partir de hoje) em vez de pular pro próximo.
export const getThisWeekendDates = (): string[] => {
  const today = new Date();
  const day = today.getDay();
  const daysUntilFriday = day <= 5 ? 5 - day : 0;
  const friday = new Date(today);
  friday.setDate(today.getDate() + daysUntilFriday);

  return [0, 1, 2]
    .map((offset) => {
      const d = new Date(friday);
      d.setDate(friday.getDate() + offset);
      return formatDateKey(d);
    })
    .filter((dateKey) => dateKey >= formatDateKey(today));
};

export const formatEventDayShort = (dateStr: string) =>
  parseLocalDate(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

export const formatEventTime = (timeStr?: string | null) => {
  if (!timeStr) return 'Horário a confirmar';
  return timeStr.slice(0, 5);
};

export const computeEventDateCounts = (events: Event[]) => {
  const dateCount: Record<string, number> = {};

  events.forEach((event) => {
    const start = parseLocalDate(event.date);
    const end = parseLocalDate(getEffectiveEventEndDate(event));
    for (const day = new Date(start); day <= end; day.setDate(day.getDate() + 1)) {
      const date = formatDateKey(day);
      dateCount[date] = (dateCount[date] || 0) + 1;
    }
  });

  return Object.entries(dateCount)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => parseLocalDate(a.date).getTime() - parseLocalDate(b.date).getTime());
};

export const filterUpcomingEvents = (events: Event[]) => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return events
    .filter((event) => parseLocalDate(getEffectiveEventEndDate(event)) >= now)
    .sort((a, b) => parseLocalDate(a.date).getTime() - parseLocalDate(b.date).getTime());
};
