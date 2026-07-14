"use server";

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { BorderRadius, Role, TenantTheme, ThemeMode } from "@/lib/domain";
import { getCurrentUser, requireUser, SESSION_COOKIE } from "@/lib/auth";
import { assertCan, scopeTenant } from "@/lib/rbac";
import { createSessionToken, hashPassword, verifyPassword } from "@/lib/security";
import { audit, createTenantRecord, findUserByEmail, mutateDatabase } from "@/lib/store";
import { sanitizeTheme } from "@/lib/theme";

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

export async function login(form: FormData) {
  const email = text(form, "email").toLowerCase();
  const password = text(form, "password");
  const user = await findUserByEmail(email);
  if (!user || user.status !== "ACTIVE" || !verifyPassword(password, user.passwordHash)) redirect("/login?error=invalid");
  (await cookies()).set(SESSION_COOKIE, createSessionToken(user.id), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 8 });
  redirect("/admin");
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}

export async function initializePlatform(form: FormData) {
  const email = text(form, "email").toLowerCase(); const password = text(form, "password");
  let userId = "";
  await mutateDatabase((database) => {
    if (database.users.length) throw new Error("Platform setup has already been completed.");
    const now = new Date().toISOString(); userId = randomUUID();
    database.users.push({ id: userId, tenantId: null, email, name: text(form, "name"), role: "SUPER_ADMIN", status: "ACTIVE", passwordHash: hashPassword(password), createdAt: now, updatedAt: now });
    audit(database, { tenantId: null, actorUserId: userId, action: "platform.initialized", entityType: "user", entityId: userId, oldValue: null, newValue: { email, role: "SUPER_ADMIN" } });
  });
  (await cookies()).set(SESSION_COOKIE, createSessionToken(userId), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 8 });
  redirect("/admin");
}

export async function createTenant(form: FormData) {
  const actor = await requireUser(); assertCan(actor.role, "tenants:manage");
  const name = text(form, "name"); const slug = text(form, "slug").toLowerCase();
  if (!name || !/^[a-z0-9-]{3,40}$/.test(slug)) throw new Error("Provide a name and a valid lowercase slug.");
  await mutateDatabase((database) => {
    if (database.tenants.some((tenant) => tenant.slug === slug)) throw new Error("Tenant slug already exists.");
    const tenant = createTenantRecord({ name, slug }); database.tenants.push(tenant);
    audit(database, { tenantId: tenant.id, actorUserId: actor.id, action: "tenant.created", entityType: "tenant", entityId: tenant.id, oldValue: null, newValue: tenant });
  });
  revalidatePath("/admin");
}

export async function updateSettings(form: FormData) {
  const actor = await requireUser(); assertCan(actor.role, "settings:manage");
  const tenantId = scopeTenant(actor.role, actor.tenantId, text(form, "tenantId") || undefined);
  await mutateDatabase((database) => {
    const tenant = database.tenants.find((item) => item.id === tenantId); if (!tenant) throw new Error("Tenant not found.");
    const oldValue = tenant.settings; const threshold = Number(text(form, "confidenceThreshold"));
    tenant.settings = { ...tenant.settings, timezone: text(form, "timezone"), defaultLanguage: text(form, "defaultLanguage") as typeof tenant.settings.defaultLanguage, enabledLanguages: form.getAll("enabledLanguages") as typeof tenant.settings.enabledLanguages, requiredSupportFields: text(form, "requiredSupportFields").split(",").map((item) => item.trim()).filter(Boolean), escalationBehavior: text(form, "escalationBehavior") as typeof tenant.settings.escalationBehavior, confidenceThreshold: Number.isFinite(threshold) ? Math.min(1, Math.max(0, threshold)) : tenant.settings.confidenceThreshold };
    tenant.updatedAt = new Date().toISOString(); audit(database, { tenantId, actorUserId: actor.id, action: "tenant.settings.updated", entityType: "tenant", entityId: tenant.id, oldValue, newValue: tenant.settings });
  });
  revalidatePath("/admin");
}

