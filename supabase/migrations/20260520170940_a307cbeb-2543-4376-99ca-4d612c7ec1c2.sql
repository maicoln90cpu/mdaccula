ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS merged_into_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS merged_at timestamptz;

ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_status_check;
ALTER TABLE public.events
  ADD CONSTRAINT events_status_check CHECK (status IN ('active','merged_inactive'));

CREATE INDEX IF NOT EXISTS events_active_date_idx
  ON public.events (date)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS events_merged_into_idx
  ON public.events (merged_into_id)
  WHERE merged_into_id IS NOT NULL;