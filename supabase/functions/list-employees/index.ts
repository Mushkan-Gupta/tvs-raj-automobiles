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

  // ── 2. Query user_roles for all IDs with role 'employee' ──
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

  // ── 3. Fetch Auth Users via Service Role ──
  const { data: usersData, error: listError } = await supabaseAdmin.auth.admin.listUsers();

  if (listError) {
    return jsonResponse({ error: `Failed to list auth users: ${listError.message}` }, 500);
  }

  const allUsers = usersData?.users || [];
  const now = Date.now();

  const employees = allUsers
    .filter((u) => employeeIds.has(u.id))
    .map((u) => {
      // Check banned_until to determine active vs deactivated status
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
