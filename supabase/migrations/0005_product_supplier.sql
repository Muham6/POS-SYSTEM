-- ============================================================================
-- Who makes each product.
--
-- The client's stock list carries a manufacturer per product (African Consumer
-- Care, Lorna, Solpia, Lucky Fibers, Darling). The suppliers table already
-- existed but nothing pointed at it, so that column had nowhere to land and
-- would have been dropped on import.
--
-- on delete set null, deliberately: retiring a supplier must not take the
-- products with it. The shop still sells the stock on the shelf.
--
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run.
-- Safe to re-run.
-- ============================================================================

alter table public.products
  add column if not exists supplier_id uuid references public.suppliers(id) on delete set null;

-- Reorder screens filter by supplier ("what do I owe Lorna?"), so this is a
-- lookup column, not just a foreign key.
create index if not exists products_supplier_id_idx on public.products (supplier_id);


-- ----------------------------------------------------------------------------
-- Backfill: the manufacturers from the client's stock list, and which product
-- belongs to which. Matched on SKU, so it is safe to re-run and safe to run
-- before or after the catalogue import.
-- ----------------------------------------------------------------------------

insert into public.suppliers (name, is_active)
select v.name, true
from (values
    ('African Consumer Care Limited'),
    ('Darling'),
    ('Lorna Nigeria Limited'),
    ('Lucky Fibers Limited'),
    ('Solpia Nigeria Ltd')
) as v(name)
where not exists (select 1 from public.suppliers s where s.name = v.name);

