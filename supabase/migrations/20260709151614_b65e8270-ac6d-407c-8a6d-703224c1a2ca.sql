
CREATE TABLE public.egoi_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  list_id INTEGER NULL,
  sender_id INTEGER NULL,
  mode TEXT NOT NULL DEFAULT 'draft' CHECK (mode IN ('draft','immediate','scheduled')),
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  scheduled_days_before INTEGER NULL,
  singleton BOOLEAN NOT NULL DEFAULT true UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT egoi_config_singleton_true CHECK (singleton = true)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.egoi_config TO authenticated;
GRANT ALL ON public.egoi_config TO service_role;

ALTER TABLE public.egoi_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage egoi_config"
  ON public.egoi_config FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role manages egoi_config"
  ON public.egoi_config FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE TABLE public.event_email_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  egoi_campaign_id TEXT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','scheduled','sent','failed')),
  mode TEXT NOT NULL DEFAULT 'draft' CHECK (mode IN ('draft','immediate','scheduled')),
  error_message TEXT NULL,
  sent_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX event_email_campaigns_event_created_idx
  ON public.event_email_campaigns (event_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_email_campaigns TO authenticated;
GRANT ALL ON public.event_email_campaigns TO service_role;

ALTER TABLE public.event_email_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage event_email_campaigns"
  ON public.event_email_campaigns FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role manages event_email_campaigns"
  ON public.event_email_campaigns FOR ALL TO service_role
  USING (true) WITH CHECK (true);

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS email_campaign_dispatched_at TIMESTAMPTZ NULL;

CREATE TRIGGER update_egoi_config_updated_at
  BEFORE UPDATE ON public.egoi_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_event_email_campaigns_updated_at
  BEFORE UPDATE ON public.event_email_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.egoi_config (mode, is_enabled)
VALUES ('draft', false)
ON CONFLICT (singleton) DO NOTHING;

INSERT INTO public.site_settings (key, value)
VALUES ('egoi_email_enabled', 'false')
ON CONFLICT (key) DO NOTHING;
