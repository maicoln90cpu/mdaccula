-- Adicionar configurações para a página de links personalizada
INSERT INTO site_settings (key, value) VALUES
  ('links_page_avatar_url', NULL),
  ('links_page_handle', '@MDAccula'),
  ('links_page_theme', 'sunset')
ON CONFLICT (key) DO NOTHING;