-- ============================================================================
-- Three fixes, all additive. Nothing here rewrites process_sale or
-- process_return, and no existing sale, shift or refund is changed by
-- running it.
--
-- 1. No discounts.
--    The till never sends one, but process_sale accepted any p_discount, so a
--    sale could be sent straight to the API for ₦0. Discounts are switched off
--    entirely until the feature is built properly. To bring them back later:
--      drop trigger sales_no_discount on public.sales;
--
-- 2. record_sale(): a safe way to ring up a sale.
--    Wraps process_sale (unchanged) and adds:
--    * client_ref — an id the till makes up before sending. If the same sale
--      arrives twice (the connection dropped after the server had saved it,
--      and the till retried or queued it), the second copy returns the first
--      sale instead of selling the goods again.
--    * p_sold_at — when a sale made offline finally syncs, it is dated when it
--      was actually rung up (up to 7 days back), not when the internet came
--      back, and put in the till session that was open at that moment. If
--      that session has already been closed, its expected cash is corrected,
--      so the cashier isn't left looking short for a sale that arrived late.
--    The app falls back to process_sale until this has been run.
--
-- 3. Refund numbers can't collide.
--    process_return numbers refunds by counting today's, so two refunds at the
--    same moment could get the same number and one would fail. Each new
--    refund now takes a lock and, only if its number is already taken, moves
--    to the next free one.
--
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run.
-- Safe to re-run. If a check below fails, nothing at all is changed.
-- ============================================================================


-- ---- Checks: stop before changing anything if the database isn't as expected.
do $$
begin
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'process_sale'
       and p.proargnames @> array['p_items','p_cash_amount','p_card_amount','p_transfer_amount','p_discount','p_customer_id']
  ) then
    raise exception 'process_sale does not have the expected parameters — stopping without changes.';
  end if;

  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'shifts' and column_name = 'expected_cash')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'sales' and column_name = 'shift_id') then
    raise exception 'shifts/sales columns are not as expected — stopping without changes.';
  end if;
end $$;


-- ---- 1. No discounts --------------------------------------------------------
create or replace function public.refuse_sale_discount()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if coalesce(new.discount, 0) <> 0 then
    raise exception 'Discounts are not enabled.';
  end if;
  return new;
end;
$function$;

drop trigger if exists sales_no_discount on public.sales;
create trigger sales_no_discount
  before insert or update of discount on public.sales
  for each row execute function public.refuse_sale_discount();


-- ---- 2. record_sale() -------------------------------------------------------
alter table public.sales add column if not exists client_ref text;
create unique index if not exists sales_client_ref_key on public.sales (client_ref) where client_ref is not null;

create or replace function public.record_sale(
  p_client_ref       text,
  p_items            jsonb,
  p_cash_amount      numeric default 0,
  p_card_amount      numeric default 0,
  p_transfer_amount  numeric default 0,
  p_customer_id      uuid    default null,
  p_sold_at          timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_actor    uuid := auth.uid();
  v_sale_id  uuid;
  v_shift    public.shifts%rowtype;
  v_shift_id uuid;
  v_cash     numeric;
begin
  if v_actor is null then
    raise exception 'Not authenticated';
  end if;

  if p_client_ref is null or length(trim(p_client_ref)) = 0 then
    raise exception 'Missing sale reference';
  end if;

  -- Already recorded: hand back the original instead of selling it twice.
  -- Only the person who rang it up can claim it.
  select id into v_sale_id from public.sales where client_ref = p_client_ref and cashier_id = v_actor;
  if found then
    return v_sale_id;
  end if;

  begin
    v_sale_id := public.process_sale(
      p_items           => p_items,
      p_cash_amount     => p_cash_amount,
      p_card_amount     => p_card_amount,
      p_transfer_amount => p_transfer_amount,
      p_discount        => 0,
      p_customer_id     => p_customer_id
    );

    update public.sales set client_ref = p_client_ref where id = v_sale_id;
  exception when unique_violation then
    -- The same sale arrived twice at the same moment (two tabs syncing).
    -- Everything process_sale did in this attempt has been rolled back.
    select id into v_sale_id from public.sales where client_ref = p_client_ref;
    if v_sale_id is null then
      raise;
    end if;
    return v_sale_id;
  end;

  -- A sale made offline: date it when it happened and put it in the till
  -- session that was open then. Ignored for anything in the future, or more
  -- than 7 days back, so it can't be used to rewrite history. Normal sales
  -- (sent within a couple of minutes) are left exactly as process_sale made them.
  if p_sold_at is not null
     and p_sold_at < now() - interval '2 minutes'
     and p_sold_at > now() - interval '7 days' then

    select * into v_shift
      from public.shifts
     where cashier_id = v_actor
       and opened_at <= p_sold_at
       and (closed_at is null or closed_at >= p_sold_at)
     order by opened_at desc
     limit 1;
    v_shift_id := case when found then v_shift.id else null end;

    update public.sales set created_at = p_sold_at, shift_id = v_shift_id where id = v_sale_id;
    update public.stock_movements set created_at = p_sold_at where sale_id = v_sale_id;

    -- That session was already counted and closed without this sale's cash.
    select cash_amount into v_cash from public.sales where id = v_sale_id;
    if v_shift_id is not null and v_shift.status = 'closed' and coalesce(v_cash, 0) <> 0 then
      update public.shifts
         set expected_cash = expected_cash + v_cash,
             variance      = counted_cash - (expected_cash + v_cash)
       where id = v_shift_id;
    end if;
  end if;

  return v_sale_id;
end;
$function$;

revoke all on function public.record_sale(text, jsonb, numeric, numeric, numeric, uuid, timestamptz) from public;
grant execute on function public.record_sale(text, jsonb, numeric, numeric, numeric, uuid, timestamptz) to authenticated;


-- ---- 3. Refund numbers can't collide ---------------------------------------
create or replace function public.unique_return_number()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_prefix text;
  v_n      integer;
begin
  -- Held until the refund commits, so two refunds take turns here.
  perform pg_advisory_xact_lock(hashtext('returns.return_number'));

  if exists (select 1 from public.returns where return_number = new.return_number) then
    -- RTN-YYYYMMDD-0001: keep the day, take the next free number on it.
    v_prefix := substring(new.return_number from '^(.*-)\d+$');
    select coalesce(max(substring(return_number from '(\d+)$')::integer), 0) + 1
      into v_n
      from public.returns
     where return_number like v_prefix || '%';
    new.return_number := v_prefix || lpad(v_n::text, 4, '0');
  end if;

  return new;
end;
$function$;

drop trigger if exists returns_unique_number on public.returns;
create trigger returns_unique_number
  before insert on public.returns
  for each row execute function public.unique_return_number();
