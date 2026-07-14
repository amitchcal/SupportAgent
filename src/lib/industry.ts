import { randomUUID } from "node:crypto";
import { defaultSettings, type Classification, type Database, type IndustryTemplate, type IssueCategory, type TenantSettings } from "./domain";

const allowedCategories = new Set<IssueCategory>(["Mechanical", "Electrical", "Instrumentation", "PLC/Automation", "Hydraulic", "Pneumatic", "Calibration", "Installation", "Warranty", "Spare Parts", "Documentation", "Preventive Maintenance", "Safety", "Other"]);
const escalationBehaviors = new Set<TenantSettings["escalationBehavior"]>(["always", "outside-hours", "safety-and-low-confidence"]);
const severities = new Set(["low", "medium", "high", "critical"] as const);

export type IndustryTemplateInput = Omit<IndustryTemplate, "id" | "status" | "createdBy" | "createdAt" | "updatedAt">;

export function validateIndustryTemplate(input: IndustryTemplateInput) {
  if (!input.name.trim()) throw new Error("Template name is required.");
  if (!input.issueCategories.length || input.issueCategories.some((category) => !allowedCategories.has(category))) throw new Error("Choose at least one supported issue category.");
  if (!input.requiredFields.length || input.requiredFields.some((field) => !/^[a-z][a-zA-Z0-9]{1,39}$/.test(field))) throw new Error("Required fields must use safe field names.");
  if (!input.defaultSopTypes.length || input.defaultSopTypes.some((type) => !type.trim())) throw new Error("Provide at least one default SOP type.");
  if (!escalationBehaviors.has(input.escalationBehavior)) throw new Error("Unsupported escalation behavior.");
  if (Object.entries(input.severityRules).some(([term, severity]) => !term.trim() || !severities.has(severity))) throw new Error("Severity rules are invalid.");
  return true;
}

export function createIndustryTemplate(input: IndustryTemplateInput, actorUserId: string, now = new Date().toISOString()): IndustryTemplate {
  validateIndustryTemplate(input);
  return { ...input, name: input.name.trim(), description: input.description.trim(), requiredFields: [...new Set(input.requiredFields)], defaultSopTypes: [...new Set(input.defaultSopTypes.map((item) => item.trim()))], id: randomUUID(), status: "ACTIVE", createdBy: actorUserId, createdAt: now, updatedAt: now };
}

export function applyIndustryTemplate(database: Database, tenantId: string, templateId: string, now = new Date().toISOString()) {
  const tenant = database.tenants.find((item) => item.id === tenantId); if (!tenant) throw new Error("Tenant not found.");
  const template = (database.industryTemplates ?? []).find((item) => item.id === templateId && item.status === "ACTIVE"); if (!template) throw new Error("Active industry template not found.");
  tenant.settings = { ...tenant.settings, industryTemplateId: template.id, issueCategories: [...template.issueCategories], requiredSupportFields: [...template.requiredFields], defaultSopTypes: [...template.defaultSopTypes], severityRules: { ...template.severityRules }, escalationBehavior: template.escalationBehavior };
  tenant.updatedAt = now;
  return tenant;
}

export function effectiveIndustrySettings(settings: TenantSettings) {
  return { industryTemplateId: settings.industryTemplateId ?? null, issueCategories: settings.issueCategories ?? [...allowedCategories], requiredFields: settings.requiredSupportFields ?? defaultSettings.requiredSupportFields, defaultSopTypes: settings.defaultSopTypes ?? [], severityRules: settings.severityRules ?? {}, escalationBehavior: settings.escalationBehavior };
}

export function applyIndustryClassification(classification: Classification, message: string, settings: TenantSettings): Classification {
  const configured = effectiveIndustrySettings(settings); const category = configured.issueCategories.includes(classification.category) ? classification.category : "Other";
  const ranks = { low: 0, medium: 1, high: 2, critical: 3 } as const; let severity = classification.severity;
  for (const [term, configuredSeverity] of Object.entries(configured.severityRules)) if (message.toLowerCase().includes(term.toLowerCase()) && ranks[configuredSeverity] > ranks[severity]) severity = configuredSeverity;
  const urgency = severity === "critical" ? "immediate" : severity === "high" ? "urgent" : severity === "medium" ? "soon" : "routine";
  return { ...classification, category, severity, urgency, confidence: category === "Other" && classification.category !== "Other" ? Math.min(classification.confidence, 0.55) : classification.confidence };
}
