
-- Semeia o preset "Virada de lote — múltiplos eventos" (ticket_batch_multi),
-- seguindo o mesmo padrão idempotente da migration
-- 20260709170846_3f12ed43-aae8-47b4-864b-41d191dc68fc.sql (só insere se o
-- tipo ainda não existe — nunca sobrescreve um template que o admin já
-- editou). Blocos espelham buildPresetBlocks('ticket_batch_multi') em
-- src/lib/emailTemplates/blocks.ts: header, eyebrow, title, event_grid
-- (grid de 2 colunas), divider, social_icons, footer.
--
-- Antes desta migration só existia o template "Virada de lote" (1 evento,
-- type = 'ticket_batch'); agora o sistema passa a ter os 2 templates de
-- virada lado a lado no seletor de tipo do editor.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.email_templates WHERE type = 'ticket_batch_multi') THEN
    INSERT INTO public.email_templates (name, type, subject_template, preheader_template, blocks)
    VALUES (
      'Virada de lote — múltiplos eventos',
      'ticket_batch_multi',
      '⏰ {{event_title}}',
      'O lote atual está acabando em vários eventos. Garanta antes da próxima virada de preço.',
      '[
        {"id":"seed-tbm-1","kind":"header","logo_height":56},
        {"id":"seed-tbm-2","kind":"eyebrow","text":"ÚLTIMAS HORAS · VIRADA DE LOTE","align":"center"},
        {"id":"seed-tbm-3","kind":"title","align":"center"},
        {"id":"seed-tbm-4","kind":"event_grid","eyebrow":"","title":""},
        {"id":"seed-tbm-5","kind":"divider"},
        {"id":"seed-tbm-6","kind":"social_icons","align":"center","networks":[
          {"id":"instagram","label":"Instagram","url":"","enabled":true},
          {"id":"youtube","label":"YouTube","url":"","enabled":true},
          {"id":"tiktok","label":"TikTok","url":"","enabled":false},
          {"id":"soundcloud","label":"SoundCloud","url":"","enabled":false},
          {"id":"spotify","label":"Spotify","url":"","enabled":false},
          {"id":"linktree","label":"Linktree","url":"","enabled":false}
        ]},
        {"id":"seed-tbm-7","kind":"footer","include_unsubscribe":true,"align":"center"}
      ]'::jsonb
    );
  END IF;
END $$;
