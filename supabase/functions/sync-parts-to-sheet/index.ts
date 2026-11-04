// =============================================================================
// sync-parts-to-sheet/index.ts
// Supabase Edge Function — Synchronize Parts Catalogue to Google Sheet "Parts" tab
//
// Auth: admin ONLY
// Method: POST
//
// Body (JSON):
//   action:    "upsert" | "delete" | "sync_all"
//   part_id?:  string (uuid)
//   part_name?: string
//
// Response:
//   { ok: true }
//   OR
//   { ok: false, error: string }
// =============================================================================

import { CORS_HEADERS, requireRole } from "../_shared/auth.ts";
import { upsertPartRow, markPartDeleted, syncAllParts } from "../_shared/parts_sheet.ts";

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

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed. Use POST." }, 405);
  }

  // ── Auth: admin ONLY ───────────────────────────────────────────────────────
  const auth = await requireRole(req, ["admin"]);
  if (auth instanceof Response) return auth;

  // ── Parse body ─────────────────────────────────────────────────────────────
  let body: {
    action?: string;
    part_id?: string;
    part_name?: string;
  };

  try {
    body = await req.json();
  } catch {
    return jsonResponse({ ok: false, error: "Invalid JSON in request body." }, 400);
  }

  const action = body.action;
  const partId = body.part_id;
  const partName = body.part_name;

  if (!action || !["upsert", "delete", "sync_all"].includes(action)) {
    return jsonResponse(
      { ok: false, error: "Invalid or missing action. Allowed: 'upsert' | 'delete' | 'sync_all'." },
      400
    );
  }

  let result: { ok: boolean; error?: string };

  switch (action) {
    case "upsert":
      if (!partId) {
        return jsonResponse({ ok: false, error: "part_id is required for action 'upsert'." }, 400);
      }
      result = await upsertPartRow(partId);
      break;

    case "delete":
      if (!partId) {
        return jsonResponse({ ok: false, error: "part_id is required for action 'delete'." }, 400);
      }
      result = await markPartDeleted(partId, partName);
      break;

    case "sync_all":
      result = await syncAllParts();
      break;

    default:
      return jsonResponse({ ok: false, error: "Unknown action." }, 400);
  }

  if (!result.ok) {
    return jsonResponse({ ok: false, error: result.error || "Sheet sync failed." }, 500);
  }

  return jsonResponse({ ok: true });
});
