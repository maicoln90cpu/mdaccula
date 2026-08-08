/**
 * typeFilter — constantes e helpers para o Passo 1 (tipo de template).
 * Extraído do EmailTemplateEditor na Onda 12 sem alterações de valores.
 */
import type { Template } from '@/lib/emailTemplates/blocks';

export type TypeFilterKey =
  | 'event_new'
  | 'ticket_batch'
  | 'ticket_batch_multi'
  | 'weekend_agenda'
  | 'weekly_digest'
  | 'blog_digest'
  | 'event_reminder'
  | 'courtesy'
  | 'custom';

export const TYPE_FILTER_ORDER: TypeFilterKey[] = [
  'event_new',
  'ticket_batch',
  'ticket_batch_multi',
  'weekend_agenda',
  'weekly_digest',
  'blog_digest',
  'event_reminder',
  'courtesy',
  'custom',
];

export const TYPE_FILTER_LABELS: Record<TypeFilterKey, string> = {
  event_new: 'Evento',
  ticket_batch: 'Virada',
  ticket_batch_multi: 'Virada (multi)',
  weekend_agenda: 'Agenda FDS',
  weekly_digest: 'Digest',
  blog_digest: 'Blog news',
  event_reminder: 'Lembrete de evento',
  courtesy: 'Cortesia',
  custom: 'Custom',
};

export const TYPE_FILTER_STORAGE_KEY = 'mdaccula_email_editor_type';

/** weekly_digest_editorial é uma variação de weekly_digest para o filtro. */
export const normalizeType = (t: Template['type'] | undefined): TypeFilterKey => {
  if (!t) return 'custom';
  if (t === 'weekly_digest_editorial') return 'weekly_digest';
  return t as TypeFilterKey;
};
