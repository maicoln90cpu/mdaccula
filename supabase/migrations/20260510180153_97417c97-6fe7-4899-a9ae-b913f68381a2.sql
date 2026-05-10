CREATE OR REPLACE FUNCTION public.get_db_size()
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT pg_database_size(current_database())::bigint;
$$;

REVOKE ALL ON FUNCTION public.get_db_size() FROM public;
GRANT EXECUTE ON FUNCTION public.get_db_size() TO authenticated, service_role;