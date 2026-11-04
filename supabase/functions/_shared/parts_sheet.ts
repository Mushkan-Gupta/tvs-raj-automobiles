// =============================================================================
// _shared/parts_sheet.ts — Google Sheets sync for "Parts" catalogue tab
//
// Keeps the "Parts" tab in the Google Sheet in sync with Supabase (one-way copy).
// Admin-only cost price is read securely via the service role key.
// All functions return { ok: boolean, error?: string } and never throw.
// =============================================================================

import { createClient } from "npm:@supabase/supabase-js@2";
import { getGoogleAccessToken, fetchSheetValues, ensureHeaders, colToLetter } from "./google.ts";

export const PARTS_TAB_NAME = "Parts";

export const PARTS_HEADERS = [
  "Part ID",
  "Name",
  "Category",
  "Price",
  "Cost Price",
  "Stock",
  "Low Stock Threshold",
  "Pinned",
  "Fits All Bikes",
  "Active",
  "Last Updated",
];

export interface PartWithCost {
  id: string;
  name: string;
  category?: string | null;
  price: number;
  cost_price?: number;
  stock_qty: number;
  low_stock_threshold?: number;
  is_pinned?: boolean;
  fits_all?: boolean;
  active?: boolean;
  updated_at?: string;
}

export function formatNepalTime(date = new Date()): string {
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kathmandu",
  });
}

function getSupabaseAdmin() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function getGoogleContext(): Promise<{ accessToken: string; sheetId: string }> {
  const clientEmail = Deno.env.get("GOOGLE_CLIENT_EMAIL");
  const privateKeyPem = Deno.env.get("GOOGLE_PRIVATE_KEY")?.replace(/\\n/g, "\n");
  const sheetId = Deno.env.get("GOOGLE_SHEET_ID");

  if (!clientEmail || !privateKeyPem || !sheetId) {
    throw new Error("Missing Google Sheets configuration in environment variables.");
  }

  const accessToken = await getGoogleAccessToken(clientEmail, privateKeyPem);
  return { accessToken, sheetId };
}

/**
 * Ensures the "Parts" sheet tab exists in the spreadsheet, creating it if missing.
 */
export async function ensureSheetTabExists(
  accessToken: string,
  sheetId: string,
  tabTitle = PARTS_TAB_NAME
): Promise<void> {
  const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties.title`;
  const res = await fetch(metaUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    return;
  }

  const meta = await res.json();
  const sheets = meta.sheets ?? [];
  const exists = sheets.some(
    // deno-lint-ignore no-explicit-any
    (s: any) => s.properties?.title?.trim().toLowerCase() === tabTitle.trim().toLowerCase()
  );

  if (exists) return;

  const batchUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`;
  await fetch(batchUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      requests: [
        {
          addSheet: {
            properties: {
              title: tabTitle,
            },
          },
        },
      ],
    }),
  });
}

/**
 * Maps a part record to a row matching headers by name.
 */
export function buildRowForPart(
  headers: string[],
  part: PartWithCost,
  statusOverride?: "Deleted"
): (string | number)[] {
  const formattedDate = formatNepalTime();

  const valueMap: Record<string, string | number> = {
    "part id": part.id,
    "name": part.name,
    "category": part.category || "",
    "price": Number(part.price ?? 0),
    "cost price": Number(part.cost_price ?? 0),
    "stock": Number(part.stock_qty ?? 0),
    "low stock threshold": Number(part.low_stock_threshold ?? 3),
    "pinned": part.is_pinned ? "Yes" : "No",
    "fits all bikes": part.fits_all ? "Yes" : "No",
    "active": statusOverride === "Deleted" ? "Deleted" : (part.active ? "Yes" : "No"),
    "last updated": formattedDate,
  };

  return headers.map((header) => {
    const key = header.trim().toLowerCase();
    if (valueMap[key] !== undefined) return valueMap[key];
    if (key.includes("part") && key.includes("id")) return part.id;
    if (key === "name" || (key.includes("part") && key.includes("name"))) return part.name;
    if (key.includes("category")) return part.category || "";
    if (key.includes("cost")) return Number(part.cost_price ?? 0);
    if (key.includes("price")) return Number(part.price ?? 0);
    if (key.includes("threshold")) return Number(part.low_stock_threshold ?? 3);
    if (key.includes("stock")) return Number(part.stock_qty ?? 0);
    if (key.includes("pin")) return part.is_pinned ? "Yes" : "No";
    if (key.includes("fit")) return part.fits_all ? "Yes" : "No";
    if (key.includes("active")) return statusOverride === "Deleted" ? "Deleted" : (part.active ? "Yes" : "No");
    if (key.includes("update") || key.includes("date")) return formattedDate;
    return "";
  });
}

/**
 * Reads the part (+ cost) from the database, finds its row by Part ID,
 * updates that row, or appends if not found. Sets Last Updated.
 */
