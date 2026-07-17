-- Campo configurável de "tipo de botão" (CTA) por evento.
-- Substitui a inferência por substring de URL (ticket_link contendo
-- 'postcontrol.com.br/mdaccula/lista') usada até aqui só na página de
-- detalhe do evento, e que nunca era aplicada na Home nem no modal.
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS cta_type TEXT NOT NULL DEFAULT 'buy_ticket';

ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_cta_type_check;

ALTER TABLE public.events
  ADD CONSTRAINT events_cta_type_check
  CHECK (cta_type IN ('buy_ticket', 'buy_ticket_discount', 'guest_list', 'courtesy'));

-- Preserva o comportamento atual: eventos que hoje já se qualificam pela
-- regra antiga de "lista" (ex.: Dedge) migram automaticamente para guest_list.
UPDATE public.events
  SET cta_type = 'guest_list'
  WHERE ticket_link ILIKE '%postcontrol.com.br/mdaccula/lista%';
