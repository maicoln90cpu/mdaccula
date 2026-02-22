-- Criar cron job para chamar auto-article-cron a cada hora
SELECT cron.schedule(
  'auto-article-cron',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://xfvpuzlspvvsmmunznxw.supabase.co/functions/v1/auto-article-cron',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhmdnB1emxzcHZ2c21tdW56bnh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1MTY0NjksImV4cCI6MjA4NzA5MjQ2OX0.flQdwVzpNiSxOO0GKl1VDBeBsP5wR8uGatn7CxFOZDg"}'::jsonb,
    body := '{"source": "pg_cron"}'::jsonb
  ) AS request_id;
  $$
);