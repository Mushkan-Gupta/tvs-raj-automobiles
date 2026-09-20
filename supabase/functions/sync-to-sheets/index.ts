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
//   "Arrivals"  — Date | Bike Name | Quantity | Logged By | New Stock Level
//   "Sold"      — Date | Sale ID | Bike Name | Quantity | Logged By | Customer Name | Customer Phone | Sold Price | Buyer Type | Payment Status | Amount Paid | Balance Due | New Stock Level
//   "Documents" — Sale ID | Buyer Type | [Document Checkboxes] | Handover Ready
//   "Stock"     — Bike Name | Category | Current Quantity | Last Updated
//                 (ONE row per bike; updated in-place, never appended)
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
    sold_price?: number;
    soldPrice?: number;
    buyer_type?: string;
    buyerType?: string;
    payment_status?: string;
    paymentStatus?: string;
    amount_paid?: number;
    amountPaid?: number;
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
      day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kathmandu",
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

  // --- Handle 'inquiry_status_update' type specifically ---
  if (stockLog.type === "inquiry_status_update") {
    const reqFields = ["type", "phone", "status", "created_at"];
    for (const field of reqFields) {
      if (stockLog[field as keyof typeof stockLog] === undefined || stockLog[field as keyof typeof stockLog] === null) {
        return jsonResponse({ error: `Missing required field for inquiry_status_update: ${field}` }, 400);
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
      day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kathmandu",
    });

    const getUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent("Inquiries")}!A:C`;
    const getRes = await fetch(getUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!getRes.ok) return jsonResponse({ error: "Failed to read Inquiries tab.", detail: await getRes.text() }, 500);

    const getData = await getRes.json();
    const rows: string[][] = getData.values ?? [];
    
    let rowIndex = -1;
    for (let i = 0; i < rows.length; i++) {
      if (rows[i]?.[0]?.trim() === formattedDate.trim() && rows[i]?.[2]?.trim() === stockLog.phone?.trim()) {
        rowIndex = i + 1; // 1-based index
        break;
      }
    }

    if (rowIndex === -1) {
      console.warn(`Inquiry not found in Sheet for phone ${stockLog.phone} at ${formattedDate}`);
      return jsonResponse({ success: true, message: "Inquiry not found in sheet, skipped update." });
    }

    const updateRange = `Inquiries!F${rowIndex}:F${rowIndex}`;
    const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(updateRange)}?valueInputOption=USER_ENTERED`;
    const updateRes = await fetch(updateUrl, {
      method: "PUT",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ range: updateRange, majorDimension: "ROWS", values: [[stockLog.status]] }),
    });

    if (!updateRes.ok) {
      return jsonResponse({ error: "Failed to update inquiry status.", detail: await updateRes.text() }, 500);
    }
    return jsonResponse({ success: true, message: "Inquiry status updated in Google Sheets." });
  }

  // Validate required fields
  const required = ["bike_id", "type", "quantity", "logged_by", "created_at"];
  for (const field of required) {
    if (stockLog[field as keyof typeof stockLog] === undefined || stockLog[field as keyof typeof stockLog] === null) {
      return jsonResponse({ error: `Missing required field: ${field}` }, 400);
    }
  }

  const isArrival = stockLog.type.toLowerCase() === "arrival";

  // Validate required sale fields when action is "sale" / "sold"
  if (!isArrival) {
    const rawSoldPrice = stockLog.sold_price ?? stockLog.soldPrice;
    const rawBuyerType = stockLog.buyer_type ?? stockLog.buyerType;
    const rawPaymentStatus = stockLog.payment_status ?? stockLog.paymentStatus;

    if (rawSoldPrice === undefined || rawSoldPrice === null || rawSoldPrice === "" || Number.isNaN(Number(rawSoldPrice))) {
      return jsonResponse({ error: "Missing or invalid required field for sale: Sold Price" }, 400);
    }
    if (!rawBuyerType || String(rawBuyerType).trim() === "") {
      return jsonResponse({ error: "Missing required field for sale: Buyer Type" }, 400);
    }
    if (!rawPaymentStatus || String(rawPaymentStatus).trim() === "") {
      return jsonResponse({ error: "Missing required field for sale: Payment Status" }, 400);
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
  //         and to "Documents" tab if it is a sale
  // ============================================================

  const sheetId = Deno.env.get("GOOGLE_SHEET_ID");
  if (!sheetId) {
    return jsonResponse({ error: "GOOGLE_SHEET_ID environment variable is missing." }, 500);
  }

  // Format the date/time in NPT (UTC+5:45)
  // Example output: "23 Jul 2026, 02:41 PM"
  const date = new Date(stockLog.created_at);
  const formattedDate = date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kathmandu",
  });

  const customerName  = isArrival ? "" : (stockLog.customer_name  ?? "");
  const customerPhone = isArrival ? "" : (stockLog.customer_phone ?? "");

  // Choose target tab and build the appropriate row
  // Arrivals: Date | Bike Name | Quantity | Logged By | New Stock Level
  // Sold:     Date | Bike Name | Quantity | Logged By | Customer Name | Customer Phone | New Stock Level | Sale ID | Sold Price | Buyer Type | Payment Status | Amount Paid | Balance Due
  let tabName: string;
  let rowValues: (string | number | boolean)[];
  let saleId: string | undefined;
  // deno-lint-ignore no-explicit-any
  let docAppendData: any = null;

  if (isArrival) {
    tabName = "Arrivals";
    rowValues = [
      formattedDate,
      bike.name,
      stockLog.quantity!,
      stockLog.logged_by!,
      bike.quantity,   // new stock level (already updated in DB by the time this runs)
    ];
  } else {
    tabName = "Sold";

    const soldPrice = Number(stockLog.sold_price ?? stockLog.soldPrice);
    const buyerType = String(stockLog.buyer_type ?? stockLog.buyerType).trim();
    const paymentStatus = String(stockLog.payment_status ?? stockLog.paymentStatus).trim();
    const rawAmountPaid = stockLog.amount_paid ?? stockLog.amountPaid;
    const amountPaid = (rawAmountPaid !== undefined && rawAmountPaid !== null && rawAmountPaid !== "")
      ? Number(rawAmountPaid)
      : 0;

    // Generate unique Sale ID: "SALE-" + base36 timestamp
    saleId = `SALE-${Date.now().toString(36).toUpperCase()}`;

    // Calculate:
    // finalAmountPaid = (paymentStatus === "Fully Paid") ? soldPrice : amountPaid
    // balanceDue = soldPrice - finalAmountPaid
    const finalAmountPaid = paymentStatus === "Fully Paid" ? soldPrice : amountPaid;
    const balanceDue = soldPrice - finalAmountPaid;

    // A map of all values we can place — keyed by canonical field name.
    // The header-matching logic below picks the right value for each column.
    const soldValueMap: Record<string, string | number> = {
      date:         formattedDate,
      "sale id":    saleId,
      "bike name":  bike.name,
      quantity:     stockLog.quantity!,
      "logged by":  stockLog.logged_by!,
      "customer name":  customerName,
      "customer phone": customerPhone,
      "sold price": soldPrice,
      "buyer type": buyerType,
      "payment status": paymentStatus,
      "amount paid": finalAmountPaid,
      "balance due": balanceDue,
      "new stock level": bike.quantity,
    };

    // ── Fetch the actual header row of the Sold tab ──────────────────────────
    // This lets us write values into the correct columns regardless of how the
    // sheet owner has ordered them.
    let soldHeaders: string[] = [];
    try {
      const soldHeaderUrl =
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent("Sold")}!1:1`;
      const soldHeaderRes = await fetch(soldHeaderUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (soldHeaderRes.ok) {
        const soldHeaderData = await soldHeaderRes.json();
        soldHeaders = soldHeaderData.values?.[0] ?? [];
      }
    } catch (e) {
      console.warn("Could not read headers from Sold tab:", e);
    }

    if (soldHeaders.length > 0) {
      // Map each header to its value using case-insensitive, trimmed matching
      rowValues = soldHeaders.map((header) => {
        const h = header.trim().toLowerCase();
        // Try exact key match first
        if (soldValueMap[h] !== undefined) return soldValueMap[h];
        // Fuzzy matches for common header variations
        if (h.includes("sale") && h.includes("id")) return saleId!;
        if (h.includes("bike") && h.includes("name")) return bike.name;
        if (h.includes("customer") && h.includes("name")) return customerName;
        if (h.includes("customer") && h.includes("phone")) return customerPhone;
        if (h.includes("logged")) return stockLog.logged_by!;
        if (h.includes("sold") && h.includes("price")) return soldPrice;
        if (h.includes("buyer")) return buyerType;
        if (h.includes("payment") && h.includes("status")) return paymentStatus;
        if (h.includes("amount") && h.includes("paid")) return finalAmountPaid;
        if (h.includes("balance")) return balanceDue;
        if (h.includes("stock") || h.includes("quantity")) {
          // "quantity" (units sold) vs "new stock level" (current stock after sale)
          if (h.includes("new") || h.includes("level") || h.includes("stock")) return bike.quantity;
          return stockLog.quantity!;
        }
        if (h.includes("date")) return formattedDate;
        // Unknown column — leave blank
        return "";
      });
    } else {
      // Fallback: use the sheet's confirmed column order as documented in the header comment:
      // Date | Sale ID | Bike Name | Quantity | Logged By | Customer Name | Customer Phone |
      // Sold Price | Buyer Type | Payment Status | Amount Paid | Balance Due | New Stock Level
      rowValues = [
        formattedDate,
        saleId,
        bike.name,
        stockLog.quantity!,
        stockLog.logged_by!,
        customerName,
        customerPhone,
        soldPrice,
        buyerType,
        paymentStatus,
        finalAmountPaid,
        balanceDue,
        bike.quantity,   // New Stock Level
      ];
    }
  }

  // Determine the column range for the append call
  // Arrivals: A–E (5 cols), Sold: A–M (13 cols)
  const lastCol = isArrival ? "E" : "M";
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
  if (!isArrival && saleId) {
    const buyerType = String(stockLog.buyer_type ?? stockLog.buyerType).trim();
    const isIndividual = buyerType.toLowerCase() === "individual";

    // ── Individual-specific document columns (exact real header names) ────────
    // Citizenship / NID / Passport | Driving License | Passport Photos | PAN Card
    // ── Corporate-specific document columns ───────────────────────────────────
    // Company Registration Certificate | Company PAN/VAT Certificate |
    // Board Authorization Letter | Authorized Signatory ID
    // ── Common columns (both buyer types) ─────────────────────────────────────
    // Payment Receipt | Insurance Collected | Handover Ready

    // Returns true if this header belongs to an Individual-specific document column
    function isIndividualDocCol(h: string): boolean {
      return (
        h.includes("citizenship") || h.includes("nid") ||
        h.includes("passport") ||
        h.includes("driving") || h.includes("license") ||
        (h.includes("pan") && !h.includes("vat") && !h.includes("company"))
      );
    }

    // Returns true if this header belongs to a Corporate-specific document column
    function isCorporateDocCol(h: string): boolean {
      return (
        h.includes("registration") ||
        h.includes("company") ||
        (h.includes("pan") && h.includes("vat")) ||
        h.includes("board") || h.includes("authorization") || h.includes("signatory")
      );
    }

    // Dynamically query row 1 headers of Documents tab to match existing column order
    let docRowValues: (string | boolean)[] = [];
    try {
      const docHeaderUrl =
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent("Documents")}!1:1`;
      const docHeaderRes = await fetch(docHeaderUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (docHeaderRes.ok) {
        const docHeaderData = await docHeaderRes.json();
        const headers: string[] = docHeaderData.values?.[0] ?? [];

        if (headers.length > 0) {
          docRowValues = headers.map((header) => {
            const h = header.trim().toLowerCase();

            // System / metadata columns — fill with actual values
            if (h.includes("sale") && h.includes("id")) return saleId!;
            if (h.includes("buyer") && h.includes("type")) return buyerType;
            if (h.includes("customer") && h.includes("name")) return customerName;
            if (h.includes("customer") && h.includes("phone")) return customerPhone;
            if (h.includes("bike")) return bike.name;
            if (h.includes("date")) return formattedDate;

            // Common document checkboxes — always start as false
            if (h.includes("handover")) return false;
            if (h.includes("payment") && h.includes("receipt")) return false;
            if (h.includes("insurance")) return false;

            // Buyer-type-specific columns:
            // Set to false for the matching buyer type, "Not Required" for the other type
            const indCol = isIndividualDocCol(h);
            const corpCol = isCorporateDocCol(h);

            if (indCol && !corpCol) return isIndividual ? false : "Not Required";
            if (corpCol && !indCol) return isIndividual ? "Not Required" : false;

            // Ambiguous or genuinely unknown column — default false
            return false;
          });
        }
      }
    } catch (e) {
      console.warn("Could not read headers from Documents tab:", e);
    }

    // Fallback if headers could not be fetched.
    // Real column order:
    // Sale ID | Buyer Type | Citizenship/NID/Passport | Driving License | Passport Photos |
    // PAN Card | Company Registration Certificate | Company PAN/VAT Certificate |
    // Board Authorization Letter | Authorized Signatory ID |
    // Payment Receipt | Insurance Collected | Handover Ready
    if (docRowValues.length === 0) {
      docRowValues = [
        saleId,                                // Sale ID
        buyerType,                             // Buyer Type
        isIndividual ? false : "Not Required", // Citizenship / NID / Passport
        isIndividual ? false : "Not Required", // Driving License
        isIndividual ? false : "Not Required", // Passport Photos
        isIndividual ? false : "Not Required", // PAN Card
        isIndividual ? "Not Required" : false, // Company Registration Certificate
        isIndividual ? "Not Required" : false, // Company PAN/VAT Certificate
        isIndividual ? "Not Required" : false, // Board Authorization Letter
        isIndividual ? "Not Required" : false, // Authorized Signatory ID
        false,                                 // Payment Receipt
        false,                                 // Insurance Collected
        false,                                 // Handover Ready
      ];
    }

    const docAppendUrl =
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent("Documents")}!A1:append` +
      `?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

    const docAppendRes = await fetch(docAppendUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ values: [docRowValues] }),
    });

    if (!docAppendRes.ok) {
      const docErrText = await docAppendRes.text();
      return jsonResponse({
        error: `Google Sheets append to "Documents" failed.`,
        detail: docErrText,
      }, 500);
    }

    docAppendData = await docAppendRes.json();
  }

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
    message: isArrival
      ? `Row appended to "${tabName}" tab and Stock tab updated successfully.`
      : `Row appended to "Sold" and "Documents" tabs (Sale ID: ${saleId}) and Stock tab updated successfully.`,
    saleId: saleId ?? null,
    logRange: appendData.updates?.updatedRange ?? "unknown",
    docRange: docAppendData?.updates?.updatedRange ?? null,
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
