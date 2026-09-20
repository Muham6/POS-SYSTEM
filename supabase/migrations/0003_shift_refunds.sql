-- ============================================================================
-- Cash refunds come out of the drawer, so they must come off expected cash.
--
-- Before: expected = opening float + cash sales. A cashier who refunded ₦400
-- in cash during a shift was reported ₦400 SHORT at clock-out — accused of
-- taking money they handed back to a customer.
-- After:  expected = opening float + cash sales − cash refunds.
--
-- Two details that make this correct rather than merely different:
--
--  * Cash sales now count both 'completed' AND 'refunded' sales. A fully
--    refunded sale flips to 'refunded', and under the old status filter its
--    cash silently vanished from the sum. With the refund now also subtracted,
--    excluding the sale too would take the same money off twice.
--
--  * Refunds are matched by the shift the REFUND happened in (returns.shift_id),
--    not the shift of the original sale. A customer returning yesterday's
--    purchase takes cash from today's drawer.
--
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run.
-- Safe to re-run.
-- ============================================================================

create or replace function public.close_shift(
  p_shift_id     uuid,
  p_counted_cash numeric,
  p_note         text default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_actor        uuid := auth.uid();
  v_shift        public.shifts%rowtype;
  v_cash_sales   numeric(12,2);
  v_cash_refunds numeric(12,2);
  v_expected     numeric(12,2);
begin
  if v_actor is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_shift from public.shifts where id = p_shift_id for update;
  if not found then
    raise exception 'Shift not found';
  end if;

  if v_shift.cashier_id <> v_actor and not exists (
    select 1 from public.profiles where id = v_actor and role = 'admin'
  ) then
    raise exception 'You can only close your own shift';
  end if;

  if v_shift.status = 'closed' then
    raise exception 'Shift is already closed';
  end if;

  -- Cash that went INTO the drawer this shift. Refunded sales stay in: their
  -- cash was taken at the till, and the refund is accounted for below.
  select coalesce(sum(cash_amount), 0) into v_cash_sales
  from public.sales
  where shift_id = p_shift_id
    and status in ('completed', 'refunded');

  -- Cash that came OUT of the drawer this shift.
  select coalesce(sum(refund_cash), 0) into v_cash_refunds
  from public.returns
  where shift_id = p_shift_id;

  v_expected := v_shift.opening_float + v_cash_sales - v_cash_refunds;

  update public.shifts
  set closed_at     = now(),
      status        = 'closed',
      expected_cash = v_expected,
      counted_cash  = p_counted_cash,
      variance      = p_counted_cash - v_expected,
      note          = p_note
  where id = p_shift_id;
end;
$function$;
