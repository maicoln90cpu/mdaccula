-- Add override date/time columns to custom_links
ALTER TABLE public.custom_links 
ADD COLUMN IF NOT EXISTS override_date date,
ADD COLUMN IF NOT EXISTS override_time time without time zone;

-- Add comment for documentation
COMMENT ON COLUMN public.custom_links.override_date IS 'Override event date (optional, uses event date if null)';
COMMENT ON COLUMN public.custom_links.override_time IS 'Override event time (optional, uses event time if null)';