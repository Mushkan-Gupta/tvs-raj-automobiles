-- =============================================================================
-- Migration: Step A2 – Sale Form v2 + Approvals
-- Timestamp: 20261103152338
-- =============================================================================
-- Changes:
--   1. Add new columns to stock_logs (sale v2 fields)
--   2. Create pending_sales table
--   3. Create sale_items table
--   4. Create sale_item_costs table (admin-only)
--   5. RLS for all new tables
--   6. commit_sale() SQL function (service_role only, security definer)
--   7. Tighten stock_logs INSERT policy: employees may only insert type='arrival'
-- =============================================================================

-- ============================================================================
-- 1. Extend stock_logs with sale v2 fields (all nullable for backwards compat)
-- ============================================================================
alter table public.stock_logs
  add column if not exists request_id       uuid unique,
  add column if not exists original_price   numeric(12,2),
  add column if not exists discount_type    text check (discount_type in ('percent','amount')),
  add column if not exists discount_value   numeric(12,2),
  add column if not exists discount_amount  numeric(12,2),
  add column if not exists paperwork_charge numeric(12,2) default 0,
  add column if not exists modification_charge numeric(12,2) default 0,
  add column if not exists modification_note text,
  add column if not exists extras_total     numeric(12,2) default 0,
  add column if not exists final_price      numeric(12,2),
  add column if not exists approved_by      uuid,
  add column if not exists approved_at      timestamptz,
  add column if not exists sheet_synced     boolean default true;

-- ============================================================================
-- 2. Create pending_sales table
-- ============================================================================
create table if not exists public.pending_sales (
  id               uuid primary key default gen_random_uuid(),
  request_id       uuid unique not null,
  requested_by     uuid not null,
  requested_by_email text,
  -- bike_id uses the same type as bikes.id (uuid)
  bike_id          uuid references public.bikes(id) on delete restrict,
  bike_name        text,
  payload          jsonb not null,
  original_price   numeric(12,2),
  discount_amount  numeric(12,2),
  discount_percent numeric(12,2),
  final_price      numeric(12,2),
  status           text not null default 'pending'
                     check (status in ('pending','approved','rejected')),
  decided_by       uuid,
  decided_at       timestamptz,
  reject_reason    text,
  created_at       timestamptz not null default now()
);

create index if not exists idx_pending_sales_status        on public.pending_sales(status);
create index if not exists idx_pending_sales_requested_by  on public.pending_sales(requested_by);

-- ============================================================================
-- 3. Create sale_items table
-- ============================================================================
create table if not exists public.sale_items (
  id            uuid primary key default gen_random_uuid(),
  -- stock_logs.id is uuid in this project
  stock_log_id  uuid references public.stock_logs(id) on delete cascade,
  part_id       uuid references public.parts(id) on delete restrict,
  part_name     text,
  qty           int not null check (qty > 0),
  unit_price    numeric(12,2) not null,
  line_total    numeric(12,2) not null
);

create index if not exists idx_sale_items_stock_log on public.sale_items(stock_log_id);

-- ============================================================================
-- 4. Create sale_item_costs table (admin-only cost snapshot)
-- ============================================================================
create table if not exists public.sale_item_costs (
  sale_item_id uuid primary key references public.sale_items(id) on delete cascade,
  cost_snapshot numeric(12,2)
);

-- ============================================================================
-- 5. Row-Level Security
-- ============================================================================

-- --- pending_sales ---
alter table public.pending_sales enable row level security;

-- Employees see only their own requests; admins see all. No client writes.
drop policy if exists "pending_sales_select" on public.pending_sales;
create policy "pending_sales_select"
  on public.pending_sales
  for select
  using (public.is_admin() or requested_by = auth.uid());

-- No INSERT / UPDATE / DELETE from browser — service_role only via edge functions.

-- --- sale_items ---
alter table public.sale_items enable row level security;

drop policy if exists "sale_items_select" on public.sale_items;
create policy "sale_items_select"
  on public.sale_items
  for select
  using (public.is_staff());

-- No client writes.

-- --- sale_item_costs (admin only; employees must NEVER see part cost) ---
alter table public.sale_item_costs enable row level security;

drop policy if exists "sale_item_costs_select" on public.sale_item_costs;
create policy "sale_item_costs_select"
  on public.sale_item_costs
  for select
  using (public.is_admin());

-- No client writes.

-- ============================================================================
-- 6. Tighten stock_logs INSERT policy
--    Logged-in users (employees) may only insert rows where type = 'arrival'.
--    Sale rows (type = 'sale') must be written by the service_role via
--    commit_sale(), which bypasses RLS. This prevents a browser from directly
--    inserting a sale row (potentially skipping pricing / approval logic).
--
--    How we distinguish: the `type` column. Existing INSERT policy (if any)
--    allowed any type. We replace it with one that restricts to 'arrival' only.
-- ============================================================================

-- Drop any existing broad INSERT policy on stock_logs
drop policy if exists "stock_logs_insert_policy" on public.stock_logs;
drop policy if exists "Allow authenticated users to insert stock logs" on public.stock_logs;
drop policy if exists "authenticated_insert" on public.stock_logs;
-- The policy created by phase0/rls-fix.sql (allows ANY type from staff). Without dropping it,
-- policies are OR-ed and employees could still insert type = 'sale' rows directly.
drop policy if exists "Staff can insert stock_logs" on public.stock_logs;

-- New narrowed INSERT policy: staff can only log arrivals from the browser
create policy "stock_logs_arrival_insert"
  on public.stock_logs
  for insert
  with check (
    public.is_staff()
    and type = 'arrival'
  );

