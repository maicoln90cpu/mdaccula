-- supabase/migrations/20260714210000_event_watcher_schema.sql
-- Event Watcher: fontes de eventos (Fase A, parte 1 — sites via Firecrawl) e fila de rascunhos.

CREATE TABLE public.event_sources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL DEFAULT 'site' CHECK (type IN ('site', 'instagram')),
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_scanned_at TIMESTAMPTZ,
  last_seen_post_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.event_watch_drafts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_id UUID REFERENCES public.event_sources(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review', 'approved', 'rejected', 'published')),
  extracted_title TEXT NOT NULL,
  extracted_date DATE NOT NULL,
  extracted_time TIME,
  extracted_venue TEXT,
  extracted_address TEXT,
  extracted_city TEXT,
  extracted_state TEXT,
  extracted_lineup TEXT[] DEFAULT '{}',
  extracted_ticket_link TEXT,
  extracted_description TEXT,
  extracted_confidence TEXT NOT NULL DEFAULT 'low' CHECK (extracted_confidence IN ('high', 'medium', 'low')),
  source_raw_excerpt TEXT,
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  published_event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
  published_blog_post_id UUID REFERENCES public.blog_posts(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_sources TO authenticated;
GRANT ALL ON public.event_sources TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_watch_drafts TO authenticated;
GRANT ALL ON public.event_watch_drafts TO service_role;

ALTER TABLE public.event_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_watch_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage event sources"
  ON public.event_sources FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins manage event watch drafts"
  ON public.event_watch_drafts FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE TRIGGER trg_event_sources_updated_at
  BEFORE UPDATE ON public.event_sources
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_event_watch_drafts_updated_at
  BEFORE UPDATE ON public.event_watch_drafts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_event_sources_enabled ON public.event_sources(enabled);
CREATE INDEX idx_event_watch_drafts_status ON public.event_watch_drafts(status);
CREATE INDEX idx_event_watch_drafts_source_id ON public.event_watch_drafts(source_id);

-- Libera o novo job 'scan-event-sources-cron' na mesma RPC já usada pelos
-- digests, mantendo um único ponto de agendamento de cron no projeto.
CREATE OR REPLACE FUNCTION public.manage_digest_schedule(
  _job_name text,
  _enabled boolean,
  _cron_expr text,
  _function_url text,
  _cron_secret text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'cron'
AS $function$
DECLARE
  existing_id bigint;
BEGIN
  IF _job_name NOT IN ('weekly-digest-cron', 'weekend-agenda-cron', 'blog-digest-cron', 'scan-event-sources-cron') THEN
    RAISE EXCEPTION 'invalid job name: %', _job_name;
  END IF;

  SELECT jobid INTO existing_id FROM cron.job WHERE jobname = _job_name;
  IF existing_id IS NOT NULL THEN
    PERFORM cron.unschedule(existing_id);
  END IF;

  IF _enabled THEN
    PERFORM cron.schedule(
      _job_name,
      _cron_expr,
      format(
        $cmd$SELECT net.http_post(
          url := %L,
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-cron-secret', %L,
            'x-cron-job', %L
          ),
          body := '{}'::jsonb
        );$cmd$,
        _function_url, _cron_secret, _job_name
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'job', _job_name,
    'enabled', _enabled,
    'cron', _cron_expr,
    'unscheduled_previous', existing_id IS NOT NULL
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.manage_digest_schedule(text, boolean, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.manage_digest_schedule(text, boolean, text, text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.manage_digest_schedule(text, boolean, text, text, text) TO service_role;
