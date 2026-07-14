import assert from "node:assert/strict";
import test from "node:test";
import { defaultBranding, defaultSettings, defaultTheme, type Database, type TenantSettings } from "./domain";
import { applyIndustryClassification, applyIndustryTemplate, createIndustryTemplate, effectiveIndustrySettings, validateIndustryTemplate, type IndustryTemplateInput } from "./industry";

const now = new Date(0).toISOString();
const templateInput: IndustryTemplateInput = { name: "Industrial Equipment", description: "OEM field-service defaults", issueCategories: ["Mechanical", "Electrical", "Safety"], requiredFields: ["name", "email", "equipmentId"], defaultSopTypes: ["Safety check", "Troubleshooting"], severityRules: { smoke: "critical", leak: "high" }, escalationBehavior: "safety-and-low-confidence" };
function database(): Database { return { tenants: ["tenant-a", "tenant-b"].map((id) => ({ id, name: id, slug: id, status: "ACTIVE" as const, settings: { ...defaultSettings }, branding: { ...defaultBranding }, theme: { ...defaultTheme }, createdAt: now, updatedAt: now })), users: [], auditLogs: [], conversations: [], conversationMessages: [], conversationFeedback: [], knowledgeDocuments: [], knowledgeVersions: [], industryTemplates: [], sopDefinitions: [], sopExecutions: [], ticketingIntegrations: [], tickets: [], ticketSyncLogs: [] }; }

test("industry templates validate categories, fields, SOP types, severity and escalation rules", () => {
  assert.equal(validateIndustryTemplate({ ...templateInput, issueCategories: [...templateInput.issueCategories] }), true);
  assert.throws(() => validateIndustryTemplate({ ...templateInput, issueCategories: [] }), /category/);
  assert.throws(() => validateIndustryTemplate({ ...templateInput, requiredFields: ["unsafe field"] }), /field names/);
  assert.throws(() => validateIndustryTemplate({ ...templateInput, severityRules: { smoke: "invalid" as never } }), /Severity/);
});

test("tenant inherits a template and can customize its isolated copy", () => {
  const db = database(); const template = createIndustryTemplate({ ...templateInput, issueCategories: [...templateInput.issueCategories] }, "admin", now); db.industryTemplates = [template];
  applyIndustryTemplate(db, "tenant-a", template.id, now);
  const applied = effectiveIndustrySettings(db.tenants[0].settings);
  assert.equal(applied.industryTemplateId, template.id); assert.deepEqual(applied.issueCategories, template.issueCategories); assert.deepEqual(applied.requiredFields, template.requiredFields); assert.deepEqual(applied.defaultSopTypes, template.defaultSopTypes); assert.deepEqual(applied.severityRules, template.severityRules); assert.equal(applied.escalationBehavior, template.escalationBehavior);
  db.tenants[0].settings.requiredSupportFields.push("site");
  assert.deepEqual(template.requiredFields, ["name", "email", "equipmentId"]);
  assert.equal(db.tenants[1].settings.industryTemplateId, undefined);
  assert.throws(() => applyIndustryTemplate(db, "missing-tenant", template.id), /Tenant not found/);
});

test("tenant template categories and severity rules influence classification", () => {
  const settings: TenantSettings = { ...defaultSettings, issueCategories: ["Mechanical", "Safety"], severityRules: { leak: "high" } };
  const result = applyIndustryClassification({ category: "Hydraulic", severity: "medium", urgency: "soon", confidence: .9 }, "Hydraulic leak detected", settings);
  assert.equal(result.category, "Other"); assert.equal(result.severity, "high"); assert.equal(result.urgency, "urgent"); assert.equal(result.confidence, .55);
});
