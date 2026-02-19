-- Adicionar coluna image_tokens para rastrear tokens de geração de imagem
ALTER TABLE public.ai_generated_posts 
ADD COLUMN IF NOT EXISTS image_tokens integer;