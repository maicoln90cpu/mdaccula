-- Novo tipo de template dedicado a promoção pontual de um evento específico
-- (ex.: "40% off só hoje"). Segue o mesmo padrão das migrations que
-- adicionaram 'ticket_batch_multi' e 'event_reminder'
-- (20260724120000_email_templates_ticket_batch_multi_type.sql e
-- 20260808121000_email_templates_event_reminder_type.sql).
--
-- Sem seed de template — diferente de 'event_reminder' (que não tinha preset
-- no editor), 'promo' já nasce com um preset em TEMPLATE_PRESETS
-- (src/lib/emailTemplates/presetsCatalog.ts, key 'event_promo'), então o
-- admin cria o template pelo próprio editor ("Novo → Criar a partir de
-- preset → Promoção").
ALTER TABLE public.email_templates DROP CONSTRAINT email_templates_type_check;
ALTER TABLE public.email_templates ADD CONSTRAINT email_templates_type_check
  CHECK (type = ANY (ARRAY[
    'event_new'::text, 'ticket_batch'::text, 'ticket_batch_multi'::text,
    'weekly_digest'::text, 'weekly_digest_editorial'::text,
    'weekend_agenda'::text, 'courtesy'::text, 'custom'::text, 'blog_digest'::text,
    'event_reminder'::text, 'promo'::text
  ]));
