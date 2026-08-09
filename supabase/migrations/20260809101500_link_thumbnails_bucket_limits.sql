-- Auditoria da rota de Gestão de E-mails (agosto/2026): o upload de logo do
-- template de e-mail (TemplateBrandTab) só era validado no cliente
-- (tamanho/tipo do <input>) — nada impedia um cliente HTTP customizado (com
-- token de admin válido) de subir um arquivo arbitrário direto pro Storage,
-- que fica publicamente acessível pela URL. O bucket "link-thumbnails" é
-- compartilhado por várias features (logo de e-mail, thumbnail de link
-- custom, arte de virada de lote); o maior limite já usado no cliente hoje
-- é 2MB (CustomLinkForm/useManualBatch), então 3MB dá folga sem afrouxar a
-- proteção. Tipos permitidos cobrem todo `accept=` já usado nesses fluxos.
UPDATE storage.buckets
SET
  file_size_limit = 3145728, -- 3 MB
  allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/gif']
WHERE id = 'link-thumbnails';
