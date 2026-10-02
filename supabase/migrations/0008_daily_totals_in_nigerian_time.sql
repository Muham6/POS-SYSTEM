-- ============================================================================
-- Group the daily totals by the shop's day, not UTC's.
--
-- date(created_at) takes the date in the database's time zone, which is UTC.
-- Nigeria is an hour ahead, so a sale rung up between midnight and 1am landed
-- on the previous day on Overview and Reports. The app now works in Lagos
-- time throughout; this makes the view agree with it.
--
-- Same columns and same refund handling as 0007 — only the day changes.
--
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run.
-- Safe to re-run.
-- ============================================================================

do $$
declare
  v_opts text[];
begin
  select reloptions into v_opts from pg_class where oid = 'public.daily_sales_summary'::regclass;

  create or replace view public.daily_sales_summary as
  select (s.created_at at time zone 'Africa/Lagos')::date as sale_day,
         count(*) as num_sales,
         sum(s.total - coalesce(r.refunded, 0)) as total_revenue
    from public.sales s
    left join (
      select sale_id, sum(total_refund) as refunded
        from public.returns
       group by sale_id
    ) r on r.sale_id = s.id
   where s.status = 'completed'::sale_status
   group by (s.created_at at time zone 'Africa/Lagos')::date
   order by (s.created_at at time zone 'Africa/Lagos')::date desc;

  if v_opts is not null then
    execute format('alter view public.daily_sales_summary set (%s)', array_to_string(v_opts, ', '));
  end if;
end $$;
