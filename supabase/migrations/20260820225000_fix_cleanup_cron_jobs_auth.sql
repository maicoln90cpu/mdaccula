-- Corrige cleanup-storage-weekly e cleanup-sync-logs-weekly: os 2 jobs foram
-- criados (20260510130630) mandando só "Authorization: Bearer <anon key>",
-- mas as 2 Edge Functions exigem authorizeAdminOrCron (x-cron-secret +
-- x-cron-job batendo com internal_cron_secrets, ou sessão de admin real) —
-- a anon key não satisfaz nenhum dos dois. Resultado: as 2 chamadas semanais
-- vinham recebendo 401 desde a criação (confirmado em function_edge_logs pra
-- todas as execuções desde 05/2026), sem nenhum alerta, porque net.http_post
-- sempre reporta "succeeded" no pg_cron mesmo quando a resposta HTTP é erro
-- (só enfileira a chamada assíncrona). Ver docs/PENDENCIAS.md.
-- Mesmo padrão de segredo/cron dos outros crons internos (ex.:
-- 20260815160500_heal_stuck_email_dispatches_cron.sql).

INSERT INTO public.internal_cron_secrets (name, secret)
VALUES
  ('cleanup_storage_cron', 'vlCt8TrzL4f60hWapQLIHXMLnmvdwJiWYmx1FZcqKzo'),
  ('cleanup_sync_logs_cron', 'UBqJuYszEYq2q7HwGB6dtMDZe0bziFtDGi6ViHojTyK')
ON CONFLICT (name) DO UPDATE SET secret = EXCLUDED.secret, updated_at = now();

DO $$
DECLARE
  jid bigint;
BEGIN
  FOR jid IN SELECT jobid FROM cron.job WHERE jobname IN ('cleanup-storage-weekly', 'cleanup-sync-logs-weekly')
  LOOP
    PERFORM cron.unschedule(jid);
  END LOOP;
END $$;

SELECT cron.schedule(
  'cleanup-storage-weekly',
  '0 4 * * 0',
  $cron$
  SELECT net.http_post(
    url:='https://xfvpuzlspvvsmmunznxw.supabase.co/functions/v1/cleanup-storage',
    headers:=jsonb_build_object(
      'Content-Type','application/json',
      'x-cron-job','cleanup-storage',
      'x-cron-secret','vlCt8TrzL4f60hWapQLIHXMLnmvdwJiWYmx1FZcqKzo'
    ),
    body:=jsonb_build_object('source','pg_cron')
  ) AS request_id;
  $cron$
);

SELECT cron.schedule(
  'cleanup-sync-logs-weekly',
  '15 4 * * 0',
  $cron$
  SELECT net.http_post(
    url:='https://xfvpuzlspvvsmmunznxw.supabase.co/functions/v1/cleanup-sync-logs',
    headers:=jsonb_build_object(
      'Content-Type','application/json',
      'x-cron-job','cleanup-sync-logs',
      'x-cron-secret','UBqJuYszEYq2q7HwGB6dtMDZe0bziFtDGi6ViHojTyK'
    ),
    body:=jsonb_build_object('source','pg_cron')
  ) AS request_id;
  $cron$
);
