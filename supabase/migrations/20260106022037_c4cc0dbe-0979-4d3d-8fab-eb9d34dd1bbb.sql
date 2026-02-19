-- Fix: Drop existing policy before creating
DROP POLICY IF EXISTS "Admins can view share analytics" ON public.share_analytics;

CREATE POLICY "Admins can view share analytics"
ON public.share_analytics
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));