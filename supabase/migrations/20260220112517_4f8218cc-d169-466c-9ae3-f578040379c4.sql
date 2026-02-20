
-- Create table for individual click events with timestamps
CREATE TABLE public.redirect_click_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  redirect_link_id UUID NOT NULL REFERENCES public.redirect_links(id) ON DELETE CASCADE,
  clicked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ip_hash TEXT
);

-- Index for efficient period queries
CREATE INDEX idx_redirect_click_events_link_clicked 
  ON public.redirect_click_events (redirect_link_id, clicked_at DESC);

-- Enable RLS
ALTER TABLE public.redirect_click_events ENABLE ROW LEVEL SECURITY;

-- Admins can read click events
CREATE POLICY "Admins can view click events"
  ON public.redirect_click_events
  FOR SELECT
  USING (public.is_admin());

-- Service role can insert click events
CREATE POLICY "Service role can manage redirect_click_events"
  ON public.redirect_click_events
  FOR ALL
  USING (true)
  WITH CHECK (true);
