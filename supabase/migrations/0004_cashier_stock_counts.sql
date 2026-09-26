-- ============================================================================
-- Cashier stock counts, and tightening who can hand money back.
--
-- A stock TAKE (bulk_stock_take) overwrites recorded stock with whatever was
-- counted — that stays admin-only. A stock COUNT is the cashier's version: it
-- records what is physically on the shelf against what the system believed at
-- that moment, and changes nothing. It exists to tell the owner "these don't
-- match", not to make them match.
--
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run.
-- Safe to re-run.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. The count, and the lines within it
-- ----------------------------------------------------------------------------
create table if not exists stock_counts (
  id           uuid primary key default gen_random_uuid(),
  count_number text unique not null,
  counted_by   uuid references profiles(id),
  note         text,
  status       text not null default 'submitted',   -- submitted | reviewed
  reviewed_by  uuid references profiles(id),
  reviewed_at  timestamptz,
  created_at   timestamptz not null default now()
);

create table if not exists stock_count_items (
  id               uuid primary key default gen_random_uuid(),
  count_id         uuid not null references stock_counts(id) on delete cascade,
  product_id       uuid not null references products(id),
  -- Names and system figures are snapshotted. A count is evidence about a
  -- moment; renaming a product or selling more later must not rewrite it.
  product_name     text    not null,
  system_quantity  integer not null,
  counted_quantity integer not null
);

create index if not exists stock_counts_created_idx   on stock_counts(created_at desc);
create index if not exists stock_counts_counted_by_idx on stock_counts(counted_by);
create index if not exists stock_count_items_count_idx on stock_count_items(count_id);


-- ----------------------------------------------------------------------------
-- 2. RLS — a cashier sees only their own counts, an admin sees all
-- ----------------------------------------------------------------------------
alter table stock_counts      enable row level security;
alter table stock_count_items enable row level security;

drop policy if exists "own counts or admin" on stock_counts;
create policy "own counts or admin"
  on stock_counts for select
  using (
    counted_by = auth.uid()
    or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

drop policy if exists "admins mark counts reviewed" on stock_counts;
create policy "admins mark counts reviewed"
  on stock_counts for update
  using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

drop policy if exists "count lines follow their count" on stock_count_items;
create policy "count lines follow their count"
  on stock_count_items for select
  using (
    exists (
      select 1 from stock_counts c
      where c.id = count_id
        and (
          c.counted_by = auth.uid()
          or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
        )
    )
  );


-- ----------------------------------------------------------------------------
-- 3. submit_stock_count() — records a count, changes no stock
--
--    Deliberately has no UPDATE against products anywhere in it. Any staff
--    member may submit one; that is safe precisely because it cannot alter
--    inventory.
-- ----------------------------------------------------------------------------
create or replace function submit_stock_count(
  p_items jsonb,
  p_note  text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id  uuid := auth.uid();
  v_count_id uuid;
  v_number   text;
  v_item     jsonb;
  v_product  products%rowtype;
  v_counted  integer;
begin
  if v_user_id is null then
    raise exception 'Not signed in.';
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Count at least one product.';
  end if;

  v_number := 'CNT-' || to_char(now(), 'YYYYMMDD') || '-'
                     || substr(replace(gen_random_uuid()::text, '-', ''), 1, 4);

  insert into stock_counts (count_number, counted_by, note)
  values (v_number, v_user_id, nullif(trim(coalesce(p_note, '')), ''))
  returning id into v_count_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_counted := (v_item->>'counted_quantity')::integer;

    if v_counted is null or v_counted < 0 then
      raise exception 'A counted quantity cannot be negative.';
    end if;

    select * into v_product from products where id = (v_item->>'product_id')::uuid;

    if not found then
      raise exception 'A product on this count no longer exists.';
    end if;

    insert into stock_count_items
      (count_id, product_id, product_name, system_quantity, counted_quantity)
    values
      (v_count_id, v_product.id, v_product.name, v_product.stock_quantity, v_counted);
  end loop;

  return v_number;
end;
$$;


-- ----------------------------------------------------------------------------
-- 4. Refunds become admin-only
--
--    A refund takes cash out of the drawer, so it belongs with whoever is
--    accountable for the drawer. The UI already hid it from cashiers, but the
--    function itself accepted any signed-in caller, so hiding the button was
--    the only thing stopping a direct API call.
--
--    Enforced with a trigger on the returns table rather than by rewriting
--    process_return. Copying a 150-line money-handling function into this
--    migration just to insert one check is how a subtle difference creeps in
--    between the two copies. The trigger fires inside process_return either
--    way, and auth.uid() there is still the real caller even though the
--    function runs as definer.
--
--    To let cashiers handle returns at the counter instead:
--      drop trigger returns_require_admin on returns;
-- ----------------------------------------------------------------------------
create or replace function refuse_refund_unless_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from profiles where id = auth.uid() and role = 'admin') then
    raise exception 'Only admins can process a refund';
  end if;
  return new;
end;
$$;

drop trigger if exists returns_require_admin on returns;
create trigger returns_require_admin
  before insert on returns
  for each row
  execute function refuse_refund_unless_admin();
