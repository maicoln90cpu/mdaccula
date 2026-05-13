INSERT INTO public.event_slug_redirects (old_slug, event_id, reason)
VALUES ('so-track-boa-2026-420697', '64142369-229a-48cf-a5eb-8f1d0f7307d0', 'slug renomeado manualmente após merge (backfill)')
ON CONFLICT (old_slug) DO UPDATE
  SET event_id = EXCLUDED.event_id,
      reason   = EXCLUDED.reason;