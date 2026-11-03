// =============================================================================
// get-pending-payments/index.ts
// Supabase Edge Function — Fetch sales with outstanding balances from Google Sheets
// =============================================================================

import { CORS_HEADERS, requireRole } from "../_shared/auth.ts";
import { getGoogleAccessToken } from "../_shared/google.ts";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const auth = await requireRole(req, ["admin", "employee"]);
  if (auth instanceof Response) return auth;

  const clientEmail = Deno.env.get("GOOGLE_CLIENT_EMAIL");
  const privateKeyPem = Deno.env.get("GOOGLE_PRIVATE_KEY")?.replace(/\\n/g, "\n");
  const sheetId = Deno.env.get("GOOGLE_SHEET_ID");

  if (!clientEmail || !privateKeyPem || !sheetId) {
    return jsonResponse({ error: "Missing Google Sheets configuration in environment variables." }, 500);
  }

  let accessToken: string;
  try {
    accessToken = await getGoogleAccessToken(clientEmail, privateKeyPem);
  } catch (err) {
    return jsonResponse({
      error: "Failed to authenticate with Google.",
      detail: err instanceof Error ? err.message : String(err),
    }, 500);
  }

  // Fetch all rows from "Sold" tab
  const soldUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent("Sold")}!A:Z`;
  const soldRes = await fetch(soldUrl, { headers: { Authorization: `Bearer ${accessToken}` } });

  if (!soldRes.ok) {
    const errText = await soldRes.text();
    return jsonResponse({
      error: 'Failed to read "Sold" tab from Google Sheets.',
      detail: errText,
    }, 500);
  }

  const soldData = await soldRes.json();
  const rows: (string | number)[][] = soldData.values ?? [];

  if (rows.length <= 1) {
    return jsonResponse({ success: true, pendingPayments: [] });
  }

  const headers = rows[0].map((h) => (h ?? "").toString().trim());

  // Dynamically map column indices with fallbacks to standard columns A-M + A2 columns
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
      ? Number(String(rawFinalPrice).replace(/[^\d.-]/g, ""))
      : NaN;
    const effectivePrice = !isNaN(finalPriceNum) && finalPriceNum > 0 ? finalPriceNum : soldPrice;

    const amountPaid = Number((amountPaidIdx !== -1 ? row[amountPaidIdx] : row[11]) || 0);
    const balanceDue = Math.max(0, effectivePrice - amountPaid);

    // Payment Status: Fully Paid when Amount Paid >= Final Price, else Pending / Partial
    const paymentStatus = amountPaid >= effectivePrice
      ? "Fully Paid"
      : (amountPaid > 0 ? "Partial" : "Pending");

    // Filter rows where Payment Status is "Fully Paid"
    if (paymentStatus === "Fully Paid" || balanceDue <= 0) {
      continue;
    }

    const customerName = (customerNameIdx !== -1 ? row[customerNameIdx] : row[4])?.toString().trim() || "—";
    const customerPhone = (customerPhoneIdx !== -1 ? row[customerPhoneIdx] : row[5])?.toString().trim() || "";
    const bikeName = (bikeNameIdx !== -1 ? row[bikeNameIdx] : row[1])?.toString().trim() || "—";
    const buyerType = (buyerTypeIdx !== -1 ? row[buyerTypeIdx] : row[9])?.toString().trim() || "Individual";
    const date = (dateIdx !== -1 ? row[dateIdx] : row[0])?.toString().trim() || "";

    pendingPayments.push({
      saleId,
      customerName,
      customerPhone,
      bikeName,
      buyerType,
      soldPrice: effectivePrice,
      amountPaid,
      balanceDue,
      paymentStatus,
      date,
      rowIndex: r + 1, // 1-based row number
    });
  }

  return jsonResponse({
    success: true,
    pendingPayments,
  });
});
