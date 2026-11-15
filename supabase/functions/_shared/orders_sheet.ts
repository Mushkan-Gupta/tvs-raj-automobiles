// =============================================================================
// _shared/orders_sheet.ts — Google Sheets copy of online orders ("Orders" tab)
//
// One row per order, matched by Order No. Created on the first order, updated
// whenever the status changes. One-way copy of Supabase (database is the
// master). Never throws: returns { ok, error? } so a Sheet problem can never
// break an order. Cost prices are NOT written here.
// =============================================================================

import { createClient } from "npm:@supabase/supabase-js@2";
import { ensureHeaders, fetchSheetValues, colToLetter } from "./google.ts";
import { ensureSheetTabExists, formatNepalTime, getGoogleContext } from "./parts_sheet.ts";

export const ORDERS_TAB_NAME = "Orders";

export const ORDERS_HEADERS = [
  "Order No",
  "Date",
  "Customer",
  "Phone",
  "Delivery Method",
  "City",
  "Tole/Village",
  "Landmark",
  "Note",
  "Items",
  "Subtotal",
  "Delivery Fee",
  "Total",
  "Payment Method",
  "Payment Status",
  "Status",
  "Courier",
  "Tracking No",
  "Cancel Reason",
  "Last Updated",
];

export interface OrderForSheet {
  order_no: string;
  created_at: string;
  customer_name: string;
  customer_phone: string;
  delivery_method: string;
  ship_city?: string | null;
  ship_area?: string | null;
  ship_landmark?: string | null;
  ship_note?: string | null;
  subtotal: number;
  delivery_fee: number;
  total: number;
  payment_method: string;
  payment_status: string;
  status: string;
  courier?: string | null;
  tracking_no?: string | null;
  cancel_reason?: string | null;
}

export interface ItemForSheet {
  part_name: string;
  qty: number;
}

const LABELS: Record<string, string> = {
  delivery: "Home delivery",
  pickup: "Shop pickup",
  cod: "Cash on delivery",
  khalti: "Khalti",
  fonepay: "Fonepay QR",
  new: "New",
  packed: "Packed",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  unpaid: "Unpaid",
  paid: "Paid",
  failed: "Failed",
  refunded: "Refunded",
};

function label(v: string): string {
  return LABELS[v] ?? v;
}

/** Plain text for the Items cell, e.g. "Helmet x2; Gloves x1". */
export function itemsText(items: ItemForSheet[]): string {
  return items.map((i) => `${i.part_name} x${i.qty}`).join("; ");
}

/** Builds one row in the order of the sheet's own headers (matched by name). */
export function buildOrderRow(
  headers: string[],
  order: OrderForSheet,
  items: ItemForSheet[],
  now = new Date(),
): (string | number)[] {
  const byName: Record<string, string | number> = {
    "order no": order.order_no,
    "date": formatNepalTime(new Date(order.created_at)),
    "customer": order.customer_name,
    "phone": order.customer_phone,
    "delivery method": label(order.delivery_method),
    "city": order.ship_city ?? "",
    "tole/village": order.ship_area ?? "",
    "landmark": order.ship_landmark ?? "",
    "note": order.ship_note ?? "",
    "items": itemsText(items),
    "subtotal": Number(order.subtotal),
    "delivery fee": Number(order.delivery_fee),
    "total": Number(order.total),
    "payment method": label(order.payment_method),
    "payment status": label(order.payment_status),
    "status": label(order.status),
    "courier": order.courier ?? "",
    "tracking no": order.tracking_no ?? "",
    "cancel reason": order.cancel_reason ?? "",
    "last updated": formatNepalTime(now),
  };
  return headers.map((h) => byName[h.trim().toLowerCase()] ?? "");
}

/** Creates or updates the row for one order. */
export async function upsertOrderRow(orderId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return { ok: false, error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY." };
    }
    const sb = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: order, error: oErr } = await sb
      .from("orders")
      .select(
        "order_no, created_at, customer_name, customer_phone, delivery_method, ship_city, ship_area, ship_landmark, ship_note, subtotal, delivery_fee, total, payment_method, payment_status, status, courier, tracking_no, cancel_reason",
      )
      .eq("id", orderId)
      .maybeSingle();
    if (oErr || !order) {
      return { ok: false, error: `Order not found for Sheet sync: ${oErr?.message ?? orderId}` };
    }
    const { data: items, error: iErr } = await sb
      .from("order_items")
      .select("part_name, qty")
      .eq("order_id", orderId)
      .order("part_name");
    if (iErr) return { ok: false, error: `Could not load order items: ${iErr.message}` };

    const { accessToken, sheetId } = await getGoogleContext();
    await ensureSheetTabExists(accessToken, sheetId, ORDERS_TAB_NAME);
    const headers = await ensureHeaders(accessToken, sheetId, ORDERS_TAB_NAME, ORDERS_HEADERS);

    const row = buildOrderRow(headers, order as OrderForSheet, (items ?? []) as ItemForSheet[]);
    const lastCol = colToLetter(headers.length);

    // Find the existing row by Order No
    const keyIdx = headers.findIndex((h) => h.trim().toLowerCase() === "order no");
    const keyCol = colToLetter((keyIdx === -1 ? 0 : keyIdx) + 1);
    const keyCells = await fetchSheetValues(accessToken, sheetId, `${ORDERS_TAB_NAME}!${keyCol}:${keyCol}`);
    let rowNumber = -1;
    for (let r = 1; r < keyCells.length; r++) {
      if (String(keyCells[r]?.[0] ?? "").trim() === order.order_no) {
        rowNumber = r + 1; // 1-based
        break;
      }
    }

    // RAW keeps phone numbers and text exactly as written.
    if (rowNumber > 0) {
      const range = `${ORDERS_TAB_NAME}!A${rowNumber}:${lastCol}${rowNumber}`;
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}?valueInputOption=RAW`;
      const res = await fetch(url, {
        method: "PUT",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ range, majorDimension: "ROWS", values: [row] }),
      });
      if (!res.ok) return { ok: false, error: `Sheet update failed: ${await res.text()}` };
    } else {
      const range = `${ORDERS_TAB_NAME}!A:A`;
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;
      const res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ majorDimension: "ROWS", values: [row] }),
      });
      if (!res.ok) return { ok: false, error: `Sheet append failed: ${await res.text()}` };
    }
    return { ok: true };
  } catch (err) {
    console.error("[orders_sheet:upsertOrderRow]", err);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
