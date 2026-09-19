// =============================================================================
// get-pending-documents/index.ts
// Supabase Edge Function — Fetch sales with pending documentation from Google Sheets
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

  // 1. Fetch all rows from "Documents" tab
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
  const docRows: string[][] = docData.values ?? [];

  if (docRows.length <= 1) {
    return jsonResponse({ success: true, documents: [] });
  }

  const docHeaders = docRows[0].map((h) => (h ?? "").trim());

  // Locate column indices in Documents tab
  const saleIdIdx = docHeaders.findIndex((h) => /sale\s*id/i.test(h));
  const buyerTypeIdx = docHeaders.findIndex((h) => /buyer\s*type/i.test(h));
  const handoverIdx = docHeaders.findIndex((h) => /handover\s*ready/i.test(h));
  let customerNameIdx = docHeaders.findIndex((h) => /customer\s*name/i.test(h));
  let bikeNameIdx = docHeaders.findIndex((h) => /bike(\s*name)?/i.test(h));

  // If customer name or bike name column is missing from Documents, we look them up from "Sold" tab
  const soldLookup = new Map<string, { customerName: string; bikeName: string }>();
  if (customerNameIdx === -1 || bikeNameIdx === -1) {
    try {
      const soldUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent("Sold")}!A:M`;
      const soldRes = await fetch(soldUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (soldRes.ok) {
        const soldData = await soldRes.json();
        const soldRows: string[][] = soldData.values ?? [];
        if (soldRows.length > 1) {
          const soldHeaders = soldRows[0].map((h) => (h ?? "").trim());
          const soldSaleIdIdx = soldHeaders.findIndex((h) => /sale\s*id/i.test(h));
          const soldCustIdx = soldHeaders.findIndex((h) => /customer\s*name/i.test(h));
          const soldBikeIdx = soldHeaders.findIndex((h) => /bike(\s*name)?/i.test(h));

          for (let i = 1; i < soldRows.length; i++) {
            const sId = soldRows[i]?.[soldSaleIdIdx !== -1 ? soldSaleIdIdx : 7]?.trim();
            if (sId) {
              soldLookup.set(sId, {
                customerName: (soldCustIdx !== -1 ? soldRows[i]?.[soldCustIdx] : soldRows[i]?.[4]) ?? "—",
                bikeName: (soldBikeIdx !== -1 ? soldRows[i]?.[soldBikeIdx] : soldRows[i]?.[1]) ?? "—",
              });
            }
          }
        }
      }
    } catch (soldErr) {
      console.warn("Could not cross-reference Sold tab for customer/bike names:", soldErr);
    }
  }

  // Identify all checkbox column indices in Documents tab
  // Checkbox columns are any columns that are not Sale ID, Buyer Type, Customer Name, Bike Name, Date, or Handover Ready
  const checkboxCols: { name: string; index: number }[] = [];
  for (let c = 0; c < docHeaders.length; c++) {
    const h = docHeaders[c];
    if (!h) continue;
    if (
      c === saleIdIdx ||
      c === buyerTypeIdx ||
      c === customerNameIdx ||
      c === bikeNameIdx ||
      c === handoverIdx ||
      /^(date|created_at|logged\s*by|phone)$/i.test(h)
    ) {
      continue;
    }
    checkboxCols.push({ name: h, index: c });
  }

  const pendingDocuments = [];

  for (let r = 1; r < docRows.length; r++) {
    const row = docRows[r];
    if (!row || row.length === 0) continue;

    const saleId = (saleIdIdx !== -1 ? row[saleIdIdx] : row[0])?.trim();
    if (!saleId) continue;

    const handoverReadyVal = (handoverIdx !== -1 ? row[handoverIdx] : "")?.trim().toUpperCase();
    const isHandoverReady = handoverReadyVal === "TRUE" || handoverReadyVal === "YES" || handoverReadyVal === "1";

    // Filter out rows where Handover Ready is true
    if (isHandoverReady) continue;

    const buyerType = (buyerTypeIdx !== -1 ? row[buyerTypeIdx] : "")?.trim() || "Individual";
    const lookedUp = soldLookup.get(saleId);
    const customerName = (customerNameIdx !== -1 ? row[customerNameIdx]?.trim() : "") || lookedUp?.customerName || "—";
    const bikeName = (bikeNameIdx !== -1 ? row[bikeNameIdx]?.trim() : "") || lookedUp?.bikeName || "—";

    const checkboxes: Record<string, boolean> = {};
    for (const col of checkboxCols) {
      const cellVal = (row[col.index] ?? "").toString().trim().toUpperCase();
      checkboxes[col.name] = cellVal === "TRUE" || cellVal === "YES" || cellVal === "1";
    }

    pendingDocuments.push({
      saleId,
      buyerType,
      customerName,
      bikeName,
      checkboxes,
      handoverReady: false,
      rowIndex: r + 1, // 1-based row number
    });
  }

  return jsonResponse({
    success: true,
    documents: pendingDocuments,
    allDocHeaders: checkboxCols.map((c) => c.name),
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
