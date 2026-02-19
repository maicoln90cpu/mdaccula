-- ================================================
-- FIX: Corrigir RLS Policy Permissiva em newsletter_subscribers
-- ================================================
-- Problema: A policy atual usa WITH CHECK (true) permitindo
-- qualquer inserção sem validação
-- Solução: Adicionar validação de email no banco de dados
-- ================================================

-- 1. Criar função de validação de email
CREATE OR REPLACE FUNCTION public.is_valid_email(email text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Validação básica de formato de email
  RETURN email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$';
END;
$$;

-- 2. Remover policy permissiva antiga
DROP POLICY IF EXISTS "Anyone can subscribe to newsletter" ON public.newsletter_subscribers;

-- 3. Criar nova policy com validação de email
-- Permite INSERT apenas se o email tiver formato válido
CREATE POLICY "Anyone can subscribe with valid email"
ON public.newsletter_subscribers
FOR INSERT
TO public
WITH CHECK (
  public.is_valid_email(email) 
  AND length(email) <= 320  -- RFC 5321 max email length
  AND source IS NOT NULL    -- Exige fonte de origem
);

-- 4. Adicionar constraint de unicidade se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'newsletter_subscribers_email_key'
  ) THEN
    ALTER TABLE public.newsletter_subscribers 
    ADD CONSTRAINT newsletter_subscribers_email_key UNIQUE (email);
  END IF;
END $$;

-- ================================================
-- NOTA: As policies de service_role com WITH CHECK (true)
-- são SEGURAS porque service_role já tem privilégios elevados
-- e bypassa RLS por padrão. Não é necessário alterá-las.
-- ================================================