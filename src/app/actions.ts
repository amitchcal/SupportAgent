"use server";

import { randomUUID } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { BorderRadius, IssueCategory, Role, SupportedLanguage, TenantTheme, ThemeMode } from "@/lib/domain";
import { getCurrentUser, requireUser, SESSION_COOKIE } from "@/lib/auth";
import { assertCan, scopeTenant } from "@/lib/rbac";
import { createSessionToken, encryptSecret, hashPassword, verifyPassword } from "@/lib/security";
import { audit, createTenantRecord, findUserByEmail, mutateDatabase, readDatabase } from "@/lib/store";
import { sanitizeTheme, validateThemeColors } from "@/lib/theme";
import { persistKnowledgeFile } from "@/lib/knowledge";
import { validateSopSteps } from "@/lib/sop";
import { CustomWebhookAdapter, ServiceNowAdapter, retryFailedTicket } from "@/lib/ticketing";
import { reviewKnowledgeGap } from "@/lib/enterprise";
import { anonymizedRateLimitKey, clearRateLimit, consumeRateLimit } from "@/lib/rate-limit";
import { applyIndustryTemplate, createIndustryTemplate, validateIndustryTemplate } from "@/lib/industry";

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

export async function login(form: FormData) {
  const email = text(form, "email").toLowerCase();
  const password = text(form, "password");
  const requestHeaders = await headers();
  const address = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() || requestHeaders.get("x-real-ip") || "unknown";
  const rateKey = anonymizedRateLimitKey("login", `${address}:${email}`);
  const limit = await consumeRateLimit(rateKey, 5, 15 * 60);
  if (!limit.allowed) redirect(`/login?error=rate&retry=${limit.retryAfterSeconds}`);
  const user = await findUserByEmail(email);
  if (!user || user.status !== "ACTIVE" || !verifyPassword(password, user.passwordHash)) redirect("/login?error=invalid");
  await clearRateLimit(rateKey);
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

export async function createIndustryTemplateAction(form: FormData) {
  const actor = await requireUser(); assertCan(actor.role, "tenants:manage");
  const severityRules = jsonObject(text(form, "severityRules"), "Severity rules") as Record<string, "low" | "medium" | "high" | "critical">;
  const template = createIndustryTemplate({ name: text(form, "name"), description: text(form, "description"), issueCategories: form.getAll("issueCategories") as IssueCategory[], requiredFields: text(form, "requiredFields").split(",").map((item) => item.trim()).filter(Boolean), defaultSopTypes: text(form, "defaultSopTypes").split(",").map((item) => item.trim()).filter(Boolean), severityRules, escalationBehavior: text(form, "escalationBehavior") as "always" | "outside-hours" | "safety-and-low-confidence" }, actor.id);
  await mutateDatabase((database) => { database.industryTemplates ??= []; if (database.industryTemplates.some((item) => item.name.toLowerCase() === template.name.toLowerCase() && item.status === "ACTIVE")) throw new Error("An active template with this name already exists."); database.industryTemplates.push(template); audit(database, { tenantId: null, actorUserId: actor.id, action: "industry_template.created", entityType: "industry_template", entityId: template.id, oldValue: null, newValue: template }); });
  revalidatePath("/admin/industry-templates");
}

export async function applyIndustryTemplateAction(form: FormData) {
  const actor = await requireUser(); assertCan(actor.role, "settings:manage");
  const tenantId = scopeTenant(actor.role, actor.tenantId, text(form, "tenantId") || undefined); const templateId = text(form, "templateId");
  await mutateDatabase((database) => { const tenant = database.tenants.find((item) => item.id === tenantId); if (!tenant) throw new Error("Tenant not found."); const oldValue = tenant.settings; applyIndustryTemplate(database, tenantId, templateId); audit(database, { tenantId, actorUserId: actor.id, action: "industry_template.applied", entityType: "tenant", entityId: tenantId, oldValue, newValue: tenant.settings }); });
  revalidatePath("/admin"); revalidatePath("/admin/industry-templates");
}

export async function customizeIndustryTemplateAction(form: FormData) {
  const actor = await requireUser(); assertCan(actor.role, "settings:manage");
  const tenantId = scopeTenant(actor.role, actor.tenantId, text(form, "tenantId") || undefined); const severityRules = jsonObject(text(form, "severityRules"), "Severity rules") as Record<string, "low" | "medium" | "high" | "critical">; const issueCategories = form.getAll("issueCategories") as IssueCategory[]; const requiredFields = text(form, "requiredFields").split(",").map((item) => item.trim()).filter(Boolean); const defaultSopTypes = text(form, "defaultSopTypes").split(",").map((item) => item.trim()).filter(Boolean);
  await mutateDatabase((database) => { const tenant = database.tenants.find((item) => item.id === tenantId); if (!tenant) throw new Error("Tenant not found."); validateIndustryTemplate({ name: "Tenant customization", description: "", issueCategories, requiredFields, defaultSopTypes, severityRules, escalationBehavior: tenant.settings.escalationBehavior }); const oldValue = tenant.settings; tenant.settings = { ...tenant.settings, issueCategories, requiredSupportFields: requiredFields, defaultSopTypes, severityRules }; tenant.updatedAt = new Date().toISOString(); audit(database, { tenantId, actorUserId: actor.id, action: "industry_template.customized", entityType: "tenant", entityId: tenantId, oldValue, newValue: tenant.settings }); });
  revalidatePath("/admin/industry-templates");
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
  const colorValues = ["primary","secondary","accent","background","surface","text","mutedText","border"].map((key)=>text(form,key)); validateThemeColors(colorValues);
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

export async function uploadKnowledgeDocument(form: FormData) {
  const actor = await requireUser(); assertCan(actor.role, "knowledge:manage"); const tenantId = scopeTenant(actor.role, actor.tenantId, text(form, "tenantId") || undefined);
  const file = form.get("file"); if (!(file instanceof File)) throw new Error("Choose a document to upload.");
  const documentId = randomUUID(); const stored = await persistKnowledgeFile(tenantId, documentId, file); const now = new Date().toISOString();
  await mutateDatabase((database) => { const versionId = randomUUID(); const document = { id: documentId, tenantId, title: text(form, "title") || file.name, description: text(form, "description"), tags: text(form, "tags").split(",").map((item) => item.trim()).filter(Boolean), status: "DRAFT" as const, currentVersionId: null, createdBy: actor.id, createdAt: now, updatedAt: now }; const version = { id: versionId, tenantId, documentId, version: 1, fileName: file.name, fileType: stored.type, storagePath: stored.storagePath, checksum: stored.checksum, status: "DRAFT" as const, chunks: stored.chunks, createdBy: actor.id, approvedBy: null, createdAt: now, approvedAt: null }; database.knowledgeDocuments.push(document); database.knowledgeVersions.push(version); audit(database, { tenantId, actorUserId: actor.id, action: "knowledge.document.uploaded", entityType: "knowledge_document", entityId: documentId, oldValue: null, newValue: { document, version: { ...version, storagePath: "[STORED]" } } }); });
  revalidatePath("/admin");
}

export async function uploadKnowledgeVersion(form: FormData) {
  const actor = await requireUser(); assertCan(actor.role, "knowledge:manage"); const documentId = text(form, "documentId"); const file = form.get("file"); if (!(file instanceof File)) throw new Error("Choose a document to upload.");
  let tenantId = ""; let nextVersion = 1;
  await mutateDatabase((database) => { const document = database.knowledgeDocuments.find((item) => item.id === documentId); if (!document) throw new Error("Document not found."); tenantId = scopeTenant(actor.role, actor.tenantId, document.tenantId); nextVersion = Math.max(0, ...database.knowledgeVersions.filter((item) => item.documentId === documentId && item.tenantId === tenantId).map((item) => item.version)) + 1; });
  const stored = await persistKnowledgeFile(tenantId, documentId, file); const now = new Date().toISOString();
  await mutateDatabase((database) => { const version = { id: randomUUID(), tenantId, documentId, version: nextVersion, fileName: file.name, fileType: stored.type, storagePath: stored.storagePath, checksum: stored.checksum, status: "DRAFT" as const, chunks: stored.chunks, createdBy: actor.id, approvedBy: null, createdAt: now, approvedAt: null }; database.knowledgeVersions.push(version); audit(database, { tenantId, actorUserId: actor.id, action: "knowledge.version.uploaded", entityType: "knowledge_version", entityId: version.id, oldValue: null, newValue: { ...version, storagePath: "[STORED]" } }); });
  revalidatePath("/admin");
}

export async function approveKnowledgeVersion(form: FormData) {
  const actor = await requireUser(); assertCan(actor.role, "knowledge:manage"); const versionId = text(form, "versionId");
  await mutateDatabase((database) => { const version = database.knowledgeVersions.find((item) => item.id === versionId); if (!version) throw new Error("Version not found."); const tenantId = scopeTenant(actor.role, actor.tenantId, version.tenantId); const document = database.knowledgeDocuments.find((item) => item.id === version.documentId && item.tenantId === tenantId); if (!document) throw new Error("Document not found."); const oldValue = { documentStatus: document.status, currentVersionId: document.currentVersionId, versionStatus: version.status }; database.knowledgeVersions.filter((item) => item.documentId === document.id && item.tenantId === tenantId && item.status === "ACTIVE").forEach((item) => { item.status = "ARCHIVED"; }); const now = new Date().toISOString(); version.status = "ACTIVE"; version.approvedBy = actor.id; version.approvedAt = now; document.status = "ACTIVE"; document.currentVersionId = version.id; document.updatedAt = now; audit(database, { tenantId, actorUserId: actor.id, action: "knowledge.version.approved", entityType: "knowledge_version", entityId: version.id, oldValue, newValue: { documentStatus: document.status, currentVersionId: document.currentVersionId, versionStatus: version.status } }); });
  revalidatePath("/admin");
}

export async function archiveKnowledgeDocument(form: FormData) {
  const actor = await requireUser(); assertCan(actor.role, "knowledge:manage"); const documentId = text(form, "documentId");
  await mutateDatabase((database) => { const document = database.knowledgeDocuments.find((item) => item.id === documentId); if (!document) throw new Error("Document not found."); const tenantId = scopeTenant(actor.role, actor.tenantId, document.tenantId); const oldValue = { status: document.status }; document.status = "ARCHIVED"; document.updatedAt = new Date().toISOString(); database.knowledgeVersions.filter((item) => item.documentId === document.id && item.tenantId === tenantId).forEach((item) => { item.status = "ARCHIVED"; }); audit(database, { tenantId, actorUserId: actor.id, action: "knowledge.document.archived", entityType: "knowledge_document", entityId: document.id, oldValue, newValue: { status: document.status } }); });
  revalidatePath("/admin");
}

export async function createSop(form: FormData) {
  const actor = await requireUser(); assertCan(actor.role, "sops:manage"); const tenantId = scopeTenant(actor.role, actor.tenantId, text(form, "tenantId") || undefined);
  const title = text(form, "title"); const category = text(form, "category") as IssueCategory; const language = text(form, "language") as SupportedLanguage; const validCategories = new Set<IssueCategory>(["Mechanical","Electrical","Instrumentation","PLC/Automation","Hydraulic","Pneumatic","Calibration","Installation","Warranty","Spare Parts","Documentation","Preventive Maintenance","Safety","Other"]); if (!title || !validCategories.has(category) || !(["en","hi","hinglish"] as string[]).includes(language)) throw new Error("Provide a title, supported category, and language.");
  let rawSteps: unknown; try { rawSteps = JSON.parse(text(form, "steps")); } catch { throw new Error("SOP steps must be valid JSON."); } const steps = validateSopSteps(rawSteps); const now = new Date().toISOString();
  await mutateDatabase((database) => { const sop = { id: randomUUID(), tenantId, title, category, product: text(form, "product"), language, status: "DRAFT" as const, version: 1, steps, createdBy: actor.id, approvedBy: null, createdAt: now, updatedAt: now, approvedAt: null }; database.sopDefinitions.push(sop); audit(database, { tenantId, actorUserId: actor.id, action: "sop.created", entityType: "sop", entityId: sop.id, oldValue: null, newValue: sop }); });
  revalidatePath("/admin");
}

export async function activateSop(form: FormData) {
  const actor = await requireUser(); assertCan(actor.role, "sops:manage"); const sopId = text(form, "sopId");
  await mutateDatabase((database) => { const sop = database.sopDefinitions.find((item) => item.id === sopId); if (!sop) throw new Error("SOP not found."); const tenantId = scopeTenant(actor.role, actor.tenantId, sop.tenantId); validateSopSteps(sop.steps); const oldValue = { status: sop.status }; database.sopDefinitions.filter((item) => item.tenantId === tenantId && item.category === sop.category && item.language === sop.language && item.product === sop.product && item.status === "ACTIVE").forEach((item) => { item.status = "ARCHIVED"; }); const now = new Date().toISOString(); sop.status = "ACTIVE"; sop.approvedBy = actor.id; sop.approvedAt = now; sop.updatedAt = now; audit(database, { tenantId, actorUserId: actor.id, action: "sop.activated", entityType: "sop", entityId: sop.id, oldValue, newValue: { status: sop.status, approvedBy: actor.id } }); });
  revalidatePath("/admin");
}

function jsonObject(value: string, label: string) { try { const parsed = value ? JSON.parse(value) : {}; if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") throw new Error(); return parsed as Record<string, string>; } catch { throw new Error(`${label} must be a valid JSON object.`); } }

export async function saveServiceNowIntegration(form:FormData){ const actor=await requireUser(); assertCan(actor.role,"integrations:manage"); const tenantId=scopeTenant(actor.role,actor.tenantId,text(form,"tenantId")||undefined); const endpointUrl=text(form,"endpointUrl"); if(new URL(endpointUrl).protocol!=="https:")throw new Error("ServiceNow endpoint must use HTTPS."); const now=new Date().toISOString(); await mutateDatabase(database=>{database.ticketingIntegrations.filter(item=>item.tenantId===tenantId).forEach(item=>item.isActive=false); const integration={id:randomUUID(),tenantId,type:"SERVICENOW" as const,name:text(form,"name")||"ServiceNow",endpointUrl,headers:{},authType:"BASIC" as const,authConfigEncrypted:encryptSecret({username:text(form,"username"),password:text(form,"password")}),fieldMapping:jsonObject(text(form,"fieldMapping"),"Field mapping"),isActive:true,lastTestedAt:null,lastTestStatus:null,createdBy:actor.id,createdAt:now,updatedAt:now}; database.ticketingIntegrations.push(integration); audit(database,{tenantId,actorUserId:actor.id,action:"ticketing.servicenow.updated",entityType:"ticketing_integration",entityId:integration.id,oldValue:null,newValue:{...integration,authConfigEncrypted:"[REDACTED]"}});}); revalidatePath("/admin"); }
export async function testServiceNowIntegration(form:FormData){ const actor=await requireUser(); assertCan(actor.role,"integrations:manage"); const integrationId=text(form,"integrationId"); const database=await readDatabase(); const integration=database.ticketingIntegrations.find(item=>item.id===integrationId&&item.type==="SERVICENOW"); if(!integration)throw new Error("ServiceNow integration not found."); scopeTenant(actor.role,actor.tenantId,integration.tenantId); await new ServiceNowAdapter(integration).test(); await mutateDatabase(current=>{const stored=current.ticketingIntegrations.find(item=>item.id===integrationId);if(stored){stored.lastTestStatus="SUCCESS";stored.lastTestedAt=new Date().toISOString();}}); revalidatePath("/admin"); }
export async function retryTicket(form:FormData){ const actor=await requireUser(); assertCan(actor.role,"integrations:manage"); const ticketId=text(form,"ticketId"); const database=await readDatabase(); const ticket=database.tickets.find(item=>item.id===ticketId); if(!ticket)throw new Error("Ticket not found."); const tenantId=scopeTenant(actor.role,actor.tenantId,ticket.tenantId); await retryFailedTicket(tenantId,ticketId); await mutateDatabase(current=>audit(current,{tenantId,actorUserId:actor.id,action:"ticket.retry.requested",entityType:"ticket",entityId:ticketId,oldValue:null,newValue:{attempt:ticket.creationAttempts+1}})); revalidatePath("/admin"); }
export async function markKnowledgeGapReviewed(form:FormData){ const actor=await requireUser(); assertCan(actor.role,"knowledge:manage"); const gapId=text(form,"gapId"); const database=await readDatabase(); const gap=(database.knowledgeGaps??[]).find(item=>item.id===gapId); if(!gap)throw new Error("Knowledge gap not found."); const tenantId=scopeTenant(actor.role,actor.tenantId,gap.tenantId); await mutateDatabase(current=>{reviewKnowledgeGap(current,tenantId,gapId,actor.id);audit(current,{tenantId,actorUserId:actor.id,action:"knowledge_gap.reviewed",entityType:"knowledge_gap",entityId:gapId,oldValue:{status:"OPEN"},newValue:{status:"REVIEWED"}});}); revalidatePath("/admin"); }

export async function saveWebhookIntegration(form: FormData) {
  const actor = await requireUser(); assertCan(actor.role, "integrations:manage"); const tenantId = scopeTenant(actor.role, actor.tenantId, text(form, "tenantId") || undefined); const endpointUrl = text(form, "endpointUrl"); const url = new URL(endpointUrl); if (url.protocol !== "https:") throw new Error("Webhook endpoint must use HTTPS."); const headers = jsonObject(text(form, "headers"), "Headers"); const fieldMapping = jsonObject(text(form, "fieldMapping"), "Field mapping"); const authType = text(form, "authType") as "NONE" | "BEARER" | "BASIC"; if (!(["NONE","BEARER","BASIC"] as string[]).includes(authType)) throw new Error("Unsupported authentication type."); const auth = authType === "BEARER" ? { token: text(form, "token") } : authType === "BASIC" ? { username: text(form, "username"), password: text(form, "password") } : {}; const now = new Date().toISOString();
  await mutateDatabase((database) => { database.ticketingIntegrations.filter((item) => item.tenantId === tenantId).forEach((item) => { item.isActive = false; }); const integration = { id: randomUUID(), tenantId, type: "CUSTOM_WEBHOOK" as const, name: text(form, "name") || "Custom webhook", endpointUrl, headers, authType, authConfigEncrypted: encryptSecret(auth), fieldMapping, isActive: true, lastTestedAt: null, lastTestStatus: null, createdBy: actor.id, createdAt: now, updatedAt: now }; database.ticketingIntegrations.push(integration); audit(database, { tenantId, actorUserId: actor.id, action: "ticketing.integration.updated", entityType: "ticketing_integration", entityId: integration.id, oldValue: null, newValue: { ...integration, authConfigEncrypted: "[REDACTED]", headers: Object.keys(headers) } }); });
  revalidatePath("/admin");
}

export async function testWebhookIntegration(form: FormData) {
  const actor = await requireUser(); assertCan(actor.role, "integrations:manage"); const integrationId = text(form, "integrationId"); const database = await readDatabase(); const integration = database.ticketingIntegrations.find((item) => item.id === integrationId); if (!integration) throw new Error("Integration not found."); const tenantId = scopeTenant(actor.role, actor.tenantId, integration.tenantId); let result: unknown = null; let error: string | null = null; try { result = await new CustomWebhookAdapter(integration).test(); } catch (reason) { error = reason instanceof Error ? reason.message : "Webhook test failed."; }
  await mutateDatabase((current) => { const stored = current.ticketingIntegrations.find((item) => item.id === integrationId && item.tenantId === tenantId); if (stored) { stored.lastTestedAt = new Date().toISOString(); stored.lastTestStatus = error ? "FAILED" : "SUCCESS"; stored.updatedAt = new Date().toISOString(); } current.ticketSyncLogs.push({ id: randomUUID(), tenantId, ticketId: null, integrationId, action: "TEST", requestPayload: { event: "ticketing.test" }, responsePayload: result, status: error ? "FAILED" : "SUCCESS", errorMessage: error, createdAt: new Date().toISOString() }); }); revalidatePath("/admin");
}
