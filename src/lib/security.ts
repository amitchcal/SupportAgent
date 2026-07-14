import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

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

function encryptionKey() { const material = process.env.TICKETING_SECRET ?? process.env.SESSION_SECRET; if (!material && process.env.NODE_ENV === "production") throw new Error("TICKETING_SECRET or SESSION_SECRET must be configured in production."); return createHash("sha256").update(material ?? "development-only-change-ticketing-secret").digest(); }

export function encryptSecret(value: unknown) {
  const iv = randomBytes(12); const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv); const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return `${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${ciphertext.toString("base64url")}`;
}

export function decryptSecret<T>(value: string): T {
  const [iv, tag, ciphertext] = value.split("."); if (!iv || !tag || !ciphertext) throw new Error("Encrypted integration credentials are invalid."); const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64url")); decipher.setAuthTag(Buffer.from(tag, "base64url")); return JSON.parse(Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8")) as T;
}