update public.products p
set supplier_id = s.id
from (values
    ('RCV-001', 'African Consumer Care Limited'),
    ('RCV-002', 'African Consumer Care Limited'),
    ('RCV-003', 'African Consumer Care Limited'),
    ('RCV-004', 'African Consumer Care Limited'),
    ('RCV-005', 'African Consumer Care Limited'),
    ('RCV-006', 'African Consumer Care Limited'),
    ('RCV-007', 'African Consumer Care Limited'),
    ('RCV-008', 'African Consumer Care Limited'),
    ('RCV-009', 'African Consumer Care Limited'),
    ('RCV-010', 'African Consumer Care Limited'),
    ('RCV-011', 'Solpia Nigeria Ltd'),
    ('RCV-012', 'African Consumer Care Limited'),
    ('RCV-013', 'African Consumer Care Limited'),
    ('RCV-014', 'African Consumer Care Limited'),
    ('RCV-015', 'African Consumer Care Limited'),
    ('RCV-016', 'African Consumer Care Limited'),
    ('RCV-017', 'African Consumer Care Limited'),
    ('RCV-018', 'African Consumer Care Limited'),
    ('RCV-019', 'African Consumer Care Limited'),
    ('RCV-020', 'African Consumer Care Limited'),
    ('RCV-021', 'African Consumer Care Limited'),
    ('RCV-022', 'African Consumer Care Limited'),
    ('RCV-023', 'African Consumer Care Limited'),
    ('RCV-024', 'African Consumer Care Limited'),
    ('RCV-025', 'African Consumer Care Limited'),
    ('RCV-026', 'African Consumer Care Limited'),
    ('RCV-027', 'African Consumer Care Limited'),
    ('RCV-028', 'African Consumer Care Limited'),
    ('RCV-029', 'African Consumer Care Limited'),
    ('RCV-030', 'African Consumer Care Limited'),
    ('RCV-031', 'African Consumer Care Limited'),
    ('RCV-032', 'African Consumer Care Limited'),
    ('RCV-033', 'African Consumer Care Limited'),
    ('RCV-034', 'African Consumer Care Limited'),
    ('RCV-035', 'African Consumer Care Limited'),
    ('RCV-036', 'African Consumer Care Limited'),
    ('RCV-037', 'African Consumer Care Limited'),
    ('RCV-038', 'African Consumer Care Limited'),
    ('RCV-039', 'African Consumer Care Limited'),
    ('RCV-040', 'African Consumer Care Limited'),
    ('RCV-041', 'African Consumer Care Limited'),
    ('RCV-042', 'African Consumer Care Limited'),
    ('RCV-043', 'African Consumer Care Limited'),
    ('RCV-044', 'African Consumer Care Limited'),
    ('RCV-045', 'African Consumer Care Limited'),
    ('RCV-046', 'African Consumer Care Limited'),
    ('RCV-047', 'African Consumer Care Limited'),
    ('RCV-048', 'African Consumer Care Limited'),
    ('RCV-049', 'African Consumer Care Limited'),
    ('RCV-050', 'Solpia Nigeria Ltd'),
    ('RCV-051', 'African Consumer Care Limited'),
    ('RCV-052', 'African Consumer Care Limited'),
    ('RCV-053', 'African Consumer Care Limited'),
    ('RCV-054', 'African Consumer Care Limited'),
    ('RCV-055', 'African Consumer Care Limited'),
    ('RCV-056', 'African Consumer Care Limited'),
    ('RCV-057', 'African Consumer Care Limited'),
    ('RCV-058', 'African Consumer Care Limited'),
    ('RCV-059', 'African Consumer Care Limited'),
    ('RCV-060', 'African Consumer Care Limited'),
    ('RCV-061', 'African Consumer Care Limited'),
    ('RCV-062', 'African Consumer Care Limited'),
    ('RCV-063', 'African Consumer Care Limited'),
    ('RCV-064', 'African Consumer Care Limited'),
    ('RCV-065', 'African Consumer Care Limited'),
    ('RCV-066', 'African Consumer Care Limited'),
    ('RCV-067', 'African Consumer Care Limited'),
    ('RCV-068', 'African Consumer Care Limited'),
    ('RCV-069', 'African Consumer Care Limited'),
    ('RCV-070', 'African Consumer Care Limited'),
    ('RCV-071', 'African Consumer Care Limited'),
    ('RCV-072', 'African Consumer Care Limited'),
    ('RCV-073', 'African Consumer Care Limited'),
    ('RCV-074', 'African Consumer Care Limited'),
    ('RCV-075', 'African Consumer Care Limited'),
    ('RCV-076', 'African Consumer Care Limited'),
    ('RCV-077', 'Lucky Fibers Limited'),
    ('RCV-078', 'Solpia Nigeria Ltd'),
    ('RCV-079', 'Lucky Fibers Limited'),
    ('RCV-100', 'Solpia Nigeria Ltd'),
    ('RCV-101', 'African Consumer Care Limited'),
    ('RCV-102', 'African Consumer Care Limited'),
    ('RCV-103', 'Solpia Nigeria Ltd'),
    ('RCV-104', 'Solpia Nigeria Ltd'),
    ('RCV-105', 'Solpia Nigeria Ltd'),
    ('RCV-106', 'African Consumer Care Limited'),
    ('RCV-107', 'Solpia Nigeria Ltd'),
    ('RCV-108', 'Lucky Fibers Limited'),
    ('RCV-109', 'Lucky Fibers Limited'),
    ('RCV-110', 'Lucky Fibers Limited'),
    ('RCV-111', 'African Consumer Care Limited'),
    ('RCV-112', 'Lucky Fibers Limited'),
    ('RCV-113', 'Lucky Fibers Limited'),
    ('RCV-114', 'Lucky Fibers Limited'),
    ('RCV-115', 'Solpia Nigeria Ltd'),
    ('RCV-116', 'Lucky Fibers Limited'),
    ('RCV-117', 'Solpia Nigeria Ltd'),
    ('RCV-118', 'Solpia Nigeria Ltd'),
    ('RCV-119', 'African Consumer Care Limited'),
    ('RCV-120', 'African Consumer Care Limited'),
    ('RCV-121', 'Solpia Nigeria Ltd'),
    ('RCV-122', 'Solpia Nigeria Ltd'),
    ('RCV-123', 'Solpia Nigeria Ltd'),
    ('RCV-124', 'Solpia Nigeria Ltd'),
    ('RCV-125', 'Solpia Nigeria Ltd'),
    ('RCV-126', 'Lorna Nigeria Limited'),
    ('RCV-127', 'Solpia Nigeria Ltd'),
    ('RCV-128', 'Solpia Nigeria Ltd'),
    ('RCV-129', 'Solpia Nigeria Ltd'),
    ('RCV-130', 'Solpia Nigeria Ltd'),
    ('RCV-131', 'Solpia Nigeria Ltd'),
    ('RCV-132', 'Solpia Nigeria Ltd'),
    ('RCV-133', 'Solpia Nigeria Ltd'),
    ('RCV-134', 'Lucky Fibers Limited'),
    ('RCV-135', 'Solpia Nigeria Ltd'),
    ('RCV-136', 'Solpia Nigeria Ltd'),
    ('RCV-137', 'Solpia Nigeria Ltd'),
    ('RCV-138', 'African Consumer Care Limited'),
    ('RCV-139', 'Solpia Nigeria Ltd'),
    ('RCV-140', 'Lorna Nigeria Limited'),
    ('RCV-141', 'Lorna Nigeria Limited'),
    ('RCV-142', 'Solpia Nigeria Ltd'),
    ('RCV-144', 'Lorna Nigeria Limited'),
    ('RCV-145', 'Solpia Nigeria Ltd'),
    ('RCV-146', 'Solpia Nigeria Ltd'),
    ('RCV-147', 'Darling'),
    ('RCV-148', 'Darling'),
    ('RCV-149', 'Darling'),
    ('RCV-150', 'Darling'),
    ('RCV-151', 'Lorna Nigeria Limited'),
    ('RCV-152', 'Darling'),
    ('RCV-153', 'Darling'),
    ('RCV-158', 'Darling'),
    ('RCV-160', 'Lorna Nigeria Limited'),
    ('RCV-161', 'Darling'),
    ('RCV-162', 'Solpia Nigeria Ltd'),
    ('RCV-163', 'Lorna Nigeria Limited'),
    ('RCV-164', 'Lorna Nigeria Limited'),
    ('RCV-165', 'Lorna Nigeria Limited'),
    ('RCV-166', 'Lorna Nigeria Limited'),
    ('RCV-167', 'Lorna Nigeria Limited'),
    ('RCV-169', 'Lorna Nigeria Limited'),
    ('RCV-171', 'Lorna Nigeria Limited'),
    ('RCV-173', 'Lorna Nigeria Limited'),
    ('RCV-175', 'Lorna Nigeria Limited'),
    ('RCV-176', 'Lorna Nigeria Limited'),
    ('RCV-178', 'Lorna Nigeria Limited'),
    ('RCV-184', 'Lorna Nigeria Limited'),
    ('RCV-185', 'Lorna Nigeria Limited'),
    ('RCV-186', 'Lorna Nigeria Limited'),
    ('RCV-187', 'Lorna Nigeria Limited'),
    ('RCV-191', 'Lorna Nigeria Limited'),
    ('RCV-192', 'Lorna Nigeria Limited'),
    ('RCV-193', 'Lorna Nigeria Limited'),
    ('RCV-194', 'Lorna Nigeria Limited'),
    ('RCV-195', 'African Consumer Care Limited'),
    ('RCV-196', 'African Consumer Care Limited'),
    ('RCV-197', 'Solpia Nigeria Ltd'),
    ('RCV-198', 'Solpia Nigeria Ltd'),
    ('RCV-199', 'Solpia Nigeria Ltd'),
    ('RCV-200', 'Lorna Nigeria Limited'),
    ('RCV-202', 'Lorna Nigeria Limited'),
    ('RCV-203', 'Lorna Nigeria Limited'),
    ('RCV-204', 'Lorna Nigeria Limited'),
    ('RCV-205', 'Lorna Nigeria Limited'),
    ('RCV-206', 'Lorna Nigeria Limited'),
    ('RCV-207', 'Lorna Nigeria Limited'),
    ('RCV-208', 'Lorna Nigeria Limited'),
    ('RCV-209', 'Lorna Nigeria Limited'),
    ('RCV-213', 'Lorna Nigeria Limited'),
    ('RCV-214', 'Lorna Nigeria Limited'),
    ('RCV-215', 'Lorna Nigeria Limited'),
    ('RCV-220', 'Lorna Nigeria Limited'),
    ('RCV-221', 'Lorna Nigeria Limited')
) as m(sku, manufacturer)
join public.suppliers s on s.name = m.manufacturer
where p.sku = m.sku
  and p.supplier_id is distinct from s.id;
