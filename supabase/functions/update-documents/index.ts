// =============================================================================
// update-documents/index.ts
// Supabase Edge Function — Update document checklist items & recalculate Handover Ready
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
  // colIndex is 1-based (1 -> A, 26 -> Z, 27 -> AA)
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

function isRequiredDocForBuyer(header: string, buyerType: string): boolean {
  const h = header.trim().toLowerCase();
  const bt = buyerType.trim().toLowerCase();

  // Columns that are NOT document requirements:
  if (
    (h.includes("sale") && h.includes("id")) ||
    h === "buyer type" ||
    h.includes("customer") ||
    h.includes("bike") ||
    h === "date" ||
    h.includes("logged by") ||
    h.includes("quantity") ||
    h.includes("stock") ||
    h.includes("handover")
  ) {
    return false;
  }

  // Common requirements for all buyer types:
  if (h.includes("payment") || h.includes("insurance")) {
    return true;
  }

  // Explicit buyer type annotations in header:
  if (h.includes("(individual)") || h.includes("individual")) {
    return bt === "individual";
  }
  if (h.includes("(corporate)") || h.includes("corporate")) {
    return bt === "corporate";
  }

  // Semantic document names:
  const individualKeywords = ["citizenship", "photo", "license", "passport"];
  const corporateKeywords = ["registration", "company", "pan", "vat", "tax", "authorization"];

  if (individualKeywords.some((k) => h.includes(k))) {
    return bt === "individual";
  }
  if (corporateKeywords.some((k) => h.includes(k))) {
    return bt === "corporate";
  }

  // Generic document column not exclusive to other buyer type
  return true;
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
    updatedFields: Record<string, boolean>;
  };

  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON in request body." }, 400);
  }

  const { saleId, updatedFields } = body;
  if (!saleId || typeof saleId !== "string" || !updatedFields || typeof updatedFields !== "object") {
    return jsonResponse({ error: "Missing required fields: saleId and updatedFields." }, 400);
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

  // 1. Fetch current Documents tab
  const docUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent("Documents")}!A:Z`;
  const docRes = await fetch(docUrl, { headers: { Authorization: `Bearer ${accessToken}` } });

  if (!docRes.ok) {
    const errText = await docRes.text();
    return jsonResponse({
      error: 'Failed to read "Documents" tab from Google Sheets.',
      detail: errText,
    }, 500);
  }

  const docData = await docRes.json();
  const docRows: (string | boolean | number)[][] = docData.values ?? [];

  if (docRows.length <= 1) {
    return jsonResponse({ error: 'No data rows found in "Documents" tab.' }, 404);
  }

  const docHeaders: string[] = (docRows[0] as string[]).map((h) => (h ?? "").toString().trim());

  const saleIdIdx = docHeaders.findIndex((h) => /sale\s*id/i.test(h));
  const buyerTypeIdx = docHeaders.findIndex((h) => /buyer\s*type/i.test(h));
  let handoverIdx = docHeaders.findIndex((h) => /handover\s*ready/i.test(h));

  if (saleIdIdx === -1) {
    return jsonResponse({ error: '"Sale ID" column not found in Documents tab headers.' }, 500);
  }

  // 2. Locate the row index by matching saleId (1-based row number)
  let targetRowIndex = -1;
  for (let r = 1; r < docRows.length; r++) {
    const rowSaleId = docRows[r]?.[saleIdIdx]?.toString().trim();
    if (rowSaleId && rowSaleId.toLowerCase() === saleId.trim().toLowerCase()) {
      targetRowIndex = r + 1; // 1-based index in Google Sheets
      break;
    }
  }

  if (targetRowIndex === -1) {
    return jsonResponse({ error: `Sale ID "${saleId}" not found in Documents tab.` }, 404);
  }

  // Clone current row and expand to match headers length if needed
  const currentRow = [...(docRows[targetRowIndex - 1] ?? [])];
  while (currentRow.length < docHeaders.length) {
    currentRow.push("");
  }

  const buyerType = (buyerTypeIdx !== -1 ? currentRow[buyerTypeIdx]?.toString() : "")?.trim() || "Individual";

  // 3. Update specified checkbox columns in this row
  for (const [colName, val] of Object.entries(updatedFields)) {
    const colIdx = docHeaders.findIndex((h) => h.toLowerCase() === colName.trim().toLowerCase());
    if (colIdx !== -1) {
      currentRow[colIdx] = Boolean(val);
    }
  }

  // 4. Recalculate "Handover Ready"
  // Handover Ready = true ONLY if:
  // - ALL required document checkboxes for this row's Buyer Type are true
  // - AND "Payment Receipt" is true
  // - AND "Insurance Collected" is true
  let isHandoverReady = true;

  // Verify Payment Receipt
  const paymentHeader = docHeaders.find((h) => /payment/i.test(h));
  if (paymentHeader) {
    const pIdx = docHeaders.indexOf(paymentHeader);
    const pVal = currentRow[pIdx];
    const isPaid = pVal === true || pVal?.toString().trim().toUpperCase() === "TRUE";
    if (!isPaid) isHandoverReady = false;
  }

  // Verify Insurance Collected
  const insuranceHeader = docHeaders.find((h) => /insurance/i.test(h));
  if (insuranceHeader) {
    const iIdx = docHeaders.indexOf(insuranceHeader);
    const iVal = currentRow[iIdx];
    const hasInsurance = iVal === true || iVal?.toString().trim().toUpperCase() === "TRUE";
    if (!hasInsurance) isHandoverReady = false;
  }

  // Verify all required document checkboxes for this Buyer Type
  for (let c = 0; c < docHeaders.length; c++) {
    const h = docHeaders[c];
    if (isRequiredDocForBuyer(h, buyerType)) {
      const cellVal = currentRow[c];
      const isChecked = cellVal === true || cellVal?.toString().trim().toUpperCase() === "TRUE";
      if (!isChecked) {
        isHandoverReady = false;
        break;
      }
    }
  }

  if (handoverIdx !== -1) {
    currentRow[handoverIdx] = isHandoverReady;
  }

  // 5. Write updated row back to Google Sheets via values.update (PUT)
  const lastColLetter = colToLetter(docHeaders.length);
  const updateRange = `Documents!A${targetRowIndex}:${lastColLetter}${targetRowIndex}`;
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
      error: "Failed to update row in Google Sheets Documents tab.",
      detail: errText,
    }, 500);
  }

  const updatedCheckboxes: Record<string, boolean> = {};
  for (let c = 0; c < docHeaders.length; c++) {
    const h = docHeaders[c];
    if (isRequiredDocForBuyer(h, buyerType) || /payment|insurance/i.test(h)) {
      const v = currentRow[c];
      updatedCheckboxes[h] = v === true || v?.toString().trim().toUpperCase() === "TRUE";
    }
  }

  return jsonResponse({
    success: true,
    message: isHandoverReady
      ? `Documents updated! Sale ${saleId} is now HANDOVER READY.`
      : `Documents updated for sale ${saleId}.`,
    updatedRow: {
      saleId,
      buyerType,
      checkboxes: updatedCheckboxes,
      handoverReady: isHandoverReady,
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
