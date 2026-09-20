// =============================================================================
// create-employee/index.ts
// Supabase Edge Function — Create new employee auth account & assign 'employee' role
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

  // Create admin client with service_role privileges
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
  let body: { email?: string; password?: string; fullName?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON payload in request body." }, 400);
  }

  const email = body?.email?.trim().toLowerCase();
  const password = body?.password;
  const fullName = body?.fullName?.trim();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonResponse({ error: "Please provide a valid email address." }, 400);
  }

  if (!password || password.length < 6) {
    return jsonResponse({ error: "Password must be at least 6 characters long." }, 400);
  }

  if (!fullName) {
    return jsonResponse({ error: "Full name is required." }, 400);
  }

  // ── 3. Create Auth User via Service Role ──
  const { data: newUserData, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (createError) {
    return jsonResponse({ error: createError.message || "Failed to create user account." }, 400);
  }

  const newUser = newUserData?.user;
  if (!newUser) {
    return jsonResponse({ error: "User creation failed unexpectedly." }, 500);
  }

  // ── 4. Assign 'employee' Role in user_roles ──
  const { error: roleInsertError } = await supabaseAdmin
    .from("user_roles")
    .insert([{ id: newUser.id, role: "employee" }]);

  if (roleInsertError) {
    console.error("[create-employee] Role insert failed, rolling back auth user:", roleInsertError);
    // Rollback: delete the newly created auth user so we don't leave orphaned users
    try {
      await supabaseAdmin.auth.admin.deleteUser(newUser.id);
    } catch (rollbackErr) {
      console.error("[create-employee] Rollback deleteUser failed:", rollbackErr);
    }

    return jsonResponse({
      error: `Failed to set employee role: ${roleInsertError.message}. User creation was rolled back.`,
    }, 500);
  }

  return jsonResponse({
    success: true,
    employee: {
      id: newUser.id,
      email: newUser.email,
      fullName: fullName,
    },
    message: "Employee account created successfully.",
  });
});