-- ============================================================================
-- 7. commit_sale() — transactional function, called only by service_role
--
--    Parameters (all required):
--      p_bike_id          uuid
--      p_quantity         int
--      p_logged_by        text  (employee email)
--      p_employee_id      uuid
--      p_customer_name    text
--      p_customer_phone   text
--      p_buyer_type       text
--      p_payment_status   text
--      p_amount_paid      numeric
--      p_request_id       uuid   (idempotency key)
--      p_original_price   numeric
--      p_discount_type    text
--      p_discount_value   numeric
--      p_discount_amount  numeric
--      p_paperwork_charge numeric
--      p_modification_charge numeric
--      p_modification_note   text
--      p_extras_total     numeric
--      p_final_price      numeric
--      p_approved_by      uuid   (null if no approval needed)
--      p_approved_at      timestamptz
--      p_extras           jsonb  array of {part_id, part_name, qty, unit_price}
--
--    Returns: the new stock_logs.id
-- ============================================================================
create or replace function public.commit_sale(
  p_bike_id             uuid,
  p_quantity            int,
  p_logged_by           text,
  p_employee_id         uuid,
  p_customer_name       text,
  p_customer_phone      text,
  p_buyer_type          text,
  p_payment_status      text,
  p_amount_paid         numeric,
  p_request_id          uuid,
  p_original_price      numeric,
  p_discount_type       text,
  p_discount_value      numeric,
  p_discount_amount     numeric,
  p_paperwork_charge    numeric,
  p_modification_charge numeric,
  p_modification_note   text,
  p_extras_total        numeric,
  p_final_price         numeric,
  p_approved_by         uuid,
  p_approved_at         timestamptz,
  p_extras              jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_log_id      uuid;
  v_new_qty     int;
  v_availability text;
  v_threshold   int;
  v_part        record;
  v_extra       jsonb;
  v_item_id     uuid;
  v_cost        numeric;
begin
  -- ── Idempotency: if this request_id was already committed, return existing id
  select id into v_log_id
  from public.stock_logs
  where request_id = p_request_id
  limit 1;

  if found then
    return v_log_id;
  end if;

  -- ── 1. Check bike stock ────────────────────────────────────────────────────
  select quantity, low_stock_threshold
  into v_new_qty, v_threshold
  from public.bikes
  where id = p_bike_id
  for update;  -- lock the row

  if not found then
    raise exception 'Bike not found: %', p_bike_id;
  end if;

  if v_new_qty < p_quantity then
    raise exception 'Insufficient stock: only % unit(s) available', v_new_qty;
  end if;

  v_new_qty := v_new_qty - p_quantity;
  v_availability := case when v_new_qty <= 0 then 'out_of_stock' else 'in_stock' end;

  -- ── 2. Check parts stock (extras) ─────────────────────────────────────────
  for v_extra in select * from jsonb_array_elements(coalesce(p_extras, '[]'::jsonb))
  loop
    update public.parts
    set stock_qty = stock_qty - (v_extra->>'qty')::int
    where id = (v_extra->>'part_id')::uuid
      and active = true
      and stock_qty >= (v_extra->>'qty')::int;

    if not found then
      raise exception 'Part % is out of stock or inactive (requested qty: %)',
        v_extra->>'part_name', v_extra->>'qty';
    end if;
  end loop;

  -- ── 3. Insert stock_logs row ───────────────────────────────────────────────
  insert into public.stock_logs (
    bike_id, type, quantity, logged_by,
    customer_name, customer_phone,
    request_id, original_price,
    discount_type, discount_value, discount_amount,
    paperwork_charge, modification_charge, modification_note,
    extras_total, final_price,
    approved_by, approved_at,
    sheet_synced
  ) values (
    p_bike_id, 'sale', p_quantity, p_logged_by,
    p_customer_name, p_customer_phone,
    p_request_id, p_original_price,
    p_discount_type, p_discount_value, p_discount_amount,
    p_paperwork_charge, p_modification_charge, p_modification_note,
    p_extras_total, p_final_price,
    p_approved_by, p_approved_at,
    false  -- sheet_synced=false; edge function sets true after successful write
  )
  returning id into v_log_id;

  -- ── 4. Update bike quantity and availability ───────────────────────────────
  update public.bikes
  set quantity     = v_new_qty,
      availability = v_availability
  where id = p_bike_id;

  -- ── 5. Insert sale_items + sale_item_costs ─────────────────────────────────
  for v_extra in select * from jsonb_array_elements(coalesce(p_extras, '[]'::jsonb))
  loop
    v_item_id := gen_random_uuid();

    insert into public.sale_items (
      id, stock_log_id, part_id, part_name, qty, unit_price, line_total
    ) values (
      v_item_id,
      v_log_id,
      (v_extra->>'part_id')::uuid,
      v_extra->>'part_name',
      (v_extra->>'qty')::int,
      (v_extra->>'unit_price')::numeric,
      (v_extra->>'qty')::int * (v_extra->>'unit_price')::numeric
    );

    -- Snapshot the cost price (if available; no error if missing)
    select cost_price into v_cost
    from public.part_costs
    where part_id = (v_extra->>'part_id')::uuid;

    if found then
      insert into public.sale_item_costs (sale_item_id, cost_snapshot)
      values (v_item_id, v_cost);
    end if;
  end loop;

  return v_log_id;
end;
$$;

-- Revoke execute from everyone, then grant only to service_role
revoke execute on function public.commit_sale(
  uuid, int, text, uuid, text, text, text, text, numeric,
  uuid, numeric, text, numeric, numeric, numeric, numeric, text, numeric, numeric,
  uuid, timestamptz, jsonb
) from public, anon, authenticated;

grant execute on function public.commit_sale(
  uuid, int, text, uuid, text, text, text, text, numeric,
  uuid, numeric, text, numeric, numeric, numeric, numeric, text, numeric, numeric,
  uuid, timestamptz, jsonb
) to service_role;