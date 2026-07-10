
ALTER TABLE public.event_email_campaigns
  ADD COLUMN IF NOT EXISTS campaign_type text NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS ab_group_id uuid NULL,
  ADD COLUMN IF NOT EXISTS ab_variant text NULL,
  ADD COLUMN IF NOT EXISTS ab_test_config jsonb NULL;

CREATE INDEX IF NOT EXISTS event_email_campaigns_ab_group_idx
  ON public.event_email_campaigns (ab_group_id)
  WHERE ab_group_id IS NOT NULL;

COMMENT ON COLUMN public.event_email_campaigns.campaign_type IS
  'standard | ticket_batch | weekly_digest | ab_subject';
COMMENT ON COLUMN public.event_email_campaigns.ab_variant IS
  'A ou B (apenas para campaign_type = ab_subject)';
