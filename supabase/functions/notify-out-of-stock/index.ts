// =============================================================================
// notify-out-of-stock/index.ts
// Supabase Edge Function — Send an out-of-stock alert email via Resend
//
// Flow:
//   1. Receive POST with JSON body: { bike_name, bike_id, alert_type?, current_quantity? }
//   2. Read RESEND_API_KEY and OWNER_EMAIL from environment
//   3. POST to Resend API with a formatted HTML email
//   4. Return JSON success/error response
//
// Environment variables (set via `supabase secrets set`):
//   RESEND_API_KEY  — Resend API key (re_...)
//   OWNER_EMAIL     — Recipient email address for alerts
// =============================================================================

// --- CORS headers (same pattern as sync-to-sheets) ---------------------------
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

// =============================================================================
// MAIN HANDLER
// =============================================================================
Deno.serve(async (req: Request) => {

  // --- Handle CORS preflight -------------------------------------------------
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  // --- Only allow POST -------------------------------------------------------
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed. Use POST." }, 405);
  }

  // ============================================================
  // STEP 1: Parse the request body
  // ============================================================
  let bike_name: string;
  let bike_id: string;
  let alert_type: string = "out_of_stock";
  let current_quantity: number = 0;

  try {
    const body = await req.json();
    bike_name = body?.bike_name;
    bike_id   = body?.bike_id;
    if (body?.alert_type) alert_type = body.alert_type;
    if (body?.current_quantity !== undefined) current_quantity = Number(body.current_quantity);
  } catch {
    return jsonResponse({ error: "Invalid JSON body." }, 400);
  }

  if (!bike_name || !bike_id) {
    return jsonResponse({
      error: "Missing required fields.",
      required: ["bike_name", "bike_id"],
    }, 400);
  }

  // ============================================================
  // STEP 2: Read environment variables
  // ============================================================
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const ownerEmail   = Deno.env.get("OWNER_EMAIL");

  if (!resendApiKey || !ownerEmail) {
    return jsonResponse({
      error: "Missing environment variables.",
      required: ["RESEND_API_KEY", "OWNER_EMAIL"],
    }, 500);
  }

  // ============================================================
  // STEP 3: Build the email HTML body
  // ============================================================
  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day:     "numeric",
    month:   "long",
    year:    "numeric",
  });

  const isLowStock = alert_type === "low_stock";
  const themeColor = isLowStock ? "#d97706" : "#cc0000"; // amber-600 vs red-600
  const lightBgColor = isLowStock ? "#fffbeb" : "#fef2f2"; // amber-50 vs red-50
  const borderColor = isLowStock ? "#fcd34d" : "#fecaca"; // amber-300 vs red-200
  const headerText = isLowStock ? "⚠️ Low Stock Warning" : "⚠️ Out of Stock Alert";
  const subjectText = isLowStock ? `Low Stock Warning: ${bike_name}` : `Out of Stock Alert: ${bike_name}`;
  
  const bodyText = isLowStock 
    ? `The following bike is running low on stock:`
    : `The following bike has just <strong>sold out</strong> and its stock level has reached <strong>zero</strong>:`;

  const qtyText = isLowStock 
    ? `${current_quantity} unit${current_quantity !== 1 ? 's' : ''}`
    : `0 units`;

  const actionText = isLowStock
    ? `Consider restocking soon before it runs out completely to avoid losing potential sales.`
    : `Please consider placing a restock order at your earliest convenience to avoid losing potential sales.`;

  const htmlBody = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${headerText}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0"
          style="background:#ffffff;border-radius:12px;overflow:hidden;
                 box-shadow:0 4px 24px rgba(0,0,0,0.08);max-width:560px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:${themeColor};padding:28px 32px;text-align:center;">
              <p style="margin:0;color:#ffffff;font-size:12px;font-weight:700;
                         letter-spacing:2px;text-transform:uppercase;opacity:0.8;">
                TVS Raj Automobiles
              </p>
              <h1 style="margin:10px 0 0;color:#ffffff;font-size:26px;font-weight:800;
                          letter-spacing:-0.5px;">
                ${headerText}
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 20px;color:#374151;font-size:15px;line-height:1.6;">
                Hi there,
              </p>
              <p style="margin:0 0 20px;color:#374151;font-size:15px;line-height:1.6;">
                ${bodyText}
              </p>

              <!-- Bike highlight box -->
              <div style="background:${lightBgColor};border:1px solid ${borderColor};border-left:4px solid ${themeColor};
                           border-radius:8px;padding:20px 24px;margin:0 0 24px;">
                <p style="margin:0 0 4px;color:${themeColor};font-size:12px;font-weight:700;
                            text-transform:uppercase;letter-spacing:1px;">Bike</p>
                <p style="margin:0;color:#111827;font-size:22px;font-weight:800;">
                  ${bike_name}
                </p>
                <p style="margin:8px 0 0;color:#6b7280;font-size:13px;">
                  Current quantity: <strong style="color:${themeColor};">${qtyText}</strong>
                </p>
              </div>

              <p style="margin:0 0 20px;color:#374151;font-size:15px;line-height:1.6;">
                ${actionText}
              </p>

              <!-- Action tip -->
              <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;
                           padding:16px 20px;margin:0 0 28px;">
                <p style="margin:0;color:#0369a1;font-size:14px;line-height:1.5;">
                  💡 <strong>Tip:</strong> Log a new stock arrival from the Employee Dashboard
                  once a restock has been confirmed.
                </p>
              </div>

              <p style="margin:0;color:#9ca3af;font-size:13px;">
                This alert was triggered automatically on <strong>${today}</strong>.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:20px 32px;
                        text-align:center;">
              <p style="margin:0;color:#9ca3af;font-size:12px;">
                TVS Raj Automobiles — Automated Stock Notification
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  // ============================================================
  // STEP 4: Send the email via Resend
  // ============================================================
  const emailPayload = {
    from:    "TVS Raj Automobiles <onboarding@resend.dev>",
    to:      [ownerEmail],
    subject: subjectText,
    html:    htmlBody,
  };

  const resendRes = await fetch("https://api.resend.com/emails", {
    method:  "POST",
    headers: {
      Authorization:  `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(emailPayload),
  });

  if (!resendRes.ok) {
    const errText = await resendRes.text();
    return jsonResponse({
      error:  "Failed to send email via Resend.",
      detail: errText,
    }, 500);
  }

  const resendData = await resendRes.json();

  // ============================================================
  // STEP 5: Return success
  // ============================================================
  return jsonResponse({
    success:  true,
    message:  `${isLowStock ? 'Low-stock' : 'Out-of-stock'} alert email sent for "${bike_name}".`,
    email_id: resendData.id ?? "unknown",
    to:       ownerEmail,
  });
});
