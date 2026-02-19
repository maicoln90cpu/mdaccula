-- Criar tabela de logs de sincronização
CREATE TABLE IF NOT EXISTS public.sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('running', 'success', 'warning', 'failed')),
  triggered_by TEXT, -- 'cron', 'manual', user_id
  
  -- Métricas
  tables_synced JSONB DEFAULT '[]'::jsonb,
  total_records INTEGER DEFAULT 0,
  storage_files_synced INTEGER DEFAULT 0,
  
  -- Erros e avisos
  errors JSONB DEFAULT '[]'::jsonb,
  warnings JSONB DEFAULT '[]'::jsonb,
  
  -- Performance
  duration_seconds INTEGER,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX idx_sync_logs_started_at ON public.sync_logs(started_at DESC);
CREATE INDEX idx_sync_logs_status ON public.sync_logs(status);

-- RLS
ALTER TABLE public.sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view sync logs"
  ON public.sync_logs FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can insert sync logs"
  ON public.sync_logs FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can update sync logs"
  ON public.sync_logs FOR UPDATE
  USING (true);