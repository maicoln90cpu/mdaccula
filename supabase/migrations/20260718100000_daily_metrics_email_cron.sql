-- E-mail diário de métricas (08h BRT) para contato@mdaccula.com: cliques em
-- links/redirecionador, views de eventos/blog e compartilhamentos do dia
-- anterior, comparados com anteontem e com a média dos últimos 7 dias.

-- 1) Histórico de envios — mesmo padrão de egress_alerts (admin lê, service_role escreve).
CREATE TABLE public.daily_metrics_email_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  email_sent BOOLEAN NOT NULL DEFAULT false,
  email_error TEXT
);

GRANT SELECT ON public.daily_metrics_email_log TO authenticated;
GRANT ALL ON public.daily_metrics_email_log TO service_role;

ALTER TABLE public.daily_metrics_email_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view daily metrics email log"
  ON public.daily_metrics_email_log FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE INDEX idx_daily_metrics_email_log_sent_at ON public.daily_metrics_email_log(sent_at DESC);

-- 2) Segredo do cron + agendamento (padrão internal_cron_secrets + net.http_post).
INSERT INTO public.internal_cron_secrets (name, secret)
VALUES ('daily_metrics_email_cron', 'kEEp2IBwLTzhGLCQILipV1aAHWyO_8huqLgIssauOKE')
ON CONFLICT (name) DO UPDATE SET secret = EXCLUDED.secret, updated_at = now();

DO $$
DECLARE
  job_id bigint;
BEGIN
  FOR job_id IN SELECT jobid FROM cron.job WHERE jobname = 'daily-metrics-email-08h-brt'
  LOOP
    PERFORM cron.unschedule(job_id);
  END LOOP;
END $$;

SELECT cron.schedule(
  'daily-metrics-email-08h-brt',
  '0 11 * * *', -- 11:00 UTC = 08:00 BRT (Brasil sem horário de verão)
  $cron$
  SELECT net.http_post(
    url:='https://xfvpuzlspvvsmmunznxw.supabase.co/functions/v1/daily-metrics-email',
    headers:=jsonb_build_object(
      'Content-Type','application/json',
      'x-cron-job','daily-metrics-email',
      'x-cron-secret','kEEp2IBwLTzhGLCQILipV1aAHWyO_8huqLgIssauOKE'
    ),
    body:=jsonb_build_object('trigger','cron')
  ) as request_id;
  $cron$
);
