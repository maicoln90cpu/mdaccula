CREATE TABLE IF NOT EXISTS public.internal_cron_secrets (
  name text PRIMARY KEY,
  secret text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Nenhum grant para anon/authenticated — apenas service_role acessa
GRANT ALL ON public.internal_cron_secrets TO service_role;

ALTER TABLE public.internal_cron_secrets ENABLE ROW LEVEL SECURITY;

-- Sem policies para anon/authenticated → RLS bloqueia por padrão
-- service_role bypassa RLS naturalmente

INSERT INTO public.internal_cron_secrets (name, secret)
VALUES ('egoi_stats_cron', 'c8Qb-28ZuxXHsTnx0RW3FIoEI1sPFezyzzlIRgd25NU')
ON CONFLICT (name) DO UPDATE SET secret = EXCLUDED.secret, updated_at = now();