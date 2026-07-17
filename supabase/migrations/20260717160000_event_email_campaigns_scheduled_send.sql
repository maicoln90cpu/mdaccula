-- Agendamento de disparo (aba "Envio manual"): permite marcar uma campanha
-- de e-mail como 'scheduled' (valor já aceito pelo CHECK constraint desde a
-- criação da tabela, mas nunca usado até agora) e dispará-la depois via um
-- poller de cron (send-scheduled-email-campaigns), em vez de enviar na hora.

ALTER TABLE public.event_email_campaigns
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS scheduled_send_claimed_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS scheduled_send_attempts INTEGER NOT NULL DEFAULT 0;

-- Índice parcial usado pelo poller para achar rapidamente os disparos
-- vencidos e ainda não reivindicados por outra invocação concorrente.
CREATE INDEX IF NOT EXISTS event_email_campaigns_scheduled_due_idx
  ON public.event_email_campaigns (scheduled_at)
  WHERE status = 'scheduled' AND scheduled_send_claimed_at IS NULL;
