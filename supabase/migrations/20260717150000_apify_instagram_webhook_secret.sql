-- Fase B do Event Watcher: secret dedicado pro webhook que a Apify chama de volta
-- quando o ator de monitoramento de Instagram encontra um post novo. A Apify não
-- manda JWT do Supabase, então esse secret (embutido na query string da
-- webhookUrl) é a única proteção contra chamadas forjadas.
INSERT INTO public.internal_cron_secrets (name, secret)
VALUES ('apify_instagram_webhook', 'azwlUmiVbmD-oBNHU5AcApVyJqfsxDfaA3aCuY-zuS0')
ON CONFLICT (name) DO UPDATE SET secret = EXCLUDED.secret, updated_at = now();
