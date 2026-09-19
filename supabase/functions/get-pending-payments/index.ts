// =============================================================================
// get-pending-payments/index.ts
// Supabase Edge Function — Fetch sales with outstanding balances from Google Sheets
// =============================================================================

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

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
    return jsonResponse({ success: true, pendingPayments: [] });
  }

  const headers = rows[0].map((h) => (h ?? "").toString().trim());

  // Dynamically map column indices with fallbacks to standard columns A-M
  const dateIdx = headers.findIndex((h) => /^date$/i.test(h));
  const bikeNameIdx = headers.findIndex((h) => /bike(\s*name)?/i.test(h));
  const customerNameIdx = headers.findIndex((h) => /customer\s*name/i.test(h));
  const customerPhoneIdx = headers.findIndex((h) => /customer\s*phone/i.test(h));
  const saleIdIdx = headers.findIndex((h) => /sale\s*id/i.test(h));
  const soldPriceIdx = headers.findIndex((h) => /sold\s*price/i.test(h));
  const buyerTypeIdx = headers.findIndex((h) => /buyer\s*type/i.test(h));
  const paymentStatusIdx = headers.findIndex((h) => /payment\s*status/i.test(h));
  const amountPaidIdx = headers.findIndex((h) => /amount\s*paid/i.test(h));
  const balanceDueIdx = headers.findIndex((h) => /balance\s*due/i.test(h));

  const pendingPayments = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;

    const saleId = (saleIdIdx !== -1 ? row[saleIdIdx] : row[7])?.toString().trim();
    if (!saleId) continue;

    const paymentStatus = (paymentStatusIdx !== -1 ? row[paymentStatusIdx] : row[10])?.toString().trim() || "Pending";
    const soldPrice = Number((soldPriceIdx !== -1 ? row[soldPriceIdx] : row[8]) || 0);
    const amountPaid = Number((amountPaidIdx !== -1 ? row[amountPaidIdx] : row[11]) || 0);
    const rawBalanceDue = Number((balanceDueIdx !== -1 ? row[balanceDueIdx] : row[12]) || (soldPrice - amountPaid));
    const balanceDue = Math.max(0, rawBalanceDue);

    // Filter rows where Payment Status is not "Fully Paid"
    if (paymentStatus.toLowerCase() === "fully paid" && balanceDue <= 0) {
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
      soldPrice,
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
