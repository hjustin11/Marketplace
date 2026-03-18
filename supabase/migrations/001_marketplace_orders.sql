create extension if not exists "pgcrypto";

create table if not exists public.marketplace_orders (
  id uuid primary key default gen_random_uuid(),
  marketplace_id text not null check (marketplace_id in ('amazon', 'ebay', 'etsy')),
  external_order_id text not null,
  purchased_at timestamptz not null,
  gross_amount_cents integer not null check (gross_amount_cents >= 0),
  currency text not null default 'EUR',
  returned boolean not null default false,
  buyer_city text not null,
  buyer_region text not null,
  buyer_postal_code text not null,
  items_count integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (marketplace_id, external_order_id)
);

create index if not exists idx_marketplace_orders_marketplace_time
  on public.marketplace_orders (marketplace_id, purchased_at);

create index if not exists idx_marketplace_orders_region
  on public.marketplace_orders (buyer_region);

create table if not exists public.marketplace_sync_runs (
  id uuid primary key default gen_random_uuid(),
  marketplace_id text not null,
  status text not null check (status in ('success', 'error')),
  synced_records integer not null default 0,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.marketplace_orders enable row level security;
alter table public.marketplace_sync_runs enable row level security;

drop policy if exists "read marketplace orders" on public.marketplace_orders;
create policy "read marketplace orders"
on public.marketplace_orders
for select
using (true);
