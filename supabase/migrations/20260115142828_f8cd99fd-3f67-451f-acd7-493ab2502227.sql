-- Fix search_path for cleanup_old_logs function
CREATE OR REPLACE FUNCTION public.cleanup_old_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.application_logs 
  WHERE logged_at < NOW() - INTERVAL '30 days';
  
  DELETE FROM public.performance_metrics 
  WHERE measured_at < NOW() - INTERVAL '30 days';
END;
$$;