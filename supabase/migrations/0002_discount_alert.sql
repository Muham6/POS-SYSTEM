-- ============================================================================
-- Discounts are no longer blocked pending a manager's password — a cashier
-- haggling at the counter can't wait for the owner to walk over. Instead the
-- owner is notified after the fact, so the setting is a reporting threshold
-- rather than a ceiling, and is renamed to say so.
--
-- Run after 0001. Safe to run whether or not 0001 has been applied yet.
-- ============================================================================

do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_name = 'store_settings' and column_name = 'max_cashier_discount_percent'
  ) then
    alter table store_settings rename column max_cashier_discount_percent to discount_alert_percent;
  end if;
end $$;

alter table store_settings
  add column if not exists discount_alert_percent numeric;
