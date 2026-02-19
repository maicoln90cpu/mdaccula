
-- Upsert site_settings from CSV backup
-- Uses ON CONFLICT on key (unique) to update existing or insert new

INSERT INTO public.site_settings (id, key, value, created_at, updated_at) VALUES
  ('0ad12025-22b6-4b6a-b64d-347f4d23be1d', 'newsletter_popup_enabled', 'false', '2025-11-15T13:28:12.98485+00:00', '2026-02-14T13:26:00.079735+00:00'),
  ('df96fea7-0d09-4679-8a37-f1b791917c74', 'spotify_playlist_id', '', '2025-11-09T21:07:13.685342+00:00', '2025-11-09T21:07:13.685342+00:00'),
  ('925078b1-a83c-4b91-875b-4fad0d0cbbda', 'ai_blog_model', 'openai/gpt-5-mini', '2025-11-24T21:07:05.995214+00:00', '2026-02-14T13:26:00.261476+00:00'),
  ('38d873e2-5f42-455c-977c-f3522eabb066', 'ai_temperature', '1.2', '2025-12-04T12:24:21.931247+00:00', '2026-02-14T13:26:00.452175+00:00'),
  ('5b438d2b-8ccc-4bd2-8343-f0ce03ad63a4', 'ai_history_limit', '20', '2025-12-04T12:24:22.329202+00:00', '2026-02-14T13:26:00.847286+00:00'),
  ('46e41df6-3963-4f7b-9eec-a48867228782', 'ai_auto_generate_enabled', 'true', '2025-12-04T12:24:22.530716+00:00', '2026-02-14T13:26:01.067914+00:00'),
  ('52236193-cf48-473f-8a96-4166f0b18491', 'links_page_avatar_url', 'https://nzbyyuqvhrwatmydxiag.supabase.co/storage/v1/object/public/link-thumbnails/avatar-1763512473337.webp', '2025-11-19T00:28:18.743754+00:00', '2025-12-10T14:29:57.662541+00:00'),
  ('dc4244ec-937e-4a7e-9bd5-79a6d2897a4e', 'links_page_handle', '@MDAccula', '2025-11-19T00:28:18.743754+00:00', '2025-12-10T14:29:57.869525+00:00'),
  ('86b6e7d1-538f-4fba-9bb5-db341d743553', 'links_page_theme', 'minimalBlack', '2025-11-19T00:28:18.743754+00:00', '2025-12-10T14:29:58.077883+00:00'),
  ('6c0389ef-9970-41de-a6e5-18a8d0dc9024', 'links_page_card_border', 'border-2 border-white shadow-[0_0_10px_rgba(255,255,255,0.3)]', '2025-11-19T23:30:41.50537+00:00', '2025-12-10T14:29:58.287645+00:00'),
  ('b4bc7a74-900f-4784-af88-568b4e1d3800', 'links_page_card_shadow', 'shadow-2xl hover:shadow-[0_20px_50px_rgba(0,0,0,0.5)]', '2025-11-19T23:30:41.722449+00:00', '2025-12-10T14:29:58.496218+00:00'),
  ('b095f966-13a5-41fa-bc3b-65b5c0fdaf62', 'links_page_card_roundedness', 'rounded-2xl', '2025-11-19T23:30:41.947584+00:00', '2025-12-10T14:29:58.72398+00:00'),
  ('f01740c9-cc28-4a11-8a65-9277e518d8e2', 'links_page_card_backdrop', 'backdrop-blur-lg', '2025-11-19T23:30:42.172326+00:00', '2025-12-10T14:29:58.934615+00:00'),
  ('2bec26a3-50c7-45e9-bdac-6180fa1ce710', 'links_page_card_hover', 'hover:scale-[1.02] hover:brightness-110', '2025-11-19T23:30:42.380905+00:00', '2025-12-10T14:29:59.163678+00:00'),
  ('837e71ed-ddd8-446b-8e57-271c03c1ce7d', 'ai_auto_generate_interval_hours', '48', '2025-12-04T12:24:22.727423+00:00', '2026-02-14T13:26:01.293769+00:00'),
  ('bdf12d14-64d9-41f5-9b29-2ebad4ea37d0', 'ai_max_article_length', '5000', '2025-12-04T12:24:22.947051+00:00', '2026-02-14T13:26:01.50828+00:00'),
  ('a5cd3654-d28e-4161-83be-50d6f4b90c93', 'ai_max_scrape_sources', '2', '2025-12-04T12:24:23.174249+00:00', '2026-02-14T13:26:01.727404+00:00'),
  ('8951e111-2a31-4d22-a527-3c22ca35327c', 'timezone_offset', '-3', '2025-12-06T01:06:32.533501+00:00', '2026-02-14T13:26:01.906192+00:00'),
  ('b43a9469-c571-4e0c-8c0a-459acb78b5f7', 'timezone_name', 'America/Sao_Paulo', '2025-12-06T01:06:32.761781+00:00', '2026-02-14T13:26:02.094471+00:00'),
  ('7017d97f-8907-4460-82e8-1696a6e83459', 'event_grace_hours', '1', '2025-12-06T01:06:32.980096+00:00', '2026-02-14T13:26:02.276672+00:00'),
  ('62173932-36ba-40cc-8b3c-6f24ebed3506', 'ai_auto_generate_last_run', '2026-02-19T00:00:04.282Z', '2025-12-09T16:03:12.074379+00:00', '2026-02-19T00:01:45.734741+00:00'),
  ('4b1c3b45-9a0f-4a47-b607-a2a8d3cf28e7', 'ai_auto_generate_fail_count', '0', '2026-01-17T13:19:39.259486+00:00', '2026-02-19T00:01:45.894032+00:00'),
  ('25263e3a-d804-4b5c-8d4b-665e65094791', 'google_tag_manager_id', 'GTM-TNV7648', '2025-11-04T18:28:45.604674+00:00', '2026-02-14T13:25:58.870339+00:00'),
  ('ea7714bd-39e4-4a6c-91f6-cd9cc3dcde31', 'whatsapp_number', '5511999136884', '2025-11-04T19:21:34.319324+00:00', '2026-02-14T13:25:59.101855+00:00'),
  ('fd33a2a3-c74f-465b-9daa-fe4826de488d', 'whatsapp_link', 'https://wa.me/5511999136884', '2025-11-04T19:21:34.319324+00:00', '2026-02-14T13:25:59.312048+00:00'),
  ('fa1ba7a9-1ad8-47f7-a196-1f190aa8aea5', 'instagram_link', 'https://instagram.com/mdaccula', '2025-11-04T19:21:34.319324+00:00', '2026-02-14T13:25:59.517576+00:00'),
  ('5f223d86-1b4d-4f59-b14a-b0d1b75c15c6', 'soundcloud_link', 'https://soundcloud.com/mdaccula', '2025-11-04T19:21:34.319324+00:00', '2026-02-14T13:25:59.71159+00:00'),
  ('c466c00a-f51e-4b9c-af9a-8f34c32c9c54', 'contact_email', 'contato@mdaccula.com', '2025-11-04T19:21:34.319324+00:00', '2026-02-14T13:25:59.893949+00:00'),
  ('11427132-c7cf-4bd4-8c72-bd01b8fc93a0', 'ai_image_prompt_template', E'Crie uma imagem artística e profissional para um artigo sobre: "{{title}}"\n\nREGRAS IMPORTANTES:\n1. Analise o título e identifique o TEMA PRINCIPAL (artista específico, festival, local, conceito)\n2. Use cores e atmosfera que combinem com o SENTIMENTO do título\n3. Se mencionar artista/DJ específico, capture a energia e estilo desse artista\n4. Se for sobre local específico (cidade, club), inclua elementos visuais reconhecíveis\n5. Se for conceitual (cultura, tecnologia, tendência), use metáforas visuais criativas\n\nESTILO: Fotorrealista com elementos artísticos, alta qualidade, cinematográfico, dramático, contrastante.\n\nEVITE SEMPRE: \n- Imagens genéricas de boates com luzes neon roxas\n- DJs genéricos com fones de ouvido\n- Multidões dançando genéricas\n- Padrões abstratos sem conexão com o título\n\nNÃO inclua texto, palavras ou números na imagem.', '2025-12-04T12:24:22.131293+00:00', '2026-02-14T13:26:00.644974+00:00'),
  ('f449886c-ae8f-479b-848f-63e9eeda459f', 'links_show_event_date', 'true', '2025-12-10T12:07:18.42285+00:00', '2026-02-14T13:26:02.462283+00:00'),
  ('ec74a05f-915b-4df7-9011-c156804b2a8f', 'links_page_card_default_height', '100', '2025-12-10T14:24:19.031248+00:00', '2025-12-10T14:27:35.983098+00:00'),
  ('e40515af-05e6-4195-9f01-7a09c9c66ff4', 'links_page_card_color', 'from-gray-900/90 to-black/90', '2025-12-10T14:12:47.637996+00:00', '2025-12-10T14:29:59.370351+00:00'),
  ('1f7eb020-72ce-4323-9a1a-fa06312d5cce', 'links_page_card_border_color', 'border-2 border-white/30', '2025-12-10T14:12:47.880723+00:00', '2025-12-10T14:29:59.578402+00:00')
ON CONFLICT (key) DO UPDATE SET
  id = EXCLUDED.id,
  value = EXCLUDED.value,
  created_at = EXCLUDED.created_at,
  updated_at = EXCLUDED.updated_at;
