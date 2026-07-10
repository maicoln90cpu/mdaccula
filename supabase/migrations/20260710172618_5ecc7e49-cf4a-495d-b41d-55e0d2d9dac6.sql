-- 1) Tabela de histórico de alertas
CREATE TABLE public.egress_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reason TEXT NOT NULL,
  api_path TEXT,
  source TEXT,
  window_bytes BIGINT NOT NULL DEFAULT 0,
  baseline_bytes BIGINT NOT NULL DEFAULT 0,
  ratio NUMERIC(10,2),
  threshold_mb INTEGER,
  email_sent BOOLEAN NOT NULL DEFAULT false,
  email_error TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.egress_alerts TO authenticated;
GRANT ALL ON public.egress_alerts TO service_role;

ALTER TABLE public.egress_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view egress alerts"
  ON public.egress_alerts FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE INDEX idx_egress_alerts_triggered ON public.egress_alerts(triggered_at DESC);

-- 2) Configurações em site_settings (chave/valor JSONB já existente)
INSERT INTO public.site_settings (key, value)
VALUES
  ('egress_alert_threshold_mb', '500'::jsonb),
  ('egress_alert_ratio', '2.0'::jsonb),
  ('egress_alert_email', '""'::jsonb),
  ('egress_alert_enabled', 'true'::jsonb)
ON CONFLICT (key) DO NOTHING;