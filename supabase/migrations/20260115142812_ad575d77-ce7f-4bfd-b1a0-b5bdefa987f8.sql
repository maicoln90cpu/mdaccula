-- Create table for application logs
CREATE TABLE public.application_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  level TEXT NOT NULL CHECK (level IN ('debug', 'info', 'warn', 'error')),
  message TEXT NOT NULL,
  context JSONB DEFAULT '{}',
  error_message TEXT,
  session_id TEXT,
  user_agent TEXT,
  logged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create table for performance metrics
CREATE TABLE public.performance_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  duration_ms INTEGER NOT NULL,
  context JSONB DEFAULT '{}',
  session_id TEXT,
  measured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.application_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_metrics ENABLE ROW LEVEL SECURITY;

-- Policies for application_logs (only service role can insert, admins can read)
CREATE POLICY "Service role can insert logs"
ON public.application_logs
FOR INSERT
TO service_role
WITH CHECK (true);

CREATE POLICY "Admins can read logs"
ON public.application_logs
FOR SELECT
USING (public.is_admin());

-- Policies for performance_metrics (only service role can insert, admins can read)
CREATE POLICY "Service role can insert metrics"
ON public.performance_metrics
FOR INSERT
TO service_role
WITH CHECK (true);

CREATE POLICY "Admins can read metrics"
ON public.performance_metrics
FOR SELECT
USING (public.is_admin());

-- Indexes for efficient querying
CREATE INDEX idx_application_logs_level ON public.application_logs(level);
CREATE INDEX idx_application_logs_logged_at ON public.application_logs(logged_at DESC);
CREATE INDEX idx_application_logs_session ON public.application_logs(session_id);

CREATE INDEX idx_performance_metrics_name ON public.performance_metrics(name);
CREATE INDEX idx_performance_metrics_duration ON public.performance_metrics(duration_ms DESC);
CREATE INDEX idx_performance_metrics_measured_at ON public.performance_metrics(measured_at DESC);

-- Create cleanup function to remove old logs (older than 30 days)
CREATE OR REPLACE FUNCTION public.cleanup_old_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.application_logs 
  WHERE logged_at < NOW() - INTERVAL '30 days';
  
  DELETE FROM public.performance_metrics 
  WHERE measured_at < NOW() - INTERVAL '30 days';
END;
$$;