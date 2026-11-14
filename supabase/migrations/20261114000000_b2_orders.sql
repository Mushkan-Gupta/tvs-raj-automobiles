-- Online orders for parts (Step 3: Cash on Delivery and store pickup).
-- Orders are created ONLY by the create_order() function through the
-- create-order edge function. A customer can read only their own orders.
-- Staff can read all orders. Cost prices are admin-only.
-- Run once in the Supabase SQL Editor. Safe to run again.

create sequence if not exists public.order_no_seq start 1001;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_no text not null unique
    default ('TVS-' || lpad(nextval('public.order_no_seq')::text, 6, '0')),
  user_id uuid references auth.users(id) on delete set null,
  request_id uuid not null unique,
  customer_name text not null,
  customer_phone text not null,
  customer_email text,
  delivery_method text not null check (delivery_method in ('delivery', 'pickup')),
  ship_city text,
  ship_area text,
  ship_landmark text,
  ship_note text,
  payment_method text not null check (payment_method in ('cod', 'khalti', 'fonepay')),
  payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid', 'paid', 'failed', 'refunded')),
  status text not null default 'new'
    check (status in ('new', 'packed', 'shipped', 'delivered', 'cancelled')),
  subtotal numeric not null check (subtotal >= 0),
  delivery_fee numeric not null check (delivery_fee >= 0),
  total numeric not null check (total >= 0),
  courier text,
  tracking_no text,
  cancel_reason text,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_orders_user on public.orders (user_id, created_at desc);
create index if not exists idx_orders_status on public.orders (status, created_at desc);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  part_id uuid references public.parts(id) on delete set null,
  part_name text not null,
  qty int not null check (qty between 1 and 99),
  unit_price numeric not null check (unit_price >= 0),
  line_total numeric not null check (line_total >= 0)
);
create index if not exists idx_order_items_order on public.order_items (order_id);

-- Cost snapshot per item (admin only, used for profit).
create table if not exists public.order_item_costs (
  order_item_id uuid primary key references public.order_items(id) on delete cascade,
  cost_snapshot numeric not null
);

alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_item_costs enable row level security;

drop policy if exists "orders_select" on public.orders;
create policy "orders_select" on public.orders for select to authenticated
  using (user_id = auth.uid() or public.is_staff());

drop policy if exists "order_items_select" on public.order_items;
create policy "order_items_select" on public.order_items for select to authenticated
  using (
    public.is_staff()
    or exists (select 1 from public.orders o
               where o.id = order_items.order_id and o.user_id = auth.uid())
  );

drop policy if exists "order_item_costs_select" on public.order_item_costs;
create policy "order_item_costs_select" on public.order_item_costs for select to authenticated
  using (public.is_admin());

-- Browsers can only read. All writes go through create_order() (service role).
grant select on public.orders, public.order_items, public.order_item_costs to authenticated;

