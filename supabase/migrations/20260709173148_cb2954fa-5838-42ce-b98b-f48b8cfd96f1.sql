-- Fase B.6: coluna toggle por evento e função helper de disparo condicional.
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS dispatch_email_on_save BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.events.dispatch_email_on_save IS
  'Quando true e o evento é salvo/ativado, o admin solicitou criar rascunho na E-goi. Não persiste como flag permanente; é apenas o intent do último submit.';

-- Reforça default do master switch (idempotente).
INSERT INTO public.site_settings (key, value)
VALUES ('egoi_email_enabled', 'false')
ON CONFLICT (key) DO NOTHING;