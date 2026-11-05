// =============================================================================
// get-pending-payments/index.ts
// Supabase Edge Function — Fetch sales with outstanding balances from Google Sheets
// =============================================================================

import { CORS_HEADERS, requireRole } from "../_shared/auth.ts";
import { getGoogleAccessToken } from "../_shared/google.ts";
import { ServerTimer } from "../_shared/timing.ts";

function jsonResponse(body: unknown, status = 200, extraHeaders?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json", ...extraHeaders },
  });
}

// ── 20-second in-memory cache ─────────────────────────────────────────────────
interface CacheEntry { data: unknown; exp: number }
const paymentsCache = new Map<string, CacheEntry>();

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const timer = new ServerTimer();
  const auth = await timer.measure("auth", () => requireRole(req, ["admin", "employee"]));
  if (auth instanceof Response) return auth;

  const clientEmail = Deno.env.get("GOOGLE_CLIENT_EMAIL");
  const privateKeyPem = Deno.env.get("GOOGLE_PRIVATE_KEY")?.replace(/\\n/g, "\n");
  const sheetId = Deno.env.get("GOOGLE_SHEET_ID");

  if (!clientEmail || !privateKeyPem || !sheetId) {
    return jsonResponse({ error: "Missing Google Sheets configuration in environment variables." }, 500);
  }

  const url = new URL(req.url);
  const bypassCache = url.searchParams.get("fresh") === "true" ||
                      req.headers.get("cache-control")?.includes("no-cache");

  // ── Check in-memory cache (20 s TTL) ─────────────────────────────────────
  const cacheKey = `payments:${sheetId}`;
  const cached = paymentsCache.get(cacheKey);
  if (!bypassCache && cached && cached.exp > Date.now()) {
    const timingHeader = timer.getHeader();
    return jsonResponse(
      { ...(cached.data as object), cached: true },
      200,
      { "Server-Timing": timingHeader, "Access-Control-Expose-Headers": "Server-Timing" },
    );
  }

  let accessToken: string;
  try {
    accessToken = await timer.measure("google_token", () =>
      getGoogleAccessToken(clientEmail, privateKeyPem!)
    );
  } catch (err) {
    return jsonResponse({
      error: "Failed to authenticate with Google.",
      detail: err instanceof Error ? err.message : String(err),
    }, 500);
  }

  // Fetch all rows from "Sold" tab
  const soldUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent("Sold")}!A:Z`;
  let rows: (string | number)[][] = [];
  try {
    const soldRes = await timer.measure("sheets_read", () =>
      fetch(soldUrl, { headers: { Authorization: `Bearer ${accessToken}` } })
    );
    if (!soldRes.ok) {
      const errText = await soldRes.text();
      return jsonResponse({ error: 'Failed to read "Sold" tab from Google Sheets.', detail: errText }, 500);
    }
    const soldData = await soldRes.json();
    rows = soldData.values ?? [];
  } catch (err) {
    return jsonResponse({ error: 'Failed to read "Sold" tab from Google Sheets.', detail: String(err) }, 500);
  }

  if (rows.length <= 1) {
    const result = { success: true, pendingPayments: [] };
    paymentsCache.set(cacheKey, { data: result, exp: Date.now() + 20_000 });
    timer.log("get-pending-payments");
    const timingHeader = timer.getHeader();
    return jsonResponse(result, 200, { "Server-Timing": timingHeader, "Access-Control-Expose-Headers": "Server-Timing" });
  }

  const headers = rows[0].map((h) => (h ?? "").toString().trim());
  const dateIdx = headers.findIndex((h) => /^date$/i.test(h));
  const bikeNameIdx = headers.findIndex((h) => /bike(\s*name)?/i.test(h));
  const customerNameIdx = headers.findIndex((h) => /customer\s*name/i.test(h));
  const customerPhoneIdx = headers.findIndex((h) => /customer\s*phone/i.test(h));
  const saleIdIdx = headers.findIndex((h) => /sale\s*id/i.test(h));
  const soldPriceIdx = headers.findIndex((h) => /sold\s*price/i.test(h));
  const finalPriceIdx = headers.findIndex((h) => /final\s*price/i.test(h));
  const buyerTypeIdx = headers.findIndex((h) => /buyer\s*type/i.test(h));
  const amountPaidIdx = headers.findIndex((h) => /amount\s*paid/i.test(h));

  const pendingPayments = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;
    const saleId = (saleIdIdx !== -1 ? row[saleIdIdx] : row[7])?.toString().trim();
    if (!saleId) continue;
    const soldPrice = Number((soldPriceIdx !== -1 ? row[soldPriceIdx] : row[8]) || 0);
    const rawFinalPrice = finalPriceIdx !== -1 ? row[finalPriceIdx] : undefined;
    const finalPriceNum = (rawFinalPrice !== undefined && rawFinalPrice !== null && String(rawFinalPrice).trim() !== "")
      ? Number(String(rawFinalPrice).replace(/[^\d.-]/g, "")) : NaN;
    const effectivePrice = !isNaN(finalPriceNum) && finalPriceNum > 0 ? finalPriceNum : soldPrice;
    const amountPaid = Number((amountPaidIdx !== -1 ? row[amountPaidIdx] : row[11]) || 0);
    const balanceDue = Math.max(0, effectivePrice - amountPaid);
    const paymentStatus = amountPaid >= effectivePrice ? "Fully Paid" : (amountPaid > 0 ? "Partial" : "Pending");
    if (paymentStatus === "Fully Paid" || balanceDue <= 0) continue;

    pendingPayments.push({
      saleId,
      customerName: (customerNameIdx !== -1 ? row[customerNameIdx] : row[4])?.toString().trim() || "—",
      customerPhone: (customerPhoneIdx !== -1 ? row[customerPhoneIdx] : row[5])?.toString().trim() || "",
      bikeName: (bikeNameIdx !== -1 ? row[bikeNameIdx] : row[1])?.toString().trim() || "—",
      buyerType: (buyerTypeIdx !== -1 ? row[buyerTypeIdx] : row[9])?.toString().trim() || "Individual",
      soldPrice: effectivePrice,
      amountPaid,
      balanceDue,
      paymentStatus,
      date: (dateIdx !== -1 ? row[dateIdx] : row[0])?.toString().trim() || "",
      rowIndex: r + 1,
    });
  }

  const result = { success: true, pendingPayments };
  paymentsCache.set(cacheKey, { data: result, exp: Date.now() + 20_000 });

  timer.log("get-pending-payments");
  const timingHeader = timer.getHeader();
  return jsonResponse(result, 200, { "Server-Timing": timingHeader, "Access-Control-Expose-Headers": "Server-Timing" });
});
