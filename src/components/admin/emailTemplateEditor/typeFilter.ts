/**
 * typeFilter — constantes e helpers para o Passo 1 (tipo de template).
 * Extraído do EmailTemplateEditor na Onda 12 sem alterações de valores.
 */
import type { Template } from '@/lib/emailTemplates/blocks';
import { EMAIL_TYPE_LABELS } from '@/lib/emailTemplates/typeLabels';

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

// Rótulos vêm de uma fonte única compartilhada com o Dashboard
// (EMAIL_TYPE_LABELS) — antes "Digest" (aqui) e "Digest semanal" (Dashboard)
// já tinham divergido pro mesmo conceito.
export const TYPE_FILTER_LABELS: Record<TypeFilterKey, string> = {
  event_new: EMAIL_TYPE_LABELS.event_new,
  ticket_batch: EMAIL_TYPE_LABELS.ticket_batch,
  ticket_batch_multi: EMAIL_TYPE_LABELS.ticket_batch_multi,
  weekend_agenda: EMAIL_TYPE_LABELS.weekend_agenda,
  weekly_digest: EMAIL_TYPE_LABELS.weekly_digest,
  blog_digest: EMAIL_TYPE_LABELS.blog_digest,
  event_reminder: EMAIL_TYPE_LABELS.event_reminder,
  courtesy: EMAIL_TYPE_LABELS.courtesy,
  custom: EMAIL_TYPE_LABELS.custom,
};

export const TYPE_FILTER_STORAGE_KEY = 'mdaccula_email_editor_type';

/** weekly_digest_editorial é uma variação de weekly_digest para o filtro. */
export const normalizeType = (t: Template['type'] | undefined): TypeFilterKey => {
  if (!t) return 'custom';
  if (t === 'weekly_digest_editorial') return 'weekly_digest';
  return t as TypeFilterKey;
};
