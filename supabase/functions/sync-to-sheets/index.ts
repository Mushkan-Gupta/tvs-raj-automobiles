// =============================================================================
// sync-to-sheets/index.ts
// Supabase Edge Function — Sync stock log entries to Google Sheets
//
// Flow:
//   1. Receive POST with a stock_logs row in the request body
//   2. Fetch the bike's name, category & current quantity from Supabase
//   3. Get a Google OAuth2 access token via a signed JWT (service account)
//   4. Append a row to the correct log tab ("Arrivals" or "Sold")
//   5. Find and UPDATE the matching row in the "Stock" tab (column A = bike name)
//   6. Return a JSON success/error response
//
// Google Sheet tab structure:
//   "Arrivals" — Date | Bike Name | Quantity | Logged By | New Stock Level
//   "Sold"     — Date | Bike Name | Quantity | Logged By | Customer Name | Customer Phone | New Stock Level
//   "Stock"    — Bike Name | Category | Current Quantity | Last Updated
//                (ONE row per bike; updated in-place, never appended)
//
// Environment variables expected (set via `supabase secrets set`):
//   SUPABASE_URL              — auto-injected by Supabase runtime
//   SUPABASE_SERVICE_ROLE_KEY — auto-injected by Supabase runtime
//   GOOGLE_CLIENT_EMAIL       — service account email from Google Cloud
//   GOOGLE_PRIVATE_KEY        — PEM private key (with \n literal newlines)
//   GOOGLE_SHEET_ID           — the long ID from the Google Sheet URL
// =============================================================================

