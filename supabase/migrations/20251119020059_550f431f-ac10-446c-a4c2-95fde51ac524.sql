-- Adicionar campo subtitle na tabela events
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS subtitle text;