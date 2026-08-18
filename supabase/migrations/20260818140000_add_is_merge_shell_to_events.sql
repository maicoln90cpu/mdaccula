-- "Card-vitrine": evento criado pela mesclagem de outros. Nunca é um dos
-- eventos originais mutado — é sempre um evento NOVO, marcado por esta
-- coluna. Eventos absorvidos continuam usando merged_into_id/status
-- (já existentes) apontando pra ele, sem nenhum dado próprio alterado.
ALTER TABLE public.events
  ADD COLUMN is_merge_shell BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_events_merged_into_id
  ON public.events(merged_into_id)
  WHERE merged_into_id IS NOT NULL;

-- Converte o único merge ativo hoje no modelo antigo (evento "Nostalgia",
-- mesclado em 14/06/2026) pro modelo novo: o evento que já é o "principal"
-- vira, retroativamente, um card-vitrine — mesma URL, mesmo card, nada
-- muda pro público.
UPDATE public.events
SET is_merge_shell = true
WHERE id = 'bece84f6-371a-4a32-9444-253fae204037';
