-- Update cleanup_old_logs to use 7 days instead of 30
CREATE OR REPLACE FUNCTION public.cleanup_old_logs()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  DELETE FROM public.application_logs 
  WHERE logged_at < NOW() - INTERVAL '7 days';
  
  DELETE FROM public.performance_metrics 
  WHERE measured_at < NOW() - INTERVAL '7 days';
END;
$function$;