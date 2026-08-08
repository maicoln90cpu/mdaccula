-- Item 5 da melhoria de disparo de e-mail — novo tipo de template dedicado
-- à automação "Lembrete de evento" (enviar X dias antes da data). Segue o
-- mesmo padrão da migration que adicionou 'ticket_batch_multi'
-- (20260724120000_email_templates_ticket_batch_multi_type.sql).
--
-- 'event_reminder' já era reconhecido como tipo de evento único em
-- src/lib/emailTemplates/dispatchEventDraft.ts (eventOnlyTemplateTypes) —
-- essa string só nunca tinha um template de verdade nem um jeito de criar
-- um pelo editor, porque o CHECK de email_templates.type não permitia.
ALTER TABLE public.email_templates DROP CONSTRAINT email_templates_type_check;
ALTER TABLE public.email_templates ADD CONSTRAINT email_templates_type_check
  CHECK (type = ANY (ARRAY[
    'event_new'::text, 'ticket_batch'::text, 'ticket_batch_multi'::text,
    'weekly_digest'::text, 'weekly_digest_editorial'::text,
    'weekend_agenda'::text, 'courtesy'::text, 'custom'::text, 'blog_digest'::text,
    'event_reminder'::text
  ]));

-- Semeia um template padrão pro tipo, seguindo o mesmo padrão idempotente
-- (só insere se ainda não existe nenhum template desse tipo — nunca
-- sobrescreve edição do admin). Blocos básicos de evento único: header,
-- hero, título, meta, descrição, CTA, footer.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.email_templates WHERE type = 'event_reminder') THEN
    INSERT INTO public.email_templates (name, type, subject_template, preheader_template, blocks, is_default)
    VALUES (
      'Lembrete de evento (padrão)',
      'event_reminder',
      '📅 Já reservou? {{event_title}} está chegando',
      '{{event_title}} em {{venue_name}} — {{date_label}}',
      '[
        {"id":"seed-er-1","kind":"header","logo_height":56},
        {"id":"seed-er-2","kind":"hero_image"},
        {"id":"seed-er-3","kind":"title","align":"center"},
        {"id":"seed-er-4","kind":"event_meta","layout":"columns"},
        {"id":"seed-er-5","kind":"description"},
        {"id":"seed-er-6","kind":"cta_button","url_field":"ticket_link"},
        {"id":"seed-er-7","kind":"footer","include_unsubscribe":true,"align":"center"}
      ]'::jsonb,
      true
    );
  END IF;
END $$;
