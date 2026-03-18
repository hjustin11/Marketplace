create or replace view public.marketplace_daily_metrics as
select
  marketplace_id,
  date_trunc('day', purchased_at)::date as day,
  count(*) as orders,
  count(*) filter (where returned = true) as returned_orders,
  sum(gross_amount_cents)::bigint as revenue_cents,
  round(
    (
      count(*) filter (where returned = true)::numeric
      / nullif(count(*)::numeric, 0)
    ) * 100,
    2
  ) as return_rate_pct,
  round(sum(gross_amount_cents)::numeric / nullif(count(*)::numeric, 0), 2) as aov_cents
from public.marketplace_orders
group by marketplace_id, date_trunc('day', purchased_at)::date;

create or replace view public.marketplace_location_metrics as
select
  marketplace_id,
  buyer_region,
  buyer_city,
  buyer_postal_code,
  count(*) as orders,
  sum(gross_amount_cents)::bigint as revenue_cents
from public.marketplace_orders
group by marketplace_id, buyer_region, buyer_city, buyer_postal_code;
