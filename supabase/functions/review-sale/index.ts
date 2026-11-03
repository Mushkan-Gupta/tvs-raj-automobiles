// =============================================================================
// review-sale/index.ts
// Supabase Edge Function — Admin reviews a pending sale (approve / reject)
//
// Auth: admin only
// Method: POST
//
// Body (JSON):
//   pending_id    string (uuid of pending_sales row)
//   decision      "approve" | "reject"
//   reject_reason string (required when decision = "reject")
// =============================================================================

import { createClient } from "npm:@supabase/supabase-js@2";
import { CORS_HEADERS, requireRole } from "../_shared/auth.ts";
import { getGoogleAccessToken, ensureHeaders } from "../_shared/google.ts";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

const A2_SOLD_HEADERS = [
  "Original Price", "Discount Type", "Discount Value", "Discount Amount",
  "Paperwork Charge", "Modification Charge", "Modification Note",
  "Extra Products", "Extra Products Total", "Final Price",
  "Approval Status", "Approved By",
];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed. Use POST." }, 405);
  }

  // ── Auth: admin only ───────────────────────────────────────────────────────
  const auth = await requireRole(req, ["admin"]);
  if (auth instanceof Response) return auth;
  const { userId: adminId, email: adminEmail } = auth;

  // ── Parse body ─────────────────────────────────────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON in request body." }, 400);
  }

  const pending_id = String(body.pending_id ?? "").trim();
  const decision = String(body.decision ?? "").trim();
  const reject_reason = String(body.reject_reason ?? "").trim().slice(0, 1000);

  if (!pending_id) return jsonResponse({ error: "pending_id is required." }, 400);
  if (!["approve", "reject"].includes(decision))
    return jsonResponse({ error: "decision must be 'approve' or 'reject'." }, 400);
  if (decision === "reject" && !reject_reason)
    return jsonResponse({ error: "reject_reason is required when rejecting." }, 400);

  // ── Service-role client ────────────────────────────────────────────────────
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // ── Load pending sale ──────────────────────────────────────────────────────
  const { data: pending, error: pendErr } = await sb
    .from("pending_sales")
    .select("*")
    .eq("id", pending_id)
    .single();

  if (pendErr || !pending) {
    return jsonResponse({ error: "Pending sale not found." }, 404);
  }
  if (pending.status !== "pending") {
    return jsonResponse({
      error: `Sale is already ${pending.status}.`,
    }, 409);
  }

  // ── Reject path ────────────────────────────────────────────────────────────
  if (decision === "reject") {
    await sb
      .from("pending_sales")
      .update({
        status: "rejected",
        decided_by: adminId,
        decided_at: new Date().toISOString(),
        reject_reason,
      })
      .eq("id", pending_id);

    return jsonResponse({ status: "rejected", pending_id });
  }

  // ── Approve path ───────────────────────────────────────────────────────────
  // Re-load payload (the negotiated prices stored at request time)
  const payload = pending.payload as Record<string, unknown>;

  // Re-check stock
  const { data: bike } = await sb
    .from("bikes")
    .select("id, name, price, quantity")
    .eq("id", String(pending.bike_id))
    .single();

  if (!bike) return jsonResponse({ error: "Bike not found." }, 404);

  const qty = parseInt(String(payload.quantity ?? "1"), 10);
  if (bike.quantity < qty) {
    return jsonResponse({
      error: `Insufficient stock: only ${bike.quantity} unit(s) available now.`,
    }, 422);
  }

  // Build extras for commit
  const extrasRaw = Array.isArray(payload.extras)
    ? (payload.extras as Record<string, unknown>[])
    : [];
  const partIds = extrasRaw.map((e) => String(e.part_id));
  let partsMap = new Map<string, { id: string; name: string; price: number; stock_qty: number }>();

  if (partIds.length > 0) {
    const { data: partsData } = await sb
      .from("parts")
      .select("id, name, price, stock_qty")
      .in("id", partIds);

    for (const p of partsData ?? []) {
      partsMap.set(p.id, p);
    }

    // Re-check parts stock
    for (const ex of extrasRaw) {
      const part = partsMap.get(String(ex.part_id));
      const exQty = parseInt(String(ex.qty), 10);
      if (!part || part.stock_qty < exQty) {
        return jsonResponse({
          error: `Part "${part?.name ?? ex.part_id}" no longer has sufficient stock.`,
        }, 422);
      }
    }
  }

  const extrasForCommit = extrasRaw.map((ex) => {
    const part = partsMap.get(String(ex.part_id));
    return {
      part_id: String(ex.part_id),
      part_name: part?.name ?? String(ex.part_id),
      qty: parseInt(String(ex.qty), 10),
      unit_price: Number(part?.price ?? 0),
    };
  });

  const approvedAt = new Date().toISOString();

  // Commit the sale using the stored (negotiated) numbers
  let saleLogId: number;
  try {
    const { data: commitData, error: commitErr } = await sb.rpc("commit_sale", {
      p_bike_id: String(pending.bike_id),
      p_quantity: qty,
      p_logged_by: String(pending.requested_by_email ?? "unknown"),
      p_employee_id: pending.requested_by,
      p_customer_name: String(payload.customer_name ?? ""),
      p_customer_phone: String(payload.customer_phone ?? ""),
      p_buyer_type: String(payload.buyer_type ?? "Individual"),
      p_payment_status: String(payload.payment_status ?? "Pending"),
      p_amount_paid: Number(payload.amount_paid ?? 0),
      p_request_id: pending.request_id,
      p_original_price: Number(pending.original_price),
      p_discount_type: (payload.discount as Record<string, unknown>)?.type ?? null,
      p_discount_value: (payload.discount as Record<string, unknown>)?.value ?? null,
      p_discount_amount: Number(pending.discount_amount),
      p_paperwork_charge: Number(payload.paperwork_charge ?? 0),
      p_modification_charge: Number(payload.modification_charge ?? 0),
      p_modification_note: String(payload.modification_note ?? "") || null,
      p_extras_total: Number(pending.final_price) - Number(pending.original_price) +
        Number(pending.discount_amount) -
        Number(payload.paperwork_charge ?? 0) -
        Number(payload.modification_charge ?? 0),
      p_final_price: Number(pending.final_price),
      p_approved_by: adminId,
      p_approved_at: approvedAt,
      p_extras: extrasForCommit,
    });

    if (commitErr) {
      return jsonResponse({ error: commitErr.message }, 422);
    }
    saleLogId = commitData as number;
  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 500);
  }

  // ── Mark pending_sale as approved ──────────────────────────────────────────
  await sb
    .from("pending_sales")
    .update({
      status: "approved",
      decided_by: adminId,
      decided_at: approvedAt,
    })
    .eq("id", pending_id);

  // ── Write to Google Sheet ──────────────────────────────────────────────────
  const clientEmail = Deno.env.get("GOOGLE_CLIENT_EMAIL");
  const privateKeyPem = Deno.env.get("GOOGLE_PRIVATE_KEY")?.replace(/\\n/g, "\n");
  const sheetId = Deno.env.get("GOOGLE_SHEET_ID");

  let sheetSynced = false;
  let sheetWarning: string | undefined;
  let saleId = "";

  if (clientEmail && privateKeyPem && sheetId) {
    try {
      const accessToken = await getGoogleAccessToken(clientEmail, privateKeyPem);

      const { data: freshBike } = await sb
        .from("bikes")
        .select("quantity")
        .eq("id", String(pending.bike_id))
        .single();
      const newStockLevel = freshBike?.quantity ?? 0;

      saleId = `SALE-${Date.now().toString(36).toUpperCase()}`;

      const headers = await ensureHeaders(accessToken, sheetId, "Sold", A2_SOLD_HEADERS);

      const formattedDate = new Date().toLocaleString("en-IN", {
        day: "2-digit", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit", hour12: true,
        timeZone: "Asia/Kathmandu",
      });

      const finalPrice = Number(pending.final_price);
      const discountAmount = Number(pending.discount_amount);
      const originalPrice = Number(pending.original_price);
      const soldPrice = originalPrice - discountAmount;
      const paperwork = Number(payload.paperwork_charge ?? 0);
      const modification = Number(payload.modification_charge ?? 0);
      const extrasTotal = finalPrice - soldPrice - paperwork - modification;

      const paymentStatus = String(payload.payment_status ?? "Pending");
      const amtPaid = paymentStatus === "Fully Paid" ? finalPrice : Number(payload.amount_paid ?? 0);
      const balanceDue = Math.max(0, finalPrice - amtPaid);

      const extraProductsText = extrasForCommit.map((ex) => `${ex.part_name} x${ex.qty}`).join("; ");
      const discountInput = payload.discount as Record<string, unknown> | null;

      const valueMap: Record<string, string | number> = {
        "date": formattedDate,
        "sale id": saleId,
        "bike name": String(pending.bike_name ?? ""),
        "quantity": qty,
        "logged by": String(pending.requested_by_email ?? "unknown"),
        "customer name": String(payload.customer_name ?? ""),
        "customer phone": String(payload.customer_phone ?? ""),
        "sold price": soldPrice,
        "buyer type": String(payload.buyer_type ?? "Individual"),
        "payment status": paymentStatus,
        "amount paid": amtPaid,
        "balance due": balanceDue,
        "new stock level": newStockLevel,
        "original price": originalPrice,
        "discount type": String(discountInput?.type ?? ""),
        "discount value": Number(discountInput?.value ?? 0),
        "discount amount": discountAmount,
        "paperwork charge": paperwork,
        "modification charge": modification,
        "modification note": String(payload.modification_note ?? ""),
        "extra products": extraProductsText,
        "extra products total": Math.max(0, extrasTotal),
        "final price": finalPrice,
        "approval status": "Approved",
        "approved by": adminEmail ?? "",
      };

      const rowValues = headers.map((h) => valueMap[h.trim().toLowerCase()] ?? "");

      const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent("Sold")}!A1:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
      const appendRes = await fetch(appendUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ values: [rowValues] }),
      });

      if (appendRes.ok) {
        sheetSynced = true;
        // Documents row
        await writeDocumentsRow(
          accessToken, sheetId, saleId,
          String(payload.buyer_type ?? "Individual"),
          String(payload.customer_name ?? ""),
          String(payload.customer_phone ?? ""),
          String(pending.bike_name ?? ""),
          formattedDate
        );
        // Stock tab
        await updateStockTab(accessToken, sheetId, String(pending.bike_name ?? ""), newStockLevel, formattedDate);
      } else {
        sheetWarning = await appendRes.text();
      }
    } catch (sheetErr) {
      sheetWarning = (sheetErr as Error).message;
    }
  }

  await sb
    .from("stock_logs")
    .update({ sheet_synced: sheetSynced })
    .eq("id", saleLogId);

  const response: Record<string, unknown> = {
    status: "approved",
    pending_id,
    sale_log_id: saleLogId,
    sale_id: saleId,
    sheet_synced: sheetSynced,
  };
  if (sheetWarning) response.warning = sheetWarning;
  return jsonResponse(response);
});

