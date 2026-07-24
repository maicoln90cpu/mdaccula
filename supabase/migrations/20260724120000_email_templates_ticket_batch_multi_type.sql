-- Permite o novo tipo de template "Virada de lote (múltiplos eventos)" —
-- e-mail único com grid de 2 colunas cobrindo vários eventos que viram de
-- lote no mesmo dia, em vez de um e-mail por evento.
ALTER TABLE public.email_templates DROP CONSTRAINT email_templates_type_check;
ALTER TABLE public.email_templates ADD CONSTRAINT email_templates_type_check
  CHECK (type = ANY (ARRAY[
    'event_new'::text, 'ticket_batch'::text, 'ticket_batch_multi'::text,
    'weekly_digest'::text, 'weekly_digest_editorial'::text,
    'weekend_agenda'::text, 'courtesy'::text, 'custom'::text, 'blog_digest'::text
  ]));
