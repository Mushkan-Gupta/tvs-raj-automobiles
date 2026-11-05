import { createClient } from "npm:@supabase/supabase-js@2";

export type Role = "admin" | "employee";

export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
  "Access-Control-Expose-Headers": "Server-Timing",
};

function deny(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

export interface AuthResult {
  userId: string;
  email: string | undefined;
  role: Role;
}

// In-memory cache for user role lookups (30-second TTL)
const roleCache = new Map<string, { role: Role; exp: number }>();

export async function requireRole(
  req: Request,
  allowed: Role[],
): Promise<AuthResult | Response> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return deny("Server configuration error.", 500);
  }
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return deny("Unauthorized: missing Authorization header.", 401);
  }
  const token = authHeader.replace("Bearer ", "").trim();
  const supabaseForAuth = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await supabaseForAuth.auth.getUser();
  if (error || !data?.user) {
    return deny("Unauthorized: invalid or expired session.", 401);
  }

  const userId = data.user.id;
  const now = Date.now();
  const cached = roleCache.get(userId);

  let role: Role | undefined;
  if (cached && cached.exp > now) {
    role = cached.role;
  } else {
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: roleRow, error: roleError } = await supabaseAdmin
      .from("user_roles").select("role").eq("id", userId).single();
    if (roleError || !roleRow?.role) {
      return deny("Forbidden: you do not have permission for this action.", 403);
    }
    role = roleRow.role as Role;
    roleCache.set(userId, { role, exp: now + 30_000 });
  }

  if (!role || !allowed.includes(role)) {
    return deny("Forbidden: you do not have permission for this action.", 403);
  }
  return { userId: data.user.id, email: data.user.email, role };
}

export function sheetSafe(value: unknown): string {
  const s = String(value ?? "").trim();
  return /^[=+\-@]/.test(s) ? `'${s}` : s;
}

export async function validatePublicInquiry(inq: {
  name?: string; phone?: string; interested_model?: string; message?: string;
}): Promise<string | null> {
  const name = (inq.name ?? "").trim();
  const phone = (inq.phone ?? "").trim();
  const model = (inq.interested_model ?? "").trim();
  const message = (inq.message ?? "").trim();
  if (name.length < 2 || name.length > 100) return "Invalid name.";
  if (!/^[0-9+\-\s()]{7,20}$/.test(phone)) return "Invalid phone number.";
  if (model.length < 1 || model.length > 100) return "Invalid model.";
  if (message.length > 1000) return "Message is too long.";
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return "Server configuration error.";
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data, error } = await admin.from("inquiries").select("id")
    .eq("name", name).eq("phone", phone).gte("created_at", since).limit(1);
  if (error || !data || data.length === 0) return "No matching inquiry found.";
  return null;
}
