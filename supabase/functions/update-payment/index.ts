// =============================================================================
// update-payment/index.ts
// Supabase Edge Function — Record installment / additional payment for a sale in Google Sheets
// =============================================================================

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function colToLetter(colIndex: number): string {
  let temp: number;
  let letter = "";
  let c = colIndex;
  while (c > 0) {
    temp = (c - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    c = Math.floor((c - temp - 1) / 26);
  }
  return letter;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed. Use POST." }, 405);
  }

  let body: {
    saleId: string;
    additionalAmount: number;
  };

  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON in request body." }, 400);
  }

  const { saleId, additionalAmount } = body;
  const paymentNum = Number(additionalAmount);

  if (!saleId || typeof saleId !== "string" || !saleId.trim()) {
    return jsonResponse({ error: "Missing required parameter: saleId." }, 400);
  }

  if (Number.isNaN(paymentNum) || paymentNum <= 0) {
    return jsonResponse({ error: "additionalAmount must be a positive number greater than 0." }, 400);
  }

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

  // 1. Fetch current "Sold" tab
  const soldUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent("Sold")}!A:M`;
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
    return jsonResponse({ error: 'No sales records found in "Sold" tab.' }, 404);
  }

  const headers = rows[0].map((h) => (h ?? "").toString().trim());

  // Locate column indices dynamically
  const saleIdIdx = headers.findIndex((h) => /sale\s*id/i.test(h));
  const soldPriceIdx = headers.findIndex((h) => /sold\s*price/i.test(h));
  const amountPaidIdx = headers.findIndex((h) => /amount\s*paid/i.test(h));
  const balanceDueIdx = headers.findIndex((h) => /balance\s*due/i.test(h));
  const paymentStatusIdx = headers.findIndex((h) => /payment\s*status/i.test(h));
  const customerNameIdx = headers.findIndex((h) => /customer\s*name/i.test(h));
  const bikeNameIdx = headers.findIndex((h) => /bike(\s*name)?/i.test(h));

  if (saleIdIdx === -1) {
    return jsonResponse({ error: '"Sale ID" column not found in Sold tab headers.' }, 500);
  }

  // 2. Locate row by matching saleId (1-based row number)
  let targetRowIndex = -1;
  for (let r = 1; r < rows.length; r++) {
    const rowSaleId = rows[r]?.[saleIdIdx]?.toString().trim();
    if (rowSaleId && rowSaleId.toLowerCase() === saleId.trim().toLowerCase()) {
      targetRowIndex = r + 1; // 1-based index in Google Sheets
      break;
    }
  }

  if (targetRowIndex === -1) {
    return jsonResponse({ error: `Sale ID "${saleId}" not found in Sold tab.` }, 404);
  }

  // Clone current row
  const currentRow = [...(rows[targetRowIndex - 1] ?? [])];
  while (currentRow.length < headers.length) {
    currentRow.push("");
  }

  const sPriceIdx = soldPriceIdx !== -1 ? soldPriceIdx : 8;
  const aPaidIdx = amountPaidIdx !== -1 ? amountPaidIdx : 11;
  const bDueIdx = balanceDueIdx !== -1 ? balanceDueIdx : 12;
  const pStatusIdx = paymentStatusIdx !== -1 ? paymentStatusIdx : 10;

  const soldPrice = Number(currentRow[sPriceIdx] || 0);
  const currentAmountPaid = Number(currentRow[aPaidIdx] || 0);
  const currentBalanceDue = Number(currentRow[bDueIdx] || (soldPrice - currentAmountPaid));

  // 3. Validation: reject if additionalAmount would make balance negative
  if (paymentNum > currentBalanceDue) {
    return jsonResponse({
      error: `Additional amount (NPR ${paymentNum}) exceeds current balance due (NPR ${currentBalanceDue}).`,
    }, 400);
  }

  // 4. Calculations
  const newAmountPaid = currentAmountPaid + paymentNum;
  const rawBalance = soldPrice - newAmountPaid;
  const newBalanceDue = Math.max(0, rawBalance);
  const newPaymentStatus = newBalanceDue <= 0 ? "Fully Paid" : "Partial";

  // Update row values
  currentRow[aPaidIdx] = newAmountPaid;
  currentRow[bDueIdx] = newBalanceDue;
  currentRow[pStatusIdx] = newPaymentStatus;

  // 5. Update row in Google Sheets via values.update (PUT)
  const lastColLetter = colToLetter(headers.length);
  const updateRange = `Sold!A${targetRowIndex}:${lastColLetter}${targetRowIndex}`;
  const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(updateRange)}?valueInputOption=USER_ENTERED`;

  const updateRes = await fetch(updateUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      range: updateRange,
      majorDimension: "ROWS",
      values: [currentRow],
    }),
  });

  if (!updateRes.ok) {
    const errText = await updateRes.text();
    return jsonResponse({
      error: 'Failed to update row in "Sold" tab in Google Sheets.',
      detail: errText,
    }, 500);
  }

  const customerName = (customerNameIdx !== -1 ? currentRow[customerNameIdx] : currentRow[4])?.toString() || "—";
  const bikeName = (bikeNameIdx !== -1 ? currentRow[bikeNameIdx] : currentRow[1])?.toString() || "—";

  return jsonResponse({
    success: true,
    message: newPaymentStatus === "Fully Paid"
      ? `Payment of NPR ${paymentNum.toLocaleString("en-IN")} recorded. Sale ${saleId} is now FULLY PAID!`
      : `Payment of NPR ${paymentNum.toLocaleString("en-IN")} recorded for sale ${saleId}. Remaining balance: NPR ${newBalanceDue.toLocaleString("en-IN")}.`,
    updatedRow: {
      saleId,
      customerName,
      bikeName,
      soldPrice,
      amountPaid: newAmountPaid,
      balanceDue: newBalanceDue,
      paymentStatus: newPaymentStatus,
      updatedRange: updateRange,
    },
  });
});

// =============================================================================
// OAuth Helpers
// =============================================================================
async function getGoogleAccessToken(clientEmail: string, privateKeyPem: string): Promise<string> {
  const privateKey = await importPrivateKey(privateKeyPem);
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: clientEmail,
    sub: clientEmail,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const header = { alg: "RS256", typ: "JWT" };
  const encode = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  const unsignedJwt = `${encode(header)}.${encode(payload)}`;
  const signatureBytes = await crypto.subtle.sign(
    { name: "RSASSA-PKCS1-v1_5" },
    privateKey,
    new TextEncoder().encode(unsignedJwt)
  );

  const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBytes)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const signedJwt = `${unsignedJwt}.${signature}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: signedJwt,
    }),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    throw new Error(`Google token exchange failed: ${err}`);
  }

  const tokenData = await tokenRes.json();
  return tokenData.access_token as string;
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const pemContents = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");

  const binaryDer = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));
  return await crypto.subtle.importKey(
    "pkcs8",
    binaryDer.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
}
