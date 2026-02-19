-- Adicionar novas configurações de redes sociais e contato
INSERT INTO site_settings (key, value) VALUES
  ('whatsapp_number', '5511999999999'),
  ('whatsapp_link', 'https://wa.me/5511999999999'),
  ('instagram_link', 'https://instagram.com/mdaccula'),
  ('soundcloud_link', 'https://soundcloud.com/mdaccula'),
  ('contact_email', 'contato@mdaccula.com')
ON CONFLICT (key) DO NOTHING;