export async function updateBranding(form: FormData) {
  const actor = await requireUser();
  assertCan(actor.role, "settings:manage");
  const tenantId = scopeTenant(actor.role, actor.tenantId, text(form, "tenantId") || undefined);
  await mutateDatabase((database) => {
    const tenant = database.tenants.find((item) => item.id === tenantId);
    if (!tenant) throw new Error("Tenant not found.");
    const oldValue = tenant.branding;
    tenant.branding = {
      productDisplayName: text(form, "productDisplayName"), companyDisplayName: text(form, "companyDisplayName"), supportAgentName: text(form, "supportAgentName"),
      logoUrl: text(form, "logoUrl"), faviconUrl: text(form, "faviconUrl"), footerText: text(form, "footerText"), supportEmail: text(form, "supportEmail"),
      supportPhone: text(form, "supportPhone"), privacyPolicyUrl: text(form, "privacyPolicyUrl"), termsUrl: text(form, "termsUrl"), hidePlatformBranding: form.get("hidePlatformBranding") === "on",
    };
    tenant.updatedAt = new Date().toISOString();
    audit(database, { tenantId, actorUserId: actor.id, action: "tenant.branding.updated", entityType: "tenant", entityId: tenant.id, oldValue, newValue: tenant.branding });
  });
  revalidatePath("/admin"); revalidatePath("/");
}

export async function updateTheme(form: FormData) {
  const actor = await requireUser();
  assertCan(actor.role, "settings:manage");
  const tenantId = scopeTenant(actor.role, actor.tenantId, text(form, "tenantId") || undefined);
  const theme = sanitizeTheme({ mode: text(form, "mode") as ThemeMode, primary: text(form, "primary"), secondary: text(form, "secondary"), accent: text(form, "accent"), background: text(form, "background"), surface: text(form, "surface"), text: text(form, "text"), mutedText: text(form, "mutedText"), border: text(form, "border"), radius: text(form, "radius") as BorderRadius, fontFamily: text(form, "fontFamily") as TenantTheme["fontFamily"] });
  await mutateDatabase((database) => {
    const tenant = database.tenants.find((item) => item.id === tenantId);
    if (!tenant) throw new Error("Tenant not found.");
    const oldValue = tenant.theme; tenant.theme = theme; tenant.updatedAt = new Date().toISOString();
    audit(database, { tenantId, actorUserId: actor.id, action: "tenant.theme.updated", entityType: "tenant", entityId: tenant.id, oldValue, newValue: theme });
  });
  revalidatePath("/admin"); revalidatePath("/");
}

export async function addUser(form: FormData) {
  const actor = await requireUser(); assertCan(actor.role, "users:manage");
  const tenantId = scopeTenant(actor.role, actor.tenantId, text(form, "tenantId") || undefined);
  const email = text(form, "email").toLowerCase(); const role = text(form, "role") as Role;
  await mutateDatabase((database) => {
    if (database.users.some((user) => user.email.toLowerCase() === email)) throw new Error("Email already exists.");
    const now = new Date().toISOString();
    const user = { id: randomUUID(), tenantId, email, name: text(form, "name"), role, status: "ACTIVE" as const, passwordHash: hashPassword(text(form, "password")), createdAt: now, updatedAt: now };
    database.users.push(user); audit(database, { tenantId, actorUserId: actor.id, action: "user.created", entityType: "user", entityId: user.id, oldValue: null, newValue: { ...user, passwordHash: "[REDACTED]" } });
  });
  revalidatePath("/admin");
}

export async function deactivateUser(form: FormData) {
  const actor = await requireUser(); assertCan(actor.role, "users:manage");
  await mutateDatabase((database) => {
    const target = database.users.find((item) => item.id === text(form, "userId"));
    if (!target) throw new Error("User not found.");
    const tenantId = scopeTenant(actor.role, actor.tenantId, target.tenantId ?? undefined);
    if (target.id === actor.id) throw new Error("You cannot deactivate your own account.");
    const oldValue = { status: target.status }; target.status = "INACTIVE"; target.updatedAt = new Date().toISOString();
    audit(database, { tenantId, actorUserId: actor.id, action: "user.deactivated", entityType: "user", entityId: target.id, oldValue, newValue: { status: target.status } });
  });
  revalidatePath("/admin");
}

export async function currentTenantId() { return (await getCurrentUser())?.tenantId ?? null; }
