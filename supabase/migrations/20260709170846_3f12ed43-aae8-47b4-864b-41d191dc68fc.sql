
-- B.5.2: Semeia presets de template. Idempotente: só insere se o tipo ainda
-- não existe (evita sobrescrever templates que o admin já editou).

DO $$
DECLARE
  v_has_default BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.email_templates WHERE is_default = true) INTO v_has_default;

  -- Preset 1: Novo evento (vira padrão se ainda não houver)
  IF NOT EXISTS (SELECT 1 FROM public.email_templates WHERE type = 'event_new') THEN
    INSERT INTO public.email_templates (name, type, is_default, subject_template, preheader_template, blocks)
    VALUES (
      'Novo evento',
      'event_new',
      NOT v_has_default,
      '🎧 Novo evento: {{event_title}} — {{date_label}}',
      '{{event_title}} em {{venue_name}}, {{city_state}}. Ingressos abertos.',
      '[
        {"id":"seed-en-1","kind":"header","logo_height":64},
        {"id":"seed-en-2","kind":"hero_image"},
        {"id":"seed-en-3","kind":"eyebrow","text":"Novo evento confirmado"},
        {"id":"seed-en-4","kind":"title"},
        {"id":"seed-en-5","kind":"subtitle"},
        {"id":"seed-en-6","kind":"event_meta"},
        {"id":"seed-en-7","kind":"description"},
        {"id":"seed-en-8","kind":"article_summary"},
        {"id":"seed-en-9","kind":"cta_button","label":"Garantir ingresso","url_field":"ticket_link"},
        {"id":"seed-en-10","kind":"secondary_link","label":"Ver agenda completa","url_field":"agenda_url"},
        {"id":"seed-en-11","kind":"social_icons","networks":[
          {"id":"instagram","label":"Instagram","url":"","enabled":true},
          {"id":"youtube","label":"YouTube","url":"","enabled":true},
          {"id":"tiktok","label":"TikTok","url":"","enabled":false},
          {"id":"soundcloud","label":"SoundCloud","url":"","enabled":false},
          {"id":"spotify","label":"Spotify","url":"","enabled":false},
          {"id":"linktree","label":"Linktree","url":"","enabled":false}
        ]},
        {"id":"seed-en-12","kind":"footer","include_unsubscribe":true}
      ]'::jsonb
    );
  END IF;

  -- Preset 2: Virada de lote
  IF NOT EXISTS (SELECT 1 FROM public.email_templates WHERE type = 'ticket_batch') THEN
    INSERT INTO public.email_templates (name, type, subject_template, preheader_template, blocks)
    VALUES (
      'Virada de lote',
      'ticket_batch',
      '⏰ Últimas horas do lote — {{event_title}}',
      'O lote atual está acabando. Garanta antes da próxima virada de preço.',
      '[
        {"id":"seed-tb-1","kind":"header","logo_height":56},
        {"id":"seed-tb-2","kind":"image_with_link","image_url":"","link_url":"","alt":"Arte da virada de lote (opcional — preencha na hora do disparo)","max_width":552},
        {"id":"seed-tb-3","kind":"hero_image"},
        {"id":"seed-tb-4","kind":"eyebrow","text":"ÚLTIMAS HORAS · LOTE ATUAL"},
        {"id":"seed-tb-5","kind":"title"},
        {"id":"seed-tb-6","kind":"event_meta"},
        {"id":"seed-tb-7","kind":"text","html":"<p><strong>O lote atual está acabando.</strong> Garanta o seu antes da próxima virada de preço.</p>"},
        {"id":"seed-tb-8","kind":"cta_button","label":"Garantir ingresso agora","url_field":"ticket_link"},
        {"id":"seed-tb-9","kind":"divider"},
        {"id":"seed-tb-10","kind":"social_icons","networks":[
          {"id":"instagram","label":"Instagram","url":"","enabled":true},
          {"id":"youtube","label":"YouTube","url":"","enabled":true},
          {"id":"tiktok","label":"TikTok","url":"","enabled":false},
          {"id":"soundcloud","label":"SoundCloud","url":"","enabled":false},
          {"id":"spotify","label":"Spotify","url":"","enabled":false},
          {"id":"linktree","label":"Linktree","url":"","enabled":false}
        ]},
        {"id":"seed-tb-11","kind":"footer","include_unsubscribe":true}
      ]'::jsonb
    );
  END IF;

  -- Preset 3: Resumo semanal
  IF NOT EXISTS (SELECT 1 FROM public.email_templates WHERE type = 'weekly_digest') THEN
    INSERT INTO public.email_templates (name, type, subject_template, preheader_template, blocks)
    VALUES (
      'Resumo semanal',
      'weekly_digest',
      '📬 MDAccula desta semana',
      'Eventos, matérias e novidades da cena eletrônica em Cuiabá.',
      '[
        {"id":"seed-wd-1","kind":"header","logo_height":64},
        {"id":"seed-wd-2","kind":"eyebrow","text":"Resumo da semana · MDAccula"},
        {"id":"seed-wd-3","kind":"text","html":"<h2 style=\"color:#fff;font-size:22px;margin:0 0 12px 0;\">O que rolou (e o que vem por aí)</h2><p>Uma seleção rápida dos eventos, matérias e novidades da semana em Cuiabá.</p>"},
        {"id":"seed-wd-4","kind":"divider"},
        {"id":"seed-wd-5","kind":"text","html":"<p><strong>📅 Próximos eventos</strong><br>Adicione aqui os destaques (edição manual até B.7 automatizar).</p>"},
        {"id":"seed-wd-6","kind":"divider"},
        {"id":"seed-wd-7","kind":"text","html":"<p><strong>📰 Matérias em alta</strong><br>Cole links ou use blocos de imagem-com-link para destacar posts do blog.</p>"},
        {"id":"seed-wd-8","kind":"cta_button","label":"Ver tudo no site","url_field":"custom","custom_url":"https://mdaccula.com"},
        {"id":"seed-wd-9","kind":"social_icons","networks":[
          {"id":"instagram","label":"Instagram","url":"","enabled":true},
          {"id":"youtube","label":"YouTube","url":"","enabled":true},
          {"id":"tiktok","label":"TikTok","url":"","enabled":false},
          {"id":"soundcloud","label":"SoundCloud","url":"","enabled":false},
          {"id":"spotify","label":"Spotify","url":"","enabled":false},
          {"id":"linktree","label":"Linktree","url":"","enabled":false}
        ]},
        {"id":"seed-wd-10","kind":"footer","include_unsubscribe":true}
      ]'::jsonb
    );
  END IF;
END $$;
