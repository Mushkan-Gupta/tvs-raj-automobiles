// =============================================================================
// create-order/index.ts
// Supabase Edge Function — place an online parts order (customer, signed in)
//
// Auth: any signed-in user (requireUser). Staff may also order.
// Method: POST
//
// Body (JSON):
//   request_id       string (uuid, made by the browser, idempotency key)
//   delivery_method  "delivery" | "pickup"
//   payment_method   "cod"   (khalti and fonepay come later)
//   name, phone      string
//   address          { city, area, landmark }   (needed for delivery)
//   note             string (optional)
//   items            Array<{ part_id: uuid, qty: int 1..99 }>
//
// The browser NEVER sends prices or fees. Prices, stock and the delivery
// fee are decided inside the create_order() SQL function in one transaction.
//
// Response 200: { order_id, order_no, subtotal, delivery_fee, total, duplicate }
// Response 409: { error, code: "out_of_stock", part_name, available }
// =============================================================================

import { createClient } from "npm:@supabase/supabase-js@2";
import { CORS_HEADERS, requireUser } from "../_shared/auth.ts";
import { validateOrderInput } from "../_shared/order_input.ts";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

const MAX_ORDERS_PER_HOUR = 10;

// Messages raised on purpose by create_order() that are safe to show.
const SAFE_MESSAGES = [
  "Login required",
  "Invalid name",
  "Invalid phone number",
  "Invalid delivery method",
  "Invalid payment method",
  "Delivery address is incomplete",
  "Cart is empty or too large",
  "Invalid quantity",
  "Duplicate item in cart",
];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed. Use POST." }, 405);
  }

  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON in request body." }, 400);
  }

  const checked = validateOrderInput(body);
  if (!checked.ok) return jsonResponse({ error: checked.error }, 400);
  const input = checked.value;

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "Server configuration error." }, 500);
  }
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Simple abuse limit: at most 10 orders per user per hour.
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error: countError } = await admin
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("user_id", auth.userId)
    .gte("created_at", since);
  if (countError) {
    console.error("create-order: rate check failed", countError.message);
    return jsonResponse({ error: "Could not place the order. Please try again." }, 500);
  }
  if ((count ?? 0) >= MAX_ORDERS_PER_HOUR) {
    return jsonResponse({ error: "Too many orders in the last hour. Please try later." }, 429);
  }

  const { data, error } = await admin.rpc("create_order", {
    p_user_id: auth.userId,
    p_request_id: input.request_id,
    p_name: input.name,
    p_phone: input.phone,
    p_email: auth.email ?? null,
    p_delivery_method: input.delivery_method,
    p_payment_method: input.payment_method,
    p_city: input.city,
    p_area: input.area,
    p_landmark: input.landmark,
    p_note: input.note,
    p_items: input.items,
  });

  if (error) {
    const msg = error.message ?? "";
    if (msg.startsWith("STOCK:")) {
      const [, partName, available] = msg.split(":");
      const n = Number(available);
      return jsonResponse({
        error: n > 0
          ? `Only ${n} of "${partName}" available. Please update your cart.`
          : `"${partName}" is out of stock or no longer available. Please update your cart.`,
        code: "out_of_stock",
        part_name: partName,
        available: Number.isFinite(n) ? n : 0,
      }, 409);
    }
    if (SAFE_MESSAGES.includes(msg)) return jsonResponse({ error: msg }, 400);
    console.error("create-order: rpc failed", msg);
    return jsonResponse({ error: "Could not place the order. Please try again." }, 500);
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return jsonResponse({ error: "Could not place the order." }, 500);

  return jsonResponse({
    order_id: row.order_id,
    order_no: row.order_no,
    subtotal: Number(row.subtotal),
    delivery_fee: Number(row.delivery_fee),
    total: Number(row.total),
    duplicate: row.was_duplicate === true,
  });
});
