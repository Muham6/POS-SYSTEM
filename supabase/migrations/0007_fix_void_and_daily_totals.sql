-- ============================================================================
-- 1. Make voiding a sale work again.
--
-- void_sale set status = 'voided', but sale_status only has completed |
-- refunded | cancelled. Every void failed on that value and rolled back, so no
-- sale could be voided at all. The app already reads a voided sale as
-- 'cancelled', so that is what it now writes.
--
-- It also refused only an already-'voided' sale, which meant it would void a
-- sale that had been returned, fully or in part. That puts the returned goods
-- back on the shelf a second time, and takes the refunded cash off the till
-- twice (once as a refund, once by dropping the sale from close_shift's cash
-- sales). So only a completed sale with no returns against it can be voided;
-- one that has returns is finished off through Return items instead.
--
-- 2. Take refunds off the daily totals.
--
-- daily_sales_summary (Overview and Reports) summed completed sales at their
-- full value, so money handed back on a part-returned sale was still counted
-- as takings. It now subtracts refunds, against the day of the original sale.
--
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run.
-- Safe to re-run.
-- ============================================================================

create or replace function public.void_sale(p_sale_id uuid, p_reason text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_actor    uuid := auth.uid();
  v_is_admin boolean;
  v_sale     public.sales%rowtype;
  v_item     record;
  v_new_stock integer;
begin
  if v_actor is null then
    raise exception 'Not authenticated';
  end if;

  select (role = 'admin') into v_is_admin from public.profiles where id = v_actor;
  if not coalesce(v_is_admin, false) then
    raise exception 'Only admins can void a sale';
  end if;

  select * into v_sale from public.sales where id = p_sale_id for update;
  if not found then
    raise exception 'Sale not found';
  end if;

  if v_sale.status = 'cancelled' then
    raise exception 'Sale is already voided';
  end if;

  if v_sale.status = 'refunded' then
    raise exception 'This sale has already been fully refunded';
  end if;

  if exists (select 1 from public.returns where sale_id = p_sale_id) then
    raise exception 'Items on this sale have already been returned. Use Return items for the rest instead of voiding.';
  end if;

  for v_item in
    select product_id, coalesce(base_quantity, quantity) as qty
    from public.sale_items
    where sale_id = p_sale_id
  loop
    if v_item.product_id is not null then
      update public.products
      set stock_quantity = stock_quantity + v_item.qty
      where id = v_item.product_id
      returning stock_quantity into v_new_stock;

      insert into public.stock_movements
        (product_id, movement_type, quantity_change, previous_stock, new_stock, performed_by, sale_id, note)
      values
        (v_item.product_id, 'return', v_item.qty, v_new_stock - v_item.qty, v_new_stock, v_actor, p_sale_id,
         format('Voided sale %s: %s', v_sale.sale_number, p_reason));
    end if;
  end loop;

  update public.sales
  set status = 'cancelled', void_reason = p_reason, voided_by = v_actor, voided_at = now()
  where id = p_sale_id;
end; $function$;


-- Replacing a view can drop options set on it (such as security_invoker), so
-- read them first and put them back after.
do $$
declare
  v_opts text[];
begin
  select reloptions into v_opts from pg_class where oid = 'public.daily_sales_summary'::regclass;

  create or replace view public.daily_sales_summary as
  select date(s.created_at) as sale_day,
         count(*) as num_sales,
         sum(s.total - coalesce(r.refunded, 0)) as total_revenue
    from public.sales s
    left join (
      select sale_id, sum(total_refund) as refunded
        from public.returns
       group by sale_id
    ) r on r.sale_id = s.id
   where s.status = 'completed'::sale_status
   group by date(s.created_at)
   order by date(s.created_at) desc;

  if v_opts is not null then
    execute format('alter view public.daily_sales_summary set (%s)', array_to_string(v_opts, ', '));
  end if;
end $$;