-- ---------------------------------------------------------------------------
-- create_order(): one transaction. Prices come from the parts table, never
-- from the browser. Stock is reduced here and cannot go below zero.
-- Delivery fee: pickup 0, delivery paid on delivery (cod) 500, delivery paid
-- online 250.
-- ---------------------------------------------------------------------------
create or replace function public.create_order(
  p_user_id         uuid,
  p_request_id      uuid,
  p_name            text,
  p_phone           text,
  p_email           text,
  p_delivery_method text,
  p_payment_method  text,
  p_city            text,
  p_area            text,
  p_landmark        text,
  p_note            text,
  p_items           jsonb
)
returns table (order_id uuid, order_no text, subtotal numeric,
               delivery_fee numeric, total numeric, was_duplicate boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order   public.orders%rowtype;
  v_item    jsonb;
  v_part    public.parts%rowtype;
  v_qty     int;
  v_subtotal numeric := 0;
  v_fee     numeric;
  v_item_id uuid;
  v_cost    numeric;
  v_seen    uuid[] := '{}';
  v_part_id uuid;
begin
  -- Idempotency: same request_id returns the existing order.
  select * into v_order from public.orders where request_id = p_request_id;
  if found then
    return query select v_order.id, v_order.order_no, v_order.subtotal,
                        v_order.delivery_fee, v_order.total, true;
    return;
  end if;

  -- Basic checks (the edge function checks too; this is the last line).
  if p_user_id is null then raise exception 'Login required'; end if;
  if char_length(trim(coalesce(p_name, ''))) < 2 then raise exception 'Invalid name'; end if;
  if coalesce(p_phone, '') !~ '^\+?[0-9]{8,15}$' then raise exception 'Invalid phone number'; end if;
  if p_delivery_method not in ('delivery', 'pickup') then raise exception 'Invalid delivery method'; end if;
  if p_payment_method not in ('cod', 'khalti', 'fonepay') then raise exception 'Invalid payment method'; end if;
  if p_delivery_method = 'delivery' and (
       char_length(trim(coalesce(p_city, ''))) < 2
       or char_length(trim(coalesce(p_area, ''))) < 2) then
    raise exception 'Delivery address is incomplete';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 50 then
    raise exception 'Cart is empty or too large';
  end if;

  v_fee := case
    when p_delivery_method = 'pickup' then 0
    when p_payment_method = 'cod' then 500
    else 250
  end;

  insert into public.orders (
    user_id, request_id, customer_name, customer_phone, customer_email,
    delivery_method, ship_city, ship_area, ship_landmark, ship_note,
    payment_method, subtotal, delivery_fee, total
  ) values (
    p_user_id, p_request_id, trim(p_name), p_phone, nullif(trim(coalesce(p_email, '')), ''),
    p_delivery_method,
    case when p_delivery_method = 'delivery' then trim(p_city) end,
    case when p_delivery_method = 'delivery' then trim(p_area) end,
    case when p_delivery_method = 'delivery' then nullif(trim(coalesce(p_landmark, '')), '') end,
    nullif(trim(coalesce(p_note, '')), ''),
    p_payment_method, 0, v_fee, v_fee
  ) returning * into v_order;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_part_id := (v_item->>'part_id')::uuid;
    v_qty := (v_item->>'qty')::int;
    if v_qty is null or v_qty < 1 or v_qty > 99 then raise exception 'Invalid quantity'; end if;
    if v_part_id = any(v_seen) then raise exception 'Duplicate item in cart'; end if;
    v_seen := v_seen || v_part_id;

    -- Atomic: take stock only if enough is available and the part is active.
    update public.parts
       set stock_qty = stock_qty - v_qty
     where id = v_part_id and active = true and stock_qty >= v_qty
     returning * into v_part;

    if not found then
      select * into v_part from public.parts where id = v_part_id;
      raise exception 'STOCK:%:%', coalesce(v_part.name, 'This item'),
        coalesce(case when v_part.active then v_part.stock_qty end, 0);
    end if;

    v_item_id := gen_random_uuid();
    insert into public.order_items (id, order_id, part_id, part_name, qty, unit_price, line_total)
    values (v_item_id, v_order.id, v_part.id, v_part.name, v_qty, v_part.price, v_part.price * v_qty);

    select cost_price into v_cost from public.part_costs where part_id = v_part.id;
    if found then
      insert into public.order_item_costs (order_item_id, cost_snapshot) values (v_item_id, v_cost);
    end if;

    v_subtotal := v_subtotal + v_part.price * v_qty;
  end loop;

  update public.orders
     set subtotal = v_subtotal, total = v_subtotal + v_fee
   where id = v_order.id
   returning * into v_order;

  return query select v_order.id, v_order.order_no, v_order.subtotal,
                      v_order.delivery_fee, v_order.total, false;
end;
$$;

revoke all on function public.create_order(uuid, uuid, text, text, text, text, text, text, text, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.create_order(uuid, uuid, text, text, text, text, text, text, text, text, text, jsonb)
  to service_role;
