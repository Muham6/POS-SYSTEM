-- ============================================================================
-- Returns / refunds, plus a discount ceiling for cashiers.
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run.
-- Safe to re-run (everything is IF NOT EXISTS / OR REPLACE).
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Cashier discount ceiling
--    NULL  = no limit (existing behaviour)
--    0     = cashiers may give no discount at all without approval
-- ----------------------------------------------------------------------------
alter table store_settings
  add column if not exists max_cashier_discount_percent numeric;


-- ----------------------------------------------------------------------------
-- 2. Returns
--    A sale can be returned more than once (customer brings back one item
--    today, another next week), so returns are their own records rather than
--    a flag on the sale.
-- ----------------------------------------------------------------------------
create table if not exists returns (
  id                uuid primary key default gen_random_uuid(),
  return_number     text unique not null,
  sale_id           uuid not null references sales(id),
  cashier_id        uuid references profiles(id),
  shift_id          uuid references shifts(id),
  reason            text,
  refund_cash       numeric not null default 0,
  refund_card       numeric not null default 0,
  refund_transfer   numeric not null default 0,
  total_refund      numeric not null default 0,
  restocked         boolean not null default true,
  created_at        timestamptz not null default now()
);

create table if not exists return_items (
  id            uuid primary key default gen_random_uuid(),
  return_id     uuid not null references returns(id) on delete cascade,
  sale_item_id  uuid not null references sale_items(id),
  product_id    uuid references products(id),
  product_name  text not null,
  unit_name     text,
  unit_price    numeric not null default 0,
  quantity      integer not null,
  base_quantity integer not null default 0,
  line_total    numeric not null default 0
);

create index if not exists returns_sale_id_idx        on returns(sale_id);
create index if not exists returns_created_at_idx     on returns(created_at desc);
create index if not exists return_items_return_idx    on return_items(return_id);
create index if not exists return_items_sale_item_idx on return_items(sale_item_id);


-- ----------------------------------------------------------------------------
-- 3. RLS
--    Reads are open to signed-in staff. There are deliberately NO insert /
--    update / delete policies: every write goes through process_return() below,
--    which is SECURITY DEFINER. That stops a cashier from POSTing a made-up
--    refund straight at the REST API and quietly inflating stock.
-- ----------------------------------------------------------------------------
alter table returns      enable row level security;
alter table return_items enable row level security;

drop policy if exists "returns are readable by staff" on returns;
create policy "returns are readable by staff"
  on returns for select to authenticated using (true);

drop policy if exists "return items are readable by staff" on return_items;
create policy "return items are readable by staff"
  on return_items for select to authenticated using (true);


