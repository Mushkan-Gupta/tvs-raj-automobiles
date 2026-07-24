// =============================================================================
// seed-stock-sheet/index.ts
// Supabase Edge Function — ONE-TIME bulk seed of the Google Sheet "Stock" tab
//
// Flow:
//   1. Receive GET or POST request (manual trigger)
//   2. Fetch ALL bikes (name, category, quantity) from Supabase
//   3. Authenticate with Google Sheets (same service account as sync-to-sheets)
//   4. Clear existing data rows in Stock!A2:D1000 (preserves header row 1)
//   5. Write all bikes as rows: Bike Name | Category | Current Quantity | Last Updated
//   6. Return JSON with count of bikes written
//
// Environment variables (already set via `supabase secrets set`):
//   SUPABASE_URL              — auto-injected by Supabase runtime
//   SUPABASE_SERVICE_ROLE_KEY — auto-injected by Supabase runtime
//   GOOGLE_CLIENT_EMAIL       — service account email
//   GOOGLE_PRIVATE_KEY        — PEM private key (with \n literal newlines)
//   GOOGLE_SHEET_ID           — the long ID from the Google Sheet URL
// =============================================================================

// --- CORS headers -----------------------------------------------------------
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

// =============================================================================
// MAIN HANDLER
// =============================================================================
Deno.serve(async (req: Request) => {

  // --- Handle CORS preflight -------------------------------------------------
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  // --- Accept GET or POST ----------------------------------------------------
  if (req.method !== "GET" && req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed. Use GET or POST." }, 405);
  }

  try {
    // ============================================================
    // STEP 1: Read required environment variables
    // ============================================================
    const supabaseUrl     = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const clientEmail     = Deno.env.get("GOOGLE_CLIENT_EMAIL");
    const privateKeyRaw   = Deno.env.get("GOOGLE_PRIVATE_KEY");
    const sheetId         = Deno.env.get("GOOGLE_SHEET_ID");

    if (!supabaseUrl || !serviceRoleKey || !clientEmail || !privateKeyRaw || !sheetId) {
      return jsonResponse({
        error: "Missing one or more required environment variables.",
        required: ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "GOOGLE_CLIENT_EMAIL", "GOOGLE_PRIVATE_KEY", "GOOGLE_SHEET_ID"],
      }, 500);
    }

    // Normalise escaped newlines that may arrive from `supabase secrets set`
    const privateKeyPem = privateKeyRaw.replace(/\\n/g, "\n");

    // ============================================================
    // STEP 2: Fetch ALL bikes from Supabase
    // ============================================================
    const bikesUrl = `${supabaseUrl}/rest/v1/bikes?select=name,category,quantity&order=name.asc`;

    const bikesRes = await fetch(bikesUrl, {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!bikesRes.ok) {
      const errText = await bikesRes.text();
      return jsonResponse({ error: "Failed to fetch bikes from Supabase.", detail: errText }, 500);
    }

    const bikes: { name: string; category: string; quantity: number }[] = await bikesRes.json();

    if (!bikes || bikes.length === 0) {
      return jsonResponse({ success: false, message: "No bikes found in the database." });
    }

    // ============================================================
    // STEP 3: Authenticate with Google Sheets
    // ============================================================
    const accessToken = await getGoogleAccessToken(clientEmail, privateKeyPem);

    // ============================================================
    // STEP 4: Clear existing data rows in the Stock tab
    //         Range Stock!A2:D1000 — row 1 (header) is preserved
    // ============================================================
    const clearUrl =
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent("Stock!A2:D1000")}:clear`;

    const clearRes = await fetch(clearUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!clearRes.ok) {
      const errText = await clearRes.text();
      return jsonResponse({ error: "Failed to clear Stock tab.", detail: errText }, 500);
    }

    // ============================================================
    // STEP 5: Write all bikes into the Stock tab
    //         Columns: Bike Name | Category | Current Quantity | Last Updated
    // ============================================================
    const today = new Date().toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }); // e.g. "24 Jul 2026"

    const rows = bikes.map((bike) => [
      bike.name,
      bike.category ?? "",
      bike.quantity,
      today,
    ]);

    const batchUrl =
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent("Stock!A2")}` +
      `?valueInputOption=USER_ENTERED`;

    const batchRes = await fetch(batchUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        range: "Stock!A2",
        majorDimension: "ROWS",
        values: rows,
      }),
    });

    if (!batchRes.ok) {
      const errText = await batchRes.text();
      return jsonResponse({ error: "Failed to write rows to Stock tab.", detail: errText }, 500);
    }

    const batchData = await batchRes.json();

    // ============================================================
    // STEP 6: Return success
    // ============================================================
    return jsonResponse({
      success: true,
      message: `Stock tab seeded successfully with ${bikes.length} bike(s).`,
      bikesWritten: bikes.length,
      updatedRange: batchData.updatedRange ?? "unknown",
      bikes: bikes.map((b) => b.name),
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: "Unexpected error.", detail: message }, 500);
  }
});

// =============================================================================
// HELPER: getGoogleAccessToken
// Signs a JWT with the service account private key and exchanges it for an
// OAuth2 access token. Copied from sync-to-sheets/index.ts.
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
    btoa(JSON.stringify(obj))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

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

  if (!tokenData.access_token) {
    throw new Error(`No access_token in Google response: ${JSON.stringify(tokenData)}`);
  }

  return tokenData.access_token as string;
}

// =============================================================================
// HELPER: importPrivateKey
// Converts a PEM RSA private key string into a CryptoKey for signing.
// Copied from sync-to-sheets/index.ts.
// =============================================================================
async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const pemContents = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");

  const binaryDer = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

  return await crypto.subtle.importKey(
    "pkcs8",
    binaryDer.buffer,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    false,
    ["sign"]
  );
}
