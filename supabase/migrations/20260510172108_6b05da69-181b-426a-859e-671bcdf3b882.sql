SELECT cron.schedule(
  'daily-metrics-snapshot',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://xfvpuzlspvvsmmunznxw.supabase.co/functions/v1/metrics-snapshot',
    headers := '{"content-type":"application/json","x-cron-secret":"meu-cron-mdaccula-2026-xK9pQ7vR2nL4mT8wB6yZ"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);