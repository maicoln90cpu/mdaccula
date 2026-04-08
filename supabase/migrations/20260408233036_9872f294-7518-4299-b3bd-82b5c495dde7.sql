
-- Tabela para armazenar métricas de egress agregadas por hora
CREATE TABLE public.egress_metrics (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  period_start timestamptz NOT NULL,
  api_path text NOT NULL,
  source text NOT NULL DEFAULT 'sw',
  cache_hits integer NOT NULL DEFAULT 0,
  cache_misses integer NOT NULL DEFAULT 0,
  egress_bytes bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Índice único para upsert eficiente (somar valores para mesmo período/path/source)
CREATE UNIQUE INDEX idx_egress_metrics_unique ON public.egress_metrics (period_start, api_path, source);

-- Índice para queries do dashboard (filtrar por período)
CREATE INDEX idx_egress_metrics_period ON public.egress_metrics (period_start DESC);

-- Habilitar RLS
ALTER TABLE public.egress_metrics ENABLE ROW LEVEL SECURITY;

-- Qualquer visitante pode enviar métricas (anônimo)
CREATE POLICY "Anyone can insert egress metrics"
ON public.egress_metrics
FOR INSERT
TO public
WITH CHECK (true);

-- Apenas admins podem visualizar
CREATE POLICY "Admins can view egress metrics"
ON public.egress_metrics
FOR SELECT
TO public
USING (is_admin());

-- Service role tem acesso total
CREATE POLICY "Service role can manage egress_metrics"
ON public.egress_metrics
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Função para limpar métricas com mais de 90 dias
CREATE OR REPLACE FUNCTION public.cleanup_old_egress()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.egress_metrics WHERE period_start < NOW() - INTERVAL '90 days';
END;
$$;
