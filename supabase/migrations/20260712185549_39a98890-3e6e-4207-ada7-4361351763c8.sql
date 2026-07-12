
-- 1) Amplia o CHECK do tipo para incluir blog_digest
ALTER TABLE public.email_templates DROP CONSTRAINT IF EXISTS email_templates_type_check;
ALTER TABLE public.email_templates ADD CONSTRAINT email_templates_type_check
  CHECK (type = ANY (ARRAY[
    'event_new'::text, 'ticket_batch'::text,
    'weekly_digest'::text, 'weekly_digest_editorial'::text,
    'weekend_agenda'::text, 'courtesy'::text, 'custom'::text,
    'blog_digest'::text
  ]));

-- 2) Seed: template blog_digest — Cards (padrão)
INSERT INTO public.email_templates (name, type, is_default, subject_template, preheader_template, blocks)
SELECT
  'Blog news — Cards',
  'blog_digest',
  true,
  '📰 Novidades do blog — {{range_label}}',
  'As matérias mais lidas da semana no MDAccula.',
  jsonb_build_array(
    jsonb_build_object('id', gen_random_uuid()::text, 'kind', 'header', 'logo_height', 60),
    jsonb_build_object('id', gen_random_uuid()::text, 'kind', 'eyebrow', 'text', 'NOVIDADES DO BLOG', 'align', 'center'),
    jsonb_build_object('id', gen_random_uuid()::text, 'kind', 'text',
      'html', '<h1 style="color:#fff;font-size:30px;font-weight:900;margin:6px 0 4px 0;letter-spacing:-0.02em;text-align:center;">O que rolou no blog</h1><p style="color:#a1a1aa;font-size:14px;margin:0;text-align:center;">Uma seleção das matérias da semana em São Paulo.</p>',
      'align', 'center'),
    jsonb_build_object('id', gen_random_uuid()::text, 'kind', 'divider'),
    jsonb_build_object('id', gen_random_uuid()::text, 'kind', 'blog_posts_list',
      'title', 'Matérias em destaque',
      'eyebrow', 'DA SEMANA',
      'max_items', 10, 'layout', 'list',
      'show_excerpt', true, 'show_category', true),
    jsonb_build_object('id', gen_random_uuid()::text, 'kind', 'divider'),
    jsonb_build_object('id', gen_random_uuid()::text, 'kind', 'cta_button',
      'label', 'Ver todas as matérias',
      'url_field', 'custom',
      'custom_url', 'https://mdaccula.com/blog',
      'align', 'center'),
    jsonb_build_object('id', gen_random_uuid()::text, 'kind', 'social_icons',
      'networks', jsonb_build_array(
        jsonb_build_object('id', 'instagram', 'label', 'Instagram', 'url', 'https://instagram.com/mdaccula', 'enabled', true),
        jsonb_build_object('id', 'youtube',   'label', 'YouTube',   'url', 'https://youtube.com/@mdaccula',   'enabled', true),
        jsonb_build_object('id', 'tiktok',    'label', 'TikTok',    'url', '', 'enabled', false)
      )),
    jsonb_build_object('id', gen_random_uuid()::text, 'kind', 'footer', 'include_unsubscribe', true)
  )
WHERE NOT EXISTS (
  SELECT 1 FROM public.email_templates WHERE type = 'blog_digest' AND name = 'Blog news — Cards'
);

-- 3) Seed: template blog_digest — Editorial (não default)
INSERT INTO public.email_templates (name, type, is_default, subject_template, preheader_template, blocks)
SELECT
  'Blog news — Editorial',
  'blog_digest',
  false,
  '📖 Leituras da semana — {{range_label}}',
  'Uma curadoria editorial das matérias mais lidas em São Paulo.',
  jsonb_build_array(
    jsonb_build_object('id', gen_random_uuid()::text, 'kind', 'header', 'logo_height', 52, 'align', 'left'),
    jsonb_build_object('id', gen_random_uuid()::text, 'kind', 'eyebrow', 'text', 'EDITORIAL · BLOG MDACCULA', 'align', 'left'),
    jsonb_build_object('id', gen_random_uuid()::text, 'kind', 'text',
      'html', '<h1 style="color:#fff;font-size:34px;font-weight:900;margin:6px 0 8px 0;letter-spacing:-0.02em;line-height:1.1;">Leituras da semana.</h1><p style="color:#a1a1aa;font-size:15px;line-height:1.6;margin:0;">Curadoria enxuta das matérias que valem seu tempo — a cena eletrônica contada pelo MDAccula.</p>',
      'align', 'left'),
    jsonb_build_object('id', gen_random_uuid()::text, 'kind', 'divider'),
    jsonb_build_object('id', gen_random_uuid()::text, 'kind', 'blog_posts_list',
      'title', '',
      'eyebrow', 'MATÉRIAS EM ALTA',
      'max_items', 8, 'layout', 'list',
      'show_excerpt', true, 'show_category', true, 'align', 'left'),
    jsonb_build_object('id', gen_random_uuid()::text, 'kind', 'divider'),
    jsonb_build_object('id', gen_random_uuid()::text, 'kind', 'cta_button',
      'label', 'Ler todas no blog',
      'url_field', 'custom',
      'custom_url', 'https://mdaccula.com/blog',
      'align', 'center'),
    jsonb_build_object('id', gen_random_uuid()::text, 'kind', 'social_icons',
      'networks', jsonb_build_array(
        jsonb_build_object('id', 'instagram', 'label', 'Instagram', 'url', 'https://instagram.com/mdaccula', 'enabled', true),
        jsonb_build_object('id', 'youtube',   'label', 'YouTube',   'url', 'https://youtube.com/@mdaccula',   'enabled', true)
      )),
    jsonb_build_object('id', gen_random_uuid()::text, 'kind', 'footer', 'include_unsubscribe', true, 'align', 'center')
  )
WHERE NOT EXISTS (
  SELECT 1 FROM public.email_templates WHERE type = 'blog_digest' AND name = 'Blog news — Editorial'
);
