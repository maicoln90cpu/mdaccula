-- Create function to atomically increment link clicks
CREATE OR REPLACE FUNCTION public.increment_link_clicks(link_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.custom_links 
  SET clicks = COALESCE(clicks, 0) + 1 
  WHERE id = link_id;
END;
$$;