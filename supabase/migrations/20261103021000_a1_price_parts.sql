-- Migration: Step A1 - Bike Price & Parts Management
-- Description:
-- 1. Ensure `price` and `price_confirmed` columns on `bikes`
-- 2. Create `parts`, `part_costs`, and `bike_parts` tables
-- 3. Configure Row-Level Security (RLS) policies for all three tables
-- 4. Create public storage bucket `product-images` with RLS policies

-- ============================================================================
-- 0. Helper Functions for Roles (if not already defined)
-- ============================================================================
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.is_staff()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where id = auth.uid() and role in ('admin', 'employee')
  );
$$;

-- Grant execution to authenticated & anon roles
grant execute on function public.is_admin() to authenticated, anon;
grant execute on function public.is_staff() to authenticated, anon;

-- ============================================================================
-- 1. Alter `bikes` table
-- ============================================================================
alter table public.bikes
  add column if not exists price numeric(12,2),
  add column if not exists price_confirmed boolean not null default false;

-- ============================================================================
-- 2. Create `parts` table
-- ============================================================================
create table if not exists public.parts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  description text,
  price numeric(12,2) not null default 0,
  stock_qty int not null default 0,
  low_stock_threshold int not null default 3,
  image_url text,
  is_pinned boolean not null default false,
  fits_all boolean not null default false,
  active boolean not null default true,
  sort_order int default 0,
  created_at timestamptz default now()
);

-- ============================================================================
-- 3. Create `part_costs` table (Admin-only cost price)
-- ============================================================================
create table if not exists public.part_costs (
  part_id uuid primary key references public.parts(id) on delete cascade,
  cost_price numeric(12,2) not null default 0
);

-- ============================================================================
-- 4. Create `bike_parts` table (Many-to-Many mapping)
-- ============================================================================
create table if not exists public.bike_parts (
  bike_id uuid references public.bikes(id) on delete cascade,
  part_id uuid references public.parts(id) on delete cascade,
  primary key (bike_id, part_id)
);

-- Indexes for performance
create index if not exists idx_parts_active on public.parts(active);
create index if not exists idx_parts_pinned_sort on public.parts(is_pinned desc, sort_order asc, name asc);
create index if not exists idx_bike_parts_part on public.bike_parts(part_id);

-- ============================================================================
-- 5. Row-Level Security (RLS)
-- ============================================================================

-- --- parts ---
alter table public.parts enable row level security;

drop policy if exists "parts_select_policy" on public.parts;
create policy "parts_select_policy"
  on public.parts
  for select
  using (active = true or public.is_staff());

drop policy if exists "parts_insert_policy" on public.parts;
create policy "parts_insert_policy"
  on public.parts
  for insert
  with check (public.is_admin());

drop policy if exists "parts_update_policy" on public.parts;
create policy "parts_update_policy"
  on public.parts
  for update
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "parts_delete_policy" on public.parts;
create policy "parts_delete_policy"
  on public.parts
  for delete
  using (public.is_admin());

-- --- part_costs (Admin only: never accessible to public or employees) ---
alter table public.part_costs enable row level security;

drop policy if exists "part_costs_admin_all_policy" on public.part_costs;
create policy "part_costs_admin_all_policy"
  on public.part_costs
  for all
  using (public.is_admin())
  with check (public.is_admin());

-- --- bike_parts ---
alter table public.bike_parts enable row level security;

drop policy if exists "bike_parts_select_policy" on public.bike_parts;
create policy "bike_parts_select_policy"
  on public.bike_parts
  for select
  using (true);

drop policy if exists "bike_parts_insert_policy" on public.bike_parts;
create policy "bike_parts_insert_policy"
  on public.bike_parts
  for insert
  with check (public.is_admin());

drop policy if exists "bike_parts_update_policy" on public.bike_parts;
create policy "bike_parts_update_policy"
  on public.bike_parts
  for update
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "bike_parts_delete_policy" on public.bike_parts;
create policy "bike_parts_delete_policy"
  on public.bike_parts
  for delete
  using (public.is_admin());

-- ============================================================================
-- 6. Storage Bucket & Policies: `product-images`
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do update set public = true;

drop policy if exists "product_images_select_policy" on storage.objects;
create policy "product_images_select_policy"
  on storage.objects
  for select
  using (bucket_id = 'product-images');

drop policy if exists "product_images_insert_policy" on storage.objects;
create policy "product_images_insert_policy"
  on storage.objects
  for insert
  with check (bucket_id = 'product-images' and public.is_admin());

drop policy if exists "product_images_update_policy" on storage.objects;
create policy "product_images_update_policy"
  on storage.objects
  for update
  using (bucket_id = 'product-images' and public.is_admin())
  with check (bucket_id = 'product-images' and public.is_admin());

drop policy if exists "product_images_delete_policy" on storage.objects;
create policy "product_images_delete_policy"
  on storage.objects
  for delete
  using (bucket_id = 'product-images' and public.is_admin());
