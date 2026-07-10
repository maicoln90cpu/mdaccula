
CREATE OR REPLACE FUNCTION public.manage_digest_schedule(
  _job_name text,
  _enabled boolean,
  _cron_expr text,
  _function_url text,
  _cron_secret text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron
AS $$
DECLARE
  existing_id bigint;
BEGIN
  IF _job_name NOT IN ('weekly-digest-cron', 'weekend-agenda-cron') THEN
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
$$;

REVOKE ALL ON FUNCTION public.manage_digest_schedule(text, boolean, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.manage_digest_schedule(text, boolean, text, text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.manage_digest_schedule(text, boolean, text, text, text) TO service_role;