// ── Helpers (same as record-sale) ─────────────────────────────────────────────
async function writeDocumentsRow(
  accessToken: string, sheetId: string, saleId: string,
  buyerType: string, customerName: string, customerPhone: string,
  bikeName: string, formattedDate: string
) {
  const isIndividual = buyerType.toLowerCase() === "individual";
  function isIndividualDocCol(h: string) {
    return h.includes("citizenship") || h.includes("nid") || h.includes("passport") ||
      h.includes("driving") || h.includes("license") ||
      (h.includes("pan") && !h.includes("vat") && !h.includes("company"));
  }
  function isCorporateDocCol(h: string) {
    return h.includes("registration") || h.includes("company") ||
      (h.includes("pan") && h.includes("vat")) ||
      h.includes("board") || h.includes("authorization") || h.includes("signatory");
  }
  let docRowValues: (string | boolean)[] = [];
  try {
    const r = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent("Documents")}!1:1`, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (r.ok) {
      const d = await r.json();
      const hdrs: string[] = d.values?.[0] ?? [];
      if (hdrs.length > 0) {
        docRowValues = hdrs.map((h) => {
          const hl = h.trim().toLowerCase();
          if (hl.includes("sale") && hl.includes("id")) return saleId;
          if (hl.includes("buyer") && hl.includes("type")) return buyerType;
          if (hl.includes("customer") && hl.includes("name")) return customerName;
          if (hl.includes("customer") && hl.includes("phone")) return customerPhone;
          if (hl.includes("bike")) return bikeName;
          if (hl.includes("date")) return formattedDate;
          if (hl.includes("handover") || (hl.includes("payment") && hl.includes("receipt")) || hl.includes("insurance")) return false;
          const indCol = isIndividualDocCol(hl), corpCol = isCorporateDocCol(hl);
          if (indCol && !corpCol) return isIndividual ? false : "Not Required";
          if (corpCol && !indCol) return isIndividual ? "Not Required" : false;
          return false;
        });
      }
    }
  } catch { /* use fallback */ }
  if (docRowValues.length === 0) {
    docRowValues = [saleId, buyerType, ...Array(11).fill(false)];
  }
  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent("Documents")}!A1:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ values: [docRowValues] }),
  });
}

async function updateStockTab(accessToken: string, sheetId: string, bikeName: string, newStockLevel: number, formattedDate: string) {
  const r = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent("Stock")}!A:A`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!r.ok) return;
  const d = await r.json();
  const colA: string[][] = d.values ?? [];
  let idx = -1;
  for (let i = 0; i < colA.length; i++) {
    if (colA[i]?.[0]?.trim().toLowerCase() === bikeName.trim().toLowerCase()) { idx = i + 1; break; }
  }
  if (idx === -1) return;
  const range = `Stock!C${idx}:D${idx}`;
  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ range, majorDimension: "ROWS", values: [[newStockLevel, formattedDate]] }),
  });
}

