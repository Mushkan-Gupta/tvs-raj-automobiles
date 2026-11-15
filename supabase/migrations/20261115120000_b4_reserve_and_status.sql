-- Step 4a: reserve stock when an online order is placed, reduce real stock
-- when the order leaves the shop (Shipped, or Delivered for pickup), and a
-- status function for staff (Packed, Shipped, Delivered, Cancelled).
-- Run once in the Supabase SQL Editor AFTER orders.sql. Safe to run again.
--
-- available to customers = stock_qty - reserved_qty

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'parts' and column_name = 'reserved_qty'
  ) then
    alter table public.parts
      add column reserved_qty int not null default 0 check (reserved_qty >= 0);
    alter table public.orders
      add column if not exists stock_released boolean not null default false;

    -- One-time conversion of orders placed with the old rule (stock was taken
    -- at order time): open orders go back to "reserved", left-the-shop orders
    -- are marked as already released.
    update public.parts p
       set stock_qty = p.stock_qty + s.q,
           reserved_qty = p.reserved_qty + s.q
      from (
        select oi.part_id, sum(oi.qty)::int as q
          from public.order_items oi
          join public.orders o on o.id = oi.order_id
         where o.status in ('new', 'packed') and oi.part_id is not null
         group by oi.part_id
      ) s
     where p.id = s.part_id;

    update public.orders set stock_released = true where status in ('shipped', 'delivered');
  end if;
end $$;

alter table public.orders add column if not exists stock_released boolean not null default false;

-- ---------------------------------------------------------------------------
-- create_order(): now RESERVES stock instead of taking it.
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
  select * into v_order from public.orders where request_id = p_request_id;
  if found then
    return query select v_order.id, v_order.order_no, v_order.subtotal,
                        v_order.delivery_fee, v_order.total, true;
    return;
  end if;

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

    -- Atomic: reserve only if (stock - reserved) is enough and the part is active.
    update public.parts
       set reserved_qty = reserved_qty + v_qty
     where id = v_part_id and active = true and stock_qty - reserved_qty >= v_qty
     returning * into v_part;

    if not found then
      select * into v_part from public.parts where id = v_part_id;
      raise exception 'STOCK:%:%', coalesce(v_part.name, 'This item'),
        coalesce(case when v_part.active then greatest(v_part.stock_qty - v_part.reserved_qty, 0) end, 0);
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

-- ---------------------------------------------------------------------------
-- set_order_status(): staff status changes, one transaction.
--   new      -> packed | shipped | delivered(pickup) | cancelled
--   packed   -> shipped | delivered(pickup) | cancelled
--   shipped  -> delivered | cancelled
-- Real stock leaves (and the reservation ends) the first time the order
-- becomes Shipped or Delivered. Cancelling before that only drops the
-- reservation; cancelling after returns the stock.
-- Delivered: cash on delivery / pay at the shop counts as paid.
-- Returns the parts whose stock changed so the Sheet can be updated.
-- ---------------------------------------------------------------------------
create or replace function public.set_order_status(
  p_order_id uuid,
  p_status   text,
  p_courier  text,
  p_tracking text,
  p_reason   text
)
returns table (order_id uuid, order_no text, old_status text, new_status text,
               changed_part_ids uuid[], no_change boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_old   text;
  v_item  record;
  v_part  public.parts%rowtype;
  v_ids   uuid[] := '{}';
  v_pay   text;
begin
  if p_status not in ('packed', 'shipped', 'delivered', 'cancelled') then
    raise exception 'Invalid status';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  v_old := v_order.status;

  if v_old = p_status then
    return query select v_order.id, v_order.order_no, v_old, v_old, v_ids, true;
    return;
  end if;

  if not (
       (v_old = 'new'     and p_status in ('packed', 'shipped', 'cancelled'))
    or (v_old = 'new'     and p_status = 'delivered' and v_order.delivery_method = 'pickup')
    or (v_old = 'packed'  and p_status in ('shipped', 'cancelled'))
    or (v_old = 'packed'  and p_status = 'delivered' and v_order.delivery_method = 'pickup')
    or (v_old = 'shipped' and p_status in ('delivered', 'cancelled'))
  ) then
    raise exception 'Cannot change status from % to %', v_old, p_status;
  end if;

  if p_status = 'shipped' and v_order.delivery_method = 'delivery'
     and char_length(trim(coalesce(p_courier, ''))) < 2 then
    raise exception 'Courier name is required';
  end if;
  if p_status = 'cancelled' and char_length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'Cancel reason is required';
  end if;

  -- Stock leaves the shop (first time Shipped or Delivered)
  if p_status in ('shipped', 'delivered') and not v_order.stock_released then
    for v_item in
      select oi.part_id, oi.qty from public.order_items oi
       where oi.order_id = v_order.id and oi.part_id is not null
    loop
      update public.parts
         set stock_qty = stock_qty - v_item.qty,
             reserved_qty = greatest(reserved_qty - v_item.qty, 0)
       where id = v_item.part_id and stock_qty >= v_item.qty
       returning * into v_part;
      if not found then
        select * into v_part from public.parts where id = v_item.part_id;
        raise exception 'STOCK:%:%', coalesce(v_part.name, 'This item'), coalesce(v_part.stock_qty, 0);
      end if;
      v_ids := v_ids || v_item.part_id;
    end loop;
    v_order.stock_released := true;
  end if;

  -- Cancel: drop the reservation, or give the stock back if it already left
  if p_status = 'cancelled' then
    for v_item in
      select oi.part_id, oi.qty from public.order_items oi
       where oi.order_id = v_order.id and oi.part_id is not null
    loop
      if v_order.stock_released then
        update public.parts set stock_qty = stock_qty + v_item.qty where id = v_item.part_id;
        v_ids := v_ids || v_item.part_id;
      else
        update public.parts
           set reserved_qty = greatest(reserved_qty - v_item.qty, 0)
         where id = v_item.part_id;
      end if;
    end loop;
  end if;

  v_pay := v_order.payment_status;
  if p_status = 'delivered' and v_pay = 'unpaid' then v_pay := 'paid'; end if;
  if p_status = 'cancelled' and v_pay = 'paid' then v_pay := 'refunded'; end if;

  update public.orders
     set status = p_status,
         stock_released = v_order.stock_released,
         payment_status = v_pay,
         courier = case when p_status = 'shipped' then nullif(trim(coalesce(p_courier, '')), '') else courier end,
         tracking_no = case when p_status = 'shipped' then nullif(trim(coalesce(p_tracking, '')), '') else tracking_no end,
         cancel_reason = case when p_status = 'cancelled' then trim(p_reason) else cancel_reason end,
         cancelled_at = case when p_status = 'cancelled' then now() else cancelled_at end,
         updated_at = now()
   where id = v_order.id;

  return query select v_order.id, v_order.order_no, v_old, p_status, v_ids, false;
end;
$$;

revoke all on function public.set_order_status(uuid, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.set_order_status(uuid, text, text, text, text) to service_role;

-- service_role needs to read/update the order tables and parts (idempotent)
grant select, insert, update, delete
  on public.orders, public.order_items, public.order_item_costs to service_role;
