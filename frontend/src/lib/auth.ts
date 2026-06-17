// Token storage + JWT claim decoding. The ID token is issued by Cognito (see lib/cognito.ts) and
// attached as a Bearer token by lib/api.ts. Claims drive route guards and the patient/staff split.
const TOKEN_KEY = "lablumen.token";

export interface Claims {
  sub: string;
  email?: string;
  groups: string[];
  exp: number;
}

const STAFF_GROUPS = ["LAB_STAFF", "LAB_ADMIN"];

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function decodeToken(token: string): Claims | null {
  try {
    const part = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(part));
    return {
      sub: payload.sub,
      email: payload.email,
      groups: payload["cognito:groups"] ?? [],
      exp: payload.exp,
    };
  } catch {
    return null;
  }
}

/** Decoded claims for the stored token, or null if absent/invalid/expired (clears expired). */
export function getClaims(): Claims | null {
  const token = getToken();
  if (!token) return null;
  const claims = decodeToken(token);
  if (!claims) return null;
  if (claims.exp * 1000 < Date.now()) {
    clearToken();
    return null;
  }
  return claims;
}

export function isAuthenticated(): boolean {
  return getClaims() !== null;
}

export function isStaff(claims: Claims | null = getClaims()): boolean {
  return Boolean(claims?.groups.some((g) => STAFF_GROUPS.includes(g)));
}
