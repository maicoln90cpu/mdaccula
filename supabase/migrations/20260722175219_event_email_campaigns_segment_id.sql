-- Persiste o segmento E-goi efetivamente usado em cada campanha, para que
-- o disparo manual possa sobrescrever o segmento global (egoi_config.segment_id)
-- por envio, e para que o poller de agendamento (send-scheduled-email-campaigns)
-- use o segmento escolhido no momento do agendamento em vez de reler o global.
ALTER TABLE public.event_email_campaigns ADD COLUMN IF NOT EXISTS segment_id INTEGER NULL;
