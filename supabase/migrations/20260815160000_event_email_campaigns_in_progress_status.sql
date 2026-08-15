-- R-062 — novo estado intermediário 'in_progress' em event_email_campaigns.
-- Grava a INTENÇÃO de disparo (linha em event_email_campaigns) ANTES de
-- chamar a E-goi, para que "claim setado em events.email_campaign_dispatched_at
-- sem nenhuma linha em event_email_campaigns" deixe de ser um estado
-- alcançável — mesmo quando a Edge Function morre sem lançar nenhuma exceção
-- JS (timeout de plataforma / abort de cliente), classe de falha que os
-- catches de R-055/R-057/R-058/R-059 não conseguem capturar. Ver R-062 em
-- docs/TESTING.md.
ALTER TABLE public.event_email_campaigns
  DROP CONSTRAINT event_email_campaigns_status_check;

ALTER TABLE public.event_email_campaigns
  ADD CONSTRAINT event_email_campaigns_status_check
  CHECK (status IN ('draft', 'scheduled', 'sent', 'failed', 'in_progress'));
