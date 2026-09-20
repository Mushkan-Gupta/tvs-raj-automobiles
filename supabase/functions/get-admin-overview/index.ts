// =============================================================================
// get-admin-overview/index.ts
// Supabase Edge Function — Aggregate Admin Business Overview & Analytics
// Reads live data from Google Sheets ("Sold", "Documents", "Stock") & Supabase
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

// ── Date parsing helper ──────────────────────────────────────────────────────
function parseRowDate(dateStr: string): Date | null {
  if (!dateStr || !dateStr.trim()) return null;
  const s = dateStr.trim();

  // Try standard Date parse first
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) return parsed;

  // Try Nepal format e.g. "24 Jul 2026, 03:45 pm" or "24 Jul 2026"
  const nepalMatch = s.match(/(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})/);
  if (nepalMatch) {
    const day = parseInt(nepalMatch[1], 10);
    const monthNames = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
    const month = monthNames.indexOf(nepalMatch[2].toLowerCase());
    const year = parseInt(nepalMatch[3], 10);
    if (month !== -1) {
      return new Date(year, month, day);
    }
  }

  // Try DD/MM/YYYY or MM/DD/YYYY
  const slashMatch = s.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (slashMatch) {
    const d1 = parseInt(slashMatch[1], 10);
    const d2 = parseInt(slashMatch[2], 10);
    const year = parseInt(slashMatch[3], 10);
    // Assume DD/MM/YYYY
    const d = new Date(year, d2 - 1, d1);
    if (!isNaN(d.getTime())) return d;
  }

  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const clientEmail = Deno.env.get("GOOGLE_CLIENT_EMAIL");
  const privateKeyPem = Deno.env.get("GOOGLE_PRIVATE_KEY")?.replace(/\\n/g, "\n");
  const sheetId = Deno.env.get("GOOGLE_SHEET_ID");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

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

  // ===========================================================================
  // 1. Fetch "Sold" tab from Google Sheets
  // ===========================================================================
  let soldRows: (string | number)[][] = [];
  try {
    const soldUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent("Sold")}!A:Z`;
    const soldRes = await fetch(soldUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (soldRes.ok) {
      const soldData = await soldRes.json();
      soldRows = soldData.values ?? [];
    } else {
      console.warn('[get-admin-overview] Failed to fetch Sold tab:', await soldRes.text());
    }
  } catch (soldErr) {
    console.warn('[get-admin-overview] Sold tab fetch error:', soldErr);
  }

  // ===========================================================================
  // 2. Fetch "Documents" tab from Google Sheets
  // ===========================================================================
  let docRows: string[][] = [];
  try {
    const docUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent("Documents")}!A:Z`;
    const docRes = await fetch(docUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (docRes.ok) {
      const docData = await docRes.json();
      docRows = docData.values ?? [];
    } else {
      console.warn('[get-admin-overview] Failed to fetch Documents tab:', await docRes.text());
    }
  } catch (docErr) {
    console.warn('[get-admin-overview] Documents tab fetch error:', docErr);
  }

  // ===========================================================================
  // 3. Fetch "Stock" tab from Google Sheets
  // ===========================================================================
  let stockSheetRows: (string | number)[][] = [];
  try {
    const stockUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent("Stock")}!A:Z`;
    const stockRes = await fetch(stockUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (stockRes.ok) {
      const stockData = await stockRes.json();
      stockSheetRows = stockData.values ?? [];
    } else {
      console.warn('[get-admin-overview] Failed to fetch Stock tab:', await stockRes.text());
    }
  } catch (stockErr) {
    console.warn('[get-admin-overview] Stock tab fetch error:', stockErr);
  }

  // ===========================================================================
  // 4. Fetch Supabase `bikes` table for authoritative prices & thresholds
  // ===========================================================================
  interface SupabaseBike {
    id: string;
    name: string;
    category?: string;
    price?: number;
    offer_price?: number;
    quantity?: number;
    low_stock_threshold?: number;
  }
  let supabaseBikes: SupabaseBike[] = [];
  if (supabaseUrl && serviceRoleKey) {
    try {
      const sbRes = await fetch(
        `${supabaseUrl}/rest/v1/bikes?select=id,name,category,price,offer_price,quantity,low_stock_threshold&order=name`,
        {
          headers: {
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
            "Content-Type": "application/json",
          },
        }
      );
      if (sbRes.ok) {
        supabaseBikes = await sbRes.json();
      }
    } catch (sbErr) {
      console.warn('[get-admin-overview] Supabase bikes fetch error:', sbErr);
    }
  }

  // Map supabase bikes by lowercase trimmed name
  const bikeLookup = new Map<string, SupabaseBike>();
  for (const b of supabaseBikes) {
    if (b.name) bikeLookup.set(b.name.trim().toLowerCase(), b);
  }

  // ===========================================================================
  // 5. Aggregate "Sold" data
  // ===========================================================================
  let totalRevenue = 0;
  let totalUnitsSold = 0;
  let totalOutstandingBalance = 0;

  const paymentStatusMap = {
    "Fully Paid": { status: "Fully Paid", count: 0, totalAmount: 0, amountPaid: 0, balanceDue: 0 },
    "Partial": { status: "Partial", count: 0, totalAmount: 0, amountPaid: 0, balanceDue: 0 },
    "Pending": { status: "Pending", count: 0, totalAmount: 0, amountPaid: 0, balanceDue: 0 },
  };

  const buyerTypeMap = {
    "Individual": { type: "Individual", count: 0, revenue: 0 },
    "Corporate": { type: "Corporate", count: 0, revenue: 0 },
  };

  const modelSalesMap = new Map<string, { bikeName: string; unitsSold: number; revenue: number }>();

  // Prepare monthly trend buckets for the last 6 months (inclusive of current month)
  const now = new Date();
  const monthlyTrendBuckets: { month: string; shortMonth: string; year: number; monthIndex: number; revenue: number; unitsSold: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthsShort = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    monthlyTrendBuckets.push({
      month: `${monthsShort[d.getMonth()]} ${d.getFullYear()}`,
      shortMonth: monthsShort[d.getMonth()],
      year: d.getFullYear(),
      monthIndex: d.getMonth(),
      revenue: 0,
      unitsSold: 0,
    });
  }

  if (soldRows.length > 1) {
    const headers = soldRows[0].map((h) => (h ?? "").toString().trim());

    // Dynamic header lookup
    const dateIdx = headers.findIndex((h) => /^date$/i.test(h));
    const bikeNameIdx = headers.findIndex((h) => /bike(\s*name)?/i.test(h));
    const qtyIdx = headers.findIndex((h) => /^quantity$/i.test(h) || /^units/i.test(h));
    const soldPriceIdx = headers.findIndex((h) => /sold\s*price/i.test(h));
    const buyerTypeIdx = headers.findIndex((h) => /buyer\s*type/i.test(h));
    const paymentStatusIdx = headers.findIndex((h) => /payment\s*status/i.test(h));
    const amountPaidIdx = headers.findIndex((h) => /amount\s*paid/i.test(h));
    const balanceDueIdx = headers.findIndex((h) => /balance\s*due/i.test(h));

    for (let r = 1; r < soldRows.length; r++) {
      const row = soldRows[r];
      if (!row || row.length === 0) continue;

      const bikeName = (bikeNameIdx !== -1 ? row[bikeNameIdx] : row[2])?.toString().trim() || "Unknown Bike";
      const rawPrice = (soldPriceIdx !== -1 ? row[soldPriceIdx] : row[7]) ?? 0;
      const soldPrice = Number(String(rawPrice).replace(/[^\d.-]/g, "")) || 0;

      const rawQty = (qtyIdx !== -1 ? row[qtyIdx] : row[3]) ?? 1;
      const quantity = Math.max(1, parseInt(String(rawQty).replace(/[^\d]/g, ""), 10) || 1);

      const rawStatus = (paymentStatusIdx !== -1 ? row[paymentStatusIdx] : row[9])?.toString().trim() || "Pending";
      const normalizedStatus: "Fully Paid" | "Partial" | "Pending" =
        rawStatus.toLowerCase() === "fully paid"
          ? "Fully Paid"
          : rawStatus.toLowerCase() === "partial"
          ? "Partial"
          : "Pending";

      const rawPaid = (amountPaidIdx !== -1 ? row[amountPaidIdx] : row[10]) ?? 0;
      const amountPaid = Number(String(rawPaid).replace(/[^\d.-]/g, "")) || (normalizedStatus === "Fully Paid" ? soldPrice : 0);

      const rawBalance = (balanceDueIdx !== -1 ? row[balanceDueIdx] : row[11]) ?? 0;
      let balanceDue = Number(String(rawBalance).replace(/[^\d.-]/g, "")) || Math.max(0, soldPrice - amountPaid);
      if (normalizedStatus === "Fully Paid") {
        balanceDue = 0;
      }

      const rawBuyer = (buyerTypeIdx !== -1 ? row[buyerTypeIdx] : row[8])?.toString().trim() || "Individual";
      const normalizedBuyer = rawBuyer.toLowerCase() === "corporate" ? "Corporate" : "Individual";

      // 1. Total revenue & units
      totalRevenue += soldPrice;
      totalUnitsSold += quantity;

      // 2. Outstanding balance
      if (normalizedStatus !== "Fully Paid" && balanceDue > 0) {
        totalOutstandingBalance += balanceDue;
      }

      // 3. Payment status breakdown
      if (paymentStatusMap[normalizedStatus]) {
        paymentStatusMap[normalizedStatus].count += 1;
        paymentStatusMap[normalizedStatus].totalAmount += soldPrice;
        paymentStatusMap[normalizedStatus].amountPaid += amountPaid;
        paymentStatusMap[normalizedStatus].balanceDue += balanceDue;
      }

      // 4. Buyer type split
      if (buyerTypeMap[normalizedBuyer]) {
        buyerTypeMap[normalizedBuyer].count += 1;
        buyerTypeMap[normalizedBuyer].revenue += soldPrice;
      }

      // 5. Sales by model
      const modelEntry = modelSalesMap.get(bikeName) || { bikeName, unitsSold: 0, revenue: 0 };
      modelEntry.unitsSold += quantity;
      modelEntry.revenue += soldPrice;
      modelSalesMap.set(bikeName, modelEntry);

      // 6. Monthly trend
      const rawDateStr = (dateIdx !== -1 ? row[dateIdx] : row[0])?.toString().trim() || "";
      const parsedDate = parseRowDate(rawDateStr);
      if (parsedDate) {
        const pYear = parsedDate.getFullYear();
        const pMonth = parsedDate.getMonth();
        const bucket = monthlyTrendBuckets.find((b) => b.year === pYear && b.monthIndex === pMonth);
        if (bucket) {
          bucket.revenue += soldPrice;
          bucket.unitsSold += quantity;
        }
      }
    }
  }

  // Format salesByModel array sorted by revenue descending
  const salesByModel = Array.from(modelSalesMap.values()).sort((a, b) => b.revenue - a.revenue);

  // Format monthly revenue trend (array of { month, revenue, unitsSold })
  const monthlyRevenueTrend = monthlyTrendBuckets.map((b) => ({
    month: b.month,
    shortMonth: b.shortMonth,
    revenue: b.revenue,
    unitsSold: b.unitsSold,
  }));

  // ===========================================================================
  // 6. Aggregate "Documents" tab (Handover Ready)
  // ===========================================================================
  let pendingHandoverCount = 0;
  let completedHandoverCount = 0;

  if (docRows.length > 1) {
    const docHeaders = docRows[0].map((h) => (h ?? "").trim());
    const handoverIdx = docHeaders.findIndex((h) => /handover\s*ready/i.test(h));
    const saleIdIdx = docHeaders.findIndex((h) => /sale\s*id/i.test(h));

    for (let i = 1; i < docRows.length; i++) {
      const row = docRows[i];
      if (!row || row.length === 0) continue;
      const sId = (saleIdIdx !== -1 ? row[saleIdIdx] : row[0])?.trim();
      if (!sId) continue;

      const isReady =
        handoverIdx !== -1
          ? String(row[handoverIdx] || "").trim().toUpperCase() === "TRUE"
          : String(row[row.length - 1] || "").trim().toUpperCase() === "TRUE";

      if (isReady) {
        completedHandoverCount += 1;
      } else {
        pendingHandoverCount += 1;
      }
    }
  }

  // ===========================================================================
  // 7. Aggregate "Stock" tab & inventory valuation
  // ===========================================================================
  let currentStockValue = 0;
  let totalStockUnits = 0;
  const lowStockBikes: {
    name: string;
    category: string;
    quantity: number;
    threshold: number;
    price: number;
    status: "out_of_stock" | "low_stock";
  }[] = [];

  // Parse Stock sheet if available
  if (stockSheetRows.length > 1) {
    const stockHeaders = stockSheetRows[0].map((h) => (h ?? "").toString().trim());
    const nameIdx = stockHeaders.findIndex((h) => /bike(\s*name)?/i.test(h));
    const catIdx = stockHeaders.findIndex((h) => /category/i.test(h));
    const qtyIdx = stockHeaders.findIndex((h) => /quantity|stock/i.test(h));
    const priceIdx = stockHeaders.findIndex((h) => /price/i.test(h));

    for (let s = 1; s < stockSheetRows.length; s++) {
      const row = stockSheetRows[s];
      if (!row || row.length === 0) continue;

      const bikeName = (nameIdx !== -1 ? row[nameIdx] : row[0])?.toString().trim();
      if (!bikeName) continue;

      const category = (catIdx !== -1 ? row[catIdx] : row[1])?.toString().trim() || "General";
      const rawQty = (qtyIdx !== -1 ? row[qtyIdx] : row[2]) ?? 0;
      const qty = Math.max(0, parseInt(String(rawQty).replace(/[^\d]/g, ""), 10) || 0);

      // Price lookup: check sheet price column first, fallback to Supabase bike price
      const sbBike = bikeLookup.get(bikeName.toLowerCase());
      let bikePrice = 0;
      if (priceIdx !== -1 && row[priceIdx]) {
        bikePrice = Number(String(row[priceIdx]).replace(/[^\d.-]/g, "")) || 0;
      }
      if (!bikePrice && sbBike) {
        bikePrice = Number(sbBike.offer_price || sbBike.price || 0);
      }

      const threshold = sbBike?.low_stock_threshold ?? 2;

      currentStockValue += qty * bikePrice;
      totalStockUnits += qty;

      if (qty <= threshold) {
        lowStockBikes.push({
          name: bikeName,
          category,
          quantity: qty,
          threshold,
          price: bikePrice,
          status: qty === 0 ? "out_of_stock" : "low_stock",
        });
      }
    }
  } else if (supabaseBikes.length > 0) {
    // Fallback directly to Supabase bikes table if Stock sheet was empty
    for (const b of supabaseBikes) {
      const qty = Math.max(0, b.quantity ?? 0);
      const price = Number(b.offer_price || b.price || 0);
      const threshold = b.low_stock_threshold ?? 2;

      currentStockValue += qty * price;
      totalStockUnits += qty;

      if (qty <= threshold) {
        lowStockBikes.push({
          name: b.name,
          category: b.category || "General",
          quantity: qty,
          threshold,
          price,
          status: qty === 0 ? "out_of_stock" : "low_stock",
        });
      }
    }
  }

  // Sort low stock items with 0 stock first, then ascending by quantity
  lowStockBikes.sort((a, b) => a.quantity - b.quantity);

  // ===========================================================================
  // 8. Final Consolidated Response
  // ===========================================================================
  const responseData = {
    success: true,
    data: {
      totalRevenue,
      totalUnitsSold,
      totalOutstandingBalance,
      pendingHandoverCount,
      completedHandoverCount,
      currentStockValue,
      totalStockUnits,
      paymentStatusBreakdown: [
        paymentStatusMap["Fully Paid"],
        paymentStatusMap["Partial"],
        paymentStatusMap["Pending"],
      ],
      buyerTypeSplit: [
        buyerTypeMap["Individual"],
        buyerTypeMap["Corporate"],
      ],
      salesByModel,
      monthlyRevenueTrend,
      lowStockBikes,
    },
    fetchedAt: new Date().toISOString(),
  };

  return jsonResponse(responseData);
});

// =============================================================================
// OAuth Helpers (Google Service Account JWT)
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
