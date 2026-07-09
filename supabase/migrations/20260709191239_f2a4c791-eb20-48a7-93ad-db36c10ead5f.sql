create table if not exists public.event_email_campaign_stats (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.event_email_campaigns(id) on delete cascade,
  stats_json jsonb not null default '{}'::jsonb,
  fetched_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id)
);

create index if not exists idx_event_email_campaign_stats_campaign_id
  on public.event_email_campaign_stats (campaign_id);

grant select, insert, update, delete on public.event_email_campaign_stats to authenticated;
grant all on public.event_email_campaign_stats to service_role;

alter table public.event_email_campaign_stats enable row level security;

create policy "Admins can select campaign stats"
  on public.event_email_campaign_stats
  for select
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));

create policy "Admins can manage campaign stats"
  on public.event_email_campaign_stats
  for all
  to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));