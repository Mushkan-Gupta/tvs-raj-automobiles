// =============================================================================
// list-employees/index.ts
// Supabase Edge Function — List all staff accounts with role 'employee'
// Protected: Admin-only
// =============================================================================

import { createClient } from "npm:@supabase/supabase-js@2";

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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
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
    console.error("[list-employees] Token validation failed:", callerError?.message);
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

  // Diagnostic log — visible in: supabase functions logs list-employees
  console.error(
    `[list-employees] Admin check — user_id: ${callerUser.id} | fetched role: ${roleData?.role ?? "NULL"} | roleError: ${roleError?.message ?? "none"}`
  );

  if (roleError || roleData?.role !== "admin") {
    return jsonResponse({ error: "Forbidden: Admin privileges required." }, 403);
  }

  // ── 4. Query user_roles for all IDs with role 'employee' ─────────────────
  const { data: employeeRoles, error: rolesError } = await supabaseAdmin
    .from("user_roles")
    .select("id")
    .eq("role", "employee");

  if (rolesError) {
    return jsonResponse({ error: `Failed to query employee roles: ${rolesError.message}` }, 500);
  }

  if (!employeeRoles || employeeRoles.length === 0) {
    return jsonResponse({ success: true, employees: [] });
  }

  const employeeIds = new Set(employeeRoles.map((r) => r.id));

  // ── 5. Fetch Auth Users via Service Role ──────────────────────────────────
  const { data: usersData, error: listError } = await supabaseAdmin.auth.admin.listUsers();

  if (listError) {
    return jsonResponse({ error: `Failed to list auth users: ${listError.message}` }, 500);
  }

  const allUsers = usersData?.users || [];
  const now = Date.now();

  const employees = allUsers
    .filter((u) => employeeIds.has(u.id))
    .map((u) => {
      const bannedUntil = u.banned_until ? new Date(u.banned_until) : null;
      const isBanned = bannedUntil !== null && bannedUntil.getTime() > now;

      return {
        id: u.id,
        email: u.email,
        full_name: u.user_metadata?.full_name || u.user_metadata?.name || "—",
        created_at: u.created_at,
        banned_until: u.banned_until || null,
        isActive: !isBanned,
      };
    })
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return jsonResponse({
    success: true,
    employees,
  });
});
