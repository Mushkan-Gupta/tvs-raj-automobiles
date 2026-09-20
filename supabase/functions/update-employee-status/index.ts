// =============================================================================
// update-employee-status/index.ts
// Supabase Edge Function — Deactivate, Activate, or Delete an employee account
// Protected: Admin-only
// =============================================================================

import { createClient } from "npm:@supabase/supabase-js@2";

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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed. Use POST." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return jsonResponse({
      error: "Server configuration error: missing SUPABASE_URL, SUPABASE_ANON_KEY, or SUPABASE_SERVICE_ROLE_KEY.",
    }, 500);
  }

  // ── 1. Extract Bearer token ──────────────────────────────────────────────
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return jsonResponse({ error: "Unauthorized: Missing or invalid Authorization header." }, 401);
  }
  const token = authHeader.replace("Bearer ", "").trim();

  // ── 2. Validate JWT using anon-key client + caller's token ───────────────
  // IMPORTANT: We must use createClient with the ANON key and pass the user's
  // token via the Authorization header so Supabase correctly identifies the
  // calling user. Using the service-role client for getUser() does NOT work —
  // it ignores the token and resolves to null/service account instead.
  const supabaseForAuth = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: callerData, error: callerError } = await supabaseForAuth.auth.getUser();

  if (callerError || !callerData?.user) {
    console.error("[update-employee-status] Token validation failed:", callerError?.message);
    return jsonResponse({ error: "Unauthorized: Invalid or expired session token." }, 401);
  }

  const callerUser = callerData.user;

  // ── 3. Role check using service-role client (bypasses RLS) ───────────────
  // We switch to the service-role client here so the user_roles lookup is
  // never blocked by Row Level Security policies on that table.
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: roleData, error: roleError } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("id", callerUser.id)
    .single();

  // Diagnostic log — visible in: supabase functions logs update-employee-status
  console.error(
    `[update-employee-status] Admin check — user_id: ${callerUser.id} | fetched role: ${roleData?.role ?? "NULL"} | roleError: ${roleError?.message ?? "none"}`
  );

  if (roleError || roleData?.role !== "admin") {
    return jsonResponse({ error: "Forbidden: Admin privileges required." }, 403);
  }

  // ── 4. Parse & Validate Payload ──────────────────────────────────────────
  let body: { userId?: string; action?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON in request body." }, 400);
  }

  const userId = body?.userId?.trim();
  const action = body?.action?.trim().toLowerCase();

  if (!userId) {
    return jsonResponse({ error: "Missing required parameter: userId." }, 400);
  }

  if (!action || !["deactivate", "activate", "delete"].includes(action)) {
    return jsonResponse({
      error: "Invalid action. Must be one of: 'deactivate', 'activate', 'delete'.",
    }, 400);
  }

  // ── 5. Prevent Self-Action ────────────────────────────────────────────────
  if (userId === callerUser.id) {
    return jsonResponse({
      error: "Action denied: You cannot deactivate or delete your own admin account.",
    }, 400);
  }

  // ── 6. Execute Action ─────────────────────────────────────────────────────
  try {
    if (action === "deactivate") {
      // 876,000 hours = 100 years
      const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        ban_duration: "876000h",
      });

      if (banError) throw banError;

      return jsonResponse({
        success: true,
        message: "Employee account deactivated successfully.",
        userId,
        action: "deactivate",
      });
    }

    if (action === "activate") {
      const { error: unbanError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        ban_duration: "none",
      });

      if (unbanError) throw unbanError;

      return jsonResponse({
        success: true,
        message: "Employee account activated successfully.",
        userId,
        action: "activate",
      });
    }

    if (action === "delete") {
      // 1. Delete from Supabase Auth
      const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (deleteAuthError) throw deleteAuthError;

      // 2. Delete role record from user_roles
      const { error: deleteRoleError } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("id", userId);

      if (deleteRoleError) {
        console.warn("[update-employee-status] user_roles delete warning:", deleteRoleError);
      }

      return jsonResponse({
        success: true,
        message: "Employee account deleted permanently.",
        userId,
        action: "delete",
      });
    }
  } catch (err) {
    console.error(`[update-employee-status] Action '${action}' failed:`, err);
    return jsonResponse({
      error: err instanceof Error ? err.message : `Failed to perform action '${action}'.`,
    }, 500);
  }

  return jsonResponse({ error: "Unhandled action." }, 400);
});
