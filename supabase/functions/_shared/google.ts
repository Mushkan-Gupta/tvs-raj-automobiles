// =============================================================================
// _shared/google.ts — Shared Google OAuth2 helper for edge functions
//
// Token caching: access tokens are cached in module memory until 5 min
// before expiry, keyed by client email. Concurrent requests share one
// in-flight promise so only one RSA sign + HTTP exchange happens.
// CryptoKey is also cached so the PEM is only imported once.
// =============================================================================

interface TokenCacheEntry {
  token: string;
  expiresAt: number; // ms since epoch
}
const tokenCache = new Map<string, TokenCacheEntry>();
const inFlightTokens = new Map<string, Promise<string>>();
const cryptoKeyCache = new Map<string, CryptoKey>();

/**
 * Returns a valid Google OAuth2 Bearer token for the Sheets scope.
 * Caches the token until 5 minutes before expiry. De-duplicates concurrent
 * requests so only one RSA-sign + HTTP exchange happens per instance.
 */
export async function getGoogleAccessToken(
  clientEmail: string,
  privateKeyPem: string,
): Promise<string> {
  const now = Date.now();
  const cached = tokenCache.get(clientEmail);
  // Use cached token if it still has > 5 minutes of life
  if (cached && cached.expiresAt - now > 5 * 60 * 1000) {
    return cached.token;
  }

  // De-duplicate concurrent requests
  const inFlight = inFlightTokens.get(clientEmail);
  if (inFlight) return inFlight;

  const promise = (async (): Promise<string> => {
    try {
      const privateKey = await importPrivateKey(privateKeyPem);

      const iat = Math.floor(Date.now() / 1000);
      const exp = iat + 3600;
      const payload = {
        iss: clientEmail,
        sub: clientEmail,
        scope: "https://www.googleapis.com/auth/spreadsheets",
        aud: "https://oauth2.googleapis.com/token",
        iat,
        exp,
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
        new TextEncoder().encode(unsignedJwt),
      );

      const signature = btoa(
        String.fromCharCode(...new Uint8Array(signatureBytes)),
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
          `No access_token in Google response: ${JSON.stringify(tokenData)}`,
        );
      }

      const token = tokenData.access_token as string;
      const expiresAt = Date.now() + (tokenData.expires_in ?? 3600) * 1000;
      tokenCache.set(clientEmail, { token, expiresAt });
      return token;
    } finally {
      inFlightTokens.delete(clientEmail);
    }
  })();

  inFlightTokens.set(clientEmail, promise);
  return promise;
}

export async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const cacheKey = pem.slice(0, 64); // use prefix as cache key
  const cached = cryptoKeyCache.get(cacheKey);
  if (cached) return cached;

  const pemContents = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");

  const binaryDer = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

  const key = await crypto.subtle.importKey(
    "pkcs8",
    binaryDer.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  cryptoKeyCache.set(cacheKey, key);
  return key;
}

/**
 * Fetch a single range from a Google Sheet.
 * Returns [] on failure (caller decides how to handle).
 */
export async function fetchSheetValues(
  accessToken: string,
  sheetId: string,
  range: string,
): Promise<(string | number | boolean)[][]> {
  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.values ?? [];
}

/**
 * Fetch multiple ranges in a single batchGet call.
 * Returns a map of range -> values[][].
 */
export async function batchGetSheetValues(
  accessToken: string,
  sheetId: string,
  ranges: string[],
): Promise<Map<string, (string | number | boolean)[][]>> {
  const params = ranges.map((r) => `ranges=${encodeURIComponent(r)}`).join("&");
  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values:batchGet?${params}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const result = new Map<string, (string | number | boolean)[][]>();
  if (!res.ok) return result;
  const data = await res.json();
  for (const vr of data.valueRanges ?? []) {
    // key by the requested range (the first element of the ranges array matching)
    result.set(vr.range ?? "", vr.values ?? []);
  }
  // Also key by the requested range strings (pre-encoding) for easy lookup
  if (Array.isArray(data.valueRanges)) {
    for (let i = 0; i < ranges.length; i++) {
      const vr = data.valueRanges[i];
      if (vr) result.set(ranges[i], vr.values ?? []);
    }
  }
  return result;
}

/**
 * Ensure all required headers exist in a sheet row, appending missing ones.
 * Returns the updated (or existing) header array.
 */
export async function ensureHeaders(
  accessToken: string,
  sheetId: string,
  tabName: string,
  requiredHeaders: string[],
): Promise<string[]> {
  const rows = await fetchSheetValues(
    accessToken,
    sheetId,
    `${tabName}!1:1`,
  );
  const existing: string[] = (rows[0] ?? []).map((h) => String(h).trim());

  const missing = requiredHeaders.filter(
    (h) => !existing.some((e) => e.toLowerCase() === h.toLowerCase()),
  );

  if (missing.length === 0) return existing;

  // Append missing headers after the last existing column
  const startCol = existing.length + 1;
  const endCol = existing.length + missing.length;
  const range =
    `${tabName}!${colToLetter(startCol)}1:${colToLetter(endCol)}1`;

  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;
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
