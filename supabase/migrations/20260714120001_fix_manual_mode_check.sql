-- Corrige "Marcar como enviado" no Controle Pessoal (aba do admin de e-mails),
-- que falhava com "violates check constraint event_email_campaigns_mode_check".
-- O fluxo manual (src/components/admin/EmailPersonalControl.tsx) grava
-- mode='manual' desde que foi criado, mas essa constraint nunca permitiu esse valor.

ALTER TABLE public.event_email_campaigns
  DROP CONSTRAINT event_email_campaigns_mode_check;

ALTER TABLE public.event_email_campaigns
  ADD CONSTRAINT event_email_campaigns_mode_check
  CHECK (mode IN ('draft', 'immediate', 'scheduled', 'manual'));
