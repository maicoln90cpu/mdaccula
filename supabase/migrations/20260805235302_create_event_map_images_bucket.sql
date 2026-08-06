-- Bucket de fallback (Supabase Storage) para imagens de mapa estático de
-- evento. Serve como segunda fonte de verdade quando o Bunny CDN não
-- confirma a existência do arquivo cacheado, evitando re-chamar a API do
-- Google Maps por causa de um hiccup do Bunny.
INSERT INTO storage.buckets (id, name, public)
VALUES ('event-map-images', 'event-map-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public can view event map images"
ON storage.objects FOR SELECT
USING (bucket_id = 'event-map-images');

CREATE POLICY "Admins can upload event map images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'event-map-images' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update event map images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'event-map-images' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete event map images"
ON storage.objects FOR DELETE
USING (bucket_id = 'event-map-images' AND has_role(auth.uid(), 'admin'::app_role));