-- ----------------------------------------------------------------------------
-- 4. process_return()
--    Does the whole return atomically: validates, records, restocks, and
--    flips the sale to 'refunded' once nothing is left to return.
--
--    p_items is [{"sale_item_id": uuid, "quantity": int}, ...]
-- ----------------------------------------------------------------------------
create or replace function process_return(
  p_sale_id          uuid,
  p_items            jsonb,
  p_reason           text,
  p_refund_cash      numeric default 0,
  p_refund_card      numeric default 0,
  p_refund_transfer  numeric default 0,
  p_restock          boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id        uuid := auth.uid();
  v_sale           sales%rowtype;
  v_item           jsonb;
  v_sale_item      sale_items%rowtype;
  v_qty            integer;
  v_already        integer;
  v_base_per_unit  numeric;
  v_base_qty       integer;
  v_gross          numeric := 0;
  v_ratio          numeric;
  v_refund_total   numeric;
  v_paid           numeric;
  v_return_id      uuid;
  v_return_number  text;
  v_shift_id       uuid;
  v_prev_stock     integer;
  v_outstanding    integer;
begin
  if v_user_id is null then
    raise exception 'Not signed in.';
  end if;

  select * into v_sale from sales where id = p_sale_id;
  if not found then
    raise exception 'Sale not found.';
  end if;

  if v_sale.status <> 'completed' then
    raise exception 'Only a completed sale can be returned (this one is %).', v_sale.status;
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Select at least one item to return.';
  end if;

  -- Validate every line first, and total up what was originally charged for
  -- the goods coming back, before writing anything.
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'quantity')::integer;

    select * into v_sale_item
      from sale_items
     where id = (v_item->>'sale_item_id')::uuid
       and sale_id = p_sale_id;

    if not found then
      raise exception 'That item is not part of this sale.';
    end if;

    if v_qty is null or v_qty <= 0 then
      raise exception 'Return quantity for % must be greater than zero.', v_sale_item.product_name;
    end if;

    select coalesce(sum(quantity), 0) into v_already
      from return_items
     where sale_item_id = v_sale_item.id;

    if v_qty > (v_sale_item.quantity - v_already) then
      raise exception 'Cannot return % x % — only % left to return on this sale.',
        v_qty, v_sale_item.product_name, (v_sale_item.quantity - v_already);
    end if;

    v_gross := v_gross + (v_sale_item.unit_price * v_qty);
  end loop;

  -- The original sale may have carried a discount, so refunding list price
  -- would hand back more than the customer actually paid. Refund the same
  -- proportion of the goods' value that they paid at the till.
  v_ratio := case
               when coalesce(v_sale.subtotal, 0) > 0 then v_sale.total / v_sale.subtotal
               else 1
             end;
  v_refund_total := round(v_gross * v_ratio, 2);

  -- Tolerate a one-kobo difference: the browser computes this total in
  -- floating point while Postgres uses numeric, so the two can disagree in the
  -- last decimal place on a discounted sale.
  v_paid := coalesce(p_refund_cash, 0) + coalesce(p_refund_card, 0) + coalesce(p_refund_transfer, 0);
  if abs(round(v_paid, 2) - v_refund_total) > 0.01 then
    raise exception 'Refund split (%) must add up to the refund due (%).', round(v_paid, 2), v_refund_total;
  end if;

  -- Attach to the cashier's open shift, if they have one, so the refund can be
  -- traced back to a till session.
  select id into v_shift_id
    from shifts
   where cashier_id = v_user_id and status = 'open'
   limit 1;

  v_return_number := 'RTN-' || to_char(now(), 'YYYYMMDD') || '-' ||
    lpad(((select count(*) from returns where created_at::date = current_date) + 1)::text, 4, '0');

  insert into returns (
    return_number, sale_id, cashier_id, shift_id, reason,
    refund_cash, refund_card, refund_transfer, total_refund, restocked
  ) values (
    v_return_number, p_sale_id, v_user_id, v_shift_id, nullif(trim(coalesce(p_reason, '')), ''),
    coalesce(p_refund_cash, 0), coalesce(p_refund_card, 0), coalesce(p_refund_transfer, 0),
    v_refund_total, coalesce(p_restock, true)
  )
  returning id into v_return_id;

  -- Record the lines, and put the goods back if they're resaleable.
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'quantity')::integer;

    select * into v_sale_item
      from sale_items
     where id = (v_item->>'sale_item_id')::uuid;

    -- sale_items.base_quantity is the whole line in base units; divide back out
    -- to get how much stock one returned unit represents.
    v_base_per_unit := case
                         when coalesce(v_sale_item.quantity, 0) > 0
                           then coalesce(v_sale_item.base_quantity, 0)::numeric / v_sale_item.quantity
                         else 0
                       end;
    v_base_qty := round(v_base_per_unit * v_qty)::integer;

    insert into return_items (
      return_id, sale_item_id, product_id, product_name, unit_name,
      unit_price, quantity, base_quantity, line_total
    ) values (
      v_return_id, v_sale_item.id, v_sale_item.product_id, v_sale_item.product_name,
      v_sale_item.unit_name, v_sale_item.unit_price, v_qty, v_base_qty,
      round(v_sale_item.unit_price * v_qty * v_ratio, 2)
    );

    if coalesce(p_restock, true) and v_base_qty > 0 and v_sale_item.product_id is not null then
      select stock_quantity into v_prev_stock from products where id = v_sale_item.product_id for update;

      update products
         set stock_quantity = stock_quantity + v_base_qty,
             updated_at = now()
       where id = v_sale_item.product_id;

      insert into stock_movements (
        product_id, movement_type, quantity_change, previous_stock, new_stock,
        note, performed_by, sale_id
      ) values (
        v_sale_item.product_id, 'return', v_base_qty, v_prev_stock, v_prev_stock + v_base_qty,
        'Return ' || v_return_number, v_user_id, p_sale_id
      );
    end if;
  end loop;

  -- If there's nothing left on this sale that could still come back, the sale
  -- is fully refunded.
  select coalesce(sum(si.quantity), 0) - coalesce((
           select sum(ri.quantity)
             from return_items ri
             join sale_items si2 on si2.id = ri.sale_item_id
            where si2.sale_id = p_sale_id
         ), 0)
    into v_outstanding
    from sale_items si
   where si.sale_id = p_sale_id;

  if v_outstanding <= 0 then
    update sales set status = 'refunded' where id = p_sale_id;
  end if;

  return v_return_id;
end;
$$;

revoke all on function process_return(uuid, jsonb, text, numeric, numeric, numeric, boolean) from public;
grant execute on function process_return(uuid, jsonb, text, numeric, numeric, numeric, boolean) to authenticated;
