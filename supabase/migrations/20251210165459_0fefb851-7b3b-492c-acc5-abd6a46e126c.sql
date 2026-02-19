-- Fix sync_logs UPDATE policy to restrict to service_role only
DROP POLICY IF EXISTS "Only service role can update sync logs" ON public.sync_logs;

CREATE POLICY "Only service role can update sync logs"
ON public.sync_logs
FOR UPDATE
USING (auth.role() = 'service_role');