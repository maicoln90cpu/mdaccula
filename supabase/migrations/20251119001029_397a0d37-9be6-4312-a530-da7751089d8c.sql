-- Add subtitle and is_featured columns to custom_links table
ALTER TABLE public.custom_links 
ADD COLUMN IF NOT EXISTS subtitle text,
ADD COLUMN IF NOT EXISTS is_featured boolean DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN public.custom_links.subtitle IS 'Optional subtitle text displayed below the link title';
COMMENT ON COLUMN public.custom_links.is_featured IS 'Whether this link should be displayed as featured (double space)';