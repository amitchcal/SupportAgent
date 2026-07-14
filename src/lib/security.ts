import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const SESSION_TTL_SECONDS = 60 * 60 * 8;

export function hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
  if (password.length < 12) throw new Error("Password must be at least 12 characters.");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

export function verifyPassword(password: string, stored: string) {
  const [salt, expectedHex] = stored.split(":");
  if (!salt || !expectedHex) return false;
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHex, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export type SessionClaims = { userId: string; expiresAt: number };

function secret() {
  return process.env.SESSION_SECRET ?? "development-only-change-this-session-secret";
}

export function createSessionToken(userId: string, now = Date.now()) {
  const payload = Buffer.from(
    JSON.stringify({ userId, expiresAt: Math.floor(now / 1000) + SESSION_TTL_SECONDS }),
  ).toString("base64url");
  const signature = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifySessionToken(token: string, now = Date.now()): SessionClaims | null {
  const [payload, supplied] = token.split(".");
  if (!payload || !supplied) return null;
  const expected = createHmac("sha256", secret()).update(payload).digest();
  const actual = Buffer.from(supplied, "base64url");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString()) as SessionClaims;
    return claims.expiresAt > Math.floor(now / 1000) ? claims : null;
  } catch {
    return null;
  }
}
