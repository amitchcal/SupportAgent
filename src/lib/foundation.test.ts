import assert from "node:assert/strict";
import test from "node:test";
import { can, scopeTenant } from "./rbac";
import { createSessionToken, hashPassword, verifyPassword, verifySessionToken } from "./security";
import { defaultTheme } from "./domain";
import { sanitizeTheme, themeStyle } from "./theme";

test("password hashes are salted and verifiable", () => {
  const first = hashPassword("A-strong-password-2026");
  const second = hashPassword("A-strong-password-2026");
  assert.notEqual(first, second);
  assert.equal(verifyPassword("A-strong-password-2026", first), true);
  assert.equal(verifyPassword("wrong-password", first), false);
});

test("sessions reject tampering and expiry", () => {
  const token = createSessionToken("user-1", 1_000_000);
  assert.equal(verifySessionToken(token, 1_000_000)?.userId, "user-1");
  assert.equal(verifySessionToken(`${token}x`, 1_000_000), null);
  assert.equal(verifySessionToken(token, 1_000_000 + 9 * 60 * 60 * 1000), null);
});

test("RBAC separates knowledge, integration, reporting, and viewer access", () => {
  assert.equal(can("KNOWLEDGE_MANAGER", "knowledge:manage"), true);
  assert.equal(can("KNOWLEDGE_MANAGER", "integrations:manage"), false);
  assert.equal(can("INTEGRATION_ADMIN", "integrations:manage"), true);
  assert.equal(can("SUPPORT_SUPERVISOR", "reports:read"), true);
  assert.equal(can("VIEWER", "settings:manage"), false);
});

test("tenant scope cannot be spoofed by a tenant administrator", () => {
  assert.equal(scopeTenant("TENANT_ADMIN", "tenant-a"), "tenant-a");
  assert.throws(() => scopeTenant("TENANT_ADMIN", "tenant-a", "tenant-b"), /Forbidden/);
  assert.equal(scopeTenant("SUPER_ADMIN", null, "tenant-b"), "tenant-b");
});

test("invalid tenant themes safely fall back without leaking values", () => {
  const sanitized = sanitizeTheme({ primary: "red", mode: "dark", fontFamily: "Comic Sans" as never });
  assert.equal(sanitized.primary, defaultTheme.primary);
  assert.equal(sanitized.mode, "dark");
  assert.equal(sanitized.fontFamily, defaultTheme.fontFamily);
  assert.equal((themeStyle(sanitized) as Record<string, string>)["--color-primary"], defaultTheme.primary);
});