export async function upsertPartRow(partId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    if (!partId) return { ok: false, error: "partId is required." };

    const sb = getSupabaseAdmin();
    const { data: part, error: pErr } = await sb
      .from("parts")
      .select("*")
      .eq("id", partId)
      .single();

    if (pErr || !part) {
      return { ok: false, error: `Part ${partId} not found in database: ${pErr?.message}` };
    }

    const { data: costRow } = await sb
      .from("part_costs")
      .select("cost_price")
      .eq("part_id", partId)
      .maybeSingle();

    const partWithCost: PartWithCost = {
      ...part,
      cost_price: costRow?.cost_price ?? 0,
    };

    const { accessToken, sheetId } = await getGoogleContext();
    await ensureSheetTabExists(accessToken, sheetId, PARTS_TAB_NAME);
    const headers = await ensureHeaders(accessToken, sheetId, PARTS_TAB_NAME, PARTS_HEADERS);

    const rows = await fetchSheetValues(accessToken, sheetId, `${PARTS_TAB_NAME}!A:Z`);
    const partIdColIdx = headers.findIndex((h) => /part\s*id/i.test(h));
    const targetColIdx = partIdColIdx !== -1 ? partIdColIdx : 0;

    let targetRowIndex = -1;
    for (let r = 1; r < rows.length; r++) {
      const cellId = rows[r]?.[targetColIdx]?.toString().trim();
      if (cellId && cellId.toLowerCase() === partId.trim().toLowerCase()) {
        targetRowIndex = r + 1; // 1-based index in Google Sheets
        break;
      }
    }

    const rowValues = buildRowForPart(headers, partWithCost);
    const lastColLetter = colToLetter(headers.length);

    if (targetRowIndex !== -1) {
      // Update existing row
      const updateRange = `${PARTS_TAB_NAME}!A${targetRowIndex}:${lastColLetter}${targetRowIndex}`;
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
          values: [rowValues],
        }),
      });

      if (!updateRes.ok) {
        return { ok: false, error: `Failed to update part row: ${await updateRes.text()}` };
      }
    } else {
      // Append new row
      const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(PARTS_TAB_NAME)}!A1:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
      const appendRes = await fetch(appendUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ values: [rowValues] }),
      });

      if (!appendRes.ok) {
        return { ok: false, error: `Failed to append part row: ${await appendRes.text()}` };
      }
    }

    return { ok: true };
  } catch (err) {
    console.error("[parts_sheet:upsertPartRow]", err);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Sets Active = "Deleted" for that row (appends a row if missing).
 */
export async function markPartDeleted(partId: string, name?: string): Promise<{ ok: boolean; error?: string }> {
  try {
    if (!partId) return { ok: false, error: "partId is required." };

    const { accessToken, sheetId } = await getGoogleContext();
    await ensureSheetTabExists(accessToken, sheetId, PARTS_TAB_NAME);
    const headers = await ensureHeaders(accessToken, sheetId, PARTS_TAB_NAME, PARTS_HEADERS);

    const rows = await fetchSheetValues(accessToken, sheetId, `${PARTS_TAB_NAME}!A:Z`);
    const partIdColIdx = headers.findIndex((h) => /part\s*id/i.test(h));
    const targetColIdx = partIdColIdx !== -1 ? partIdColIdx : 0;

    let targetRowIndex = -1;
    for (let r = 1; r < rows.length; r++) {
      const cellId = rows[r]?.[targetColIdx]?.toString().trim();
      if (cellId && cellId.toLowerCase() === partId.trim().toLowerCase()) {
        targetRowIndex = r + 1;
        break;
      }
    }

    const lastColLetter = colToLetter(headers.length);

    if (targetRowIndex !== -1) {
      // Update existing row: set Active = "Deleted", Last Updated = now
      const existingRow = [...(rows[targetRowIndex - 1] ?? [])];
      while (existingRow.length < headers.length) existingRow.push("");

      const activeIdx = headers.findIndex((h) => /^active$/i.test(h));
      const lastUpdatedIdx = headers.findIndex((h) => /last\s*updated/i.test(h));

      if (activeIdx !== -1) existingRow[activeIdx] = "Deleted";
      if (lastUpdatedIdx !== -1) existingRow[lastUpdatedIdx] = formatNepalTime();

      const updateRange = `${PARTS_TAB_NAME}!A${targetRowIndex}:${lastColLetter}${targetRowIndex}`;
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
          values: [existingRow],
        }),
      });

      if (!updateRes.ok) {
        return { ok: false, error: `Failed to mark part deleted: ${await updateRes.text()}` };
      }
    } else {
      // Append deleted placeholder row
      const dummyPart: PartWithCost = {
        id: partId,
        name: name || "Deleted Part",
        price: 0,
        cost_price: 0,
        stock_qty: 0,
        active: false,
      };
      const rowValues = buildRowForPart(headers, dummyPart, "Deleted");

      const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(PARTS_TAB_NAME)}!A1:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
      const appendRes = await fetch(appendUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ values: [rowValues] }),
      });

      if (!appendRes.ok) {
        return { ok: false, error: `Failed to append deleted part row: ${await appendRes.text()}` };
      }
    }

    return { ok: true };
  } catch (err) {
    console.error("[parts_sheet:markPartDeleted]", err);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * For the given parts, reads current stock from the database and updates
 * only the Stock and Last Updated cells (using a single batch call).
 */
export async function updatePartStockCells(partIds: string[]): Promise<{ ok: boolean; error?: string }> {
  try {
    if (!partIds || partIds.length === 0) return { ok: true };

    const sb = getSupabaseAdmin();
    const { data: parts, error: pErr } = await sb
      .from("parts")
      .select("id, stock_qty")
      .in("id", partIds);

    if (pErr || !parts) {
      return { ok: false, error: `Failed to load stock for parts: ${pErr?.message}` };
    }

    const stockMap = new Map<string, number>();
    for (const p of parts) {
      stockMap.set(p.id, p.stock_qty);
    }

    const { accessToken, sheetId } = await getGoogleContext();
    await ensureSheetTabExists(accessToken, sheetId, PARTS_TAB_NAME);
    const headers = await ensureHeaders(accessToken, sheetId, PARTS_TAB_NAME, PARTS_HEADERS);

    const rows = await fetchSheetValues(accessToken, sheetId, `${PARTS_TAB_NAME}!A:Z`);
    const partIdColIdx = headers.findIndex((h) => /part\s*id/i.test(h));
    const stockColIdx = headers.findIndex((h) => /^stock$/i.test(h));
    const lastUpdatedColIdx = headers.findIndex((h) => /last\s*updated/i.test(h));

    if (stockColIdx === -1) {
      return { ok: false, error: 'Could not find "Stock" header in Parts tab.' };
    }

    const stockColLetter = colToLetter(stockColIdx + 1);
    const lastUpdatedColLetter = lastUpdatedColIdx !== -1 ? colToLetter(lastUpdatedColIdx + 1) : null;
    const formattedDate = formatNepalTime();

    // deno-lint-ignore no-explicit-any
    const batchData: any[] = [];

    for (let r = 1; r < rows.length; r++) {
      const cellId = rows[r]?.[partIdColIdx !== -1 ? partIdColIdx : 0]?.toString().trim();
      if (!cellId) continue;

      if (stockMap.has(cellId)) {
        const newStock = stockMap.get(cellId)!;
        const rowNum = r + 1; // 1-based row index

        batchData.push({
          range: `${PARTS_TAB_NAME}!${stockColLetter}${rowNum}:${stockColLetter}${rowNum}`,
          values: [[newStock]],
        });

        if (lastUpdatedColLetter) {
          batchData.push({
            range: `${PARTS_TAB_NAME}!${lastUpdatedColLetter}${rowNum}:${lastUpdatedColLetter}${rowNum}`,
            values: [[formattedDate]],
          });
        }
      }
    }

    if (batchData.length > 0) {
      const batchUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values:batchUpdate`;
      const batchRes = await fetch(batchUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          valueInputOption: "USER_ENTERED",
          data: batchData,
        }),
      });

      if (!batchRes.ok) {
        return { ok: false, error: `Failed to batch update stock cells: ${await batchRes.text()}` };
      }
    }

    return { ok: true };
  } catch (err) {
    console.error("[parts_sheet:updatePartStockCells]", err);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Reads all parts + costs from database, clears the data rows (keeps row 1 headers),
 * and writes all rows in one call. Pinned first, then name.
 */
export async function syncAllParts(): Promise<{ ok: boolean; error?: string }> {
  try {
    const sb = getSupabaseAdmin();

    const { data: allParts, error: pErr } = await sb
      .from("parts")
      .select("*")
      .order("is_pinned", { ascending: false })
      .order("name", { ascending: true });

    if (pErr || !allParts) {
      return { ok: false, error: `Failed to load parts catalogue: ${pErr?.message}` };
    }

    const { data: allCosts } = await sb
      .from("part_costs")
      .select("part_id, cost_price");

    const costMap = new Map<string, number>();
    for (const c of allCosts ?? []) {
      costMap.set(c.part_id, Number(c.cost_price ?? 0));
    }

    const { accessToken, sheetId } = await getGoogleContext();
    await ensureSheetTabExists(accessToken, sheetId, PARTS_TAB_NAME);
    const headers = await ensureHeaders(accessToken, sheetId, PARTS_TAB_NAME, PARTS_HEADERS);

    // Clear existing data rows (keep header row 1)
    const clearUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(PARTS_TAB_NAME)}!A2:Z:clear`;
    await fetch(clearUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (allParts.length > 0) {
      const rows = allParts.map((p) => {
        const partWithCost: PartWithCost = {
          ...p,
          cost_price: costMap.get(p.id) ?? 0,
        };
        return buildRowForPart(headers, partWithCost);
      });

      const lastColLetter = colToLetter(headers.length);
      const writeRange = `${PARTS_TAB_NAME}!A2:${lastColLetter}${rows.length + 1}`;
      const writeUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(writeRange)}?valueInputOption=USER_ENTERED`;

      const writeRes = await fetch(writeUrl, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          range: writeRange,
          majorDimension: "ROWS",
          values: rows,
        }),
      });

      if (!writeRes.ok) {
        return { ok: false, error: `Failed to write parts rows: ${await writeRes.text()}` };
      }
    }

    return { ok: true };
  } catch (err) {
    console.error("[parts_sheet:syncAllParts]", err);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
