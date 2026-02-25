
-- Criar cron job para limpeza diária de logs antigos (3h da manhã)
SELECT cron.schedule(
  'cleanup-old-logs-daily',
  '0 3 * * *',
  $$SELECT public.cleanup_old_logs();$$
);
