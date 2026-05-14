/**
 * Utilitários centralizados de data para garantir consistência de timezone
 * em todo o sistema MDAccula.
 * 
 * REGRA PRINCIPAL: Sempre usar parseLocalDate() ou parseLocalDateTime() 
 * em vez de new Date(string) para evitar problemas de timezone.
 */

import { parseLocalDate } from "@/lib/utils";

/**
 * Combina data e hora strings em um Date objeto local
 * Evita problemas de timezone ao não usar new Date(string)
 */
export function parseLocalDateTime(dateStr: string, timeStr: string | null | undefined): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  // Eventos com horário opcional: usa 00:00 quando não houver hora definida.
  const safeTime = (timeStr && timeStr.trim()) ? timeStr : '00:00';
  const [hours, minutes] = safeTime.split(':').map(Number);
  return new Date(year, month - 1, day, hours || 0, minutes || 0, 0);
}

/**
 * Formata data de evento com locale pt-BR
 * Usa parseLocalDate internamente para garantir consistência
 */
export function formatEventDate(
  dateStr: string, 
  options?: Intl.DateTimeFormatOptions
): string {
  const date = parseLocalDate(dateStr);
  return date.toLocaleDateString('pt-BR', options || {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

/**
 * Formata um intervalo de datas de evento (festivais multi-dias).
 * - Sem endDate ou endDate igual a startDate: "05 de junho de 2026"
 * - Mesmo mês/ano: "05–06 de junho de 2026"
 * - Mesmo ano, meses diferentes: "30 de maio – 02 de junho de 2026"
 * - Anos diferentes: "30 de dezembro de 2026 – 02 de janeiro de 2027"
 */
export function formatEventDateRange(
  startDate: string,
  endDate?: string | null
): string {
  const start = parseLocalDate(startDate);
  if (!endDate || endDate === startDate) {
    return start.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  }
  const end = parseLocalDate(endDate);
  const sameYear = start.getFullYear() === end.getFullYear();
  const sameMonth = sameYear && start.getMonth() === end.getMonth();

  if (sameMonth) {
    const dayStart = String(start.getDate()).padStart(2, '0');
    const dayEnd = String(end.getDate()).padStart(2, '0');
    const monthYear = end.toLocaleDateString('pt-BR', {
      month: 'long',
      year: 'numeric',
    });
    return `${dayStart}–${dayEnd} de ${monthYear}`;
  }

  if (sameYear) {
    const startFmt = start.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' });
    const endFmt = end.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
    return `${startFmt} – ${endFmt}`;
  }

  const startFmt = start.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  const endFmt = end.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  return `${startFmt} – ${endFmt}`;
}

/**
 * Formata data de evento com dia da semana
 */
export function formatEventDateLong(dateStr: string): string {
  const date = parseLocalDate(dateStr);
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    weekday: 'long'
  });
}

/**
 * Verifica se uma data (string YYYY-MM-DD) está no futuro
 */
export function isDateInFuture(dateStr: string): boolean {
  const eventDate = parseLocalDate(dateStr);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return eventDate >= now;
}

/**
 * Compara datas para ordenação
 * Retorna negativo se dateA < dateB, positivo se dateA > dateB
 */
export function compareDates(dateA: string, dateB: string): number {
  return parseLocalDate(dateA).getTime() - parseLocalDate(dateB).getTime();
}

/**
 * Retorna o dia do mês de uma data string
 */
export function getLocalDay(dateStr: string): number {
  return parseLocalDate(dateStr).getDate();
}

/**
 * Retorna o nome curto do mês de uma data string
 */
export function getLocalMonthShort(dateStr: string): string {
  return parseLocalDate(dateStr).toLocaleDateString('pt-BR', { month: 'short' });
}

// Re-export parseLocalDate for convenience
export { parseLocalDate } from "@/lib/utils";
