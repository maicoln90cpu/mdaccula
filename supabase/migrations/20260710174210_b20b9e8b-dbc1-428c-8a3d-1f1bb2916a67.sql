CREATE TABLE public.email_global_blocks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'geral',
  block JSONB NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_global_blocks TO authenticated;
GRANT ALL ON public.email_global_blocks TO service_role;

ALTER TABLE public.email_global_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read global blocks"
  ON public.email_global_blocks FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins manage global blocks"
  ON public.email_global_blocks FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_email_global_blocks_updated_at
  BEFORE UPDATE ON public.email_global_blocks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_email_global_blocks_category ON public.email_global_blocks(category);
