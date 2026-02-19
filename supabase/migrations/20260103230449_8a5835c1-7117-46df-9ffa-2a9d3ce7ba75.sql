-- Mover pg_net para schema extensions
-- pg_net é gerenciada pelo Supabase, mas podemos recriá-la no schema correto
DROP EXTENSION IF EXISTS pg_net CASCADE;
CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;