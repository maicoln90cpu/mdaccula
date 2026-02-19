
-- Insert recurring_event_configs from CSV
INSERT INTO public.recurring_event_configs (id, name, title, weekday, venue, address, location_city, location_state, time, end_time, subtitle, description, genres, ticket_link, vip_link, image_url, enabled, created_at, updated_at, link_group_id) VALUES
  ('829766b5-539d-42ed-981a-0730c461e805', 'Moving', 'D.EDGE apres. Moving', 4, 'D.EDGE', 'D.Edge - Av. Mário Andrade, 141 - Barra Funda', 'São Paulo', 'SP', '23:59:00', '07:00:00', 
   '📄 Listas VIP Fem / Consuma Masc pelo link:', 'Serviço de valet na nova entrada do club', 
   ARRAY['Techno', 'Eletrônica'], 'bit.ly/MDAccula_DEdge_listas', 
   'https://api.whatsapp.com/send?phone=5511999136884&text=Olá%20MD', 
   'https://nzbyyuqvhrwatmydxiag.supabase.co/storage/v1/object/public/event-images/d-edge-default.png', 
   true, '2026-01-09T02:18:09.223989+00:00', '2026-02-18T16:16:00.278225+00:00', 'dd88fff8-b138-44a3-bcf4-1139823049ac'),

  ('fcb96e6f-f3b3-4d25-965b-2eabf20929cf', 'FreakChic', 'D.EDGE apres. FreakChic', 5, 'D.EDGE', 'D.Edge - Av. Mário Andrade, 141 - Barra Funda', 'São Paulo', 'SP', '23:59:00', '07:00:00', 
   '📄 Listas VIP Fem / Consuma Masc pelo link:', 'Serviço de valet na nova entrada do club', 
   ARRAY['Techno', 'Eletrônica'], 'bit.ly/MDAccula_DEdge_listas', 
   'https://api.whatsapp.com/send?phone=5511999136884&text=Olá%20MD', 
   'https://nzbyyuqvhrwatmydxiag.supabase.co/storage/v1/object/public/event-images/d-edge-default.png', 
   true, '2026-01-09T02:18:09.223989+00:00', '2026-02-18T16:16:00.278225+00:00', 'dd88fff8-b138-44a3-bcf4-1139823049ac'),

  ('0229446e-2228-4050-81c6-0d1f505d935f', 'Nave', 'D.EDGE apres. Nave', 6, 'D.EDGE', 'D.Edge - Av. Mário Andrade, 141 - Barra Funda', 'São Paulo', 'SP', '23:59:00', '12:00:00', 
   '📄 Listas VIP Fem / Consuma Masc pelo link:', 'Serviço de valet na nova entrada do club', 
   ARRAY['Techno', 'Eletrônica'], 'bit.ly/MDAccula_DEdge_listas', 
   'https://api.whatsapp.com/send?phone=5511999136884&text=Olá%20MD', 
   'https://nzbyyuqvhrwatmydxiag.supabase.co/storage/v1/object/public/event-images/d-edge-default.png', 
   true, '2026-01-09T02:18:09.223989+00:00', '2026-02-18T16:16:00.278225+00:00', 'dd88fff8-b138-44a3-bcf4-1139823049ac'),

  ('5398ad19-b068-4626-a7a2-e325c89bed6c', 'SuperAfter', 'D.EDGE apres. SuperAfter', 0, 'D.EDGE', 'D.Edge - Av. Mário Andrade, 141 - Barra Funda', 'São Paulo', 'SP', '05:00:00', '12:00:00', 
   '📄 Listas VIP Fem / Consuma Masc pelo link:', 'Serviço de valet na nova entrada do club', 
   ARRAY['Techno', 'Eletrônica'], 'bit.ly/MDAccula_DEdge_listas', 
   'https://api.whatsapp.com/send?phone=5511999136884&text=Olá%20MD', 
   'https://nzbyyuqvhrwatmydxiag.supabase.co/storage/v1/object/public/event-images/d-edge-default.png', 
   true, '2026-01-09T02:18:09.223989+00:00', '2026-02-18T16:16:00.278225+00:00', 'dd88fff8-b138-44a3-bcf4-1139823049ac')
ON CONFLICT (id) DO NOTHING;
