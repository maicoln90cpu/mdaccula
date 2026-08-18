import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Mesma normalização de slug já usada em useEventFormSubmit.tsx — extraída
 * aqui pra ser reaproveitada por outros criadores de evento (ex.: o
 * card-vitrine de uma mesclagem).
 */
export function generateSlugFromTitle(title: string): string {
  const base = title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9_]+/g, '-')
    .replace(/(^-|-$)/g, '');
  const timestamp = Date.now().toString().slice(-6);
  return `${base}-${timestamp}`;
}
