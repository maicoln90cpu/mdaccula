CREATE TABLE public.image_hashes (
  hash text PRIMARY KEY,
  url text NOT NULL,
  bucket text NOT NULL,
  file_size integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.image_hashes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage image_hashes"
  ON public.image_hashes FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Admins can view image_hashes"
  ON public.image_hashes FOR SELECT TO public
  USING (public.has_role(auth.uid(), 'admin'));
