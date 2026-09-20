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
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({
      error: "Server configuration error: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.",
    }, 500);
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // ── 1. Verify Caller is Authenticated Admin ──
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return jsonResponse({ error: "Unauthorized: Missing or invalid Authorization header." }, 401);
  }

  const token = authHeader.replace("Bearer ", "").trim();
  const { data: callerData, error: callerError } = await supabaseAdmin.auth.getUser(token);

  if (callerError || !callerData?.user) {
    return jsonResponse({ error: "Unauthorized: Invalid or expired session token." }, 401);
  }

  const callerUser = callerData.user;
  const { data: roleData, error: roleError } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("id", callerUser.id)
    .single();

  if (roleError || roleData?.role !== "admin") {
    return jsonResponse({ error: "Forbidden: Admin privileges required." }, 403);
  }

  // ── 2. Parse & Validate Payload ──
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

  // ── 3. Prevent Self-Action ──
  if (userId === callerUser.id) {
    return jsonResponse({
      error: "Action denied: You cannot deactivate or delete your own admin account.",
    }, 400);
  }

  // ── 4. Execute Action ──
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
