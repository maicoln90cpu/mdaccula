ALTER TABLE public.email_templates DROP CONSTRAINT IF EXISTS email_templates_type_check;
ALTER TABLE public.email_templates ADD CONSTRAINT email_templates_type_check
  CHECK (type IN ('event_new','ticket_batch','weekly_digest','weekly_digest_editorial','weekend_agenda','courtesy','custom'));