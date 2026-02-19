-- Habilitar extensões necessárias (se não estiverem habilitadas)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Criar função para chamar a edge function com service_role_key
CREATE OR REPLACE FUNCTION public.trigger_auto_generate_article()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  supabase_url text := 'https://nzbyyuqvhrwatmydxiag.supabase.co';
  service_role_key text;
BEGIN
  -- Buscar a service_role_key do vault (mais seguro)
  -- Se não houver vault, usar a anon key como fallback
  service_role_key := current_setting('app.settings.service_role_key', true);
  
  -- Se não tiver configuração, usa a chave padrão armazenada
  IF service_role_key IS NULL OR service_role_key = '' THEN
    service_role_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im56Ynl5dXF2aHJ3YXRteWR4aWFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyNDg3MTAsImV4cCI6MjA3NzgyNDcxMH0.tBbQNUzdS5qBH0ER_AhxnMdpa805HqZEA3bmzPD3svc';
  END IF;

  -- Chamar a edge function
  PERFORM net.http_post(
    url := supabase_url || '/functions/v1/auto-generate-article',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_role_key
    ),
    body := '{}'::jsonb
  );
  
  RAISE LOG 'auto-generate-article triggered at %', now();
END;
$$;

-- Agendar o cron job para rodar a cada hora
SELECT cron.schedule(
  'auto-generate-article-hourly',
  '0 * * * *',
  'SELECT public.trigger_auto_generate_article()'
);