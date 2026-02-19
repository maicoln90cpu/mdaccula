-- Add manual_order_override column to custom_links
ALTER TABLE public.custom_links
ADD COLUMN manual_order_override boolean DEFAULT false;

-- Add comment explaining the field
COMMENT ON COLUMN public.custom_links.manual_order_override IS 'When true, display_order is used instead of automatic date-based sorting';