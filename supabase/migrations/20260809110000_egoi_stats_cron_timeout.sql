-- Bug real: net.http_post sem timeout_milliseconds explícito usa o padrão
-- de 5000ms do pg_net. egoi-campaign-stats (sync_all) chama a E-goi uma vez
-- por campanha enviada nos últimos 30 dias — com só 9 campanhas isso já
-- levou ~17s reais (confirmado ao vivo em 2026-08-09), sempre estourando o
-- timeout antes do cron completar. Resultado: event_email_campaign_stats
-- nunca era gravado, e o Dashboard sempre mostrava métricas zeradas.
-- Reagenda o job com timeout de 60s (a função também passou a buscar em
-- lotes de 4 em paralelo, então 60s cobre uma folga generosa mesmo com
-- crescimento no número de campanhas).
SELECT cron.unschedule('egoi-campaign-stats-sync-6h')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'egoi-campaign-stats-sync-6h');

SELECT cron.schedule(
  'egoi-campaign-stats-sync-6h',
  '0 */6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://xfvpuzlspvvsmmunznxw.supabase.co/functions/v1/egoi-campaign-stats',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT secret FROM public.internal_cron_secrets WHERE name = 'egoi_stats_cron'),
      'x-cron-job', 'egoi-campaign-stats-sync-6h'
    ),
    body := jsonb_build_object('sync_all', true),
    timeout_milliseconds := 60000
  ) AS request_id;
  $$
);
