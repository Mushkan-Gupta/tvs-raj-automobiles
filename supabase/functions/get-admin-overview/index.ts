// =============================================================================
// get-admin-overview/index.ts
// Supabase Edge Function — Aggregate Admin Business Overview & Analytics
// Reads live data from Google Sheets ("Sold", "Documents", "Stock") & Supabase
// =============================================================================

import { CORS_HEADERS, requireRole } from "../_shared/auth.ts";
import { getGoogleAccessToken, batchGetSheetValues } from "../_shared/google.ts";
import { ServerTimer } from "../_shared/timing.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

function jsonResponse(body: unknown, status = 200, extraHeaders?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json", ...extraHeaders },
  });
}

// ── 20-second in-memory cache for parsed sheet data ─────────────────────────
interface CacheEntry { data: unknown; exp: number; fetchedAt: string }
const overviewCache = new Map<string, CacheEntry>();

// ── Date parsing helper ──────────────────────────────────────────────────────
function parseRowDate(dateStr: string): Date | null {
  if (!dateStr || !dateStr.trim()) return null;
  const s = dateStr.trim();
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) return parsed;
  const nepalMatch = s.match(/(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})/);
  if (nepalMatch) {
    const day = parseInt(nepalMatch[1], 10);
    const monthNames = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
    const month = monthNames.indexOf(nepalMatch[2].toLowerCase());
    const year = parseInt(nepalMatch[3], 10);
    if (month !== -1) return new Date(year, month, day);
  }
  const slashMatch = s.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (slashMatch) {
    const d1 = parseInt(slashMatch[1], 10);
    const d2 = parseInt(slashMatch[2], 10);
    const year = parseInt(slashMatch[3], 10);
    const d = new Date(year, d2 - 1, d1);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const timer = new ServerTimer();

  const auth = await timer.measure("auth", () => requireRole(req, ["admin"]));
  if (auth instanceof Response) return auth;

  const clientEmail = Deno.env.get("GOOGLE_CLIENT_EMAIL");
  const privateKeyPem = Deno.env.get("GOOGLE_PRIVATE_KEY")?.replace(/\\n/g, "\n");
  const sheetId = Deno.env.get("GOOGLE_SHEET_ID");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!clientEmail || !privateKeyPem || !sheetId) {
    return jsonResponse({ error: "Missing Google Sheets configuration in environment variables." }, 500);
  }

  const url = new URL(req.url);
  const bypassCache = url.searchParams.get("fresh") === "true" ||
                      req.headers.get("cache-control")?.includes("no-cache");

  // ── Check in-memory cache (20 s TTL) ─────────────────────────────────────
  const cacheKey = `overview:${sheetId}`;
  const cached = overviewCache.get(cacheKey);
  if (!bypassCache && cached && cached.exp > Date.now()) {
    const timingHeader = timer.getHeader();
    return jsonResponse(
      { success: true, data: cached.data, fetchedAt: cached.fetchedAt, cached: true },
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

  // ── Fetch Supabase bikes + all 3 Sheet tabs in parallel ───────────────────
  interface SupabaseBike {
    id: string; name: string; category?: string;
    price?: number; offer_price?: number;
    quantity?: number; low_stock_threshold?: number;
  }

  const sbPromise = (supabaseUrl && serviceRoleKey)
    ? (async (): Promise<SupabaseBike[]> => {
        const sb = createClient(supabaseUrl, serviceRoleKey);
        const { data } = await sb
          .from("bikes")
          .select("id,name,category,price,offer_price,quantity,low_stock_threshold")
          .order("name");
        return (data as SupabaseBike[]) ?? [];
      })()
    : Promise.resolve([] as SupabaseBike[]);

  const batchPromise = timer.measure("sheets_read", () =>
    batchGetSheetValues(accessToken, sheetId, [
      "Sold!A:Z",
      "Documents!A:Z",
      "Stock!A:Z",
    ])
  );

  const [batchMap, supabaseBikes] = await Promise.all([batchPromise, sbPromise]);

  const soldRows: (string | number)[][] = batchMap.get("Sold!A:Z") ?? [];
  const docRows: string[][] = batchMap.get("Documents!A:Z") as string[][] ?? [];
  const stockSheetRows: (string | number)[][] = batchMap.get("Stock!A:Z") ?? [];

  // Map supabase bikes by lowercase trimmed name
  const bikeLookup = new Map<string, SupabaseBike>();
  for (const b of supabaseBikes) {
    if (b.name) bikeLookup.set(b.name.trim().toLowerCase(), b);
  }

  // ===========================================================================
  // Aggregate "Sold" data
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

  const now = new Date();
  const monthlyTrendBuckets: { month: string; shortMonth: string; year: number; monthIndex: number; revenue: number; unitsSold: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthsShort = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
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
    const dateIdx = headers.findIndex((h) => /^date$/i.test(h));
    const bikeNameIdx = headers.findIndex((h) => /bike(\s*name)?/i.test(h));
    const qtyIdx = headers.findIndex((h) => /^quantity$/i.test(h) || /^units/i.test(h));
    const soldPriceIdx = headers.findIndex((h) => /sold\s*price/i.test(h));
    const finalPriceIdx = headers.findIndex((h) => /final\s*price/i.test(h));
    const buyerTypeIdx = headers.findIndex((h) => /buyer\s*type/i.test(h));
    const amountPaidIdx = headers.findIndex((h) => /amount\s*paid/i.test(h));

    for (let r = 1; r < soldRows.length; r++) {
      const row = soldRows[r];
      if (!row || row.length === 0) continue;

      const bikeName = (bikeNameIdx !== -1 ? row[bikeNameIdx] : row[2])?.toString().trim() || "Unknown Bike";
      const rawPrice = (soldPriceIdx !== -1 ? row[soldPriceIdx] : row[7]) ?? 0;
      const soldPrice = Number(String(rawPrice).replace(/[^\d.-]/g, "")) || 0;
      const rawFinalPrice = finalPriceIdx !== -1 ? row[finalPriceIdx] : undefined;
      const finalPriceNum = (rawFinalPrice !== undefined && rawFinalPrice !== null && String(rawFinalPrice).trim() !== "")
        ? Number(String(rawFinalPrice).replace(/[^\d.-]/g, "")) : NaN;
      const effectivePrice = !isNaN(finalPriceNum) && finalPriceNum > 0 ? finalPriceNum : soldPrice;
      const rawQty = (qtyIdx !== -1 ? row[qtyIdx] : row[3]) ?? 1;
      const quantity = Math.max(1, parseInt(String(rawQty).replace(/[^\d]/g, ""), 10) || 1);
      const rawPaid = (amountPaidIdx !== -1 ? row[amountPaidIdx] : row[10]) ?? 0;
      const amountPaid = Number(String(rawPaid).replace(/[^\d.-]/g, "")) || 0;
      const normalizedStatus: "Fully Paid" | "Partial" | "Pending" =
        amountPaid >= effectivePrice ? "Fully Paid" : (amountPaid > 0 ? "Partial" : "Pending");
      const balanceDue = normalizedStatus === "Fully Paid" ? 0 : Math.max(0, effectivePrice - amountPaid);
      const rawBuyer = (buyerTypeIdx !== -1 ? row[buyerTypeIdx] : row[8])?.toString().trim() || "Individual";
      const normalizedBuyer = rawBuyer.toLowerCase() === "corporate" ? "Corporate" : "Individual";

      totalRevenue += effectivePrice;
      totalUnitsSold += quantity;
      if (normalizedStatus !== "Fully Paid" && balanceDue > 0) totalOutstandingBalance += balanceDue;

      if (paymentStatusMap[normalizedStatus]) {
        paymentStatusMap[normalizedStatus].count += 1;
        paymentStatusMap[normalizedStatus].totalAmount += effectivePrice;
        paymentStatusMap[normalizedStatus].amountPaid += amountPaid;
        paymentStatusMap[normalizedStatus].balanceDue += balanceDue;
      }
      if (buyerTypeMap[normalizedBuyer]) {
        buyerTypeMap[normalizedBuyer].count += 1;
        buyerTypeMap[normalizedBuyer].revenue += effectivePrice;
      }

      const modelEntry = modelSalesMap.get(bikeName) || { bikeName, unitsSold: 0, revenue: 0 };
      modelEntry.unitsSold += quantity;
      modelEntry.revenue += effectivePrice;
      modelSalesMap.set(bikeName, modelEntry);

      const rawDateStr = (dateIdx !== -1 ? row[dateIdx] : row[0])?.toString().trim() || "";
      const parsedDate = parseRowDate(rawDateStr);
      if (parsedDate) {
        const bucket = monthlyTrendBuckets.find((b) => b.year === parsedDate.getFullYear() && b.monthIndex === parsedDate.getMonth());
        if (bucket) { bucket.revenue += effectivePrice; bucket.unitsSold += quantity; }
      }
    }
  }

  const salesByModel = Array.from(modelSalesMap.values()).sort((a, b) => b.revenue - a.revenue);
  const monthlyRevenueTrend = monthlyTrendBuckets.map((b) => ({
    month: b.month, shortMonth: b.shortMonth, revenue: b.revenue, unitsSold: b.unitsSold,
  }));

  // ===========================================================================
  // Aggregate "Documents" tab
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
      const isReady = handoverIdx !== -1
        ? String(row[handoverIdx] || "").trim().toUpperCase() === "TRUE"
        : String(row[row.length - 1] || "").trim().toUpperCase() === "TRUE";
      if (isReady) completedHandoverCount += 1; else pendingHandoverCount += 1;
    }
  }

  // ===========================================================================
  // Aggregate "Stock" tab & inventory valuation
  // ===========================================================================
  let currentStockValue = 0;
  let totalStockUnits = 0;
  const lowStockBikes: { name: string; category: string; quantity: number; threshold: number; price: number; status: "out_of_stock" | "low_stock" }[] = [];

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
      const sbBike = bikeLookup.get(bikeName.toLowerCase());
      let bikePrice = 0;
      if (priceIdx !== -1 && row[priceIdx]) bikePrice = Number(String(row[priceIdx]).replace(/[^\d.-]/g, "")) || 0;
      if (!bikePrice && sbBike) bikePrice = Number(sbBike.offer_price || sbBike.price || 0);
      const threshold = sbBike?.low_stock_threshold ?? 2;
      currentStockValue += qty * bikePrice;
      totalStockUnits += qty;
      if (qty <= threshold) {
        lowStockBikes.push({ name: bikeName, category, quantity: qty, threshold, price: bikePrice, status: qty === 0 ? "out_of_stock" : "low_stock" });
      }
    }
  } else if (supabaseBikes.length > 0) {
    for (const b of supabaseBikes) {
      const qty = Math.max(0, b.quantity ?? 0);
      const price = Number(b.offer_price || b.price || 0);
      const threshold = b.low_stock_threshold ?? 2;
      currentStockValue += qty * price;
      totalStockUnits += qty;
      if (qty <= threshold) {
        lowStockBikes.push({ name: b.name, category: b.category || "General", quantity: qty, threshold, price, status: qty === 0 ? "out_of_stock" : "low_stock" });
      }
    }
  }
  lowStockBikes.sort((a, b) => a.quantity - b.quantity);

  const responseData = {
    totalRevenue, totalUnitsSold, totalOutstandingBalance,
    pendingHandoverCount, completedHandoverCount,
    currentStockValue, totalStockUnits,
    paymentStatusBreakdown: [paymentStatusMap["Fully Paid"], paymentStatusMap["Partial"], paymentStatusMap["Pending"]],
    buyerTypeSplit: [buyerTypeMap["Individual"], buyerTypeMap["Corporate"]],
    salesByModel, monthlyRevenueTrend, lowStockBikes,
  };

  const fetchedAt = new Date().toISOString();
  overviewCache.set(cacheKey, { data: responseData, exp: Date.now() + 20_000, fetchedAt });

  timer.log("get-admin-overview");
  const timingHeader = timer.getHeader();
  return jsonResponse(
    { success: true, data: responseData, fetchedAt },
    200,
    { "Server-Timing": timingHeader, "Access-Control-Expose-Headers": "Server-Timing" },
  );
});
