// =============================================================================
// _shared/google.ts — Shared Google OAuth2 helper for edge functions
//
// Provides getGoogleAccessToken() and importPrivateKey() so each function
// does not need to copy-paste the implementation.
// =============================================================================

/**
 * Signs a service-account JWT and exchanges it for a short-lived
 * Google OAuth2 Bearer token with Sheets scope.
 */
export async function getGoogleAccessToken(
  clientEmail: string,
  privateKeyPem: string
): Promise<string> {
  const privateKey = await importPrivateKey(privateKeyPem);

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: clientEmail,
    sub: clientEmail,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const header = { alg: "RS256", typ: "JWT" };
  const encode = (obj: unknown) =>
    btoa(JSON.stringify(obj))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

  const unsignedJwt = `${encode(header)}.${encode(payload)}`;

  const signatureBytes = await crypto.subtle.sign(
    { name: "RSASSA-PKCS1-v1_5" },
    privateKey,
    new TextEncoder().encode(unsignedJwt)
  );

  const signature = btoa(
    String.fromCharCode(...new Uint8Array(signatureBytes))
  )
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const signedJwt = `${unsignedJwt}.${signature}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: signedJwt,
    }),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    throw new Error(`Google token exchange failed: ${err}`);
  }

  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) {
    throw new Error(
      `No access_token in Google response: ${JSON.stringify(tokenData)}`
    );
  }
  return tokenData.access_token as string;
}

export async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const pemContents = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");

  const binaryDer = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

  return await crypto.subtle.importKey(
    "pkcs8",
    binaryDer.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

/**
 * Fetch all values from a Google Sheet tab.
 * Returns [] on failure (caller decides how to handle).
 */
export async function fetchSheetValues(
  accessToken: string,
  sheetId: string,
  range: string
): Promise<(string | number | boolean)[][]> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.values ?? [];
}

/**
 * Ensure all required headers exist in a sheet row, appending missing ones.
 * Returns the updated (or existing) header array.
 */
export async function ensureHeaders(
  accessToken: string,
  sheetId: string,
  tabName: string,
  requiredHeaders: string[]
): Promise<string[]> {
  const rows = await fetchSheetValues(
    accessToken,
    sheetId,
    `${tabName}!1:1`
  );
  const existing: string[] = (rows[0] ?? []).map((h) =>
    String(h).trim()
  );

  const missing = requiredHeaders.filter(
    (h) => !existing.some((e) => e.toLowerCase() === h.toLowerCase())
  );

  if (missing.length === 0) return existing;

  // Append missing headers after the last existing column
  const startCol = existing.length + 1;
  const endCol = existing.length + missing.length;
  const range = `${tabName}!${colToLetter(startCol)}1:${colToLetter(endCol)}1`;

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;
  await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      range,
      majorDimension: "ROWS",
      values: [missing],
    }),
  });

  return [...existing, ...missing];
}

export function colToLetter(colIndex: number): string {
  let temp: number;
  let letter = "";
  let c = colIndex;
  while (c > 0) {
    temp = (c - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    c = Math.floor((c - temp - 1) / 26);
  }
  return letter;
}

