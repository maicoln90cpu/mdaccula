// Helpers de data em PT-BR extraídos de generate-blog-post-v2/index.ts (Onda 22).
// Puros, sem dependências. Se editar, atualizar teste de regressão correspondente.

export const WEEKDAYS_PT = [
  'domingo',
  'segunda-feira',
  'terça-feira',
  'quarta-feira',
  'quinta-feira',
  'sexta-feira',
  'sábado',
];

export const MONTHS_PT = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

export function computeWeekday(dateStr: string): string {
  if (!dateStr || typeof dateStr !== 'string') return '';
  const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return '';
  const dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return WEEKDAYS_PT[dt.getDay()] || '';
}

export function computeDateFormatted(dateStr: string): string {
  const m = dateStr?.match?.(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return dateStr || '';
  const wd = computeWeekday(dateStr);
  return `${Number(m[3])} de ${MONTHS_PT[Number(m[2]) - 1]} de ${m[1]}${wd ? ` (${wd})` : ''}`;
}
