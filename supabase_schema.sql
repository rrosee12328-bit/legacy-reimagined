-- Run this in your Supabase SQL Editor to set up the leads table.
-- It creates a leads table, grants Data API access, enables RLS, and
-- lets anonymous website visitors submit (INSERT) leads while only
-- authenticated CRM users can read them.

create type public.lead_score as enum ('hot', 'warm', 'cold');

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  full_name       text not null,
  email           text not null,
  phone           text not null,
  business_name   text not null,
  business_type   text,
  time_in_business text not null,
  monthly_revenue  text not null,
  credit_score     text not null,
  funding_amount   text not null,
  notes            text,
  score            public.lead_score not null default 'cold',
  status           text not null default 'new',
  source           text not null default 'website',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Data API grants (Supabase no longer grants these by default)
grant insert on public.leads to anon;              -- public form submits
grant select, insert, update, delete on public.leads to authenticated; -- CRM
grant all on public.leads to service_role;

alter table public.leads enable row level security;

-- Anyone can submit a lead from the website
create policy "Anon can insert leads"
  on public.leads for insert
  to anon
  with check (true);

-- Only signed-in CRM users can read / manage leads
create policy "Authenticated can read leads"
  on public.leads for select
  to authenticated
  using (true);

create policy "Authenticated can update leads"
  on public.leads for update
  to authenticated
  using (true) with check (true);

create policy "Authenticated can delete leads"
  on public.leads for delete
  to authenticated
  using (true);

-- Keep updated_at fresh
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger leads_set_updated_at
  before update on public.leads
  for each row execute function public.set_updated_at();
