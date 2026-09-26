-- ============================================================================
-- Put a refund against the till the cash actually came out of.
--
-- Migration 0003 stopped cashiers being blamed for cash they handed back, by
-- taking refunds off expected cash. It matches them on returns.shift_id.
--
-- Migration 0004 then made refunds admin-only. But process_return fills
-- shift_id by looking for an open shift belonging to WHOEVER IS REFUNDING:
--
--     select id into v_shift_id from shifts
--      where cashier_id = v_user_id and status = 'open';
--
-- The owner doesn't run a till session, so that finds nothing, shift_id lands
-- null, and the refund is subtracted from no drawer at all. The owner refunds
-- N4,100 from the till, the cashier clocks out N4,100 short, and the system
-- says they are missing money they never touched. The two migrations are each
-- correct on their own and cancel out together.
--
-- Rather than restate the 150-line money function to change four lines of it,
-- this fills the gap in: if the refunder has no shift of their own, and there
-- is exactly ONE till open, the cash came from that one.
--
-- Exactly one, deliberately. With two tills open there is no way to know which
-- drawer was opened, and a guess would move a real shortage onto an innocent
-- cashier — the very thing this is meant to stop. In that case it stays null
-- and the refund shows up as a variance to be explained, which is honest.
--
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run.
-- Safe to re-run.
-- ============================================================================

create or replace function public.attach_refund_to_open_till()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_open_count integer;
  v_shift_id   uuid;
begin
  -- The refunder had their own till session: that is already the right answer.
  if new.shift_id is not null then
    return new;
  end if;

  select count(*) into v_open_count from public.shifts where status = 'open';

  if v_open_count = 1 then
    select id into v_shift_id from public.shifts where status = 'open' limit 1;
    new.shift_id := v_shift_id;
  end if;

  return new;
end;
$function$;

drop trigger if exists returns_attach_shift on public.returns;

create trigger returns_attach_shift
  before insert on public.returns
  for each row execute function public.attach_refund_to_open_till();
