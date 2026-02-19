
-- Delete existing seed event_templates and insert real ones from CSV
DELETE FROM public.event_templates;

INSERT INTO public.event_templates (id, name, venue, address, location_city, location_state, genres, ticket_link, vip_link, image_url, created_at, updated_at, title, subtitle, time, description) VALUES
  ('992f343a-21ec-4874-b566-dbf473c7e9ca', 'Green Valley', 'Green Valley', 'Rua Antônio Lopes Gonçalves Bastos, 1083 - Bairro Rio Pequeno', 'Camboriú', 'SC', 
   ARRAY['House', 'Techno', 'Tech House', 'Deep House', 'Progressive', 'Eletrônica'], 
   NULL, 
   'https://api.whatsapp.com/send?phone=5511999136884&text=Ol%C3%A1%20MD%2C%20queria%20ver%20um%20camarote%20para%20GV%20apres.', 
   NULL, 
   '2025-12-02T13:21:23.462269+00:00', '2025-12-02T13:34:52.791888+00:00', 
   'GV apres.', '‼️ TEMOS COM DESCONTO VIA PIX!!', '22:00:00', 
   E'* ⁠Setores pista, área VIP e Backstage\n* Estacionamento no local'),

  ('24403160-1727-4303-9f94-5975f61d5ca5', 'Surreal', 'Surreal Park', '📍 Av. João da Costa, 3051 - Distrito Rio do Meio - Camboriú - SC', 'Camboriú', 'SC', 
   ARRAY['House', 'Deep House', 'Melodic', 'Tech House', 'Techno', 'Progressive'], 
   'bit.ly/MDAccula_Surreal25', 
   'https://api.whatsapp.com/send?phone=5511997819194&text=Ol%C3%A1%20Gui%2C%20queria%20ver%20um%20camarote%20para%20evento', 
   NULL, 
   '2025-11-20T11:58:01.591309+00:00', '2026-01-07T14:11:37.291332+00:00', 
   'Surreal apres.', '🎟️ Compre 5% OFF pelo link:', '23:00:00', 
   E'* Estacionamento no local\n* Setores pista e backstage\n* Serviço de chapelaria\n* Praça de alimentação'),

  ('44fd720f-2dcd-431d-8605-a7626576d403', 'Parador', 'Parador Maresias', 'Av. Dr. Francisco Loup, 357 - Praia de Maresias', 'São Sebastião', 'SP', 
   ARRAY['House', 'Tech House', 'Deep House', 'Eletrônica', 'EDM'], 
   NULL, 
   'https://api.whatsapp.com/send?phone=5511997819194&text=Ol%C3%A1%20Gui%2C%20queria%20ver%20um%20camarote%20para%20Parador%20apres.%20', 
   NULL, 
   '2025-11-20T11:58:01.591309+00:00', '2026-01-07T14:12:00.112208+00:00', 
   'Parador apres.', '🎟️ Compre 5% OFF pelo link:', '16:00:00', 
   '* Vendas área vip e pista');
