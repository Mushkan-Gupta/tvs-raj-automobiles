// =============================================================================
// update-order-status/index.ts
// Supabase Edge Function — staff changes the status of an online order
//
// Auth: admin or employee (requireRole). Method: POST
//
// Body (JSON):
//   order_id     string (uuid)
//   status       "packed" | "shipped" | "delivered" | "cancelled"
//   courier      string (needed for home delivery when shipping)
//   tracking_no  string (optional)
//   reason       string (needed when cancelling)
//
// The rules (allowed steps, stock leaving the shop, releasing reservations,
// paid on delivery) live in the set_order_status() SQL function and run in
// one transaction. After it succeeds the Google Sheet is updated: the order
// row in the "Orders" tab and the Stock cells of the parts that changed.
// A Sheet problem never undoes the status change; it is reported in
// `sheet.ok` / `sheet.error`.
//
// Response 200: { order_no, old_status, new_status, no_change, sheet }
// Response 409: { error, code: "out_of_stock", part_name, available }
// =============================================================================

import { createClient } from "npm:@supabase/supabase-js@2";
import { CORS_HEADERS, requireRole } from "../_shared/auth.ts";
import { validateStatusInput } from "../_shared/order_status_input.ts";
import { upsertOrderRow } from "../_shared/orders_sheet.ts";
import { updatePartStockCells } from "../_shared/parts_sheet.ts";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

// Messages raised on purpose by set_order_status() that are safe to show.
const SAFE_MESSAGES = [
  "Invalid status",
  "Order not found",
  "Courier name is required",
  "Cancel reason is required",
];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed. Use POST." }, 405);
  }

  const auth = await requireRole(req, ["admin", "employee"]);
  if (auth instanceof Response) return auth;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON in request body." }, 400);
  }

  const checked = validateStatusInput(body);
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

  const { data, error } = await admin.rpc("set_order_status", {
    p_order_id: input.order_id,
    p_status: input.status,
    p_courier: input.courier,
    p_tracking: input.tracking_no,
    p_reason: input.reason,
  });

  if (error) {
    const msg = error.message ?? "";
    if (msg.startsWith("STOCK:")) {
      const [, partName, available] = msg.split(":");
      const n = Number(available);
      return jsonResponse({
        error: `Not enough stock of "${partName}" on the shelf (${Number.isFinite(n) ? n : 0} left). ` +
          `Fix the stock in Parts first, then try again.`,
        code: "out_of_stock",
        part_name: partName,
        available: Number.isFinite(n) ? n : 0,
      }, 409);
    }
    if (SAFE_MESSAGES.includes(msg) || msg.startsWith("Cannot change status from")) {
      return jsonResponse({ error: msg }, msg === "Order not found" ? 404 : 400);
    }
    console.error("update-order-status: rpc failed", msg);
    return jsonResponse({ error: "Could not update the order. Please try again." }, 500);
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return jsonResponse({ error: "Could not update the order." }, 500);

  // Sheet copy (best effort)
  let sheet: { ok: boolean; error?: string } = { ok: true };
  if (!row.no_change) {
    const orderRes = await upsertOrderRow(input.order_id);
    const partIds: string[] = Array.isArray(row.changed_part_ids) ? row.changed_part_ids : [];
    const stockRes = partIds.length > 0 ? await updatePartStockCells(partIds) : { ok: true };
    sheet = {
      ok: orderRes.ok && stockRes.ok,
      error: [orderRes.error, stockRes.error].filter(Boolean).join(" | ") || undefined,
    };
    if (!sheet.ok) console.error("update-order-status: sheet sync problem", sheet.error);
  }

  return jsonResponse({
    order_no: row.order_no,
    old_status: row.old_status,
    new_status: row.new_status,
    no_change: row.no_change === true,
    sheet,
  });
});