// --- CORS headers -----------------------------------------------------------
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Helper: build a JSON response with CORS headers
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

  // --- Handle CORS preflight (browser OPTIONS request) ----------------------
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  // --- Only allow POST ------------------------------------------------------
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed. Use POST." }, 405);
  }

  // ============================================================
  // STEP 1: Parse the incoming stock_logs row from the request body
  // ============================================================
  let stockLog: {
    bike_id?: string;
    type: string;           // "arrival" | "sale" | "inquiry"
    quantity?: number;
    logged_by?: string;
    customer_name?: string;
    customer_phone?: string;
    created_at: string;
    name?: string;
    phone?: string;
    interested_model?: string;
    message?: string;
  };

  try {
    stockLog = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON in request body." }, 400);
  }

  // --- Handle 'inquiry' type specifically ---
  if (stockLog.type === "inquiry") {
    const reqFields = ["type", "name", "phone", "interested_model", "message", "created_at"];
    for (const field of reqFields) {
      if (stockLog[field as keyof typeof stockLog] === undefined || stockLog[field as keyof typeof stockLog] === null) {
        return jsonResponse({ error: `Missing required field for inquiry: ${field}` }, 400);
      }
    }

    const clientEmail = Deno.env.get("GOOGLE_CLIENT_EMAIL");
    const privateKeyPem = Deno.env.get("GOOGLE_PRIVATE_KEY")?.replace(/\\n/g, "\n");
    const sheetId = Deno.env.get("GOOGLE_SHEET_ID");
    if (!clientEmail || !privateKeyPem || !sheetId) {
      return jsonResponse({ error: "Missing Google Sheets env vars." }, 500);
    }

    let accessToken: string;
    try {
      accessToken = await getGoogleAccessToken(clientEmail, privateKeyPem);
    } catch (err) {
      return jsonResponse({ error: "Failed to authenticate with Google.", detail: String(err) }, 500);
    }

    const date = new Date(stockLog.created_at);
    const formattedDate = date.toLocaleString("en-IN", {
      day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata",
    });

    const rowValues = [formattedDate, stockLog.name, stockLog.phone, stockLog.interested_model, stockLog.message];
    const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent("Inquiries")}!A1:E1:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
    
    const appendRes = await fetch(appendUrl, {
      method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ values: [rowValues] }),
    });

    if (!appendRes.ok) {
      return jsonResponse({ error: "Google Sheets append to Inquiries failed.", detail: await appendRes.text() }, 500);
    }
    return jsonResponse({ success: true, message: "Inquiry synced to Google Sheets." });
  }

  // Validate required fields
  const required = ["bike_id", "type", "quantity", "logged_by", "created_at"];
  for (const field of required) {
    if (stockLog[field as keyof typeof stockLog] === undefined || stockLog[field as keyof typeof stockLog] === null) {
      return jsonResponse({ error: `Missing required field: ${field}` }, 400);
    }
  }

  // ============================================================
  // STEP 2: Fetch bike name, category, and current stock from Supabase
  // ============================================================

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "Supabase environment variables not available." }, 500);
  }

  // Query the bikes table — fetch name, category, and quantity
  const bikeRes = await fetch(
    `${supabaseUrl}/rest/v1/bikes?id=eq.${stockLog.bike_id}&select=name,category,quantity`,
    {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!bikeRes.ok) {
    const errText = await bikeRes.text();
    return jsonResponse({ error: `Failed to fetch bike data: ${errText}` }, 500);
  }

  const bikes = await bikeRes.json();

  if (!bikes || bikes.length === 0) {
    return jsonResponse({ error: `No bike found with id: ${stockLog.bike_id}` }, 404);
  }

  const bike = bikes[0] as { name: string; category: string; quantity: number };

  // ============================================================
  // STEP 3: Get a Google OAuth2 access token using a service account JWT
  // ============================================================

  const clientEmail = Deno.env.get("GOOGLE_CLIENT_EMAIL");
  // The private key stored in secrets uses literal \n — replace them with real newlines
  const privateKeyPem = Deno.env.get("GOOGLE_PRIVATE_KEY")?.replace(/\\n/g, "\n");

  if (!clientEmail || !privateKeyPem) {
    return jsonResponse({ error: "GOOGLE_CLIENT_EMAIL or GOOGLE_PRIVATE_KEY environment variable is missing." }, 500);
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

  // ============================================================
  // STEP 4: Append a row to the correct log tab ("Arrivals" or "Sold")
  // ============================================================

  const sheetId = Deno.env.get("GOOGLE_SHEET_ID");
  if (!sheetId) {
    return jsonResponse({ error: "GOOGLE_SHEET_ID environment variable is missing." }, 500);
  }

  // Format the date/time in IST (UTC+5:30)
  // Example output: "23 Jul 2026, 02:41 PM"
  const date = new Date(stockLog.created_at);
  const formattedDate = date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });

  const isArrival = stockLog.type.toLowerCase() === "arrival";
  const customerName  = isArrival ? "" : (stockLog.customer_name  ?? "");
  const customerPhone = isArrival ? "" : (stockLog.customer_phone ?? "");

  // Choose target tab and build the appropriate row
  // Arrivals: Date | Bike Name | Quantity | Logged By | New Stock Level
  // Sold:     Date | Bike Name | Quantity | Logged By | Customer Name | Customer Phone | New Stock Level
  let tabName: string;
  let rowValues: (string | number)[];

  if (isArrival) {
    tabName = "Arrivals";
    rowValues = [
      formattedDate,
      bike.name,
      stockLog.quantity,
      stockLog.logged_by,
      bike.quantity,   // new stock level (already updated in DB by the time this runs)
    ];
  } else {
    tabName = "Sold";
    rowValues = [
      formattedDate,
      bike.name,
      stockLog.quantity,
      stockLog.logged_by,
      customerName,
      customerPhone,
      bike.quantity,   // new stock level
    ];
  }

  // Determine the column range for the append call
  // Arrivals: A–E (5 cols), Sold: A–G (7 cols)
  const lastCol = isArrival ? "E" : "G";
  const appendUrl =
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(tabName)}!A1:${lastCol}1:append` +
    `?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

  const appendRes = await fetch(appendUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ values: [rowValues] }),
  });

  if (!appendRes.ok) {
    const errText = await appendRes.text();
    return jsonResponse({
      error: `Google Sheets append to "${tabName}" failed.`,
      detail: errText,
    }, 500);
  }

  const appendData = await appendRes.json();

  // ============================================================
  // STEP 5: Update the matching row in the "Stock" tab (in-place)
  //
  // The Stock tab has ONE row per bike:
  //   Column A: Bike Name
  //   Column B: Category
  //   Column C: Current Quantity  ← update this
  //   Column D: Last Updated      ← update this
  //
  // Strategy:
  //   a. GET all values in column A of Stock tab
  //   b. Find which row number (1-based) matches bike.name
  //   c. PUT the updated C and D cells for that row
  // ============================================================

  // 5a. Fetch column A of the Stock tab to locate the bike's row
  const stockGetUrl =
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent("Stock")}!A:A`;

  const stockGetRes = await fetch(stockGetUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!stockGetRes.ok) {
    const errText = await stockGetRes.text();
    return jsonResponse({
      error: "Failed to read Stock tab from Google Sheets.",
      detail: errText,
    }, 500);
  }

  const stockGetData = await stockGetRes.json();
  // values is a 2-D array: [[row1colA], [row2colA], ...] — rows with no data may be missing
  const columnAValues: string[][] = stockGetData.values ?? [];

  // 5b. Find the 1-based row index for this bike (column A holds bike names)
  let bikeRowIndex = -1; // 1-based row number in the sheet
  for (let i = 0; i < columnAValues.length; i++) {
    if (columnAValues[i]?.[0]?.trim().toLowerCase() === bike.name.trim().toLowerCase()) {
      bikeRowIndex = i + 1; // convert to 1-based
      break;
    }
  }

  if (bikeRowIndex === -1) {
    // Bike not yet in Stock tab — this shouldn't happen in normal operation,
    // but we'll return a partial success rather than a hard failure.
    console.warn(`Bike "${bike.name}" not found in Stock tab. Log row was appended, but Stock tab was not updated.`);
    return jsonResponse({
      success: true,
      message: `Row appended to "${tabName}" tab. WARNING: bike not found in Stock tab — Stock tab not updated.`,
      updatedRange: appendData.updates?.updatedRange ?? "unknown",
      bikeName: bike.name,
      newStock: bike.quantity,
    });
  }

  // 5c. Update columns C and D of the located row
  //   Column C: Current Quantity
  //   Column D: Last Updated (reuse the same formatted date)
  const stockUpdateRange = `Stock!C${bikeRowIndex}:D${bikeRowIndex}`;
  const stockUpdateUrl =
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(stockUpdateRange)}` +
    `?valueInputOption=USER_ENTERED`;

  const stockUpdateRes = await fetch(stockUpdateUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      range: stockUpdateRange,
      majorDimension: "ROWS",
      values: [[bike.quantity, formattedDate]],
    }),
  });

  if (!stockUpdateRes.ok) {
    const errText = await stockUpdateRes.text();
    return jsonResponse({
      error: "Failed to update Stock tab in Google Sheets.",
      detail: errText,
    }, 500);
  }

  const stockUpdateData = await stockUpdateRes.json();

  // ============================================================
  // STEP 6: Return success response
  // ============================================================
  return jsonResponse({
    success: true,
    message: `Row appended to "${tabName}" tab and Stock tab updated successfully.`,
    logRange: appendData.updates?.updatedRange ?? "unknown",
    stockRange: stockUpdateData.updatedRange ?? "unknown",
    bikeName: bike.name,
    category: bike.category,
    newStock: bike.quantity,
  });
});

