ALTER TABLE public.event_email_campaigns
  DROP CONSTRAINT event_email_campaigns_mode_check;

ALTER TABLE public.event_email_campaigns
  ADD CONSTRAINT event_email_campaigns_mode_check
  CHECK (mode IN ('draft', 'immediate', 'scheduled', 'manual'));