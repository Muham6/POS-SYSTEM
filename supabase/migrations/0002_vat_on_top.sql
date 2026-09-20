-- ============================================================================
-- VAT is charged ON TOP of the price, not backed out of it.
--
-- Before: a ₦1,000 item rang up as ₦1,000, and the receipt claimed ₦69.77 of
-- that was VAT. The customer paid ₦1,000 and the shop absorbed the tax.
-- After:  a ₦1,000 item rings up as ₦1,000 + ₦75 = ₦1,075.
--
-- The rate comes from store_settings.vat_rate, so the owner keeps control of
-- it from Settings. NULL or 0 means the shop doesn't charge VAT and totals are
-- unchanged from before.
--
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run.
-- Safe to re-run.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Record the tax on the sale itself
--
--    Deliberately nullable rather than defaulting to 0: NULL means "this sale
--    predates VAT being charged", which is different from "VAT was charged and
--    came to zero". The VAT report relies on telling those apart.
-- ----------------------------------------------------------------------------
alter table public.sales add column if not exists vat_amount numeric(12,2);
alter table public.sales add column if not exists vat_rate   numeric;

comment on column public.sales.vat_amount is
  'VAT charged on top of subtotal. NULL for sales made before VAT was charged.';
comment on column public.sales.vat_rate is
  'The rate in force when this sale was rung up, so later rate changes cannot retrospectively alter a filing.';


-- ----------------------------------------------------------------------------
-- 2. process_sale() — adds VAT to the total
--
--    Identical to the previous version except for the total calculation at the
--    end. Stock locking, invoice numbering, shift linkage and the paid-matches-
--    total check are all unchanged.
-- ----------------------------------------------------------------------------
create or replace function public.process_sale(
  p_items              jsonb,
  p_cash_amount        numeric default 0,
  p_card_amount        numeric default 0,
  p_transfer_amount    numeric default 0,
  p_discount           numeric default 0,
  p_customer_id        uuid    default null,
  p_paystack_reference text    default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_sale_id     uuid;
  v_item        jsonb;
  v_product     public.products%rowtype;
  v_unit        public.product_units%rowtype;
  v_qty         integer;
  v_base_qty    integer;
  v_subtotal    numeric(12,2) := 0;
  v_net         numeric(12,2);
  v_vat_rate    numeric;
  v_vat         numeric(12,2);
  v_total       numeric(12,2);
  v_paid        numeric(12,2);
  v_cashier     uuid := auth.uid();
  v_sale_number text;
  v_method      payment_method;
  v_new_stock   integer;
  v_line_total  numeric(12,2);
  v_shift_id    uuid;
begin
  if v_cashier is null then
    raise exception 'Not authenticated';
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Cannot record a sale with no items';
  end if;

  select id into v_shift_id from public.shifts where cashier_id = v_cashier and status = 'open' limit 1;

  v_paid := coalesce(p_cash_amount,0) + coalesce(p_card_amount,0) + coalesce(p_transfer_amount,0);

  if (p_cash_amount > 0)::int + (p_card_amount > 0)::int + (p_transfer_amount > 0)::int > 1 then
    v_method := 'split';
  elsif p_card_amount > 0 then
    v_method := 'card';
  elsif p_transfer_amount > 0 then
    v_method := 'transfer';
  else
    v_method := 'cash';
  end if;

  v_sale_number := 'INV-' || to_char(now(), 'YYYYMMDD') || '-'
                          || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);

  insert into public.sales (sale_number, cashier_id, subtotal, discount, total,
                            payment_method, cash_amount, card_amount, transfer_amount,
                            customer_id, paystack_reference, status, shift_id)
  values (v_sale_number, v_cashier, 0, coalesce(p_discount,0), 0,
          v_method, coalesce(p_cash_amount,0), coalesce(p_card_amount,0), coalesce(p_transfer_amount,0),
          p_customer_id, p_paystack_reference, 'completed', v_shift_id)
  returning id into v_sale_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_qty := (v_item->>'quantity')::integer;

    if v_qty is null or v_qty <= 0 then
      raise exception 'Invalid quantity in cart';
    end if;

    select * into v_unit
    from public.product_units
    where id = (v_item->>'unit_id')::uuid
    for update;

    if not found then
      raise exception 'Unit not found for cart item';
    end if;

    select * into v_product
    from public.products
    where id = v_unit.product_id
    for update;

    if not found or not v_product.is_active then
      raise exception 'Product "%" is not available for sale', coalesce(v_product.name, 'unknown');
    end if;

    v_base_qty := v_qty * v_unit.conversion_to_base;

    if v_product.stock_quantity < v_base_qty then
      raise exception 'Not enough stock for "%" (%): have % base units, need %',
        v_product.name, v_unit.unit_name, v_product.stock_quantity, v_base_qty;
    end if;

    v_line_total := v_unit.price * v_qty;

    insert into public.sale_items (sale_id, product_id, product_name,
                                   unit_price, quantity, line_total, unit_name, base_quantity)
    values (v_sale_id, v_product.id, v_product.name,
            v_unit.price, v_qty, v_line_total, v_unit.unit_name, v_base_qty);

    v_new_stock := v_product.stock_quantity - v_base_qty;

    update public.products
    set stock_quantity = v_new_stock
    where id = v_product.id;

    insert into public.stock_movements
      (product_id, movement_type, quantity_change, previous_stock, new_stock, performed_by, sale_id, note)
    values
      (v_product.id, 'sale', -v_base_qty, v_product.stock_quantity, v_new_stock, v_cashier, v_sale_id,
       format('%s x %s', v_qty, v_unit.unit_name));

    v_subtotal := v_subtotal + v_line_total;
  end loop;

  -- ---- VAT ON TOP (the only behavioural change) ----
  -- Goods first, less any discount, then tax on what's actually being charged.
  v_net := v_subtotal - coalesce(p_discount, 0);
  if v_net < 0 then v_net := 0; end if;

  select vat_rate into v_vat_rate from public.store_settings where id = 1;

  v_vat   := round(v_net * coalesce(v_vat_rate, 0) / 100, 2);
  v_total := v_net + v_vat;

  if round(v_paid, 2) <> round(v_total, 2) then
    raise exception 'Amount paid (%) does not match total due (%)', v_paid, v_total;
  end if;

  update public.sales
  set subtotal   = v_subtotal,
      total      = v_total,
      vat_amount = v_vat,
      vat_rate   = coalesce(v_vat_rate, 0)
  where id = v_sale_id;

  return v_sale_id;
end;
$function$;