// =============================================================================
// HELPER: getGoogleAccessToken
//
// Signs a JWT with the service account private key and exchanges it for an
// OAuth2 access token from Google's token endpoint.
//
// @param clientEmail   - The service account email (iss claim)
// @param privateKeyPem - The RSA private key in PEM format
// @returns A short-lived Bearer token string
// =============================================================================
async function getGoogleAccessToken(clientEmail: string, privateKeyPem: string): Promise<string> {
  // 1. Import the private key into the Web Crypto API (available in Deno)
  const privateKey = await importPrivateKey(privateKeyPem);

  // 2. Build the JWT payload
  const now = Math.floor(Date.now() / 1000); // current time in seconds
  const payload = {
    iss: clientEmail,   // issuer (service account)
    sub: clientEmail,   // subject (same as issuer for service accounts)
    scope: "https://www.googleapis.com/auth/spreadsheets", // only need Sheets access
    aud: "https://oauth2.googleapis.com/token",            // token endpoint
    iat: now,           // issued at
    exp: now + 3600,    // expires in 1 hour
  };

  // 3. Build the JWT header
  const header = { alg: "RS256", typ: "JWT" };

  // 4. Base64url-encode header and payload (JWT format)
  const encode = (obj: unknown) =>
    btoa(JSON.stringify(obj))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

  const unsignedJwt = `${encode(header)}.${encode(payload)}`;

  // 5. Sign the JWT using RS256 (RSASSA-PKCS1-v1_5 with SHA-256)
  const signatureBytes = await crypto.subtle.sign(
    { name: "RSASSA-PKCS1-v1_5" },
    privateKey,
    new TextEncoder().encode(unsignedJwt)
  );

  // 6. Base64url-encode the signature
  const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBytes)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const signedJwt = `${unsignedJwt}.${signature}`;

  // 7. Exchange the signed JWT for an OAuth2 access token
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
//
// Converts a PEM-formatted RSA private key string into a CryptoKey that
// the Web Crypto API can use for signing.
//
// PEM format looks like:
//   -----BEGIN PRIVATE KEY-----
//   <base64-encoded DER bytes>
//   -----END PRIVATE KEY-----
// =============================================================================
async function importPrivateKey(pem: string): Promise<CryptoKey> {
  // Strip the PEM header/footer lines and whitespace, leaving only base64
  const pemContents = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s+/g, ""); // remove all whitespace/newlines

  // Decode base64 to raw binary (DER format)
  const binaryDer = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

  // Import using Web Crypto — algorithm must match what we'll sign with (RS256)
  return await crypto.subtle.importKey(
    "pkcs8",              // private key format
    binaryDer.buffer,     // the raw key bytes
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    false,                // not extractable
    ["sign"]              // only need signing capability
  );
}
