-- R-084 — prevenção de regressão pro incidente de cleanup-storage-weekly /
-- cleanup-sync-logs-weekly (20/08/2026): os 2 crons mandavam header errado,
-- recebiam 401 toda semana desde maio, e ninguém percebeu porque o pg_cron
-- sempre marca `net.http_post` como "succeeded" (só confirma que a chamada
-- HTTP foi enfileirada, nunca o status da resposta real). Ver docs/PENDENCIAS.md.
--
-- Mecanismo: `authorizeAdminOrCron` (supabase/functions/_shared/index.ts)
-- agora grava um heartbeat em cron_job_health.last_success_at toda vez que
-- um cron passa no auth de verdade (header + secret corretos). A nova
-- function `cron-health-check` roda 1x/dia e compara esse carimbo com
-- `expected_max_gap_hours` — se algum job atrasar, manda e-mail e registra
-- em cron_health_alerts. Cobre só os jobs abaixo, que são os únicos crons
-- ativos hoje (conferido contra `cron.job`) que usam `authorizeAdminOrCron`
-- pra autenticação; outros crons têm auth inline própria (ex.:
-- egress-alert-cron, heal-stuck-email-dispatches) e não estão cobertos por
-- este mecanismo ainda.

CREATE TABLE IF NOT EXISTS public.cron_job_health (
  job_name text PRIMARY KEY,
  last_success_at timestamptz,
  expected_max_gap_hours numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cron_job_health ENABLE ROW LEVEL SECURITY;
-- Sem policies: só service role (usado pelas Edge Functions) lê/escreve,
-- mesmo padrão de internal_cron_secrets.

CREATE TABLE IF NOT EXISTS public.cron_health_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  stale_jobs jsonb NOT NULL,
  email_sent boolean NOT NULL DEFAULT false,
  email_error text
);

ALTER TABLE public.cron_health_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem ver alertas de saúde de cron"
  ON public.cron_health_alerts
  FOR SELECT
  USING (public.is_admin());

-- Seed: jobs ativos hoje (schedule real em cron.job) que usam
-- authorizeAdminOrCron. Gap = ~2-4x o intervalo do schedule + folga.
INSERT INTO public.cron_job_health (job_name, expected_max_gap_hours) VALUES
  ('auto_article_cron', 4),
  ('create_recurring_events_cron', 4),
  ('cleanup_storage_cron', 192),
  ('cleanup_sync_logs_cron', 192),
  ('daily_metrics_email_cron', 30),
  ('scan_event_sources_cron', 30),
  ('verify_sources_weekly_cron', 192)
ON CONFLICT (job_name) DO NOTHING;

INSERT INTO public.internal_cron_secrets (name, secret)
VALUES ('cron_health_check_cron', 'fQJ9uWsblplyyWEi9frzCuzqUht2kHvna7Vq8vBNTOI')
ON CONFLICT (name) DO UPDATE SET secret = EXCLUDED.secret, updated_at = now();

DO $$
DECLARE
  jid bigint;
BEGIN
  FOR jid IN SELECT jobid FROM cron.job WHERE jobname = 'cron-health-check-daily'
  LOOP
    PERFORM cron.unschedule(jid);
  END LOOP;
END $$;

SELECT cron.schedule(
  'cron-health-check-daily',
  '0 13 * * *',
  $cron$
  SELECT net.http_post(
    url:='https://xfvpuzlspvvsmmunznxw.supabase.co/functions/v1/cron-health-check',
    headers:=jsonb_build_object(
      'Content-Type','application/json',
      'x-cron-job','cron-health-check',
      'x-cron-secret','fQJ9uWsblplyyWEi9frzCuzqUht2kHvna7Vq8vBNTOI'
    ),
    body:=jsonb_build_object('source','pg_cron')
  ) AS request_id;
  $cron$
);
