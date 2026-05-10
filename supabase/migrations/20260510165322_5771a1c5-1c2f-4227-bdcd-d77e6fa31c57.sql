CREATE TABLE IF NOT EXISTS public.metrics_snapshots (
  day date PRIMARY KEY,
  supabase jsonb NOT NULL DEFAULT '{}'::jsonb,
  bunny jsonb NOT NULL DEFAULT '{}'::jsonb,
  captured_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.metrics_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view metrics_snapshots"
  ON public.metrics_snapshots FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role can manage metrics_snapshots"
  ON public.metrics_snapshots FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_metrics_snapshots_day_desc ON public.metrics_snapshots (day DESC);