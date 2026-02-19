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
export function parseLocalDateTime(dateStr: string, timeStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hours, minutes] = timeStr.split(':').map(Number);
  return new Date(year, month - 1, day, hours, minutes || 0, 0);
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
