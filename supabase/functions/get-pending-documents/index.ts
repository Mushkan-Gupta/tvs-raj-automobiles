// =============================================================================
// get-pending-documents/index.ts
// Supabase Edge Function — Fetch sales with pending documentation from Google Sheets
// =============================================================================

import { CORS_HEADERS, requireRole } from "../_shared/auth.ts";
import { getGoogleAccessToken, batchGetSheetValues } from "../_shared/google.ts";
import { ServerTimer } from "../_shared/timing.ts";

function jsonResponse(body: unknown, status = 200, extraHeaders?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json", ...extraHeaders },
  });
}

// ── 20-second in-memory cache (bypassed after any write) ─────────────────────
interface CacheEntry { data: unknown; exp: number }
const docsCache = new Map<string, CacheEntry>();

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const timer = new ServerTimer();
  const auth = await timer.measure("auth", () => requireRole(req, ["admin", "employee"]));
  if (auth instanceof Response) return auth;

  const clientEmail = Deno.env.get("GOOGLE_CLIENT_EMAIL");
  const privateKeyPem = Deno.env.get("GOOGLE_PRIVATE_KEY")?.replace(/\\n/g, "\n");
  const sheetId = Deno.env.get("GOOGLE_SHEET_ID");

  if (!clientEmail || !privateKeyPem || !sheetId) {
    return jsonResponse({ error: "Missing Google Sheets configuration in environment variables." }, 500);
  }

  const url = new URL(req.url);
  const bypassCache = url.searchParams.get("fresh") === "true" ||
                      req.headers.get("cache-control")?.includes("no-cache");

  // ── Check in-memory cache (20 s TTL) ─────────────────────────────────────
  const cacheKey = `docs:${sheetId}`;
  const cached = docsCache.get(cacheKey);
  if (!bypassCache && cached && cached.exp > Date.now()) {
    const timingHeader = timer.getHeader();
    return jsonResponse(
      { ...(cached.data as object), cached: true },
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

  // ── Fetch Documents + Sold in one batchGet ────────────────────────────────
  let batchMap: Map<string, unknown[][]>;
  try {
    batchMap = await timer.measure("sheets_read", () =>
      batchGetSheetValues(accessToken, sheetId, ["Documents!A:Z", "Sold!A:M"])
    );
  } catch (err) {
    return jsonResponse({
      error: 'Failed to read from Google Sheets.',
      detail: err instanceof Error ? err.message : String(err),
    }, 500);
  }

  const docRows: string[][] = batchMap.get("Documents!A:Z") as string[][] ?? [];
  const soldRawRows: string[][] = batchMap.get("Sold!A:M") as string[][] ?? [];

  if (docRows.length <= 1) {
    const result = { success: true, documents: [], allDocHeaders: [] };
    docsCache.set(cacheKey, { data: result, exp: Date.now() + 20_000 });
    timer.log("get-pending-documents");
    const timingHeader = timer.getHeader();
    return jsonResponse(result, 200, { "Server-Timing": timingHeader, "Access-Control-Expose-Headers": "Server-Timing" });
  }

  const docHeaders = docRows[0].map((h) => (h ?? "").trim());
  const saleIdIdx = docHeaders.findIndex((h) => /sale\s*id/i.test(h));
  const buyerTypeIdx = docHeaders.findIndex((h) => /buyer\s*type/i.test(h));
  const handoverIdx = docHeaders.findIndex((h) => /handover\s*ready/i.test(h));
  let customerNameIdx = docHeaders.findIndex((h) => /customer\s*name/i.test(h));
  let bikeNameIdx = docHeaders.findIndex((h) => /bike(\s*name)?/i.test(h));

  // Build Sold lookup if Documents is missing name columns
  const soldLookup = new Map<string, { customerName: string; bikeName: string }>();
  if (customerNameIdx === -1 || bikeNameIdx === -1) {
    if (soldRawRows.length > 1) {
      const soldHeaders = soldRawRows[0].map((h) => (h ?? "").trim());
      const soldSaleIdIdx = soldHeaders.findIndex((h) => /sale\s*id/i.test(h));
      const soldCustIdx = soldHeaders.findIndex((h) => /customer\s*name/i.test(h));
      const soldBikeIdx = soldHeaders.findIndex((h) => /bike(\s*name)?/i.test(h));
      for (let i = 1; i < soldRawRows.length; i++) {
        const sId = soldRawRows[i]?.[soldSaleIdIdx !== -1 ? soldSaleIdIdx : 7]?.trim();
        if (sId) {
          soldLookup.set(sId, {
            customerName: (soldCustIdx !== -1 ? soldRawRows[i]?.[soldCustIdx] : soldRawRows[i]?.[4]) ?? "—",
            bikeName: (soldBikeIdx !== -1 ? soldRawRows[i]?.[soldBikeIdx] : soldRawRows[i]?.[1]) ?? "—",
          });
        }
      }
    }
  }

  // Identify checkbox column indices
  const checkboxCols: { name: string; index: number }[] = [];
  for (let c = 0; c < docHeaders.length; c++) {
    const h = docHeaders[c];
    if (!h) continue;
    if (
      c === saleIdIdx || c === buyerTypeIdx || c === customerNameIdx ||
      c === bikeNameIdx || c === handoverIdx ||
      /^(date|created_at|logged\s*by|phone)$/i.test(h)
    ) continue;
    checkboxCols.push({ name: h, index: c });
  }

  function isIndividualDocCol(h: string): boolean {
    const lh = h.trim().toLowerCase();
    return (lh.includes("citizenship") || lh.includes("nid") || lh.includes("passport") ||
      lh.includes("driving") || lh.includes("license") ||
      (lh.includes("pan") && !lh.includes("vat") && !lh.includes("company")));
  }
  function isCorporateDocCol(h: string): boolean {
    const lh = h.trim().toLowerCase();
    return (lh.includes("registration") || lh.includes("company") ||
      (lh.includes("pan") && lh.includes("vat")) ||
      lh.includes("board") || lh.includes("authorization") || lh.includes("signatory"));
  }
  function isCommonDocCol(h: string): boolean {
    const lh = h.trim().toLowerCase();
    return lh.includes("payment") || lh.includes("insurance");
  }
  function isRelevantForBuyer(h: string, buyerType: string): boolean {
    const isIndividual = buyerType.trim().toLowerCase() === "individual";
    if (isCommonDocCol(h)) return true;
    if (isIndividualDocCol(h) && !isCorporateDocCol(h)) return isIndividual;
    if (isCorporateDocCol(h) && !isIndividualDocCol(h)) return !isIndividual;
    return true;
  }

  const pendingDocuments = [];
  for (let r = 1; r < docRows.length; r++) {
    const row = docRows[r];
    if (!row || row.length === 0) continue;
    const saleId = (saleIdIdx !== -1 ? row[saleIdIdx] : row[0])?.trim();
    if (!saleId) continue;
    const handoverReadyVal = (handoverIdx !== -1 ? row[handoverIdx] : "")?.trim().toUpperCase();
    const isHandoverReady = handoverReadyVal === "TRUE" || handoverReadyVal === "YES" || handoverReadyVal === "1";
    if (isHandoverReady) continue;

    const buyerType = (buyerTypeIdx !== -1 ? row[buyerTypeIdx] : "")?.trim() || "Individual";
    const lookedUp = soldLookup.get(saleId);
    const customerName = (customerNameIdx !== -1 ? row[customerNameIdx]?.trim() : "") || lookedUp?.customerName || "—";
    const bikeName = (bikeNameIdx !== -1 ? row[bikeNameIdx]?.trim() : "") || lookedUp?.bikeName || "—";

    const checkboxes: Record<string, boolean> = {};
    for (const col of checkboxCols) {
      if (!isRelevantForBuyer(col.name, buyerType)) continue;
      const cellVal = (row[col.index] ?? "").toString().trim().toUpperCase();
      if (cellVal === "NOT REQUIRED") continue;
      checkboxes[col.name] = cellVal === "TRUE" || cellVal === "YES" || cellVal === "1";
    }

    pendingDocuments.push({
      saleId, buyerType, customerName, bikeName, checkboxes,
      handoverReady: false, rowIndex: r + 1,
    });
  }

  const result = {
    success: true,
    documents: pendingDocuments,
    allDocHeaders: checkboxCols.map((c) => c.name),
  };
  docsCache.set(cacheKey, { data: result, exp: Date.now() + 20_000 });

  timer.log("get-pending-documents");
  const timingHeader = timer.getHeader();
  return jsonResponse(result, 200, { "Server-Timing": timingHeader, "Access-Control-Expose-Headers": "Server-Timing" });
});
